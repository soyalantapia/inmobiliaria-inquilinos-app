# T-21-N1 · El devengo no sabe qué es un "solo expensas" (💰)

- **fase:** 8 (cerrada)
- **commits:** `77babfe` (el fix) + `c26db5f` (mensaje honesto + doc) + `753674c` (los dos
  agujeros que encontró el paso adversarial)
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

## Lo que encontró el paso adversarial (y que yo no había visto)

Dos refutadores independientes atacaron el fix. **El núcleo se sostiene**, y lo confirmaron
archivo por archivo: sólo hay **tres** escritores de `contrato.monto` en toda la API y los tres
quedan cubiertos; la importación de cartera hardcodea `ALQUILER` (`importaciones-cartera.ts:471`)
así que no puede parir un solo-expensas sucio; los guards 409 están **después** del `findFirst`
scopeado por `inmobiliariaId`, así que no filtran la existencia de contratos de otro tenant; el
filtro del panel tolera `tipoContrato` undefined, así que un contrato viejo sigue apareciendo; y
`GET /contratos` usa `include` (no `select`), o sea que el campo realmente llega en producción y
el filtro no es un no-op.

Pero encontraron **dos agujeros míos**, los dos en la renovación, y los dos ya corregidos en
`753674c`:

1. **El mail le anunciaba al inquilino un aumento que la base nunca guardó.** Las cinco
   escrituras de la transacción usaban `canonNuevo` (forzado a 0), pero `avisarAjusteAlInquilino`
   y el `return` seguían con `b.montoNuevo` crudo. El Historial decía "canon 0 → 0" mientras al
   inquilino le llegaba un mail real diciendo que su alquiler pasó a $500.000. Era peor que el
   bug original: el bug original facturaba de más, éste **le avisa** de más. Ahora usa el canon
   efectivo, y si el canon no se movió no se manda nada.
2. **El `nonnegative()` era inalcanzable desde el panel.** El diálogo exigía `nuevoNum > 0` y
   prefilleaba con el canon actual —que en un solo-expensas es 0—, así que el botón quedaba
   deshabilitado para siempre y la única salida era inventar un alquiler. Habilité el caso en el
   server y me olvidé del cliente. Ahora el campo no se muestra para ese tipo y el texto explica
   que se renueva sólo el plazo.

**Lo que NO pude verificar en el navegador:** el diálogo de renovar sólo se renderiza con
`apiEnabled === true` (`contratos/[id]/page-client.tsx:317`), y en build demo no aparece. Ese
cambio está verificado por `tsc` y por lectura, **no** probado a mano. El filtro del ajuste
masivo sí lo probé en el navegador.

## ⚠️ NECESITA TU MANO ANTES DEL DEPLOY

**Esto arregla de acá en adelante.** Si hoy en producción ya existe un `SOLO_EXPENSAS` con canon
sucio, sus liquidaciones ya devengadas siguen mal y el fix no las toca.

Correr, en modo lectura, **antes de deployar**:
`work-agent/tareas/T-21-N1/diagnostico-datos.sql` (3 consultas: contratos sucios,
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
