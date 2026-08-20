# T-32 · Runner de tests en los fronts — HECHA

## Se retomó de un lock abandonado

La tarea estaba tomada desde las 14:19 y seguía en **fase 0**: cero commits en
`chore/T-32-runner-tests-fronts`, sin cambios sin commitear, y su worktree clavado en un commit
viejo. Se verificó antes de tomarla para no pisarle el trabajo a nadie.

## Lo que había: cuatro tests que nunca corrieron

No era que faltaran tests. Era que los que existían **no los ejecutaba nadie** — ni `vitest`, ni
config, ni tarea `test` en `turbo.json`:

| Archivo | Tests |
|---|---|
| `apps/inquilino/src/lib/saldo-liquidacion.test.ts` | 8 |
| `apps/inquilino/src/lib/tipo-contrato.test.ts` | 16 |
| `apps/propietario/src/lib/demo-data.test.ts` | 23 |
| `apps/propietario/src/lib/format.test.ts` | 5 |

**52 tests escritos de buena fe que pasaban por verdes sin haberse ejecutado nunca.** Es peor que
no tenerlos: daban una sensación de cobertura que no existía. Al correrlos por primera vez,
**los 52 pasan** — pero eso era suerte, no garantía.

## Qué se hizo

- `vitest.config.ts` en los tres fronts, con el alias `@ → src` (sin eso, cualquier test que
  importe con `@/…` falla al resolver).
- `test` y `test:watch` en cada `package.json`, y tarea `test` en `turbo.json`.
- `--passWithNoTests`: `apps/inmobiliaria` todavía no tiene tests y `vitest run` salía con
  **código 1**, o sea que habría roto la CI el día que se agregara la tarea al pipeline.

### Dos decisiones

**`environment: 'node'`, no jsdom.** Lo que hay para testear es lógica pura —saldos, períodos,
formatos, coherencia de datos demo—, no componentes. Un jsdom trae un árbol de dependencias y
una clase entera de flakiness para algo que hoy nadie necesita. Cuando haya que testear un
componente se agrega, y ahí se justifica.

**Los tests van al lado del código** (`src/**`), no en un `test/` aparte como en la API. Son de
funciones puras, y tenerlos pegados al archivo que prueban hace más probable que alguien los
actualice cuando toca esa función.

## De paso, cierra el pendiente de T-46-N2 y T-46-N3

El guardarraíl que impide que la demo del portal contradiga a la del panel vivía en
`apps/api/test/` **porque era el único paquete con runner**, con una nota que decía que había que
mudarlo al cerrar T-32. Se mudó: ahora es
`apps/propietario/src/lib/demo-coherente-con-panel.test.ts`, que es su lugar — lo que protege es
que la demo del PORTAL no contradiga al panel.

## Verificación

| | |
|---|---|
| `apps/inquilino` | **24 tests** en verde |
| `apps/propietario` | **29 tests** en verde (28 propios + el guardarraíl mudado) |
| `apps/inmobiliaria` | sin tests aún, exit 0 |
| `apps/api` | **362 tests** sin DB en verde, sin regresiones |
| `tsc --noEmit` | **0** en los cuatro paquetes |

**Nota sobre `turbo test`:** no se pudo ejecutar por turbo en esta máquina (`Unable to find
package manager binary`) — es la particularidad conocida de que `pnpm` no está en el PATH y hay
que invocarlo por `corepack`. La tarea de turbo queda declarada y correcta; el camino que sí
funciona acá es `corepack pnpm --filter @llave/<app> test`.
