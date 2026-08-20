import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Cuota de disco por inmobiliaria para `POST /uploads`.
 *
 * EL AGUJERO. `POST /uploads` acepta CUALQUIER token autenticado —usuario del panel,
 * inquilino, co-inquilino y el profesional por link mágico— y escribe en el Volume de
 * Railway. Hay tope por archivo (10 MB, en el registro de `@fastify/multipart` en `app.ts`)
 * y tipos restringidos, pero no había **nada** que limitara la acumulación: ni bytes, ni
 * cantidad, ni rate limit por token. El token de un inquilino dura **15 días**, así que
 * alguien cuyo contrato ya terminó puede seguir subiendo dos semanas. El propio handler ya
 * contemplaba el final de esa historia: devuelve 507 "el servidor se quedó sin espacio".
 *
 * POR QUÉ POR TENANT Y NO POR USUARIO. El Volume es **uno solo y compartido entre todas las
 * inmobiliarias**. Un tope por usuario no evita que un tenant con muchos usuarios llene el
 * disco de todos; un tope por tenant sí acota el daño a quien lo causa. Es contención de
 * radio de explosión, no antifraude: el que sube es alguien autenticado de esa inmobiliaria,
 * y el problema no es que suba, es que pueda tirar abajo a los demás.
 *
 * POR QUÉ NO SE GATEA POR CONTRATO ACTIVO, que es el arreglo que parece obvio: rompe un caso
 * legítimo. `POST /mis-documentos` deja subir documentación propia DESPUÉS de terminado el
 * contrato a propósito, porque `Documento` cuelga de `inquilinoId` y no de `contratoId`. El
 * problema nunca fue el estado del contrato: era que no había cuota.
 */

/** 2 GB por inmobiliaria. Configurable: algunas carteras pesan mucho más que otras. */
const CUOTA_MB_DEFAULT = 2048;

export function cuotaBytes(env: NodeJS.ProcessEnv = process.env): number {
  // El string vacío se descarta ANTES de convertir, y no es un detalle: `Number('')` es 0, así
  // que un `UPLOADS_CUOTA_MB=` sin valor —lo más fácil de dejar en un .env— pasaría por
  // "número válido, cero" y apagaría la cuota sin que nadie se entere. Es exactamente el modo
  // de falla silencioso que este módulo viene a cerrar; lo cazó su propio test.
  const crudo = (env.UPLOADS_CUOTA_MB ?? '').trim();
  if (crudo === '') return CUOTA_MB_DEFAULT * 1024 * 1024;

  const n = Number(crudo);
  // Un valor inválido tampoco apaga la cuota: cae al default. Para desactivarla hay que
  // escribir 0 a propósito, que es una decisión y no un descuido.
  const mb = Number.isFinite(n) && n >= 0 ? n : CUOTA_MB_DEFAULT;
  return mb * 1024 * 1024;
}

/** Suma el tamaño de los archivos de un directorio. No recursivo: los uploads son planos. */
export async function bytesDeDirectorio(dir: string): Promise<number> {
  let nombres: string[];
  try {
    nombres = await readdir(dir);
  } catch {
    // El directorio del tenant se crea al primer upload: que no exista es 0, no un error.
    return 0;
  }
  let total = 0;
  for (const nombre of nombres) {
    try {
      const s = await stat(path.join(dir, nombre));
      if (s.isFile()) total += s.size;
    } catch {
      // Un archivo borrado entre el readdir y el stat no rompe la cuenta.
    }
  }
  return total;
}

/**
 * Uso por tenant, cacheado.
 *
 * Recorrer el directorio en cada subida es O(archivos), y una inmobiliaria con años de
 * comprobantes tiene muchos. Se recalcula cada `TTL_MS` y, en el medio, cada subida exitosa
 * suma sus bytes al cache.
 *
 * El cache puede quedar ALTO si alguien borra archivos por fuera —falla del lado seguro: se
 * bloquea de más, nunca de menos— y el recálculo del TTL lo corrige solo.
 */
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { bytes: number; at: number }>();

export async function usoDelTenant(baseDir: string, tenant: string, ahora = Date.now()): Promise<number> {
  const hit = cache.get(tenant);
  if (hit && ahora - hit.at < TTL_MS) return hit.bytes;
  const bytes = await bytesDeDirectorio(path.join(baseDir, tenant));
  cache.set(tenant, { bytes, at: ahora });
  return bytes;
}

/** Suma lo recién escrito sin recalcular todo el directorio. */
export function registrarSubida(tenant: string, bytes: number): void {
  const hit = cache.get(tenant);
  if (hit) hit.bytes += bytes;
}

/** Sólo para los tests: el cache es de proceso y sobrevive entre casos. */
export function _limpiarCacheCuota(): void {
  cache.clear();
}
