# `tmp/union` — la rama que junta todo (T-44)

**Estado: lista y verificada.** Falta un solo paso, y es un `git merge`.

## Qué problema resuelve

El trabajo quedó repartido en **líneas de integración divergentes**, y ninguna tenía todo. La
peor consecuencia concreta: `apps/propietario` —la app entera del portal del dueño— **no existía**
en `tmp/integracion`. Y al revés, 8 arreglos vivían **sólo** ahí y no llegaban a la línea
principal.

`tmp/union` es el superconjunto. Verificado con `git log`: no queda **ningún** commit fuera de
ella en `feat/reunion-camila-0308`, `feat/propietario-detalle-rendicion` ni `tmp/integracion`.

## Qué rescata que hoy está huérfano

Los 8 commits que vivían sólo en `tmp/integracion`:

- el fix de la **matriz de permisos**, que le prometía a OPERADOR un circuito de aprobación que
  nunca se construyó;
- el del **historial**, que fallaba en silencio y se llevaba la operación puesta;
- T-36, T-38, T-39 a T-42.

## Los conflictos, y por qué se resolvió así

Cinco archivos con conflicto real. Los tres de plata (`liquidaciones.ts`, `plata.ts`, y parte de
`core.ts`) resultaron ser **sólo comentarios**: dos chats arreglaron el mismo bug de
`SOLO_EXPENSAS` por separado y escribieron prosa distinta. Se combinó la mejor de cada uno.

Los que sí eran de código:

| Dónde | Qué se eligió y por qué |
|---|---|
| `core.ts`, guard de `SOLO_EXPENSAS` | El mensaje que apunta al botón **"Cambiar expensas"**. El otro decía *"se edita desde los datos del contrato"*, que quedó desactualizado cuando T-21-N1-N1 construyó ese botón. |
| `core.ts`, evento de renovación | **Las dos mejoras juntas**: el tipo propio `RENOVACION` + el helper `registrarEventoContrato` de una rama, y `canonNuevo` en vez de `b.montoNuevo` de la otra — en un `SOLO_EXPENSAS` difieren, y el evento anunciaría un canon que la base nunca guardó. |
| `pago/[liqId]/page-client.tsx` | La versión de `cubiertoSinValidar` que anda en **los dos modos**. La otra estaba gateada por `apiEnabled` y quedaba muerta en demo — justo el bloqueante que la revisión había marcado. |
| `PROMPT-EJECUTAR-TAREA.md` | La versión con el **filtro exacto** de tests puros, que explica por qué filtrar sólo por `seedBase` no alcanza (`backfill-mascotas` levanta una base llamando a `psql` por `execFileSync`). |
| `09-TAREAS`, T-01 | El análisis de las **ocho** migraciones, con el dato que le faltaba injertado: **no hay paso manual**, el `Dockerfile` corre `prisma migrate deploy` antes de levantar el proceso. |

## Dos defectos que introdujo el merge automático

Git los mergeó limpio y compilaban mal o mentían:

1. **`RENOVACION` duplicada** en el `Record` de colores del timeline, con un valor distinto de
   cada rama. `tsc` lo atajó (TS1117); en runtime habría ganado la última en silencio. Quedó el
   verde: el tipo existe justamente para que una renovación **no** se vea igual que un ajuste, y
   el otro valor era el color del ajuste.
2. El mensaje desactualizado del guard de `SOLO_EXPENSAS` (fila 1 de la tabla).

## Verificación

- `tsc --noEmit` en **0** en `api`, `inmobiliaria`, `inquilino` y `propietario`.
- **307 tests en verde, ninguno rojo**, con el filtro correcto:

  ```bash
  cd apps/api && ./node_modules/.bin/vitest run $(grep -LE "\.\./src/db|prisma/seed|seedBase|app\.inject|psql|execFileSync|PG_HOST|pg_dump" test/*.test.ts)
  ```

  > Los 3–4 rojos que aparecían en revisiones anteriores eran **imprecisión del filtro**, no
  > fallas: `sonar-correlacion`, `health` y `soporte` llaman a `buildApp` y exigen
  > `DATABASE_URL`. Con el filtro de arriba quedan excluidos y no hay ningún rojo.

**No verificado:** nada se probó en navegador (el clasificador de seguridad bloqueó las
herramientas de preview), y no se corrieron los tests que tocan la base.

## Cómo integrarla

```bash
git checkout feat/propietario-detalle-rendicion && git merge tmp/union
```

Es superconjunto, así que **no puede perder trabajo**.

⚠️ **Antes:** que el árbol esté limpio. No se hizo desde acá porque al momento de terminar había
cambios **sin commitear** de otro chat en `portal-propietario.ts` y `propietario/page.tsx`, y
mergear ahí le cambia el piso a alguien a mitad de una edición.

⚠️ **Envejece rápido.** La línea principal se movió **cuatro veces** mientras se armaba esto —
incluso cambió de rama a mitad de camino. Si pasa mucho tiempo, hay que volver a alcanzarla:
`git merge <línea principal>` dentro de `tmp/union`, re-verificar, y recién ahí integrar.
