# T-25 · Conmutador de usuarios del mostrador — especificación

**Estado: spec cerrada, IMPLEMENTACIÓN HECHA Y DESPLEGADA** (corregido el 2026-09-03 — este
encabezado decía «implementación NO iniciada» y hacía meses que no era cierto).

Existen: `apps/api/src/auth/pin-conmutador.ts`, `POST /auth/usuario/conmutar`
(`routes/auth.ts:840`), `components/conmutador-usuario.tsx`, `pin-mostrador-card.tsx`,
`lib/sesion-limpieza.ts` con su test, y la migración `20260819180000_conmutador_usuarios`.

Lo que sigue abajo vale como el PORQUÉ de cada decisión, no como un plan pendiente. Las dos
decisiones del final que estaban abiertas siguen abiertas: leelas antes de cambiar el
comportamiento, no antes de construirlo.

Producida por un panel de 10 agentes: 3 relevamientos, 3 diseños en competencia, 3 jueces con
lentes distintas y un modelo de amenazas. Las citas `archivo:línea` que sostienen las decisiones
más pesadas las verifiqué a mano.

---

## 1. Qué pidió Camila

Lo pidió **dos veces**: el 22/07 y otra vez el 03/08 con un video.

> `[1:08:01]` *"Nosotros ahí al lado lo dejaron [con] tu usuario. Yo aprieto un botoncito arriba
> y cambio el usuario a la otra, y se va poniendo la cajera, el administrador, todo, y entra con
> un usuario y contraseña que son cinco dígitos."*
> `[1:09:29]` *"Tenemos una sola impresora y por ahí hay cosas que yo hago desde mi clave en la
> otra máquina."*

Una máquina, varias personas, roles distintos, y hoy la única forma de cambiar es cerrar sesión
y esperar un código por mail.

---

## 2. El diseño ganador: autoridad del lado del servidor

Los **tres** jueces lo pusieron primero, con 8/8/8. Un solo token en el browser, el servidor
emite el token nuevo, hard nav y barrido de estado.

### El flujo

1. Camila toca el botón de la topbar → dropdown con los usuarios activos del tenant.
2. Elige a Luciana → diálogo con 5 casillas.
3. `POST /auth/usuario/conmutar { usuarioId, pin }`. **Pide sesión válida primero**: el PIN nunca
   es un login desde cero, sólo cambia de persona en un dispositivo ya autenticado.
4. El server verifica, emite el token de Luciana y audita.
5. El cliente hace, **en este orden exacto**: `setToken` → `limpiarEstadoDeSesion()` →
   `window.location.assign('/')`.

### Por qué hard nav y no `router.replace`

Hay precedente escrito en la PWA (`apps/inquilino/src/app/(app)/mis-alquileres/page.tsx:74-78`)
con las dos razones: (a) el `QueryClient` vive en el layout **raíz**
(`components/query-provider.tsx:6-16`, montado en `app/layout.tsx:49`) y sobrevive a cualquier
soft nav — con soft nav la home se pinta con la caché del usuario anterior; (b) mata el race de
un refetch disparado con el token viejo que resuelve **después** del `setToken`.
`queryClient.clear()` **no alcanza**: no resuelve el race y deja vivo el localStorage.

---

## 3. Las cinco cosas que NO son negociables

### 3.1 🔴 Nunca 401 por PIN incorrecto — verificado a mano

`manejarSesionVencida` (`apps/inmobiliaria/src/lib/api/client.ts:78-87`) dispara ante **cualquier**
401 con token presente: borra el token y manda a `/login?expirada=1`. Un 401 por PIN mal
**deslogueá al operador**, que es lo contrario de lo que la tarea viene a resolver.

Códigos: **403** PIN incorrecto · **423** bloqueado · **409** el destino no tiene PIN ·
**404** inexistente/inactivo/otro tenant · **400** body inválido o mismo usuario.
El **401** queda reservado para *no hay sesión*.

### 3.2 🔴 El contador de fallos tiene que ser atómico

El diseño ganador lo escribía read-then-write (`findUnique` → `n = intentos + 1` en JS →
`update`). Con requests **concurrentes** todas leen `0`, todas escriben `1`, y
`pinBloqueadoHasta` **nunca se puebla**. El modelo de amenazas calculó el costo: el techo real
deja de ser el lockout y pasa a ser el rate limit por IP (5.760 intentos/día) → **~9 días** para
romper 5 dígitos, sin una sola alarma.

```ts
const r = await prisma.usuario.update({
  where: { id },
  data: { pinIntentosFallidos: { increment: 1 } },
  select: { pinIntentosFallidos: true },
});
if (r.pinIntentosFallidos >= 5) { /* bloquear 30 min */ }
```

Y **chequear el bloqueo antes de correr bcrypt**: `bcryptjs` es JS puro y bloquea el event loop
(lo advierte el comentario de `auth.ts:288-301`).

### 3.3 🔴 `verificarPinUsuario` no se toca, y un test lo blinda

`apps/api/src/auth/pin.ts:11-13` devuelve `{ok:true}` siempre, y la llaman seis endpoints de
plata (`plata.ts:352`, `:484`, `operacion.ts:1586`, `:1877`, `core.ts:2942`, `:3088`). Si se
"revive", **todos vuelven a pedir PIN** — justo lo que tu decisión prohíbe.

El conmutador va en **archivo nuevo**: `apps/api/src/auth/pin-conmutador.ts`, que **no importa
nada** de `pin.ts`. Docblock cruzado en los dos archivos explicando por qué son dos.
**Test de regresión obligatorio**: que `verificarPinUsuario` sigue devolviendo `{ok:true}`. Es el
guardarraíl contra que la próxima sesión "unifique" las dos funciones creyendo que limpia.

### 3.4 🔴 El barrido de estado también arregla el logout

`limpiarEstadoDeSesion()` barre **todas** las claves con prefijo `llave-inmo:` (34 hoy: caja,
cierres, conciliación, rendiciones, aprobaciones, auditoría, borrador de contrato, sociedades…).

Hoy el logout limpia **una sola** (`sidebar.tsx:141-144`) y su propio comentario describe el bug
del mostrador: *"el siguiente que entraba heredaba la razón social y el CUIT del anterior y los
imprimía en sus PDF de cobranza"*. Las otras 33 siguen abiertas.

Peor: **ni el login ni el logout hacen hard nav** hoy (`login/page.tsx:189-190`,
`sidebar.tsx:145`); el único que lo hace es el 401. O sea que en el mostrador compartido la caché
en memoria del operador anterior **sobrevive a salir y a entrar**. Los pasos 2 y 3 se aplican
también a `cerrarSesion` y a `manejarSesionVencida` — **no como opcional**, dijeron dos jueces.

### 3.5 🔴 `POST /auth/pin` es el único endpoint de auth sin rate limit — verificado

`auth.ts:660` se registra sin objeto `config`, mientras los otros cinco (`:109`, `:268`, `:326`,
`:365`, `:408`) todos lo tienen. Si pasa a escribir la credencial del conmutador, necesita tope.
Y si ya hay `pinHash`, **`pinActual` pasa a ser obligatorio**.

---

## 4. Lockout: la política, y qué pasa cuando te equivocás

5 fallos consecutivos → bloqueo de **30 minutos**. Un acierto resetea. Sin escalada progresiva.

**Por usuario en la DB, no por IP**: en el mostrador toda la oficina sale por una sola IP, así
que un tope por IP castiga a todos y no aísla al que se equivoca — limitación que el propio
código ya admite (`auth.ts:324-325`).

**Tres salidas, de menos a más fricción** — la tercera es la que le importa a Camila:

1. Esperar 30 minutos.
2. Un ADMIN destraba al instante (`POST /auth/usuario/:id/pin/desbloquear`): limpia contadores,
   **conserva el hash**. Auditado.
3. **Siempre disponible**: la persona entra por OTP a su propio mail, y un
   `/auth/usuario/otp/verify` exitoso resetea sus contadores. Es self-service y no depende de que
   la administradora esté en la oficina. **El PIN es una capa de conveniencia arriba del OTP; el
   OTP siempre gana.**

**Un ADMIN nunca puede SETEAR el PIN de otro** — sólo borrarlo (`DELETE /auth/usuario/:id/pin`).
Un ADMIN que pudiera escribir el PIN ajeno podría convertirse en la cajera sin dejar rastro
distinguible.

**Denylist de PINs triviales al setear** (repetidos, corridas). Es la capa que más rinde: un
atacante humano prueba ~20 PINs, no 100.000.

### Honestidad sobre qué protege esto

Del modelo de amenazas, y vale trasladártelo tal cual:

> Con el lockout atómico, romper 5 dígitos por fuerza bruta son ~208 días de martillar dejando a
> la víctima bloqueada cada 30 minutos. Nadie hace eso. Pero contra un PIN elegido por una
> persona el espacio **no es 100.000**: el año de nacimiento son 130 intentos. Y el ataque real
> ni siquiera es ese — son 5 dígitos tipeados 30 veces por día con público del otro lado del
> vidrio. **El lockout no protege contra el que te miró teclear.**

**Vendido como "seguridad", un PIN de 5 dígitos es un fraude. Vendido como "trazabilidad con
fricción baja", es honesto — y para eso sí sirve.** La defensa real es que el rol autoritativo
sale de la DB en cada request (`guards.ts:56-73`) y que **cada cambio y cada intento fallido
quedan en auditoría**.

---

## 5. Endpoints

| Endpoint | Estado | Qué hace |
|---|---|---|
| `GET /auth/usuario/conmutables` | nuevo | Usuarios activos del tenant. **No devuelve email** (es el input del login por OTP, enumera). `bloqueadoHasta` sólo para ADMIN. |
| `POST /auth/usuario/conmutar` | nuevo | El cambio. `requireUsuario` primero. Rate limit 60/15min. |
| `POST /auth/pin` | endurecer | `pinActual` obligatorio si ya hay hash; denylist; rate limit 20/15min. |
| `POST /auth/usuario/:id/pin/desbloquear` | nuevo | Sólo ADMIN (`equipo.gestionar`). Conserva el hash. |
| `DELETE /auth/usuario/:id/pin` | nuevo | Sólo ADMIN. Borra el hash. **No existe "setear el PIN de otro".** |
| `GET /auth/me` | 1 línea | `tienePin` pasa de `false` hardcodeado (`:626-628`) a `!!u.pinHash`. |
| `POST /auth/usuario/otp/verify` | 1 bloque | Resetea contadores de PIN al entrar por mail. |

**Auditoría: sólo 2 valores nuevos de enum**, no 5 (recorte que pidió el juez mantenedor):
`SESION_CONMUTADA` y `CONMUTACION_RECHAZADA`.

---

## 6. Migración

```sql
ALTER TYPE "TipoEventoAuditoria" ADD VALUE 'SESION_CONMUTADA';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE 'CONMUTACION_RECHAZADA';
UPDATE usuarios SET pin_hash = NULL, pin_intentos_fallidos = 0, pin_bloqueado_hasta = NULL;
```

El `UPDATE` **es obligatorio** y es el vínculo con **T-35**: los `pinHash` existentes vienen de
`scripts/onboarding-real.mjs:98` (donde los usuarios extra **heredan el PIN del admin**) y del
seed. Nunca autenticaron nada, así que no se pierde nada — y es la única forma de garantizar que
todo `pinHash` vivo lo escribió su dueño desde su propia sesión.

⚠️ Ojo con el orden: en Postgres un valor de enum agregado con `ALTER TYPE` no se puede usar en
la misma transacción. Van en migraciones separadas o con `COMMIT` de por medio.

---

## 7. Criterios de aceptación

- **AC-1** · Camila cambia a la cajera en dos clicks + PIN, **sin cerrar sesión ni pedir OTP**.
- **AC-2** · Después del cambio, el menú lateral, las capacidades y los datos son **los del rol
  nuevo**. Nada del anterior queda visible.
- **AC-3** · PIN incorrecto → **403** y el operador **sigue logueado**. (Hoy un 401 lo echaría.)
- **AC-4** · 5 fallos → 423 con la hora. **Disparados en paralelo con `Promise.all`, el bloqueo
  igual se puebla** (este test falla con read-then-write).
- **AC-5** · Sin sesión, `POST /auth/usuario/conmutar` → **401**. El PIN no es un login.
- **AC-6** · Un `usuarioId` de otro tenant → **404**, indistinguible de inexistente.
- **AC-7** · Los seis endpoints de plata **siguen sin pedir PIN**. Test de regresión sobre
  `verificarPinUsuario`.
- **AC-8** · Después de un logout, `localStorage` no conserva ninguna clave `llave-inmo:`.
- **AC-9** · Un ADMIN **no puede** setear el PIN de otro; sólo borrarlo o desbloquearlo.

---

## 8. Lo que falta decidir — es tuyo, no es técnico

### 🔵 Decisión 1 — TTL del token conmutado

Hoy el token dura **15 días** (`auth.ts:20`). El diseño ganador propone bajarlo a **12 h** para
el token conmutado. El juez que hace de Camila lo marcó como su mayor reparo:

> *"Bajarlo a 12 h nos compra un correo con código cada mañana."*

- **12 h** → más seguro, pero la cajera tiene que pedir OTP casi todos los días.
- **15 días** (igual que hoy) → sin fricción nueva, pero un token conmutado vive dos semanas.

Mi recomendación: **dejarlo en 15 días** y resolver el riesgo real con el bloqueo por
inactividad (decisión 2), que ataca el problema de verdad sin castigar el uso diario.

### 🔵 Decisión 2 — ¿Entra el bloqueo por inactividad?

El modelo de amenazas puso como riesgo **#1, crítico**, algo que el conmutador **no resuelve**:

> La máquina desatendida con la sesión de Camila abierta. Ahí nadie necesita cambiar de usuario:
> ya está adentro. Y ninguna acción de plata pide PIN por decisión de producto — confirmar un
> pago, revertir una conciliación, rendir a un propietario, todo lo marcado `requierePin: true`
> en `packages/shared/src/permisos.ts:153-159` es **decorativo** hoy.

La mitigación es un overlay que a los N minutos sin actividad pide el PIN del usuario **actual**
para volver. Reusa el mismo `pin-input` y el mismo endpoint.

**Está fuera del texto literal de T-25**, por eso te lo pregunto en vez de meterlo. Pero sin
esto, T-25 le pone cerradura a la puerta de una casa sin paredes.

### 🔴 Bloqueo previo — T-35

**No se implementa nada de esto hasta resolver T-35.** T-25 convierte `pinHash` en la credencial
para volverse otra persona; si hay PINs heredados en producción, sería agregar un segundo camino
de escalamiento sobre uno que ya existe.

---

## 9. Fuera de alcance

- Bloqueo por inactividad (decisión 2 — si decís que sí, entra).
- Revocación del token saliente (`tokenVersion` en `Usuario`). Ninguno de los tres diseños la
  cubre; el token del usuario anterior sigue vivo hasta expirar. Vale registrarlo aparte.
- Volver a la pantalla donde estabas: los tres diseños recargan a `/`. Camila lo pidió
  implícitamente (*"si estoy a mitad de una conciliación y le presto la máquina un minuto"*).
- La ventana de gracia de 120 s para el viaje a la impresora — buena idea del diseño descartado,
  pero es alcance nuevo.
- Avisar antes de barrer un borrador de contrato a medio cargar (`llave-inmo:contrato-borrador`).
