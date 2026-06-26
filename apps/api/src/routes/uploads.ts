import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '@llave/shared';
import { requireAuth } from '../auth/guards.js';

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

const EXT_DE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
};

/** Los 3 kinds de JWT (usuario/inquilino/co-inquilino) llevan inmobiliariaId. */
function tenantDe(payload: JwtPayload): string | null {
  return (payload as { inmobiliariaId?: string }).inmobiliariaId ?? null;
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

function mimeDeArchivo(name: string): string {
  const e = path.extname(name).toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  if (e === '.heic') return 'image/heic';
  if (e === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  // POST /uploads — sube un archivo. Cualquier usuario autenticado (panel o
  // inquilino/co-inquilino); el archivo queda scopeado a SU inmobiliaria.
  app.post('/uploads', async (request, reply) => {
    const payload = await requireAuth(request, reply);
    if (!payload) return;
    const tenant = tenantDe(payload);
    if (!tenant) return reply.code(403).send({ message: 'Sin inmobiliaria asociada' });

    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'Falta el archivo' });
    if (!EXT_DE_MIME[data.mimetype]) {
      return reply.code(415).send({
        message: 'Tipo de archivo no permitido. Aceptamos JPG, PNG, WEBP, GIF, HEIC o PDF.',
      });
    }

    const filename = `${randomUUID()}${EXT_DE_MIME[data.mimetype]}`;
    const dir = path.join(UPLOADS_DIR, tenant);
    await mkdir(dir, { recursive: true });
    const dest = path.join(dir, filename);
    try {
      await pipeline(data.file, createWriteStream(dest));
    } catch (e) {
      await unlink(dest).catch(() => {});
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
    const payload = await requireAuth(request, reply);
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
      return reply.send(createReadStream(file));
    } catch {
      return reply.code(404).send({ message: 'Archivo no encontrado' });
    }
  });
}
