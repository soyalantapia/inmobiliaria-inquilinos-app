# Deuda histórica cobrable — fix de los P0 del alta de contrato en curso

**Fecha:** 2026-08-03
**Rama:** `fix/deuda-historica-cobrable` (worktree `~/dev/myalq-deudavieja`, base `origin/main` 1ea4c99)
**Origen:** verificación de 15 agentes sobre el requisito de Alan (03/08): *"debería tener el
trackeo de todo el pasado para poder ir a cobrarle"*.

> **Esto NO es el rediseño del wizard por pasos.** Ese vive en `feat/alta-contrato-pasos` y lo
> está trabajando otra sesión en paralelo. Esta rama arregla defectos que ya están en producción
> y sale de `origin/main` para no pisarla. El conflicto en `page.tsx` se resuelve al mergear.

## El requisito

La deuda de los meses anteriores al alta tiene que quedar **declarada, trackeada y cobrable**.
Eso descarta `devengarDesde` ("empezar a cobrar desde este mes") como camino del alta manual:
expresa lo contrario de lo que se necesita.

## Medición en producción (solo SELECT, 03/08)

Cartera chica: **15 contratos, 12 activos**; AyV tiene 7. Arreglar ahora es barato.

| Defecto | ¿Ya mordió en prod? |
|---|---|
| Default `PAGADO` de los períodos | **No.** Los 5 contratos de AyV con historia muestran mezcla deliberada (6/3, 5+1/1, 5/1, 1/3). El operador declaró con cuidado |
| Deuda vieja al canon de hoy | **Sí, con la huella puesta.** Los 8 contratos con historia tienen `COUNT(DISTINCT montoAlquiler) = 1`. `cmrkq7cb` arrancó 2025-10 y tiene 12 liquidaciones a $200.000 |
| `devengarDesde` de la importación masiva | **No.** Cero filas en toda la producción: la importación nunca se usó |
| Ventana `take: 6` que esconde morosos | **No.** Cero contratos afectados hoy |
| Servicios públicos | Cero filas. El modelo, el CRUD y el panel existen y **nadie los usó nunca** |

**Conclusión:** el único que ya pudo dejar datos mal es el canon. Los demás son trampas armadas
que todavía no se dispararon, y por eso conviene desarmarlas ahora y no con la cartera grande.

## Decisiones tomadas (Alan, 03/08)

1. **Los montos históricos existen en el contrato en papel.** Entonces el alta pide un **mini
   historial de canon** (*"desde 2025-10 valía X, desde 2026-04 vale Y"*) y el sistema calcula
   cada mes viejo con su precio real.
2. **La mora de los meses viejos: lo elige la inmobiliaria**, con un interruptor por contrato.

## Diseño

### F1 — Canon por período vía vigencias retroactivas (cierra el P0 vivo)

El mecanismo ya existe y está sano: `canonDelPeriodo` (`apps/api/src/lib/liquidaciones.ts:47`)
sabe retroceder el canon si encuentra vigencias, y `vigenciasFuturas` (`:121`) las arma leyendo
`AjusteAlquiler` y `RenovacionContrato`. El problema es que **en el alta no hay ninguna**: el
contrato se crea en la misma transacción, así que `vigencias` llega `undefined` y todos los meses
toman `montoActual` (`:48`).

- `POST /contratos` acepta `vigenciasCanon?: Array<{ desde: 'YYYY-MM', monto: number }>`.
- Dentro de la transacción y **antes** de `generarLiquidacionesContrato` (`core.ts:1094`), se
  materializan como filas de `AjusteAlquiler` retroactivas. Así `canonDelPeriodo` tiene de dónde
  retroceder y queda **rastro auditable**, que es la razón de elegir este camino y no un monto
  suelto por fila: no crea un cuarto writer de `montoAlquiler` por fuera del mecanismo de
  vigencias (ya hay tres desalineados).
- 🔴 **Validaciones**: las vigencias van ordenadas, sin repetir `desde`, ninguna anterior a
  `fechaInicio`, ninguna posterior al mes en curso, y la última tiene que coincidir con
  `contrato.monto` (si no, el contrato dice una cosa y su historial otra).
- **No se toca `canonDelPeriodo` ni `computarLiquidacionesContrato`.** Están bien.

### F2 — El default deja de regalar la deuda

- `PERIODO_FORM_DEFAULT.estado` deja de ser `'PAGADO'` (`page.tsx:786`). Pasa a un cuarto valor
  **solo del front**, `SIN_DECLARAR`, que **nunca** se manda al backend.
- `pasoPeriodosValido` (`:1283`) exige que los N períodos estén declarados, y el botón muestra
  **el motivo escrito** (*"te faltan 7 meses por declarar"*), no se deshabilita a secas.
- El payload (`:1409`) mapea solo los declarados; si queda alguno sin declarar no se puede avanzar.
- El resumen de confirmación tiene que decir **cuántos meses se cierran como pagados y por cuánta
  plata**: hoy `deudaCapital` ignora los `PAGADO`, así que el número que se confirma es ciego a
  lo que está por asentarse.
- **El backend no se toca.** `aplicarEstadoInicial` está sano: `ADEUDA` no crea `Pago` y la
  liquidación queda `VENCIDO` y exigible.

### F3 — Interruptor de mora por contrato

- Campo nuevo en `Contrato`: `moraHistoricaCongelada Boolean @default(false)`.
- En el alta, un interruptor: *"la mora de los meses viejos sigue corriendo"* (default) vs
  *"queda congelada en el monto que declaro"*.
- Hoy `moraManual` se manda **siempre que el string no esté vacío**, y se prefila solo:
  congela sin que nadie lo elija. Pasa a mandarse **solo si el interruptor está en congelada**.
- `punitorios.ts:102` (`if (manual != null) return`) no se toca: pasa a recibir `null` cuando
  la mora tiene que seguir corriendo, que es justo lo que ese código espera.
- 🔴 `schema.prisma:1623` documenta *"Editable desde el panel"* para `montoPunitorioManual` y
  **es falso, no existe el endpoint**. O se construye el `PATCH`, o se corrige el comentario.
  Esta rama corrige el comentario; el `PATCH` queda anotado.

### F4 — Un solo corte de vencimiento (cierra el 400 que tira el alta entera)

`packages/shared/src/periodos.ts:94` filtra por `venc < now` (instante UTC) y el back valida con
`yaVencio` (día civil AR). En el medio hay una ventana de ~27 h donde el wizard **ofrece** un
período que el back **rechaza** con `EstadoInicialInvalido` → 400 → **rollback del alta entera**.

- `enumerarPeriodosContrato` pasa a usar `yaVencio`, la misma función que el back.
- Test de borde con `now` **dentro** de la ventana.
- ⭑ Esto es casi seguro lo que Camila reportó como *"tenía que cargar todo de vuelta"*: un día
  al mes, cargar un contrato con día de pago reciente falla después de tipear todo.

### F5 — Bug del input de mora (10 minutos)

El input formatea con separadores es-AR y el `onChange` strippea todo lo que no sea dígito, así
que **editar la mora sugerida la multiplica por ~100**.

## Fuera de alcance (anotado, no se hace acá)

- La ventana `take: 6` de `core.ts:83` que esconde morosos con deuda vieja: real, cero contratos
  afectados hoy. Va aparte porque toca todas las pantallas de cobranza.
- `devengarDesde` de la importación masiva: cero filas en prod, nunca se usó. Va aparte.
- El paso de servicios en el alta: `ServicioPublico` ya existe entero (con `nis` obligatorio) y
  no tiene ni una fila cargada. Los presets son GCBA/ARBA/Córdoba y el cliente es **La Rioja**.
- `penalidadRescisionMeses` ya existe en el schema y es columna muerta de escritura: hacerlo
  "por contrato" es sumarla al body del alta. Falta que Alan defina si el valor es porcentaje o
  meses fijos.
- El `deleteMany` de la baja corta por HOY y no por `fechaEfectiva` (`core.ts:1410`), borrando
  la cuota del mes en curso que el inquilino sí debe.

## Testing

- **Unit (shared)**: `enumerarPeriodosContrato` con `now` dentro de la ventana de 27 h devuelve
  lo mismo que el criterio del back. Sin este test el fix F4 no está probado.
- **Integración (back)**: alta con `vigenciasCanon` → cada liquidación vieja tiene **su** canon,
  no el de hoy; vigencias desordenadas / con hueco / cuya última no coincide con `contrato.monto`
  → **400**; alta sin `vigenciasCanon` → idéntico a hoy (no regresión).
- **Integración (back)**: alta con `ADEUDA` → `liquidacion.estado === 'VENCIDO'` y `pago.count === 0`.
  Este test **hoy no existe** y es la garantía de que la deuda declarada es cobrable.
- **Integración (back)**: con el interruptor en "sigue corriendo", `montoPunitorioManual` queda
  `null` y el punitorio crece con los días.
- **E2E**: contrato que arrancó hace 9 meses → no se puede avanzar sin declarar los 9 → se
  declaran 6 pagados y 3 adeudados con dos canones distintos → el contrato nace con 3 meses de
  deuda, cada uno a su precio.
- **No regresión**: la suite de `core` sigue verde. Baseline de typecheck es **0 errores**:
  cualquier error cuenta como regresión.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Materializar `AjusteAlquiler` retroactivos ensucia el historial de ajustes reales | Van marcados como del alta; se revisa que las pantallas de ajustes no los confundan con un ajuste aplicado |
| `SIN_DECLARAR` se escapa al backend | El tipo del payload no lo admite; test de que el body nunca lo lleva |
| Forzar declarar N meses hace el alta más pesada | La cartera de A&B llega a 9 meses. Si molesta, se suman acciones masivas ("todos adeudados", "pagados hasta...") |
| Conflicto con `feat/alta-contrato-pasos`, que toca el mismo `page.tsx` | Rama separada desde `main`, conflicto resuelto al mergear. Los cambios de acá son quirúrgicos y localizados |
