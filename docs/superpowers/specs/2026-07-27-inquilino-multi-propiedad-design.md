# Inquilino multi-propiedad: ver mis propiedades y entrar a cada una

**Fecha:** 2026-07-27
**Rama:** `feat/inquilino-multi-propiedad` (worktree `~/dev/myalq-multiprop`, base `origin/main` afb9efe)
**Estado:** diseño aprobado, pendiente de plan de implementación

## Objetivo

Que un inquilino, con su mismo email, que alquila dos propiedades —en **distintas inmobiliarias o en la misma**— pueda:

1. **Ver sus propiedades** (la lista de sus alquileres).
2. **Entrar a una y ver todo** (pagos, reclamos, contrato, documentos de ese alquiler).

Nada más. Es una **lista + un detalle**, no un tablero consolidado ni un centro de operación multi-propiedad.

## Hallazgo central: el 70-80% ya está construido

Un análisis del código (5 lectores + 3 verificadores adversariales) confirmó que el backend está **completo y correcto** para este caso de uso, y que la pantalla del front **ya existe**. Este spec cubre solamente el delta.

### Ya funciona (verificado, no asumido)

| Capacidad | Evidencia |
|---|---|
| Login por email **cross-inmobiliaria** | `apps/api/src/routes/auth.ts:85-104` — `alquileresDeEmail` hace `findMany` por email **sin** `inmobiliariaId` |
| OTP que cubre todas las inmobiliarias | `auth.ts:351,365-367` un `CodigoOtp` por cada fila del email, un solo mail; `auth.ts:400-413` valida y quema el lote |
| Ver la lista al primer ingreso | `login/page.tsx:729-798` (`PasoElegir`), se muestra si hay >1 alquiler |
| Pantalla "Mis alquileres" | `apps/inquilino/src/app/(app)/mis-alquileres/page.tsx` — 171 líneas, 4 estados, marca el actual |
| Entrar a un alquiler | `POST /auth/inquilino/elegir` (`auth.ts:427-458`) valida pertenencia por email y emite el `JwtInquilino` |
| Cambiar **sin** re-loguearse | el persona-token vive en `llave:auth:persona`, distinto de `llave:auth:token` (`api/client.ts:12,17`) |
| Backend sin fugas entre inmobiliarias | `/mi-contrato`, `/mis-reclamos`, `/mis-liquidaciones`, `/mis-documentos` leen `contratoId`+`inmobiliariaId` **solo del JWT** |

### Decisión: NO construir una "cuenta global"

La capa de identidad cross-inmobiliaria **ya existe en producción**: `JwtPersona` (`kind:'persona'` + email) con su guard `requirePersona`, más `/auth/inquilino/alquileres` y `/auth/inquilino/elegir`. Crear un modelo `CuentaInquilino` sería duplicarla, con migración y backfill innecesarios.

## Gaps reales

### P0 — Al cambiar de propiedad se ve la plata de la otra

Al elegir otro alquiler, la app muestra la **deuda y el contrato de la propiedad anterior** junto a la dirección nueva. Sin error ni aviso.

Causa (tres factores que se suman):
- Ninguna queryKey lleva el contrato/inquilino: `['mi-contrato']` (`hooks.ts:72`), `['mis-liquidaciones']` (`hooks.ts:162`), `['mis-anuncios']` (`hooks.ts:187`).
- El `QueryClient` se crea una sola vez en el layout raíz (`query-provider.tsx:7-14`) y **sobrevive** a la navegación client-side.
- `elegirAlquiler` no limpia nada (`auth-otp-api.ts:147`) y `mis-alquileres/page.tsx:56` usa `router.replace('/')` (soft nav).

Agravantes: `staleTime` de 60s en `mi-contrato` y 30s en liquidaciones → ni siquiera refetchea. El `SideNav` monta `useMiContrato` de forma permanente, así que el observer nunca se desmonta. El pull-to-refresh usa `router.refresh()`, que no toca react-query.

Verificado: `grep -rn "queryClient.clear|removeQueries|resetQueries" apps/inquilino/src` → **cero resultados** (los `invalidateQueries` que existen son post-acción dentro de un mismo alquiler).

### P1 — "Ver mis propiedades" está escondido

`grep -rn "mis-alquileres" apps/inquilino/src` devuelve **un solo link**: `cuenta/page.tsx:185`. No está en `nav-bar.tsx`, ni en `user-menu.tsx`, ni en `desktop-topbar.tsx`, ni en la home. En mobile el bottom-nav solo pinta los ítems primarios, así que no hay pestaña "Mi cuenta".

### P1 — El link está gateado por un contador congelado

`alquileresCount` se escribe una única vez en el login (`auth-otp-api.ts:157`) y se lee en `cuenta/page.tsx:68-71,180`. Nadie lo refresca. Si el inquilino firma su 2ª propiedad **después** de loguearse, el backend ya la devuelve pero el link nunca aparece: queda encerrado en una sola propiedad hasta que cierre sesión (el token dura 15 días, `auth.ts:20`).

### P1 — No se ve en qué propiedad estás parado

El header mobile solo dice "Hola, {nombre}" (`mobile-greeting-header.tsx:20-33`). La home no imprime la dirección (`(app)/page.tsx:170-174` la sacaron a propósito). El "Tu hogar" del sidenav desktop (`nav-bar.tsx:152-158`) es texto plano. Con dos propiedades de la misma inmobiliaria, en un teléfono las dos sesiones se ven **idénticas**.

### P2 — La lista no distingue vigente de finalizado

El API **ya manda** `estado` con un comentario explícito de que es para eso (`auth.ts:100-102`), pero la interface `Alquiler` del front no lo declara (`auth-otp-api.ts:31-37`) y se descarta.

### P0 condicional — Dos contratos en la MISMA inmobiliaria es imposible hoy

`@@unique([inmobiliariaId, email])` sigue vivo en `main` (`apps/api/prisma/schema.prisma:1363`). El alta devuelve 409 (`core.ts:928-929`) y el panel le enseña al operador a dejar el email vacío en el 2º contrato — con email `null` esa fila **no entra** en `alquileresDeEmail` ni recibe OTP: la propiedad queda invisible para siempre.

El fix ya está escrito: **PR #27** (`OPEN`, `MERGEABLE`, sin tocar desde 2026-07-23) mueve el unique de `Inquilino` a `Persona`, con su migración.

## Diseño

Cinco cambios en el front del inquilino, más el merge de PR #27 para el caso misma-inmobiliaria. **Sin modelos nuevos.** La única migración es la que PR #27 ya trae.

### 1. Matar el bug de la plata (primero, no negociable)

Reemplazar la soft nav por **hard nav** al cambiar de alquiler:
- `mis-alquileres/page.tsx:56`: `router.replace('/')` → `window.location.assign('/')`
- el `PasoElegir` del login: mismo cambio
- `cerrarSesion`: mismo cambio (hoy tampoco limpia la caché)

Una hard nav destruye el `QueryClient` en memoria y además mata el race de un refetch disparado con el token viejo que resuelve después del `setToken`.

**Deuda anotada (no en esta entrega):** prefijar las ~12 queryKeys con el `inquilinoId`. Es la versión correcta a largo plazo, pero no hace falta para entregar esto y se puede hacer sin presión.

### 2. Hacer visible "Mis propiedades"

- **Desktop:** convertir el bloque "Tu hogar" del pie del sidenav (`nav-bar.tsx:152-158`) en un `<Link href="/mis-alquileres">` con ícono de switch. Ya muestra dirección + inmobiliaria; solo hay que hacerlo clickeable.
- **Mobile:** agregar la dirección debajo del "Hola, {nombre}" en `mobile-greeting-header.tsx`, también linkeada a `/mis-alquileres`.

Resuelve de un saque *ver mis propiedades* y *saber en cuál estoy parado*.

### 3. Destapar el link de la cuenta

En `cuenta/page.tsx`, sacar el gate `variosAlquileres` (que depende del contador congelado) y mostrar la fila siempre. La pantalla ya maneja bien el caso de un solo alquiler.

### 4. Mostrar el estado del contrato

Agregar `estado?: string | null` a la interface `Alquiler` (`auth-otp-api.ts:31-37`) y pintar un badge en las dos listas (`/mis-alquileres` y `PasoElegir`). El dato ya viaja desde el API.

El enum es `BORRADOR | ACTIVO | FINALIZADO | RESCINDIDO` (`schema.prisma:45-50`), así que el mapeo es explícito y **no** `estado !== 'ACTIVO'` (eso etiquetaría un borrador como finalizado):

- `ACTIVO` → sin badge (es lo normal)
- `FINALIZADO` / `RESCINDIDO` → badge "Finalizado", en gris/atenuado
- `BORRADOR` → sin badge (contrato cargado para revisión, todavía no activo)

### 5. Estado vacío y back estable

En `/mis-alquileres`: si la lista vuelve vacía, mostrar un mensaje en vez de una `<ul>` muda (`page.tsx:117-160`); y cambiar `router.back()` por un `href` fijo a `/`.

### 6. Caso misma inmobiliaria (PR #27)

Orden obligatorio:
1. **Chequeo READ-ONLY en prod** antes de mergear: verificar que no existan dos `Persona` con el mismo email no-null dentro de un mismo tenant. La migración crea un `UNIQUE` sobre `personas` y **falla si las hay**. Solo `SELECT`, ningún write.
2. Mergear PR #27.
3. Deployar (la migración corre en el boot del back).

**Agujeros conocidos que PR #27 NO cierra** (fuera del alcance de este spec, se registran para no olvidarlos):
- Sin DNI, el alta del 2º contrato sigue dando 409.
- La importación de cartera sigue marcando DUPLICADO la 2ª unidad.
- Los contratos ya cargados con email vacío no se reparan solos: no hay endpoint para corregir el email de un `Inquilino` existente.

## Testing

- **Manual/E2E (el que importa):** un email con 2 alquileres → login muestra la lista → entrar a A → ver deuda de A → volver a la lista → entrar a B → **la deuda que se ve es la de B, no la de A**. Este es el test de aceptación del P0.
- Verificar que se llega a `/mis-alquileres` desde el sidenav (desktop) y desde el header (mobile), sin pasar por Mi cuenta.
- Verificar que el link aparece aunque el inquilino se haya logueado cuando tenía un solo alquiler (contador congelado).
- Un contrato finalizado muestra el badge "Finalizado" en ambas listas.
- **No regresión:** el flujo con UN solo alquiler entra directo, igual que hoy.
- Para PR #27: un test de `/auth/otp/verify` que devuelva los 2 alquileres de la **misma** inmobiliaria (assert que al PR le falta).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La migración de PR #27 falla en prod por datos preexistentes | Chequeo read-only previo (paso 6.1). Sin él, no se mergea. |
| La hard nav se siente más lenta que la soft nav | Es un cambio de alquiler (acción poco frecuente y deliberada); la corrección de datos vale más que los ~300ms. |
| Contratos ya cargados con email vacío siguen invisibles | Documentado arriba. Necesita un endpoint de corrección — ítem aparte, lado inmobiliaria. |

## Fuera de alcance (decidido explícitamente)

- Modelo `CuentaInquilino` / cuenta global nueva → **la capa ya existe** (`JwtPersona`).
- Migración de identidad y backfill de personas.
- Tablero consolidado con deuda agregada, vencimientos cruzados o inbox unificado.
- Pagar o reclamar *inline* desde la lista, sin entrar al alquiler.
- Unificar documentos, avatar o perfil a nivel persona (hoy cuelgan del contrato: con dos alquileres hay que subir el DNI dos veces — molesto pero no bloqueante).
- Refactor de las 12 queryKeys (deuda anotada en el punto 1).
- Importación de cartera y endpoint para corregir el email de un `Inquilino`.
- Hacer el multi-alquiler demostrable en la build sin backend (hoy `/mis-alquileres` redirige a `/cuenta` si `!apiEnabled`).
