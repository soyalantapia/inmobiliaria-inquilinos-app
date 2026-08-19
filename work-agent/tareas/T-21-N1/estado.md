# T-21-N1 · El devengo no sabe qué es un "solo expensas" (💰)

- **fase:** 8 (cerrada, pendiente de merge a `feat/reunion-camila-0308`)
- **commits:** `77babfe` (el fix) + `c26db5f` (mensaje honesto + doc)
- **rama:** `feat/T-21-N1-devengo-solo-expensas` · **worktree:** `../myalquiler-T-21-N1`
- **cubre también T-21-N2** (era la misma puerta por el otro lado)

## El problema, en una línea

Un contrato de solo expensas devengaba 0 de alquiler **por casualidad** —sólo porque
`contrato.monto` había quedado en 0—, y tres caminos distintos podían ensuciar ese 0.

## Hecho

**El devengo.** `ContratoParaLiquidar` ahora exige `tipoContrato` (requerido a propósito, mismo
criterio que `devengarDesde`: el compilador encuentra a cualquier caller que se lo saltee) y
`computarLiquidacionesContrato` pasa el canon del período por `montoAlquilerSegunTipo`,
**después** de resolver la vigencia — si el corte fuera antes, un ajuste con vigencia futura se
colaba igual. Los dos barridos que lo alimentan (cron y botón "Devengar") traen el campo.

**Las puertas.** `/ajustar` y `PATCH /monto` → 409. `/renovar` → no rechaza (renovar el plazo es
legítimo) pero fuerza el canon a 0. El alta → 400 para el caso inverso (T-21-N2). El panel saca
esos contratos del **ajuste masivo**, que era el vector principal.

## Verificación

- `tsc` 0 en `apps/api` y `apps/inmobiliaria`.
- 22 tests puros de liquidaciones en verde, 4 casos nuevos, **verificados en rojo** revirtiendo
  el fix (falla exactamente el caso "canon sucio").
- 104/105 del resto de los tests puros. El que falla (`backfill-mascotas-propiedad`) hace
  `spawnSync` a un `psql` de macOS → ver T-21-N1-N2. No lo toca este cambio.
- Navegador: el consorcio de solo expensas desapareció de la lista del ajuste masivo (5 en vez
  de 6, todos alquileres). Consola sin errores propios — los 403 que aparecen son de un
  telemetry externo (`sonar-api`, clave pública `son_pub_`), preexistente.

## ⚠️ NECESITA TU MANO ANTES DEL DEPLOY

**Esto arregla de acá en adelante.** Si hoy en producción ya existe un `SOLO_EXPENSAS` con canon
sucio, sus liquidaciones ya devengadas siguen mal y el fix no las toca.

Correr, en modo lectura, **antes de deployar**:
`work-agent/.tareas/T-21-N1/diagnostico-datos.sql` (3 consultas: contratos sucios,
liquidaciones ya facturadas de más, y el rastro de cómo se ensuciaron).

- 0 filas en las tres → el fix alcanza, no hay nada que limpiar.
- Con filas → hay que decidir qué se hace con lo facturado. Y donde `cobrado > 0`, no alcanza
  con corregir la liquidación: esa plata ya entró.

No escribí la migración de corrección: sin ver los datos sería adivinar.

## Sin migraciones de schema

Este cambio no toca `schema.prisma`. `tipoContrato` ya existía.

## Veredicto de la Fase 7 (Camila)

> "A ver si entiendo. ¿Vos me estás diciendo que si yo apretaba el botón de aumento masivo, al
> del consorcio de Sucre —que no paga alquiler, paga expensas— le empezaba a aparecer un
> alquiler? Eso es justo lo que no puede pasar. Esa gente me llama por WhatsApp al otro día y yo
> quedo como que le invento la deuda.
>
> Me quedo tranquila con que ahora no aparezca más en la lista del aumento, porque yo tildo todo
> y le doy aplicar, no me pongo a mirar uno por uno.
>
> Lo que sí quiero saber ya: **¿le pasó a alguien?** Porque si a alguno le facturamos de más el
> mes pasado, eso lo tengo que arreglar yo con la persona, no con un sistema."

Esa última pregunta es exactamente la que contesta el `.sql` de arriba. Es la razón por la que
no cierro esto como "listo, deployá".

## Tareas nuevas registradas

- **T-21-N1-N1 · 🟠 No hay forma de cambiar las expensas de un contrato ya cargado.**
  `montoExpensas` sólo se setea en el alta (`core.ts:988`); no existe endpoint de edición. Las
  expensas suben todos los meses. Lo descubrí porque mi propio mensaje de error mandaba a esa
  pantalla; el mensaje ya dice la verdad.
- **T-21-N1-N2 · 🟢 Un test "puro" que sólo corre en macOS.**
  `backfill-mascotas-propiedad.test.ts` hace `spawnSync` a
  `/opt/homebrew/opt/postgresql@18/bin/psql`.
