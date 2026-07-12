import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AudienciaAnuncio } from '@prisma/client';
import type { JwtInquilino } from '@llave/shared';
import { prisma } from '../db.js';
import { requireInquilino, requireUsuario } from '../auth/guards.js';
import { enviarAnuncioEmail, mailerConfigured } from '../mailer.js';

/**
 * Fase 5 — Comunicación: anuncios masivos del panel con acuses REALES.
 *
 * Reemplaza el hack cross-app del front (localStorage compartido entre la app
 * del inmo y la del inquilino + acuses simulados con un hash determinístico):
 * acá la audiencia se resuelve SERVER-SIDE y los conteos "Leído X de N" salen
 * de la tabla AnuncioAcuse, alimentada por los acuses reales de los inquilinos.
 *
 * Decisiones:
 * - Canales: SIEMPRE APP+EMAIL (decisión de producto) — el POST no los acepta.
 * - Sin PIN: `comunicaciones.enviar` no es capacidad sensible en la matriz de
 *   permisos (requierePin=false), igual que en el resto de capacidades
 *   operativas. Por eso este dominio no copia verificarPin.
 * - INQUILINOS_CONSORCIO: manda la FK propiedad.consorcioId; para propiedades
 *   sin FK cargada cae al match heurístico por dirección que usaba el front
 *   (la dirección de la propiedad contiene la base de la dirección del
 *   consorcio, ej. "Gorriti 4521").
 * - INQUILINOS_MOROSOS / INQUILINOS_PENDIENTES: derivan el estado de pago igual
 *   que GET /contratos de core.ts (cualquier liquidación vencida manda; si no,
 *   la más reciente). La membresía se evalúa al momento de leer: un moroso que
 *   se pone al día deja de ver los anuncios "a morosos" (limitación conocida).
 * - TODOS_PROPIETARIOS / TODOS_CONSORCIOS: cuentan destinatarios reales pero no
 *   generan acuses (los acuses son solo de inquilinos con la app).
 */

const AUDIENCIAS = [
  'TODOS_INQUILINOS',
  'INQUILINOS_MOROSOS',
  'INQUILINOS_PENDIENTES',
  'TODOS_PROPIETARIOS',
  'TODOS_CONSORCIOS',
  'INQUILINOS_CONSORCIO',
  'CONTRATOS_ESPECIFICOS',
] as const;

/** Audiencias que un inquilino puede llegar a recibir en /mis-anuncios. */
const AUDIENCIAS_INQUILINO: AudienciaAnuncio[] = [
  'TODOS_INQUILINOS',
  'INQUILINOS_MOROSOS',
  'INQUILINOS_PENDIENTES',
  'INQUILINOS_CONSORCIO',
  'CONTRATOS_ESPECIFICOS',
];

/** Mismo derivado que GET /contratos: vencida manda; si no, la más reciente. */
function derivarEstadoPago(liqs: Array<{ estado: string }>): string {
  const vencida = liqs.find((l) => l.estado === 'VENCIDO');
  return (vencida ?? liqs[0])?.estado ?? 'PENDIENTE';
}

/** Contrato + estado de pago del inquilino logueado (contexto de audiencia). */
async function contextoContrato(inq: JwtInquilino) {
  const contrato = inq.contratoId
    ? await prisma.contrato.findFirst({
        where: { id: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
        select: {
          id: true,
          estado: true,
          propiedad: { select: { direccion: true, consorcioId: true } },
          liquidaciones: { orderBy: { periodo: 'desc' }, take: 6, select: { estado: true } },
        },
      })
    : null;
  return { contrato, estadoPago: derivarEstadoPago(contrato?.liquidaciones ?? []) };
}

type ContratoCtx = Awaited<ReturnType<typeof contextoContrato>>['contrato'];

/** consorcioId → base de dirección normalizada ("Gorriti 4521") para el fallback heurístico. */
async function basesConsorcio(tid: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const consorcios = await prisma.consorcio.findMany({
    where: { id: { in: ids }, inmobiliariaId: tid },
    select: { id: true, direccion: true },
  });
  return new Map(consorcios.map((c) => [c.id, c.direccion.split(',')[0]?.trim().toLowerCase() ?? '']));
}

/** ¿El contrato del inquilino cae dentro de la audiencia del anuncio? */
function aplicaAlContrato(
  a: { audiencia: AudienciaAnuncio; audienciaIds: string[] },
  contrato: ContratoCtx,
  estadoPago: string,
  bases: Map<string, string>,
): boolean {
  switch (a.audiencia) {
    case 'TODOS_INQUILINOS':
      return contrato?.estado === 'ACTIVO';
    case 'INQUILINOS_MOROSOS':
      return contrato?.estado === 'ACTIVO' && estadoPago === 'VENCIDO';
    case 'INQUILINOS_PENDIENTES':
      return contrato?.estado === 'ACTIVO' && estadoPago === 'PENDIENTE';
    case 'INQUILINOS_CONSORCIO': {
      if (contrato?.estado !== 'ACTIVO') return false;
      // La FK manda; la heurística por dirección es solo para propiedades sin FK.
      if (contrato.propiedad.consorcioId) return a.audienciaIds.includes(contrato.propiedad.consorcioId);
      const dir = contrato.propiedad.direccion.toLowerCase();
      return a.audienciaIds.some((id) => {
        const base = bases.get(id);
        return !!base && dir.includes(base);
      });
    }
    case 'CONTRATOS_ESPECIFICOS':
      return !!contrato && a.audienciaIds.includes(contrato.id);
    default:
      return false;
  }
}

/**
 * Resuelve SERVER-SIDE quiénes reciben un anuncio. Devuelve los inquilinos
 * alcanzados (para acuses) y el conteo real de destinatarios a persistir.
 */
async function resolverAudiencia(
  tid: string,
  audiencia: AudienciaAnuncio,
  audienciaIds: string[],
): Promise<{ inquilinoIds: string[]; destinatariosCount: number }> {
  switch (audiencia) {
    case 'TODOS_PROPIETARIOS':
      return { inquilinoIds: [], destinatariosCount: await prisma.propietario.count({ where: { inmobiliariaId: tid } }) };
    case 'TODOS_CONSORCIOS':
      return { inquilinoIds: [], destinatariosCount: await prisma.consorcio.count({ where: { inmobiliariaId: tid } }) };
    case 'CONTRATOS_ESPECIFICOS': {
      const inqs = await prisma.inquilino.findMany({
        where: { inmobiliariaId: tid, contratoId: { in: audienciaIds } },
        select: { id: true },
      });
      return { inquilinoIds: inqs.map((i) => i.id), destinatariosCount: inqs.length };
    }
    case 'INQUILINOS_CONSORCIO': {
      // 1) FK real propiedad.consorcioId
      const porFk = await prisma.inquilino.findMany({
        where: {
          inmobiliariaId: tid,
          contrato: { estado: 'ACTIVO', propiedad: { consorcioId: { in: audienciaIds } } },
        },
        select: { id: true },
      });
      const set = new Set(porFk.map((i) => i.id));
      // 2) Fallback heurístico por dirección para propiedades sin FK (como el front)
      const bases = await basesConsorcio(tid, audienciaIds);
      for (const base of bases.values()) {
        if (!base) continue;
        const porDireccion = await prisma.inquilino.findMany({
          where: {
            inmobiliariaId: tid,
            contrato: {
              estado: 'ACTIVO',
              propiedad: { consorcioId: null, direccion: { contains: base, mode: 'insensitive' } },
            },
          },
          select: { id: true },
        });
        for (const i of porDireccion) set.add(i.id);
      }
      return { inquilinoIds: [...set], destinatariosCount: set.size };
    }
    default: {
      // TODOS_INQUILINOS / INQUILINOS_MOROSOS / INQUILINOS_PENDIENTES
      const inqs = await prisma.inquilino.findMany({
        where: { inmobiliariaId: tid, contrato: { estado: 'ACTIVO' } },
        select: {
          id: true,
          contrato: {
            select: { liquidaciones: { orderBy: { periodo: 'desc' }, take: 6, select: { estado: true } } },
          },
        },
      });
      const filtrados = inqs.filter((i) => {
        if (audiencia === 'TODOS_INQUILINOS') return true;
        const estado = derivarEstadoPago(i.contrato?.liquidaciones ?? []);
        return audiencia === 'INQUILINOS_MOROSOS' ? estado === 'VENCIDO' : estado === 'PENDIENTE';
      });
      return { inquilinoIds: filtrados.map((i) => i.id), destinatariosCount: filtrados.length };
    }
  }
}

/** Pausa entre emails del fan-out (envío "uno a uno", no ráfaga). */
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const PAUSA_ENTRE_EMAILS_MS = 400;

/**
 * Canal EMAIL de los anuncios — antes NO existía: el POST guardaba
 * canales ['APP','EMAIL'] pero jamás se mandaba un mail (bug "los avisos no
 * llegan al email", 07/07). Envío en BACKGROUND (no bloquea el 201) y UNO A
 * UNO con throttle, cuidando deliverability:
 *  - un destinatario por mail (nunca BCC/listas → menos spam-score),
 *  - secuencial con pausa entre envíos (no ráfaga que dispare rate-limits),
 *  - best-effort por destinatario: un mail que falla no corta el resto.
 * TODOS_CONSORCIOS no tiene email en el modelo → solo canal APP (se loguea).
 */
async function enviarEmailsAnuncio(
  app: FastifyInstance,
  anuncio: { id: string; inmobiliariaId: string; titulo: string; cuerpo: string; prioridad: string; audiencia: AudienciaAnuncio },
  inquilinoIds: string[],
): Promise<void> {
  const inmo = await prisma.inmobiliaria.findUnique({
    where: { id: anuncio.inmobiliariaId },
    select: { nombre: true },
  });
  const inmoNombre = inmo?.nombre ?? 'Tu inmobiliaria';

  // Destinatarios con email real, deduplicados (co-titulares pueden compartir casilla).
  const destinos: Array<{ email: string; paraInquilino: boolean }> = [];
  if (anuncio.audiencia === 'TODOS_PROPIETARIOS') {
    const owners = await prisma.propietario.findMany({
      where: { inmobiliariaId: anuncio.inmobiliariaId },
      select: { email: true },
    });
    for (const o of owners) destinos.push({ email: o.email, paraInquilino: false });
  } else if (anuncio.audiencia === 'TODOS_CONSORCIOS') {
    app.log.info({ anuncioId: anuncio.id }, 'anuncio a consorcios: sin email en el modelo, solo canal APP');
  } else if (inquilinoIds.length > 0) {
    const inqs = await prisma.inquilino.findMany({
      where: { id: { in: inquilinoIds } },
      select: { email: true },
    });
    for (const i of inqs) {
      if (i.email) destinos.push({ email: i.email, paraInquilino: true });
    }
  }
  const unicos = [...new Map(destinos.map((d) => [d.email.toLowerCase(), d])).values()];
  if (unicos.length === 0) {
    app.log.info({ anuncioId: anuncio.id }, 'anuncio sin destinatarios con email');
    return;
  }

  let ok = 0;
  let fallidos = 0;
  for (const d of unicos) {
    try {
      const enviado = await enviarAnuncioEmail({
        email: d.email,
        titulo: anuncio.titulo,
        cuerpo: anuncio.cuerpo,
        prioridad: anuncio.prioridad,
        inmobiliariaNombre: inmoNombre,
        paraInquilino: d.paraInquilino,
      });
      if (enviado) ok += 1;
      else fallidos += 1; // SMTP sin configurar
    } catch (e) {
      fallidos += 1;
      app.log.warn({ anuncioId: anuncio.id, err: e }, 'fallo el email de un destinatario del anuncio');
    }
    await dormir(PAUSA_ENTRE_EMAILS_MS);
  }
  app.log.info({ anuncioId: anuncio.id, ok, fallidos, total: unicos.length }, 'emails del anuncio enviados');
}

export async function anunciosRoutes(app: FastifyInstance) {
  // ===== Panel: listado con conteos REALES desde AnuncioAcuse =====
  app.get('/anuncios', async (request, reply) => {
    // Consistente con POST/DELETE de anuncios (comunicaciones.enviar = ADMIN/
    // OPERADOR). Antes era contratos.ver → CARGA/LECTURA podían leer el cuerpo de
    // todas las comunicaciones vía API directa (el sidebar ya las ocultaba).
    const u = await requireUsuario(request, reply, 'comunicaciones.enviar');
    if (!u) return;
    const anuncios = await prisma.anuncio.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { acuses: { select: { leidoAt: true, confirmadoAt: true } } },
      orderBy: { enviadoAt: 'desc' },
    });
    return anuncios.map(({ acuses, ...a }) => ({
      ...a,
      conteos: {
        leido: acuses.filter((x) => x.leidoAt).length,
        confirmado: acuses.filter((x) => x.confirmadoAt).length,
        total: a.destinatariosCount,
      },
    }));
  });

  // ===== Panel: crear anuncio (la audiencia se resuelve acá, no en el front) =====
  app.post('/anuncios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'comunicaciones.enviar');
    if (!u) return;
    const body = z
      .object({
        titulo: z.string().min(3),
        cuerpo: z.string().min(5),
        prioridad: z.enum(['NORMAL', 'IMPORTANTE', 'URGENTE']).default('NORMAL'),
        audiencia: z.enum(AUDIENCIAS),
        audienciaIds: z.array(z.string()).default([]),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del anuncio incompletos: título, cuerpo y audiencia son obligatorios' });

    const { titulo, cuerpo, prioridad, audiencia, audienciaIds } = body.data;
    if ((audiencia === 'INQUILINOS_CONSORCIO' || audiencia === 'CONTRATOS_ESPECIFICOS') && audienciaIds.length === 0) {
      return reply.code(400).send({ message: 'Esta audiencia necesita que elijas al menos un destinatario' });
    }

    const destino = await resolverAudiencia(u.inmobiliariaId, audiencia, audienciaIds);
    if (destino.destinatariosCount === 0) {
      return reply.code(409).send({ message: 'Esa audiencia no alcanza a nadie — revisá los destinatarios' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: u.userId } });
    const anuncio = await prisma.anuncio.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        titulo,
        cuerpo,
        prioridad,
        audiencia,
        audienciaIds,
        canales: ['APP', 'EMAIL'], // decisión de producto: siempre ambos canales
        enviadoPor: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel',
        enviadoAt: new Date(),
        destinatariosCount: destino.destinatariosCount,
      },
    });
    // Canal EMAIL en background: el 201 no espera al SMTP (un fan-out de N
    // mails con throttle tarda N×~0.5s). Si algo explota, queda logueado.
    if (mailerConfigured) {
      void enviarEmailsAnuncio(app, anuncio, destino.inquilinoIds).catch((e) =>
        app.log.error({ anuncioId: anuncio.id, err: e }, 'fan-out de emails del anuncio falló'),
      );
    } else {
      app.log.warn({ anuncioId: anuncio.id }, 'SMTP sin configurar: anuncio sin canal EMAIL');
    }
    return reply.code(201).send({ ...anuncio, conteos: { leido: 0, confirmado: 0, total: anuncio.destinatariosCount } });
  });

  // ===== Panel: eliminar anuncio (borra también sus acuses) =====
  app.delete('/anuncios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'comunicaciones.enviar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const anuncio = await prisma.anuncio.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!anuncio) return reply.code(404).send({ message: 'Anuncio inexistente' });
    await prisma.$transaction([
      prisma.anuncioAcuse.deleteMany({ where: { anuncioId: id } }),
      prisma.anuncio.delete({ where: { id } }),
    ]);
    return { ok: true };
  });

  // ===== Inquilino: los anuncios que le aplican + su acuse propio =====
  app.get('/mis-anuncios', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const ctx = await contextoContrato(inq);
    const anuncios = await prisma.anuncio.findMany({
      where: { inmobiliariaId: inq.inmobiliariaId, audiencia: { in: AUDIENCIAS_INQUILINO } },
      include: { acuses: { where: { inquilinoId: inq.inquilinoId }, select: { leidoAt: true, confirmadoAt: true } } },
      orderBy: { enviadoAt: 'desc' },
    });
    const consorcioIds = [
      ...new Set(anuncios.filter((a) => a.audiencia === 'INQUILINOS_CONSORCIO').flatMap((a) => a.audienciaIds)),
    ];
    const bases = await basesConsorcio(inq.inmobiliariaId, consorcioIds);
    return anuncios
      .filter((a) => aplicaAlContrato(a, ctx.contrato, ctx.estadoPago, bases))
      .map(({ acuses, ...a }) => ({ ...a, acuse: acuses[0] ?? null }));
  });

  // ===== Inquilino: acuses reales (leído al abrir / "Enterado" explícito) =====
  // - leido: no pisa un leidoAt previo (igual que marcarLeido del front).
  // - enterado: setea confirmadoAt y leidoAt si faltaba. Idempotente: el primer
  //   confirmadoAt queda (a diferencia del mock, que lo pisaba — acá el acuse
  //   es un registro real y conserva la primera confirmación).
  for (const accion of ['leido', 'enterado'] as const) {
    app.post(`/anuncios/:id/${accion}`, async (request, reply) => {
      const inq = await requireInquilino(request, reply);
      if (!inq) return;
      const { id } = request.params as { id: string };
      const anuncio = await prisma.anuncio.findFirst({ where: { id, inmobiliariaId: inq.inmobiliariaId } });
      if (!anuncio) return reply.code(404).send({ message: 'Anuncio inexistente' });

      const ctx = await contextoContrato(inq);
      const bases = await basesConsorcio(
        inq.inmobiliariaId,
        anuncio.audiencia === 'INQUILINOS_CONSORCIO' ? anuncio.audienciaIds : [],
      );
      if (!aplicaAlContrato(anuncio, ctx.contrato, ctx.estadoPago, bases)) {
        return reply.code(403).send({ message: 'Este anuncio no es para vos' });
      }

      const ahora = new Date();
      const clave = { anuncioId_inquilinoId: { anuncioId: id, inquilinoId: inq.inquilinoId } };
      const previo = await prisma.anuncioAcuse.findUnique({ where: clave });
      // upsert ATÓMICO sobre la unique [anuncioId, inquilinoId]: antes el
      // findUnique→create dejaba una ventana donde un doble-tap concurrente
      // hacía que el 2do create violara la unique (P2002 → 409 espurio al
      // inquilino al marcar leído). Preserva los valores previos igual que antes.
      return prisma.anuncioAcuse.upsert({
        where: clave,
        create: {
          inmobiliariaId: inq.inmobiliariaId,
          anuncioId: id,
          inquilinoId: inq.inquilinoId,
          leidoAt: ahora,
          confirmadoAt: accion === 'enterado' ? ahora : null,
        },
        update: {
          leidoAt: previo?.leidoAt ?? ahora,
          ...(accion === 'enterado' ? { confirmadoAt: previo?.confirmadoAt ?? ahora } : {}),
        },
      });
    });
  }
}
