# T-21-N3-N2 · `POST /screening` fabricaba informes crediticios sobre personas reales

- **fase:** 8 (cerrada)
- **commit:** `791a232` · rama `fix/T-21-N3-N2-screening-501`

## Lo verificado

Las tres afirmaciones de la tarea eran correctas:

- El informe entero salía de un PRNG FNV-1a sembrado con los dígitos del CUIT.
- **Cero llamadas** a Nosis, BCRA, RENAPER, ARCA o Veraz. Los únicos `fetch()` salientes de toda
  la API van al bug tracker (`sonar-server-events.ts`, `sonar.ts`).
- Se persistía con `estado: 'COMPLETO'` sobre una persona real identificada por CUIT y nombre, y
  se devolvía 201.

Lo único que lo contenía era que ningún front lo llama y que la pantalla está gateada en
producción (`screening/page.tsx:138` muestra un aviso de beta si `apiEnabled`). Eso no es un
control: el endpoint estaba **vivo y autenticado**.

## Hecho

`POST /screening` devuelve **501** con `codigo: 'SCREENING_SIN_FUENTE'`.

**501 y no 404, a propósito:** el endpoint existe y está previsto; lo que falta es la
integración. Un 404 mentiría en la otra dirección y haría que alguien lo reimplemente creyendo
que nunca estuvo.

**Se borró el generador entero** (~270 líneas: el PRNG, sus helpers y las tablas de nombres,
bancos, calles y empleadores). Dejarlo dormido con el endpoint apagado era un arma cargada —
alcanzaba con volver a llamarlo. La forma que el proveedor real tiene que llenar ya la define el
modelo `Screening`, y el código está en el historial de git.

**Las lecturas NO se tocaron.** Si hay filas fabricadas, el dueño tiene que poder verlas para
decidir qué hace con ellas; bloquear el `GET` escondería el problema.

## ⚠️ Necesita tu mano

**Correr `work-agent/tareas/T-21-N3-N2/diagnostico-screenings-fabricados.sql`** (solo lectura).
Toda fila de esa tabla es, por construcción, un informe inventado sobre una persona con nombre y
apellido. La consulta dice cuántos hay, **sobre quiénes**, y —lo más importante— **cuáles
terminaron ligados a un contrato**, o sea cuáles se usaron de verdad para decidir un alquiler.

Qué hacer con lo que aparezca es tuyo, y el `.sql` explica las dos cosas a mirar antes de
borrar. **No es urgente en el sentido de "se sigue rompiendo"**: con el 501 no se fabrica ninguno
nuevo. Lo que queda es qué se hace con lo que ya está.

## Verificación

`tsc` 0 en `apps/api`; **285 tests puros en verde** (29 archivos) después del merge. Ningún front
llama a este endpoint —lo confirmé grepeando los tres— así que no hay superficie que se rompa.

**No probado en el navegador:** el clasificador de seguridad de la sesión sigue bloqueando el
preview. De todos modos la pantalla del panel no llega a este endpoint en producción: corta antes
con el aviso de beta.

## Lo que NO entra acá

El **modo demo** del panel sigue corriendo una muestra local si le tipeás un CUIT. Está fuera de
alcance de esta tarea y ya tiene la suya: **T-21-N3-N3** (la landing y el demo público venden IA
que no existe).
