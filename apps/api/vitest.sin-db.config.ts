import { readdirSync } from 'node:fs';
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
// El criterio vive en `test-particion.ts` y lo comparte con la config con-db: eran dos copias
// y divergieron. Ver el docblock de ese archivo.
import { DIR_TESTS, necesitaBase } from './test-particion.js';

const sinBase = readdirSync(DIR_TESTS)
  .filter((f) => f.endsWith('.test.ts'))
  .filter((f) => !necesitaBase(f))
  .map((f) => `test/${f}`);

/**
 * "No necesita base" NO quiere decir "no necesita entorno" (T-01-N1-N15).
 *
 * Varios de estos tests hacen `buildApp()`, y `src/env.ts` valida el entorno con zod al
 * importarse: sin `DATABASE_URL` ni `JWT_SECRET` tira ZodError antes de que corra un solo
 * assert. Nunca se notó porque los dos lugares donde se corría lo tapaban: el job `revision`
 * inyecta las dos variables a mano, y el worktree de trabajo tiene un `apps/api/.env`.
 *
 * En un worktree limpio —o sea, el de cualquiera que clone hoy— daban 3 rojos que no tenían
 * NADA que ver con el cambio de esa persona. Ese es el rojo que enseña a ignorar los rojos.
 *
 * Los valores son deliberadamente inservibles: la URL apunta al puerto 1 de loopback, así que
 * si algún día un test de esta partición intenta conectarse de verdad, falla rápido y ruidoso
 * en vez de encontrar una base y ensuciarla. No pisan lo que ya venga del entorno: si alguien
 * tiene un `.env`, manda el suyo.
 */
const ENTORNO_MINIMO = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://nadie:nadie@127.0.0.1:1/nada',
  JWT_SECRET: process.env.JWT_SECRET ?? 'esto-no-firma-nada-real-en-tests',
};

export default defineConfig({
  test: {
    environment: 'node',
    include: sinBase,
    env: ENTORNO_MINIMO,
    // Sin DB compartida no hay razón para serializar: acá el paralelismo es gratis.
    fileParallelism: true,
    testTimeout: 20_000,
  },
});
