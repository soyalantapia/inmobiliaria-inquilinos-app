import type { Prisma } from '@prisma/client';
import type { JwtPayload, JwtProfesional } from '@llave/shared';
import { prisma } from '../db.js';

/**
 * ¿Este actor puede LEER este archivo del Volume?
 *
 * EL AGUJERO QUE CIERRA. `GET /uploads/:tenant/:name` autorizaba sólo por tenant
 * (`payload.inmobiliariaId === tenant`), así que cualquier inquilino, co-inquilino o profesional
 * con link mágico que conociera el nombre leía CUALQUIER archivo de esa inmobiliaria. Lo tapaba
 * únicamente el `randomUUID()` del nombre: oscuridad, no autorización.
 *
 * DOS VÍAS, alcanza con una:
 *
 *   1. **Lo subiste vos** — hay fila en `ArchivoSubido` a tu nombre. Cubre la ventana entre el
 *      `POST /uploads` y el request que persiste la URL, que es real: la PWA previsualiza el
 *      comprobante ANTES de informar el pago, y sin esta vía esa preview se rompería.
 *
 *   2. **Está colgado de una fila de tu ámbito** — el archivo lo referencia una fila de TU
 *      contrato, tuya como persona, o de TU visita. Ésta es la que salva a **todo lo histórico**:
 *      la tabla nace vacía, pero un comprobante de marzo sí tiene su `Pago` con `contratoId`, que
 *      es la MISMA fila que el front ya lee para armar el `<img src>`. Si tu pantalla te lo
 *      muestra, el guard te lo sirve. Por eso no hace falta backfill.
 *
 * POR QUÉ NO SE AUTO-ANULA. La vía 2 sería un agujero si alguien pudiera ENGANCHAR una URL ajena
 * a una fila propia (`POST /mis-documentos` con la URL de la víctima) y auto-autorizarse. Por eso
 * adjuntar exige exactamente lo mismo que leer: los call sites que aceptan una URL del cliente
 * usan `urlAdjuntable`, que llama a esta misma función. Un archivo que no podés leer, no lo podés
 * enganchar.
 *
 * EL PANEL NO CAMBIA. `kind: 'usuario'` sigue autorizando por tenant: son las personas de la
 * inmobiliaria, que legítimamente ven todo el material de su cartera, y acotarlas sería otro
 * cambio (y otro riesgo) sin relación con este agujero.
 */
export type ActorArchivo =
  | { kind: 'usuario'; tenant: string; userId: string }
  | { kind: 'inquilino'; tenant: string; inquilinoId: string; contratoId: string | null }
  | { kind: 'co-inquilino'; tenant: string; coInquilinoId: string; contratoId: string | null }
  | { kind: 'profesional'; tenant: string; visitaId: string };

/** ¿Hay fila de dueño a nombre de este actor? (vía 1) */
async function loSubioEl(url: string, actor: ActorArchivo, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<boolean> {
  const fila = await db.archivoSubido.findUnique({
    where: { url },
    select: { inmobiliariaId: true, subidoPorKind: true, subidoPorId: true },
  });
  if (!fila || fila.inmobiliariaId !== actor.tenant) return false;
  switch (actor.kind) {
    case 'usuario':
      return fila.subidoPorKind === 'USUARIO' && fila.subidoPorId === actor.userId;
    case 'inquilino':
      return fila.subidoPorKind === 'INQUILINO' && fila.subidoPorId === actor.inquilinoId;
    case 'co-inquilino':
      return fila.subidoPorKind === 'CO_INQUILINO' && fila.subidoPorId === actor.coInquilinoId;
    case 'profesional':
      return fila.subidoPorKind === 'PROFESIONAL' && fila.subidoPorId === actor.visitaId;
  }
}

/**
 * ¿Alguna fila del ámbito del actor referencia este archivo? (vía 2)
 *
 * Las columnas están elegidas una por una: son las que el front de ese actor efectivamente
 * renderiza. NO es un `archivoSigueEnUso` genérico sobre las 18 tablas — eso autorizaría por
 * "existe en algún lado del tenant", que es el agujero de nuevo.
 *
 * El costo de elegirlas a mano es que se puede olvidar una, y eso ya pasó: faltaban el
 * adjunto del chat del reclamo y las fotos de la visita, las dos cosas que la PWA del
 * inquilino renderiza en pantallas que ya estaban cubiertas a medias. Como esta lista NO se
 * puede derivar del schema (elegir de más ES el agujero), lo que la sostiene es un test que
 * la contrasta contra lo que los fronts efectivamente piden.
 */
async function estaEnSuAmbito(url: string, actor: ActorArchivo): Promise<boolean> {
  if (actor.kind === 'usuario') return true;

  if (actor.kind === 'profesional') {
    // El profesional ve, en /p/:token, la foto del reclamo de SU visita y las dos fotos de la
    // visita misma. Las que subió él las cubre `loSubioEl`; estas cuentan cubren el caso en
    // que la foto la cargó otro (el panel por él, o una reasignación de la visita).
    const n = await prisma.visitaProfesional.count({
      where: {
        id: actor.visitaId,
        inmobiliariaId: actor.tenant,
        OR: [{ reclamo: { fotoUrl: url } }, { fotoAntes: url }, { fotoDespues: url }],
      },
    });
    return n > 0;
  }

  const contratoId = actor.contratoId;
  const tenant = actor.tenant;
  const cuentas: Promise<number>[] = [];

  if (contratoId) {
    cuentas.push(
      prisma.pago.count({ where: { contratoId, inmobiliariaId: tenant, comprobanteUrl: url } }),
      prisma.boletaServicio.count({ where: { contratoId, archivoUrl: url } }),
      prisma.reclamo.count({ where: { contratoId, inmobiliariaId: tenant, fotoUrl: url } }),
      // EL ADJUNTO DEL CHAT DEL MISMO RECLAMO que cubre la línea de arriba. La foto del
      // reclamo estaba y el adjunto de los mensajes no, aunque el timeline de la PWA
      // (`reclamo-timeline.tsx`) los pinta uno al lado del otro. Cuando el adjunto lo manda
      // la inmobiliaria, la vía 1 (`ArchivoSubido`) no salva el caso: la fila queda a nombre
      // de un usuario del panel. Tampoco salva al co-inquilino ni a los adjuntos históricos,
      // porque no hay backfill del ledger.
      prisma.reclamoEvento.count({
        where: { adjuntoUrl: url, inmobiliariaId: tenant, reclamo: { contratoId } },
      }),
      // LAS FOTOS DE LA VISITA del profesional sobre un reclamo de este contrato: el inquilino
      // las ve en su app (`progreso-visita-inquilino.tsx`), y las sube el profesional, así que
      // la vía 1 nunca las cubre para él.
      prisma.visitaProfesional.count({
        where: { inmobiliariaId: tenant, reclamo: { contratoId }, fotoAntes: url },
      }),
      prisma.visitaProfesional.count({
        where: { inmobiliariaId: tenant, reclamo: { contratoId }, fotoDespues: url },
      }),
      prisma.documentoContrato.count({ where: { contratoId, archivoUrl: url } }),
      prisma.comprobante.count({ where: { pdfUrl: url, liquidacion: { contratoId } } }),
    );
  }
  if (actor.kind === 'inquilino') {
    // Lo suyo COMO PERSONA: su avatar y sus documentos personales (DNI, recibo de sueldo).
    cuentas.push(
      prisma.inquilino.count({ where: { id: actor.inquilinoId, imageUrl: url } }),
      prisma.documento.count({ where: { inquilinoId: actor.inquilinoId, archivoUrl: url } }),
    );
  }
  if (!cuentas.length) return false;
  return (await Promise.all(cuentas)).some((c) => c > 0);
}

export async function puedeLeerArchivo(url: string, actor: ActorArchivo): Promise<boolean> {
  if (actor.kind === 'usuario') return true; // el panel ve su cartera, como siempre
  if (await loSubioEl(url, actor)) return true;
  return estaEnSuAmbito(url, actor);
}

/**
 * ¿Este actor puede ADJUNTAR esta URL a una fila suya?
 *
 * Es la mitad que evita que la vía 2 se auto-anule, y **no depende del modo de observación**:
 * el bloqueo de escritura está siempre puesto. Denegar un enganche es seguro —el actor no pierde
 * acceso a nada que ya tenga— mientras que denegar una lectura sí podría romperle una pantalla.
 * Por eso las dos mitades tienen umbrales distintos a propósito.
 */
export async function urlAdjuntable(url: string, actor: ActorArchivo): Promise<boolean> {
  if (!url) return true; // limpiar el campo no es adjuntar
  return puedeLeerArchivo(url, actor);
}

/**
 * Arma el actor desde un payload de JWT. **Única implementación**, a propósito.
 *
 * El `contratoId` del CO-INQUILINO se lee de la BASE, nunca del token. El guard propio de
 * `/uploads` (`requireAuthOProfesional`) revalida su `estado` y su tenant pero NO compara el
 * `contratoId` del token contra la fila —`requireContratoAcceso` sí lo hace—, así que tomarlo
 * del token dejaría el ámbito para LEER más laxo que el del mismo actor para ADJUNTAR. Que la
 * regla viva en un solo lugar es lo que evita que esas dos mitades vuelvan a separarse.
 */
export async function actorDeJwt(p: JwtPayload | JwtProfesional): Promise<ActorArchivo | null> {
  if ('visitaId' in p && !('kind' in p)) {
    const v = p as JwtProfesional;
    return { kind: 'profesional', tenant: v.inmobiliariaId, visitaId: v.visitaId };
  }
  const j = p as JwtPayload;
  if (!j.inmobiliariaId) return null;
  if (j.kind === 'usuario') return { kind: 'usuario', tenant: j.inmobiliariaId, userId: j.userId };
  if (j.kind === 'inquilino')
    return { kind: 'inquilino', tenant: j.inmobiliariaId, inquilinoId: j.inquilinoId, contratoId: j.contratoId ?? null };
  if (j.kind === 'co-inquilino') {
    const co = await prisma.coInquilino.findUnique({
      where: { id: j.coInquilinoId },
      select: { contratoId: true },
    });
    return {
      kind: 'co-inquilino',
      tenant: j.inmobiliariaId,
      coInquilinoId: j.coInquilinoId,
      contratoId: co?.contratoId ?? null,
    };
  }
  return null;
}

/**
 * Para los call sites que aceptan una URL DEL CLIENTE: ¿puede engancharla a una fila suya?
 *
 * Devuelve `true` cuando NO hay nada que objetar (sin URL, o es suya, o es del panel). Los
 * llamadores hacen `if (!(await puedeAdjuntar(url, p))) return 400`.
 */
/**
 * Las formas de "quién sos" que devuelven los guards del repo. Se aceptan TODAS para que ningún
 * call site tenga que convertir a mano: cada conversión suelta es una oportunidad de que alguien
 * arme mal el actor y afloje el chequeo sin darse cuenta.
 *
 * Se describen estructuralmente en vez de importar los tipos de `auth/guards.js` para no acoplar
 * este lib al módulo de guards (que ya importa cosas de rutas).
 */
type ContratoAccesoLike = {
  inmobiliariaId: string;
  contratoId: string | null;
  esCoInquilino: boolean;
  inquilinoId: string | null;
  coInquilinoId: string | null;
};
type VisitaAccesoLike = { visitaId: string; inmobiliariaId: string; profesionalId: string };
export type QuienAdjunta = JwtPayload | JwtProfesional | ContratoAccesoLike | VisitaAccesoLike;

async function normalizarActor(q: QuienAdjunta): Promise<ActorArchivo | null> {
  if ('esCoInquilino' in q) {
    // `requireContratoAcceso` YA revalidó el contrato contra la base — es el guard que sí
    // compara el `contratoId` del token con la fila —, así que acá el dato es confiable.
    if (q.esCoInquilino && q.coInquilinoId)
      return { kind: 'co-inquilino', tenant: q.inmobiliariaId, coInquilinoId: q.coInquilinoId, contratoId: q.contratoId };
    if (q.inquilinoId)
      return { kind: 'inquilino', tenant: q.inmobiliariaId, inquilinoId: q.inquilinoId, contratoId: q.contratoId };
    return null;
  }
  if ('profesionalId' in q && 'visitaId' in q)
    return { kind: 'profesional', tenant: q.inmobiliariaId, visitaId: q.visitaId };
  return actorDeJwt(q as JwtPayload | JwtProfesional);
}

/**
 * El modo de `UPLOADS_AMBITO`, para el código que no tiene a mano `app.env`.
 *
 * Se lee de `process.env` con el MISMO default que el schema de env (`log`), a propósito: si
 * los dos divergieran, la lectura y la escritura podrían quedar en estados distintos — que es
 * justo el desfasaje que este cambio viene a evitar.
 */
export function modoAmbitoArchivos(): 'off' | 'log' | 'on' {
  const v = process.env.UPLOADS_AMBITO;
  return v === 'off' || v === 'on' ? v : 'log';
}

/**
 * ¿Puede este actor adjuntar esta URL a una fila suya?
 *
 * **Un solo interruptor para las dos mitades.** Sólo DENIEGA con `UPLOADS_AMBITO=on`, igual que
 * el guard de lectura. No es una concesión: es lo que hace imposible el estado peligroso
 * intermedio —lectura bloqueando y escritura libre— donde alguien con una URL ajena la engancha
 * a una fila propia y se auto-autoriza. Al compartir interruptor, las dos se prenden juntas.
 *
 * La observación la aporta el guard de LECTURA, que sí registra cada caso fuera de ámbito. Y su
 * cobertura es el superconjunto que importa: las dos mitades llaman a la misma función, así que
 * si ninguna lectura legítima cae fuera de ámbito, ningún enganche legítimo va a caer tampoco.
 */
export async function puedeAdjuntar(url: string | null | undefined, q: QuienAdjunta): Promise<boolean> {
  if (!url) return true;
  if (modoAmbitoArchivos() !== 'on') return true;
  const actor = await normalizarActor(q);
  // Sin actor NO se adjunta: falla del lado seguro. Denegar un enganche no le saca a nadie
  // acceso a algo que ya tiene; permitirlo sí abre el agujero.
  if (!actor) return false;
  return urlAdjuntable(url, actor);
}
