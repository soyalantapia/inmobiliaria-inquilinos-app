/**
 * Dónde escribe la API los archivos que sube la gente.
 *
 * EL DEFECTO QUE ESTO CIERRA. Hasta el 29/08/2026 la resolución sólo conocía `/data`, el punto
 * de montaje de **Railway**. Producción se mudó a **Render**, que monta el disco en `/var/data`.
 * Con el disco de 5 GB colgado y vacío, lo único que salvaba los archivos era que alguien se
 * acordara de setear `UPLOADS_DIR` a mano en el servicio.
 *
 * POR QUÉ MERECE UN TEST Y NO ALCANZA CON "ya está seteada": porque si elige mal **no falla**.
 * Subir devuelve 200, el archivo se escribe en el tmp del contenedor, se lee bien un rato, y
 * desaparece en el próximo deploy. Lo que queda es una URL que da 404 y parece un problema de
 * permisos.
 *
 * PURO: no toca disco ni base. Corre en la partición `sin-db`.
 */
import { describe, it, expect } from 'vitest';
import { resolverUploadsDir, MONTAJES_CONOCIDOS } from '../src/lib/donde-viven-los-archivos.js';

const TMP = '/tmp/myalquiler-uploads';
/** Un `existsSync` de mentira: sólo existen las rutas que se le pasan. */
const conMontajes = (...montados: string[]) => (r: string) => montados.includes(r);

describe('dónde viven los archivos subidos', () => {
  it('🔴 en Render, con el disco en /var/data y SIN la variable', () => {
    // Éste es el caso que se rompía: caía al tmp del contenedor devolviendo 200.
    expect(resolverUploadsDir({}, conMontajes('/var/data'), TMP)).toBe('/var/data/uploads');
  });

  it('en Railway, con el disco en /data', () => {
    expect(resolverUploadsDir({}, conMontajes('/data'), TMP)).toBe('/data/uploads');
  });

  it('la variable explícita gana sobre cualquier montaje: es la salida de emergencia', () => {
    expect(resolverUploadsDir({ UPLOADS_DIR: '/otro/lado' }, conMontajes('/var/data', '/data'), TMP)).toBe('/otro/lado');
    // Y también cuando no hay ningún disco.
    expect(resolverUploadsDir({ UPLOADS_DIR: '/otro/lado' }, conMontajes(), TMP)).toBe('/otro/lado');
  });

  it('si están los dos montados, manda /var/data — que es donde estamos hoy', () => {
    expect(resolverUploadsDir({}, conMontajes('/var/data', '/data'), TMP)).toBe('/var/data/uploads');
  });

  it('sin disco —dev y test— cae al tmp, que es lo correcto ahí', () => {
    expect(resolverUploadsDir({}, conMontajes(), TMP)).toBe(TMP);
  });

  it('una variable vacía no cuenta como seteada', () => {
    // En Docker, `--build-arg X=` deja la variable en cadena vacía. Si eso ganara, los archivos
    // irían a `''` y el modo de falla volvería a ser silencioso.
    expect(resolverUploadsDir({ UPLOADS_DIR: '' }, conMontajes('/var/data'), TMP)).toBe('/var/data/uploads');
  });

  it('los montajes conocidos están en orden y no se duplican', () => {
    expect([...MONTAJES_CONOCIDOS]).toEqual(['/var/data', '/data']);
    expect(new Set(MONTAJES_CONOCIDOS).size).toBe(MONTAJES_CONOCIDOS.length);
  });
});
