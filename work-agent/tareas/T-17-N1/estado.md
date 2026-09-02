# T-17-N1 · Destinatario configurable por tipo de aviso

- **fase:** 8 (cerrada)
- **commit:** `de64f5b` · rama `feat/T-17-N1-destinatario-por-aviso`
- **decisión del dueño:** casilla por TIPO de aviso (de las tres opciones que le presenté)

## El problema

Todos los avisos automáticos iban a `Inmobiliaria.email`, una sola casilla. Camila, con 220
propiedades: *"me va a llegar un mail por cada reclamo… y todos van a mi misma casilla, no a la
de la chica que los maneja."* Su bandeja se llena de avisos que ella no va a accionar, y quien
tiene que accionarlos no se entera.

## Hecho

Modelo `DestinatarioAviso` (`inmobiliariaId` + `tipo`, único) con enum `TipoAvisoInmo`,
endpoints `GET`/`PUT /mi-inmobiliaria/avisos` (sólo ADMIN, como las otras secciones de
configuración) y una card en Mi Inmobiliaria.

## Las dos decisiones que tomé, y por qué

**1. La ausencia de fila significa "usá `Inmobiliaria.email`".** Es lo que hace esto deployable
sin tocar los datos de nadie: la tabla nace vacía y hasta que alguien configure una casilla no
cambia absolutamente nada. Vaciar el campo **borra** la fila en vez de guardar `''` — un vacío
guardado sería una fila que no configura nada y confundiría al próximo. 6 tests puros fijan eso,
verificados en rojo sacándole el fallback.

**2. El enum arranca con UN solo valor.** `RECLAMO_NUEVO` es hoy el único aviso por mail que el
sistema le manda a la inmobiliaria (`avisos-reclamo.ts` — lo verifiqué recorriendo las 10
funciones del mailer). Listar tipos que todavía no mandan nada sería ofrecer una configuración
que no hace nada: **el mismo patrón de promesa vacía que este proyecto viene sacando de todas
las pantallas** (T-18, T-18-N2, T-21-N3-N1-N1). Cuando se agregue un aviso nuevo se agrega su
valor al enum y una entrada al catálogo, y el panel lo muestra solo — el catálogo con su copy
vive en el server (`TIPOS_AVISO_INMO`), no duplicado en el front.

## ⚠️ Necesita tu mano

**Aplicar `20260819180000_destinatario_por_aviso`, ANTES del código.** El aviso de reclamo
consulta esta tabla y, como es best-effort, si el código sale primero el mail se perdería **en
silencio**. Es `CREATE TYPE` + `CREATE TABLE`: no toca ninguna fila existente y es reversible.

## Verificación

`tsc` 0 en `apps/api` y `apps/inmobiliaria` después del merge; **303 tests puros en verde** (31
archivos); lint sin warnings nuevos.

**No probado en el navegador:** el clasificador de seguridad de la sesión bloquea el preview
desde hace varias tareas. La card nueva está cubierta por typecheck y lint, pero no la vi
renderizada — y acá pesa, porque es una pantalla nueva con un input y un botón de guardar.

## Lo que NO entra

El **digest** (un resumen diario en vez de un mail por evento) era una de las tres opciones y no
se eligió. Si con el tiempo el volumen sigue molestando aun con las casillas separadas, es la
continuación natural.
