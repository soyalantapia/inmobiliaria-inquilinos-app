import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { JwtPayloadSchema, JwtProfesionalSchema, type JwtPayload, type JwtProfesional } from '@llave/shared';

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

// En prod el Volume vive en /data; en dev/test (sin volumen) caemos a un tmp escribible.
const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? (existsSync('/data') ? '/data/uploads' : path.join(os.tmpdir(), 'myalquiler-uploads'));

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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
 * ANTES de responder (no podemos reusar requireAuth: ya manda 401 apenas el
 * shape no matchea JwtPayloadSchema, y una reply no se puede mandar dos veces).
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
  if (asPayload.success) return asPayload.data;
  const asProf = JwtProfesionalSchema.safeParse(request.user);
  if (asProf.success) return asProf.data;
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
    return {
      url: `/uploads/${tenant}/${filename}`,
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
