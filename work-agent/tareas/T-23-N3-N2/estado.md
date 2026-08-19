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
