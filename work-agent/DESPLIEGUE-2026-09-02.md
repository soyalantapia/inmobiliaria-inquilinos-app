# El despliegue del 02/09/2026 — 61 PRs a producción, en Render

`main` estaba en el PR **#68** y producción servía el **#66**. Este despliegue puso arriba
**61 PRs** (#69 a #129, más #131 y #132) de una vez.

## Qué quedó sirviendo

| servicio | verificado con |
|---|---|
| `myalq-api` | `/health` → `{"ok":true,"db":"up","version":"0b9e40a"}` |
| `myalq-panel` | `<meta build-commit>` = `0b9e40a` · redirige a `/login` sin sesión |
| `myalq-inquilino` | `<meta build-commit>` = `0b9e40a` · redirige a `/login` sin sesión |
| portal del propietario (`/propietario`) | 200 · `build-commit` = `0b9e40a` |
| `myalquiler.com` · `admin.` · `app.` | los tres 200 con el commit nuevo |

**Migraciones:** 69 encontradas, **4 aplicadas** (`movimiento_caja_cargo_id`,
`propietario_email_verificado`, `auditoria_baja_contrato`, `auditoria_dar_poder`) →
*All migrations have been successfully applied*. Las cuatro son aditivas: dos `ADD COLUMN`
nullable y tres valores de enum. Ninguna necesita backfill.

**Que el código nuevo está sirviendo de verdad** se comprobó con un comportamiento, no con el
dashboard: `POST /auth/otp/verify` con un email inexistente devuelve el mensaje unificado
—«Código inválido o vencido»— y tarda **907 ms y 904 ms medidos por el server**, que es el piso
anti-timing que agregó #125. Antes contestaba «Código inválido» en 5 ms.

Y lo que tiene que seguir cerrado, sigue cerrado: `POST /auth/demo` → **404**.

## Las tres cosas que hubo que arreglar ANTES para poder verificar

Salieron del pre-vuelo (#132):

1. **`/health` decía `"version":"desconocido"`** porque sólo leía variables de Railway. Sin eso
   no hay forma de saber desde afuera qué versión está sirviendo — ni de verificar una vuelta
   atrás. Ahora lee `RENDER_GIT_COMMIT`; lo mismo el `<meta build-commit>` de los fronts.
2. **Sonar pedía su loader a un host de Railway muerto**, horneado en el HTML de los tres
   fronts. Salió a `NEXT_PUBLIC_SONAR_URL` sin default. Verificado en producción: cero
   referencias al host viejo, el nuevo presente en los tres.
3. **El disco**: el código sólo conocía `/data` (Railway) y Render monta en `/var/data`. La
   variable estaba seteada, pero el modo de falla era «elige mal y no falla».

## 🔴 Lo que casi sale mal, para que no se repita

**Seis PRs se mergearon en la rama de su padre, no en `main`.** Los apilados (#95, #84, #92,
#101, #102, #103) tenían `baseRefName` apuntando a la rama del padre. GitHub sólo los
re-apunta a `main` si la rama base **se borra** al mergear, y se mergeó sin borrar.

Los sesenta `gh pr merge` devolvieron éxito y GitHub los marca MERGED. Faltaban archivos
enteros —`use-puede.ts`, `reclamos-abiertos.ts`, `plata-del-contrato.ts` y sus tests—:
**1.055 líneas**.

**Cómo se detectó:** comparando `main` contra el árbol que se había verificado antes de
mergear. Sin esa comparación, esto se descubría en producción.

> **La regla:** antes de mergear un lote, mirar `baseRefName` de cada PR, no sólo `headRefName`.
> Y después de mergear, `git diff` entre `main` y el árbol que se probó — tiene que dar sólo
> documentación.

## Lo que NO entró, y por qué

- **#128** (el badge "Al día" de una unidad con deuda): lo arreglaba también **#96**, que además
  agrega el selector que faltaba. Mergeados los dos, la fila quedaba con **dos badges**. Queda
  abierto para rebasarlo al delta que sí aporta.
- **Los 14 PRs de julio** (#4, #5, #7, #37…#51): son anteriores a esta tanda, once conflictúan
  con `main` desde antes y ninguno se verificó acá.

## Vuelta atrás, si hiciera falta

Dashboard del servicio → *Deploys* → *Rollback*. **Ojo:** la API aplica las migraciones al
arrancar, así que volver el código **no vuelve el esquema**. Las cuatro migraciones de este
lote son aditivas, así que el código viejo convive con el esquema nuevo salvo por los tres
valores de enum de auditoría: si se volviera atrás después de haber dado de baja un contrato o
cambiado un rol, hay que borrar esas filas primero. Hoy la base **no tiene datos de negocio**,
así que eso es teórico.


## Fue en dos vueltas

La primera desplegó `0b9e40a` (los 61 PRs). Después entraron cinco más de la tanda de julio
—#7 páginas legales, #38 instalar la app, #51 corregir borrador, #5 landing, #135 el semáforo
del DNI— y dos arreglos rescatados del triage (#138, la comisión con coma), así que se
desplegó de nuevo.

**Lo que sirve producción hoy: `f7e8b50`.** Verificado igual que la primera vez: `/health`
con el SHA, `<meta build-commit>` en los tres fronts, los tres dominios propios en 200, y
—la prueba de comportamiento— las páginas `/terminos` y `/privacidad`, que no existían antes
de este deploy, devuelven 200.

Sin migraciones nuevas en esta segunda vuelta.

> Nota para el que compare: `main` puede estar **adelante** de producción por commits de
> documentación. Eso es normal y no hay que desplegar por eso. Lo que importa es que no haya
> **código** sin desplegar: `git diff <sha de /health> main --stat -- apps packages` tiene que
> dar vacío.
