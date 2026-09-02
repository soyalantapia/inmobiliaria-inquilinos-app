# T-12 · Deshacer un cobro desde donde se lo ve

> **PM:** el relevamiento corrige el enunciado de la tarea. No falta el botón "en caja":
> falta **en la fila del cobro**, que es exactamente donde Camila se quedó.

---

## Lo que dijo, y dónde se quedó

- `[38:10]` *"¿Cómo elimino un pago ya cargado que me lo contabilizó en caja?"*
- `[37:52]` *"lo demás ni siquiera me sale cómo veo — **ver detalle**, ahí está."*

La segunda frase es la clave: **Camila encontró "Ver detalle" y llegó a la lista de cobros
del día.** No se perdió buscando la pantalla. Llegó a la fila del cobro equivocado, y la fila
no tenía ninguna acción. Es un callejón sin salida a un click del objetivo.

## Estado verificado

| Pieza | Dónde | Estado |
|---|---|---|
| `POST /pagos/:id/anular` | `plata.ts:522` | ✅ existe, capacidad `pago.revertir` (**sólo ADMIN**) |
| Guarda: sólo pagos `CONCILIADO` | `plata.ts:535` | ✅ 409 |
| Guarda: período ya rendido al propietario | `plata.ts:541-548` | ✅ 409 con mensaje accionable |
| Libera el `CreditoDetectado` del extracto | `plata.ts:~565` | ✅ |
| Lock atómico anti doble-anulación | `updateMany where estado='CONCILIADO'` | ✅ |
| Botón en la bandeja de conciliados | `pagos-por-validar.tsx:1271` | ✅ existe |
| **Botón en la fila del cierre de caja** | `caja/page.tsx:437-460` | ❌ **falta — esto es T-12** |
| `GET /caja/cierre` devuelve los pagos | `plata.ts:~278` (`pagos: items`, con `id`) | ✅ ya vienen los ids |

**El backend no necesita una sola línea.** El dato ya viaja: `CierreCajaItem` (`use-pagos.ts:327`)
ya tiene `id`. Es puramente de panel.

### Un bug latente que encontré haciendo esto

`usePagosConciliados.anular` invalida `pagos`, `liquidaciones`, `contratos`, `contrato` —
**pero no `caja`**. Hoy no se nota porque anular sólo se puede desde otra pantalla. En cuanto el
botón vive dentro del cierre de caja, sin arreglar esto el usuario anula y **el total de la caja
sigue mostrando la plata que acaba de sacar**. Se arregla en la misma pasada.

---

## Requerimientos

| # | Requerimiento | Por qué |
|---|---|---|
| R1 | En cada fila del detalle del cierre, acción **"Deshacer"** | Es donde ella está parada |
| R2 | Pide **motivo** (mín. 5 caracteres) antes de ejecutar | El server lo exige; que no rebote |
| R3 | Sólo se muestra a quien puede (`pago.revertir` → **ADMIN**) | No prometer lo que da 403 |
| R4 | Si el server rechaza, se muestra **su** mensaje, no uno genérico | *"…ya fue rendido al propietario. Anulá primero la rendición del período"* es la respuesta a "¿por qué no puedo?" |
| R5 | Al anular, el cierre se **recalcula solo** (cobrado, comisión, cantidad) | Un total viejo después de anular es peor que no tener el botón |
| R6 | Confirmación explícita, no un click suelto | Es plata, y es reversible sólo cargando el pago de nuevo |

**Criterio de aceptación (el de la tarea):** *desde donde el operador ve el cobro equivocado,
puede deshacerlo, y si no se puede, entiende por qué.*

## Fuera de alcance (declarado)

- **No se toca ninguna guarda del backend.** Ni el 409 de rendido, ni el de estado, ni el rol.
- **No se agrega anular en demo.** El cierre de caja no existe sin API (`enabled: apiEnabled`);
  en demo la sección ya dice "sin cobranzas" y no hay filas.
- **No se toca la bandeja de conciliados.** Sigue funcionando igual; ahora comparte la mutación.

## Desvío deliberado, declarado

La tarea listaba dependencia de T-04 (la pregunta de los $850). Esa dependencia era **mi propia
cautela sobre modificar lógica de pagos**. Acá no se modifica: se expone desde otra pantalla un
endpoint que ya existe y ya está guardado. No corresponde bloquear.

**Un arreglo de una línea que me llevé puesto:** la fila del detalle mostraba
`formatMonto(p.monto)` sin la moneda del ítem, así que un cobro en USD se veía como pesos —
dentro de un componente que a tres líneas de distancia ya maneja multimoneda. Si voy a poner
"deshacer este cobro" al lado de un número, el número tiene que estar bien. Va con la fila.

---

## Verificación — qué se probó y con qué resultado

**Cómo.** El bloque del cierre vive detrás de `{apiEnabled && <CierreCajaDelDia />}`: en demo no
existe, así que **no es observable sin API**. Para no tocar producción ni el tenant real, se
levantó un **stub HTTP local** (`scratchpad/stub-t12.mjs`, fuera del repo) que devuelve un cierre
con dos cobros — uno en ARS y uno en USD — y reproduce el 409 real del backend en uno de ellos.
El panel se corrió desde el worktree apuntando a ese stub.

| # | Qué se probó | Resultado |
|---|---|---|
| R1 | Botón por fila en el detalle del cierre | ✅ 2 filas → 2 botones "Deshacer" |
| R2 | Motivo obligatorio | ✅ "Deshacer cobro" arranca **deshabilitado**; se habilita a los 5 caracteres |
| R3 | Sólo quien tiene `pago.revertir` | ✅ con rol **OPERADOR: 0 botones**, y las filas se siguen viendo |
| R4 | Mensaje del server, no uno genérico | ✅ toast: *"No se pudo deshacer — Este pago ya fue rendido al propietario. Anulá primero la rendición del período y volvé a intentar."* |
| R4b | Un rechazo no rompe nada | ✅ el diálogo queda abierto para corregir y el cobro sigue en la lista |
| R5 | El cierre se recalcula solo | ✅ tras anular: COBROS **2 → 1**, la fila desaparece y el cartel de multimoneda se apaga |
| R6 | Confirmación explícita | ✅ diálogo con monto, período y qué va a pasar |
| — | Camino feliz | ✅ toast *"Cobro deshecho — El pago de Sofía Barrios volvió a quedar pendiente."* |

`tsc --noEmit` limpio. `next lint` sin warnings nuevos. Consola sin errores salvo el 409 provocado.

### Un bug preexistente que la prueba destapó

Al quedar **un solo cobro y en dólares**, la tarjeta grande mostraba **"COBRADO $ 1.200"** —
símbolo de pesos — mientras la fila de abajo decía "US$ 1.200". Cuando `multiMoneda` es `false`,
el total se formateaba siempre como ARS. Mismo defecto en el texto que se comparte por WhatsApp.

No lo introdujo este cambio, pero lo destapó, y es plata mostrada mal en la pantalla donde se
cuenta la plata del día. Se corrigió usando la moneda del único bucket de `porMoneda`
(el dato ya venía del backend). Verificado: ahora dice **"COBRADO US$ 1.200"**.

### Lo que esta verificación NO prueba

El stub imita al backend; **no se ejecutó `POST /pagos/:id/anular` real**. Las guardas del server
(rol, estado `CONCILIADO`, período ya rendido, lock atómico, liberación del `CreditoDetectado`)
están leídas en el código y **no se tocaron**, pero no se corrieron contra la base. Queda para la
prueba de humo posterior al deploy, junto con T-02.
