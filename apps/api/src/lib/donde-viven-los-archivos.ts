/**
 * Dónde escribe la API los archivos que sube la gente — comprobantes, boletas, fotos de reclamo,
 * documentos del contrato.
 *
 * POR QUÉ ESTO ES UNA FUNCIÓN Y NO UNA CONSTANTE ADENTRO DEL HANDLER. Porque el modo de falla es
 * el peor que hay: **si elige mal, no falla**. Subir sigue devolviendo 200, el archivo se escribe,
 * se lee bien durante un rato, y desaparece en el próximo deploy o reinicio — sin un solo error
 * en el log. Lo único que queda es una fila en la base con una URL que da 404 y parece un problema
 * de permisos.
 *
 * EL CASO REAL. Hasta el 29/08/2026 esto sólo conocía `/data`, que es donde montaba el volumen
 * **Railway**. Producción se mudó a **Render**, que monta el disco en `/var/data`. Con el disco
 * de 5 GB colgado y vacío, la única cosa que salvaba los archivos era acordarse de setear
 * `UPLOADS_DIR` a mano en el servicio.
 *
 * EL ORDEN, y por qué:
 *   1. `UPLOADS_DIR` explícita — gana siempre; es la salida de emergencia.
 *   2. `/var/data` — Render. Va antes que `/data` porque es donde estamos hoy, y es la convención
 *      del resto de la cuenta (`ccm-app`, `speed-hub`).
 *   3. `/data` — Railway. Se conserva por si algo vuelve ahí.
 *   4. un tmp del sistema — dev y test, donde no hay disco y perder archivos no cuesta nada.
 *
 * ⚠️ Se evalúa UNA VEZ, al cargar el módulo: montar un disco después no cambia nada sin
 * reiniciar el proceso.
 */

/** Los dos puntos de montaje conocidos, en orden de preferencia. */
export const MONTAJES_CONOCIDOS = ['/var/data', '/data'] as const;

export function resolverUploadsDir(
  env: { UPLOADS_DIR?: string },
  existe: (ruta: string) => boolean,
  tmp: string,
): string {
  if (env.UPLOADS_DIR) return env.UPLOADS_DIR;
  for (const montaje of MONTAJES_CONOCIDOS) {
    if (existe(montaje)) return `${montaje}/uploads`;
  }
  return tmp;
}
