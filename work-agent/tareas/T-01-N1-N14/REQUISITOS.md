# T-01-N1-N14 · El invariante de plata más frágil estaba escrito cuatro veces

**Prioridad:** 🟠 · **Experto:** BE
**Origen:** `work-agent/tareas/_integracion/invariantes-plata.md`, que dice textual:
*"Nada se ejecutó: es código leído, no corrido."*

---

## El punto de partida

Ese documento verifica cinco invariantes de plata **leyendo el código**. El #1 —el que él mismo
llama el más frágil— dice:

> *"El prorrateo de parciales está espejado en TRES lugares y los tres coinciden. Es el más
> frágil: si una rama tocaba uno y no los otros, la plata dejaba de cerrar."*

Y lista tres archivos de `apps/api`.

**Eran cuatro, y el cuarto había derivado.** El KPI del panel
(`apps/inmobiliaria/src/lib/api/hooks.ts`) prorrateaba contra un `montoTotal` que **ya traía la
mora sumada**, así que le mostraba a la inmobiliaria **menos alquiler cobrado del que la
rendición efectivamente iba a pagar** — con mora, 45,45 donde se pagaban 50. Se arregló en
T-01-N1-N5, pero el episodio es el punto: **una lista escrita a mano de "dónde vive esta regla"
se queda corta, y nadie se entera hasta que la plata no cierra.**

## Lo que se hizo

**Una sola implementación, en `packages/shared/src/prorrateo.ts`.** Los cuatro lugares la
consumen:

| dónde | qué hacía |
|---|---|
| `api/lib/cierre-caja.ts` | el arqueo diario de la cajera |
| `api/lib/rendicion-pendiente.ts` | el guard de "plata cobrada sin rendir" |
| `api/routes/plata.ts` (rendición) | **el único donde esa cuenta mueve plata de verdad** |
| `inmobiliaria/src/lib/alquiler-cobrado.ts` | el KPI del panel (pasa a re-exportar) |

`packages/shared` es donde puede vivir porque **tanto `apps/api` como `apps/inmobiliaria`
dependen de él** (`inquilino` y `propietario` no, y tampoco calculan esto).

**Antes de unificar se verificó que las cuatro fueran la MISMA función**, no cuatro reglas
parecidas — es código de plata y unificar dos cosas distintas sería peor que dejarlas separadas.
Lo son, con una diferencia: la del panel tenía un guard extra (`cobradoCapeado <= 0 → 0`) que es
**estrictamente más seguro**, y es el que quedó en la versión compartida.

**Y un guard contra la quinta copia:** `test/prorrateo-sin-copias.test.ts` barre los cuatro
paquetes buscando el esqueleto de la fórmula —un `Math.min(...)` multiplicado por una división,
en una línea que hable de alquiler— y falla si aparece fuera de `shared`. Matchea aunque cambien
los nombres de las variables, que es justo lo que pasó con las cuatro copias.

## Lo que NO se hizo

- **No se tocaron los otros invariantes.** El #2 (comisión sobre alquiler) se desprende de éste,
  así que queda cubierto de rebote. Los #3, #4, #5 y #6 siguen verificados sólo por lectura.
- **No se movió nada a `shared` para `inquilino` ni `propietario`**: no dependen de ese paquete y
  agregarles la dependencia toca el lockfile, que están usando varios chats.

## Cómo se verificó

- Las cuatro implementaciones, leídas y comparadas línea por línea antes de tocar.
- 6 tests puros nuevos, y el guard **comprobado reintroduciendo una copia**: señala
  `cierre-caja.ts:136`.
- `tsc` 0 en `apps/api` y `apps/inmobiliaria`.
- **La suite de integración completa contra una Postgres creada desde cero** — que es lo que
  prueba que la unificación no movió un centavo, y lo que hace que este refactor sea seguro hoy
  y no lo hubiera sido la semana pasada.
