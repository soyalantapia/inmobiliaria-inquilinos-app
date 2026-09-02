# T-24-N2-N1 · El DNI se guarda sin normalizar

- **fase:** 8 (cerrada)
- **commit:** `ffaf8ab` · rama `feat/T-24-N2-N1-dni-normalizado`

## Lo verificado (las tres afirmaciones del doc eran correctas)

- `persona.ts` — `buscarOCrearPersona` hacía `(d.dni ?? '').trim()` y después `findUnique`
  exacto. **El email de esa misma función SÍ se normalizaba** (`.trim().toLowerCase()`), o sea
  que el criterio estaba entendido y el DNI se había quedado afuera — justo el que tiene
  prioridad en la dedup.
- `importacion-cartera.ts` — `texto()` es `String(v).trim()`, y la columna acepta
  `dni`/`documento`/`cuit`/`cuil` como sinónimos: llega de todas las formas.
- `/personas?q=` — `{ dni: { contains: q } }` con `q` crudo.

## Hecho

`apps/api/src/lib/normalizar-dni.ts` (gemelo de `normalizar-email.ts`, de T-23-N2), aplicado en
los **tres** lugares: la dedup, la importación y el buscador. El buscador consulta las **dos**
formas —cruda y normalizada— porque hasta que corra el backfill conviven fichas viejas con
puntos.

**Tests primero**, como pedía la tarea: 6 casos puros, verificados en rojo sacándole el
`replace`. La tarea avisaba que no había ningún test sobre `buscarOCrearPersona`; sigue sin
haberlo (pide DB), pero la regla que rompía ahora sí está cubierta.

## Lo que NO hace, a propósito

**No recorta un CUIT a su DNI.** La columna acepta `cuit`/`cuil` como sinónimos, así que
conviven `20123456` y `20123456789`. Recortarlo sería adivinar —el prefijo depende del género y
el verificador del cálculo— y un recorte mal hecho **fusionaría dos personas distintas bajo una
sola ficha**, que es peor que el problema original. Es decisión de producto.

## ⚠️ Necesita tu mano

**Aplicar `20260819160000_dni_persona_solo_digitos`.** Tiene una trampa, y está resuelta: si en
una misma inmobiliaria conviven `20.123.456` y `20123456` como dos fichas distintas, normalizar
las vuelve idénticas y el UPDATE chocaría contra `@@unique([inmobiliariaId, dni])`.

El UPDATE **se saltea esos casos a propósito**: son dos fichas de la misma persona que hay que
**fusionar** —decidir cuál queda y mover sus contratos, pagos e historial— y eso no lo puede
decidir una migración. El encabezado del `.sql` trae dos consultas de solo lectura: una dice a
cuántas afecta, la otra **lista los duplicados que quedan pendientes de fusión a mano**.

El orden respecto del deploy da igual: el código nuevo anda con la base sin migrar (sólo que
las fichas viejas siguen sin matchear) y la base migrada anda con el código viejo.

## Verificado

`tsc` 0 en `apps/api`; **215 tests puros en verde** (22 archivos), 6 nuevos comprobados en rojo.

**No probado en el navegador**: el clasificador de seguridad de la sesión sigue bloqueando el
preview. El cambio es de backend puro, así que lo que había para verificar a mano era el cartel
"ya está en tu cartera" del diálogo — eso queda sin probar.
