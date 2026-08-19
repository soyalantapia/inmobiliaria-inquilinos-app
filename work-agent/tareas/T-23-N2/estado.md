# T-23-N2 · `Propietario.email` es una credencial que nadie verifica

- **fase:** 8 (cerrada)
- **commit:** `1cdaf38` · rama `feat/T-23-N2-email-credencial`

## Lo que encontré al abrir la tarea

La tarea planteaba un riesgo de seguridad. Adentro había además **un bug que rompía el portal
entero**: `Propietario.email` se guardaba tal cual lo tipea el operador (`email: d.email ?? ''`)
mientras el login busca en minúsculas. Postgres compara distinguiendo mayúsculas → un
propietario cargado como `Juan.Perez@Gmail.com` **no podía entrar nunca**.

Y el fallo es mudo: pide el código, el endpoint responde `ok` —no revela si el email existe, a
propósito— y el código no llega jamás. Del otro lado se ve como "el portal no anda". O sea que
lo que entregué en T-23 no funcionaba para buena parte de la cartera ya cargada.

Los otros dos logins por OTP ya habían aprendido esto **cada uno por su cuenta**: `Usuario`
normaliza en el registro e `Inquilino` en el alta, con el comentario *"Normalizado a minúsculas:
el login por OTP busca el email en minúsculas"*. `Propietario` era el único que faltaba, porque
hasta T-23 no era una puerta de entrada.

## Hecho

- La regla vive ahora en **un solo lugar**: `apps/api/src/lib/normalizar-email.ts`, con 5 tests
  puros verificados **en rojo** sacándole el `toLowerCase`.
- Aplicada en las dos escrituras (`POST` y `PUT /propietarios`).
- **Migración de backfill escrita y SIN APLICAR** para lo que ya está cargado.
- `carteras` ahora trae el **nombre** de cada ficha, y se agregó el **selector de cartera** que
  faltaba: sin él, quien administra con dos inmobiliarias entraba a una y no tenía forma de
  llegar a la otra ni de saber que existía.

## La decisión que la tarea pedía tomar

La tarea planteaba tres salidas: verificar el email, hacerlo único por tenant, o las dos.

**El único por tenant se descartó, con motivo:** dos propietarios de la misma inmobiliaria
pueden compartir email legítimamente —un matrimonio, el contador de varios dueños— así que
romperia datos reales. Y no cierra el problema de fondo, que es **entre** tenants: un
`@@unique([inmobiliariaId, email])` no impide que el mismo string aparezca en dos carteras de
inmobiliarias distintas, que es el caso que importa.

En cambio se hizo **distinguible** (el selector muestra nombre + inmobiliaria) y **detectable**
(el `log.warn` de T-23 cuando un email cruza tenants).

**Queda abierta la verificación del email (doble opt-in)**, que es la única salida que cierra
de verdad. No la hice: es una tanda propia —mail de confirmación, estado `verificado` en el
modelo, y qué hacer con los cientos ya cargados sin verificar— y no bloquea el portal.

## ⚠️ Necesita tu mano

**Aplicar `20260819140000_email_propietario_minusculas`.** El código nuevo arregla lo que se
cargue de acá en adelante; la migración arregla lo que ya está. Trae dos consultas de solo
lectura al principio para mirar antes a cuántos afecta y si quedan duplicados dentro de una
misma inmobiliaria (si los hay, **no es bloqueante**: esas personas verán más de una cartera y
el selector las distingue por nombre).

Va junto con la de T-23 (`20260819120000_otp_propietario`), en ese orden.

## Verificado

`tsc` 0 en `apps/api` y `apps/propietario`; 14 tests puros (5 nuevos, en rojo al revertir);
lint y `next build` del front limpios.

**No probado en el navegador**: el clasificador de seguridad de la sesión sigue bloqueando el
preview. El selector de cartera está verificado por typecheck, lint y build, no a mano.
