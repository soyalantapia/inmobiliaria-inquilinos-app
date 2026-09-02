import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { JwtPayloadSchema, JwtProfesionalSchema, type JwtPayload, type JwtProfesional } from '@llave/shared';
import { requireInquilino, requireUsuario } from '../auth/guards.js';
import { prisma } from '../db.js';
import { resolverUploadsDir } from '../lib/donde-viven-los-archivos.js';
import { cuotaBytes, registrarSubida, usoDelTenant } from '../lib/cuota-uploads.js';
import { inquilinoRevocado } from '../auth/guards.js';
import { puedeLeerArchivo, actorDeJwt } from '../lib/acceso-archivos.js';

/**
 * File storage REAL sobre un Railway Volume montado en /data.
 *
 * Antes los archivos (comprobante de pago, boleta de servicio, foto de reclamo,
 * documentos) se elegían en el browser y NUNCA llegaban al backend (solo viajaban
 * los metadatos). Acá:
 *   - POST /uploads        sube un archivo (multipart) y lo guarda en el Volume,
 *                          scopeado por inmobiliaria; devuelve la URL servida.
 *   - GET  /uploads/:t/:n  sirve el archivo, solo a usuarios de la misma inmobiliaria.
 *
 * Los modelos (Comprobante.pdfUrl, BoletaServicio.archivoUrl, Documento.archivoUrl,
 * Reclamo.fotoUrl) ya tienen el campo de URL → no hace falta migración: cada flujo
 * guarda en su campo la `url` que devuelve este endpoint.
 */

// Dónde se escriben los archivos. La elección vive en `lib/donde-viven-los-archivos.ts`,
// con el porqué y su test: el modo de falla es que ELIJA MAL Y NO FALLE — subir sigue
// devolviendo 200 y todo desaparece en el próximo reinicio, sin un error en el log.
const UPLOADS_DIR = resolverUploadsDir(process.env, existsSync, path.join(os.tmpdir(), 'myalquiler-uploads'));

// El tope por archivo NO se aplica acá: lo aplica `@fastify/multipart` en su registro
// (`app.ts`, `limits: { fileSize: 10 MB, files: 1 }`), y este handler sólo detecta el
// truncado resultante (`data.file.truncated`). Antes había acá un `MAX_BYTES` que no leía
// nadie: dos fuentes de verdad para el mismo número, y la de este archivo era la falsa.

// MIMEs aceptados → extensión con la que GUARDAMOS. La extensión sale SIEMPRE
// de este mapa (o de EXT_PERMITIDAS abajo), NUNCA del MIME crudo: así jamás
// guardamos/servimos un svg/html ejecutable aunque el cliente mienta el tipo.
// Incluye las variantes que mandan los celulares en la vida real: image/jpg
// (Android), image/heif y *-sequence (iPhone), y se matchea case-insensitive.
const EXT_DE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heic-sequence': '.heic',
  'image/heif': '.heif',
  'image/heif-sequence': '.heif',
  'application/pdf': '.pdf',
};

// Extensiones seguras aceptadas cuando el celular NO reporta un MIME útil
// (algunos file pickers de Android mandan '' o application/octet-stream). En ese
// caso derivamos por la extensión del nombre original — pero solo si está acá,
// así nunca cae un .svg/.html/ejecutable. (.jpeg se normaliza a .jpg.)
const EXT_PERMITIDAS: Record<string, string> = {
  '.jpg': '.jpg',
  '.jpeg': '.jpg',
  '.png': '.png',
  '.webp': '.webp',
  '.gif': '.gif',
  '.heic': '.heic',
  '.heif': '.heif',
  '.pdf': '.pdf',
};

/**
 * Resuelve la extensión con la que guardamos el archivo subido, o null si el
 * tipo no está permitido. Matchea el MIME case-insensitive; si el MIME no sirve
 * (vacío/raro), cae a la extensión del nombre — siempre dentro de la whitelist.
 * Nunca confía en el MIME para la extensión guardada (evita servir svg inline).
 */
export function resolverExtensionUpload(mime: string | undefined, filename: string | undefined): string | null {
  const m = (mime ?? '').trim().toLowerCase();
  if (EXT_DE_MIME[m]) return EXT_DE_MIME[m];
  const e = path.extname(filename ?? '').toLowerCase();
  return EXT_PERMITIDAS[e] ?? null;
}

/** Los 4 kinds de JWT (usuario/inquilino/co-inquilino/profesional) llevan inmobiliariaId. */
/**
 * Quién es el dueño del archivo que se está subiendo, en la forma que guarda `ArchivoSubido`.
 *
 * Para el profesional se guarda el `visitaId` y no el `profesionalId`: su identidad ES la visita
 * —el link mágico no tiene cuenta— y si la visita se reasigna, el que entra está trabajando sobre
 * el mismo expediente.
 */
function duenoDe(p: JwtPayload | JwtProfesional): { subidoPorKind: 'USUARIO' | 'INQUILINO' | 'CO_INQUILINO' | 'PROFESIONAL'; subidoPorId: string } {
  if ('kind' in p && p.kind === 'usuario') return { subidoPorKind: 'USUARIO', subidoPorId: p.userId };
  if ('kind' in p && p.kind === 'inquilino') return { subidoPorKind: 'INQUILINO', subidoPorId: p.inquilinoId };
  if ('kind' in p && p.kind === 'co-inquilino') return { subidoPorKind: 'CO_INQUILINO', subidoPorId: p.coInquilinoId };
  return { subidoPorKind: 'PROFESIONAL', subidoPorId: (p as JwtProfesional).visitaId };
}

function tenantDe(payload: JwtPayload | JwtProfesional): string | null {
  return (payload as { inmobiliariaId?: string }).inmobiliariaId ?? null;
}

/**
 * Como requireAuth pero acepta TAMBIÉN un JWT `kind: 'profesional'` (link
 * mágico de visita — ver visitas-publicas.ts). JwtProfesionalSchema queda
 * fuera de JwtPayloadSchema a propósito (mismo motivo que JwtPersonaSchema:
 * no romper la exhaustividad usuario/inquilino/co-inquilino en el resto del
 * código) — pero /uploads es el ÚNICO endpoint genérico que el profesional
 * necesita (subir fotoAntes/fotoDespues), así que acá probamos ambos schemas
 * ANTES de responder (no podemos ARRANCAR con requireAuth: ya manda 401 apenas
 * el shape no matchea JwtPayloadSchema, y una reply no se puede mandar dos veces).
 * Una vez que sabemos QUÉ kind es, sí se delega en los guards de guards.ts —ver
 * abajo—: ahí ya no pueden cortar antes de la revalidación.
 */
async function requireAuthOProfesional(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPayload | JwtProfesional | null> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const asPayload = JwtPayloadSchema.safeParse(request.user);
  if (asPayload.success) {
    // MISMA regla que los guards de guards.ts: el token dura 15 días (TOKEN_TTL), así que NO
    // se confía en el estado que trae — se revalida contra la DB en cada request. Acá se
    // revalidaba SÓLO al co-inquilino y los otros dos kinds entraban con el JWT crudo:
    //
    //   - un empleado dado de baja (DELETE /usuarios/:id deja `activo: false`, la fila y el
    //     token siguen vivos) se comía el 401 de requireUsuario en TODO el panel, pero
    //     seguía bajándose comprobantes, documentos, DNI y extractos del tenant por
    //     GET /uploads/:t/:n —que además acepta el token por query, o sea que le alcanza con
    //     pegar la URL en el navegador— y subiendo por POST /uploads contra la cuota de esa
    //     inmobiliaria, durante los 15 días que le quedaran al token;
    //   - lo mismo, más chico, para un inquilino cuya fila se borró o cuyo contrato se
    //     reasignó a otro.
    //
    // Se DELEGA en los guards que ya hacen esa revalidación en vez de copiarla acá: una
    // segunda copia se desincroniza de la original, que es exactamente cómo nació este bug
    // (el arreglo del co-inquilino se escribió acá y no alcanzó a los otros dos kinds).
    // Delegar es seguro aunque los guards arranquen con su propio `jwtVerify`: es idempotente
    // —relee el header y vuelve a poblar `request.user`—. Y NO manda dos replies: la
    // advertencia del comentario de arriba sobre requireAuth vale para llamarlo A CIEGAS, y
    // acá ya sabemos que el shape matchea JwtPayloadSchema y qué `kind` es, así que ninguno
    // de los dos puede cortar antes de llegar a la revalidación.
    const p = asPayload.data;
    // requireUsuario devuelve el rol y el inmobiliariaId VIGENTES de la tabla, no los del
    // token: además de cortar al dado de baja, evita que `tenantDe` elija la carpeta del
    // Volume por el tenant congelado en el JWT si al usuario lo movieron de inmobiliaria.
    if (p.kind === 'usuario') return requireUsuario(request, reply);
    // El titular NO pasa por exigirContratoActivo, y eso es a propósito (ver guards.ts): un
    // ex-inquilino tiene que poder seguir bajando sus comprobantes viejos.
    if (p.kind === 'inquilino') return requireInquilino(request, reply);
    // Co-inquilino: la única rama que ya revalidaba. No se delega en requireContratoAcceso
    // porque ese guard devuelve un ContratoAcceso y acá hace falta el payload para `tenantDe`.
    const co = await prisma.coInquilino.findUnique({ where: { id: p.coInquilinoId } });
    if (!co || co.estado !== 'ACEPTADO' || co.inmobiliariaId !== p.inmobiliariaId) {
      await reply.code(401).send({ message: 'Tu acceso fue revocado' });
      return null;
    }
    return p;
  }
  const asProf = JwtProfesionalSchema.safeParse(request.user);
  if (asProf.success) {
    // Idem para el link mágico: la sesión dura días y sobrevivía a que la visita se
    // cerrara o al reclamo terminado, así que un profesional que ya no trabaja para la
    // inmobiliaria seguía pudiendo subir archivos con el token viejo.
    const visita = await prisma.visitaProfesional.findUnique({
      where: { id: asProf.data.visitaId },
      select: { estado: true, inmobiliariaId: true, reclamo: { select: { estado: true } } },
    });
    const cerrada =
      !visita ||
      visita.inmobiliariaId !== asProf.data.inmobiliariaId ||
      visita.estado === 'LISTO' ||
      visita.reclamo.estado === 'CERRADO' ||
      visita.reclamo.estado === 'RECHAZADO';
    if (cerrada) {
      await reply.code(401).send({ message: 'Esta visita ya está cerrada.' });
      return null;
    }
    return asProf.data;
  }
  await reply.code(401).send({ message: 'Token inválido' });
  return null;
}

/**
 * True si `url` es un archivo servido por nosotros (`/uploads/<tenant>/<name>`)
 * y pertenece al `tenant` indicado. Lo usan los endpoints que PERSISTEN una url
 * (comprobante de pago, documento) para no guardar una url externa arbitraria ni
 * de otra inmobiliaria (defensa en profundidad: el GET ya re-chequea al servir,
 * pero validar al persistir evita dato sucio/no-servible).
 */
export function urlEsDelTenant(url: string, tenant: string): boolean {
  const m = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(url);
  if (!m) return false;
  const urlTenant = m[1];
  const rawName = m[2];
  if (!urlTenant || !rawName) return false;
  if (urlTenant !== tenant) return false;
  return path.basename(rawName) === rawName && !rawName.includes('..');
}

/**
 * Borra del Volume un archivo subido, dada su `url` (`/uploads/<tenant>/<name>`),
 * pero SOLO si pertenece al `tenant` indicado (defensa anti cross-tenant). Best
 * effort: si la URL no es nuestra o el archivo ya no está, no rompe. Lo usa el
 * DELETE de documentos para no dejar huérfanos en el disco.
 */
export async function borrarArchivoSubido(url: string, tenant: string): Promise<void> {
  const m = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(url);
  if (!m) return; // URL externa o con otro formato → no la tocamos.
  const urlTenant = m[1];
  const rawName = m[2];
  if (!urlTenant || !rawName) return;
  if (urlTenant !== tenant) return; // jamás borrar archivos de otra inmobiliaria.
  const safe = path.basename(rawName);
  if (safe !== rawName || safe.includes('..')) return;
  await unlink(path.join(UPLOADS_DIR, tenant, safe)).catch(() => {});
}

/**
 * Borra un archivo del Volume SOLO si ya no lo referencia ninguna fila.
 *
 * POR QUÉ: `borrarArchivoSubido` valida el TENANT del path, no la PROPIEDAD del recurso, y
 * los caminos de limpieza (el rollback de /pagos/informar, cambiar de avatar, reemplazar un
 * documento) borran la URL que vino en el BODY. Un co-inquilino con permiso de sólo lectura
 * podía leer el `comprobanteUrl` del titular en /mis-liquidaciones, mandarlo en un request
 * destinado a fallar, y hacer que el rollback borrara del disco el comprobante del otro —
 * dejando el Pago con una URL rota y a la inmobiliaria sin el respaldo.
 *
 * El chequeo de "¿sigue en uso?" es COMPLETO y vive acá (archivoSigueEnUso): antes lo
 * pasaba cada caller y ninguno miraba todas las tablas. Si el archivo todavía está
 * referenciado, NO se borra: no era basura de esta request.
 */
/**
 * ¿Alguna fila del sistema sigue apuntando a esta URL?
 *
 * Chequea TODAS las columnas que guardan una URL de archivo. Antes cada call site escribía
 * a mano su propia lista y ninguno estaba completo: los seis miraban entre 1 y 3 tablas de
 * las 18 que existen. Un archivo referenciado por la foto de un reclamo, el PDF de un
 * contrato, el comprobante de un movimiento de caja o el extracto de un resumen bancario
 * daba "no está en uso" y se BORRABA DEL DISCO, dejando esa otra fila con una URL rota y a
 * la inmobiliaria sin el respaldo. Irreversible.
 *
 * La asimetría manda el diseño: un falso "sí está en uso" sólo deja un archivo de más en el
 * Volume (barato y reversible); un falso "no está en uso" DESTRUYE un archivo ajeno. Por eso
 * se incluye todo, y cualquier error de la query se trata como "sí está en uso".
 *
 * Si mañana se agrega una columna de URL nueva, va acá — es el ÚNICO lugar que hay que tocar.
 * Esa promesa estaba escrita y no se cumplía: faltaban las dos fotos de `VisitaProfesional`.
 * Ahora la sostiene un test que LEE `schema.prisma`, enumera las columnas de URL y exige que
 * cada una aparezca acá (`el-inventario-de-archivos-esta-completo.test.ts`).
 */
export async function archivoSigueEnUso(url: string): Promise<boolean> {
  if (!url) return true;
  try {
    const counts = await Promise.all([
      prisma.inquilino.count({ where: { imageUrl: url } }),
      prisma.usuario.count({ where: { imageUrl: url } }),
      prisma.propiedad.count({ where: { fotoUrl: url } }),
      prisma.documento.count({ where: { archivoUrl: url } }),
      prisma.documentoContrato.count({ where: { archivoUrl: url } }),
      prisma.documentoAdjuntoInvitado.count({ where: { archivoUrl: url } }),
      prisma.pago.count({ where: { comprobanteUrl: url } }),
      prisma.movimientoCaja.count({ where: { comprobanteUrl: url } }),
      prisma.comprobante.count({ where: { pdfUrl: url } }),
      prisma.factura.count({ where: { pdfUrl: url } }),
      prisma.boletaServicio.count({ where: { archivoUrl: url } }),
      prisma.reclamo.count({ where: { fotoUrl: url } }),
      prisma.reclamoEvento.count({ where: { adjuntoUrl: url } }),
      // LAS FOTOS DE LA VISITA DEL PROFESIONAL. Faltaban, y el docstring de arriba promete
      // que acá están TODAS: son URLs de /uploads del tenant como cualquier otra (se validan
      // con `urlEsDelTenant` y se guardan en `visitas-publicas.ts`), y el inquilino las ve
      // renderizadas en su propia app. O sea: tiene la URL a la vista. Adjuntándola a un
      // documento personal suyo y borrando ese documento, `borrarArchivoSiHuerfano` no
      // encontraba ninguna referencia —`visitas_profesional` no estaba en la lista—, hacía
      // `unlink`, y se perdía la evidencia con la que se decide quién paga la reparación.
      // Justo lo que al inquilino le podía convenir que desapareciera.
      prisma.visitaProfesional.count({ where: { fotoAntes: url } }),
      prisma.visitaProfesional.count({ where: { fotoDespues: url } }),
      prisma.resumenBancario.count({ where: { archivoUrl: url } }),
      prisma.importacionCartera.count({ where: { archivoUrl: url } }),
      prisma.reportePiloto.count({ where: { url } }),
    ]);
    return counts.some((c) => c > 0);
  } catch {
    return true; // ante la duda, NO borrar
  }
}

export async function borrarArchivoSiHuerfano(url: string, tenant: string): Promise<void> {
  if (await archivoSigueEnUso(url)) return;
  await borrarArchivoSubido(url, tenant);
}

/**
 * Guarda un Buffer arbitrario en el Volume del tenant y devuelve su URL servida.
 * A diferencia de POST /uploads (que exige un mimetype de la whitelist de fotos/
 * PDF), esto lo usan flujos que YA leyeron el archivo en memoria para procesarlo
 * (ej. parsear un extracto bancario) y quieren archivar el original para
 * trazabilidad — sin pasar dos veces por el multipart de /uploads.
 */
export async function guardarBufferSubido(buffer: Buffer, tenant: string, ext: string): Promise<string> {
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOADS_DIR, tenant);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${tenant}/${filename}`;
}

function mimeDeArchivo(name: string): string {
  const e = path.extname(name).toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  if (e === '.heic') return 'image/heic';
  if (e === '.heif') return 'image/heif';
  if (e === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  // POST /uploads — sube un archivo. Cualquier usuario autenticado (panel o
  // inquilino/co-inquilino); el archivo queda scopeado a SU inmobiliaria.
  app.post('/uploads', async (request, reply) => {
    const payload = await requireAuthOProfesional(request, reply);
    if (!payload) return;
    const tenant = tenantDe(payload);
    if (!tenant) return reply.code(403).send({ message: 'Sin inmobiliaria asociada' });

    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'Falta el archivo' });
    const ext = resolverExtensionUpload(data.mimetype, data.filename);
    if (!ext) {
      return reply.code(415).send({
        message: 'Tipo de archivo no permitido. Aceptamos JPG, PNG, WEBP, GIF, HEIC/HEIF o PDF.',
      });
    }

    // CUOTA POR INMOBILIARIA. El Volume es uno solo y lo comparten todos los tenants, así que
    // sin esto un token vivo —el de un inquilino dura 15 días, incluso con el contrato ya
    // terminado— podía llenarlo y dejar sin subir a TODOS. Se mide antes de escribir; el
    // desborde máximo es un archivo (10 MB, tope del multipart), que es aceptable.
    const cuota = cuotaBytes();
    if (cuota > 0) {
      const usados = await usoDelTenant(UPLOADS_DIR, tenant);
      if (usados >= cuota) {
        // 507 como el disco lleno —para el que sube es lo mismo: no hay dónde guardarlo— pero
        // con `codigo` propio, porque la acción de quien atiende es distinta: acá no hay que
        // agrandar el disco, hay que borrar lo que sobra o subirle la cuota a esta cartera.
        return reply.code(507).send({
          message:
            'No pudimos guardar el archivo: esta inmobiliaria llegó al límite de espacio. ' +
            'Avisale al equipo de My Alquiler para ampliarlo.',
          codigo: 'CUOTA_TENANT_LLENA',
        });
      }
    }

    const filename = `${randomUUID()}${ext}`;
    const dir = path.join(UPLOADS_DIR, tenant);
    const dest = path.join(dir, filename);
    try {
      await mkdir(dir, { recursive: true });
      await pipeline(data.file, createWriteStream(dest));
    } catch (e) {
      await unlink(dest).catch(() => {});
      // Disco lleno / permisos del Volume: devolvemos un mensaje claro en vez de
      // un 500 opaco (el inquilino veía "algo falló" sin saber que era del server).
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOSPC') {
        return reply.code(507).send({
          message: 'No pudimos guardar el comprobante: el servidor se quedó sin espacio. Avisale a la inmobiliaria.',
        });
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return reply.code(503).send({
          message: 'No pudimos guardar el comprobante en este momento. Reintentá en un ratito.',
        });
      }
      throw e;
    }
    // @fastify/multipart trunca el stream al superar el límite → borramos el parcial.
    if (data.file.truncated) {
      await unlink(dest).catch(() => {});
      return reply.code(413).send({ message: 'El archivo supera el máximo de 10 MB.' });
    }

    const tamanioBytes = (await stat(dest)).size;
    // Se le suman al cache los bytes recién escritos, para no recorrer el directorio entero
    // en cada subida. Ver `usoDelTenant`.
    registrarSubida(tenant, tamanioBytes);
    const url = `/uploads/${tenant}/${filename}`;
    // El dueño, para que después pueda leer lo suyo. Va DESPUÉS de que el archivo ya está en
    // disco y **sin bloquear la respuesta**: subir un comprobante hoy sólo necesita el Volume, y
    // hacerlo depender también de una escritura a Postgres convertiría una caída de la base en
    // "no podés informar tu pago". Si la fila no se escribe, el archivo no queda inaccesible:
    // apenas se adjunta a algo, lo cubre la segunda vía del guard.
    // SE ESPERA la escritura, pero un fallo NO rompe la subida. Las dos mitades importan:
    //  · `await`, porque si no hay carrera: el cliente sube y acto seguido informa el pago con
    //    esa URL, y `puedeAdjuntar` no encontraría todavía la fila → 403 espurio en el flujo
    //    normal, justo el que hay que preservar.
    //  · `.catch()`, porque subir un comprobante hoy sólo necesita el Volume; hacerlo depender
    //    de Postgres convertiría una caída de la base en "no podés informar tu pago". Si la
    //    fila no se escribe, el archivo no queda inaccesible: apenas se adjunta a algo, lo
    //    cubre la segunda vía del guard.
    await prisma.archivoSubido
      .create({ data: { inmobiliariaId: tenant, url, ...duenoDe(payload), origen: 'POST /uploads' } })
      .catch((e: unknown) => request.log.warn({ err: e, url }, 'no se pudo registrar el dueño del archivo'));
    return {
      url,
      nombreArchivo: data.filename ?? filename,
      tipoMime: data.mimetype,
      tamanioBytes,
    };
  });

  // GET /uploads/:tenant/:name — sirve el archivo. Solo de TU inmobiliaria.
  app.get('/uploads/:tenant/:name', async (request, reply) => {
    // Un <a href> / <img src> no puede mandar el header Authorization → aceptamos
    // el token también por query (?token=) y lo copiamos al header para que
    // requireAuth lo valide igual. (Mismo nivel de auth, solo otro transporte.)
    const qToken = (request.query as { token?: string }).token;
    if (qToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${qToken}`;
    }
    const payload = await requireAuthOProfesional(request, reply);
    if (!payload) return;
    const { tenant, name } = request.params as { tenant: string; name: string };
    if (tenantDe(payload) !== tenant) {
      return reply.code(403).send({ message: 'Sin acceso a este archivo' });
    }
    // Anti path-traversal: solo aceptamos el basename exacto.
    const safe = path.basename(name);
    if (safe !== name || safe.includes('..')) {
      return reply.code(400).send({ message: 'Nombre de archivo inválido' });
    }

    // ÁMBITO: además del tenant, ¿este archivo es de este actor? (ver lib/acceso-archivos.ts)
    //
    // Sale en TRES ESTADOS y arranca en `log` a propósito. Es un cambio de autorización sobre
    // una inmobiliaria en uso: si alguna lectura legítima quedó fuera de las columnas del ámbito,
    // el costo de enterarse bloqueando es que un inquilino real pierde un documento. Observando
    // primero, el costo es una línea de log. Prender `on` es una variable de entorno, no un push.
    const actor = await actorDeJwt(payload);
    const modo = app.env.UPLOADS_AMBITO;
    if (modo !== 'off' && actor && actor.kind !== 'usuario') {
      const url = `/uploads/${tenant}/${safe}`;
      if (!(await puedeLeerArchivo(url, actor))) {
        request.log.warn(
          { url, kind: actor.kind, tenant, modo },
          'uploads-ambito: archivo fuera del ámbito del actor',
        );
        if (modo === 'on') return reply.code(403).send({ message: 'Sin acceso a este archivo' });
      }
    }

    const file = path.join(UPLOADS_DIR, tenant, safe);
    try {
      const s = await stat(file);
      if (!s.isFile()) throw new Error('not a file');
      reply.header('Content-Type', mimeDeArchivo(safe));
      reply.header('Cache-Control', 'private, max-age=86400');
      // Helmet pone CORP same-origin GLOBAL → el browser bloqueaba TODO <img>
      // del panel/app (otro origen) que embebiera estos archivos: fotos de
      // propiedades, de reclamos y adjuntos aparecían ROTOS aunque el fetch
      // diera 200. Este endpoint ya exige token del tenant — el embed
      // cross-origin es exactamente su caso de uso.
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      return reply.send(createReadStream(file));
    } catch {
      return reply.code(404).send({ message: 'Archivo no encontrado' });
    }
  });
}
