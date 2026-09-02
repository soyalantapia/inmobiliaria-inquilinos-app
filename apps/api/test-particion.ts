/**
 * EL criterio de partición del suite. Uno solo, para las dos configs y para el test.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. El criterio estaba escrito DOS VECES, una en cada config, y las
 * dos copias divergieron: `vitest.con-db.config.ts` buscaba `'seedBase'` pelado y
 * `vitest.sin-db.config.ts` `'seedBase('` sobre el código sin comentarios. Con eso,
 * `guard-db.test.ts` —que sólo NOMBRA `seedBase` en un string— quedaba clasificado como "con
 * base" en una y "sin base" en la otra, y corría en los dos jobs.
 *
 * Correr dos veces no es el riesgo. El riesgo es el CERO: un archivo que las dos copias
 * clasifican para el otro lado no corre en NINGUNO de los dos jobs de CI, y no se entera nadie
 * —la suite completa tarda una eternidad y nadie la corre a mano—. Según los comentarios de la
 * config sin-db, eso ya pasó dos veces, y una de ellas se llevó puesto justamente el test que
 * fija el freno entre `seedBase` y la base de un cliente real.
 *
 * `test/particion-de-suites.test.ts` verifica la propiedad: cada archivo en exactamente un
 * grupo. La config con-db lo prometía y ese test no existía.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DIR_TESTS = join(import.meta.dirname, 'test');

/**
 * `health.test.ts` no escribe nada, pero uno de sus casos afirma que la base responde
 * ("responde ok con la DB arriba", `body.db === 'up'`). Es el único que no se delata por sus
 * imports, así que va nombrado. Uno solo y explícito es mejor que una regla torcida para que
 * lo abarque.
 */
export const TAMBIEN_NECESITAN_BASE = ['health.test.ts'];

/**
 * Las líneas de código, sin las de comentario.
 *
 * POR QUÉ: la detección es por texto, y un archivo que sólo NOMBRA `seedBase` en su docblock
 * quedaba clasificado como "necesita base". Le pasaba a `portal-aislamiento.test.ts` —el guard
 * multi-tenant del portal del propietario, que lee un archivo con `readFileSync` y no toca la
 * red—: su propio comentario dice "se corre sin base de datos", y la palabra `seedBase` en esa
 * misma frase era lo que lo dejaba afuera.
 *
 * Se sacan sólo las líneas que son ENTERAMENTE comentario. NO se hace un strip de `//` a fin de
 * línea: una línea como `const u = 'http://x'; await seedBase(p);` perdería la llamada real, y
 * ese error va para el lado peligroso —un test que sí necesita base entrando al suite sin ella—.
 * Los falsos positivos que quedan son inofensivos.
 */
export function soloCodigo(src: string): string {
  return src
    .split(/\r?\n/)
    .map((l) => {
      const t = l.trim();
      if (t.startsWith('//')) return '';
      // Si la línea abre o continúa un bloque, se queda con lo que venga DESPUÉS del cierre.
      // Una línea como `*/ await seedBase(prisma);` es código, y descartarla entera mandaría
      // un test que SÍ necesita base al suite que corre sin ella — el error peligroso.
      if (t.startsWith('*') || t.startsWith('/*')) {
        const cierre = t.lastIndexOf('*/');
        return cierre >= 0 ? t.slice(cierre + 2) : '';
      }
      return l;
    })
    .join('\n');
}

/**
 * ¿Este archivo necesita una Postgres viva?
 *
 * Dos formas de depender de una, y las dos cuentan: LLAMAR a `seedBase`, el helper compartido,
 * y sembrarse solo con su propio cliente (`soporte.test.ts` arma sus filas porque
 * `requireUsuario` revalida contra la tabla y un JWT inventado no le sirve).
 *
 * El paréntesis de `seedBase(` no es cosmética: sin él bastaba MENCIONAR el nombre.
 */
export function necesitaBase(archivo: string, src?: string): boolean {
  if (TAMBIEN_NECESITAN_BASE.includes(archivo)) return true;
  const codigo = soloCodigo(src ?? readFileSync(join(DIR_TESTS, archivo), 'utf8'));
  return codigo.includes('seedBase(') || codigo.includes('new PrismaClient(');
}
