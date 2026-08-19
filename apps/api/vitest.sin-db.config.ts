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

function necesitaBase(archivo: string): boolean {
  if (TAMBIEN_NECESITAN_BASE.includes(archivo)) return true;
  const src = readFileSync(join(DIR_TESTS, archivo), 'utf8');
  // Dos formas de depender de una base viva, y las dos cuentan:
  //  - seedBase, el helper compartido;
  //  - sembrarse solo (soporte.test.ts arma sus propias filas porque requireUsuario
  //    revalida contra la tabla, así que un JWT inventado no le sirve).
  return src.includes('seedBase') || src.includes('new PrismaClient(');
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
