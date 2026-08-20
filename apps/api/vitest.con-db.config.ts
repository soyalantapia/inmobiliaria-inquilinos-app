import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// El complemento exacto de `vitest.sin-db.config.ts`: las suites que SÍ necesitan una base
// viva. Son 52 de 94 archivos, y no son las que sobran — son las de plata, auth, depósitos,
// conciliación y rendición multi-dueño.
//
// Nunca corrieron en CI. La razón era buena: `seedBase` siembra destructivamente, y la única
// base disponible era una remota COMPARTIDA con quien estuviera probando. Contra un service
// container de Actions eso deja de ser un problema — la base nace vacía en cada corrida, se usa
// y se tira, y no hay nadie más del otro lado.
//
// El criterio de partición vive en un solo lugar (`necesitaBase`) y se usa negado allá y
// afirmado acá, para que ningún archivo pueda quedar en los dos grupos o en ninguno. Hay un
// test que lo verifica: `test/particion-de-suites.test.ts`.
const DIR_TESTS = join(import.meta.dirname, 'test');

// health.test.ts no escribe nada, pero uno de sus casos afirma que la base responde
// ("responde ok con la DB arriba", body.db === 'up'). Es el único que no se delata por sus
// imports. Mismo listado que en la config sin-db, y el test de partición exige que coincidan.
const TAMBIEN_NECESITAN_BASE = ['health.test.ts'];

export function necesitaBase(archivo: string, src: string): boolean {
  if (TAMBIEN_NECESITAN_BASE.includes(archivo)) return true;
  // Dos formas de depender de una base viva, y las dos cuentan: `seedBase`, el helper
  // compartido, y sembrarse solo con su propio cliente (soporte.test.ts arma sus filas porque
  // requireUsuario revalida contra la tabla y un JWT inventado no le sirve).
  return src.includes('seedBase') || src.includes('new PrismaClient(');
}

// Suites que cuentan filas DEL SEED ("GET /contratos devuelve los 8 del seed"). Necesitan la
// base recién sembrada, así que van primero: con `fileParallelism: false` el orden de `include`
// es el orden de ejecución.
//
// POR QUÉ ASÍ Y NO LIMPIANDO ENTRE ARCHIVOS. Se probó: `prisma/limpiar-test-db.ts` como
// `setupFiles`. Empeoró de 6 rojas a 39 archivos rotos — ese script está escrito para correr
// entre CORRIDAS, con la base quieta, y a mitad de suite choca con las FK RESTRICT del esquema
// (revienta borrando contratos que otras filas todavía referencian) y se lleva puestos los
// `afterAll`, que quedan sin `app` ni `prisma`. Dejar la base pristina entre archivos es una
// tarea en sí misma; ordenar es lo que alcanza hoy y no rompe nada.
//
// Si mañana otra suite empieza a contar filas del seed, va a esta lista. El síntoma es
// reconocible: "expected 19 to be 8".
const PRIMERO_LAS_QUE_CUENTAN_EL_SEED = ['core.test.ts'];

const archivos = readdirSync(DIR_TESTS)
  .filter((f) => f.endsWith('.test.ts'))
  .filter((f) => necesitaBase(f, readFileSync(join(DIR_TESTS, f), 'utf8')));

const conBase = [
  ...PRIMERO_LAS_QUE_CUENTAN_EL_SEED.filter((f) => archivos.includes(f)),
  ...archivos.filter((f) => !PRIMERO_LAS_QUE_CUENTAN_EL_SEED.includes(f)),
].map((f) => `test/${f}`);

export default defineConfig({
  test: {
    environment: 'node',
    include: conBase,
    // TODAS las suites siembran la MISMA base con ids fijos: en paralelo se pisan entre sí.
    // Esto no es una limitación del runner, es del diseño de `seedBase`, y cambiarlo es otra
    // tarea. Serial y listo.
    fileParallelism: false,
    testTimeout: 60_000,
    // `seedBase` corre en el beforeAll de ~50 suites. Contra una base local es cuestión de
    // segundos; el margen es para el primer arranque del contenedor en CI.
    hookTimeout: 120_000,
  },
});
