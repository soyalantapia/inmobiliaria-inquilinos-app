import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Las suites que llaman a seedBase siembran destructivamente una Postgres COMPARTIDA:
// no se pueden correr en CI, ni en paralelo, ni sin coordinar con quien esté probando.
// Eso dejaba a los 725 tests del proyecto en un todo-o-nada, y el resultado práctico fue
// que no los corría nadie: el único workflow que había era el deploy de la demo.
//
// Esta config parte el suite por la única línea que importa —¿necesita una base viva?— y
// deja del lado corrible los 344 tests que no. La lista NO se escribe a mano: se calcula
// leyendo los imports. Un test nuevo que necesite base queda afuera solo, sin depender de
// que alguien se acuerde de agregarlo.
const DIR_TESTS = join(import.meta.dirname, 'test');

// health.test.ts no escribe nada, pero uno de sus casos afirma que la base responde
// ("responde ok con la DB arriba", body.db === 'up'). Es el único que no se delata por
// sus imports, así que va nombrado. Uno solo y explícito es mejor que una regla torcida
// para que lo abarque.
const TAMBIEN_NECESITAN_BASE = ['health.test.ts'];

/**
 * Las líneas de código, sin las de comentario.
 *
 * POR QUÉ: la detección es por texto, y un archivo que sólo NOMBRA `seedBase` en su docblock
 * quedaba clasificado como "necesita base". Le pasaba a `portal-aislamiento.test.ts` —el guard
 * multi-tenant del portal del propietario, que lee un archivo con `readFileSync` y no toca la
 * red—: su propio comentario dice "se corre sin base de datos", y la palabra `seedBase` en esa
 * misma frase era lo que lo dejaba afuera. Resultado: el guard no corría NUNCA, porque la suite
 * completa tarda horas y nadie la corre entera.
 *
 * Se sacan sólo las líneas que son enteramente comentario. NO se hace un strip de `//` a fin de
 * línea: una línea como `const u = 'http://x'; await seedBase(p);` perdería la llamada real, y
 * ese error va para el lado peligroso —un test que sí necesita base entrando al suite sin base—.
 * Los falsos positivos que quedan son inofensivos: un archivo de más marcado como "necesita
 * base" simplemente no corre acá.
 */
function soloCodigo(src: string): string {
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

function necesitaBase(archivo: string): boolean {
  if (TAMBIEN_NECESITAN_BASE.includes(archivo)) return true;
  const src = soloCodigo(readFileSync(join(DIR_TESTS, archivo), 'utf8'));
  // Dos formas de depender de una base viva, y las dos cuentan:
  //  - LLAMAR a seedBase, el helper compartido;
  //  - sembrarse solo (soporte.test.ts arma sus propias filas porque requireUsuario
  //    revalida contra la tabla, así que un JWT inventado no le sirve).
  //
  // El paréntesis de `seedBase(` no es cosmética: sin él bastaba MENCIONAR el nombre.
  // `guard-db.test.ts` lo nombra como string —`exigirDbDeTest('seedBase', url)`— y quedaba
  // clasificado como "necesita base". Es un test PURO, y no cualquiera: es el que fija el
  // predicado que decide si una DATABASE_URL es de producción, o sea **el único freno entre
  // seedBase y la base de un cliente real**. Estaba fuera del suite rápido, y el completo
  // tarda horas: el freno no se verificaba nunca.
  return src.includes('seedBase(') || src.includes('new PrismaClient(');
}

const sinBase = readdirSync(DIR_TESTS)
  .filter((f) => f.endsWith('.test.ts'))
  .filter((f) => !necesitaBase(f))
  .map((f) => `test/${f}`);

export default defineConfig({
  test: {
    environment: 'node',
    include: sinBase,
    // Sin DB compartida no hay razón para serializar: acá el paralelismo es gratis.
    fileParallelism: true,
    testTimeout: 20_000,
  },
});
