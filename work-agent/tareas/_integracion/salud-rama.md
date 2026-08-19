# Salud de `feat/reunion-camila-0308` — 19/08

Verificación de integración. **Nadie la tiene asignada**: cada chat verifica su rama y ninguno
verifica el conjunto. Se corre desde la rama de trabajo, después de una tanda de merges.

## Resultado: la rama está sana

| Chequeo | Resultado |
|---|---|
| `tsc --noEmit` en `apps/api` | ✅ 0 |
| `tsc --noEmit` en `apps/inmobiliaria` | ✅ 0 |
| `tsc --noEmit` en `apps/inquilino` | ✅ 0 |
| Tests sin DB (23 archivos) | **207 pasan** · 3 fallan · 45 skipped |

Los 3 rojos son los tres de `sonar-correlacion.test.ts`, que **no es un test puro**: llama a
`buildApp` y por lo tanto exige `DATABASE_URL` y `JWT_SECRET`. Es un defecto **del filtro**, no
del código, y ya está identificado en la rama `fix/filtro-tests-puros` (*"el filtro de tests
puros dejaba pasar uno que levanta Postgres"*). El que fallaba antes en
`backfill-mascotas-propiedad` se arregló en T-21-N1-N2.

## Cómo reproducirlo

```bash
cd apps/api && ./node_modules/.bin/vitest run $(cd test && grep -L "seedBase" *.test.ts | sed 's|^|test/|' | tr '\n' ' ')
```

El filtro `grep -L seedBase` es aproximado —por eso deja pasar `sonar-correlacion`— pero alcanza
para tener una señal en una máquina sin Postgres.

## Lo que esta verificación NO cubre

- **Las 20 ramas sin mergear.** Esto verifica lo que YA está en la rama de trabajo, no la
  consolidación. Para eso está `tmp/integracion`, y ahí ya apareció un choque real (T-36).
- **Nada corrido contra la base.** Los ~40 tests que exigen Postgres no se ejecutaron: pegan a
  producción (`docs/TESTING.md`).
- **Nada verificado en navegador.** El clasificador de seguridad bloquea las herramientas de
  preview en esta sesión.
