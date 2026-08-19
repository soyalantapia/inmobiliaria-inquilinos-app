# T-23-N3-N2 · Gastos, reclamos e ingresos se arrastran hacia atrás sin piso

- **fase:** 8 (cerrada)
- **resultado:** ⛔ **La tarea está mal diagnosticada. No se cambió código de plata.**

## Qué decía la tarea

Que los tres descuentos de la rendición filtran con `fecha: { lt: finPeriodo }` **sin `gte`**, y
que por eso *"un gasto de 2024 se le descuenta al dueño que rinde en 2026"*. Proponía definir un
piso y aplicarlo a los tres.

## Qué encontré al abrir los archivos

**La ausencia del `gte` es deliberada, está documentada en los tres, y el anti-doble no es la
fecha: es un flag.** Poner un piso reintroduciría los bugs que esos comentarios describen.

### 1. Gastos de caja (`plata.ts:1786`)

El `where` incluye **`descontadoEnRendicion: false`**, y arriba del filtro de fecha está escrito:

> *"CARRY-OVER: todo gasto pendiente ANTERIOR al fin del período, no sólo los del mes. Con la
> ventana estricta (`gte: inicioPeriodo`), un gasto cargado tarde —o de un mes ya rendido—
> quedaba huérfano para siempre: rendir ese período de nuevo daba 409 'sin cobros nuevos' y el
> período siguiente ya no lo miraba, así que la inmobiliaria nunca lo recuperaba del dueño.
> **El anti-doble no es la fecha sino `descontadoEnRendicion`.**"*

O sea: el piso que la tarea propone **ya existió y se sacó a propósito**.

### 2. Reclamos (`plata.ts:1877`)

No tiene flag —un reclamo no tiene estado terminal— así que usa **dos topes** sobre el ledger
`GastoRendido`:
- `míoReclamoMap` — lo que **este** dueño ya tiene rendido de ese reclamo;
- `rendidoReclamoMap` → **`restanteGlobal = total − ya rendido por TODOS`** (`:1918`).

Y la parte se calcula `Math.max(0, Math.min(leToca − loMío, restanteGlobal))`. Un reclamo **no
puede cobrarse más que su costo total**, sumando todos los dueños y todas las rendiciones.

El comentario de `:1897-1904` que la tarea cita como *"mitigación que no cubre el arrastre"* es
justamente **este tope global**, y sí lo cubre: es lo que impide que el dueño entrante se coma
un arreglo que el saliente ya pagó.

### 3. Ingresos extra (`plata.ts:1952`)

Mismo esquema que los gastos: `descontadoEnRendicion: false` + tope por dueño + tope global. Y
el comentario dice explícitamente *"El anti-doble sigue siendo `descontadoEnRendicion`, no la
fecha"*. Acá además el carry-over protege al **propietario**: es plata suya que sin arrastre
nunca se le rendiría.

## Por qué el diagnóstico se equivocó, y por qué es fácil equivocarse

Leyendo sólo el filtro de fecha, la conclusión es correcta. El anti-doble está **en otras tres
líneas del mismo `where`** y en la aritmética de los topes, treinta líneas más abajo. Es un caso
donde el código es correcto pero no se defiende solo de una lectura parcial.

## Lo que SÍ queda, y ya tiene tarea

El único caso real que sobrevive: un gasto **anterior a que la persona fuera dueña**, nunca
rendido, se le cobra a ella. Eso no es el arrastre — es que **no existe el dato de desde cuándo
alguien es dueño**: `ParticipacionPropietario` no tiene `desde`/`hasta`.

Es exactamente **T-23-N3**, y su continuación **T-23-N3-N1 está BLOQUEADA por una decisión de
producto**. Ponerle un piso por fecha acá sería tapar ese agujero con un mecanismo equivocado, y
de paso romper el carry-over.

## Lo que NO hice, y por qué

- **No toqué el código de plata.** El cambio que pedía la tarea es una regresión.
- **No agregué un test puro del invariante.** Está cubierto por tres tests de integración
  (`rendicion-multiowner`, `rendicion-reclamo-multiduenio`, `imputar-reclamo-ya-rendido`) que
  **no pude correr**: usan `seedBase` y pegan a la Postgres de producción (regla 3). Hacerlo
  puro exigiría extraer la aritmética de los topes, que hoy vive inline en el handler — es un
  refactor de código de plata sin cambio funcional, y le corresponde a **T-28**.

## Verificación

Lectura línea por línea de los tres bloques (`plata.ts:1776-1975`) más un relevamiento
adversarial en paralelo con tres lentes (los filtros, la semántica del período, y el riesgo de
poner un piso). Ningún cambio de código, así que no hay `tsc` ni tests que reportar.

---

## ⚠️ ADDENDUM — el relevamiento adversarial encontró DOS bugs de plata reales

La tarea estaba mal diagnosticada, pero al trazar los tres descuentos aparecieron dos agujeros
que **sí existen**, verificados por mí leyendo el código. Arreglados en `704f37f`.

### 1. 🔴 Ingresos extra sin tope GLOBAL (`plata.ts`)

Sólo tenía el cap por dueño. Los otros dos descuentos sí tenían `restanteGlobal`; el espejo
nunca se aplicó acá.

**El caso:** ingreso de $100 en una propiedad de A(50%) y B(50%). A rinde → $50. Se re-arma la
participación, B pasa a 100%, rinde → $100. **$150 acreditados sobre $100 que entraron.** Es
plata que sale de la caja de la inmobiliaria. Y el movimiento queda marcado como cubierto
(50+100 ≥ 100), así que el caso **se cierra solo** y no vuelve a aparecer para auditarlo.

### 2. 🔴 Reclamos sin filtro de moneda (`plata.ts`)

Los otros dos filtran `moneda: monedaRendicion`, con el comentario *"un gasto en pesos no puede
restarse del neto de una rendición en dólares"*. `Reclamo` no tiene columna de moneda
—`costoTrabajo` es un Decimal pelado— y la query los trae **por propiedad y sin piso de fecha**,
así que un reclamo de un contrato anterior en otra moneda entraba igual.

En un sentido: restaba US$350.000 de un neto en dólares → el dueño no podía cobrar su rendición,
con un 409 de neto negativo que **encima lo manda a revisar gastos de caja que no son el
problema**. En el otro: un arreglo de US$800 se restaba como $800 y la inmobiliaria se lo comía.

Ahora la moneda sale del contrato, que es de donde la toma la imputación al inquilino.

### La raíz, y lo que se hizo con ella

Los dos bugs existen **porque los tres bloques hacían la misma cuenta copiada y se fueron
separando**: a uno le faltó un tope, a otro un filtro. La aritmética de los dos topes vive ahora
en `lib/parte-rendible.ts`, con **10 tests puros** verificados en rojo sacándole el tope global,
y los tres call sites la usan. Los tests que cubrían este invariante eran de integración y pegan
a la Postgres de producción; éstos corren siempre.

**Verificado:** `tsc` 0, **245 tests puros en verde** (25 archivos) después del merge.

**Sin verificar:** el comportamiento end-to-end de la rendición. Los tests que lo cubren
(`rendicion-multiowner`, `rendicion-reclamo-multiduenio`) necesitan la DB. El refactor no cambia
la fórmula —es la misma cuenta, en un solo lugar— pero eso está afirmado por lectura y typecheck,
no por ejecución.

### Datos ya existentes

Si algún ingreso extra se acreditó de más en producción,
el rastro está en `IngresoRendido`. La consulta quedó escrita:
**`work-agent/tareas/T-23-N3-N2/diagnostico-ingresos-acreditados-de-mas.sql`** (solo lectura, 3 consultas: los acreditados de más con su monto, el detalle de a quién se le acreditó cada parte, y el espejo de los acreditados de menos, donde el perjudicado es el propietario).
