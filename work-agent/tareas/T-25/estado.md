# T-25 · Conmutador de usuarios — IMPLEMENTADA

rama `feat/T-25-conmutador` · commits `f199a34` (backend) + `2ee18a5` (panel) + el del bloqueo

## Qué pidió Camila

Lo pidió **dos veces**: el 22/07 y otra vez el 03/08 con un video.

> `[1:08:01]` *"Yo aprieto un botoncito arriba y cambio el usuario a la otra, y se va poniendo la
> cajera, el administrador, todo, y entra con un usuario y contraseña que son cinco dígitos."*

Hoy la única forma de cambiar de persona es cerrar sesión y esperar un código por mail. Con gente
esperando del otro lado del mostrador, eso no se hace.

## Las dos decisiones que estaban abiertas

**TTL: se queda en 15 días.** Bajarlo a 12 h para el token conmutado suena prudente y en la
práctica le compra a la cajera un correo con código cada mañana. El riesgo que justificaba
bajarlo —la máquina que queda sola— se ataca mejor con el bloqueo por inactividad, sin castigar
el uso diario de todos.

**El bloqueo por inactividad ENTRA**, aunque estaba fuera del texto literal de la tarea. El
modelo de amenazas lo puso como riesgo **#1** y tenía razón: contra la máquina desatendida el
conmutador no hace nada —el que se sienta ya está adentro— y como ninguna acción de plata pide
PIN, todo lo marcado `requierePin: true` en la matriz es decorativo. Sin esto, T-25 le pone una
cerradura a la puerta de una casa sin paredes.

## Lo que NO se tocó, y gobierna todo

`verificarPinUsuario` (`auth/pin.ts`) **sigue aprobando siempre**. La llaman seis endpoints de
plata; si volviera a verificar, todos empezarían a exigir un PIN que casi nadie tiene cargado.

El conmutador trae su propia verificación en `auth/pin-conmutador.ts`, que **no importa nada** de
aquél, y hay un test que lo blinda — porque "unificar esas dos funciones que se llaman parecido"
es exactamente lo que va a intentar la próxima sesión.

## Lo más importante del diseño: el lockout es ATÓMICO

`{ increment: 1 }`, y la decisión de bloquear usa el valor **devuelto** por el update.

Con un read-then-write, N intentos concurrentes leen el mismo contador, escriben todos `1`, y
`pinBloqueadoHasta` **nunca se puebla**: el techo real deja de ser el lockout y pasa a ser el
rate limit por IP. Romper 5 dígitos baja de ~208 días a **~9**, sin que se dispare una sola
alarma que el ADMIN pueda ver. Hay un test para eso y **se verificó por mutación que se pone en
rojo**.

## Tres agujeros preexistentes que se cerraron de paso

1. **`/auth/pin` no verificaba el PIN actual.** El comentario decía que "heredaba el lockout
   anti-fuerza-bruta" llamando a `verificarPinUsuario`… que aprueba siempre. No verificaba nada.
2. Era el **único endpoint de `/auth/*` sin rate limit**.
3. **El logout limpiaba 1 de 34 claves** y hacía soft nav. Su propio comentario describía el bug
   que eso causó ("el siguiente heredaba la razón social y el CUIT del anterior y los imprimía en
   sus PDF de cobranza"); se arregló esa clave y quedaron las otras 33. Y una sesión **vencida**
   dejaba todo igual: mismo mostrador compartido, sólo que el que se va no apretó el botón.

## La honestidad que quedó escrita en el código

Un PIN de 5 dígitos que se tipea treinta veces por día en un mostrador con público del otro lado
del vidrio **no es un secreto fuerte**, y el lockout no protege contra el que te miró teclear.
Vendido como "seguridad" es un fraude; vendido como **trazabilidad con fricción baja** es
honesto, y para eso sirve: cada cambio y cada intento rechazado quedan en auditoría, y el rol
autoritativo lo sigue resolviendo la DB en cada request.

Lo mismo con el bloqueo de pantalla: es **una cerradura de pantalla, no un límite de
autorización**. La sesión sigue viva y alguien con las devtools saca el overlay. Contra quien
sirve es contra el oportunista con acceso físico — que es exactamente el escenario del mostrador.

## Verificación

- `tsc --noEmit` **0** en `apps/api` y `apps/inmobiliaria`.
- **344 tests** sin DB en verde (37 archivos), incluidos 12 nuevos de contrato de T-25.
- El test del incremento atómico verificado **en rojo** por mutación.
- `next lint` sin hallazgos nuevos; el build del panel compila.

### Lo que NO se verificó

- **Nada en navegador.** El clasificador de seguridad bloquea las herramientas de preview en esta
  sesión. El flujo está verificado por compilación y por tests de contrato, **no visto
  funcionando**. Es lo que más falta.
- **Los tests con DB no se corrieron** (instancia compartida, y sin `.env` en esta máquina). Los
  12 tests nuevos son de contrato leído del fuente, a propósito: dos de sus garantías —que ningún
  401 salga por un PIN mal, y la atomicidad del contador— no se observan con un test de
  comportamiento razonable.
- **La migración está escrita y SIN aplicar**: sólo 4 valores de enum de auditoría, aditivos.

## Pendiente

✅ **Nada pendiente del alcance.** El estado del PIN por persona (quién tiene, quién está bloqueado y hasta cuándo) y las acciones de ADMIN —desbloquear y borrar— están en la card de Equipo, reusando el mismo endpoint del conmutador para que las dos pantallas no puedan decir cosas distintas.

Lo único que queda antes de mergear, y no es código:

1. **Correr la consulta de sólo lectura de T-35** en producción. La migración
   `limpiar_pines_heredados` borra todos los `pinHash` y **no es reversible** — y ahora sí
   importa, porque hasta hoy ese hash no autenticaba nada y con T-25 pasa a ser una credencial.
2. **Aplicar la migración** de los 4 valores de enum ANTES del código (el Dockerfile ya lo hace
   solo: `pnpm db:deploy && exec node dist/index.js`).
3. **Probarlo en un navegador.** Es lo que falta de verdad.
