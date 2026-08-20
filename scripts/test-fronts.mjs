#!/usr/bin/env node
/**
 * Corre los tests de los tres fronts.
 *
 * POR QUÉ NO ES UN `pnpm --filter ... test` Y PUNTO. Esa es la forma idiomática y en Linux
 * anda, pero en Windows pnpm ejecuta los scripts a través de `cmd.exe`, y ahí un `pnpm`
 * anidado sólo se resuelve si pnpm está instalado como ejecutable de Windows en el PATH. Con
 * corepack —que es como está en esta máquina— falla con "pnpm no se reconoce como un comando".
 * El resultado era config de CI que no se podía probar en local antes de pushear, que es
 * exactamente la clase de cosa que después se descubre en rojo y a destiempo.
 *
 * POR QUÉ NO `turbo run test`. La tarea `test` de turbo incluiría a `api`, cuyo script es la
 * suite COMPLETA y necesita una Postgres viva. Acá corren sólo los que no tocan base.
 *
 * Invoca el entrypoint .mjs de vitest con el mismo node que corre este script. NO usa el
 * binario de `node_modules/.bin`: en Windows ese es un `.CMD` y `spawnSync` no puede
 * ejecutarlo sin `shell: true` —falla en silencio, con status distinto de 0 y sin una línea
 * de error—. Así no hace falta shell ni que haya nada en el PATH.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPS = ['inquilino', 'inmobiliaria', 'propietario'];

let fallaron = [];
for (const app of APPS) {
  const dir = join(RAIZ, 'apps', app);
  const vitest = join(dir, 'node_modules', 'vitest', 'vitest.mjs');
  if (!existsSync(vitest)) {
    console.error(`\n❌ ${app}: no encuentro vitest en ${vitest}. ¿Falta 'pnpm install'?`);
    fallaron.push(app);
    continue;
  }

  console.log(`\n──────── apps/${app}`);
  // `--passWithNoTests` para que una app sin tests todavía no ponga en rojo a las otras.
  const r = spawnSync(process.execPath, [vitest, 'run', '--passWithNoTests'], {
    cwd: dir,
    stdio: 'inherit',
  });
  if (r.status !== 0) fallaron.push(app);
}

if (fallaron.length > 0) {
  console.error(`\n❌ Fallaron: ${fallaron.join(', ')}`);
  process.exit(1);
}
console.log('\n✓ Los tres fronts en verde.\n');
