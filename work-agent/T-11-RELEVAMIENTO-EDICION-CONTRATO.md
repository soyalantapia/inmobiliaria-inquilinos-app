# T-11 · Qué se puede editar hoy de un contrato con pagos

> **El paso 1 de la tarea era relevar. Esto es el relevamiento, y cambia la tarea.**
>
> **Lo que Camila pidió explícitamente YA FUNCIONA.** El problema que ella describe es real,
> pero su causa es otra.

---

## Lo que dijo

- `[53:50]` *"¿Deja editar y modificar los contratos una vez que ya tienen pagos cargados?"*
- `[55:30]` *"Que se pueda editar siempre, pero solamente la administradora."*
- `[56:28]` *"Puedo editar el número de teléfono del inquilino, cambiar el garante, porque eso
  por ley también se puede."*
- `[56:55]` (acordado con Alan) la **fecha de vigencia NO** debería poder editarse.

Y su motivo, que es el que importa `[54:22]`: hoy, en su sistema, para corregir un dato tiene que
**rescindir el contrato** — *"y me sale rescisión del contrato en el sistema porque me
equivoqué… la rescisión siempre tiene un costo"*. La falta de edición le está ensuciando el
historial con rescisiones falsas.

---

## La tabla, campo por campo

| Campo | ¿Se puede editar? | Por dónde | ¿Lo bloquea tener pagos? | Rol |
|---|---|---|---|---|
| **Teléfono / contacto del inquilino** | ✅ **SÍ** | `PATCH /contratos/:id/inquilino-contacto` (`core.ts:3195`) — cableado en el panel (`contratos/[id]/page-client.tsx:1186`) | **No** | ADMIN / OPERADOR |
| **Garantes** (alta, edición, baja) | ✅ **SÍ** | `POST/PUT/DELETE /contratos/:id/garantes` (`core.ts:2098-2116`) — cableado vía `useGarantes` (`use-garantes.ts:62-78`), pestaña "Garantes" | **No** | ADMIN / OPERADOR |
| **Monto del alquiler** | ✅ SÍ | `PATCH /contratos/:id/monto` (`core.ts:2918`) y `POST /contratos/:id/ajustar` (`:1749`) | No | ADMIN / OPERADOR (CARGA bloqueado) |
| **Esquema de mora** | ✅ SÍ | `PUT /contratos/:id/mora` (`core.ts:1338`) | No | ADMIN / OPERADOR (CARGA bloqueado) |
| **Modo de cobranza** | ✅ SÍ | `PATCH /contratos/:id/modo-cobranza` (`core.ts:3074`) | **Sí, y a propósito**: 409 si hay alquiler cobrado sin rendir | ADMIN / OPERADOR (CARGA bloqueado) |
| **Documentos del contrato** | ✅ SÍ | `POST/DELETE /contratos/:id/documentos` | No | ADMIN / OPERADOR |
| **Co-inquilinos** | ✅ SÍ | `POST/DELETE /contratos/:contratoId/co-inquilinos` | No | ADMIN / OPERADOR |
| **Fecha de fin** | ⚠️ sólo renovando | `POST /contratos/:id/renovar` (`core.ts:1837`, escribe `fechaFin` en `:1879`) | No | ADMIN / OPERADOR |
| **Día de pago** | ⚠️ sólo renovando | ídem (`core.ts:1879`, opcional) | No | ídem |
| **Monto de expensas** | ❌ **NO** | — | — | — |
| **Depósito de garantía** | ❌ **NO** | — | — | — |
| **Fecha de inicio** | ❌ NO | — | — | — |
| **Tipo de contrato** (alquiler / expensas) | ❌ NO | — | — | — |
| **Moneda** | ❌ NO | — | — | — |
| **Propiedad** | ❌ NO | — | — | — |

---

## Las tres conclusiones

### 1 · Lo que ella nombró ya se puede hacer

**Teléfono del inquilino y garantes: los dos están, cableados en el panel, y ningún pago los
bloquea.** Si Camila cree que no se puede, hay tres explicaciones posibles y hay que averiguar
cuál es antes de escribir una línea:

- **no encontró dónde** (el contacto se edita desde el detalle del contrato; los garantes están
  en una pestaña) — sería el mismo patrón que ya nos pasó dos veces: la capacidad existe y no se
  encuentra (el botón "Cargar inquilino" muerto, y "anular pago" que ella buscó en caja);
- **lo probó con un rol que no era ADMIN ni OPERADOR** — con CARGA algunos tiran 403;
- **lo probó antes de que estuviera** — varias de estas rutas son recientes.

**Esto se resuelve preguntándole a ella, no leyendo código.** Es la única pregunta abierta de la
tarea.

### 2 · El límite que ella misma puso ya se respeta

La **fecha de vigencia** no se puede editar sueltamente: `fechaFin` sólo se mueve renovando, y
`fechaInicio` no se mueve nunca. Es exactamente lo que se acordó en la reunión.

### 3 · Los huecos reales son otros, y ella no los nombró

**`montoExpensas` y `depositoGarantia` no tienen ningún camino de edición.** Son dos campos que
se cargan en el alta y quedan congelados para siempre.

Y son justamente **los dos que más se prestan a un error de tipeo al cargar**: un cero de más en
las expensas o en el depósito. Hoy la única salida para corregirlos es dar de baja el contrato y
cargarlo de nuevo — **que es literalmente la rescisión falsa de la que ella se queja.**

Mi lectura: **acá está el problema real que ella describió**, aunque haya nombrado otros campos.

---

## Qué haría, y qué decide el owner

**Sin necesidad de decisión** (bajo riesgo, cierra el hueco real):

1. Agregar edición de **`montoExpensas`** y **`depositoGarantia`**, con capacidad de ADMIN y
   registro en auditoría.
   ⚠️ **Ojo con las expensas**: cambiarlas tiene que recalcular las liquidaciones **futuras**, no
   las ya devengadas ni las cobradas. Ya existe `recomputarLiquidacionesFuturas`
   (`lib/liquidaciones.ts`, importado en `core.ts`) que hace exactamente eso para el monto —
   hay que reusarlo, no escribir otro.
   ⚠️ **Y con el depósito**: si el contrato ya está finalizado y el depósito resuelto, no se
   toca.

**Necesita decisión del owner:**

2. ¿La edición es de **ADMIN solamente**, como pidió Camila (*"solamente la administradora"*), o
   también OPERADOR? Hoy casi todas estas rutas son ADMIN **u** OPERADOR. Restringirlas a ADMIN
   es lo que ella pidió, pero **le saca capacidades a sus dos operadoras** — el mismo tipo de
   cambio que ya hicimos con `pago.conciliar`, y que hay que avisarle antes.

3. ¿`fechaInicio`, `tipoContrato` y `moneda` se dejan sin editar para siempre? Yo diría que sí:
   los tres cambian la plata ya devengada de forma que no se puede recalcular sin ambigüedad, y
   corregir un error ahí es más honesto rehaciendo el contrato.

---

## Qué NO se hizo, y por qué

Ningún cambio de código. La tarea decía "relevar → decidir con PROD → implementar", y el
relevamiento **cambió el diagnóstico**: lo que se iba a construir ya existe, y lo que falta es
otra cosa. Implementar sobre el diagnóstico viejo habría sido trabajo tirado.
