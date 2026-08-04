# Revisar el contrato completo antes de aprobarlo o rechazarlo

**Fecha:** 2026-08-03
**Rama:** `feat/revision-contrato-aprobacion` (worktree `~/dev/myalq-revision`, base `origin/main` = `2e8d4a4`)
**Pedido de Alan:** *"cuando se carga un contrato, actualmente la administración lo aprueba pero
necesitamos que permita revisar el contrato completo, para poder aceptarlo o negarlo, y si lo acepta
o niega que ponga algún comentario."*

## Alcance

**Entra:**
1. La revisión del contrato pendiente se hace **en el detalle del contrato**, no en la bandeja.
2. El detalle muestra **la deuda histórica declarada** (hoy invisible) y **qué va a pasar al aprobar**.
3. Los botones Aprobar / Rechazar del detalle dejan de estar en "Próximamente" y funcionan contra la API.
4. El rechazo deja de borrar la deuda declarada.

**No entra:** corregir un contrato rechazado y volver a mandarlo a aprobación. Es lo que Alan quiere
como comportamiento final, pero acordamos dejarlo para una fase 2 — depende de la edición de contrato,
que también está en "Próximamente". 🔴 **Consecuencia asumida: hoy rechazar sigue matando el contrato.**

## Diagnóstico

### El comentario ya está construido, entero

Contra lo que sugería el pedido, **esta parte no hay que hacerla**:

- `Aprobacion.comentarioAprobador String?` existe en el modelo.
- `POST /aprobaciones/:id/{aprobar,rechazar}` acepta `{ pin?, comentario? }` (`plata.ts:2223`).
- **Rechazar ya lo exige**: `comentario.trim().length >= 5`, si no devuelve 400 (`plata.ts:2230`).
- Aprobar lo ofrece opcional, con `Textarea` en el diálogo de la bandeja.
- La bandeja lo muestra una vez decidido (`bandeja-aprobaciones.tsx:340`).

Lo único que falta del comentario es que los diálogos **del detalle** reusen esas mismas reglas.

### Lo que sí está roto: se aprueba a ciegas

La `Aprobacion` de un contrato se crea así (`core.ts:1067`):

```ts
titulo: `${d.inquilino.nombre} · ${prop.direccion}`,
descripcion: `Contrato cargado para revisión (${d.tipoContrato}).`,
entidadId: contrato.id,
```

`monto` **nunca se setea**. Y `GET /aprobaciones` (`plata.ts:2196`) devuelve la fila cruda, sin ningún
join al contrato. Entonces lo único que ve quien aprueba es: *"Ramiro · Olleros 3920 — Contrato cargado
para revisión (ALQUILER)"*, más quién lo cargó y cuándo. **Ni el monto.**

Con eso hay que decidir sobre un contrato que puede nacer con millones de deuda histórica.

### Y en el detalle los botones son de mentira

`AprobacionContratoCard` (`contratos/[id]/page-client.tsx:1184`, renderizada en `:206` cuando
`c.pendienteAprobacion`) tiene Aprobar y Rechazar con `disabled={apiEnabled}` y `title="Próximamente"`
(`:1284` y `:1292`). O sea: **en producción no funcionan**. Solo andan en la demo, escribiendo en
`localStorage` vía `aprobaciones-storage.ts`.

### El dato más caro es el que no se muestra

El contrato pendiente queda en estado **`BORRADOR`**, y en BORRADOR **no se devengan liquidaciones ni
se reclama la propiedad** (`core.ts:1050`). La deuda histórica declarada en el alta viaja en
`Contrato.periodosAnterioresPendientes` (Json) y **el front no la lee en ningún lado** — cero
referencias en `apps/inmobiliaria`.

Al aprobar, esa deuda se aplica con `aplicarEstadoInicial`
(`apps/api/src/lib/estado-inicial-contrato.ts`), cuya semántica es:

- **PAGADO** → pago **sintético CONCILIADO** por el total (método EFECTIVO, fecha = vencimiento) +
  liquidación PAGADO. La mora queda congelada en 0.
- **PARCIAL** → pago sintético por `montoPagado` + liquidación PARCIAL (+ mora histórica manual).
- **ADEUDA** → sin pago, queda VENCIDO (+ mora manual, que **pisa** el cálculo del esquema).

Aprobar da plata por cobrada. Hoy eso se hace sin verlo.

## Diseño

### 1. Contratos se deciden en el detalle; el resto de la bandeja no se toca

Hay **cuatro** `TipoAprobacion`: `CONTRATO_CARGADO`, `GASTO_CAJA_ELIMINACION`, `DEVOLUCION_DEPOSITO`,
`AJUSTE_FUERA_DE_INDICE`.

- Para **`CONTRATO_CARGADO`**, la tarjeta de la bandeja cambia sus botones por uno solo:
  **"Revisar y decidir"**, que navega a `/contratos/{entidadId}`.
- Los otros tres tipos siguen decidiéndose en la bandeja, exactamente como hoy.

🔴 **Los botones de aprobar/rechazar directos se sacan para contratos, no se dejan al lado.** Si
quedan, se sigue aprobando a ciegas, que es el problema que este trabajo viene a resolver.

### 2. El servidor calcula qué va a pasar al aprobar

`GET /contratos/:id` (`core.ts:182`) suma un campo **solo cuando el contrato está pendiente**:

```ts
revisionAprobacion: {
  aprobacionId: string,          // el id de la Aprobacion PENDIENTE de este contrato
  periodosDeclarados: Array<{
    periodo: string,             // 'YYYY-MM'
    estado: 'PAGADO' | 'PARCIAL' | 'ADEUDA',
    montoPagado?: number,
    moraManual?: number,
  }>,
  alAprobar: {
    cuotasAGenerar: number,
    rangoCuotas: { desde: string, hasta: string } | null,
    conciliado:   { periodos: number, monto: number },
    deudaInicial: { periodos: number, capital: number, mora: number },
  },
}
```

🔴 **Un período `PARCIAL` cuenta en los dos lados, y hay que decirlo así.** `aplicarEstadoInicial`
(`estado-inicial-contrato.ts:90-103`) le crea un pago sintético por `montoPagado` **y** deja la
liquidación en estado PARCIAL: lo pagado queda conciliado y el resto sigue siendo deuda. Entonces:

- `conciliado.monto` = suma de los totales de los **PAGADO** + los `montoPagado` de los **PARCIAL**.
- `deudaInicial.capital` = suma de los totales de los **ADEUDA** + el **remanente** de los PARCIAL.
- `conciliado.periodos` y `deudaInicial.periodos` **se solapan** en los PARCIAL. La pantalla no debe
  presentarlos como si fueran conjuntos disjuntos ni sumarlos para dar un total de períodos.
- `deudaInicial.mora` sale de `moraManual` cuando vino, que **pisa** el cálculo del esquema.

🔴 **`aprobacionId` es imprescindible**: el endpoint de decisión es `POST /aprobaciones/:id/...` y pide
el id de la **Aprobación**, no el del contrato. Hoy `AprobacionContratoCard` solo recibe `contratoId`,
así que sin este campo el botón no tiene a qué pegarle.

🔴 **El preview se calcula en el servidor, con las mismas funciones que ejecuta al aprobar**:
`enumerarPeriodosContrato` (`packages/shared/src/periodos.ts`) para las cuotas, y la misma clasificación
que usa `aplicarEstadoInicial` para los montos. **No reimplementar la aritmética en el front.** Si el
número que se muestra y el que se ejecuta salen de dos lugares distintos, divergen — es exactamente el
bug de `propietarios[0]` que acabamos de arreglar en el alta.

Cuando el contrato no está pendiente, el campo **no viaja** (no es `null`: no está).

### 3. La tarjeta del detalle

`AprobacionContratoCard` pasa a recibir `revisionAprobacion` y muestra, además de lo que ya muestra:

**Los períodos declarados**, uno por uno, con su estado y su monto. Es lo que la inmobiliaria afirmó
sobre el pasado del contrato.

**Qué va a pasar al aprobar**, con las consecuencias en plata separadas del resto:

- La propiedad pasa a ALQUILADA.
- Se generan N cuotas (rango).
- 🔴 **Se dan por pagados $X, conciliados** — resaltado, porque es plata que el sistema va a dar por
  cobrada sin que nadie la haya transferido.
- Nace una deuda de $Y de capital + $Z de mora.
- ⚠️ Un período PARCIAL aporta a las dos cifras. El copy tiene que hablar de **plata**, no de "N
  períodos acá y M allá", para no dar a entender que son grupos separados.

**Los botones**: `disabled={apiEnabled}` se va. Aprobar abre un diálogo con comentario **opcional**;
Rechazar abre uno con motivo **obligatorio**, mismo mínimo de 5 caracteres que ya valida el servidor.
Ambos pegan a `POST /aprobaciones/{aprobacionId}/{aprobar|rechazar}` e invalidan las queries del
contrato y de la bandeja.

El copy de la demo (`aprobaciones-storage.ts`) se mantiene para el modo sin API, sin tocar.

### 4. Rechazar deja de borrar la deuda declarada

Hoy el rechazo escribe `periodosAnterioresPendientes: Prisma.DbNull` (`plata.ts:~2270`). Se saca esa
línea: el dato queda guardado para la fase 2 (corregir y reenviar).

🔴 **Guard obligatorio**: que el dato siga ahí no puede permitir que un contrato rechazado aplique esos
períodos por ningún camino. La aplicación ya está gateada por `estado: 'PENDIENTE'` en el `updateMany`
de la `Aprobacion`, pero hay que **verificarlo con un test explícito**, no asumirlo: rechazar y después
intentar aprobar la misma aprobación no debe generar ni una liquidación.

## Testing

- **Integración — el preview no miente** (el test que importa): crear un contrato pendiente con
  períodos anteriores mezclados (PAGADO / PARCIAL / ADEUDA), leer `revisionAprobacion.alAprobar`,
  aprobar, y **comparar el preview contra lo que efectivamente quedó**: cantidad de liquidaciones,
  monto conciliado y deuda. Si divergen, el test falla. Es la única defensa real contra que la pantalla
  anuncie una cosa y el sistema haga otra.
- **Integración — `aprobacionId`**: el contrato pendiente lo expone y apunta a la `Aprobacion` en estado
  `PENDIENTE` de ese contrato; un contrato ya activo **no** trae `revisionAprobacion`.
- **Integración — rechazo**: sin comentario → 400 (no regresión); con comentario → `RECHAZADA`,
  contrato en BORRADOR, **y `periodosAnterioresPendientes` intacto**. Después del rechazo, aprobar esa
  misma aprobación no genera ninguna liquidación.
- **No regresión**: aprobar desde el detalle produce exactamente el mismo resultado que la bandeja
  produce hoy (contrato ACTIVO, propiedad ALQUILADA, liquidaciones y pagos sintéticos idénticos). La
  suite de `core` y `plata` sigue verde.
- **Navegador**: cargar un contrato con el flag prendido y períodos anteriores → entrar como ADMIN al
  detalle → ver los períodos y el preview → aprobar con comentario → el contrato queda ACTIVO y el
  comentario se ve en la bandeja. Y el camino del rechazo, con el motivo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| 🔴 El flag `contratosRequierenAprobacion` está **PRENDIDO en producción para AyV** desde el 30/07: una regresión pega en un cliente real | El camino de aprobación no se reescribe, solo se le agrega una entrada desde el detalle. El test de no regresión compara contra el resultado actual |
| El preview anuncia una cosa y el sistema hace otra | Se calcula con las mismas funciones que ejecutan, y hay un test que compara preview contra resultado real |
| Sacar los botones de la bandeja cambia un flujo que alguien ya usa | El botón que queda dice **"Revisar y decidir"**, no desaparece la acción. Solo aplica a contratos |
| Conservar la deuda declarada tras el rechazo la deja aplicable por algún camino | Test explícito: rechazar y luego aprobar no genera nada |
| Conflicto con el PR #39 (alta en pasos), que toca `core.ts` sin mergear | Áreas distintas de `core.ts` (`GET /contratos/:id` vs. `POST /contratos` y el wizard). Si #39 mergea primero, rebasar |

## Fuera de alcance (explícito)

- Corregir y reenviar un contrato rechazado → fase 2. **Hasta entonces, rechazar mata el contrato.**
- La edición de contrato (`Editar`, también en "Próximamente").
- Los otros tres tipos de aprobación: siguen decidiéndose en la bandeja, sin cambios.
- El PIN: `verificarPin` devuelve `{ ok: true }` incondicional desde que se eliminó de la plataforma.
  No se revive ni se le agrega copy que lo prometa.
