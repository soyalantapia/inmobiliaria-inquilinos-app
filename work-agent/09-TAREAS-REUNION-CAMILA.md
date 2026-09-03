# Tareas — reunión con Camila Vargas (03/08/2026)

> **Qué es este documento.** El plan de trabajo derivado de la sesión de prueba en vivo con
> la clienta cero. Cada tarea está **verificada contra el código** antes de escribirse: dice
> qué pidió ella, qué encontramos realmente, y qué hay que hacer.
>
> **Para qué sirve.** Está escrito para **delegarse**: cada tarea es autocontenida, tiene un
> tipo de experto asignado y un criterio de aceptación verificable. Un agente debería poder
> tomar una tarea sin leer el resto del documento.
>
> **Base de verificación:** rama `feat/reunion-camila-0308`, commits `b00f5c1`..`d19c804`,
> sobre `70d4be8` (= lo que corre en producción).
> Contexto completo del sistema: [`07-ECOSISTEMA.md`](./07-ECOSISTEMA.md).
> Backlog crudo de la reunión: [`08-REUNION-CAMILA-0308.md`](./08-REUNION-CAMILA-0308.md).

---

## 📍 Dónde quedó todo — medido el 03/09/2026 contra `main`

> **Leé esto antes que el cuerpo del documento.** Cada tarea de abajo se midió de nuevo contra
> el `main` de hoy, endpoint por endpoint y archivo por archivo. Muchas de las secciones que
> siguen se escribieron el 03/08 y **quedaron viejas**: describen como pendiente algo que ya
> está, o dan por inexistente algo que se construyó. Donde el cuerpo y esta tabla no coincidan,
> **manda la tabla**.
>
> Las preguntas que frenan una tarea viven en [`PARA-ALAN.md`](./PARA-ALAN.md), con el contexto
> mínimo para contestarlas sin volver a investigar.

**El resumen:** de 40 tareas, **20 están cerradas**, 5 son operativas (no se resuelven con
código), 5 esperan una decisión, 1 quedó obsoleta y **9 estaban a medias** — de esas nueve,
seis se cerraron hoy.

| # | Estado | Dónde quedó |
|---|---|---|
| T-03 | 🧑 operativa | La cadena entera está verificada: el panel ofrece CAJA, el endpoint lo acepta, el enum lo tiene y la matriz le da conciliar/rechazar. Falta el gesto humano: pasar a CAJA a quien atienda el mostrador, y **avisarle a Camila antes**. |
| T-04 | 🧑 operativa | Las cinco afirmaciones del doc siguen ciertas. Falta la consulta de sólo lectura contra producción y escribir cuál de las tres hipótesis era. |
| T-05 | 🧑 operativa | La nota de «cada merge sale a producción» **quedó vieja**: desde Render (29/08) los tres servicios tienen `autoDeploy: no`. Queda el acuerdo humano de no tocar Deploy durante la sesión. |
| T-06 | ✅ | |
| T-07 | ✅ | |
| T-08 | ✅ | La barra existe, el sticky no está muerto (ningún ancestro con `overflow-hidden`, el Topbar no es sticky) y no desaparece por paginado. |
| T-09 | ✅ | Sólo `nombre` es obligatorio; el WhatsApp y las fotos del DNI no bloquean, y el expediente los muestra como pendientes. |
| T-10 | ✅ | «Cargar inquilino» ya no dice Próximamente y el wizard salta al paso 2 con la propiedad elegida. |
| T-11 | ⚠️ → ✅ | Los endpoints y la capacidad acotada ya estaban; faltaba la traza. Cerrada hoy (#157: auditoría de garantes y del contacto del inquilino). Quedan dos cosas en PARA-ALAN: si la edición se recorta a la administradora —recortarla **saca** una capacidad que OPERADOR y CARGA usan hoy—, y que `depositoGarantia` no tiene camino de edición. |
| T-13 | ⚠️ | Puntos 1 y 2 cerrados. Falta mover plata entre cuentas: toca el modelo → PARA-ALAN. |
| T-13-N1 | ⛔ decisión | Cierre de caja. Tres preguntas sin las cuales no se puede construir. **No borrar la tabla `CierreCaja` mientras tanto.** |
| T-14 | ✅ | |
| T-15 | ✅ | |
| T-16 | ✅ | |
| T-17 | ⚠️ → ✅ | Los tres avisos de reclamo estaban; faltaba el mail cuando **el profesional** cierra desde su link mágico. Cerrado hoy (#158). Queda el inventario de qué otros eventos avisan → PARA-ALAN. |
| T-18 | ⚠️ → ✅ | Los copys de WhatsApp y el registro del diálogo ya estaban. Faltaba el tour de onboarding, que vendía calendario, profesionales, renovación, la línea de tiempo y el link del garante — todo «Próximamente» o sólo-demo. Cerrado hoy (#154), con un guard que cruza los CTA contra las pantallas gateadas. |
| T-19 | 🧑 operativa | Lo de código está cerrado (T-57, T-58). |
| T-20 | ⛔ decisión | El caso mixto E2E está cerrado con test de integración. Lo abierto no es código: **cuánto cobra la inmobiliaria por administrar una unidad de solo expensas**. Hoy el sistema contesta «cero, y no se rinde nada» — coherente, pero nadie lo decidió. |
| T-21 | ⚠️ → ✅ | Cuatro pantallas ya decidían por `tipoContrato`. Faltaba la quinta: la card de `/comprobantes` imprimía «Alquiler $0» a un ocupante de solo expensas, y el contrato descargable le ponía el ajuste de un canon que no existe. Cerrado hoy (#149). |
| T-21-N1 | ✅ | |
| T-21-N1-N1 | ✅ | |
| T-21-N1-N2 | ✅ | |
| T-21-N2 | ⚠️ → ✅ | El guard del alta (400 si SOLO_EXPENSAS trae monto) estaba vivo, pero **sin un solo test**. Cerrado hoy (#152), con los dos caminos: ADMIN y la puerta de CARGA. |
| T-21-N3 | ✅ | |
| T-21-N3-N1 | ⛔ decisión | Cero SDK de LLM en el monorepo, confirmado. La mitad accionable —que el documento no afirme como implementado algo que no existe— ya está hecha. Falta decidir cuáles de esas capacidades se construyen. |
| T-22 | ⚠️ | Cargar la expensa del período está (entró como T-47). Avisar por mail **no se puede**: `UnidadFuncional` no tiene email → PARA-ALAN. |
| T-23 | ✅ | |
| T-23-N2 | ✅ | |
| T-23-N2-N1 | ⚠️ → ✅ | La columna `emailVerificadoAt` existía y **nadie la leía**: no estaba en ningún tipo del panel ni en ninguna pantalla. Cerrado hoy (#162). Quedan dos decisiones —el doble opt-in para el que nunca entra, y si se bloquea a los no verificados— → PARA-ALAN. |
| T-23-N3-N1 | ⛔ decisión | La escritura está hecha y verificada (`CambioParticipacion`, dentro de la transacción del PUT). Falta decidir dónde se lee ese historial. |
| T-23-N3-N2 | 🗑 obsoleta | Hacer lo que la ficha pide sería una **regresión**. Los filtros están sin `gte` a propósito: el anti-doble no es la fecha, es `descontadoEnRendicion`. La ventana estricta se sacó porque dejaba huérfano un gasto cargado tarde. |
| T-23-N4 | ✅ | |
| T-24 | ✅ | |
| T-32 | ✅ | |
| T-37-N1 | ⛔ decisión | El circuito entero de aprobación del pago manual. Ninguno de los 62 PRs del 02/09 lo tocó. |
| T-51 | ⚠️ → ✅ | La mitad publicada estaba; el seed de la API no. Diez contactos ficticios en dominios que existen —dos gmail, un yahoo, un hotmail y `rrhh@globant.com`—. Cerrado hoy (#151), con un guard que exige dominio reservado o excepción declarada. |
| T-57 | ✅ | |
| T-58 | ✅ | |
| T-61 | ✅ | |
| T-72 | 🧑 operativa | |

### Lo que cambió hoy, 03/09

Seis tareas parciales cerradas, todas con control negativo corrido:

| PR | Qué cierra |
|---|---|
| #149 | T-21 · la fila de «Alquiler» que un solo-expensas no debe ver |
| #151 | T-51 · el seed le escribía a dominios que existen |
| #152 | T-21-N2 · el freno del solo-expensas no tenía red |
| #154 | T-18 · el tour vendía pantallas vacías |
| #158 | T-17 · el profesional cerraba y al inquilino no le llegaba nada |
| #162 | T-23-N2-N1 · el panel muestra al propietario cuyo mail nadie confirmó |
| #157 | T-11 · la traza de quién tocó la garantía y el contacto del inquilino (de otra sesión) |

Y uno de higiene: **#161**, porque el detector del guard de #154 leía los comentarios como
código y le pintaba un rojo ajeno a quien tocara cerca.

---

---

## Cómo leer una tarea

Cada una trae:

- **Experto** — qué perfil debería tomarla (ver tabla abajo).
- **Prioridad** — 🔴 bloquea operar · 🟠 duele, hay workaround · 🟡 mejora · ⬜ necesita decisión.
- **Estado verificado** — qué encontramos HOY en el código, con `archivo:línea`. Esto es lo
  que evita rehacer trabajo o construir sobre un supuesto falso.
- **Qué hay que hacer** — el alcance concreto.
- **Criterio de aceptación** — cómo se sabe que está terminada. Si no se puede verificar, la
  tarea está mal escrita.
- **Riesgo** — qué puede romper. Las que tocan plata lo dicen explícito.
- **Depende de** — qué tiene que estar antes.

### Tipos de experto

| Sigla | Perfil | Qué domina |
|---|---|---|
| **BE** | Backend | Fastify, Prisma, la aritmética de plata, guards y multi-tenant |
| **FE-P** | Frontend panel | Next 14 App Router, TanStack Query, el panel de la inmobiliaria |
| **FE-I** | Frontend PWA | Next 14, mobile-first, la app del inquilino |
| **FS** | Full-stack | Tareas que cruzan API y front y no se pueden partir sin perder el hilo |
| **DATA** | Datos y migraciones | Prisma migrate, SQL, backfills, consultas de verificación |
| **SEC** | Seguridad | Auth, tokens, permisos, aislamiento de tenant |
| **PROD** | Producto / UX | Decisiones de flujo y de copy. **No escribe código: define qué se construye** |
| **QA** | Verificación | E2E, consultas de lectura contra prod, tests |
| **OPS** | DevOps | Railway, deploys, CI, migraciones en producción |

> ⚠️ **Regla que atraviesa todo el documento — CORREGIDA el 19/08.** La versión anterior de
> esta nota decía que los tests de `apps/api` "pegan a la Postgres de producción". **Es falso**,
> y la corrección importa porque esa creencia bloqueó tareas de cobertura que sí se podían hacer.
>
> Lo que dice `docs/TESTING.md` § "Contra qué DB": **hay dos instancias**. Producción corre
> dentro de Railway y se alcanza sólo por el host **interno** `*.railway.internal`, inalcanzable
> desde una máquina de desarrollo. La que usan los tests es el **proxy público**
> `*.proxy.rlwy.net`, que es la instancia de **test/dev**.
>
> Lo que sí es cierto: `seedBase` es **destructivo-idempotente** y las suites comparten la base
> (`fileParallelism: false`). Entonces la regla real es **verificar contra qué apunta tu
> `DATABASE_URL` antes de correr**, no "no correr nunca".
>
> Desde el 19/08 eso ya no depende de la memoria de nadie: `seedBase` tiene un **guard
> anti-producción** que falla cerrado (`apps/api/prisma/guard-db.ts`). Ante una URL de prod, una
> URL vacía o un host desconocido, **no corre**. Antes no tenía ninguno: el único guard del repo
> estaba en `limpiar-test-db.ts`.
>
> De los 64 archivos de test, **12 son puros** (sin DB) y corren en cualquier lado sin
> configurar nada.

---

# BLOQUE A — Cerrar lo que ya está construido

Sin este bloque, el trabajo hecho no le llega a Camila. **Es lo primero.**

---

## T-01 · Aplicar las migraciones pendientes (contalas: hoy son TRECE) — ✅ HECHO 20/08

> ## ✅ CERRADA. Las trece corrieron en producción el 20/08/2026 a las 01:10:30 UTC.
>
> Deploy `1d6f9d4b-3401-43c9-9720-60ed9652b2be`, commit `94d4000`, estado **SUCCESS**.
> El log dice `All migrations have been successfully applied.` sobre 57 migraciones totales.
> Los tres servicios (`myalquiler-back`, `-front`, `-inquilino`) quedaron en `94d4000`.
>
> **Lo de abajo es el plan previo y ya no hay que ejecutarlo.** Se conserva porque explica el
> orden y el porqué de cada una, que sigue siendo la referencia si algo hay que revisar.
>
> **Y una regla que ahora vale más que el plan: estas trece ya están aplicadas, así que ninguna
> se vuelve a editar.** Si hay que cambiar algo que hizo una de ellas, va en una migración NUEVA.
>
> **Por qué — y ojo que el motivo NO es el que parece.** Yo escribí acá que editar una migración
> aplicada rompía el arranque, porque `prisma migrate deploy` iba a fallar por checksum y el
> contenedor no iba a levantar. **Es falso, y lo probó la realidad el mismo día:** el 20/08
> modifiqué `limpiar_pines_heredados` para que guardara evidencia forense antes de borrar, ese
> commit se pusheó por error a `main` (`99f119d`) y el deploy `819ce76a` salió **SUCCESS** —
> el log dice `No pending migrations to apply.` y el server arrancó normal. `migrate deploy` sólo
> aplica las pendientes; no verifica el checksum de las que ya están.
>
> **El daño real es otro, y es peor porque es silencioso:** el repo pasa a describir una base que
> no existe. Ese archivo creaba una tabla `_t35_usuarios_con_credencial` que en producción **nunca
> se creó**, y nada avisaba. Quien leyera el repo iba a creer que estaba. Y una base de dev creada
> desde cero con estas migraciones habría quedado con un schema distinto al de prod. Además
> `prisma migrate dev` y `migrate status` sí lo marcan, así que le explota en la cara al próximo
> que trabaje en local.
>
> Se revirtió al contenido realmente aplicado (35 líneas) en `fix/restaurar-migracion-t35`.

> ### ⚠️ LEER ANTES: `work-agent/tareas/T-01-N2/PREFLIGHT-DEPLOY.md`
>
> Las trece se auditaron una por una (19/08). **T-01 y T-02 son la misma cosa**: el contenedor
> corre `prisma migrate deploy` antes de arrancar la app (`apps/api/Dockerfile:30`), así que
> deployar la API ES aplicar las migraciones, y el "primero la migración, después el código"
> que piden cinco de ellas queda garantizado por construcción.
>
> **Ninguna de las trece puede fallar sobre datos reales** — verificado, no supuesto: los cuatro
> `ADD VALUE` usan `IF NOT EXISTS` y no usan el valor nuevo en su propia transacción; el único
> índice único va sobre una tabla vacía; y el UPDATE de DNI lleva un `NOT EXISTS` que esquiva el
> `@@unique([inmobiliariaId, dni])` que lo habría volteado.
>
> **Sí conviene correr dos consultas de solo lectura antes** (están en el documento): dicen
> cuántas fichas quedan para fusionar a mano después de normalizar emails y DNIs.
>
> **Y el orden con T-03:** `rol_caja` se aplica en el deploy, así que **T-02 va antes que T-03**.

> ### ⚠️ Antes que nada: NO hay paso manual. Se aplican solas.
>
> `apps/api/Dockerfile:30` arranca con `CMD ["sh","-c","pnpm db:deploy && exec node
> dist/index.js"]`, y `db:deploy` es `prisma migrate deploy`. **Las migraciones corren en el
> deploy, antes de que el proceso levante**, y si fallan el contenedor no arranca (`&&`) — o sea
> que nunca puede quedar código nuevo contra un esquema viejo, que era el riesgo que esta tarea
> quería evitar. Una versión anterior decía "aplicalas a mano antes de desplegar": era falsa, y
> peligrosa al revés, porque invitaba a tocar la base sin necesidad.
>
> Lo de abajo **sigue valiendo igual**: es la verificación de QUÉ va a correr y en qué orden, y
> los dos avisos (#5 y #8) son cosas que hay que mirar antes de apretar deploy.

> ### ✅ Verificación previa hecha — 19/08
>
> **El título dijo CUATRO, después OCHO, DIEZ, ONCE, y al momento de escribir esto TRECE.** Se fue quedando corto mientras varios
> chats escribían migraciones en paralelo. Aplicar sólo las cuatro que la tarea nombraba deja
> el portal del propietario respondiendo 500.
>
> Las trece, en el orden exacto en que Prisma las va a correr (ordena por nombre de directorio):
>
> | # | Migración | Qué hace | Riesgo |
> |---|---|---|---|
> | 1 | `20260818120000_rol_caja` | `ALTER TYPE "Rol" ADD VALUE CAJA` | — |
> | 2 | `20260818130000_movimiento_caja_sin_propiedad` | `propiedadId` pasa a nullable | — |
> | 3 | `20260819120000_evento_contrato_renovacion` | `ADD VALUE RENOVACION` | — |
> | 4 | `20260819120000_otp_propietario` | `CREATE TABLE codigos_otp_propietario` | — |
> | 5 | `20260819140000_email_propietario_minusculas` | UPDATE: baja los emails a minúsculas | ⚠️ ver abajo |
> | 6 | `20260819140000_limpiar_pines_heredados` | UPDATE: borra los PIN que nadie eligió | — |
> | 7 | `20260819160000_dni_persona_solo_digitos` | UPDATE: normaliza DNI | — |
> | 8 | `20260819160000_propietario_baja_logica` | `ADD COLUMN activo` | 🔴 **orden** |
> | 9 | `20260819180000_conmutador_usuarios` | `ADD VALUE` ×4 en `TipoEventoAuditoria` | — |
> | 10 | `20260819180000_destinatario_por_aviso` | `CREATE TYPE` + `CREATE TABLE destinatarios_aviso` | — |
> | 11 | `20260819200000_historial_reparto` | `CREATE TABLE cambios_participacion` | — |
> | 12 | `20260819220000_rendicion_moneda` | `ADD COLUMN moneda` en `rendiciones` | — |
> | 13 | `20260819220000_sacar_texto_del_inquilino_de_gastos` | UPDATE: saca el texto del inquilino de los gastos ya rendidos | — |
>
> **Sobre la 12 y la 13, las más nuevas:** la 12 (`rendicion_moneda`) es aditiva pura con
> default, así que las rendiciones existentes quedan en ARS — que es lo que eran. La 13 es la
> ÚNICA que borra texto: recorta de `gastos_rendidos.descripcion` el relato del inquilino que
> se estaba filtrando al propietario (T-01-N1-N2). Sólo toca las filas con el prefijo exacto
> que generaba el template; las notas del operador no se tocan. Su archivo trae una consulta
> para contar cuántas filas va a modificar **antes** de correrla.
>
> **Sobre la 10 y la 11, agregadas después de esa verificación:** las dos son
> **aditivas puras** —`CREATE TYPE` / `CREATE TABLE`, cero filas escritas, cero columnas
> alteradas— y las dos **van antes que su código**. La 11 (`historial_reparto`) conviene
> aplicarla **cuanto antes**, no por riesgo sino porque hasta que exista no se registra ningún
> cambio de dueño, y eso es historial que después no se puede reconstruir.
>
> ⚠️ **Este número se quedó corto dos veces.** Antes de correr, contá vos:
> `ls apps/api/prisma/migrations/ | grep -E '^20260818|^20260819'`
>
> **Lo que se verificó, leyendo las ocho primeras:**
>
> - **Las ocho son idempotentes.** Las de schema usan `IF NOT EXISTS`; las tres de datos tienen
>   un `WHERE` que excluye las filas ya normalizadas. Re-correrlas no hace nada.
> - **Ninguna depende de otra**, así que los tres pares que comparten timestamp no son un
>   problema: Prisma ordena por nombre de directorio y el desempate alfabético es inocuo acá.
> - **Los `ALTER TYPE ... ADD VALUE` van solos en su archivo**, que es lo que hay que hacer:
>   Postgres no permite *usar* un valor de enum en la misma transacción que lo crea.
> - **El schema y las migraciones coinciden.** Los tres cambios de `schema.prisma` de hoy
>   (`RENOVACION`, `CodigoOtpPropietario`, `Propietario.activo`) tienen su migración, y las dos
>   de ayer siguen reflejadas. **No hay ningún campo en el schema sin su columna** — que es el
>   modo de fallo peor, porque el deploy pasa y la app rompe en runtime.
> - **El orden de los enums no importa.** `ADD VALUE` los agrega al FINAL en Postgres, no donde
>   dice el schema, pero ningún `orderBy` del código toca `Rol` ni `TipoEventoContrato`.
>
> **🔴 La #8 va ANTES del deploy, no después.** `requirePropietario` lee `activo` en cada
> request: contra una base sin esa columna, el portal del propietario responde 500. Es la única
> con orden obligatorio respecto del deploy.
>
> **⚠️ La #5, un aviso.** Bajar los emails a minúsculas puede dejar dos propietarios del mismo
> tenant con el mismo email. Hoy no falla —`Propietario` no tiene `@@unique`— pero si más
> adelante se decide agregarlo (ver T-23-N2-N1), los duplicados ya van a estar ahí. Conviene
> correr antes: `SELECT "inmobiliariaId", lower(trim(email)), count(*) FROM propietarios
> WHERE email <>  GROUP BY 1,2 HAVING count(*) > 1;`
>
> **Lo que NO se pudo verificar desde acá:** que corran de verdad. No hay Postgres en esta
> máquina ni acceso a la base. Todo lo anterior sale de leer el SQL y cruzarlo contra el schema.
> Antes de producción conviene aplicarlas contra la instancia de test y mirar que `prisma
> migrate status` quede limpio.

**Experto:** DATA + OPS · **Prioridad:** 🔴 · **Depende de:** nada

> ⚠️ **Esta tarea decía "las dos migraciones pendientes" y quedó desactualizada.** Los chats
> paralelos sumaron dos más. Aplicar sólo dos y desplegar el backend nuevo **rompe producción**:
> el código nuevo pegaría contra un schema viejo. Recontado el 19/08 sobre la rama de trabajo.

**Estado verificado.** Cuatro migraciones **escritas y sin aplicar**, en este orden:

| # | Migración | Qué hace | Riesgo |
|---|---|---|---|
| 1 | `20260818120000_rol_caja` | `ALTER TYPE "Rol" ADD VALUE 'CAJA'` | Aditiva |
| 2 | `20260818130000_movimiento_caja_sin_propiedad` | `propiedadId` pasa a nullable | Aditiva |
| 3 | `20260819120000_otp_propietario` | `CREATE TABLE codigos_otp_propietario` + FK (T-23) | Aditiva, no toca ninguna fila |
| 4 | `20260819140000_limpiar_pines_heredados` | `UPDATE usuarios SET "pinHash" = NULL …` (T-35) | **Escribe datos** |

**Las cuatro van ANTES del deploy del backend.** Las tres primeras son aditivas y compatibles con
el código viejo, así que aplicarlas temprano no rompe nada; al revés sí (código nuevo contra
schema viejo revienta).

**La cuarta es distinta y conviene entenderla antes de correrla.** Es la única que **modifica
filas**: borra todos los `pinHash`. Hoy es inocua —`verificarPinUsuario` siempre aprueba, así que
ningún `pinHash` autentica nada— y es lo que garantiza que, cuando entre T-25, ningún PIN
heredado del admin sirva para hacerse pasar por él. **No es reversible** (los hashes no se
recuperan), pero tampoco se pierde nada: ninguno autenticó nunca.

> **Ojo con el orden si T-25 avanza:** la #4 tiene que correr **antes o junto** con lo que
> habilite el conmutador de usuarios. Si T-25 entra primero, hay una ventana en la que los PIN
> heredados autentican de verdad.

**Antes de la #4, corré la consulta de T-35** para saber a cuántos afecta. Es de sólo lectura y
te dice si hubo un escalamiento posible o si no había nadie.

**Por qué ese orden importa.** Las dos son *aditivas*: agregar un valor a un enum y relajar un
`NOT NULL` son compatibles con el código viejo, así que aplicarlas primero no rompe nada. Al
revés sí rompe: código nuevo contra enum viejo hace que un alta con rol `CAJA` falle con un
error de enum inválido, y un movimiento sin propiedad reviente el `NOT NULL`.

**Criterio de aceptación.**
- `SELECT unnest(enum_range(NULL::"Rol"));` incluye `CAJA`.
- `movimientos_caja.propiedadId` es nullable.
- La tabla `codigos_otp_propietario` existe, vacía, con su FK a `propietarios`.
- `SELECT count(*) FROM usuarios WHERE "pinHash" IS NOT NULL;` devuelve **0**.
- Fuera del `pinHash`, ninguna fila cambió: los usuarios conservan su rol y todos los
  movimientos conservan su propiedad.

**Riesgo.** Bajo para las tres primeras, y son reversibles *mientras no se use la capacidad
nueva* (para volver atrás del `DROP NOT NULL` habría que imputarle una propiedad a los
movimientos cargados sin ella). **La cuarta no es reversible**: los `pinHash` borrados no se
recuperan. Es aceptable porque ninguno autenticó nunca, pero es una decisión consciente, no un
trámite.

---

## T-02 · Deployar los tres servicios y verificar qué quedó arriba — ✅ HECHO 20/08

> ## ✅ CERRADA. Los tres servicios quedaron en `94d4000` el 20/08/2026 a las 01:09:45 UTC.
>
> | Servicio | Deploy | Estado |
> |---|---|---|
> | `myalquiler-back` | `1d6f9d4b` | SUCCESS |
> | `myalquiler-front` | `7b75cfb7` | SUCCESS |
> | `myalquiler-inquilino` | `8873507e` | SUCCESS |
>
> Sin errores en el log de deploy (sólo un aviso de corepack y un *deprecation* de Prisma sobre
> `package.json#prisma`, ninguno bloqueante). Smoke test a los 7 minutos: `GET /health` → **200**;
> `/rendiciones`, `/caja/movimientos`, `/metricas/resumen`, `/portal/rendiciones` y
> `/mis-liquidaciones` → **401 sin token**, que es el comportamiento correcto. **Ningún 5xx.**
>
> **Ojo con la métrica de Railway:** marca 85,7% de error rate. Es un artefacto de ese mismo
> smoke test —6 de 7 requests fueron sondas sin auth— sobre una muestra de 7 a las 22h de
> Argentina. No es una caída.
>
> **`apps/propietario` NO deployó, porque no es un servicio de Railway.** El proyecto tiene tres
> servicios de app y ninguno es el portal del propietario. Eso confirma T-46 desde el otro lado:
> no es que el pipeline falle, es que **no existe**. Sigue abierto en T-46-N1.
>
> **La premisa de esta tarea era falsa** — decía que había que correr `railway up` a mano. Ver la
> corrección al principio de `02-DEPLOY.md`: los servicios sí están conectados a GitHub y el
> push a `main` deployó los tres solo.

**Experto:** OPS · **Prioridad:** 🔴 · **Depende de:** T-01

> ### ⚠️ Corregido el 20/08: los puntos 1 y 2 YA ESTÁN HECHOS, y la premisa era falsa.
>
> Los servicios **sí** están conectados a GitHub: el push del merge `94d4000` disparó los tres
> deploys solos (`1d6f9d4b`, `7b75cfb7`, `8873507e`, los tres SUCCESS, misma hora que el push).
> `/health` devuelve `{"ok":true,"db":"up","version":"94d4000"}` y las trece migraciones se
> aplicaron en ese mismo deploy. Ver `02-DEPLOY.md`, sección "Qué hay arriba — 20/08/2026".
>
> **Queda pendiente sólo el punto 3**, el smoke test de los cinco caminos con credenciales
> reales sobre el tenant real. El punto 4 (dejar registrado qué se subió) se hizo en T-02-N1,
> junto con el `<meta name="build-commit">` que faltaba para poder verificar los fronts.

**Estado verificado (previo, incorrecto).** ~~Los servicios de Railway **no están conectados a
GitHub** (`02-DEPLOY.md:31`): pushear a `main` **no** deploya. Hay que correr `railway up` a mano,
por servicio.~~ El backend expone la versión que corre en `GET /health` (`health.ts:29-31`), pero
**ningún front expone un build-id cruzable con git**, así que hoy no hay forma de saber en qué
commit están el panel y la PWA.

**Qué hay que hacer.**
1. Deployar los tres servicios (api, inmobiliaria, inquilino).
2. Verificar el backend: `GET /health` tiene que devolver el SHA de la rama mergeada.
3. Smoke test de los caminos tocados: cambiar modo de cobranza, alta con cobranza directa sin
   CBU, la campana del panel, la bandeja de aprobaciones, un gasto de caja sin propiedad.
4. **Dejar registrado en `02-DEPLOY.md` qué se subió y cuándo** — ese documento está
   desactualizado desde el 04/07 y por eso nadie sabía qué había en prod.

**Criterio de aceptación.** `GET /health` devuelve el commit esperado, los cinco caminos del
smoke test funcionan, y `02-DEPLOY.md` refleja la realidad.

**Riesgo.** Medio: es el primer deploy después de un cambio de permisos. Ver T-03, que tiene
que salir **junto** con este.

---

## T-03 · Reasignar a rol CAJA al personal de mostrador, y avisarles antes

**Experto:** PROD (con OPS) · **Prioridad:** 🔴 · **Depende de:** T-02

**Estado verificado.** `pago.conciliar` y `pago.rechazar` pasaron de `['ADMIN','OPERADOR']` a
`['ADMIN','CAJA']` (`packages/shared/src/permisos.ts`). El rol de cada usuario **no se migró**:
la migración sólo agrega el valor al enum.

**Qué hay que hacer.** Después del deploy, entrar a Configuración → Equipo y pasar a rol
**CAJA** a quien atienda el mostrador. Y **avisarle a Camila antes de que su equipo se lo
encuentre**.

**Por qué es una tarea y no un detalle.** Entre el deploy y la reasignación, **las personas con
rol OPERADOR dejan de poder confirmar pagos**. Es exactamente lo que Camila pidió
(*"nadie puede autorizar un pago"* salvo caja y ella), pero si se lo encuentran sin aviso lo
van a vivir como que el sistema se rompió — que es precisamente la sensación que venimos
tratando de sacarle.

**Criterio de aceptación.** El equipo de Camila tiene sus roles asignados, ella entiende el
cambio, y una persona con rol CAJA puede confirmar un pago de punta a punta.

**Riesgo.** Operativo, no técnico. Se mitiga con el aviso previo.

> **Verificación 20/08 (T-03-N1, commit `15cb6d3`) — el rol le alcanza.** Antes de reasignar
> gente real se trazó la cadena entera contra el código: sidebar → bandeja (`pagos.ver`) →
> abrir el contrato (`contratos.ver`) → confirmar (`pago.conciliar`, que es lo que exige
> `POST /pagos/:id/validar` **y** lo que gatea los botones en `pagos-por-validar.tsx:121`) →
> rechazar → cobrar en efectivo → cerrar el día. **No falta ningún eslabón**, y queda fijado
> con un test que se pone rojo si alguien le saca una capacidad a CAJA.
>
> Dos sospechas que se revisaron y resultaron infundadas, para que nadie las vuelva a auditar:
> la pantalla de pagos gatea con `contrato.aprobar` (ADMIN) pero **sólo el tab de aprobaciones
> de contratos**, no los botones; y `normalizarRol` cae a LECTURA ante un rol desconocido —el
> modo clásico de que un rol NUEVO entre mudo al menú de solo lectura— pero valida contra
> `ROLES_ORDEN`, así que CAJA pasa.
>
> **Lo que sigue siendo tuyo:** reasignar los roles y avisarle a Camila antes.

> **Actualización 19/08 — el golpe es más blando de lo que decía esta tarea.** Cuando se
> escribió, una operadora que intentara confirmar un pago se comía un **403 crudo**: el botón
> estaba ahí, lo tocaba, y el sistema le tiraba un error. Eso es exactamente "el sistema se
> rompió".
>
> Con **T-40**, la pantalla de pagos ahora se gatea por capacidad: la operadora **ve la bandeja
> igual** (sigue sabiendo qué hay pendiente, que es la mitad útil de la pantalla) pero en lugar
> de los botones lee *"Confirmar o rechazar un pago lo hace Administrador o Caja"*.
>
> **El aviso previo a Camila sigue haciendo falta** —que su equipo pierda una capacidad sin que
> ella lo sepa no se arregla con un cartel— pero la ventana entre el deploy y la reasignación
> ya no se vive como una falla.

---

## T-04 · Cerrar la duda de los $850 con una consulta a la base

**Experto:** QA + DATA · **Prioridad:** 🔴 · **Depende de:** nada

**Qué pidió Camila.** `[59:22]` *"Ahora yo tengo algo contabilizado que es tuyo, que yo no lo
aprobé ni sé qué pagaste… me sale que yo cobro 850, yo solo autoricé 550 mil."*
En la reunión se concluyó `[59:47]`: *"parece que los pagos parciales no pasan por aprobación"*.

**Estado verificado — esa conclusión NO es lo que hace el código.** Trazado línea por línea:

| Qué se revisó | Resultado |
|---|---|
| `POST /pagos/informar` (`plata.ts:1275-1300`) | Crea el `Pago` **sin setear `estado`** ⇒ toma el default del schema, `INFORMADO` (`schema.prisma:1691`). Parcial y total nacen igual |
| `GET /pagos` (`plata.ts:279-306`) | **No filtra por `tipo`** ⇒ un parcial informado sí aparece en la bandeja |
| `montoPagadoPorLiquidacion` (`lib/saldos.ts:15`) | Suma **sólo `CONCILIADO`** |
| `GET /caja/cierre` (`plata.ts:174-186`) | `CONCILIADO` + `condonado:false` + día civil argentino + `modoCobranza:'INMOBILIARIA'` |
| Cartelón "Cobrado" del panel (`pagos/page.tsx:265-279`) | Usa `montoPagado`, que viene del API |

**Ninguna ruta convierte un pago informado por el inquilino en cobrado sin que alguien lo
valide.**

**Qué hay que hacer.** Una consulta **de sólo lectura** a producción:

```sql
SELECT p.id, p.estado, p.tipo, p.monto, p.condonado,
       p."decididoPorId", p."decididoAt", p."informadoAt", l.periodo
FROM pagos p JOIN liquidaciones l ON l.id = p."liquidacionId"
WHERE p."contratoId" = '<contrato de la prueba>'
ORDER BY p."informadoAt";
```

Con eso se distingue entre las tres hipótesis: (a) validó el segundo pago sin registrarlo —
estuvo clickeando mucho y a `[43:04]` le avisaron de un deploy en vivo; (b) estaba mirando el
cartelón del mes y no la bandeja; (c) fue un estado intermedio de deploy.

**Criterio de aceptación.** Saber cuál de las tres fue, escrito en este documento. Si —contra
lo que dice el análisis— apareciera un `CONCILIADO` sin `decididoPorId`, eso **sí** sería un
bug grave y abre una tarea nueva con prioridad máxima.

**Riesgo.** ⚠️ **Ninguna tarea puede tocar el flujo de pagos antes de que esta cierre.** Es el
código mejor blindado del sistema (índice único parcial sobre `INFORMADO`, locks atómicos, seis
caminos que setean `tipo` explícito) y el riesgo de "arreglar" algo que funciona es alto.

---

## T-05 · Congelar los deploys durante las sesiones de prueba

**Experto:** OPS + PROD · **Prioridad:** 🟠 · **Depende de:** nada

**Estado verificado.** Durante la reunión del 03/08 el equipo estaba **deployando a producción
en vivo**: `[15:36]` *"voy a apuntar al equipo si lo subieron a producción"*, `[35:05]`
*"Agustín indagando que hay cosas que no lanzaban a producción"*, `[43:04]` *"ahí está[n
deployando] los chicos de la parte de caja"*, `[49:49]` *"eso recién estamos subiendo a
producción"*.

**Por qué importa.** Camila probó contra un blanco móvil. Una parte de lo que reportó puede
ser estado intermedio de deploy y no un bug — y no hay forma de distinguirlo después. Es
tiempo de la clienta cero gastado en ruido.

**Qué hay que hacer.** Acordar que durante las sesiones no se deploya, y que lo que se
encuentra se anota y se sube después. Si hace falta subir algo sí o sí, avisarlo y anotar la
hora para poder descartar los reportes de esa ventana.

**Criterio de aceptación.** La próxima sesión corre sobre un build estable, identificado por
el SHA de `/health` al empezar.

---

# BLOQUE B — Terminar lo que quedó a medias

---

## T-06 · Extender el rótulo de propiedad al resto del panel

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA** — rama `feat/reunion-camila-0308`.

Aplicado en listado y detalle de contratos, detalle de propiedad, alta de contrato (select
y resumen), reclamos (listado, detalle y los de la ficha de propiedad), renovaciones,
anuncios, pagos del mes (tabla, cards, panel de morosos y las **3 exportaciones**),
ficha de propietario e historial de rendiciones.

**Faltaba el dato, no sólo el render.** El backend mandaba `consorcio.nombre` pero **no**
`complejo`: `GET /contratos`, `GET /reclamos`, `GET /reclamos/:id` y `GET /renovaciones`
seleccionaban la propiedad campo por campo y lo dejaban afuera. Con el rótulo aplicado y sin
ese campo, una propiedad con complejo cargado pero sin consorcio ligado habría seguido
mostrando la calle — el bug original, disfrazado de arreglado. `GET /propietarios/:id` sí lo
mandaba (hace `include` completo), pero el tipo del cliente no lo declaraba y se perdía al
mapear.

**El riesgo se cumplió y se manejó.** Donde el destinatario está afuera de la oficina, la
calle manda: el WhatsApp de cobranza al inquilino/garante (`morosos-panel.tsx:212`) sigue
interpolando `contrato.direccion` cruda. En reclamos se usó `rotuloEnLinea` y no
`rotuloPrincipal` a propósito — la orden termina en un plomero que tiene que llegar a la
puerta, así que el rótulo suma el complejo **sin sacar** la calle. Ídem el hero de la
propiedad: el título pasó a ser el complejo y la dirección bajó junto a la ciudad.

**De yapa:** buscar por complejo en contratos y anuncios (escribir "Lourdes" lista sus dos
unidades) y los placeholders actualizados, que antes decían "inquilino o dirección".
`detectarConsorcio` de morosos-panel quedó intacto: hace un heurístico con
`direccion.split(',')` y sigue recibiendo la calle cruda porque `complejo` se sumó como campo
aparte, sin pisar `ContratoListado.direccion`.

**Verificación.** Typecheck limpio en `apps/api` y `apps/inmobiliaria`; lint sin warnings
nuevos; recorrido en el navegador de contratos, propiedad, reclamos, pagos y propietario, con
la consola sin errores. Se cargó `complejo` en los mocks (Complejo Lourdes ×2, Torres del
Parque) para que el build demo muestre la mejora y no sólo el fallback.

**Deuda:** sin test unitario de `rotulo-propiedad.ts` — `apps/inmobiliaria` no tiene runner
(es T-32). `next build` no se pudo correr: el guard de puerto aborta si hay un dev server vivo
en 3001.

**Qué pidió Camila.** `[24:04]` *"Todos tenemos un nombre de referencia."* `[22:57]` *"Yo me
guío directamente por el complejo. Nosotros cuando decimos Lourdes no le decimos nunca Artigas
la dirección."* `[25:09]` *"Que en grande me salga el complejo."*

**Estado verificado — hecho a medias.** Existe el helper único
`apps/inmobiliaria/src/lib/rotulo-propiedad.ts` (`rotuloPrincipal` / `rotuloSecundario` /
`rotuloEnLinea`, prioridad **consorcio real > complejo > dirección**) y ya está aplicado en el
**listado de propiedades** y en la **ficha de aprobación**. El dato viaja del API desde antes
(`core.ts:355-380` incluye `complejo` y `consorcio.nombre`).

**Qué falta.** Aplicar el helper en el resto de las superficies donde hoy se muestra la
dirección pelada:

- listado y detalle de contratos
- detalle de propiedad
- selects de propiedad (alta de contrato, caja, reclamos, anuncios)
- listado y detalle de reclamos
- rendiciones y el texto de WhatsApp que se le manda al propietario
- PDF de cobranzas del mes

**Criterio de aceptación.** Una propiedad con `complejo` cargado se muestra por su nombre —con
la dirección como dato secundario— en **todas** las pantallas del panel. Una sin complejo sigue
mostrando la dirección, sin renglones vacíos ni guiones sueltos.

**Riesgo.** Bajo, es display. Cuidado con no perder la dirección donde hace falta de verdad:
el contrato impreso, la orden al profesional y el comprobante al propietario **tienen que
seguir mostrando la calle**.

---

## T-07 · Completar el expediente del contrato

**Experto:** FS · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA** — commit `04ea61e`, rama `feat/reunion-camila-0308`.
Al ejecutarla se confirmó que **garantes y documentos ya andaban** (su queja era del 03/08 y eso
se resolvió después) y apareció el hueco real: **el Historial mentía por omisión**. Se cerró eso
+ servicios + link a la persona. Quedó afuera a propósito la pestaña Comunicaciones (ver T-17 /
T-18) y se abrió **T-29**.

**Qué pidió Camila.** `[49:52]` *"No cargó nada de los garantes, no tengo documentos, no tengo
servicios, no tengo persona… debería dejar en la parte de expediente."*

**Estado verificado — parcial.** La **ficha de aprobación** ya muestra garantes y cantidad de
documentos, y dice explícitamente cuándo no hay (`bandeja-aprobaciones.tsx`, commit `89132c9`).
Falta confirmar qué pasa en el **detalle del contrato** ya activo: si lo que se carga en el
alta llega a las pestañas de documentos, garantes y servicios, o si hay un hueco real entre lo
que el wizard recibe y lo que el detalle muestra.

**Qué hay que hacer.**
1. Cargar un contrato completo (garantes, documentos, servicios) y verificar pestaña por
   pestaña qué aparece y qué no.
2. Documentar el hueco concreto: ¿el alta no lo guarda, o el detalle no lo lee?
3. Cerrarlo del lado que corresponda.

**Criterio de aceptación.** Todo lo que se carga en el alta se ve después en el expediente. Lo
que no se cargó se muestra como "no cargado", no como vacío ambiguo.

**Nota.** Hay un hallazgo relacionado del mapa del sistema: **`EventoContrato` es write-only** —
se escribe en `core.ts:1784` y `core.ts:2833` y **ningún endpoint lo devuelve**, así que la
pestaña "Historial" dice siempre *"Sin eventos registrados"* aunque en la base haya trazas. Un
`GET /contratos/:id/eventos` son ~10 líneas y llena una pestaña que hoy miente por omisión.

---

# BLOQUE C — El alta y la carga de datos

---

## T-08 · Encabezado fijo con la propiedad durante todo el wizard

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** T-06 (para usar el mismo rótulo)

**Qué pidió Camila.** `[19:06]` *"Estoy adentro de un contrato y no sé en qué inmueble estoy,
no lo veo."* `[21:19]` *"Tendría que dejar puesto que es Lourdes 11 primero A, de lo que ella
está poniendo, que quede siempre arriba, que se vea la propiedad."*

**Estado verificado — no hecho.** El wizard (`contratos/nuevo/page.tsx`) elige la propiedad en
el paso 1 y después no la vuelve a mostrar de forma persistente.

**Qué hay que hacer.** Una barra fija (sticky) arriba del wizard, visible desde el paso 2 en
adelante, con el rótulo de la propiedad elegida (usando `rotuloPrincipal` + `rotuloSecundario`)
y un modo de volver a cambiarla.

**Criterio de aceptación.** En cualquier paso del alta, sin scrollear, se ve de qué propiedad
es el contrato que se está cargando.

**Riesgo.** Bajo. Cuidar el alto en mobile: el panel es desktop-first pero se usa en pantallas
chicas.

---

## T-09 · Revisar qué campos bloquean el alta del inquilino

**Experto:** FE-P + PROD · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA** — commit `b3e9efa`.
**La respuesta a su pregunta es SÍ, y ya era sí el 03/08.** El backend sólo exige `nombre`;
front y zod tienen todo lo demás opcional, y esa línea no cambia desde el 15/06. No había nada
que mover a opcional. Lo que sí faltaba —y entró— es avisar que **sin email el inquilino no
puede entrar a la app** (el login es OTP por mail): el copy lo vendía como que "ayuda a
invitarlo". El aviso no bloquea, porque cargar la cartera con lo que hay es legítimo.

**Qué pidió Camila.** `[15:01]` *"Te pide whatsapp, foto del DNI del inquilino, ¿pueden
continuar?"* — la pregunta quedó **sin responder** en la reunión.

**Estado verificado — sin verificar.** No se revisó qué campos son obligatorios hoy en el paso
del inquilino ni cuáles bloquean el avance.

**Qué hay que hacer.**
1. Listar los campos del paso de inquilino y cuáles son obligatorios (front y zod del backend).
2. Para cada obligatorio, preguntarse: *¿la inmobiliaria puede tener este dato en el momento de
   cargar el contrato?* El email sí es necesario (la activación del inquilino es por email). La
   foto del DNI **no debería** bloquear: es documentación que llega después.
3. Mover a opcional lo que no sea imprescindible, y dejar el resto como pendiente visible en el
   expediente.

**Criterio de aceptación.** Se puede dar de alta un contrato con los datos que la inmobiliaria
realmente tiene el día que firma, y lo que falta queda marcado como pendiente en algún lado.

**Riesgo.** Producto: aflojar validaciones puede llenar la base de contratos incompletos. Por
eso va con PROD, no sólo con front.

---

## T-10 · Unificar el flujo propiedad → contrato → inquilino

**Estado: ✅ HECHA** — los pasos 1→3 ya estaban encadenados (`0427afa`, `afbf08f`); lo que
faltaba era **el final del recorrido**, y eran dos cortes concretos: (1) el wizard terminaba en
`/contratos` —una lista donde había que **buscar** el contrato recién creado— aunque `creado.id`
ya se usaba doce líneas antes para subir los documentos; (2) las acciones sobre el inquilino
viven **sólo** en la ficha de la propiedad, y desde el detalle del contrato el único link a la
propiedad estaba enterrado adentro de la card de servicios — o sea, había que volver al menú
lateral. Ahora el alta aterriza en `/contratos/{id}` y el rótulo del header es link a la ficha.
Recorrido verificado en el navegador: contrato → rótulo → ficha → pestaña Inquilino → "Reenviar
email de bienvenida", sin tocar el menú lateral.

**Pendiente de staging:** el aterrizaje en `/contratos/{id}` es camino `apiEnabled` y no se pudo
ejecutar (no hay `DATABASE_URL` en la máquina). Verificado por lectura, falta correrlo.

**Fuera de alcance, anotado:** en demo, crear una propiedad sigue cayendo en `/propiedades`
porque en demo la propiedad no se crea (`propiedades/nueva/page.tsx:487` es un `setTimeout`);
arreglarlo pide persistencia demo. Y `inquilino-actual-acciones.tsx:68` muestra "Cuenta activa"
fijo, sin mirar si el inquilino activó.

**Experto:** PROD (define) + FE-P (implementa) · **Prioridad:** 🟠 · **Depende de:** T-08, T-09

**Qué pidió Camila.** `[37:56]` *"Es como que de un lado tenés que entrar a propiedades,
después el otro tenés que ir al contrato, después lo otro tenés que ir al inquilino, como que
está medio… yo me pierdo, me cuesta."* Alan `[38:08]`: *"No está bueno eso, tenemos que hacerlo
más sencillo."*

**Estado verificado — parcial.** El commit `0427afa` (04/08) ya "sinceró el flujo de propiedad
y propietario", y en esta rama se arregló el peor síntoma: el botón **"Cargar inquilino"** de
la ficha de propiedad estaba **deshabilitado con "Próximamente"** y ahora lleva al alta con la
propiedad ya elegida (`cargar-inquilino-trigger.tsx`, commit `afbf08f`). El wizard ya entendía
`?propiedad=<id>` y arranca en el paso del inquilino.

**Qué falta.** El recorrido completo sigue sin diseñarse como una sola cosa. Esta tarea es
**primero de producto**: hay que decidir cuál es el camino único desde "tengo una propiedad
nueva" hasta "el contrato está activo y el inquilino invitado", y recién después implementarlo.

**Qué hay que hacer.**
1. **PROD**: mapear el recorrido actual (cuántas pantallas, cuántos clicks, dónde se corta) y
   definir el recorrido deseado. Idealmente con Camila delante, que es quien se pierde.
2. **FE-P**: implementar el encadenado, reusando lo que ya existe.

**Criterio de aceptación.** Camila carga una propiedad nueva con inquilino y contrato sin
volver al menú lateral ni una sola vez.

---

## T-11 · Que la administradora pueda editar un contrato que ya tiene pagos

**Experto:** BE + SEC + FE-P · **Prioridad:** 🟠 · **Depende de:** nada

**Qué pidió Camila.** `[53:50]` *"¿Deja editar y modificar los contratos una vez que ya tienen
pagos cargados?"* `[55:30]` *"Que se pueda editar siempre, pero solamente la administradora."*
`[56:28]` *"Puedo editar el número de teléfono del inquilino, cambiar el garante, porque eso
por ley también se puede."* Y el límite, acordado en la reunión con Alan `[56:55]`: **la fecha
de vigencia no** (y tampoco la dirección).

Su motivo es concreto `[54:22]`: hoy, en su sistema, para corregir un dato tiene que
**rescindir el contrato** — *"y me sale rescisión del contrato en el sistema porque me
equivoqué… la rescisión siempre tiene un costo"*. O sea: la falta de edición le está
ensuciando el historial con rescisiones falsas.

**Estado verificado — no hecho, pero hay más de lo que parece.** Ya existen endpoints de
edición parcial: `PATCH /contratos/:id/monto` (`core.ts:2737`), `PUT /contratos/:id/mora`
(`core.ts:1231`), `PATCH /contratos/:id/modo-cobranza` (`core.ts:2861`),
`PATCH /contratos/:id/inquilino-contacto` (`core.ts:2940`), y CRUD de garantes
(`core.ts:1911-1956`). **Falta el relevamiento de qué se puede y qué no, y probablemente falta
la superficie en la UI.**

**Qué hay que hacer.**
1. **Relevar**: tabla campo por campo del contrato → ¿hay endpoint para editarlo? → ¿qué rol lo
   puede? → ¿lo bloquea algo si hay pagos?
2. **Decidir con PROD** la lista definitiva de editables. Punto de partida acordado:
   **editable** contacto del inquilino, garantes, datos administrativos; **no editable**
   fecha de vigencia, dirección, y todo lo que cambie plata ya devengada.
3. **Implementar** lo que falte, con la capacidad correcta (esto es de ADMIN).
4. **Dejar traza**: toda edición de un contrato con pagos tiene que quedar en auditoría.

**Criterio de aceptación.** La administradora corrige el teléfono de un inquilino y cambia un
garante en un contrato con pagos, sin rescindir nada, y queda registrado quién lo hizo.

**Riesgo.** ⚠️ **Alto si se hace de más.** Editar el monto, la fecha de inicio o el día de pago
de un contrato con liquidaciones ya devengadas cambia plata que ya se calculó. Por eso el
alcance lo define PROD antes de escribir código, y por eso la fecha de vigencia queda afuera.

---

# BLOQUE D — Pagos y caja

> ⚠️ **Todo este bloque espera a T-04.** Hasta saber qué pasó con los $850, no se toca el flujo
> de pagos.

---

## T-12 · Hacer descubrible "anular un pago" — ✅ RESUELTO

> **Hecho.** Detalle y evidencia: [`T-12-DESHACER-COBRO-EN-CAJA.md`](T-12-DESHACER-COBRO-EN-CAJA.md).
> El diagnóstico cambió al relevar: Camila **sí encontró "Ver detalle"** y llegó a la lista de
> cobros del día — la fila del cobro equivocado no tenía acción. El botón "Deshacer" ahora vive
> **en esa fila**, pide motivo, sólo lo ve ADMIN, muestra el 409 real del server y el cierre se
> recalcula solo. Backend sin cambios: ninguna guarda se aflojó.
> De paso se corrigió un bug preexistente de moneda en los totales del cierre (un día en USD se
> mostraba con signo de pesos).
> **Falta:** prueba de humo contra el backend real después del deploy (T-02).

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** ~~T-04~~ (dependencia levantada: no se
modifica lógica de pagos, sólo se expone un endpoint ya existente y ya guardado)

**Qué pidió Camila.** `[57:12]` *"Si el inquilino se equivocó de un pago, ¿cómo lo elimino?
¿Cómo elimino un pago ya cargado que me lo contabilizó en caja?"* — Alan pidió un segundo y no
lo respondió en la reunión.

**Estado verificado — ya existe, no se encuentra.** `POST /pagos/:id/anular` está implementado
(`plata.ts:522`), con capacidad `pago.revertir` (**sólo ADMIN**), libera el `CreditoDetectado`
asociado y **devuelve 409 si el período ya se le rindió al propietario** (`plata.ts:541-548`).
En el panel hay botón: `pagos-por-validar.tsx:153` (`triggerAnular`), del commit `2f4b1aa`.

**El problema es dónde está.** Camila lo buscó **en caja**, que es donde vio el movimiento. El
botón vive en la bandeja de pagos.

**Qué hay que hacer.**
1. Ofrecer "deshacer este cobro" también **desde la vista de caja**, sobre el movimiento.
2. Que el 409 "ya se rindió" se muestre con su mensaje real y explique la salida (anular la
   rendición primero).
3. Verificar que Camila, con rol ADMIN, lo ve. Si el botón está gateado por algo más, corregirlo.

**Criterio de aceptación.** Desde donde el operador ve el cobro equivocado, puede deshacerlo, y
si no se puede, entiende por qué.

**Riesgo.** Medio: anular mueve plata. La protección ya existe (sólo ADMIN + 409 si se rindió);
no hay que aflojarla, sólo hacerla accesible.

---

## T-13 · Cuentas de caja: relevar qué falta para que se entiendan

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** T-04

**Qué pidió Camila.** `[34:42]` *"Lo de la caja no está hecho nada… cuando hicimos las
entradas, las salidas para mover las cajas."* Alan `[35:50]`: *"Abajo de caja no aparece ahí en
caja, lo estoy viendo y no aparece, pero sí aparece cuentas."*

**Estado verificado — construido, mal ubicado.** Existe el modelo `CuentaCaja` con
`DireccionCuenta` (ENTRADA / SALIDA / AMBAS), la ruta `apps/api/src/routes/cuentas.ts`, la
pantalla `/cuentas`, y los movimientos ya muestran su cuenta (commits `a1eec2c` + `2ece704`,
migración `20260723233017_cuentas_caja`). El `POST /caja/movimientos` valida la dirección de la
cuenta (`plata.ts:1505-1511`: una cuenta de sólo-entrada rechaza un gasto).

**Lo que Camila no encontró** es la relación entre "cuentas" y "caja": son dos pantallas
separadas y ella esperaba las cuentas dentro de caja.

**Qué hay que hacer.**
1. Relevar el flujo real: cargar un gasto eligiendo cuenta, ver el saldo por cuenta, mover
   plata entre cuentas.
2. Decidir si `/cuentas` se integra dentro de `/caja` o se enlaza claramente.
3. **Verificar si existe la transferencia entre cajas.** Camila la nombró (*"para mover las
   cajas"*) y no está confirmado que exista.

   > **Verificado el 19/08 desde otra sesión: NO existe.** No hay ningún tipo de movimiento de
   > traspaso ni par vinculado — `grep` de `TRANSFERENCIA_ENTRE` / `transferenciaEntreCuentas`
   > en `apps/api/src` y `apps/inmobiliaria/src` no devuelve nada, y `TipoMovimientoCaja` sólo
   > tiene INGRESO_EXTRA y GASTO.
   >
   > Hoy la única forma es cargar una salida en una caja y una entrada en la otra, **sueltas**.
   > Camila lo dijo así: *"si alguien anula una, la otra queda colgada"*.
   >
   > **No se construyó acá a propósito:** necesita un movimiento nuevo (o un par vinculado) en
   > el schema, y tocar el modelo de datos es de las cosas que este repo manda consultar antes.
   > Queda con el diagnóstico listo para quien tenga T-13.

**Criterio de aceptación.** Camila carga un gasto en una cuenta concreta y ve el saldo de esa
cuenta, sin que nadie le explique dónde está la pantalla.

**Bug adyacente detectado en el mapa del sistema** (no lo pidió ella, pero está acá): el saldo
por cuenta **mezcla monedas** — `cuentas.ts:25-51` agrupa por `cuentaId` y `tipo` **sin
`moneda`**, así que un gasto de US$800 y uno de $80.000 se restan como si fueran la misma
unidad. El resto del sistema es riguroso con esto (la rendición exige moneda única, el cierre
expone `porMoneda`). Vale arreglarlo en la misma pasada.

---

## T-13-N1 · El cierre de caja nunca se congela, y hay una tabla muerta que existía para eso

**Experto:** DATA + BE · **Prioridad:** 🟠 · **Depende de:** decisión del dueño
**Origen:** caza de operaciones-inversas (20/08), buscando la misma forma del bug de `descobrar`.

**Estado verificado el 20/08.** `GET /caja/cierre` **no lee ni escribe nada persistido**: recalcula
el arqueo en vivo desde las filas de `Pago`, cada vez que se abre la pantalla.

Y existe `model CierreCaja` (tabla `cierres_caja`), creada en la **migración inicial del
12/06/2026**, con `ingresos`, `egresos`, `balanceDia`, `efectivoEnMano`, `pendienteRendir`,
`movimientos`, `cerradoAt` y `cerradoPor`, más un `@@unique([inmobiliariaId, fecha])`. **Nadie la
escribe ni la lee.** Se verificó sobre todo el repo: los únicos matches fuera del schema y de la
migración son un componente React (`CierreCajaDelDia`) y una interfaz TS (`CierreCajaItem`), que
no tienen nada que ver con el modelo.

**La consecuencia concreta, que es lo que importa.** Anular un pago (`POST /pagos/:id/anular`) lo
pasa a `RECHAZADO` **y le reescribe `decididoAt` a hoy**. El cierre filtra por esos dos campos
(`estado: 'CONCILIADO'` y `decididoAt` dentro del día), así que el pago **desaparece del arqueo
del día en que se cobró**.

O sea: **el cierre de un día pasado cambia solo, en silencio, días después.** La cajera cerró el
12 con un número; si vuelve a abrir el 12 después de una anulación, ve otro. Para alguien que
concilia contra el banco eso es una trampa: no hay forma de saber si el número cambió ni por qué.

Dos cosas más que muestran que el diseño previsto era más rico que lo construido:
`efectivoEnMano` y `pendienteRendir` son campos de esa tabla que **el cierre en vivo ni siquiera
calcula** (`grep` en `plata.ts` da 0).

**Por qué NO lo tomo por mi cuenta.** Congelar el cierre es una feature con decisiones de
producto, no un bug con un arreglo obvio: quién cierra el día, si se puede reabrir, y sobre todo
qué pasa con una anulación posterior a un día ya cerrado — ¿se rechaza, se asienta como ajuste
del día de hoy, o se permite y se deja constancia? Eso lo define el dueño.

**Y NO borrar la tabla** mientras la decisión no esté tomada: es exactamente el caso que
`CLAUDE.md` §1.5 pide no resolver por iniciativa propia.

**Lo que sí conviene decidir primero.** Si hoy Camila concilia contra el banco mirando esta
pantalla, la pregunta urgente no es congelar el cierre sino **si alguna vez le cambió un número
sin que se enterara**. Eso se responde con una consulta de sólo lectura: pagos con
`estado = 'RECHAZADO'` cuyo `decididoAt` sea posterior al día en que se conciliaron.

---

## T-14 · Pago parcial desde la PWA del inquilino

**Estado: ✅ VERIFICADA — ya funcionaba, cero líneas de código.** El checkout tiene el selector
*"¿Cuánto vas a pagar ahora?"* con "El saldo completo" y **"Pagar un parcial"** de monto libre,
clampeado a `[0, saldo]` (`checkout/page-client.tsx:756`, `:775`, `:733`), y hasta distingue
prod de demo en el copy. Los tres criterios de aceptación se cumplen hoy. Detalle completo en
`work-agent/.tareas/T-14/estado.md`.

**La pregunta 2 queda respondida: NO se permite pagar sólo el alquiler dejando expensas.** El
parcial es **monto libre**, nunca elección de concepto. (a) Es lo que Camila pidió que no se
haga (`[27:16]`); (b) `Pago` no tiene campo de concepto (`schema.prisma:1664-1719`), no hay
dónde guardarlo; (c) y lo decisivo: la imputación aguas abajo es **prorrateo**, no prelación
(`rendicion-pendiente.ts:66`, `plata.ts:1733`, `plata.ts:227`) — así que el botón le mentiría al
inquilino y a la inmobiliaria. El desglose se queda **informativo**, que es para lo que se
agregó.

**Lo más barato que quedó abierto:** averiguar qué valor tenía `NEXT_PUBLIC_API_URL` en el
entorno donde Camila probó el 03/08. Demo y prod se comportan **distinto** en el parcial, así que
sin ese dato cualquier lectura de lo que ella vio es especulación — y puede acotar T-04.

**Experto:** FE-I + PROD · **Prioridad:** 🟡 · **Depende de:** T-04

**Qué pidió Camila.** `[1:00:24]` *"Ahí lo más frecuente es que no paguen todo, sino que quede
algún saldo."* Alan `[1:00:34]`: *"Puedo hacer un pago parcial si así quisiera y poner el monto
del alquiler"* — pero no lo terminó de probar.

**Estado verificado — el backend lo soporta, falta confirmar la UI.** El backend acepta
parciales y los marca bien (`plata.ts:1288`: `tipo: monto >= saldoPendiente - 0.01 ? 'TOTAL' :
'PARCIAL'`). Falta verificar qué ofrece el checkout de la PWA: si el inquilino puede elegir el
monto, y si puede pagar el alquiler dejando las expensas.

**Qué hay que hacer.**
1. Verificar el checkout (`apps/inquilino/src/app/(full)/pago/[liqId]/checkout/`).
2. **Decidir con PROD** si se permite pagar sólo el alquiler dejando expensas. Ojo que esto
   roza el pedido de Camila de que **no se separe el pago** (ver T-19): que el inquilino
   *pueda* pagar parcial no es lo mismo que *presentarle* dos pagos separados.

**Criterio de aceptación.** El inquilino puede informar un pago menor al total, entiende cuánto
le queda, y la inmobiliaria lo ve en la bandeja como parcial.

---

## T-15 · Que el inquilino vea siempre lo que le falta pagar

**Experto:** FE-I · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA** — commit `1ffb4bc`. Fuente única en `lib/saldo-liquidacion.ts`, usada por
el home y por el detalle del pago (que era el roto). **Queda un fleco**: `/comprobantes` no se
migró al helper — hay que verificar si su cuenta coincide o es una tercera verdad.
Abrió **T-32** (no hay runner de tests en ninguno de los dos fronts).

---

## T-32 · Montar un runner de tests en los dos fronts

**Experto:** QA + OPS · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** detectada al ejecutar T-15.

**Estado verificado.** `apps/inquilino` y `apps/inmobiliaria` **no tienen script de test ni
configuración de vitest** (`grep '"test"' apps/*/package.json` → sólo `apps/api`). Vitest ya
existe en el workspace, pero ningún front lo usa. Por eso los 64 archivos de test del repo son
**todos** de API.

**Por qué duele ahora.** Al cerrar T-15 quedó `saldoDeLiquidacion`, una función **pura** que
decide cuánta plata le falta pagar a un inquilino — exactamente el tipo de lógica que se testea
sola y que no se puede permitir que driftee. **No hay dónde correrle un test.** Lo mismo pasó en
`26fdfa6`, donde el bug del doble click se verificó a mano *"porque apps/inmobiliaria no tiene
suite"*.

**Qué hay que hacer.** Agregar vitest + script `test` a los dos fronts, sin jsdom al principio
(alcanza para lógica pura, que es lo que más falta). Y sumar esos tests al job de CI que propone
T-27 — ojo que ese job **no puede incluir los tests de API**, que pegan a la base de producción.

**Criterio de aceptación.** `pnpm --filter @llave/inquilino test` corre, y hay al menos un test
puro de `saldoDeLiquidacion` que se pone en rojo si se revierte el fix de T-15.

**Estado verificado — hecho a medias, con tres pantallas y dos verdades.** El commit `e0dd7a8`
(03/08) arregló que el home muestre **lo que falta** cuando ya se informó un pago. Pero el
**detalle del pago** quedó afuera: `pago/[liqId]/page-client.tsx:207` mide la parcialidad con
`liq.montoPagado`, que sólo cuenta `CONCILIADO`, así que un pago **informado y todavía no
validado** deja `hayParciales=false` y la card muestra el **total completo**. El home y
Recibos sí descuentan lo informado.

**Qué hay que hacer.** Unificar el criterio: una sola función que calcule "cuánto falta"
contemplando informado + conciliado, y usarla en las tres pantallas.

**Criterio de aceptación.** Las tres pantallas muestran el mismo número para la misma
liquidación, en todos los estados.

**Nota.** Hay una **cuarta copia** de esta aritmética en `apps/inquilino/src/app/(app)/payment-hero.tsx`
(232 líneas) que **ningún archivo importa** — recibió el fix `e0dd7a8` y no se renderiza. O se
borra o se usa; dejarla ahí garantiza que vuelva a driftear.

---

# BLOQUE E — Notificaciones

---

## T-16 · Avisarle al inquilino cuando le suben el alquiler

**Experto:** BE + FE-I · **Prioridad:** 🔴 · **Depende de:** nada

**Qué pidió Camila / Alan.** Camila ajustó un alquiler por IPC de forma manual `[10:26]` y
Alan, como inquilino, no recibió nada `[10:39]`: *"No me avisó que me subiste, que hubo un
aumento."* Alan `[10:45]`: *"Con ajuste manual necesitamos avisarle"*, y `[10:54]`: *"Eso hay
que validarlo: cómo funciona cuando se sube de forma manual el alquiler, avisar que hubo un
aumento."*

**Estado verificado — no existe.** `apps/api/src/mailer.ts` exporta exactamente seis envíos:
`enviarOtp`, `enviarOtpAdmin`, `enviarInvitacionInquilino`, `enviarBienvenidaInmobiliaria`,
`enviarInvitacionEquipo` y `enviarAnuncioEmail`. **No hay mail de ajuste de alquiler.** Y
ninguno de los dos caminos de ajuste (`POST /contratos/:id/ajustar` en `core.ts:1642` y
`PATCH /contratos/:id/monto` en `core.ts:2737`) genera nada para el feed del inquilino.

**Por qué es 🔴 y no 🟡.** Subirle el alquiler a alguien sin avisarle es un problema legal y de
confianza, no de UX. El inquilino se entera cuando le llega la próxima liquidación más cara.

**Qué hay que hacer.**
1. Que **los dos** caminos de ajuste generen un aviso (el bug clásico de este código es
   arreglar uno y olvidar el otro — ver la nota de T-11 sobre los dos endpoints).
2. Email al inquilino con el monto anterior, el nuevo, desde qué período rige y el motivo.
3. Que aparezca en `GET /mis-notificaciones` (`inquilino-mundo.ts:1093`), que ya existe y ya lo
   consume la PWA.
4. Verificar qué hace hoy la alerta *"Próximo ajuste en N días"* del home y si se pisa con esto.

**Criterio de aceptación.** Se ajusta un alquiler por cualquiera de los dos caminos y el
inquilino recibe mail **y** lo ve en su campana, con los números correctos.

**Riesgo.** Bajo técnicamente. Cuidar el copy: es una comunicación sensible.

---

## T-17 · Notificar los reclamos por mail y en la plataforma

**Experto:** BE + FS · **Prioridad:** 🟠 · **Depende de:** nada

**Qué pidió Alan en la reunión.** `[47:36]` *"Toca hacer las notificaciones, tiene que
notificarle también los reclamos, tiene todo por email y por la plataforma, por si no no está
enterada."*

**Estado verificado — no existe para reclamos.** Ver el inventario del mailer en T-16.
Del lado del panel, la campana ya muestra **reclamos abiertos** desde el commit `afbf08f`
(`notifications-bell.tsx`), así que la mitad "en la plataforma" para la inmobiliaria está
cubierta. Falta: el mail, y el lado del inquilino cuando su reclamo cambia de estado.

**Qué hay que hacer.**
1. Hacer el **inventario completo** de eventos → notificación, y decidir cuáles se envían:
   pago informado, pago validado, pago rechazado, reclamo nuevo, reclamo asignado, reclamo
   resuelto, contrato cargado pendiente de aprobación, ajuste (T-16), vencimiento próximo.
2. Implementar los que se decidan, por mail y en el feed correspondiente.
3. **Respetar el rate**: no convertir el mail en ruido que se ignore.

**Criterio de aceptación.** El inventario está escrito y decidido, y los eventos elegidos
llegan por los dos canales.

**Dependencia de producto.** Definir **quién** recibe qué. No todo evento le interesa a todos.

---

## T-18 · Sacar el copy que promete WhatsApp

**Experto:** FE-I + FE-P · **Prioridad:** 🟠 · **Depende de:** nada

**Estado verificado — el sistema promete algo que no tiene.** `apps/api/src/env.ts` **no declara
ninguna variable `WHATSAPP_*`**; el único canal saliente es SMTP. Pero el producto dice lo
contrario en al menos tres lugares:

- `apps/inquilino/.../checkout/page-client.tsx:501-503` — *"te avisamos por WhatsApp"*
- `apps/inquilino/.../pago/[liqId]/page-client.tsx:322-323` — *"Te avisamos por WhatsApp en 24-48 hs"*
- `apps/inmobiliaria/.../pagos-por-validar.tsx:142` — *"Le avisamos a X con tu nota"*

Y hay un caso peor, de trazabilidad: el diálogo "Nuevo mensaje" del contrato dice
*"Queda registrado en el historial del contrato"* (`mensaje-inquilino-dialog.tsx:119`) y **no
queda registrado** — el propio comentario del código lo admite (`:99-101`) y el tab
"Comunicaciones" está hardcodeado vacío (`use-contrato.ts:301`).

**Qué hay que hacer.**
1. Corregir los tres copys de WhatsApp para que digan lo que el sistema hace (email), o sacarlos.
2. Corregir el copy del diálogo de mensaje **o** implementar el registro. La primera es de una
   línea; la segunda es una tarea de verdad y probablemente valga la pena (T-17 la roza).
3. Los botones que abren `wa.me` con texto pre-armado **están bien** y no se tocan: eso es
   honesto, el operador manda el mensaje él.

**Criterio de aceptación.** Ningún texto de la aplicación promete un canal o un registro que no
existe.

**Por qué importa más de lo que parece.** El tour de onboarding de la PWA
(`components/onboarding.tsx`) **también** vende cuatro features que en producción son
`Proximamente`: el Asistente, el calendario, la línea de tiempo del contrato y el link para el
garante. Vale meterlo en la misma pasada.

---

# BLOQUE F — Consorcio

---

## T-19 · Verificar y comunicarle a Camila que el pago YA va unificado

**Experto:** QA + PROD · **Prioridad:** 🔴 · **Depende de:** nada

**Qué pidió Camila.** Es lo más importante de toda su parte de consorcio, y es un **miedo**, no
un pedido de feature. `[27:16]`:

> *"Tengo gente inquilina nuestra con mucha deuda ¿por qué? Porque le separamos las partes. Si
> yo te doy un monto total 550, vos me transferís 550 y está todo unificado. Ahora si yo te lo
> separo, que tengas que hacer dos transferencias o entrar a dos lugares distintos para pagarme
> el alquiler y las expensas, no cobro más, la gente no la paga. Nos hemos dado cuenta: la
> gente no paga las expensas cuando lo dividimos."*

**Estado verificado — ya está como ella quiere.** La `Liquidacion` tiene
`montoTotal = montoAlquiler + montoExpensas (+ punitorios)` (`lib/liquidaciones.ts:96`) y el
inquilino paga **contra el total**, en una sola operación. No existe ningún camino que le cobre
las expensas por separado.

**Qué hay que hacer.** Esta tarea es de **verificación y comunicación**, no de código:
1. Hacer el E2E completo: cargar un contrato `ALQUILER_Y_EXPENSAS`, devengar, y mostrar que el
   inquilino ve **un** monto y hace **una** transferencia.
2. **Mostrárselo a Camila en la próxima sesión, explícitamente.** Su miedo viene de cómo
   funciona su sistema actual, no del nuestro, y mientras no lo vea con sus ojos va a seguir
   desconfiando.

**Criterio de aceptación.** Camila vio el flujo y confirmó que es lo que ella necesita.

---

## T-20 · Consorcio con propiedades de régimen mixto

**Experto:** BE + PROD · **Prioridad:** 🟠 · **Depende de:** T-19

**Qué pidió Camila.** `[29:21]` *"Tengo dos edificios donde tengo cinco departamentos nada más
propios, lo demás solo cobro [expensas]."* Alan `[29:01]`: *"Dentro de un consorcio completo
puede haber propiedades donde cobrás alquiler y expensas, y al mismo tiempo en el mismo
consorcio otras donde solamente [expensas]."* Camila `[29:41]`: *"Hay que mezclarlo, pero no
separar el pago."*

**Estado verificado — el modelo ya lo soporta.** `Contrato.tipoContrato` es un enum con
`ALQUILER | SOLO_EXPENSAS | ALQUILER_Y_EXPENSAS` (`schema.prisma:77-79`, default `ALQUILER`), y
como el tipo vive en el **contrato** y no en el consorcio, dos unidades del mismo edificio
pueden tener regímenes distintos sin hacer nada especial.

**Qué hay que hacer.**
1. Verificar el caso E2E: un consorcio con una unidad `ALQUILER_Y_EXPENSAS` y otra
   `SOLO_EXPENSAS`, y confirmar que la rendición, la caja y las métricas se comportan bien con
   las dos.
2. Prestar atención a que `montoAlquilerSegunTipo` (`liquidaciones.ts:311`) devuelve **0** para
   `SOLO_EXPENSAS`: hay que confirmar que la **comisión** sobre esa unidad se calcula como
   corresponde (la comisión sale del alquiler, y ahí el alquiler es cero — ¿la inmobiliaria
   cobra algo por administrar esa unidad? **Es una pregunta de producto, no de código**).

**Criterio de aceptación.** El caso mixto funciona de punta a punta y está claro cómo cobra la
inmobiliaria en la unidad de sólo expensas.

---

## T-21 · El caso "solo expensas": cerrar el circuito en la PWA

**Experto:** FE-I + PROD · **Prioridad:** 🟠 · **Depende de:** T-20
**Estado: ✅ HECHA la parte de la PWA** — rama `feat/T-21-solo-expensas-pwa`.
La pregunta de la comisión (punto 3) sigue abierta: es de negocio, no de código.

**No dependía de T-20.** Lo que T-20 bloquea es la pregunta de cuánto se cobra por administrar
la unidad; el cableado del front no necesitaba nada de eso. Se hizo.

**El dato ya llegaba y se tiraba a la basura.** `GET /mi-contrato` manda `tipoContrato` **y**
`montoExpensas` (`inquilino-mundo.ts:569-570`), pero `ContratoApi` del cliente
(`apps/inquilino/src/lib/api/hooks.ts`) no declaraba el primero y el mapeo de `useMiContrato`
descartaba **los dos**. El tipo `Contrato` de la PWA tampoco los tenía. Por eso el `grep` daba
cero: no era que faltara el endpoint, era que el cliente los perdía al mapear.

**Lo que veía el ocupante, y quedó arreglado:**
1. `page.tsx` (home) — la fila **"Alquiler $0"** se renderizaba siempre, mientras la de Expensas
   de al lado ya era condicional a `> 0`. Ahora las dos usan el mismo criterio.
2. `pago/[liqId]/page-client.tsx` — la misma fila incondicional en el detalle.
3. `contrato/page.tsx` (×2 variantes) — **"Alquiler actual $0"** en 3xl, el número más grande de
   la pantalla. Ahora dice **"Expensas por mes"** con el monto real; si las expensas no están
   cargadas dice "Todavía no está cargado" en vez de "$0".
4. `pago/[liqId]/checkout/page-client.tsx` — **defecto de lógica, no de copy**:
   `contrato?.montoActual ?? liq.montoAlquiler`. `??` no cae en `0`, sólo en null/undefined, y un
   solo-expensas tiene `montoActual === 0` **por diseño**. La referencia quedaba en 0 y
   `saldo > 0 * 1.2` se cumplía con **cualquier** saldo: al ocupante le saltaba *"tu deuda es
   alta, podés pactar un plan"* por un único período al día. La rama demo repetía el agujero por
   su cuenta (usaba `contratoMock.montoActual` pelado); ahora las dos pasan por el mismo helper.

Todo el criterio vive en un solo lugar nuevo, `apps/inquilino/src/lib/tipo-contrato.ts`, para que
no queden cinco reglas distintas repartidas por las pantallas.

**Verificación.** `tsc` en 0 en `apps/inquilino` y `apps/api`; lint sin warnings; 16 aserciones
de la lógica pura ejecutadas con el `tsx` que ya está en el repo, **verificadas en rojo**
revirtiendo el arreglo; recorrido en el navegador de home, contrato, detalle y checkout con un
mock de solo expensas, más el caso normal y el estado vacío, consola limpia.

**Deuda.** El test durable (`src/lib/tipo-contrato.test.ts`) está escrito en estilo vitest pero
**no corre**: la PWA no tiene runner (es T-32). Para que `tsc` no explote, `apps/inquilino/tsconfig.json`
excluye los `*.test.ts`. **Al cerrar T-32 hay que borrar ese `exclude`.**

---

## T-21-N1 · El devengo no sabe qué es un "solo expensas" (💰)

**Experto:** BE · **Prioridad:** 🔴 · **Depende de:** nada
**Estado: ✅ HECHA** — commits `77babfe` · `c26db5f` · `753674c` · `87cf0b5`, rama `feat/T-21-N1-devengo-solo-expensas`.
**Incluye T-21-N2**, que era la misma puerta por el otro lado.

Se cerró por los dos extremos. **El devengo:** `ContratoParaLiquidar` ahora exige
`tipoContrato` —requerido a propósito, mismo criterio que `devengarDesde`, para que el
compilador encuentre a cualquier caller que se lo saltee— y `computarLiquidacionesContrato`
pasa el canon del período por `montoAlquilerSegunTipo`, **después** de resolver la vigencia
(si el corte fuera antes, un ajuste con vigencia futura se colaba igual). Los dos barridos que
lo alimentan —el cron y el botón "Devengar" del panel— ahora traen el campo en su select.

**Las puertas que ensuciaban el canon:** `/ajustar` y `PATCH /monto` rechazan con 409;
`/renovar` **no** rechaza —renovar el plazo es legítimo— pero fuerza el canon a 0 (el zod pasó
de `positive()` a `nonnegative()`); y el alta cierra el caso inverso que faltaba (T-21-N2:
`SOLO_EXPENSAS` con `monto > 0`, que antes pasaba las dos validaciones y se persistía tal cual).
El panel además saca esos contratos de la lista del **ajuste masivo**, que era el vector
principal: barría todos los activos y les escribía canon a todos.

**Verificación.** `tsc` 0 en `apps/api` y `apps/inmobiliaria`; 22 tests puros de liquidaciones
en verde con 4 casos nuevos, **verificados en rojo** revirtiendo el fix; 104/105 del resto de
los tests puros (el que falla hace `spawnSync` a un `psql` con ruta de macOS — ver
T-21-N1-N2); y comprobado en el navegador que el consorcio de solo expensas desapareció de la
lista del ajuste masivo (5 contratos en vez de 6).

**Cómo se limpia lo que ya está sucio.** El devengo usa `createMany({ skipDuplicates: true })`,
así que **nunca pisa una fila existente**: lo ya devengado con alquiler no se arregla solo. La
herramienta es `PATCH /contratos/:id/monto` con **`monto: 0`**, que pasa por
`recomputarLiquidacionesFuturas` y deja en 0 el contrato y todas sus cuotas impagas —
**PENDIENTE y VENCIDO** — desde el período actual. No toca las que ya tienen pagos, a propósito:
si esa plata entró, se resuelve con la persona, no borrando el número.

(La primera versión de este fix rechazaba ese endpoint entero para un solo-expensas, y con eso
cerraba la única salida junto con la entrada. Lo encontró el paso adversarial.)

**⚠️ IGUAL HAY QUE MIRAR PRIMERO.** Antes de deployar, correr la consulta de diagnóstico
(solo lectura):
`work-agent/tareas/T-21-N1/diagnostico-datos.sql`. Si devuelve filas, hace falta decidir qué
se hace con lo ya facturado — y si además se cobró, no alcanza con corregir la liquidación.

---

## T-21-N1-N2 · Un test "puro" que sólo corre en la Mac de una persona

**Experto:** BE · **Prioridad:** 🟢 · **Depende de:** nada

`apps/api/test/backfill-mascotas-propiedad.test.ts` no importa `seedBase`, así que parece de los
puros que sí se pueden correr — pero hace `spawnSync` a
`/opt/homebrew/opt/postgresql@18/bin/psql`, una ruta hardcodeada de Homebrew en macOS. En
Windows (y en cualquier Linux, incluida la CI) revienta con `ENOENT`.

O se resuelve el binario del entorno (`psql` del PATH, o una env var), o se lo marca como test
de integración para que no ensucie el resultado de la tanda pura. Hoy contamina: obliga a saber
de memoria que "ése falla siempre" para poder leer el output.

### ✅ RESUELTO — commit `1e51f2e`

Las dos cosas: el binario sale del PATH (o de `PSQL_BIN`), el usuario del entorno, y **si la
infra no está el test se saltea con el motivo escrito** en vez de reventar con `ENOENT`. La
detección prueba el cluster de verdad (`SELECT 1`), no sólo que el binario exista: psql instalado
sin cluster corriendo es el caso más común y daría el mismo rojo inútil.

Saltearse es honesto —queda visible en el output y dice qué falta y cómo habilitarlo—; fallar
siempre entrena a ignorar el rojo, que es peor que no tener el test.

---

**Cómo apareció.** Verificando T-21. No es de la PWA, así que no se tocó.

**El problema.** `montoAlquilerSegunTipo` (`apps/api/src/lib/liquidaciones.ts:311`) es la única
regla que dice "un SOLO_EXPENSAS no devenga alquiler"… y tiene **un solo caller** en todo el
repo: `liquidaciones.ts:359`, dentro de `recomputarLiquidacionesFuturas`, o sea el
`PATCH /contratos/:id/monto`. El devengo de verdad —`computarLiquidacionesContrato`
(`liquidaciones.ts:71-102`)— **no la usa y ni siquiera recibe el tipo**: `ContratoParaLiquidar`
(`liquidaciones.ts:6-26`) no declara `tipoContrato`, y ninguno de los dos barridos que lo
alimentan lo trae en su select (`liquidaciones.ts:232-244` el cron, `plata.ts:115-129` el botón
Devengar del panel).

O sea: **hoy funciona por casualidad.** Un solo-expensas devenga 0 de alquiler únicamente porque
`contrato.monto` quedó en 0. No hay ninguna defensa.

**Por qué eso rompe.** Hay tres caminos que escriben `contrato.monto` con un
`z.number().positive()` y **sin mirar `tipoContrato`**:
- `POST /contratos/:id/ajustar` — `core.ts:1805` escribe `montoAlquiler: b.montoNuevo`
- `POST /contratos/:id/renovar` — `core.ts:1890`, idem
- `PATCH /contratos/:id/monto` — éste sí respeta el tipo en las liquidaciones, pero igual deja
  `contrato.monto > 0`, o sea **divergencia silenciosa** entre el contrato y sus cuotas

Ajustar o renovar un contrato de solo expensas le empieza a facturar alquiler a alguien que no
paga alquiler, y el ajuste masivo del panel entra por ahí.

**Criterio de aceptación.** `computarLiquidacionesContrato` recibe y respeta `tipoContrato`;
ajustar/renovar un SOLO_EXPENSAS o no se permite o no toca el canon; test puro que falle si se
revierte.

---

## T-21-N1-N1 · No hay forma de cambiar las expensas de un contrato ya cargado

**Experto:** FS · **Prioridad:** 🟠 · **Depende de:** nada

**Cómo apareció.** Haciendo T-21-N1 escribí un mensaje de error que decía *"si querés cambiar el
monto de las expensas, editá el contrato"* — y al ir a verificar que esa puerta existiera,
resultó que no existe.

**El problema.** `montoExpensas` se puede setear **una sola vez**: en el alta
(`core.ts:988`, dentro del zod de `POST /contratos`). No hay ningún endpoint que lo modifique
después. Grep de `montoExpensas` sobre `apps/api/src/routes/` devuelve exactamente esa línea como
única escritura.

Las expensas **suben todos los meses**. O sea: hoy, para corregir la expensa de un contrato, la
única salida es rehacer el contrato. Para un contrato de solo expensas es peor todavía, porque
es el **único** monto que tiene: si está mal, no hay nada que ajustar.

Mientras tanto, los mensajes de los 409 nuevos de T-21-N1 dicen la verdad ("hoy sólo se define
al cargar el contrato") en vez de mandar a una pantalla que no abre.

**Criterio de aceptación.** Se puede cambiar `montoExpensas` de un contrato activo desde el
panel; queda registrado quién y cuándo (igual que un ajuste de canon); y las liquidaciones
futuras impagas se recomputan, sin tocar las ya pagadas o parciales.

---

### ✅ RESUELTO — commits `cdb78d7` · `f21e573`

`PATCH /contratos/:id/expensas`, hermano de `/monto` y con su misma forma a propósito (es el
mismo gesto para el operador), + botón **"Cambiar expensas"** en el detalle del contrato.

`recomputarExpensasFuturas` es espejo de `recomputarLiquidacionesFuturas` con **una diferencia
que importa**: acá se conserva el `montoAlquiler` de CADA cuota, que puede diferir entre meses si
hubo un ajuste con vigencia futura. Uniformarlos habría pisado ese ajuste. Mismo criterio
conservador por lo demás: no toca meses pasados, ni PAGADO/PARCIAL, ni cuotas con un pago
informado en revisión.

**El `tipoContrato` acompaña al monto.** `computarLiquidacionesContrato` factura expensas mirando
sólo `montoExpensas`, sin consultar el tipo: un ALQUILER con expensas > 0 las facturaría mientras
la PWA le dice al inquilino que su contrato no las tiene. El diálogo avisa el cambio de tipo antes
de confirmar.

**El botón no se gatea por tipo**, al revés que el de ajustar alquiler: un SOLO_EXPENSAS es justo
el que más lo necesita, porque es su único monto.

De la auto-revisión salió que el 409 del ajuste de canon **todavía decía** que las expensas "sólo
se definen al cargar el contrato" — el mensaje que dio origen a esta tarea. Ahora indica cuál
puerta abrir.

**116 tests puros** (10 nuevos), verificados en rojo sacando el guard de pago informado.

---

## T-21-N2 · El alta deja crear un "solo expensas" con alquiler > 0

**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA** — junto con T-21-N1, commit `77babfe`. `core.ts` ahora rechaza con 400 el
caso inverso. Se rechaza en vez de normalizar a 0 a propósito: si el que carga puso un monto, o
se equivocó de tipo o se equivocó de monto, y adivinar cuál es peor que preguntar.

**El problema.** La validación del alta es asimétrica. `core.ts:1029` rechaza `monto === 0`
cuando el tipo **no** es SOLO_EXPENSAS, pero **no existe** el chequeo inverso: un
`POST /contratos` con `{ tipoContrato: 'SOLO_EXPENSAS', monto: 500000, montoExpensas: 285000 }`
pasa las dos validaciones y se persiste tal cual (`core.ts:1130,1143`).

Combinado con T-21-N1 (el devengo sólo mira `contrato.monto`), ese contrato factura alquiler
todos los meses aunque esté marcado como de solo expensas.

**Criterio de aceptación.** El alta rechaza —o normaliza a 0— el monto de un SOLO_EXPENSAS, y
hay un test que lo cubre.

---

## T-21-N3 · El doc apunta a `packages/db/prisma`, que no existe

**Experto:** DOC · **Prioridad:** 🟢 · **Depende de:** nada

El schema de Prisma vive en **`apps/api/prisma/schema.prisma`**. No hay ningún `packages/db/`
(`packages/` tiene sólo `config`, `shared` y `ui`). `CLAUDE.md` §3 y §4 lo describen en
`packages/db/prisma/schema.prisma`, que era la estructura planeada y nunca se construyó así.
Quien lo busque ahí no lo encuentra y puede concluir que el modelo no existe — que es
exactamente lo que pasó al escribir T-21. Corregir `CLAUDE.md` (requiere OK del dueño: es su
archivo de convenciones).

### ✅ RESUELTO — commit `1e51f2e` · **revisar: toca CLAUDE.md**

Corregidas la estructura del monorepo (los reales son `config`, `shared`, `ui`), la ruta del
schema y la de los tipos compartidos. Se dejó una nota explicando qué se planeó y no se construyó
así, en vez de borrarlo en silencio: el plan sigue siendo información.

**Se corrigieron SÓLO hechos verificables (rutas y existencia), ninguna decisión ni convención.**
Aun así es tu archivo: si preferís otra forma, se revierte.

**Verificando esas rutas apareció algo bastante más grande → T-21-N3-N1.**

---

## T-21-N3-N1 · La capacidad #1 del MVP no está construida

**Experto:** PROD (decisión) + BE · **Prioridad:** 🔴 · **Depende de:** nada
**Origen:** verificación de rutas de T-21-N3. No salió de la reunión.

> ⚠️ **Renumerada.** Nació como "T-36" y chocó con otra T-36 creada en paralelo por el chat de
> integración (la de la cola de mails, más abajo). Es exactamente la colisión que el protocolo
> advierte: los chats no se ven entre sí, así que numerar a mano con el siguiente número global
> garantiza el choque. Se derivó de su tarea madre —T-21-N3— porque esa numeración es libre de
> colisiones por construcción. La otra conserva el número.

`CLAUDE.md` §1 lista **"Carga de contrato con IA"** como la primera de las 4 capacidades
no-negociables del MVP, y §5.1 la describe con endpoint, flujo, prompt y tests requeridos.

**No existe.** Verificado con tres búsquedas independientes:

- no hay endpoint `/contratos/parse` en `apps/api/src`;
- el SDK de Anthropic no está en ninguna dependencia (ni en `apps/api/package.json` ni en la raíz);
- `ANTHROPIC_*` no se lee en ningún archivo de `apps/api/src`.

Lo que sí hay para cargar contratos: el **wizard manual** (`/contratos/nuevo`) y la **importación
de cartera** desde Excel/CSV — determinística, sin IA, y que funciona.

**Lo que hay que decidir (PROD, antes de codear nada).** ¿Sigue siendo capacidad de MVP? La
reunión del 03/08 con Camila giró entera alrededor de otras cosas —cobranza, morosos, permisos,
consorcio— y en ningún momento pidió cargar contratos con IA. Puede que el producto haya
encontrado su forma real y el doc haya quedado viejo. Las tres salidas honestas son: construirla,
bajarla a post-MVP, o sacarla de la lista.

Lo que **no** es una salida es dejar el doc afirmando que es no-negociable mientras nadie la
construye: §5.1 ya quedó marcada como diseño previsto para que nadie más la lea como algo que anda.

**Criterio de aceptación.** La lista de capacidades del MVP en `CLAUDE.md` describe lo que el
producto es o va a ser, y no hay ninguna sección que se lea como implementada sin estarlo.

---

**Qué pasó en la reunión.** Camila `[30:04]` describió el caso: el alquiler lo arregla el
propietario directo con el inquilino, y la inmobiliaria sólo administra el consorcio. Alan
`[30:08]` respondió: *"No sería un contrato, no hay un contrato de alquiler. Es un pago mensual
que tiene que pagar. Tengo que pensarlo bien esto"*, y `[30:31]` *"le hace falta masticar un
poco más a la parte de consorcio"*.

**Estado verificado — el BACKEND está construido; la PWA no se enteró.** En la reunión quedó
como algo a diseñar, y esa parte estaba equivocada: del lado del servidor `SOLO_EXPENSAS` ya
existe. Pero **no está "de punta a punta"** — ver el hueco al final.

Lo que sí está:

- enum en `schema.prisma:77-79` y campo `Contrato.tipoContrato` (`:1277`)
- validación en el alta: `core.ts:930` (permite `monto === 0` sólo si es `SOLO_EXPENSAS`) y
  `core.ts:933` (exige `montoExpensas`)
- se persiste (`core.ts:1044`) y se respeta en el ajuste de monto (`core.ts:2828`)
- `montoAlquilerSegunTipo` (`liquidaciones.ts:311`) devuelve 0 de alquiler
- **el wizard ya lo ofrece**: `contratos/nuevo/page.tsx:696` → opción *"Solo expensas"*
- los anuncios ya lo excluyen donde corresponde (`anuncios/page.tsx:488`)

**⚠️ El hueco confirmado: la PWA del inquilino ignora `tipoContrato`.**
`GET /mi-contrato` **sí lo expone** (`inquilino-mundo.ts:570`), pero
`grep -r "tipoContrato\|SOLO_EXPENSAS" apps/inquilino/src` da **cero resultados**. O sea: a un
ocupante que sólo paga expensas, la app le habla de "alquiler" en todas partes — el home, el
detalle del pago, el checkout y el contrato. No es un detalle de copy: es decirle que debe algo
que no debe.

Y hay una consecuencia de plata que hay que decidir: con `SOLO_EXPENSAS`,
`montoAlquilerSegunTipo` devuelve **0**, así que `montoBruto` de la rendición da 0 y
`POST /rendiciones` corta con `RendicionSinCobros` (409). **Un contrato de sólo expensas no se
rinde nunca, y la comisión sobre él es cero.** Puede estar bien (las expensas van al consorcio,
no al dueño), pero entonces hay que responder: **¿cómo cobra la inmobiliaria por administrar
esa unidad?** Es la misma pregunta abierta de T-20.

**Qué hay que hacer.** No es una tarea de diseño de modelo —eso ya está—, es de cierre:
1. E2E completo de un contrato `SOLO_EXPENSAS`: alta → devengo → el inquilino ve y paga → la
   inmobiliaria concilia → qué pasa en rendición y caja.
2. **Cablear `tipoContrato` en la PWA** y ajustar el copy: sin "alquiler" para quien no lo paga.
3. Responder la pregunta de la comisión (con PROD).
4. **Decirle a Alan y a Camila que el modelo ya existe.** En la reunión quedó como algo a
   diseñar desde cero, y no lo es.

**Criterio de aceptación.** Un inquilino de sólo expensas usa la app sin que nada le hable de un
alquiler que no paga, y está escrito cómo cobra la inmobiliaria esa administración.

---

## T-22 · Consorcio: avisar por mail y cargar la expensa del período

**Experto:** FS · **Prioridad:** 🟡 · **Depende de:** T-19

**Qué pidió Camila.** `[57:35]` *"Los consorcios que te salen, mandale mensaje por email… y
subirle la expensa a alguien."*

**Estado verificado — sin verificar en detalle.** Existe el CRUD de consorcios
(`operacion.ts:1196-1766`: consorcio, UFs, movimientos, asambleas, servicios, inventario) y
`Consorcio` tiene `periodoActual` y `expensasPeriodoActual`. Falta relevar qué se puede hacer
hoy desde `/consorcios/[id]` y qué no.

**Qué hay que hacer.**
1. Relevar la pantalla y listar qué acciones existen.
2. Definir con PROD el flujo de "cargar la expensa del mes y avisarle a las unidades".
3. Implementarlo, reusando `enviarAnuncioEmail` que ya existe.

**Criterio de aceptación.** Camila carga la expensa del período y las unidades se enteran.

---

# BLOQUE G — Los tres grandes

Estos tres no entran en una sesión. Cada uno necesita su propio diseño y su propia tanda.

---

## T-23 · Portal del propietario

**Experto:** Arquitectura + BE + FE (nuevo front o sección) + SEC · **Prioridad:** 🔴
**Depende de:** decisión de producto sobre alcance y monetización
**Estado: ✅ HECHA** — commits `f6bb43c` (backend) · `c6d61cb` (front) · `7d489da` (arreglos SEC),
rama `feat/T-23-portal-propietario`, merge `41744e5`.

**Las dos decisiones de producto las tomó el dueño:** front **nuevo** (`apps/propietario`,
puerto 3002) y no una sección de la PWA —Camila `[1:02:00]` lo planteó como algo vendible
aparte, y mezclarlo con una app que se presenta como *"la app de tu alquiler"* chocaba con eso—;
y **monetización incluida en el plan de la inmobiliaria**, así que no se construyó nada de
facturación al propietario.

**Lo que se hizo.** Kind de JWT `propietario` con login por OTP al email (mismo motor que el
panel), guard `requirePropietario` que revalida contra la DB, y 5 endpoints de lectura
scopeados. El front tiene dos pantallas: login por código y home con las rendiciones
desglosadas, las unidades con el estado de los últimos 6 períodos de cada inquilino **y la fecha
real en que pagó**, y los reclamos con su costo.

**La revisión SEC que exigía la tarea encontró tres cosas, todas mías.** El aislamiento de los
5 endpoints resultó correcto y ningún endpoint existente acepta el token nuevo por accidente
—incluido `/uploads`, que prueba dos schemas y cae al 401—. Pero:

1. **Pivote CROSS-TENANT** en `/auth/propietario/elegir`: releía el email *desde la base* para
   autorizar el salto de cartera, y ese campo lo edita a mano cualquier ADMIN de cualquier
   inmobiliaria. Darse de alta a uno mismo como propietario, sacar un token, editarle el email
   al de la víctima y pedir su cartera. Arreglado congelando el email en el token, que es lo que
   ya hacía `/auth/inquilino/elegir`.
2. Un propietario nuevo leía **los reclamos de inquilinos anteriores**, con el texto libre que
   esa persona escribió. Recortado al contrato vigente.
3. **`Rendicion.notas` se publicaba**, y el equipo lo escribe hace meses creyendo que es interno.

Más tres de higiene: el OTP se consume en todas las carteras del mismo email, el bcrypt corre
exista o no el email (si no, el tiempo era un oráculo de enumeración) y `DELETE /propietarios`
limpia los códigos.

**⚠️ MIGRACIÓN SIN APLICAR:** `20260819120000_otp_propietario`. **Va ANTES del código** — al
revés el login del propietario tira 500. Es un `CREATE TABLE` puro y reversible.

**No se probó en el navegador:** el clasificador de seguridad de la sesión bloqueó el preview.
Sí: `tsc` 0, lint, `next build` con las rutas prerenderizadas, y 9 tests puros de separación de
kinds verificados en rojo.

**Riesgo residual asumido:** `Propietario.email` es ahora una credencial pero lo tipea el staff
y nadie lo verifica. Si el mismo string aparece en dos inmobiliarias, quien controle esa casilla
ve las dos carteras. Queda un `log.warn` para poder enterarse. Ver T-23-N2.

---

## T-23-N1 · El aislamiento del portal no tiene test de integración — ✅ CUBIERTA (por otro instrumento)

**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** base de prueba
**Estado: el test de integración SIGUE sin poder correrse; el modo de falla quedó cubierto igual.**

**Resuelta en lo que se podía**, rama `test/T-23-N1-aislamiento-portal`, commit `7a724ae`.
En vez del test de integración —que necesita una base y no hay— se agregó un guard
**estructural** (`apps/api/test/portal-aislamiento.test.ts`, puro, corre sin DB) que lee
`portal-propietario.ts` y verifica cuatro invariantes de los 5 endpoints de `/portal/*`: que
toda query nombre `p.inmobiliariaId`, que ninguna use `findUnique` (no admite filtro extra de
tenant en el `where`), que el portal no escriba, y que el detalle de rendición filtre por id +
propietario + tenant. Un quinto test verifica que el guard **siga encontrando queries**: sin ese
piso, mover las llamadas a un helper haría que los otros cuatro pasaran por vacuidad.

Probado en rojo con tres mutaciones. Es un instrumento más débil que un test de integración —
prueba la forma, no el comportamiento— y el archivo lo dice con todas las letras.

**Y va el destrabe de fondo:** `docker-compose.test.yml` con una Postgres efímera en `tmpfs`
(puerto 55432 para no pisar un Postgres propio), scripts `test:db:up` / `test:db:down` y la
sección nueva en `docs/TESTING.md`. **⚠️ SIN VERIFICAR: el daemon de Docker no estaba corriendo
en esta máquina.** Cuando alguien lo levante y confirme, se pueden correr los ~60 archivos de
test de integración que hoy nadie corre — los de plata (T-28) incluidos.

**Lo que sigue faltando:** el test de integración de verdad. Dos tenants, dos propietarios, y
cada endpoint devolviendo 404/vacío al pedir lo del otro.

---

### Contexto original

**Estado: ⛔ BLOQUEADA — y el bloqueo NO era el que decíamos.**

Al abrirla se destapó que **la regla 3 del prompt estaba mal**. Decía que los tests de
`apps/api` *"pegan a la Postgres de producción"* citando `docs/TESTING.md:25`, y esa línea dice
**lo contrario**: *"Esta NO es la DB de prod. Prod corre dentro de Railway con el host interno
(`*.railway.internal`), inalcanzable desde tu máquina. El proxy público es la instancia de
test/dev."* Era una lectura al revés de la propia fuente que citaba, y se propagó a media docena
de `estado.md` porque cada chat la repitió de ahí. Ya está corregida en el prompt.

**El bloqueo real es doble:**

1. `seedBase` siembra de forma **destructiva** una Postgres **remota y compartida**. No es prod,
   pero sí es la base que están usando los otros chats en paralelo: correrla se los lleva puestos.
2. Y más duro: **en esta máquina no existe `apps/api/.env`**, así que `DATABASE_URL` no está
   seteada y esos tests ni siquiera arrancan — fallan con un ZodError de env, no con un error de
   conexión.

**Qué destraba esto (decisión del dueño), en orden de preferencia:**

- **Una Postgres efímera local** (Docker) con su propio `DATABASE_URL`, que es lo que hace falta
  de verdad: hoy *ningún* test de integración se puede correr en el día a día, ni el de este
  portal ni los de plata. Es lo que también pide T-28.
- O, más rápido y peor: pasar el `.env` con el proxy y coordinar cuándo se puede sembrar sin
  pisar a otro chat.

**Mientras tanto**, el aislamiento del portal está verificado por lectura y por una revisión
adversarial de tres lentes (T-23), no por una prueba que falle sola si alguien saca un
`inmobiliariaId` de un `where`. Que es justo lo que esta tarea existe para arreglar.

Los 5 endpoints del portal están scopeados por `propietarioId` **e** `inmobiliariaId`, y eso se
verificó leyendo y con una revisión adversarial. Pero **no hay una prueba que falle** si mañana
alguien saca un `inmobiliariaId` de un `where`. Para una superficie de lectura sobre datos
financieros de terceros, eso es poco.

Pide una base de prueba y se cruza con T-28. (Acá decía *"los tests de `apps/api` hoy pegan a la
Postgres de producción"* — **es falso**, ver la corrección en T-01: el proxy público es la
instancia de test/dev, no prod. Lo que sí es cierto es que es **compartida** y que el seed la
borra, así que hace falta una base propia igual.) El caso mínimo: dos tenants, dos propietarios,
y que cada endpoint devuelva 404/vacío al pedir lo del otro.

---

## T-23-N2 · `Propietario.email` es una credencial que nadie verifica

**Experto:** BE + PROD · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA en su parte accionable** — commit `1cdaf38`. Queda abierta la verificación
del email (ver abajo).

**Adentro había un bug que rompía el portal entero.** El email se guardaba tal cual lo tipea el
operador mientras el login busca en minúsculas, y Postgres compara distinguiendo mayúsculas: un
propietario cargado como `Juan.Perez@Gmail.com` **no podía entrar nunca**. Y el fallo es mudo —
pide el código, el endpoint responde `ok` (no revela si el email existe, a propósito) y el
código no llega jamás. O sea que el portal de T-23 no funcionaba para buena parte de la cartera
ya cargada. Los otros dos logins por OTP ya lo habían aprendido cada uno por su cuenta;
`Propietario` era el único que faltaba porque hasta T-23 no era una puerta.

La regla vive ahora en `apps/api/src/lib/normalizar-email.ts`, con 5 tests puros verificados en
rojo, aplicada en las dos escrituras. **Migración de backfill escrita y sin aplicar**
(`20260819140000_email_propietario_minusculas`) para lo que ya está cargado; trae dos consultas
de solo lectura para mirar antes a cuántos afecta.

**El "único por tenant" se descartó, con motivo:** dos propietarios de la misma inmobiliaria
pueden compartir email legítimamente (un matrimonio, el contador de varios dueños), así que
rompería datos reales — y no cierra el problema de fondo, que es **entre** tenants: un
`@@unique([inmobiliariaId, email])` no impide que el mismo string aparezca en dos carteras de
inmobiliarias distintas. En cambio se hizo **distinguible** (el selector muestra nombre +
inmobiliaria) y sigue siendo **detectable** (el `log.warn` de T-23).

**De paso se cerró un hueco de T-23:** faltaba el selector de cartera. Sin él, quien administra
con dos inmobiliarias entraba a una y no tenía forma de llegar a la otra ni de saber que
existía.

**Lo que queda abierto → T-23-N2-N1.**

---

## T-23-N2-N1 · Verificar el email del propietario (doble opt-in)

**Experto:** BE + PROD · **Prioridad:** 🟡 · **Depende de:** nada

Es la única salida que cierra de verdad el riesgo que abrió T-23: mientras el email lo tipee el
staff y nadie lo confirme, quien controle esa casilla entra — y si hay un typo, entra a una
cartera ajena.

Pide su propia tanda: mail de confirmación, un estado `emailVerificado` en el modelo (migración),
y sobre todo **decidir qué se hace con los que ya están cargados sin verificar**: bloquearles el
portal hasta que confirmen es lo seguro, pero deja afuera a toda la cartera existente el día 1.

No bloquea el portal, que ya sale con el riesgo documentado, distinguible y detectable.

---

Con el portal, ese campo dejó de ser un dato de contacto y pasó a ser **la llave de entrada** —
pero sigue igual que antes: lo tipea el staff a mano (`POST`/`PUT /propietarios`), no se
verifica nunca, no se normaliza a minúsculas al escribirlo (sí al buscarlo), no tiene
`@@unique([inmobiliariaId, email])` —a diferencia de `Usuario`, que sí lo tiene— y el `PUT` lo
pisa en cada edición, incluso a `''`.

Consecuencia concreta: si el mismo string aparece en dos inmobiliarias (un typo, un
`info@…` placeholder, el mail del contador usado para varios dueños), quien controle esa
casilla ve las dos carteras. Hoy queda un `log.warn` cuando pasa, que es detección, no
prevención.

Decidir entre: verificar el email (doble opt-in), hacerlo único por tenant, o las dos.

---

### ⚠️ ESTADO CORREGIDO + una mina desactivada — commit `c9c9373`

**Dos de los defectos que enumera esta tarea ya no son ciertos.** Al ir a arreglarlos:

- *"no se normaliza a minúsculas al escribirlo"* → **ya se normaliza**, en el POST y en el PUT
  (`lib/normalizar-email.ts`, `normalizarEmail`). Lo resolvió otra tanda. Se corrige acá para que
  nadie lo rehaga.
- *"el PUT lo pisa en cada edición, incluso a ``"* → **era cierto y se arregló**. El email sólo
  se escribe si vino en el body. Como `normalizarEmail(undefined)` devuelve ``, cualquier caller
  que omitiera el campo le borraba el email al propietario — y desde T-23 eso no es perder un dato
  de contacto, es **dejarlo afuera del portal**, sin ningún error porque el PUT devuelve 200. Hoy
  el diálogo del panel manda el campo siempre, así que era una mina y no un incendio; se desactiva
  igual, porque el próximo caller (un PATCH parcial, un script, la app móvil) no tiene por qué
  saberlo. Un `` explícito sigue borrándolo, que es legítimo.

**Lo que queda de esta tarea es la decisión, no el código.** Y tiene un costo real de los dos
lados, por eso no se resuelve solo:

| Opción | Cierra el riesgo | Lo que cuesta |
|---|---|---|
| Doble opt-in | Sí, del todo | Hay que decidir qué pasa con la cartera YA cargada: bloquearla hasta que confirmen es lo seguro, pero deja a todos los propietarios afuera el día 1 |
| `@@unique([inmobiliariaId, email])` | Sólo el cruce entre carteras del mismo tenant | Migración + resolver a mano los duplicados que ya existan; no impide el typo hacia OTRO tenant, que es el caso que preocupa |
| Las dos | Sí | La suma de ambos |

El `log.warn` que existe hoy es **detección, no prevención**: avisa después de que alguien entró.

---

## T-23-N3 · `ParticipacionPropietario` no tiene vigencia — ✅ HECHA (la mitad de plata)

**Experto:** BE · ~~🟢~~ **Prioridad real: 🟠** · **Depende de:** nada

El modelo sólo tiene `propiedadId`, `propietarioId` y `porcentaje`: no hay `desde`/`hasta`, así
que **no se sabe desde cuándo alguien es dueño de una unidad**. Por eso `/portal/reclamos` se
recorta al contrato vigente en vez de a "desde que sos dueño", que sería lo correcto: hoy un
propietario ve los reclamos del inquilino actual aunque haya comprado ayer, y no ve los suyos si
el contrato cambió.

**La prioridad estaba mal calibrada, y por una razón que la ficha no mencionaba.** El problema de
reclamos es el síntoma chico, y encima ya está mitigado a propósito
(`portal-propietario.ts:487-494`). El grande es que **la misma falta de vigencia mueve plata que
se transfiere**: `POST /rendiciones` arma el universo de propiedades del dueño desde su
participación de **hoy** (`plata.ts:1653`) y aplica el porcentaje de **hoy** (`:1741`), pero el
`periodo` lo elige el operador y puede ser de hace dos años. Cambiar el reparto con alquiler
cobrado y sin rendir le transfiere al entrante lo del saliente, y el saliente desaparece del
universo sin forma de cobrarlo. El cap cruzado evita pagar de **más**; no dice nada sobre **a
quién**.

**Resuelta la mitad de plata** en `feat/T-23-N3-vigencia-participacion`, commit `c4981dc`:
`PUT /propiedades/:id/participaciones` devuelve **409** si la propiedad tiene alquiler cobrado
sin rendir, nombrando períodos y monto. **NO se agregó `desde`/`hasta`, y no hay migración.**

**Por qué el guard es el arreglo de fondo y no un parche:** la vigencia que le falta a la tabla
**ya existe en el ledger** — `AlquilerRendido` congela `participacion` y `periodo` al rendir
(`schema.prisma:1948-1949`). Sólo hacía falta forzar el orden: primero se rinde con el reparto
viejo (y queda congelado), después se cambia. Versionar las filas, en cambio, exige cambiar la
**primary key compuesta** (`@@id([propiedadId, propietarioId])`) **y** hace que la Σ de
`tasaComisionDeParticipaciones` pase de 100% — la inmobiliaria comisionaría de más, en silencio,
en dos lugares (el helper y su fórmula duplicada inline en `/caja/cierre`).

De arrastre se desactivó una mina: el `part?.porcentaje ?? 100` de `plata.ts:1741`, hoy
inalcanzable, que el día que alguien filtre participaciones por ventana temporal le rendiría el
**alquiler entero** a ese dueño en silencio. Ahora falla ruidoso.

Abre **T-23-N3-N1** (la mitad del portal) y **T-23-N3-N2**.

---

## T-23-N3-N1 · Que el propietario vea "desde que sos dueño" — BLOQUEADA por decisión

**Experto:** BE + PROD · **Prioridad:** 🟠 · **Depende de:** una respuesta de Camila
**Estado: ◑ MITAD HECHA** — commit `a5e2019`. Se hizo la mitad que **no** dependía de la decisión: **empezar a registrar** los cambios de reparto (tabla append-only `CambioParticipacion`, escrita DENTRO de la transacción del PUT, no por `registrarEvento` — que es best-effort y no puede sostener un recorte de privacidad). Por ahora **sólo se escribe: nadie la lee**, cero cambio de comportamiento. Se hizo ya porque cada día sin esto es **historial que se pierde y no se puede reconstruir**. De paso apareció que la FK con RESTRICT habría roto el borrado de propiedades (mismo bug que la FK del OTP en T-23): va sin FK, como `AlquilerRendido.propiedadId`. **La otra mitad —usar el dato para recortar el portal— SIGUE BLOQUEADA** por la pregunta a Camila. 7 tests puros en rojo verificado; 310 puros en verde. **Migración sin aplicar:** `20260819200000_historial_reparto`, cuanto antes.
**Origen:** T-23-N3. Es la otra mitad, la de privacidad.

**Estado verificado.** Hoy no existe **ningún** rastro de cuándo cambió un reparto: el handler
del PUT no llama a `registrarEvento` y `TipoEventoAuditoria` no tiene valor para participaciones.
Y `EventoAuditoria` **no puede** ser la fuente de verdad de un recorte de privacidad: es
best-effort declarado (`lib/auditoria.ts:22-32`, `try/catch` que se traga su propio error y corre
**después** del commit). Un recorte que protege datos de un tercero no puede colgar de un log que
puede no escribirse.

Además del caso de reclamos que nombra la ficha original, tiene el mismo problema
`portal-propietario.ts:303-315`: las últimas 6 liquidaciones con fecha real de transferencia y el
nombre del inquilino. Ningún comentario lo reconoce.

**Qué hay que hacer.** Tabla append-only de cambios de reparto (`propiedadId`, `propietarioId`,
`porcentajeAnterior` nullable = entró, `porcentajeNuevo` nullable = salió, `aplicadoAt`,
`autorId`), escrita **dentro** de la misma transacción del `deleteMany`/`createMany`. Migración
**aditiva pura**: cero filas escritas, cero columnas alteradas. Tabla vacía significa "toda
participación existente se considera vigente desde siempre" — el pasado no tiene dato y no se
inventa.

**⚠️ LO QUE BLOQUEA.** Con la regla "sin cambio registrado = dueño de siempre = ve todo",
cualquier unidad de la cartera que **ya cambió de dueño antes de hoy** le muestra al comprador el
historial completo del inquilino. Hoy eso está tapado por el recorte al contrato vigente; con el
cambio se destapa. **Preguntarle a Camila, textual: "¿hay hoy en la cartera departamentos que
cambiaron de dueño mientras el inquilino seguía siendo el mismo?"** Si dice que no, sale tal cual.
Si dice que sí, hay que cargar a mano la fecha de compra de esas unidades antes de soltar el
recorte ampliado. Equivocarse acá es filtrar datos de un inquilino a alguien que no tiene derecho
a verlos.

**Criterio de aceptación.** Un propietario que compró en marzo no ve los reclamos ni los pagos de
enero; y el dueño de siempre ve el historial completo aunque la unidad esté vacía hoy.

---

## T-23-N3-N2 · Gastos, reclamos e ingresos se arrastran hacia atrás sin piso

**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** relevamiento de T-23-N3.

> ⛔ **Estado: MAL DIAGNOSTICADA. No se cambió nada — el cambio que pedía era una regresión.**
>
> **La ausencia del `gte` es deliberada, está documentada en los tres bloques, y el anti-doble
> no es la fecha: es un flag.**
>
> - **Gastos de caja** (`plata.ts:1786`): el `where` incluye `descontadoEnRendicion: false`, y
>   justo arriba del filtro de fecha está escrito que la ventana estricta se sacó porque *"un
>   gasto cargado tarde —o de un mes ya rendido— quedaba huérfano para siempre"*, y que **"el
>   anti-doble no es la fecha sino `descontadoEnRendicion`"**. O sea: el piso que esta tarea
>   propone ya existió y se quitó a propósito.
> - **Reclamos** (`plata.ts:1877`): no tiene flag —un reclamo no tiene estado terminal— así que
>   usa dos topes sobre el ledger `GastoRendido`: lo que este dueño ya rindió, y
>   **`restanteGlobal = total − lo rendido por TODOS`** (`:1918`). Un reclamo no puede cobrarse
>   más que su costo total sumando todos los dueños y todas las rendiciones. El comentario de
>   `:1897-1904` que esta tarea cita como "mitigación que no cubre el arrastre" **es** ese tope
>   global, y sí lo cubre.
> - **Ingresos extra** (`plata.ts:1952`): mismo esquema, y el comentario lo dice explícito. Acá
>   el carry-over protege al **propietario**: es plata suya que sin arrastre nunca se le rendiría.
>
> **Por qué es fácil equivocarse:** leyendo sólo el filtro de fecha, la conclusión es correcta.
> El anti-doble está en otras líneas del mismo `where` y en la aritmética de los topes, treinta
> líneas más abajo.
>
> **Lo que sí queda** es un caso distinto: un gasto anterior a que la persona fuera dueña, nunca
> rendido, se le cobra a ella. Eso no es el arrastre — es que **no existe el dato de desde
> cuándo alguien es dueño**. Es T-23-N3, cuya continuación T-23-N3-N1 está bloqueada por
> decisión de producto. Ponerle un piso por fecha sería tapar ese agujero con el mecanismo
> equivocado y romper el carry-over de paso.
>
> Detalle completo en `work-agent/tareas/T-23-N3-N2/estado.md`.

**Estado verificado.** En la rendición, los tres descuentos filtran con
`fecha: { lt: finPeriodo }` y **sin `gte`**: `plata.ts:1786` (gastos de caja), `:1877` (reclamos a
cargo del propietario) y `:1952` (ingresos extra). O sea, carry-over ilimitado hacia atrás: un
gasto de 2024 se le descuenta al dueño que rinde en 2026.

El comentario de `plata.ts:1897-1904` ya describe el caso — *"al vender la propiedad, el dueño
entrante se comía entero un arreglo que el saliente ya había pagado"*— pero la mitigación que
describe no cubre el arrastre sin piso.

**Qué hay que hacer.** Definir el piso: ¿desde la última rendición de ese dueño? ¿desde el inicio
del contrato? Y aplicarlo a los tres. Monto en juego: el del gasto, normalmente menor que un
alquiler, pero es plata que se le descuenta a quien no corresponde.

**Criterio de aceptación.** Un gasto anterior a la última rendición ya cerrada no vuelve a
descontarse.

---

## T-23-N4 · No hay revocación de sesión en ningún tipo de token

**Experto:** BE + SEC · **Prioridad:** 🟠 · **Depende de:** nada

No existe logout server-side, ni `jti`, ni denylist, en **ninguno** de los 6 kinds. Los guards
revalidan contra la DB —que es lo que da la revocación real hoy: `requireUsuario` mira `activo`,
el de co-inquilino mira `estado`, el de profesional mira la reasignación— pero el del
propietario sólo puede mirar que la fila exista, porque `Propietario` no tiene ningún flag de
estado. Y su token dura 7 días.

Es deuda de todo el sistema, no sólo del portal, pero el portal la hereda sobre datos
financieros de terceros. Lo mínimo: un flag en `Propietario` que corte el acceso sin borrar la
fila.

---

### ✅ RESUELTO (lo mínimo) — commit `47c8717`

`Propietario.activo`, misma convención que `Sociedad.activa` ("baja lógica") y `Usuario.activo`.
Se filtra en el guard —que es el único punto de revocación real de un token de 7 días—, en las
tres puertas del portal, en los anuncios y en el importador de cartera.

**Cuatro decisiones que importan más que el flag:**

1. **La baja es POR FILA, no por persona.** El mismo email puede ser propietario en varias
   inmobiliarias; que una lo dé de baja no puede cerrarle el acceso a las otras.
2. **NO se filtra en `tasaComisionDeParticipaciones`.** Sería un bug de plata: la tasa es la suma
   ponderada sobre el 100% de la propiedad, y excluir a un dueño dado de baja la baja falsamente
   → la inmobiliaria comisiona de menos, en silencio y en cada pago. Documentado en los **dos**
   lugares donde vive la fórmula (la lib y la copia inline del cierre de caja), con un test puro
   que fija la excepción.
3. **NO se filtra el histórico de rendiciones.** Es plata que ya se movió: ocultarla descuadra
   los totales y el que audita ve menos de lo que salió.
4. **El importador de cartera reactivaba de hecho** a un propietario dado de baja: matcheaba por
   nombre+apellido y reusaba la fila, sin pasar por ningún alta.

`PATCH /propietarios/:id/activo` con el mismo 409 de cobranza directa que ya usa el cambio de
dueños. Migración **escrita, no aplicada** — va ANTES del deploy: el guard lee la columna y contra
una base sin ella el portal responde 500. Se eligió que falle ruidosamente en vez de degradar en
silencio.

**204 tests puros.**

### 🔴 Pero el hueco real es otro → T-23-N4-N1

El relevamiento de los 6 kinds encontró algo peor que lo que decía esta tarea, y conviene leerlo
antes de dar el tema por cerrado.

---

## T-23-N4-N1 · El inquilino titular y la persona no son revocables de ninguna forma — ✅ CERRADA 20/08

> ## ✅ Los tres agujeros YA estaban tapados. Esta ficha quedó vieja.
>
> Verificado contra el código el 20/08, punto por punto:
>
> - **`requireInquilino`** ya no devuelve el payload crudo: llama a `inquilinoRevocado`, que
>   consulta la base, con la decisión separada en `motivoRevocacionInquilino` (pura y testeada).
> - **La rama `inquilino` de `requireContratoAcceso`** llama al mismo helper. El comentario lo
>   dice: *"cuando la revalidación vivía en una sola, la otra quedaba abierta"*.
> - **`requirePersona`** revalida el email contra `Inquilino` (y el comentario explica por qué
>   contra `Inquilino` y no contra `Persona`, que fue un bug real).
>
> **El cuarto punto también era falso positivo.** La ficha decía que `operacion.ts` no gatea
> nunca pese a que el docstring se atribuye "abrir reclamo": `POST /mis-reclamos` **sí** controla
> el estado, sólo que **inline** —mismo 409, mismo mensaje— y encima distingue el 404 cuando el
> contrato no existe, cosa que el helper colapsa. Un grep de `exigirContratoActivo` lo daba por
> faltante.
>
> **Lo que sí salió del barrido, y es lo que se entregó:** la superficie **no se puede auditar a
> mano**. Se barrió tres veces —a mano (12 endpoints, se comió 3 archivos), con agentes en
> paralelo (12, se comió 2), parseando de verdad (**17**)—. Los que se escapan son invisibles a
> un grep: `anuncios.ts` registra en un **loop** con la ruta en template literal, `uploads.ts` usa
> un **guard local propio**, y `POST /reportes` usa `requireAuth` pelado, que acepta tokens de
> inquilino.
>
> Entregable: **`test/inquilino-escrituras-declaradas.test.ts`**, un registro de decisiones
> ejecutable — toda escritura del inquilino tiene que estar declarada como GATEADA o EXENTA con
> el motivo, y una nueva falla el test hasta que alguien decide. Hoy: 17 escrituras, 8 gateadas,
> 9 exentas, ninguna es un hueco. Mutación 3/3. Detalle en `work-agent/tareas/T-23-N4-N1/`.

---

## T-23-N4-N1-N1 · `POST /uploads` no tiene cuota: un token vivo puede llenar el Volume — ✅ HECHA

**Estado: ✅ HECHA** — commit `22f0790`. Cuota **por inmobiliaria** (`UPLOADS_CUOTA_MB`, default
2 GB), medida antes de escribir, con cache por tenant. Al tope: **507** con
`codigo: CUOTA_TENANT_LLENA`, distinto del disco lleno de verdad porque la acción de quien
atiende es otra.

**Por tenant y no por usuario**, que era la decisión del arreglo: el Volume es uno solo y
compartido, así que un tope por usuario no evita que una inmobiliaria con muchos llene el de
todas. Por tenant acota el daño a quien lo causa. Y **no** se gateó por contrato activo — la
tarea ya avisaba que eso rompe `POST /mis-documentos`, que a propósito deja subir documentación
después de terminado el contrato.

**Un bug que cazó su propio test:** la primera versión hacía `Number(env.UPLOADS_CUOTA_MB)`
directo, y `Number('')` es 0 — un `UPLOADS_CUOTA_MB=` vacío en un `.env` apagaba la cuota en
silencio, que es justo el modo de falla que el módulo venía a cerrar.

De paso: `MAX_BYTES` en `uploads.ts` era una constante muerta. El tope real de 10 MB lo aplica
`@fastify/multipart` en `app.ts`.

**Experto:** SEC + OPS · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** T-23-N4-N1, barrido de escrituras del inquilino.

`POST /uploads` (`routes/uploads.ts:272`) acepta **cualquier token autenticado** —usuario del
panel, inquilino, co-inquilino, y el profesional por link mágico— y escribe en el Volume de
Railway, bajo el directorio del tenant. Límite de 10 MB por archivo y tipos restringidos, pero
**sin cuota por usuario, sin límite de cantidad y sin rate limit**.

El token de un inquilino dura **15 días**, así que alguien cuyo contrato ya terminó puede seguir
subiendo archivos durante dos semanas. Y el propio handler ya contempla que el disco se llene:
devuelve **507** con *"el servidor se quedó sin espacio"*.

**Ojo con el arreglo fácil, que es el equivocado.** Gatearlo con `exigirContratoActivo` rompe el
caso legítimo: `POST /mis-documentos` permite a propósito subir documentación propia después de
finalizado el contrato, porque `Documento` cuelga de `inquilinoId`, no de `contratoId`. El
problema no es el estado del contrato, es que **no hay cuota**.

**Qué mirar:** cantidad de archivos por usuario en una ventana, o bytes acumulados por tenant, o
rate limit por token — no el estado del contrato.

**Experto:** BE + SEC · **Prioridad:** 🔴 · **Depende de:** nada
**Origen:** relevamiento de T-23-N4. No salió de la reunión.

De los 6 kinds de token, sólo **tres** revalidan contra la base: `usuario` (mira `activo`),
`co-inquilino` (mira `estado`) y `profesional` (mira la asignación). El propietario ya quedó
cubierto por T-23-N4. Quedan dos que **no consultan la base en absoluto**:

- **`inquilino`** — `requireInquilino` (`guards.ts:83`) y la rama `inquilino` de
  `requireContratoAcceso` (`guards.ts:236-245`) devuelven el payload crudo del JWT, sin una sola
  query. El titular **se autoasigna permiso COMPLETO desde el token**. Borrar la fila `Inquilino`
  no le saca el acceso, porque nadie la consulta. TTL: **15 días**.
- **`persona`** — `requirePersona` (`guards.ts:147`) no consulta nada; la identidad es un email
  adentro del token. Si se emitió por error (un OTP a un email que después se corrige), no hay
  forma de invalidarlo hasta que expire.

Es **más grave que el caso del propietario**: a ése al menos se lo podía revocar borrando la fila.
Acá no hay ninguna palanca.

El único freno parcial del inquilino es `exigirContratoActivo` (409), y **sólo en escrituras** —
y ni siquiera en todas: `operacion.ts` (reclamos, ratings, confirmaciones) no lo llama nunca,
pese a que el docstring de `guards.ts:279-280` se atribuye gatear "abrir reclamo". Ese desfasaje
entre el comentario y el código conviene arreglarlo aunque no se haga nada más.

**Lo que hay que decidir.** Revalidar contra la fila en cada request es lo mismo que ya hacen los
otros tres guards, así que no es un diseño nuevo: es aplicar el patrón que falta. La pregunta es
si además hace falta `jti` + denylist para poder cerrar sesiones sin tocar el modelo — eso sí es
rediseño de auth y no entra acá.

**Criterio de aceptación.** Ningún kind de token concede acceso sin haber confirmado contra la
base, en ese request, que el sujeto sigue habilitado.

---

### ✅ RESUELTO — commit `88f4e02` · **sin migración**

Los seis kinds revalidan ahora contra la base. Y no hizo falta ninguna columna nueva: el
`Inquilino` ya tenía de dónde agarrarse.

**Titular.** Se revalidan dos cosas: que la fila siga existiendo en ese tenant (borrarla ahora sí
revoca) y que el contrato del token siga siendo el suyo (si se reasignó, el token quedó apuntando
a un alquiler que no le corresponde). La revalidación vive en **una** función compartida por las
**dos** puertas del titular —`requireInquilino` y la rama `inquilino` de `requireContratoAcceso`—
porque cuando estaba en una sola, la otra quedaba abierta.

**La regla sutil, con test que la fija:** un token con `contratoId: null` **no** se revoca aunque
la fila ya tenga contrato. Es alguien que se logueó antes del alta; su token nunca reclamó nada, y
cortarlo lo mandaría al login sin ganar seguridad. La igualdad estricta —la "simplificación"
obvia— rompe justo ese caso, y el test lo atrapa.

**Persona: revocación más débil, y el comentario lo dice.** La identidad es sólo un email dentro
del token, así que lo único revalidable es que ese email siga siendo de alguien. **Cubre** el caso
que motivó esto (un OTP emitido a un email equivocado que después se corrige). **No cubre**
revocarle el acceso a alguien cuyo email sigue vigente: para eso hace falta un id en el payload, y
eso es cambiar el contrato del token. Queda dicho en vez de aparentar una garantía que no da.

**216 tests puros**, 7 nuevos verificados en rojo.

**Queda pendiente, y no es de este alcance:** `exigirContratoActivo` no cubre todas las escrituras
—`operacion.ts` (reclamos, ratings, confirmaciones) no lo llama nunca, pese a que el docstring de
`guards.ts` se atribuye gatear "abrir reclamo"—. Es un desfasaje entre el comentario y el código
que conviene arreglar.

---

**Qué pidió Camila.** Es el pedido más grande de la reunión **y tiene modelo de negocio
atrás**:

- `[1:01:16]` Alan: *"No tenemos un lugar para el propietario."*
- `[1:02:00]` Camila: **"No podemos vender la aplicación a solamente una persona que tenga
  [propiedades] y que no sea inmobiliaria."**
- `[1:04:59]` *"Yo quiero rendirle al propietario y cargarle ahí y rendirle la cuenta ahí."*
- `[1:05:10]` *"Lo que se gastó, lo que se hizo, el cobro de la administración mía por mes, el
  10% de descuento que tiene, más lo que se le pagó; que se le rinda todo y él lo vea mediante
  la aplicación."*
- `[1:05:30]` *"Y vos también me estás auditando a mí mediante esa aplicación, que ves el día
  que pagó esa persona."*
- `[1:05:51]` *"Las inmobiliarias que no trabajan con departamentos propios van a tener que
  cobrarle al propietario… hay un porcentaje que lo va a tener que pagar el propietario al que
  vos le estás administrando la propiedad."*

**Estado verificado — el dato ya existe; falta la puerta de entrada.** Lo que Camila quiere que
el propietario vea **ya está modelado y calculado**:

| Lo que pide | Dónde vive hoy |
|---|---|
| Lo que se cobró | `Rendicion.montoBruto` + `AlquilerRendido` (por liquidación) |
| Lo que se gastó | `GastoRendido` (con `refId` a caja o reclamo) |
| La comisión | `Rendicion.comisionPct` + `comisionMonto` (snapshot congelado) |
| Lo que se le pagó | `Rendicion.montoNeto` |
| Estado de pago de sus inquilinos | `GET /propiedades/:id/salud-pago`, `propiedad-timeline.ts` |
| Sus reclamos | `propiedad-reclamos.ts` |
| Su ganancia | `propiedad-ganancias.ts`, `ganancia-contrato.ts` |

Lo que **no existe** es: un tipo de sesión para el propietario, y una superficie donde lo vea.

**Qué hay que hacer** (el MVP más chico que cumple lo que ella pidió):
1. **Auth.** Hoy hay 6 kinds de JWT (`packages/shared/src/auth.ts`). Agregar `propietario`
   siguiendo el patrón del inquilino: **OTP por email**. ⚠️ Ojo con `JwtPayloadSchema`: es una
   unión discriminada de 3 kinds y `persona`/`profesional` quedan afuera **a propósito**; el
   nuevo kind tiene que seguir esa convención para no romper la exhaustividad.
2. **Endpoints de lectura** scopeados al propietario: sus propiedades, sus rendiciones con el
   detalle, el estado de pago de sus inquilinos, sus reclamos.
3. **Superficie**: decidir con PROD si es una sección de la PWA existente o un front nuevo.
4. **Monetización**: definir cómo se cobra. Camila lo planteó como parte del precio.

**Criterio de aceptación.** Un propietario entra con su email, ve sus rendiciones con el
detalle (bruto, comisión, gastos, neto) y el estado de pago de sus inquilinos. **No puede ver
nada de otro propietario ni de otro tenant.**

**Riesgo.** ⚠️ **Alto, y es de seguridad.** Es una superficie de lectura nueva sobre datos
sensibles de terceros. Tiene que pasar por SEC antes de salir. Y hay dos precedentes en el
código que **no** hay que repetir: el token de garante es `base64url` de un JSON con un
"secreto" hardcodeado (`garante-token.ts:10`, el propio archivo lo declara *"no-secret: es sólo
ofuscación visual"*), y el hash del certificado es FNV-1a + djb2 truncado, sin sal y
determinístico (`inquilino-mundo.ts:148-164`). **El portal del propietario no puede nacer con
un token así.**

---

## T-36 · TOCTOU al cambiar el modo de cobranza — ✅ RESUELTO

> **Hecho.** La re-verificación de `alquilerCobradoSinRendir` ahora corre **dentro** de la
> transacción (el helper acepta un `TxOrClient`, como `deposito.ts` y `evento-contrato.ts`), y
> el `UPDATE` pasó a `updateMany` condicionado al modo que se leyó → 409 si otro cambió el
> modo en el medio.
> **Lo que cierra y lo que no, explícito:** cierra el doble cambio de modo y achica la ventana
> del otro caso de toda la latencia del handler (que incluye las consultas de propietario y
> cuenta) a lo que dura la transacción. **No la cierra del todo**: en READ COMMITTED una
> conciliación que commitea justo después de la re-lectura sigue entrando. Para eso haría
> falta que conciliar un pago tome un lock sobre el contrato — otro cambio, otra tarea.

**Experto:** BE · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** revisión adversarial del 19/08 (dimensión concurrencia). **Es sobre código propio
de esta tanda**, no heredado.

**Estado verificado.** `PATCH /contratos/:id/modo-cobranza` calcula `alquilerCobradoSinRendir`
(`lib/rendicion-pendiente.ts`) **fuera de transacción**, y el `UPDATE` que cambia el modo **no
está condicionado** a que ese cálculo siga siendo válido. Entre la lectura y la escritura, otro
operador puede conciliar un pago: el guard ya pasó y el modo cambia igual, con plata cobrada
sin rendir del lado equivocado.

**Por qué no bloquea.** Requiere dos operadores actuando sobre el mismo contrato en la misma
ventana de milisegundos. Pero el patrón correcto ya existe en el repo y está a una línea:
`updateMany({ where: { id, modoCobranza: <el que se leyó> } })` y 409 si `count === 0`.

**Criterio de aceptación.** Dos requests concurrentes sobre el mismo contrato: una cambia el
modo, la otra recibe 409 y no pisa nada.

---

## T-37 · La matriz de permisos le promete a OPERADOR algo que el endpoint le niega — ✅ RESUELTO

> **Hecho: se alineó la matriz, no el endpoint.** Y el motivo importa, porque el diagnóstico
> inicial estaba al revés.
>
> La matriz no estaba "de más": declaraba `roles: ['ADMIN','CAJA','OPERADOR']` con
> `rolesAprobacion: ['OPERADOR']`, o sea un circuito pensado — *el operador carga el efectivo y
> queda pendiente de aprobación*. **Ese circuito nunca se construyó:** `requiereAprobacion` no
> se llama en ningún lado de `apps/api` (para contratos sí existe el equivalente,
> `contratoQuedaPendiente`; para pagos no). Mientras tanto `POST /pagos/manual` exige
> `pago.conciliar`, así que el OPERADOR se comía un 403 y la pantalla de Equipo le decía a la
> administradora que sí podía.
>
> Se sacó OPERADOR de la capacidad. **No le quita nada a nadie**: hoy ya no podía. Y la
> capacidad **no gatea nada** —sólo se dibuja en la tabla de permisos—, así que el cambio no
> altera ningún comportamiento, sólo deja de mentir. Quien cobra en el mostrador va con rol
> **CAJA**, que existe exactamente para eso.
>
> **No se tocó el endpoint** a propósito: darle a OPERADOR una capacidad sobre plata que hoy no
> tiene es una decisión de producto, no la corrección de una inconsistencia.

**Experto:** BE + PROD · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** revisión adversarial del 19/08 (dimensión multi-tenant).

**Estado verificado.** `packages/shared/src/permisos.ts:140` declara
`pago.manual.cargar` para `['ADMIN','CAJA','OPERADOR']`, pero
`POST /pagos/manual` (`plata.ts:1005`) exige **`pago.conciliar`**, que es sólo
`['ADMIN','CAJA']`. La pantalla Configuración → Equipo le muestra a la administradora que
Operador **sí** puede "Cargar pago manual (efectivo)"; el endpoint le contesta 403
*"Tu rol no permite: pago.conciliar"*.

**No es una regresión**: el guard es idéntico en `main`. Lo que cambió es la matriz, que ahora
declara una capacidad que nunca se cableó.

**Qué hay que hacer.** Decidir cuál de las dos manda —si el mostrador tiene que poder cargar
efectivo, el endpoint debe pedir `pago.manual.cargar`; si no, la capacidad sale de la matriz—
y dejar las dos de acuerdo. **Es decisión de producto**, porque define qué puede hacer el
personal de mostrador.

---

## T-39 · El historial fallaba en silencio y se llevaba la operación puesta — ✅ RESUELTO

> **Nota al integrar (19/08): quedó resuelto por otra vía, y es mejor que la de acá.**
> Este documento describe el arreglo que sacaba el `catch` para que el error propagara. Eso
> hacía visible la pérdida, pero tenía un costo: un fallo al escribir el historial volteaba la
> conciliación del pago que lo generó.
>
> La línea principal lo resolvió cambiando **la firma**: `registrarEventoContrato` ahora recibe
> `PrismaClient` y **no acepta un `tx`**, y se llama **después** del commit. Así el `catch`
> vuelve a ser una red legítima —el historial es best-effort de verdad— y es **el compilador**
> el que garantiza que nunca corra dentro de una transacción.
>
> Mismo diagnóstico, mejor solución: la operación se completa igual y el historial ya no puede
> llevársela puesta. Se conserva la de la línea principal.

**Experto:** BE · **Prioridad:** 🟠
**Origen:** revisión adversarial del 19/08 (dimensión concurrencia).

**El problema.** `registrarEventoContrato` (`lib/evento-contrato.ts`) atrapaba y descartaba
cualquier error del `create`, con este argumento escrito en el propio docblock: *"un evento del
historial es informativo, no puede voltear la operación que lo generó; el precio es un hueco en
el timeline"*.

**La premisa era falsa.** Los **5** call sites lo llaman **dentro de una `$transaction`**,
pasándole el `tx` (`core.ts:1168` y `:2146`, `operacion.ts:325` y `:801`, `plata.ts:462` —
o sea conciliar un pago y renovar un contrato, entre otros). En PostgreSQL un statement que
falla deja la transacción **abortada**: lo que venga después revienta con `25P02` y el `COMMIT`
se comporta como `ROLLBACK`.

Entonces el `catch` no salvaba nada — la operación se perdía igual. Lo único que lograba era que
el handler devolviera **200** y el operador creyera que había quedado hecho. El precio real no
era un hueco en el timeline: era **perder la operación en silencio**.

**Qué se hizo.** Se sacó el `catch`. Entre perder la operación avisando y perderla callando,
avisar gana: el operador reintenta. Si algún día hace falta el best-effort de verdad, va
**fuera** de la transacción (cliente global, después del commit), no de vuelta acá.

**Test.** `test/evento-contrato-propaga.test.ts`, puro (el `tx` es un doble). Verificado en rojo
volviendo a poner el `catch`.

---

## T-40 · La pantalla de pagos ofrecía lo que el server ya no permite — ✅ RESUELTO

**Experto:** FE-P · **Prioridad:** 🟠
**Origen:** revisión adversarial del 19/08. Es consecuencia directa del cambio de roles de
esta misma tanda.

**El problema.** `pago.conciliar` dejó de incluir a OPERADOR, pero `pagos-por-validar.tsx`
no gateaba nada: la pantalla seguía mostrando **Validar** y **Rechazar** a cualquier rol.
El operador tocaba el botón y se comía un 403. (La página sí gateaba `contrato.aprobar`;
`pago.conciliar` se había pasado por alto.)

**Qué se hizo.** La bandeja sigue **visible en modo lectura** —ver qué hay pendiente no le
hace mal a nadie y es la mitad útil de la pantalla—; lo que se saca es la promesa de poder
decidir. "Ver comprobante" queda para todos. Donde estaban los botones ahora dice
*"Confirmar o rechazar un pago lo hace Administrador o Caja"*.

**Verificado en navegador** contra un stub: con **ADMIN** están los tres botones y no aparece
el aviso; con **OPERADOR** quedan 0 botones de decisión, sigue "Ver comprobante", y aparece el
aviso.

---

## T-41 · El Historial del contrato no se refrescaba nunca — ✅ RESUELTO

**Experto:** FE-P · **Prioridad:** 🟠
**Origen:** revisión adversarial del 19/08.

**El problema.** El timeline usaba `queryKey: ['contrato-eventos', id]`, una isla: **ninguna**
de las 8 mutaciones que invalidan `['contrato']` lo alcanzaba. El operador ajustaba el monto o
renovaba, el backend escribía el `EventoContrato`, y el Historial seguía mostrando lo de antes
hasta recargar la página a mano.

**Qué se hizo.** La key pasó a `['contrato', id, 'eventos']`. Parchear los 8 call sites habría
arreglado la instancia y dejado la trampa armada para el próximo hook; colgándolo del prefijo,
cualquier invalidación de `['contrato']` lo alcanza — que es como React Query matchea.

**Verificado en navegador** en las dos direcciones: con el arreglo, después del
`POST /contratos/:id/ajustar` sale solo un `GET /contratos/:id/eventos`; con la key vieja, ese
GET no aparece.

---

## T-42 · Doble click en "Enviar" dejaba dos renglones en el historial — ✅ RESUELTO

**Experto:** FE-P · **Prioridad:** 🟢
**Origen:** revisión adversarial del 19/08.

El botón de `mensaje-inquilino-dialog.tsx` no se bloqueaba mientras corría el
`POST /contratos/:id/comunicaciones`, así que dos clicks anotaban **dos comunicaciones** por
un solo mensaje. Ahora hay estado `enviando` (con guard de reentrada además del `disabled`,
que tarda un tick en aplicarse), los dos botones se deshabilitan y el texto pasa a "Anotando…".

**De arrastre, el otro hallazgo del mismo archivo se cerró solo:** el toast decía "quedó
anotado en el historial" pero el timeline no se refrescaba. El diálogo ya invalidaba
`['contrato']`; lo que faltaba era que el timeline colgara de ese prefijo, que es lo que
hizo **T-41**. Ahora el toast dice la verdad.

---

## T-43 · T-40 había quedado a medias: el mismo 403, dos clicks más allá — ✅ RESUELTO

**Experto:** FE-P · **Prioridad:** 🟢
**Origen:** revisión adversarial de mis propios commits (19/08). **Tres dimensiones
independientes encontraron lo mismo**, lo que es la señal de que era real.

**Qué faltaba.** T-40 gateó los botones de la **fila**, pero "Ver comprobante" queda visible
para todos a propósito — y **adentro de ese modal estaban Confirmar y Rechazar sin
condicionar**. Exactamente el defecto que T-40 decía cerrar, sobreviviendo en el mismo archivo.
El escéptico verificó que el camino es alcanzable de punta a punta: el `PinPromptDialog` es un
no-op, así que dispara el `POST /pagos/:id/validar` directo y el server contesta 403.

**Y un segundo caso que nadie había mirado:** el botón **"Anular"** de "Conciliados recientes"
usa `pago.revertir`, que es **sólo ADMIN** — no ADMIN+CAJA. O sea que `puedeDecidir` no
alcanzaba: hacía falta un flag propio, si no **CAJA veía un "Anular" que le devolvía 403**.

**Un error mío que el escéptico pescó de paso.** El comentario que dejé en T-40 decía que
`pago.conciliar` *"dejó de incluir a OPERADOR en esta misma tanda"*. Es falso: ya era
`['ADMIN','CAJA']` antes de estos commits — lo que T-37 tocó fue `pago.manual.cargar`. El
código estaba bien; el comentario mentía sobre la historia, que es la clase de cosa que
después manda a alguien a buscar un cambio que no existió. Corregido.

**Verificado en navegador, los tres roles:**

| rol | Confirmar/Rechazar (fila) | dentro del modal | Anular | Ver comprobante |
|---|---|---|---|---|
| ADMIN | sí | sí | sí | sí |
| CAJA | sí | sí | **no** | sí |
| OPERADOR | no (aviso) | no (aviso) | no | sí |

**No se tocó `PagosPorValidarDemo`**: esa variante corre sólo con `apiEnabled=false`, no habla
con ningún server y su rol sale de localStorage. Gatearla sólo rompería la demo.

---

## T-44 · Dos cabos sueltos de mis propios arreglos — ✅ RESUELTO

**Experto:** BE + FE-I · **Prioridad:** 🟠
**Origen:** los hallazgos que quedaron fuera del cap en la revisión del 19/08.

### 1 · El 409 de T-38 mandaba a una pantalla que no existe

El mensaje decía *"si lo que cambió es el valor de las expensas, se edita desde los datos del
contrato"*. **Es falso:** ningún endpoint escribe `montoExpensas` fuera del alta — los únicos
PATCH de contrato son mora, monto, modo-cobranza, contacto y garantes (es el mismo hueco que
había detectado T-11). Mandar al operador a buscar una pantalla inexistente es peor que
decirle que no se puede.

Ahora el 409 dice la verdad y trae `codigo: 'CONTRATO_SIN_CANON'`. **El hueco de fondo sigue
abierto** y es de T-11: `montoExpensas` y `depositoGarantia` no tienen ningún camino de
edición.

### 2 · El arreglo del "Pagado" no llegaba a la demo

`cubiertoSinValidar` llevaba `apiEnabled &&`, así que el **build demo** —el de GitHub Pages, el
que ve un prospecto y el que se usa para mostrar el producto— seguía con el badge verde
"Pagado" y el botón de recibo sobre un pago recién informado. Justo la confusión que el arreglo
vino a sacar, viva en la vidriera.

Ahora vale en los dos modos: en demo la señal es `pendienteValidacion` (store local); en prod,
`det.hayEnRevision`.

**Verificado en navegador, en modo demo y en las dos direcciones.** Sin el arreglo: badge
"Pagado" + "Descargar comprobante" pegados al cartel "Pendiente de validación", y encima
mostrando `$572.000` (el total del mock) cuando lo informado eran `$662.948`. Con el arreglo:
"En revisión", sin recibo, con "Ver comprobante enviado" y el monto correcto.

---

## T-45 · El wizard prometía "el email se lo agregás después" y no se podía — ✅ RESUELTO

**Experto:** BE + FE-P · **Prioridad:** 🔴
**Origen:** evaluación de Camila (19/08). El documento marcaba T-09 como ✅ y **el código no lo
sostenía**.

**El problema, y por qué era caro.** El aviso del alta dice, textual: *"Sin email podés cargar el
contrato igual, pero el inquilino no va a poder entrar a la app… **Se lo podés agregar
después**"*. No se podía: `PATCH /contratos/:id/inquilino-contacto` aceptaba **sólo `telefono`**
y ningún otro endpoint escribía `Inquilino.email` fuera del alta.

Consecuencia real: la operadora carga el contrato sin email confiando en el aviso, y el
inquilino queda **sin poder entrar a la app para siempre** —el acceso es por OTP al mail— salvo
**rehacer el contrato**. O sea, exactamente la rescisión falsa de la que Camila se queja.

**Qué se hizo.** Se hizo verdadera la promesa en vez de bajarla:
- El endpoint acepta `email` (validado, en minúsculas). El teléfono conserva su comportamiento
  previo —un body vacío lo borra—, pero **el email sólo se toca si viene**: es la llave de
  acceso, borrarlo por omisión dejaría al inquilino afuera sin que nadie lo pidiera.
- 409 `EMAIL_DUPLICADO` si ese mail ya es de otro inquilino de la misma cartera
  (`@@unique([inmobiliariaId, email])`), con mensaje que sugiere lo más probable: que sea la
  misma persona.
- Lápiz de edición en la fila "Email" de la ficha, con el copy que corresponde a una llave de
  acceso y no a un dato de contacto más.

**Verificado en navegador:** el lápiz aparece, el 409 de duplicado se muestra con su mensaje
real y deja el diálogo abierto para corregir, y el camino feliz guarda y refresca la ficha.

---

## T-57 · Un pago parcial no frena la mora: sigue corriendo sobre el total original

**Experto:** BE + **decisión del dueño** · **Prioridad:** 🔴 · **Toca plata — le cobra de más al inquilino**
**Origen:** revisión adversarial del motor de cobranza (20/08). **NO se arregló: ver por qué.**

**El caso, con números.** Cuota de $600.000 que vence el 10/08, mora 0,15% diario. El inquilino
paga **$599.000 el mismo 10/08** —en fecha, sin mora— y queda debiendo $1.000 de capital. El
09/09, a 30 días, la mora se calcula sobre los **$600.000 completos**:

    600.000 × 0,15% × 30 = $27.000 de punitorios por deber $1.000.

Sobre el saldo real serían **$450**. Y ese total inflado es exactamente lo que ve el inquilino en
la PWA, lo que topea `POST /pagos/informar` y lo que muestra el panel.

Caso menos extremo y mucho más frecuente: paga $500.000 de $600.000 y a 30 días la mora es
$27.000 en vez de $4.500 — **$22.500 de más**.

**Verificado:** en los ~16 call sites la base es siempre `Number(l.montoTotal)` bruto; lo
conciliado se resta recién en `saldos.ts`, **después** del cálculo. El congelamiento de mora que
existe (`plata.ts:1665-1675`) sólo cubre pagos **INFORMADO** pendientes: un parcial **CONCILIADO**
deja la liquidación en PARCIAL y la mora sigue corriendo sobre el total original.

### Por qué NO lo arreglé, y qué hace falta para hacerlo

1. **La solución ingenua rompe el caso inverso.** `base = montoTotal − conciliados` haría que
   pagar TARDE reduzca retroactivamente la mora ya devengada: al inquilino le convendría pagar
   tarde y de a poco.
2. **O se hace en los 16 call sites, o no se hace.** Arreglarlo sólo donde los pagos están a
   mano daría **moras distintas según qué endpoint las calcule** — peor que el bug actual.
3. **Cambia lo que se le cobra a inquilinos reales**, hoy, en producción. Bajar un cargo mal
   calculado es correcto, pero la forma exacta es una decisión de negocio.
4. **No se puede verificar desde acá:** los tests que cubren este camino tocan la base.

### Las dos formas, para que elijas

**(a) Descontar sólo lo pagado ANTES del vencimiento.** `capital = base − pagadoAlVencimiento`.
Barata y sin regresión: lo que entró en fecha reduce el capital sobre el que corre toda la mora,
y lo que entró tarde no borra punitorios ya devengados. Arregla el caso titular. **No** hace
tramos: si paga la mitad al día 15 y el resto al 40, cobra los 40 días sobre el capital inicial
menos lo de antes del vencimiento.

**(b) Mora por tramos.** Lo riguroso: 5 días sobre $600.000 + 25 días sobre $100.000. Es lo que
haría un contador, y es un cambio de fondo en el corazón del cobro.

**Criterio de aceptación.** Un parcial pagado en fecha no genera mora sobre la parte ya pagada, y
la mora sale igual desde los 16 lugares que la calculan.

---

## T-72 · `GET /uploads` autorizaba por tenant, no por dueño del archivo — 🟡 MECANISMO LISTO, falta prenderlo

**Experto:** BE + SEC · **Prioridad:** 🔴 · **Toca schema**
**Origen:** riesgo 🟠 Nivel 2 **#9**. **Autorizado explícitamente por el dueño** el 21/08.
Diseñado por tres propuestas independientes y sometido a cuatro lentes adversariales; se
implementó la que resistió tres de las cuatro, con las seis correcciones que le encontraron.

**El caso.** El GET autorizaba con `tenantDe(payload) === tenant` y nada más. Cualquier
inquilino, co-inquilino o profesional con link mágico que conociera el nombre leía **cualquier**
archivo de esa inmobiliaria: el comprobante del 3°B, el DNI de otro contrato, el recibo de sueldo
de un garante ajeno, el extracto bancario de la administradora. Lo único que lo tapaba es que el
nombre es un `randomUUID()` — **oscuridad, no autorización**: la URL viaja en el `<img src>`,
queda en el historial del browser y se reenvía como cualquier link.

La causa raíz: **no existía ningún registro de quién subió qué**. De los 85 modelos del schema,
ninguno lo guardaba.

**La regla, con dos vías (alcanza con una):**
1. **Lo subiste vos** — hay fila en `ArchivoSubido`. Cubre la ventana entre `POST /uploads` y el
   request que persiste la URL, que es real: la PWA previsualiza el comprobante **antes** de
   informar el pago.
2. **Está colgado de una fila de tu ámbito** — el archivo lo referencia una fila de tu contrato,
   tuya como persona, o de tu visita.

**LA VÍA 2 ES LA DECISIÓN CENTRAL, y es la que evita el desastre.** La tabla nace vacía: si la
autorización dependiera sólo de ella, el día del deploy **todos los archivos históricos quedarían
sin dueño y se bloquearían** — un inquilino real perdiendo documentos que hoy ve. La alternativa
"backfillear el dueño desde las 16 columnas de URL" **no se hizo a propósito**: esas columnas
guardan un *vínculo*, no un dueño, y adivinar mal rompe lo que funciona. La vía 2 consulta esas
mismas filas **en vivo**: la información que un backfill congelaría, el guard la lee fresca. Un
comprobante de marzo se lee porque su `Pago` es del contrato de quien pide — **la misma fila que
el front ya usa para armar el `<img src>`**. Si tu pantalla te lo muestra, el guard te lo sirve.

**Por qué no se auto-anula.** La vía 2 sería un agujero si alguien pudiera enganchar una URL
ajena a una fila propia (`POST /mis-documentos` con la URL de la víctima) y auto-autorizarse. Por
eso **adjuntar exige exactamente lo mismo que leer**: los 8 call sites no-panel que aceptan una
URL del cliente pasan por `puedeAdjuntar`, que llama a la misma función. Los 7 de panel quedan
por tenant, igual que la lectura del panel.

**SALE APAGADO. `UPLOADS_AMBITO` tiene tres estados y arranca en `log`.** Es un cambio de
autorización sobre una inmobiliaria en uso, y el push a `main` **es** el deploy: no hay ventana
entre mergear y aplicar. En `log` se evalúa y se registra lo que se habría denegado, pero se
sirve todo igual que hoy. **Un solo interruptor gobierna las dos mitades** —lectura y
adjuntar— porque el estado intermedio (lectura bloqueando, escritura libre) es justamente el que
permitiría prepararse un enganche.

> ### ⏸️ LO QUE FALTA, Y ES DEL DUEÑO
> Poner `UPLOADS_AMBITO=on` en Railway. **Antes de prenderlo**, mirar los logs del back buscando
> `uploads-ambito`: cada línea es una lectura legítima que se habría bloqueado. Si no aparece
> ninguna en unos días de uso real, prenderlo es seguro. Si aparecen, la columna que falta se
> agrega a `estaEnSuAmbito` y se vuelve a esperar. **Prenderlo sin mirar el log es exactamente
> el riesgo que este diseño viene a evitar.**

**Correcciones propias durante la implementación**, las dos encontradas verificando y no
asumiendo:
- El registro del dueño era `void` (no bloqueante) y eso **abría una carrera**: el cliente sube y
  acto seguido informa el pago con esa URL, y la fila todavía no existe → 403 espurio en el flujo
  normal. Ahora se espera la escritura, pero con `.catch()`: subir un comprobante no puede
  depender de que Postgres esté vivo.
- El `contratoId` del co-inquilino se lee **de la base**, no del JWT: el guard propio de
  `/uploads` revalida su estado pero no compara ese campo (`requireContratoAcceso` sí), así que
  tomarlo del token dejaría el ámbito para leer más laxo que el de adjuntar.

**Tests.** 20 puros en `acceso-archivos.test.ts`, incluido el ataque completo —enganchar una URL
ajena a una fila propia— y los cuatro estados del interruptor.

---

## T-71 · El código del certificado era derivable de los datos de la persona — ✅ RESUELTO

**Experto:** BE + SEC · **Prioridad:** 🟠 · **Toca schema (migración con borrado)**
**Origen:** riesgo 🟠 Nivel 2 **#11**. **Autorizado explícitamente por el dueño** el 21/08,
sabiendo que la migración borra la tabla.

**El caso.** `hash` se calculaba con FNV-1a + djb2 sobre `DNI | contratoId | nombreInmobiliaria`,
sin sal y sin secreto, truncado a 12 caracteres. Dos funciones de hash públicas de 32 bits:
cualquiera con esos tres datos —y el nombre de la inmobiliaria es público— reproducía el código
de otra persona en diez líneas. Y al ser determinístico, `revocadoAt` no servía de nada:
regenerar devolvía el MISMO código.

**Por qué ahora y no después.** Hoy el daño es latente: **no existe la página pública de
verificación**, así que ningún código se puede canjear en ningún lado. Pero el código es lo único
que va a proteger esa página el día que exista, y la tabla **ya guarda PII de personas reales**
(nombre, DNI, email, teléfono, dirección, monto). Cambiarlo después obligaría a invalidar
certificados ya en circulación.

**Las dos exigencias que tiran para lados opuestos**, y por eso no era un cambio de una línea:
el código tiene que ser **aleatorio** (para que no se derive) y **estable** (porque se imprime y
se comparte: si cambiara en cada visita, el papel que el inquilino entregó moriría al día
siguiente).

**Qué se hizo.**
1. `codigoCertificado()` — `randomBytes`, alfabeto de 28 símbolos sin los que se confunden al
   tipear (I/1, O/0, S/5, Z/2), ~58 bits. **No recibe ningún argumento**: ésa es la propiedad, no
   hashea bien los datos del titular, no los toca.
2. La clave del upsert pasó de `hash` a **`(inquilinoId, contratoId)`**. Con un código aleatorio,
   buscar por hash no encontraría nunca la fila previa: cada visita crearía una fila nueva y
   dejaría la anterior **huérfana con PII adentro** y sin nada que la borre.
3. El handler **lee el código existente antes de inventar uno**. Sin eso aparecía un bug sutil:
   la fila conservaba su código viejo pero `urlVerificacion` apuntaba al recién generado.

**La migración borra la tabla, y es la opción con menos riesgo.** El índice único no se puede
crear si hay duplicados —y puede haberlos: si una inmobiliaria se renombró, la semilla cambiaba y
nacía una segunda fila para el mismo par— y un `CREATE UNIQUE INDEX` que falla deja el contenedor
**sin arrancar**: producción caída. Se verificó que es seguro:
- **Ningún endpoint LEE la tabla.** Las únicas dos referencias en toda la API son el `upsert` de
  `/certificado` y un `deleteMany` en cascada. No hay página de verificación, así que no hay
  código impreso que se pueda canjear en ninguna parte.
- La fila **se regenera sola** en la próxima visita: son snapshots derivados, no fuente de verdad.
- Sus tres FKs son **salientes**; ninguna tabla la referencia, así que el DELETE no cascadea.

Y hay un motivo positivo, no sólo la conveniencia del índice: **los códigos viejos son los
débiles**. Conservarlos dejaría los certificados ya emitidos con un identificador derivable para
siempre.

**Tests.** 6 **puros** en `certificado-codigo-opaco.test.ts` —uno afirma que la función **no
tiene parámetros**, que es el arreglo en una línea— y 5 de integración en
`certificado-codigo-estable.test.ts`: el código no cambia entre visitas, no se duplica la fila,
la URL apunta al código guardado, y **cambiarle el DNI al inquilino no le cambia el código**.

---

## T-70 · La tercera puerta del titular quedó abierta en `/uploads` — ✅ RESUELTO

**Experto:** BE + SEC · **Prioridad:** 🟠
**Origen:** salió mientras se relevaba el riesgo #9 (uploads). **No es el #9** — ver abajo.

**El caso.** `/uploads` tiene su propio guard, `requireAuthOProfesional`, porque además del JWT
normal acepta el token del profesional por link mágico. Cuando se le agregó la revalidación
contra la base se cubrió al **co-inquilino** y al **profesional**, y **se salteó al titular**.

Un inquilino al que le dieron de baja el alquiler —o cuyo token apunta a un contrato que ya no es
suyo— conservaba el token hasta **15 días** y seguía leyendo y escribiendo el Volume del tenant
por este endpoint.

**Lo notable es que el archivo ya llevaba la cuenta, y la llevaba mal.** El docblock de
`inquilinoRevocado` decía: *"Compartido por `requireInquilino` y por la rama `inquilino` de
`requireContratoAcceso`, que son las **DOS puertas del titular**: cuando la revalidación vivía en
una sola, la otra quedaba abierta."* Eran tres.

**Qué se hizo.** `inquilinoRevocado` pasó a estar **exportada** —para que el que agregue una
cuarta puerta la reuse en vez de reimplementar la regla, que es exactamente cómo se llegó a tener
tres versiones— y se la llama desde la rama `inquilino` de `requireAuthOProfesional`. El docblock
ahora enumera las tres y dice cuál faltaba.

**Tests.** 4 de integración en `uploads-revoca-al-titular.test.ts`: con el alquiler vigente pasa
la autorización (404 por archivo inexistente, que es lo que distingue "pasó" de "no pasó"), con
el contrato desvinculado da 401, y restaurado vuelve a pasar. Restaura el estado en el `afterAll`
porque la base es compartida.

---

> ### ⏸️ Lo que NO es esto: el riesgo #9 sigue abierto y es **tuyo**
>
> `GET /uploads/:tenant/:name` **autoriza por tenant, no por dueño del archivo**
> (`uploads.ts:364`, `tenantDe(payload) === tenant` y nada más). Cualquier inquilino,
> co-inquilino o profesional con link mágico puede leer **cualquier** archivo del tenant si
> conoce el nombre: comprobantes ajenos, DNIs, recibos de sueldo, escrituras de garantes,
> extractos bancarios. Hoy lo tapa **sólo el `randomUUID()` del nombre**, no la autorización.
>
> **Por qué no lo hago sin que lo decidas:** no existe ningún registro de quién subió cada
> archivo —de los 85 modelos del schema no hay ninguno— así que hay que **agregar una tabla y
> migrar**, y encima **backfillear lo histórico** desde las 16 columnas que hoy referencian
> URLs. Sin backfill, el día del deploy todos los archivos ya existentes quedan sin dueño y la
> regla nueva los bloquea: se rompe el acceso a documentos que hoy funciona.
>
> Y hay una trampa que conviene saber antes de empezar: la regla "o lo subiste vos, **o** hay una
> fila que lo referencia y vos podés ver esa fila" **se auto-anula**. Hay 8 endpoints donde un
> actor de baja confianza puede ENGANCHAR una URL ajena a una fila propia (p. ej.
> `POST /mis-documentos`), así que el atacante que ya tiene la URL se auto-autoriza. El
> endurecimiento de esos 8 call sites no es "de yapa": sin eso la regla no cierra.

---

## T-69 · El token de garante no valida nada, y su nombre decía lo contrario — ✅ RESUELTO

**Experto:** FE-I + SEC · **Prioridad:** 🟢 (prevención)
**Origen:** riesgo 🟠 Nivel 2 **#12** de `work-agent/07-ECOSISTEMA.md`.

**El caso.** El token del link de garante es `base64url(JSON)` con un prefijo constante escrito
en texto plano en el mismo archivo, que el propio código declaraba *"no-secret: es solo ofuscación
visual"*. Cualquiera fabrica uno para cualquier `contratoId` en dos líneas.

**El riesgo no es criptográfico, es de lectura.** Hoy es inofensivo porque no hay backend de
garantes: la página pública sólo lee mocks. Pero se llamaba `leerGaranteToken` y **estaba en el
camino caliente de producción** — o sea, era exactamente la línea que un dev futuro copia para
"resolver el contrato acá", creyendo que el token ya se validó. El día que exista ese endpoint,
es un IDOR cross-tenant inmediato. El docblock de `portal-propietario.ts:31-34` **ya lo nombra
como el precedente que no hay que repetir**.

**Un detalle que la revisión no vio.** En producción la página igual **parseaba** el token para
decidir entre 404 y el cartel "Disponible pronto". O sea que un token bien formado y uno mal
formado se distinguían desde afuera — poca cosa, pero es información sobre un token que se puede
fabricar, y no compraba nada.

**Qué se hizo.** Tres cosas, ninguna cambia lo que ve un usuario real:
1. `generarGaranteToken`/`leerGaranteToken` → **`generarTokenDemoGarante`/`leerTokenDemoGarante`**.
   Es el pedazo que sostiene todo lo demás: un nombre con "Demo" adentro no se importa por
   accidente en un handler.
2. El encabezado del módulo dice qué es, qué NO hace, y **a qué patrón migrar** el día que haya
   backend: token opaco de `randomBytes(24).toString('base64url')` persistido + resolución por
   `findUnique({ where: { token } })`, que el repo ya tiene escrito en `operacion.ts:18` y
   `visitas-publicas.ts:35`.
3. El corte de producción se movió **arriba** del parseo: ahora en producción el token no se abre
   nunca y todos ven exactamente lo mismo.

**Tests.** 4 puros en `garante-token.test.ts`. Uno **afirma explícitamente que el token es
falsificable** —fabrica uno a mano para un contrato ajeno y comprueba que lo acepta—: no es un
hallazgo escondido, es la propiedad documentada que justifica el nombre y el corte de producción.

---

## T-68 · El atajo de la demo emitía sesiones de un inquilino real con un solo candado — ✅ RESUELTO

**Experto:** BE + SEC · **Prioridad:** 🟠
**Origen:** riesgo 🟠 Nivel 2 **#13** de `work-agent/07-ECOSISTEMA.md`.

**El caso.** `POST /auth/demo` existe para entrar a la demo con un click, y su único gate era
`DEMO_MODE` — una env var. Si alguna vez se filtra a la env de producción, cualquiera que le
pegue se lleva un **JWT de un inquilino de verdad**, sin OTP, sin contraseña, sin ninguna prueba
de identidad. La ruta es pública: `authRoutes` va sin prefijo y ninguno de los hooks globales
(helmet, rate-limit, cors, jwt, multipart, los dos de Sonar) autentica.

**No es un hallazgo nuevo: es un olvido con fecha.** El commit `e06956e2` (20/06, *"cierre
completo de la auditoría pre-lanzamiento"*) dice **textual en su mensaje**: *«M-1: demo backdoor
excluye NODE_ENV=production (auth.ts)»*. Aplicó el guard a los dos `/otp/verify` (`auth.ts:337` y
`:446`) y **se salteó éste, 250 líneas más abajo en el mismo archivo**. Esa auditoría pasó dos
veces por encima del endpoint: el otro salteo es el `findFirst` sin scope de tenant de la línea
siguiente, que ese mismo commit reemplazó por `findMany` en el OTP con el comentario *"nunca de
un findFirst arbitrario (que podía loguear contra el tenant equivocado)"*.

**Por qué no se notó en dos meses.** `auth.test.ts:199` sólo ejercita el camino feliz (200), y
**ningún test del repo pasaba `NODE_ENV: 'production'`**: el estado apagado no lo miraba nadie.

**Qué se hizo.** El segundo candado, por `app.env` y no por `process.env` —que es lo que usan los
dos vecinos— justamente para que se pueda ejercitar desde `buildApp({ NODE_ENV: 'production' })`.
El `findFirst` sin tenant queda documentado y no "arreglado": el request no trae ningún tenant
del que colgarse, y lo que lo vuelve inofensivo es el guard nuevo.

**Y se dio vuelta el smoke de producción**, que es la mitad menos obvia. `scripts/smoke-prod.mjs`
verificaba que `/auth/demo` **devolviera un token** — o sea, daba por bueno el agujero: si ese
check fallaba, el arreglo "obvio" era prender `DEMO_MODE` en producción. Ahora afirma lo
contrario (404). El chequeo de `/mis-anuncios` que colgaba de ese token quedó **anotado como sin
cubrir** en vez de borrado: hace falta un token de inquilino real y meterlo ahí sería el mismo
problema que ya tiene el login de Roberto hardcodeado (T-26).

**Tests.** 4 **puros** en `auth-demo-cerrado-en-prod.test.ts` — los cuatro casos devuelven 404
antes del `findFirst`, así que no tocan la base. El test declara su propio `DATABASE_URL` y
`JWT_SECRET` en vez de heredarlos del runner, para que valga igual corrido a mano que en CI.
Verificado en rojo: sin el guard fallan exactamente las 2 que lo ejercitan, y siguen pasando las
2 del candado que ya existía.

---

## T-67 · El login del inquilino se caía a la demo cuando el API no contestaba — ✅ RESUELTO

**Experto:** FE-I + SEC · **Prioridad:** 🔴
**Origen:** riesgo 🟠 Nivel 2 **#15** de `work-agent/07-ECOSISTEMA.md`. De los 7 riesgos de esa
tabla que se verificaron, **#10 y #16 ya estaban arreglados** (commits `88f4e02e` y `2f77f0f3`) y
éste era el único **explotable hoy**.

**El caso.** `solicitarCodigoUnificado` y `verificarCodigoUnificado` arrancan con
`if (!apiEnabled) return <flujo local>`. El build demo sale por ahí — así que **todo lo que viene
después es código de PRODUCCIÓN por construcción**, incluido el `catch` que volvía a caer al
flujo local cuando `fetch` rechazaba.

**El disparador no es "estar offline".** Sin red la página ni carga: el service worker es
network-first sobre un cache que nunca se llena (`public/sw.js` no hace un solo `cache.put`). Es
que la página cargue bien y la llamada falle: corte de 3G a mitad del flujo, DNS, CORS, un
adblocker que bloquea el dominio de Railway, un portal cautivo que devuelve HTML donde va JSON.

**Qué pasaba.** Se generaba un código local, se lo mostraba **en pantalla** en un banner "Demo"
—sin gate de `apiEnabled`, aunque el archivo ya lo importa y lo usa en otros dos lados— y se le
armaba al inquilino un perfil inventado.

**Y la mitad fea, que la primera revisión no vio.** `desdeLocal` escribe la sesión pero **no toca
`llave:auth:token`**, mientras que el camino del API sí llama a `cerrarSesion()` cuando cambia el
email. En un dispositivo compartido: la persona B entra con SU email por el fallback, el JWT de A
sobrevive en localStorage, y como **todos los hooks leen el token y no la sesión**, B ve el
contrato, el saldo y los pagos REALES de A con su propio nombre en el header. Y hay un botón que
lleva justo ahí: `mis-alquileres` manda a `/login?force=1` —el único parámetro que saltea el
redirect del login— cuando se le vence el persona-token.

**Ya se había arreglado a medias, y hace rato.** El commit `0b042656` (01/07) sacó el
`codigo: '000000'` del camino feliz; su mensaje dice textual que el banner *"aparecía EN
PRODUCCIÓN"*. Cerró la puerta y dejó la ventana — y el comentario que quedó lo documenta como
resuelto.

**Qué se hizo.** Los dos `catch` devuelven un error honesto de conexión en vez de caer al flujo
local, y el banner quedó con gate de `!apiEnabled` como defensa en profundidad. `desdeLocal` y
`solicitarCodigo` **no se borran**: siguen vivas en las ramas legítimas del build demo.

**Tests.** 5 puros en `auth-otp-api.test.ts`, con `fetch` stubeado y un localStorage falso —el
mismo invariante que el portal del propietario ya protege en `demo-data.test.ts`: *la demo no se
prende sola cuando falta el servidor*.

**Nota de método, porque casi se me pasa.** La primera versión del test verificaba el paso de
`verificar` **en aislamiento**, y pasaba **igual con el bug puesto**: sin un código guardado el
flujo local falla de todos modos, así que no probaba nada. Hay que hacer el flujo de dos pasos
completo —pedir y después verificar—, que es el camino real. Con el bug completo restaurado,
**3 de los 5 fallan**; con el arreglo, 5/5.

---

## T-66 · Finalizar resolvía el depósito y dejaba sus cargos huérfanos — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🔴 · **Toca plata**
**Origen:** riesgo 🔴 Nivel 1 **#4** de `work-agent/07-ECOSISTEMA.md`. Con este quedan cerrados
los cuatro de esa tabla que no dependían de una decisión del dueño.

**Son dos defectos ligados, y los dos son lo mismo: `POST /contratos/:id/finalizar` resuelve el
depósito igual que `POST /contratos/:id/deposito/resolver`, pero no replica sus guards.** Tercera
vez en esta serie que aparece el patrón (T-64 y T-65 fueron el mismo).

**1 · No topeaba el monto a devolver.** `resolver` rechaza con 400 si se quiere devolver más que
el **disponible** —el bruto menos las reparaciones ya imputadas contra el depósito
(`plata.ts:1141-1156`)—. `finalizar` escribía `montoDepositoDevuelto` **crudo**: se podía
devolver el 100% del depósito teniendo arreglos imputados, y esos arreglos los terminaba pagando
la inmobiliaria. Sin vuelta atrás, porque al resolverse el depósito el contrato sale de
`/depositos/en-custodia`. Peor: `estadoDepositoContrato` sólo se consultaba en la rama
NETEAR/EJECUTAR, así que **DEVOLVER —la que devuelve más plata— era la única que nunca miraba el
disponible.**

**2 · No cerraba los cargos `contraDeposito`.** Quedaban `saldadoAt: null` **para siempre** e
insaldables por los cuatro caminos: invisibles en `/depositos/en-custodia` (filtra RETENIDO),
rechazados por `/cargos/:id/saldar`, excluidos de saldar-deuda, y fuera del alcance de
`deposito/resolver` (409 si el depósito ya no está RETENIDO). Deuda fantasma sin forma de bajarla.

**Por qué había que arreglar los dos juntos.** Cerrar sin topear habría sido **peor que no
cerrar**: taparía la pérdida en vez de exponerla — el libro diría "saldado" sobre plata que se
devolvió y que nadie retuvo.

**Qué se hizo.** El tope replicado antes de la transacción, con el mismo mensaje que `resolver`
—y **rechazando**, no topeando en silencio: el diálogo de baja ya le mostró al operador una
cuenta hecha, y devolver un número distinto del que aprobó es justo el pecado que este archivo
viene corrigiendo—. Y el cierre extraído a `cerrarCargosContraDeposito` en `lib/deposito.ts`,
que ya es la "FUENTE ÚNICA de cuánto depósito queda" y cuyo docblock describía esta misma clase
de bug. Los **dos** caminos lo usan ahora.

Con `MANTENER` no se cierra nada: el depósito sigue RETENIDO y esos cargos siguen siendo
cobrables por el camino normal.

**Tests.** 6 **puros** en `cerrar-cargos-contra-deposito.test.ts` —el filtro del `updateMany` es
la parte delicada: cerrar de más saldaría deuda que el inquilino todavía tiene que pagar en
efectivo— y 5 de integración en `finalizar-cierra-cargos-deposito.test.ts`, que crea su **propio
contrato** en vez de usar uno del seed, porque finalizar es destructivo y esa base la comparten
los 55 archivos de la suite.

---

## T-65 · El arreglo que cerró el profesional no se le cobraba a nadie — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🔴 · **Toca plata**
**Origen:** riesgo 🔴 Nivel 1 **#2** de `work-agent/07-ECOSISTEMA.md`. Son dos agujeros distintos
en el mismo endpoint, y los dos son la misma clase de error: **un guard que quedó inline en
`/resolver` y nunca se mudó al helper compartido**, así que el camino del link mágico lo esquiva.

---

### A · Imputar al DEPÓSITO sin depósito vivo

`POST /reclamos/:id/resolver` chequea que haya depósito `RETENIDO` antes de crear un
`CargoContrato` con `contraDeposito` (`operacion.ts:578-590`). El helper compartido no lo
replicaba, así que `POST /visitas-publicas/listo` podía crear ese cargo sobre un contrato **sin
depósito** —o con el depósito ya devuelto, neteado o ejecutado—. Ese cargo **nace incobrable por
los cuatro caminos**: no aparece en `/depositos/en-custodia` (filtra RETENIDO), está excluido de
`/mis-cargos`, `/cargos/:id/saldar` lo rechaza y saldar-deuda lo ignora.

**Es una regresión de patrón, no un descuido, y hay fecha.** El commit `242db1b9` (26/07) se
llama literal *"guard anti-doble-cobro en el helper compartido, **no sólo en /resolver**"* y fijó
la regla del choke point. **Ese mismo día**, `afb9efe9` agregó el guard de depósito **inline en
`/resolver` únicamente**. El de `yaRendido` se mudó; el de depósito quedó atrás.

**Qué se hizo.** `ReclamoDepositoNoDisponible extends ReclamoNoReimputable` y el guard dentro de
`imputarCostoReclamo`. Como hereda de la base, **los dos `catch` existentes ya la mapean a 409
sin tocar ninguna ruta**. La ubicación importa: va **después** de los dos early-returns (el de
`saldadoAt` y el de `!pagador || costo <= 0`) — si fuera antes, resolver el depósito (que salda
los cargos `contraDeposito`) pasaría de 200 a 409.

### B · El costo cerrado sin pagador, irrecuperable

`/visitas-publicas/listo` escribe `costoTrabajo` y pone el reclamo en RESUELTO, pero el `pagador`
sólo lo escriben `/clasificar` y `/resolver`, **y los dos rebotaban con 409 una vez cerrado**.
Con `pagador: null` el helper hace early-return: **no se le cobra a nadie**, y no había forma de
arreglarlo.

**Y es el default del camino más rápido.** El diálogo de asignar profesional del panel
(`asignar-profesional-dialog.tsx`) pega directo a `/reclamos/:id/asignar` y abre el WhatsApp con
el link mágico **sin pasar nunca por la clasificación** — la card de asignar ni siquiera está
deshabilitada cuando falta el pagador. `pagador: null` no es un caso raro.

**Qué se hizo.** El rescate va en `/clasificar`, acotado a `RESUELTO` + costo > 0 + `pagador ==
null`. Ahí el motivo del guard de estado no aplica: no hay ningún `CargoContrato` previo que
quede colgado, porque con `pagador: null` el helper nunca creó uno. Los dos casos peligrosos —ya
rendido al dueño, ya cobrado al inquilino— **los corta el propio helper**. El candado del
`updateMany` pasa a ser `pagador: null` en vez del estado, así que dos operadores simultáneos no
se pisan.

**Por qué NO se relajó `/resolver`, que era lo primero que se pensó.** Ese endpoint incrementa
`cantTrabajos` —y `/listo` ya lo incrementó, o sea **+2 trabajos por uno** en la reputación del
profesional—, pisa `resueltoAt` (ancla del SLA **y** filtro de período de la rendición) y dispara
un **segundo mail** al inquilino. `/clasificar` no toca nada de eso.

**Tests.** 9 **puros** en `imputar-reclamo-deposito.test.ts` (el helper recibe el `tx`, así que se
testea con un doble y sin base) — **verificados en rojo**: sin el guard, 4 de los 9 fallan. Más 6
de integración en `clasificar-rescata-cierre-sin-pagador.test.ts` para el rescate, que corre el
job `integracion` de la CI.

**Lo que queda, y es de UX — no lo tomo por mi cuenta.** La **prevención** sería que el panel no
deje mandar un profesional sin haber clasificado quién paga (deshabilitar la card de asignar
mientras `pagador` sea null, o pedirlo en el mismo diálogo). Eso cambia cómo se ve el producto al
operador, así que lo define el dueño. Hoy queda cubierta la recuperación, no la prevención.

---

## T-64 · Cambiar el modo de cobranza con un comprobante esperando validación — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🔴 · **Toca plata**
**Origen:** riesgo 🔴 Nivel 1 **#1** de `work-agent/07-ECOSISTEMA.md`. Se verificaron los seis
riesgos de esa tabla contra el código de hoy: **#6 y #7 ya estaban arreglados** (commits
`704f37f5` y `35277578`, del 19/08, posteriores a la tabla) y **#1, #2, #4 y #5 seguían
abiertos**. Este es el #1.

**El caso.** El guard de `PATCH /contratos/:id/modo-cobranza` se apoya en
`alquilerCobradoSinRendir`, que cuenta **sólo pagos `CONCILIADO`**
(`lib/rendicion-pendiente.ts:238`). Pero un comprobante queda **`INFORMADO`** en la bandeja
hasta que una persona lo decide: **días**, no la ventana de milisegundos que cerró T-36. En ese
hueco el modo se cambia con el guard en cero, y el pago aterriza del lado equivocado cuando
alguien lo valida — porque `POST /pagos/:id/validar` no mira el modo (`plata.ts:388` y `:465`) y
la rendición y la caja filtran por el modo **actual** en cualquier período (`plata.ts:1988`,
`cierre-caja.ts:70`).

**Los dos sentidos duelen distinto:**
- **→ PROPIETARIO_DIRECTO** (el frecuente, porque INMOBILIARIA es el default del alta): la plata
  está en la cuenta de la inmobiliaria y el contrato pasa a directo ⇒ queda **fuera** de
  `POST /rendiciones` y del arqueo. Ningún endpoint se la hace llegar al dueño. Y volver atrás
  para arreglarlo **rebota con el otro 409**, porque ahora sí figura como "cobrado y sin
  rendir": sólo se sale anulando el pago, que es de ADMIN.
- **→ INMOBILIARIA**: el inquilino transfirió al CBU del **dueño** ⇒ la rendición lo toma como
  rendible y le transfiere de nuevo lo que ya cobró. **Doble pago, sin ninguna alarma.**

**Lo que lo vuelve claro:** el repo **ya** trata `INFORMADO`+`CONCILIADO` como "pago vivo" en
`core.ts:1937`, `:1941`, `:2258`, `:2364`, `:3608` y `:3781`. Este handler era el único que había
quedado afuera — y el de `:3781` termina cincuenta líneas antes.

**Qué se hizo.** Un `count` de `INFORMADO` en dos lugares del mismo handler: la foto previa (409
con `codigo: 'PAGOS_EN_VUELO'` y `pendientes: N`, para que el panel pueda mandar a la bandeja) y
la **revalidación dentro de la transacción, con `tx` y no con `prisma`** — con `prisma` sería
otra foto fuera de la transacción y reabriría el TOCTOU que cerró T-36. Un archivo, un handler;
`grep` confirma que es el único write de `modoCobranza` que lo mueve (los otros tres lo fijan al
nacer).

**El mensaje del 409 es distinto por sentido, y eso es la mitad del arreglo.** Hacia directo la
secuencia sana es *decidir → rendir → recién ahí cambiar*; decirle "validalos y volvé a
intentar" lo mandaría contra el otro 409. Hacia recaudadora, en cambio, validar es justamente lo
que dispara el doble pago: ahí hay que rechazarlos. Es el mismo pecado que `b00f5c19` ya había
sacado una vez ("cambialo el mes que viene", consejo que no destrababa nada).

**Qué podría romper.** Un contrato con un comprobante INFORMADO abandonado no puede cambiar de
modo hasta que alguien lo decida. Siempre es escapable (`POST /pagos/:id/rechazar`, misma
capacidad que validar) y el índice único parcial garantiza **un solo INFORMADO por
liquidación**, así que el número es chico y accionable.

**Tests.** `modo-cobranza-pago-en-vuelo.test.ts`, 4 casos. **Necesita base**, así que lo corre el
job `integracion` de la CI y no se verificó local (el dueño prohibió correr los tests que tocan
la base). Elige el contrato por propiedades y no por id fijo, y restaura pago y modo en el
`afterAll` porque la base es compartida entre archivos.

**Lo que NO cierra, y es de otra tarea.** El arreglo estructural es **congelar en el `Pago` el
modo que regía al cobrar**, y que rendición y caja filtren por ese campo en vez de por el modo
actual. Eso es schema + backfill + los doce filtros que enumera `07-ECOSISTEMA.md:827-830`.
Mientras tanto, el modo sigue siendo un dato del contrato que reinterpreta la historia.

---

## T-63 · Toda la plata del API aceptaba `Infinity` — 🟡 LA MITAD RESUELTA, la otra es tuya

**Experto:** BE + **decisión del dueño** · **Prioridad:** 🔴 · **Toca plata**
**Origen:** riesgo 🔴 Nivel 1 #3 de `work-agent/07-ECOSISTEMA.md:1408` ("el portador del link
mágico declara `montoCobrado` sin tope ni aprobación"), que no tenía tarea. Al ir a arreglarlo
apareció algo más grande abajo.

---

### PARTE A — el agujero de validación · ✅ RESUELTO

**El caso.** `z.number().nonnegative()` **acepta `Infinity`**: zod 3 sólo rechaza `NaN`, y
`Infinity > 0` da true. Verificado corriendo zod, no leyendo la doc. Los **31** campos de plata
y mora del API estaban escritos así, y ninguno tenía `.int()` ni `.max()` que lo atajara de
rebote. El conjunto vulnerable resultó ser, salvo un campo, **exactamente la superficie del
dinero**.

**Dos daños distintos, y el peor no es el que parece.**

- En las 48 columnas `Decimal(14, 2)` —que son **todas** las Decimal del schema, sin una sola
  excepción— Postgres rechaza el valor y el request muere con 500. Visible, y no ensucia nada.
- En las columnas **`Float`** —`Contrato.moraValor`, `Inmobiliaria.moraValorDefault`— Postgres
  **sí guarda `Infinity`**. El valor absurdo no falla: **queda persistido**. Y `calcularMora`
  no tiene red contra eso (`!esquema.valor` es false para Infinity, y `esquema.valor <= 0`
  también), así que devuelve `base * (Infinity / 100) * dias` = **Infinity**. Esa mora entra en
  el `montoTotal` y el `saldo` de **todas** las cuotas de ese contrato: la PWA del inquilino,
  los comprobantes, la deuda del panel y las métricas del dashboard. Un solo PATCH a
  `/contratos/:id/mora` lo dejaba así para siempre.

**Qué se hizo.** Tres validadores en `lib/monto.ts` —`dinero()`, `dineroPositivo()` y
`dineroConSigno()` (este último para el movimiento de caja, que legítimamente puede ser
negativo)— aplicados a los 31 sitios, en 6 archivos de rutas. Después del barrido, el grep de
"number sin `.int()`, sin `.max()` y sin `.finite()`" **no devuelve nada**.

**El techo no es una regla de negocio: es la columna.** `Decimal(14, 2)` son 12 dígitos enteros,
o sea 999.999.999.999,99. Por encima de eso el sistema no puede *guardar* el número.

**Tests.** 14 puros en `plata-no-acepta-infinito.test.ts`, incluida la prueba de que
`calcularMora` devuelve `Infinity` con el `moraValor` envenenado — que es el daño que se
persistía. Los 581 puros que ya existían siguen verdes.

---

### PARTE B — lo que NO se arregló, y es el 🔴 original · ⏸️ DECISIÓN DEL DUEÑO

Acotar a 999.999.999.999,99 **no cierra el riesgo #3.** El problema real es de autoridad, no de
rango: **quien tenga el link mágico mueve plata real, sin que lo apruebe nadie.**

El profesional declara `montoCobrado` en `POST /visitas-publicas/listo`
(`visitas-publicas.ts:242`), eso se escribe como `costoTrabajo` del reclamo y se imputa vía
`imputarCostoReclamo` a **propietario, inquilino o depósito**. Tres cosas lo agravan:

1. **No hay usuario detrás.** El endpoint autentica por link, no por sesión del panel — el
   propio código lo dice: `creadoPorId: null`. Compará con el camino del panel
   (`/reclamos/:id/resolver`, `operacion.ts:542`), que exige `requireUsuario` con capacidad
   `reclamos.gestionar` y queda auditado.
2. **Es irreversible.** Con el reclamo ya `RESUELTO`, `/clasificar` y `/resolver` responden 409.
   El operador no puede corregir el monto que declaró el profesional.
3. **El link no se puede revocar.** Ya está escrito en el código
   (`operacion.ts:388-391`): regenerar el link *no* invalida las sesiones JWT ya emitidas
   —valida por `profesionalId`, no por token— y **duran 14 días**. Para cortar una sesión viva
   hay que reasignar la visita.

**Las opciones, y ninguna la puede tomar un dev:**
- **(a) Tope por contrato** — p. ej. el monto declarado no puede superar N veces el alquiler, o
  el saldo del depósito si el pagador es DEPOSITO. Automático, sin fricción, pero elegir N es
  de negocio.
- **(b) Umbral con aprobación** — por debajo de $X entra solo; por encima queda pendiente y lo
  confirma alguien con `reclamos.gestionar`. Es el patrón que ya existe para otras cosas
  (bandeja de aprobaciones).
- **(c) Que el profesional no declare monto** — informa el trabajo y el monto lo carga la
  inmobiliaria al cerrar. El más seguro y el que más fricción agrega.
- **(d) Dejarlo, y que el tope sea la revocación** — arreglar que regenerar el link corte las
  sesiones vivas, y aceptar el riesgo del profesional legítimo que se equivoca tipeando.

**Lo que sí conviene hacer aunque no se decida nada:** ✅ **HECHO** — T-63-N1, commit `d09b308e`.

Existe `POST /reclamos/:id/reabrir` (capacidad `reclamos.gestionar`, exige motivo) y su card en
el detalle del reclamo, que aparece sólo con el reclamo cerrado y API real. Devuelve el reclamo
a `EN_CURSO` para que `/clasificar` y `/resolver` vuelvan a estar habilitados.

**No mueve plata:** la reimputación la sigue haciendo `/resolver` con el helper de siempre, que
frena solo si el costo ya se rindió al propietario o el inquilino ya lo pagó. Un test fija que
reabrir **no saltea** esos cortes. Y no se toca `resueltoAt`, porque `evaluarSla` lo usa de ancla
para reiniciar el reloj de un reclamo reabierto — limpiarlo lo mostraría VENCIDO al instante.

**La Parte B sigue esperando tu decisión**: el tope, el umbral con aprobación, o que el
profesional no declare monto. Lo que se cerró es que un error ya no es irreversible.

---

## T-62 · La bandeja prometía un saldo que al validar valía cero — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🟡 · **Presentación** (no cambia plata cobrada)
**Origen:** revisión adversarial del motor de cobranza (20/08). Último confirmado de esa tanda.

**El caso.** Liquidación de $600.000, vence el 10/08, mora 0,15% diario ($900/día). El inquilino
informa el 15/08 por **$604.500** — exactamente lo que le mostró su app. La inmobiliaria lo valida
el 18/08. Durante esos tres días `GET /pagos` calculaba la mora con **hoy** ($607.200) y la
bandeja renderizaba *"si lo validás queda $2.700"*. Pero `POST /pagos/:id/validar` congela la mora
en la **fechaTransferencia** del pago: al validar da $604.500, cobrado $604.500, saldo **$0**. Los
$2.700 no existieron nunca — eran los días que el informe pasó esperando que alguien lo mirara, y
no los debía nadie. El fantasma crecía $900 por cada día de demora en decidir.

**Qué se hizo.** La decisión de con qué instante se corta la mora pasó a `asOfMora`
(`lib/punitorios.ts`), que es lo único que consultan las dos rutas: así no pueden volver a
discrepar. Es exacto **por fila** porque el índice parcial `pagos_liquidacionId_informado_key`
garantiza un único INFORMADO por liquidación — o sea, el que se está por validar. Un RECHAZADO no
congela nada.

**Lo que NO se hizo, y es la mitad del hallazgo.** La revisión pedía propagar el congelado a
`deudaTotal` (`core.ts:271`) y al KPI de morosidad (`metricas.ts:126`), estimando *"~$108.000 de
deuda inventada en el dashboard con 40 pagos esperando validación"*. **Ahí no corresponde, y esa
deuda no está inventada: está sin verificar.** La `fechaTransferencia` la carga el inquilino, con
backdate de hasta 30 días — el guard de `/pagos/informar` existe justamente porque se
auto-condonaban punitorios fechando antes del vencimiento. Un KPI que la respetara dejaría que
cualquiera se borre de la lista de morosos informando un pago que no existe, y encima quedaría
escondido hasta que alguien lo rechace. En la bandeja no aplica: ahí el operador está mirando esa
fila justo para decidirla. **Un pago INFORMADO es un reclamo sin verificar, no una deuda saldada.**

**Tests.** 7 puros en `mora-congelada-al-informar.test.ts`: los cinco casos de la regla (incluido
que el INFORMADO gana sobre una liq ya PAGADA, porque es lo que validar va a usar) y la aritmética
del caso real, con el fantasma creciendo día a día. Los 536 puros que ya existían siguen verdes.

---

## T-61 · Un ajuste posterior a una renovación ya cargada queda anulado en el devengo

> ## 🔍 RELEVADO el 21/08 — el arreglo es viable y NO necesita migración
>
> **Lo que se verificó (leyendo, no suponiendo):**
> - `AjusteAlquiler` y `RenovacionContrato` **ya tienen `createdAt`**. La información para
>   distinguir "el snapshot sigue valiendo" de "alguien tocó el canon después" **existe**.
> - Son **tres puntos de escritura**: `core.ts:2460` y `core.ts:3813` (ajustes) y `core.ts:2574`
>   (renovación).
> - `vigenciasFuturas` trae **sólo futuras** (`periodoDesde: { gt: periodoActual }`), lo que
>   confirma que "leer hacia atrás" no es posible con la query de hoy.
>
> ### Un diseño más simple que el de la ficha: REPARAR AL ESCRIBIR
>
> No hace falta comparar `createdAt` en el read, ni llevar un historial de canon. Alcanza con
> mantener el snapshot sano cuando se ensucia.
>
> `V.montoAnterior` significa *"el canon vigente justo antes de `V.desde`"*. Un ajuste nuevo en
> el período X cambia exactamente eso — pero sólo para **la vigencia futura más cercana con
> `desde > X`**; las posteriores tienen su propio predecesor y no se tocan.
>
> **Regla:** al crear un cambio de canon en X, actualizar el `montoAnterior` de la vigencia
> futura con el `desde` más chico entre las que cumplen `desde > X`.
>
> **Por qué esto no rompe el ajuste masivo**, que es lo que tumbó la propuesta anterior: el
> camino de lectura no se toca. `PATCH /contratos/:id/monto` sigue sin dejar fila y
> `contrato.monto` sigue siendo la autoridad, exactamente como hoy.
>
> ### Por qué NO se implementó igual
>
> **Cambia lo que se factura**, y el camino que hay que tocar es de ESCRITURA, en tres lugares.
> Verificarlo pide base de datos: los tests puros pueden fijar *a qué vigencia hay que reparar*
> —eso es una decisión aislable— pero no que las tres escrituras la ejecuten bien.
>
> Mandar un cambio de plata con el camino de escritura sin verificar es exactamente lo que
> produjo los bugs de esta tanda. Con una base de test disponible es una tarde de trabajo.
>
> **Ojo con el signo:** acá se está cobrando **de menos** ($300.000 en vez de $380.000 en el
> ejemplo), así que además de la cuota queda mal la comisión, que sale del alquiler. No es
> urgente como un sobrecobro —no hay un inquilino al que se le esté reclamando de más— pero es
> plata que la inmobiliaria no está facturando.


**Experto:** BE · **Prioridad:** 🟠 · **Toca plata** · **No se arregló: ver por qué**
**Origen:** revisión adversarial del motor de cobranza (20/08).

**El caso.** Contrato a $300.000 que termina el 30/11.

1. **10/08** — se renueva por adelantado (el flujo normal): `montoDesde '2026-12'`,
   `montoNuevo 500.000`. Queda `RenovacionContrato{montoDesde:'2026-12', montoAnterior:300.000}`
   y `contrato.monto = 500.000`.
2. **05/09** — llega el ajuste anual: `periodoDesde '2026-09'`, `montoNuevo 380.000`. Las cuotas
   de 09 y 10 pasan a $380.000. Hasta acá bien.
3. El cron crea la cuota de **2026-11**. `canonDelPeriodo` busca la próxima vigencia futura —la
   renovación de diciembre— y devuelve su `montoAnterior`: **$300.000**.

O sea: **el ajuste de septiembre queda anulado para noviembre.** Se cobran $300.000 en vez de
$380.000, con la comisión calculada sobre esa base.

**La causa.** `montoAnterior` es un **snapshot congelado** al momento de crear la vigencia. El
diseño asume que nadie toca el canon después de grabar una vigencia futura.

### El arreglo propuesto por el revisor NO sirve, y esto es lo importante

Proponía **leer hacia adelante** (usar `montoNuevo` de la última vigencia con `desde <= periodo`)
en vez de hacia atrás. **Rompería el ajuste masivo.** El docstring de `canonDelPeriodo` lo dice:

> *"`contrato.monto` es la AUTORIDAD (lo pisa el ajuste masivo `PATCH /contratos/:id/monto`,
> **que no deja fila de ajuste**)"*

Si el canon se cambió por ahí no hay vigencia que leer, así que "hacia adelante" devolvería el
`montoNuevo` de un ajuste **viejo** en lugar del monto actual — un sobrecobro o subcobro nuevo,
en un camino que hoy funciona bien. Además el query trae **sólo vigencias futuras**
(`periodoDesde: { gt: periodoActual }`), así que las pasadas ni siquiera están en el array.

### Qué haría falta de verdad

Distinguir "el snapshot sigue siendo válido" de "alguien tocó el canon después". Eso pide saber
**cuándo se escribió cada cosa** (un `createdAt` comparado contra la última escritura de canon),
o dejar de depender de snapshots y llevar un historial de canon completo — incluyendo los
cambios que hoy no dejan fila.

Es un cambio de diseño en el corazón del devengo, con un camino (ajuste masivo) que la solución
obvia rompe. **No se toca sin decidir el modelo primero.**

**Cobertura que ya existe:** `test/canon-por-periodo.test.ts` (18 casos, puros). Cualquier
cambio acá tiene que pasar por ahí y sumar el caso de esta tarea.

---

## T-60 · Se facturaba un mes entero que vencía después de terminado el contrato — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🟠 · **Toca plata**
**Origen:** revisión adversarial del motor de cobranza (20/08).

**El caso.** Contrato que termina el **05/09/2026**, día de pago 10. El tope de la enumeración
es de granularidad **MES** (`finMes` es el día 1 del mes de fin), así que se emitía el período
**2026-09 con vencimiento el 10/09** — cinco días después de terminado el contrato. Se le cobraba
el mes completo ($580.000 en el ejemplo) por 5 días de ocupación, con comisión sobre el alquiler,
y esa cuota se devenga de verdad: entra a la PWA, se puede informar y conciliar, entra al cierre
de caja y se rinde al propietario. Una vez cobrada, **la baja del contrato ya no la puede
deshacer**.

**Lo que lo hace claro:** la enumeración **ya tiene la guarda simétrica del otro extremo** —si el
vencimiento del primer mes cae antes del inicio, se saltea— con su propio test. Faltaba la del
final.

**Qué se hizo.** Si el vencimiento cae después de `fin`, ese período no se emite y se corta el
loop (los siguientes vencen todavía más tarde). Va en `packages/shared/src/periodos.ts` y no en
`liquidaciones.ts` a propósito: el wizard y el backend tienen que enumerar **igual**.

**Tests.** Dos, al lado del de la guarda del inicio: el caso del hallazgo y **el borde del
borde** —vencimiento que cae justo el día de fin, que sí debe facturarse—. El primero verificado
en rojo revirtiendo. Los 487 tests puros que ya existían siguen verdes: ninguno dependía del
comportamiento viejo.

---

## T-59 · Un pago rechazado congelaba el canon y las expensas de esa cuota para siempre — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🔴 · **Toca plata**
**Origen:** revisión adversarial del motor de cobranza (20/08).

**El caso.** Cuota de septiembre: alquiler $500.000 + expensas $80.000. El inquilino informa el
pago con el comprobante equivocado y la inmobiliaria **lo rechaza** — operación diaria de la
bandeja "Pagos a validar". La cuota sigue PENDIENTE, pero ya tiene una fila `Pago` en estado
RECHAZADO.

Llegan las expensas nuevas del consorcio ($110.000) y se hace `PATCH /contratos/:id/expensas`.
El recálculo **saltea esa cuota** porque `cantidadPagos > 0` — contando el rechazado, que **no es
plata**. La cuota queda con las expensas viejas: se le cobra **$580.000 en vez de $610.000**, la
inmobiliaria le paga igual al consorcio, y queda así **para siempre** (ningún endpoint borra un
pago rechazado ni permite reintentar el reajuste). Lo mismo por `PATCH /contratos/:id/monto`,
que además lo llama el **ajuste masivo** en loop sobre todos los contratos.

**No era deliberado, y el propio código lo prueba:** el docstring de `recomputarLiquidacionesFuturas`
dice que la defensa es para cuando *"tiene un pago INFORMADO en revisión"* — o sea, pagos vivos.
El conteo venía sin filtrar por estado.

**Qué se hizo.** Las dos queries pasan a contar sólo pagos vivos:
`_count: { select: { pagos: { where: { estado: { in: ['INFORMADO','CONCILIADO'] } } } } }`.
Es el mismo criterio de "pago vivo" que el repo ya usa en `core.ts:1940`, `:2257` y `:2363`.
El docstring quedó explícito sobre el rechazado.

**No se tocó** el tercer conteo sin filtrar (`core.ts:2071`, `finalizar-preview`): ahí es
deliberado y su propio comentario explica por qué un INFORMADO/RECHAZADO no debe caer en
`esFuturaSinPago`.

**473 tests puros en verde.**

---

## T-58 · La mora fija del tenant se aplica sin mirar la moneda del contrato

**Experto:** BE · **Prioridad:** 🟠 · **Toca plata** · **No se arregló: ver por qué**
**Origen:** revisión adversarial del motor de cobranza (20/08).

**El caso.** El admin configura la mora default como **MONTO_FIJO = 5000**, pensada en pesos —la
pantalla que la carga no pide moneda y la previsualiza con el símbolo `$`—. Un contrato en
**USD** sin `moraTipo` propio (el wizard arranca en `HEREDAR`, y la importación de cartera
tampoco lo setea) hereda ese default y lo aplica **1:1**:

    alquiler US$ 800 + mora US$ 5.000 = US$ 5.800 exigibles.

Cinco mil dólares de punitorio sobre un alquiler de ochocientos. Es lo que la PWA le reclama al
inquilino.

**Por qué pasa.** `resolverEsquemaMora` devuelve `{tipo:'MONTO_FIJO', valor:5000}` sin mirar
`Liquidacion.moneda`, y `calcularMora` lo usa tal cual.

**El arreglo, que NO necesita migración.** `Inmobiliaria.monedaDefault` ya existe: la moneda del
default **está determinada**, no hay que guardarla. La regla sería: si el esquema viene del tenant
y es `MONTO_FIJO`, heredarlo **sólo si la moneda del contrato coincide** con `monedaDefault`; si
no, `SIN_MORA` — mejor no cobrar mora que cobrarla en la unidad equivocada. No se inventa una
conversión.

**Por qué no lo hice.** `resolverEsquemaMora` tiene **21 call sites**, y la regla exige que cada
uno conozca la moneda del contrato. Los tipos son opcionales, así que agregar el campo compila
igual — pero los call sites cuyo `select` no traiga `moneda` seguirían con el comportamiento
viejo, y quedarían **moras distintas según qué endpoint las calcule**. Es exactamente la
objeción que hace inaceptable el arreglo parcial en T-57. O se hace en los 21 y se corre la
suite completa, o no se hace.

**Frecuencia:** raro (hace falta tenant con MONTO_FIJO default + contrato en otra moneda + sin
mora propia), pero catastrófico cuando ocurre.

**Criterio de aceptación.** Un contrato en USD no hereda una mora fija cargada en pesos, y la
mora sale igual desde los 21 lugares que la resuelven.

---

## T-56 · Todo cobro con fecha civil perdía un día de mora — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🔴 · **Toca plata** · **Trababa la conciliación bancaria**
**Origen:** revisión adversarial del motor de cobranza (20/08).

**La causa raíz.** `diaCivilAR` está escrito para **instantes**. Si se le pasa una fecha civil
pelada —las que manda el panel como `"YYYY-MM-DD"`, o las que arma el parser del extracto— queda
en `D T00:00Z`, que en Argentina son **las 21:00 del día anterior**: devuelve `D − 1` **siempre**.
No es un borde, es un corrimiento constante.

**Lo que costaba, verificado con números** (cuota $600.000, vence 10/08, mora 0,15% = $900/día):

| Camino | Qué pasaba |
|---|---|
| **Cobro manual** | El diálogo prefillea $609.000 (mora al instante, 10 días) y el guard recalcula con 9 → **400 "El monto supera el saldo"**, contra el mismo número que él propuso. La cajera baja a $608.100, la cuota cierra y **esos $900 no vuelven nunca**: `fechaPago` queda date-only y toda lectura posterior recalcula los mismos 9 días. |
| **Extracto bancario** | Igual, pero **ahí el monto no se puede editar**: un crédito por exactamente lo que la app le mostró al inquilino quedaba **imposible de conciliar**. |
| **Mora MONTO_FIJO** | `ceil(días/30)`: 30 días → 1 mes, 31 → 2. Un día de menos en cada múltiplo de 30 se llevaba **un mes entero** de mora. |

**Lo que NO alcanzaba:** el pago que informa el inquilino manda `new Date().toISOString()`, un
instante completo, así que `/pagos/:id/validar` nunca tuvo el corrimiento.

**Qué se hizo.** `instanteEnDiaCivilAR` en `packages/shared/src/periodos.ts` —el inverso de
`diaCivilAR`, que lleva la fecha civil al **mediodía** argentino, lejos de los dos bordes— y se
aplicó en los tres call sites: el zod de `/pagos/manual` (así el `asOf`, el `fechaTransferencia`
y el `fechaPago` quedan bien de una) y los dos `calcularMora` del extracto. **`diasAtraso` no se
tocó**: es correcto para instantes, que es para lo que está escrito.

**Tests.** `test/mora-fecha-civil.test.ts`. La suite ya tenía `vencimiento-huso-horario.test.ts`
en verde, pero cubría la semántica **con instantes** y nunca ejercitaba un `asOf` sin hora —
justo el agujero. Los dos archivos pasan juntos.

---

## T-55 · Un doble click al saldar un cargo lo cobraba dos veces — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🟠 · **Toca plata**
**Origen:** revisión adversarial del motor de cobranza (20/08).

**El agujero.** `POST /cargos/:id/saldar` hacía **check-then-act**: leía el cargo con un
`findFirst` **fuera** de la transacción, chequeaba `if (!cargo.saldadoAt)` y recién adentro
hacía el `update` — **sin condicionarlo**. Dos requests concurrentes (alcanza un doble click, o
dos operadoras) pasaban los dos el chequeo y **creaban dos `INGRESO_EXTRA` por una sola
cobranza**.

**Y no se queda en la caja.** El propio comentario del handler lo advierte: la rendición levanta
esos `INGRESO_EXTRA` con `descontadoEnRendicion: false` y **se los acredita al propietario**. O
sea que el dueño cobraba dos veces el mismo cargo. Ese comentario incluso dice, sobre el inverso:
*"Que no lo hiciera costaba dos ingresos por una sola cobranza"* — el mismo riesgo seguía vivo
por esta otra vía.

**Qué se hizo.** `updateMany` condicionado a `saldadoAt: null` (más el tenant) dentro de la
transacción: el segundo request no matchea ninguna fila, sale con `count === 0` y **no llega a
crear el movimiento**. Es el mismo patrón que ya usan validar, rechazar y anular en ese archivo.
El que pierde la carrera tampoco registra el evento de auditoría: dos eventos por una cobranza
ensucian el historial igual que dos ingresos la caja.

**Cómo se encontró.** Comparando qué endpoints del ciclo de plata tienen el patrón
`updateMany + count === 0` y cuáles no. `validar`, `rechazar` y `anular` lo tienen; `saldar` era
el que faltaba.

---

## T-54 · Una condonación parcial le decía al dueño que le perdonaron el mes entero — ✅ RESUELTO

**Experto:** FE · **Prioridad:** 🟢
**Origen:** revisión de seguridad del portal (19/08). Último de los seis confirmados.

**El caso.** El inquilino paga el alquiler tarde y queda debiendo la mora. La inmobiliaria usa
**Saldar deuda → Condonar**, que crea un pago condonado por el **remanente** — o sea, sólo el
punitorio. El dueño abría Unidades y ese mes figuraba **"la inmobiliaria la condonó"**, sin
fecha de cobro, cuando el alquiler entró completo y se lo van a depositar. Lo mismo si el
inquilino pagó $70 de $100.

**Por qué estaba así.** El renglón ya trataba la condonación como excluyente, y con buen motivo:
una cuota perdonada figura PAGADO en la liquidación, así que sin eso el dueño veía un badge
**verde** por plata que nunca le iba a llegar. La intención era correcta; le faltaba el caso
del medio.

**Qué se hizo.** `pagoAt` distingue los dos: condonación **+ fecha de pago real** = fue parcial.
Ahora dice las dos mitades —*"pagó el 11/08 · el resto se condonó"*— con el badge
**"condonada en parte"** en neutro, no en verde: cobró algo, pero parte de esa cuota no se le
rinde. Así no cae en ninguna de las dos mentiras.

El criterio se extrajo a `estadoVisualPeriodo`, una función pura exportada, para que viva en un
solo lugar y se pueda testear — el estilo que ya usa `diasHasta` en ese mismo archivo.

**Tests:** 3 casos nuevos en `portal-piezas.test.ts` (total, parcial y sin condonación).

---

## T-53-N1 · El OTP delataba si el email existe, por el tiempo de respuesta — ✅ HECHA

> ### ✅ Cerrada el 20/08. Ver `work-agent/tareas/T-53-N1/REQUISITOS.md`.
>
> **El bloqueo que la dejó abierta ya no existe:** decía que sus tests tocan la base y no se
> podían correr. Desde T-01-N1-N1 la suite de integración corre —en CI y en local contra Docker—
> así que la duda se contestó corriéndola.
>
> **Arreglado el OTP del inquilino** (`POST /auth/otp/request`), con el mismo patrón que el
> portal: el bcrypt se calcula siempre y el envío SMTP no se espera. Su propio comentario decía
> *"Respuesta idéntica exista o no"* y el cuerpo lo era; el tiempo no.
>
> **El del panel NO se tocó, y no es un olvido.** Ya revela la existencia a propósito, en el
> cuerpo: devuelve `{ existe: false }` con un comentario que lo llama *"trade-off consciente"*
> para poder mandar a `/registro`. Emparejar tiempos ahí sería teatro — la respuesta lo dice en
> la primera línea. Cerrar ese canal es **decisión de producto**, y si se decide, el fix de
> tiempos va JUNTO con sacar el `existe`: antes no cambia nada y da la sensación de que se
> atendió.
>
> Verificado: `auth.test.ts` 12/12 contra base desde cero —ninguno dependía de que el mail
> saliera antes de responder, que era la duda— y suite completa en verde.

**Experto:** SEC + BE · **Prioridad:** 🟢
**Origen:** revisión de seguridad del portal (19/08).

**El portal: ✅ RESUELTO.** `POST /auth/propietario/otp/request` ya calculaba el `bcrypt` exista
o no el email —con un comentario que explica que es para no volver el tiempo de respuesta un
oráculo de enumeración—, pero **el envío SMTP se awaiteaba sólo en la rama "existe"**. Con SMTP
configurado ese envío es el costo **dominante** (cientos de ms contra los pocos del bcrypt), así
que deshacía el emparejamiento. Ahora el envío se dispara sin esperarlo: la respuesta es
`{ ok: true }` igual, y el error se sigue logueando fuera del camino del request.

**Los otros dos OTP tienen el mismo patrón, y NO se tocaron:**
`apps/api/src/routes/auth.ts:306` (inquilino) y `:406` (panel) también hacen
`await enviarOtp(...)` sólo cuando el destinatario existe.

**Por qué no se arreglaron acá:** sus tests (`auth.test.ts` y compañía) **tocan la base** y desde
esta sesión no se pueden correr. Si alguno verifica que el mail salió antes de responder, sacar
el `await` lo pondría en rojo y no habría forma de enterarse. El arreglo es el mismo de tres
líneas; hay que hacerlo con la suite completa a mano.

**Criterio de aceptación.** Los tres OTP tardan lo mismo exista o no el email, y la suite
completa de `apps/api` sigue en verde.

---

## T-53 · En copropiedad, al dueño ya rendido le seguía apareciendo la parte del otro — ✅ RESUELTO

**Experto:** BE + FE · **Prioridad:** 🟠
**Origen:** revisión de seguridad del portal del propietario (19/08). Dos dimensiones lo
reportaron por separado.

**El caso.** Propiedad con dos dueños, A 60% y B 40%. Se cobra el alquiler ($100) y la
inmobiliaria le rinde a A su parte ($60). **A entra al portal y sigue viendo $40 pendientes** —
que son de B — con la leyenda *"te corresponde el 60%"*, o sea invitándolo a esperar $24 que no
van a llegar nunca. Al revés fallaba igual.

**La causa.** `AlquilerRendido` cuelga de `Rendicion.propietarioId` (el schema lo dice: *"parte
del propietario rendida en esta tanda"*), pero el helper agrupaba sólo por `liquidacionId`, sin
mirar de quién era la rendición: mezclaba lo rendido a todos los dueños. `POST /rendiciones` sí
hace el **doble cap** por dueño (`plata.ts:1985` y `:2042`); el portal no lo replicaba, y este
archivo declara justamente que *"la aritmética replica EXACTAMENTE la de POST /rendiciones"*.

**Qué se hizo.** Un modo opt-in `duenio: { propietarioId, porcentaje }` que espeja el doble cap:
(1) lo que le falta a ESTE dueño de su parte, y (2) el remanente de la liquidación entre TODOS
—el (2) evita el sobre-pago cuando se cambió el reparto después de rendir—. **Los guards de
`core.ts` no lo usan**: ellos necesitan el total global, ciego a la participación.

**El copy también estaba mal.** Antes el número era el total de la unidad y el texto invitaba a
multiplicar por el porcentaje. Ahora el número **ya es su parte**, y el texto lo dice:
*"Es tu 60% del alquiler cobrado de la unidad"*.

**Tests.** `test/rendicion-pendiente-por-duenio.test.ts`, puros, con el caso 60/40 del hallazgo,
el del reparto cambiado y el de la tolerancia de un centavo con prorrateo. Verificados en rojo
revirtiendo el arreglo (3 de 6 caen).

---

## T-52 · "Cobrado y sin rendir" contaba plata que nadie va a rendir nunca — ✅ RESUELTO

**Experto:** BE · **Prioridad:** 🟠
**Origen:** revisión de seguridad del portal del propietario (19/08). Lo encontraron **dos
dimensiones por separado**.

**El desajuste.** `POST /rendiciones` sólo rinde contratos con `modoCobranza: 'INMOBILIARIA'`
(`plata.ts:221` y `:1929`), pero `alquilerCobradoSinRendirDePropiedad` no filtraba por modo. En
un contrato **PROPIETARIO_DIRECTO** el inquilino transfiere al CBU del dueño y conciliar el pago
**no mira el modo**: esos cobros quedan CONCILIADOS y, como la rendición los excluye, **nunca va
a existir un `AlquilerRendido` que los baje**. El número no llega a cero por ningún camino.

**El impacto que ya estaba vivo — y no es el portal.** El mismo helper lo usa el guard de
`PUT /propiedades/:id/participaciones` (`core.ts:686`), que corre **en el panel, en producción**.
Una propiedad con un contrato directo y cobros conciliados quedaba con el **reparto de dueños
trabado en 409 permanente**, con un mensaje que aconseja *"rendíselo a los dueños de hoy"* —
justo lo que el sistema no puede hacer. Es el mismo pecado que T-36 se cuidó de no cometer: dar
un consejo imposible.

En el portal (todavía sin desplegar) el efecto habría sido peor de cara al dueño: ver como
*"cobrado y todavía sin rendirte"* la plata que él mismo ya tiene en su cuenta.

**Por qué el filtro es opt-in y no incondicional.** Dos llamadores necesitan lo **opuesto**:

| Llamador | Qué necesita |
|---|---|
| `PATCH /contratos/:id/modo-cobranza` (`core.ts:3842`) | **VER** esa plata — es lo único que impide que al pasar de directo a inmobiliaria el sistema le transfiera al dueño algo que ya cobró. **No se tocó.** |
| Guard de reparto (`core.ts:686`) y portal (`portal-propietario.ts:646`) | Ver **sólo lo rendible** |

Meter el filtro adentro del helper habría abierto un agujero de plata real en el primero.

**Tests.** `test/rendicion-pendiente-solo-rendible.test.ts`, puro (el cliente de base es un doble
que captura el `where`). Incluye un test que **fija que el guard por contrato NO filtre**, para
que nadie "unifique" los dos casos sin darse cuenta. Verificado en rojo revirtiendo el arreglo.
El test estructural `portal-aislamiento.test.ts` sigue verde.

---

## T-51 · Los datos de demo usan dominios de correo reales, y ahora están publicados

**Experto:** SEC (higiene de datos) · **Prioridad:** 🟢 · **Depende de:** poder correr la suite
completa de `apps/api`
**Origen:** revisión de seguridad del portal del propietario (19/08).

**Qué pasa.** Ningún email de los datos ficticios usa un dominio reservado. Son
`@gmail.com`, `@hotmail.com`, `@yahoo.com.ar`, `@outlook.com`, y dominios `.com.ar` con pinta de
negocio real para los proveedores (`friopro.com.ar`, `ferrari-elec.com.ar`). Desde el 19/08 eso
está **publicado en internet** en la demo de GitHub Pages, con nombre y apellido al lado.

**Por qué importa aunque sea menor.** Algunas de esas direcciones pueden existir y ser de
personas o negocios reales que no tienen nada que ver con el producto, y quedan asociadas
públicamente a una demo. La convención para datos ficticios (RFC 2606) es `example.com`,
`example.org`, `.invalid` o `.test`, justamente para que no le caiga correo a nadie.

**Alcance medido:** 23 ocurrencias en 11 archivos —`apps/propietario/src/lib/demo-data.ts`, los
`mock-data.ts` del panel y la PWA, `mailer.ts`, `auth.ts` y algunas pantallas—.

**Por qué NO se hizo acá.** Varios tests de `apps/api` (`auth.test.ts`, `core.test.ts`,
`anuncios.test.ts`, `baja-contrato.test.ts`, `certificado-antiguedad.test.ts`) dependen de esos
emails, y esos tests **tocan la base**: desde esta sesión no se pueden correr, así que no había
forma de verificar que el cambio no rompiera la suite. Cambiar a ciegas 23 valores de los que
dependen tests que no puedo ejecutar es peor que dejar el problema anotado.

**Criterio de aceptación.** Ningún dato ficticio usa un dominio de correo que pueda existir, y
la suite completa de `apps/api` sigue en verde.

---

## T-50 · La pestaña Comunicaciones decía que no había ninguna — ✅ RESUELTO

**Experto:** FE-P · **Prioridad:** 🟠
**Origen:** evaluación de Camila (19/08).

Se registraba un mensaje, el toast decía *"quedó anotado en el historial del contrato"*, y la
pestaña de al lado seguía diciendo **"No hay comunicaciones registradas con este inquilino"**.
Camila: *"Dos verdades en la misma ficha. Si algún día tengo que discutir algo, ¿cuál muestro?"*

**El dato ya estaba.** `POST /contratos/:id/comunicaciones` las guarda como `EventoContrato` con
`tipo: 'COMUNICACION_ENVIADA'` (`core.ts:2502`) y `GET /contratos/:id/eventos` las devuelve — de
hecho ya se veían en el **Historial**. Lo que fallaba era el mapper del detalle, que en prod
dejaba `comunicaciones: []` hardcodeado. Ahora la pestaña las deriva de esos eventos.

**Un error propio, y por qué importa.** La primera versión usaba `useMemo`, y esa línea vive
**después** de los early-returns del componente: React tiró *"Rendered more hooks than during the
previous render"* y **se cayó la ficha entera**. `tsc` pasó igual — sólo lo atrapó abrir la
pantalla. Se resolvió derivando la lista sin hook (son pocos elementos y no necesita memo).

**Verificado en navegador:** la pestaña pasa a "Comunicaciones **2**" y muestra asunto, cuerpo,
fecha y autor de cada una.

---

## T-49 · El cartel prometía WhatsApp y no llega nada — ✅ RESUELTO

**Experto:** FE-P · **Prioridad:** 🟠
**Origen:** evaluación de Camila (19/08). Ella lo pidió textual: *"Sacalo hoy, es una línea de
texto"*.

Abajo del campo para responderle al inquilino en un reclamo decía *"El inquilino lo recibe en la
app y por WhatsApp"*. **Las dos mitades eran falsas:** `POST /reclamos/:id/responder` sólo
persiste el mensaje —no manda mail ni push— y **WhatsApp no está integrado en ninguna parte del
repo**.

Camila: *"Yo le contesto a alguien, me quedo tranquila, y a los cuatro días me reclama que no le
respondí. Ese cartel me hace quedar mal a mí, no al software."*

Ahora dice lo que pasa de verdad: que queda en el reclamo, que el inquilino lo ve cuando entra, y
que **si es urgente hay que escribirle**. Notificar de verdad es otra cosa y vive en T-17.

---

## T-46 · El inquilino ve tres números distintos para la misma deuda — ✅ RESUELTO

> **Hecho.** `/comprobantes` ahora usa `saldoDeLiquidacion`, el mismo helper que el home y el
> detalle. La fila compacta **no descontaba** lo informado y la card grande de esa misma
> pantalla **sí**: con un pago informado y sin validar, la pantalla se contradecía sola. Las dos
> salen ahora de una sola definición de "cuánto debe". `montoPagado` (lo ya validado) se
> conserva aparte, porque alimenta el "ya pagaste $X" y es un dato distinto de "cuánto falta".

**Experto:** FE-I · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** evaluación de Camila (19/08). **T-15 figura como ✅ HECHA y no lo está.**

El criterio de aceptación de T-15 era "las tres pantallas muestran el mismo número". El helper
único `saldoDeLiquidacion` lo usan **dos**: el home y el detalle del pago. **`/comprobantes` no
lo importa** y tiene dos cuentas propias que ni siquiera coinciden entre sí: la fila compacta
muestra el total completo (no descuenta lo informado) y la card grande sí lo descuenta. Con un
pago informado y sin validar, esa pantalla se contradice sola.

**Qué hay que hacer.** Que `/comprobantes` use `saldoDeLiquidacion` como las otras dos.

---

## T-47 · La expensa del mes del consorcio no se puede cambiar — ✅ RESUELTO

> **Hecho.** Lápiz en el stat "Expensa del mes" de la ficha del consorcio, con período e
> importe. El endpoint (`PUT /consorcios/:id`) y el hook `editarConsorcio` **ya existían**: el
> hook no lo llamaba ninguna pantalla, así que el valor sólo se podía fijar al crear el
> consorcio — y es una acción mensual.
> **Verificado en navegador:** el diálogo abre precargado con el período y el importe actuales,
> y al guardar sale `PUT /consorcios/:id → 200` seguido del GET de refresco.

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** evaluación de Camila (19/08).

`PUT /consorcios/:id` acepta `periodoActual` y `expensasPeriodoActual`, y el panel tiene el hook
`editarConsorcio`… que **no lo llama nadie**. La pantalla del consorcio lo muestra como dato de
sólo lectura y sólo se puede setear **al crear** el consorcio. Es una acción **mensual**.

**Qué hay que hacer.** Cablear el hook a un botón en la ficha del consorcio.

---

## T-37-N1 · Circuito de aprobación para el pago manual del operador

**Experto:** BE + PROD · **Prioridad:** 🟢 · **Depende de:** decisión de producto
**Origen:** T-37. Es la mitad que se decidió NO construir sin que la pidieras.

**El caso.** Si Camila quiere que sus operadoras puedan registrar un cobro en efectivo sin
darles rol CAJA, hace falta lo que la matriz ya describía: el pago lo carga el OPERADOR y queda
**pendiente de aprobación** hasta que un ADMIN lo confirma.

**Qué existe y qué no.** El patrón ya está resuelto para contratos: `contratoQuedaPendiente`
(`packages/shared/src/permisos.ts`) + el circuito de aprobaciones del panel. Para pagos hay
`requiereAprobacion`, pero **no se llama desde ningún lado de `apps/api`**.

**Qué habría que hacer.** Que `POST /pagos/manual` exija `pago.manual.cargar` en vez de
`pago.conciliar`, y que cuando `requiereAprobacion(rol, 'pago.manual.cargar')` sea `true` el
pago nazca pendiente en vez de conciliado, enganchado a la cola de aprobaciones que ya usa el
panel.

**Por qué no se hizo.** Mete un estado nuevo en el flujo de plata y nadie lo pidió en la
reunión. Es una feature, no el arreglo de una inconsistencia.

**Criterio de aceptación.** Una operadora carga un cobro en efectivo, queda pendiente, y la
administradora lo ve en su cola y lo aprueba. Sin aprobación, ese pago no cuenta como cobrado.

---

## T-38 · `POST /contratos/:id/ajustar` no valida el tipo de contrato — ✅ RESUELTO

> **Hecho.** 409 cuando el contrato es `SOLO_EXPENSAS`, con el texto que dice dónde se corrige
> lo que el operador probablemente quería cambiar (el importe de las expensas).

**Experto:** BE · **Prioridad:** 🟢 · **Depende de:** nada
**Origen:** revisión adversarial del 19/08. Es el **residuo** de T-20, que cerró el agujero del
cron pero no éste.

**Estado verificado.** Los otros tres caminos que escriben el canon
(`computarLiquidacionesContrato`, `recomputarLiquidacionesFuturas`, `PATCH /contratos/:id/monto`)
aplican `montoAlquilerSegunTipo`. `POST /contratos/:id/ajustar` no: exige un monto positivo y lo
escribe en las cuotas futuras. En un contrato `SOLO_EXPENSAS` eso le factura alquiler a quien
sólo debe expensas, y la comisión se calcula sobre esa base.

**Por qué es 🟢 y no 🔴.** No hay camino automático: no existe ajuste masivo que itere
contratos, y el operador tendría que tipear un alquiler positivo en una ficha donde el panel
dice "Tipo: Sólo expensas", oculta la fila Alquiler y el diálogo muestra "Alquiler actual: $0".
Es lo contrario de T-20, que era un cron silencioso que además deshacía la corrección manual.

**Qué hay que hacer.** 409 *"este contrato no cobra alquiler"* cuando el tipo es
`SOLO_EXPENSAS`. (Se revisó `/renovar` y **no** tiene el problema: su `updateMany` filtra por
`periodo >= montoDesde` y el devengo nunca genera períodos más allá del mes de `fechaFin`, así
que no matchea ninguna fila.)

---

## T-24 · Cargar morosos históricos sin inventar contratos

**Experto:** BE + PROD · **Prioridad:** 🔴 · **Depende de:** nada

**Qué pidió Camila.** Es lo que le bloquea **migrar su cartera real**:

- `[50:04]` *"Yo ahora tengo 50 morosos. Cuando yo inicie, ¿puedo cargar un moroso que no tiene
  contrato y no tiene vigencia?"*
- `[51:06]` *"Tendría que empezar cargando los morosos para recién cargar el contrato vigente…
  [si tengo] cinco inquilinas en la misma propiedad… ni en pedo, no lo hago."*
- `[53:35]` *"No voy a cargar cinco veces un inquilino en una sola misma propiedad."*
- `[53:43]` Acuerdo con Alan: *"En inquilinos poner para importar."*
- Y un pedido lateral `[52:00]`: en su sistema, al cargar el DNI de un inquilino de hace seis
  años, le avisa *"ya estás registrado"*. Quiere lo mismo acá.

**Estado verificado — hay tres piezas que sirven y ninguna resuelve el caso.**

1. **Estado inicial de deuda al dar de alta** (`lib/estado-inicial-contrato.ts`,
   `Contrato.periodosAnterioresPendientes`): el alta ya permite decir cómo quedó cada mes ya
   vencido (PAGADO / PARCIAL / ADEUDA). **Cubre la deuda del inquilino vigente**, no la de
   ex-inquilinos.
2. **Importación de cartera** (`importaciones-cartera.ts`): sube Excel/CSV con mapeo flexible y
   crea propiedad + propietario + inquilino + contrato ACTIVO. **No importa deuda histórica de
   gente que ya se fue.**
3. **`Persona`** (`lib/persona.ts`) ya permite reusar un inquilino entre contratos, con
   prioridad DNI → email → crear, y hay un "semáforo del inquilino al reusar" (commit `b24de0b`).
   **Falta confirmar si avisa lo que ella espera al cargar un DNI ya conocido.**

**Qué hay que hacer.**
1. **PROD define el modelo primero.** La pregunta de fondo: ¿la deuda de un ex-inquilino cuelga
   de un contrato histórico (aunque sea mínimo), o de la Persona + la propiedad, sin contrato?
   Alan propuso lo segundo `[53:05]`. Tiene consecuencias: sin contrato no hay liquidaciones, y
   toda la maquinaria de deuda del sistema cuelga de liquidaciones.
2. Implementar la carga, idealmente **por importación** (es lo que ella pidió) además de a mano.
3. Que esa deuda se vea en la ficha de la Persona y en la propiedad, y que se pueda saldar.
4. Cerrar el aviso de "este DNI ya existe" al cargar.

**Criterio de aceptación.** Camila carga sus 50 morosos históricos sin crear un solo contrato
falso, y los ve al buscar por DNI o al abrir la propiedad.

**Riesgo.** Medio-alto: es plata que entra al sistema por un camino nuevo. Definir bien si esa
deuda suma a los KPIs de mora (probablemente **no** debería mezclarse con la cartera vigente).

---

### ✅ RESUELTO (parcial) — commits `67850f3` + `7a78c8b`

**La decisión de modelo (punto 1), tomada y justificada.** Se descartó la tabla
`DeudaHistorica` suelta que proponía Alan: habría quedado desconectada de toda la maquinaria de
plata —saldos, mora, `saldar-deuda`, la ficha de la Persona, los KPIs— y habría sido una segunda
verdad sobre cuánto debe cada uno. La deuda cuelga de **un contrato FINALIZADO que NO reclama la
propiedad**, así que convive con el contrato vigente de otro inquilino. La objeción de Camila no
era al modelo sino al trabajo (*"no voy a cargar cinco veces"*): eso se ataca con carga masiva,
no eliminando la estructura.

`POST /contratos/historico` + botón **"Deuda de inquilino anterior"** en la ficha de la propiedad.
`fechaInicio`/`fechaFin` delimitan la **ventana de meses adeudados**, no el alquiler real.

**Verificado que reusa lo que ya existe, sin tocarlo:**
- el devengo barre `estado: 'ACTIVO'` y re-verifica bajo lock → nunca resucita un histórico;
- `GET /personas/:id` no filtra por estado → la deuda entra en la ficha y enciende `tuvoMora`;
- `saldar-deuda` busca por `{id, inmobiliariaId}` → se salda sin caso especial;
- `GET /propiedades/:id` ya devolvía el historial completo → aparece bajo "Contratos anteriores".

**Decisión de seguridad no pedida pero necesaria:** el `Inquilino` histórico se crea **sin email**.
`Inquilino.email` es la llave de login de la PWA y un ex-inquilino con contrato FINALIZADO
conserva acceso de sólo lectura; en una carga de 50 filas a mano, un email mal tipeado le abriría
a un tercero la deuda de otra persona. El email va a la `Persona`, que es donde sirve (dedup) y
no habilita acceso.

**Sobre los KPIs:** `metricas.ts` filtra por ventana de períodos recientes, sin filtro de estado
de contrato. O sea: la deuda histórica **sí** cuenta si sus meses caen en la ventana. Se deja
así a propósito —un alquiler que no se cobró realmente no se cobró, y cargarlo hace las métricas
pasadas más ciertas, no menos— pero queda anotado por si Camila lo lee distinto.

**8 tests puros** (`apps/api/test/deuda-historica.test.ts`), verificados en rojo: con el tope de
períodos roto, un contrato de 2024 devengaba 32 cuotas hasta hoy en vez de 3.

**Lo que NO quedó hecho, y es lo que ella pidió textualmente:**

---

## T-24-N1 · Importar morosos históricos desde Excel

**Experto:** BE + FE-P · **Prioridad:** 🟠 · **Depende de:** T-24 (hecho)

Camila dijo *"tengo 50 morosos"* y Alan acordó *"en inquilinos poner para importar"* `[53:43]`.
Hoy se cargan **de a uno**: son ~50 formularios. Funciona, pero no es lo que pidió.

`importaciones-cartera.ts` ya tiene todo el andamiaje —subida de Excel/CSV, mapeo flexible de
columnas, dedup por dirección, `buscarOCrearPersona` compartido— y crea contratos ACTIVO. Falta
un modo que apunte a `POST /contratos/historico` con columnas *persona · propiedad · desde ·
hasta · monto*.

**Criterio de aceptación.** Camila sube una planilla con sus 50 morosos y quedan cargados, con
un resumen de cuántos se unieron a una ficha existente por DNI y cuántos se crearon nuevos.

---

### ✅ RESUELTO — commits `8f74b0a` · `079d918` · `ff978ec` · `6909733`

`POST /importaciones-morosos/{analizar,validar,confirmar}` + botón **"Importar morosos"** en
`/inquilinos` (donde Alan pidió ponerlo, `[53:43]`).

**No se enganchó en `importaciones-cartera.ts`, y la razón importa:** ese pipeline **siempre**
crea la propiedad en cada fila y **rechaza** la fila si la dirección ya existe, y fuerza
`devengarDesde` = mes actual *justamente para no fabricar deuda pasada*. Para morosos hace falta
lo inverso en los dos puntos. Un `if (tipo)` en cada paso de una máquina de 500 líneas llena de
comentarios sobre bugs de duplicación en carteras reales era arriesgar un flujo que hoy funciona
para ahorrar un archivo. Sí se reusa todo lo puro: `parsearMonto`, `normalizarHeader`,
`normalizarDireccion`, `buscarOCrearPersona` y la forma del wizard.

La creación del contrato histórico se extrajo a `lib/contrato-historico.ts`: la carga de a uno y
la importación comparten la misma aritmética. Duplicada, tarde o temprano una crearía cuotas
distintas que la otra.

**Flujo stateless** (no persiste una `ImportacionCartera`): ese modelo existe para reanudar
cargas de cientos de filas caras, y agregarle una columna `tipo` habría pedido una migración
sobre producción — que en este entorno no se puede aplicar, así que la feature nacía muerta. Tope
de **500 filas**: la matriz vuelve al server y el body limit de Fastify es 1 MiB.

**Lo que encontró la revisión adversarial, todo corregido:** re-subir la planilla duplicaba toda
la deuda (el camino normal de recuperación); expensas negativas restaban del alquiler y un rango
tipeado `"1.500 - 2.000"` se parseaba como **-15.002.000**; texto en la celda de expensas daba
null en silencio; `"US$"` y `"U$D"` caían a PESOS; y las fechas de Excel serializadas con
`toISOString()` retrocedían un mes en un server al este de UTC.

**Del role play de Camila** salió lo que más movía la aguja: sus direcciones están escritas como
las tipeó hace años y el match exacto fallaba en buena parte de las 50 filas. Ahora el error
**nombra la candidata parecida** ("No encontramos X. ¿Será Y?"), apoyándose en la altura como
señal fuerte y callando cuando no está seguro.

**158 tests puros**, 55 nuevos. Quedan abiertas **T-24-N3** (deshacer una importación) y
**T-24-N4** (plantilla descargable), ninguna bloqueante.

---

## T-24-N2 · Avisar "este DNI ya está en tu cartera" al cargar deuda histórica — ✅ HECHA

**Experto:** FE-P · **Prioridad:** 🟢 · **Depende de:** T-24 (hecho)

Punto 4 del T-24 original, que quedó a medias. El backend **ya unifica** por DNI
(`buscarOCrearPersona`), así que no se duplica nada; pero el diálogo sólo lo dice en texto de
ayuda, no lo confirma después. Camila `[52:00]`: su sistema le avisa *"ya estás registrado"*.

Falta el buscador "¿Ya está en tu cartera?" que el alta normal sí tiene, y que el toast diga a
qué ficha se unió (la respuesta ya devuelve `personaId`).

**Resuelta** en `feat/T-24-N2-dni-conocido`, commit `ece26c0`. **Ojo con la base:** sale de
`feat/T-24-morosos-historicos`, **no** de la rama de integración — el diálogo que extiende vive
ahí y T-24 sigue sin mergear. Van juntas.

Al llegar a 7 dígitos consulta el `GET /personas?q=` que ya existía, compara **exacto** en el
cliente (el endpoint filtra con `contains`, así que `2845678` trae también al `28456789`) y
muestra el aviso con nombre, apellido y propiedad de referencia. **Cero backend**: el endpoint
ya aceptaba `personaId` con validación de tenant, y tocar `core.ts` habría chocado con T-24-N1,
que está construida sobre la misma base y saca el handler a `lib/contrato-historico.ts`.

La trampa que destapó la revisión adversarial: guardando sólo la persona encontrada, entre que
se corrige un dígito y vuelve la consulta quedan 350 ms en los que el cartel nombra a la persona
del DNI **anterior** — y un click ahí mandaba `personaId` de A con DNI de B, colgándole la deuda
a un inocente. Se guarda el par (DNI consultado + persona) y el cartel es estado **derivado**.

Abre **T-24-N2-N1** a **T-24-N2-N4**.

---

## T-24-N2-N1 · El DNI se guarda sin normalizar, y el aviso no salta justo para la cartera vieja

**Experto:** BE + DATA · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: ✅ HECHA** — commit `ffaf8ab`. Normalizador único en `lib/normalizar-dni.ts` (gemelo del de email de T-23-N2), aplicado en la dedup, la importación y el buscador —que consulta las dos formas hasta que corra el backfill—. **Migración sin aplicar:** `20260819160000_dni_persona_solo_digitos`; se saltea a propósito las fichas que al normalizar colisionarían contra el unique, porque son duplicados que hay que **fusionar a mano** (tienen contratos y pagos colgando) y trae la consulta para listarlos. **No recorta CUIT a DNI**: sería adivinar y podría fusionar dos personas distintas. 6 tests puros verificados en rojo; 215 puros en verde.
**Origen:** revisión adversarial de T-24-N2. Lo encontraron dos lentes por separado.

**Estado verificado.** Nadie normaliza el DNI del lado que **escribe**:
- `persona.ts:28` — `buscarOCrearPersona` hace `(d.dni ?? '').trim()` y nada más, y después
  `findUnique` exacto (`:31-35`).
- `importacion-cartera.ts:84-86` — `texto()` es `String(v).trim()`; se usa para el DNI en `:144`.
- Y `:30` declara **`cuit` y `cuil` como sinónimos** de la columna DNI.

O sea: una planilla con `20.123.456` deja `Persona.dni = "20.123.456"`, y una con CUIT deja
`20123456789`. El campo del diálogo ahora normaliza a dígitos, así que **esas fichas no matchean
nunca**: ni el `contains` del endpoint las trae, ni `buscarOCrearPersona` las une. Se crea una
Persona duplicada.

**Por qué importa más de lo que parece.** Son justo las fichas viejas —las que Camila quería que
el sistema reconociera— y ahora la **ausencia** del cartel se lee como "esta persona no está en
tu cartera", que es una afirmación nueva y falsa.

**Qué hay que hacer.** Normalizar el DNI a dígitos en la escritura (`persona.ts` y la
importación), y un backfill de los ya cargados. **Cuidado:** toca la dedup de los tres caminos de
alta y no hay un solo test puro sobre `buscarOCrearPersona`. Escribir los tests primero.

**Criterio de aceptación.** Una ficha importada como `20.123.456` matchea al tipear `20123456`, y
no se duplica.

---

## T-24-N2-N2 · El DNI viaja en la query string y queda en el log de producción

**Experto:** SEC · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** revisión adversarial de T-24-N2.

**Estado verificado.** El serializer de Fastify loguea `req.url` entera y redacta **sólo**
`token`/`access_token` (`apps/api/src/app.ts:88-90`). Cada búsqueda escribe
`GET /personas?q=20123456` en texto plano en el log de Railway.

El patrón ya existía con el autocomplete del alta (`contratos/nuevo/page.tsx:915`), pero ahí `q`
suele ser un nombre; acá es **sistemático y siempre un documento**. Cargar los ~50 morosos de
Camila deja 50+ DNIs en el log, más los reintentos por cada corrección de tipeo.

**Qué hay que hacer.** Sumar `q` al regex de redacción de `app.ts:90`. Es una línea.
**No se hizo en T-24-N2** porque `app.ts` es de los archivos que toca T-24-N1.

**Criterio de aceptación.** Un `GET /personas?q=20123456` aparece en el log con el valor redactado.

### ✅ RESUELTO — commit `918598b`

Relevado antes de tocar: **`q` es el único parámetro de query con datos personales hoy** (lo que
parecía `email`/`telefono` en query era un schema de body).

Pero esto es una **denylist**: sólo redacta lo que alguien se acordó de agregar, y ya falló una
vez —el DNI estuvo logueándose desde que existe la búsqueda de personas—. Por eso van también
`dni`, `cuit`, `email` y `telefono`, que hoy **no** viajan por query en ningún endpoint: que el
próximo nazca redactado en vez de nacer filtrando.

**La redacción se extrajo a `lib/redactar-url.ts`.** Viviendo inline en `buildApp` no era
testeable, y una regla de seguridad sin test es una regla que se rompe en el próximo refactor.

**12 tests puros**, y la mitad cubren lo que **NO** hay que redactar: un regex flojo se comería
`busqueda=` y `emailVerificado=`, y un log redactado de más es inservible para debuggear — que es
el otro modo de fallo de esto. Verificados en rojo volviendo a la lista vieja: 7 de 12 fallan.

---

## T-24-N2-N3 · El monto pegado del Excel se interpreta mal, en silencio

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** role play de la operadora al ejecutar T-24-N2.

**Estado verificado.** `cargar-deuda-historica-dialog.tsx` hace
`Number(monto.replace(',', '.'))`. Pegar `150.000` desde el Excel da **150**, y el resumen dice
"3 mes(es) de $150 cada uno" sin que nada avise. Con `150.000,00` el `Number()` da `NaN`, el
botón **Cargar deuda** se queda gris y **no dice por qué** — los meses sí tienen mensajes en
rojo, la plata no.

Es el formato en el que viene cualquier planilla argentina, en la pantalla que **crea deuda**.

**Qué hay que hacer.** Parsear el monto con el formato local (separador de miles `.`, decimal
`,`) y mostrar un error explícito cuando no se puede leer. Sumar el **total** al resumen: la
planilla dice "debía $450.000" y la pantalla pide el alquiler mensual, así que hoy no hay ningún
número cruzable contra el papel.

**Criterio de aceptación.** Pegar `150.000` carga 150000, y un monto ilegible dice qué está mal.

### ✅ RESUELTO — commit `e9d8bbd`

El diálogo pasa a usar `MoneyInput`, que es lo que ya usa el resto del panel.

**Pero `MoneyInput` tenía su propio bug, y afectaba a 13 archivos:** hacía `replace(/D/g, )` a
secas, así que `150.000,00` daba **15000000** y `150,50` daba **15050** — 100× de más, en
cualquier campo de plata del panel. Ahora aplica la misma regla que `parsearMonto` en el backend,
que es la fuente de verdad de montos del sistema: **el último separador decide** (1-2 dígitos =
decimal, 3 = miles).

El resumen muestra además el **total de la deuda**, que es lo único cruzable contra el papel (la
planilla dice "me debía $450.000" y la pantalla pide el mensual), y el botón gris ahora dice por
qué: los meses ya tenían mensaje en rojo, la plata no.

Verificado contra 9 formatos argentinos ejecutando la función real del archivo. El test
automatizado va con **T-32** (montar el runner en los fronts), que hoy no existe.

---

## T-24-N2-N4 · El moroso que se fue este mes no entra por ningún lado

**Experto:** PROD (define) + BE · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** role play de la operadora al ejecutar T-24-N2.

**Estado verificado.** Deuda histórica exige que la ventana esté **cerrada**: el tope del
formulario es el mes pasado y el endpoint rechaza con 400 si `fechaFin >= hoy`
(`core.ts:1333-1338`), derivando al alta normal. Pero el alta normal **rechaza una propiedad ya
alquilada**.

El inquilino que dejó de pagar en julio y se fue en agosto, con la propiedad ya realquilada, no
entra por ninguna de las dos puertas. Y es el caso **más frecuente** en una migración: la deuda
fresca es la que se está cobrando.

**Qué hay que hacer.** Decidir si el tope del histórico baja al mes en curso, o si el alta normal
admite un contrato terminado sobre propiedad ocupada. Es decisión de producto: el guard existe
para que no se pueda crear un contrato paralelo sobre una propiedad ocupada y esquivar el 409.

**Criterio de aceptación.** Camila carga la deuda de alguien que se fue este mes sin inventar
fechas.

### ✅ RESUELTO — commit `e9d8bbd`

El tope pasa del mes PASADO al mes EN CURSO, en los tres lugares (el endpoint, la validación de
la importación y el formulario).

**El guard original era mío y era demasiado estricto.** El miedo era que alguien usara la deuda
histórica para crear un contrato paralelo sobre una propiedad ocupada y esquivar el 409 del alta.
Revisado, no se sostiene: un contrato histórico nace FINALIZADO, no reclama la propiedad y el cron
no lo devenga, así que no puede funcionar como contrato en curso.

Lo que sí hay que impedir es cobrar meses que todavía no pasaron —eso sería inventar plata— y eso
se sigue rechazando. **El corte ahora es el mes, no el día.** Si el vencimiento del mes en curso
todavía no llegó, la cuota nace PENDIENTE en vez de VENCIDO y se comporta como corresponde.

---

## T-25 · Cambio rápido de usuario en la misma máquina

**Experto:** SEC + FS · **Prioridad:** 🟠 · **Depende de:** decisión ya tomada (ver abajo)

**Qué pidió Camila.** Lo pidió **dos veces** — ya lo había planteado en la reunión del 22/07 y
volvió a insistir el 03/08 con un video:

- `[1:06:31]` *"Entré con mi mail, me sale [pedir] la clave, mandate el código, meto mi mail y
  yo te doy el código… Ah, no tenemos lo de los usuarios, el cambio de usuario."*
- `[1:07:47]` *"Esto te lo tiré yo la vez pasada."*
- `[1:08:01]` *"Nosotros ahí al lado lo dejaron [con] tu usuario. Yo aprieto un botoncito arriba
  y cambio el usuario a la otra, y se va poniendo la cajera, el administrador, todo, y entra con
  un usuario y contraseña que son cinco dígitos."*
- `[1:09:29]` *"Tenemos una sola impresora y por ahí hay cosas que yo hago desde mi clave en la
  otra máquina."*

Alan `[1:09:37]`: *"Acabo de ver el video, ya te entendí perfecto. Lo tenía pensado diferente,
así que vamos igual así como lo tenés."*

**Estado verificado — la infraestructura está intacta.** Las columnas siguen en el schema
(`Usuario.pinHash`, `pinIntentosFallidos`, `pinBloqueadoHasta`, ~`schema.prisma:761`),
`POST /auth/pin` sigue vivo (`auth.ts:660`) y `verificarPinUsuario` (`auth/pin.ts:11`) es un
kill-switch de una línea que hoy **siempre aprueba**.

**⚠️ Conflicto con una decisión LOCKED — ya resuelto.** `05-DECISIONES.md §7` dice que el PIN se
eliminó de toda la plataforma el 05/07 y que **no hay que re-agregarlo**.
**El owner decidió (19/08): el PIN vuelve ÚNICAMENTE como credencial del conmutador de
usuarios.** Ninguna acción de plata vuelve a pedir PIN. Hay que **actualizar
`05-DECISIONES.md`** para que la próxima sesión no lo "des-arregle".

**Qué hay que hacer.**
1. Actualizar `05-DECISIONES.md §7` con el alcance nuevo.
2. Revivir `verificarPinUsuario` **sólo** para el endpoint del conmutador, dejando el resto
   pass-through.
3. Endpoint de cambio de usuario: valida PIN de 5 dígitos y emite el JWT del otro usuario.
4. UI: botón en la topbar con la lista de usuarios del tenant.
5. **Lockout anti-fuerza-bruta de verdad.** Las columnas existen y hoy no las escribe nadie.
   Un PIN de 5 dígitos son 100.000 combinaciones: sin contador de intentos **por usuario** no
   sirve.

**Criterio de aceptación.** En la misma máquina, Camila cambia de usuario en dos clicks + PIN,
sin cerrar sesión ni pedir OTP, y cada sesión ve lo que le corresponde a su rol.

**Riesgo.** ⚠️ **Alto, es de seguridad.** Tres cosas que hay que cuidar:
- **Aislamiento de sesiones**: varios JWT en el mismo browser. Cómo se guardan, cuál está
  activo, y que cambiar de usuario **no filtre datos cacheados** del anterior (el QueryClient
  hay que destruirlo — la PWA ya hace esto en el switcher de alquileres con un hard nav).
- **El PIN es una credencial débil por diseño.** Sólo puede habilitar el cambio **entre usuarios
  del mismo tenant** en un dispositivo ya autenticado. Nunca puede ser un login desde cero.
- **Lockout**, ver arriba.

---

# BLOQUE H — Salud del proyecto

> No salieron de la reunión, pero **bloquean o distorsionan** todo lo demás. Van acá para que no
> se pierdan.

---

## T-26 · Rotar la credencial de producción que está en el repo

**Experto:** SEC + OPS · **Prioridad:** 🔴 · **Depende de:** nada

> **⛔ La reverificación del 19/08/2026 era FALSA, y decía justo lo que hacía falta para que
> nadie tocara nada.** Afirmaba que "el árbol de trabajo ya está limpio" y que "alguien la
> sacó". Nadie la sacó. Verificado el 20/08/2026 contra `origin/main`: la contraseña seguía
> en **CINCO** archivos trackeados, no cuatro —`README.md:24`, `PROJECT.MD:42`,
> `00-ESTADO.md:51`, `05-DECISIONES.md:95` y el que la ficha ni mencionaba,
> `historico/PROMPT-DEV-SENIOR.md:387`—. Y `git log -S` sobre cada uno devuelve **un solo
> commit**: el que la introdujo. Nunca hubo un commit que la quitara.
>
> **Ya está sacada del árbol** (20/08/2026, en esta rama), los cinco archivos.
>
> Los otros hallazgos del barrido de los 867 archivos sí eran correctos: la contraseña del
> **tenant demo** (`@delsol.com`, fixture deliberado y documentado en `prisma/seed.ts`, usado
> por ~64 tests) y dos líneas que dicen explícitamente *"la contraseña la tiene Alan"* /
> *"password en Railway — NO está en el repo"*.
>
> **Lo que sigue abierto es lo que de verdad importa, y son dos cosas distintas:**
>
> 1. **ROTAR. Sigue siendo obligatorio y es lo primero.** Sacarla del árbol no la invalida. El
>    repo **estuvo público** con la contraseña adentro: hay que darla por comprometida, punto.
>    Esto lo hace el dueño; ningún agente toca credenciales de producción.
> 2. **El historial de git la sigue teniendo.** Verificado: **22 líneas con credencial aparente
>    en 20 combinaciones commit × archivo** de `README.md`, `PROJECT.MD`, `00-ESTADO.md` y
>    `05-DECISIONES.md`. `git show <sha>:<archivo>` la devuelve hoy.
>    Ese conteo es de cuatro archivos: `historico/PROMPT-DEV-SENIOR.md` no estaba en el
>    barrido, así que el número real es mayor.
>
> **Sobre purgar el historial: es secundario, y conviene decir por qué.** Reescribir la historia
> (filter-repo / BFG) no des-filtra algo que ya fue público: si alguien clonó, ya la tiene. Y el
> costo acá es alto — hay una decena de worktrees y ramas sin mergear en vuelo, y un rewrite las
> invalida a todas. **Recomendación: rotar primero (eso cierra el riesgo real), y recién con las
> ramas mergeadas evaluar si el rewrite vale la pena.** No lo hago por mi cuenta: reescribir
> historia es destructivo y necesita tu OK explícito.

**Estado original (quedó desactualizado).** El usuario y la contraseña del admin del tenant real
estaban **en texto plano** en cuatro archivos versionados: `README.md:24`, `PROJECT.MD:42`,
`work-agent/00-ESTADO.md:39` y `work-agent/05-DECISIONES.md:95`. **El repo estuvo público.**

**Qué hay que hacer.**
1. **Rotar la contraseña** (esto primero, lo demás es secundario).
2. ✅ **HECHO (20/08/2026).** Sacar la línea de los archivos — eran **cinco**, no cuatro.
3. Decidir qué hacer con el historial de git, donde va a seguir viva aunque se borre del working
   tree.

**Criterio de aceptación.** La contraseña vieja no sirve y no queda ninguna credencial viva en
archivos trackeados. **La segunda mitad está cumplida; la primera no**: mientras la contraseña
no se rote, sigue sirviendo. Y rotarla es lo único que cierra el riesgo real.

---

## T-27 · Arreglar la CI y descongelar la demo

**Experto:** OPS · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: 🟡 PARCIAL** — commit `3a9db72`.

> ### ✅ La CI está roja por una razón que ya no existe — verificado el 19/08
>
> Se fue a buscar el error real en vez de suponerlo. `gh run view` sobre la última corrida
> (`30922987572`, **4 de agosto**) da esto:
>
> ```
> Error: Page "/inquilinos/[id]" is missing "generateStaticParams()"
>        so it cannot be used with "output: export" config.
> ```
>
> **Ese error ya está arreglado**: `apps/inmobiliaria/src/app/(app)/inquilinos/[id]/page.tsx:16`
> exporta `generateStaticParams` desde el commit `3a9db72` de esta misma tarea.
>
> **Entonces la CI no está rota: está VIEJA.** Las cinco corridas que figuran en rojo son todas
> anteriores al fix, y **nadie pusheó desde el 4 de agosto** — todo el trabajo de estas semanas
> vive en ramas locales. El próximo push debería ponerla en verde sin tocar nada.
>
> **Lo que hay que hacer no es debuggear: es pushear y mirar.** Si vuelve a fallar, ahí sí hay
> algo nuevo, y el comando para verlo es
> `gh run view $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --log-failed`.
>
> ### El `opengraph-image` es (casi seguro) sólo de Windows
>
> El build local del panel falla en `/(landing)/inicio/opengraph-image` con `TypeError: Invalid
> URL` adentro de `@vercel/og`, sobre una ruta `file:///C:/Users/...`. Varios `estado.md` lo
> anotaron como "el build está roto".
>
> **No lo está.** El build local **compila, typechequea y genera las 74 páginas**; falla sólo al
> exportar esa ruta, y el error es una ruta de Windows en `fileURLToPath`. La CI corre en
> `ubuntu-latest` (`.github/workflows/deploy.yml:19`).
>
> ⚠️ **No está probado en Linux**: la corrida de CI murió antes, en el error de
> `generateStaticParams`, así que nunca llegó a esa ruta. Es una hipótesis fuerte, no un hecho.
> El push que destrabe la CI lo va a responder solo.
>
> ### Estado de los tres builds sobre la rama unida
>
> | App | Resultado |
> |---|---|
> | `inquilino` | ✅ build limpio |
> | `inmobiliaria` | ✅ compila y genera 74/74 páginas · sólo falla el `opengraph-image` de arriba |
> | `propietario` | ⚠️ no se pudo: `check-dev-port` lo frena porque hay un dev server vivo en el 3002 (de otro chat). **No es un problema de código** |
El bloqueante documentado está arreglado y **verificado corriendo el script real de la CI**:
antes moría recolectando page data, ahora genera las 74 páginas.
Dos cosas quedaron abiertas y están en `work-agent/.tareas/T-27/estado.md`:
1. **Endurecer la CI (typecheck/lint) exige editar `.github/workflows/`, y eso lo prohíbe
   05-DECISIONES §5** (el gh token no tiene workflow scope: el push fallaría). El YAML propuesto
   quedó escrito para que lo aplique el dueño a mano.
2. **Apareció un segundo bloqueante que estaba tapado** detrás del primero: la ruta
   `opengraph-image` de la landing falla al prerenderizar (`Invalid URL` en `@vercel/og`).
   Parece específico de Windows y la CI corre en ubuntu, pero no es verificable desde acá.

   > **Confirmado el 19/08 desde otra sesión — es Windows, con causa raíz.** El paquete hace
   > `fileURLToPath(join(import.meta.url, "../noto-sans-v27-latin-regular.ttf"))`
   > (`@vercel/og/index.node.js:18988`): le pasa una **URL** a `path.join`. En Windows eso
   > convierte las barras y devuelve `file:\C:\...`, que no es una URL válida → `Invalid URL`.
   > En POSIX el mismo `join` deja `file:/...`, que Node **sí** acepta. Por eso rompe local y
   > no en ubuntu.
   >
   > **Prueba empírica:** sacando temporalmente `opengraph-image.tsx` y corriendo
   > `bash scripts/build-static.sh` sobre `tmp/integracion`, el build **termina con exit 0** y
   > genera `out/` completo (las dos apps, 74 páginas). Con el archivo puesto, muere sólo en
   > esa ruta. O sea: no hay ningún otro bloqueante escondido detrás.
   >
   > **Para quien buildee en Windows:** no es un bug del repo y no hay que "arreglarlo" tocando
   > la landing. Si necesitás el build local completo, sacá ese archivo mientras dure la prueba
   > y volvé a ponerlo.

**Estado verificado.** La CI está en rojo hace **44 días**. Último run verde: `46dc274`,
05/07/2026; desde entonces ~40 corridas seguidas en `failure`. La causa es una sola línea:

```
Error: Page "/inquilinos/[id]" is missing "generateStaticParams()"
       so it cannot be used with "output: export" config.
```

`apps/inmobiliaria/src/app/(app)/inquilinos/[id]/page.tsx` **nunca la tuvo**; sus cinco
hermanas (`consorcios/[id]`, `contratos/[id]`, `propiedades/[id]`, `propietarios/[id]`,
`reclamos/[id]`) sí.

**Por qué importa.** El único workflow es el build de la demo de GitHub Pages, así que **la
demo pública está congelada en el estado del 05/07**. Y esa demo es **el único canario del modo
`apiEnabled === false`**: todo lo que los docs repiten como *"demo intacta / ambos modos andan"*
no se verifica desde entonces.

**Qué hay que hacer.**
1. Copiar el `generateStaticParams` de cualquiera de las hermanas (~6 líneas).
2. Verificar que la demo vuelve a publicarse.
3. **Aparte y más importante**: la CI **no corre tests, ni typecheck, ni lint, ni build del
   backend**. Los scripts `pnpm typecheck` y `pnpm lint` existen y ningún workflow los invoca.
   Agregarlos es una tarea chica con un retorno enorme.

**Criterio de aceptación.** La CI en verde, la demo actualizada, y typecheck + lint corriendo
en cada PR.

---

## T-28 · Cubrir con tests los flujos de plata que no tienen ninguno — 🟡 PARCIAL

> ## ⚠️ El motivo por el que esta tarea se abandonó era FALSO — corregido el 20/08
>
> El `estado.md` de T-28 dice que los 5 endpoints no se pudieron testear porque los tests
> *"pegan a la Postgres de producción"*. **No es cierto**, y es la misma afirmación que
> contaminó ~10 archivos del repo. `docs/TESTING.md` dice lo contrario: prod corre con host
> interno de Railway, **inalcanzable** desde una máquina de trabajo.
>
> Y desde el 19/08 existe `docker-compose.test.yml`: una Postgres local, efímera, que no
> comparte nadie. **Verificada el 20/08 y funciona**: levanta, las 57 migraciones aplican desde
> cero, y el suite completo corre —94 archivos, 786 tests, 22 minutos, **780 en verde**—. Era
> justo lo que `docs/TESTING.md` pedía que alguien confirmara.
>
> O sea: **la cobertura de integración nunca estuvo bloqueada.** Continúa en **T-28-N1**, que ya
> cerró `/cargos/:id/descobrar` y encontró ahí un bug de plata vivo en producción.

**Experto:** QA + BE · **Prioridad:** 🟠 · **Depende de:** T-27

**Estado verificado.** 64 archivos de test, **todos** en `apps/api/test/`. **Cero tests de
front** en los dos Next apps — lo admite el propio autor en `26fdfa6`: *"El del doble click es
de front y se verificó en navegador, porque apps/inmobiliaria no tiene suite."*

Flujos de plata **sin cobertura** (grep de rutas dentro de `apps/api/test/*.ts`):

| Endpoint | Por qué duele que no tenga test |
|---|---|
| `GET /caja/cierre` | Es el cierre diario. Ya tuvo dos bugs: excluir `PROPIETARIO_DIRECTO` (B1) y el redondeo a centavos (B3) |
| `POST /internal/cron/devengar` | Es el que factura a **todos** los tenants. El cazabug AC fue justo ahí: un contrato con datos malos dejaba sin facturar a todas las inmobiliarias |
| `POST /cargos/:id/descobrar` | El `saldar` sí está cubierto; el deshacer no |
| `GET /mis-cargos` | La deuda por cargos que ve el inquilino |
| `GET /aprobaciones` | **Recién modificado en esta rama** (T-07 / commit `89132c9`) |

**Qué hay que hacer.** Tests para esos cinco, priorizando los dos primeros. Y **tests puros**
(sin DB) para lo nuevo de esta rama: `alquilerCobradoSinRendir` (`lib/rendicion-pendiente.ts`)
tiene aritmética de plata y hoy no tiene ninguno — conviene extraer la parte pura y testearla,
como ya se hizo con `computarLiquidacionesContrato`.

**Criterio de aceptación.** Los cinco endpoints tienen test, y la aritmética nueva tiene test
puro corrible sin base.

---

---

---

## T-28-N1 · Cerrar la cobertura de plata que T-28 dejó afuera — ✅ HECHA 20/08

**Experto:** QA + BE · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** continuación de T-28, cuyo motivo de abandono era falso (ver arriba).

Se verificó que la base de test efímera funciona, se corrió el suite completo por primera vez en
meses (780/786 en verde) y se cubrió `POST /cargos/:id/descobrar` — donde apareció **un bug de
plata vivo en producción**, con su fix.

**El bug.** `saldar` registra un `MovimientoCaja` de tipo `INGRESO_EXTRA` al marcar un cargo como
cobrado. **`descobrar` limpiaba `saldadoAt` y no lo tocaba.** Lo que lo volvía caro es que el
comentario que justificaba esa asimetría —*"la rendición filtra `tipo: 'GASTO'`, así que un
INGRESO_EXTRA no le altera la liquidación al dueño"*— **fue cierto y dejó de serlo**: hoy la
rendición levanta `tipo: 'INGRESO_EXTRA'` con `descontadoEnRendicion: false` y **se lo acredita
al propietario**.

- **Cobrado → Deshacer:** el inquilino vuelve a deber la plata **y** al dueño se le acredita igual.
- **Cobrado → Deshacer → Cobrado:** **dos** ingresos por una sola cobranza, los dos rendibles.
  Una reparación de $180.000 se le rinde dos veces.

El camino no es raro: el corte anti-doble-cobro de `imputarCostoReclamo` **manda al operador a
deshacer** para poder reimputar, y el botón está a un click de *Cobrado*.

**El fix.** Borrar el movimiento en la misma transacción que limpia `saldadoAt`. Si esa plata ya
se le rindió al propietario → **409** sin tocar nada (borrarlo dejaría a la rendición apuntando,
por `IngresoRendido.refId`, a una fila inexistente). Se miran las **dos** señales de rendido:
`descontadoEnRendicion` y el ledger — en multi-dueño la marca recién se pone cuando las partes
cubren el total, así que un movimiento rendido a medias sólo lo delata el ledger.

**Sin cambios de front:** `cargos-contrato-card.tsx` ya muestra `e.message` en un toast y
`apiFetch` propaga el `message` del server. Verificado, que es justo lo que T-40 y T-43 tuvieron
que arreglar dos veces.

**Tests.** `apps/api/test/descobrar-cargo.test.ts`, 5 casos. **Verificados por mutación**: con el
fix revertido y base limpia, 4 se ponen en rojo; el quinto pasa en los dos casos porque no
ejercita el bug. Detalle en `work-agent/tareas/T-28-N1/estado.md`.

---

## T-28-N1-N1 · `MovimientoCaja` no tiene `cargoId`: el vínculo con el cargo es un string

**Experto:** BE + DATA · **Prioridad:** 🟠 · **Depende de:** decisión del dueño (schema)

> ### El daño está CONFIRMADO, y es plata — verificado el 20/08 (commit del test)
>
> Se escribieron los dos casos contra la base efímera, en `test/descobrar-cargo.test.ts`.
>
> **Mientras ninguno se rindió, no pasa nada.** Los dos ingresos son fungibles: borrar
> cualquiera deja el mismo estado —un ingreso vivo, un cargo cobrado y uno adeudado— y las
> cuentas cierran. Ese caso **pasa hoy**, y la prioridad no sube por él.
>
> **Dejan de ser fungibles apenas UNO se rinde.** Ahí tienen historias distintas y la
> descripción no alcanza para saber cuál es cuál. Si se cobran los dos, se le rinde al
> propietario el ingreso del primero y después se deshace ESE cargo, `descobrar` encuentra el
> más reciente —el del segundo, sin rendir— y lo borra. Queda **el primer cargo como deuda del
> inquilino otra vez Y el ingreso rendido vivo, acreditado al propietario**: exactamente la
> consecuencia que el encabezado de ese archivo llama la cara. De yapa el segundo cargo queda
> cobrado sin movimiento detrás, así que deshacerlo devuelve un 409 que miente.
>
> Medido, no razonado: el test da **`expected 200 to be 409`**. Lo correcto sería frenar desde
> el principio, porque el ingreso de ese cargo ya se rindió.
>
> El caso está commiteado como **`it.fails`** — el criterio de aceptación, listo para el día que
> se decida. **Al agregar `cargoId`, ese test empieza a fallar: hay que sacarle el `.fails`.**
**Origen:** T-28-N1, al arreglar `descobrar`.

`saldar` crea un `INGRESO_EXTRA` por el cargo cobrado y `descobrar` ahora lo borra. Pero **no hay
FK**: el único vínculo es el TEXTO de la descripción (`Cobro de cargo al inquilino: <concepto>`).
El fix acota por contrato + tipo + monto + moneda y borra uno solo, lo cual es correcto en el
caso normal.

**Dónde falla:** dos cargos con el **mismo concepto, mismo monto y misma moneda** en el mismo
contrato son indistinguibles. Deshacer uno puede borrar el movimiento del otro.

**Qué hay que hacer.** `cargoId String?` con FK a `CargoContrato` en `MovimientoCaja`, escribirlo
en `saldar`, matchear por ahí en `descobrar`. Es **cambio de schema** y CLAUDE.md §0 obliga a
consultarlo: por eso T-28-N1 no lo tomó por su cuenta.

**Criterio de aceptación.** Dos cargos idénticos en concepto/monto/moneda sobre el mismo
contrato: cobrar los dos, deshacer uno, y que quede vivo exactamente el movimiento del otro.

---

## T-28-N1-N2 · `multi-alquiler.test.ts` está en rojo, y no es contaminación de estado — ✅ RESUELTO

> ### ✅ Arreglado el 20/08 en T-01-N1-N1. La pregunta abierta acá tiene respuesta.
>
> El diagnóstico de abajo es correcto hasta donde llega, y la pregunta que deja —*"a qué queda
> enganchado el contrato de la segunda persona"*— se contestó: **queda enganchado a la PRIMERA**.
> Era la peor de las dos salidas que el propio texto anticipaba.
>
> **La causa.** `buscarOCrearPersona` (`lib/persona.ts`) devuelve la Persona existente cuando el
> email coincide y el DNI no. No es un descuido: lo necesita la importación de cartera, donde
> reventar con P2002 a mitad de 2000 filas deja la carga hecha a medias en la cuenta real del
> cliente, y donde el preview ya marca el caso como advertencia. Por eso nunca hubo P2002: el
> insert que lo dispararía no llega a ocurrir. Al compartir ese helper con el alta manual, el
> `catch` de P2002 quedó **inalcanzable**.
>
> **El arreglo** (commit `dd78755`): un chequeo explícito en el alta manual —`esOtraPersona`,
> que sólo afirma cuando hay DNI de los dos lados y difieren— que tira `EmailDeOtraPersona` y
> cae en el mismo 409. **No se tocó el camino de importación**, que sigue como estaba a
> propósito. Ante la duda no bloquea: sin DNI de alguno de los dos lados, deja pasar.
>
> Verificado: el test pasa aislado contra una base creada desde cero, y hay 5 tests puros sobre
> `esOtraPersona` que corren en el job que SÍ bloquea.


**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** T-28-N1, primera corrida del suite completo contra una base real.

**Estado verificado el 20/08.** Falla **en una base creada desde cero**, corriendo el archivo
solo: no es residuo de correr 94 archivos en fila.

El caso es *"otra persona (DISTINTO DNI) con el MISMO email → 409"*. Crea un contrato para una
persona con DNI distinto y el email de otra, y **espera 409**. La API devuelve **200**.

**Lo verificado, para no volver a averiguarlo:**
- El índice único **existe** en la base: `personas_inmobiliariaId_email_key`.
- El guard que devuelve ese 409 **existe** y vive dentro de `POST /contratos`
  (`routes/core.ts:1505-1511`), pero es un `catch` de **P2002**: sólo dispara si la base rechaza
  el insert.
- No hubo P2002. Después de correr el test, **una sola** `Persona` tiene ese email (la primera):
  la segunda persona **nunca se creó**.

O sea que el handler no llega a chocar contra el unique. Falta averiguar a qué queda enganchado
el contrato de la segunda persona, y **las dos salidas posibles son defecto**: o queda bajo la
identidad de login de un tercero (que entonces ve un contrato ajeno), o queda sin `Persona` y ese
inquilino no puede entrar nunca.

**No se arregló en T-28-N1** porque no es su tarea y porque el arreglo depende de qué se decida
que debe pasar. Lo que no puede quedar es el test en rojo sin dueño.

---

## T-28-N1-N3 · Quedan 3 endpoints de plata sin cobertura, y ahora sí se pueden testear — 🟡 2 de 3

> ## ✅ Hechos 2 de los 3, y **sin Docker** — 20/08
>
> Se pidió expresamente no usar Docker, así que no hubo tests de integración. No importó tanto:
> los dos riesgos más caros son **aritmética y orquestación**, no base de datos.
>
> **`/caja/cierre`:** la aritmética salió del handler a `lib/cierre-caja.ts` y quedó con **15
> tests puros**, con las seis invariantes de plata fijadas (prorrateo, cap de la mora, guarda
> del 0/0, redondeo a centavos, buckets por moneda, flag `multiMoneda`). **Mutación 6/6.** De
> paso se borró la fórmula de comisión duplicada inline: ahora importa la compartida, lo que
> mete al cierre bajo `propietario-baja-logica.test.ts` gratis. El contrato del endpoint no
> cambia.
>
> **El cron de devengo:** el aislamiento de fallos —lo de mayor blast radius del repo, que ya
> dejó sin facturar a todos los tenants una vez— quedó con **5 tests puros**, usando un cliente
> Prisma falso. **Mutación 3/3.**
>
> **Falta `/mis-cargos`**, y lo que importa ahí es el aislamiento multi-tenant, que vive en el
> `where` de Prisma: no hay aritmética que extraer y un test puro no lo ve. Va a **T-28-N1-N3-N1**.

---

## T-28-N1-N3-N1 · Lo que sólo se ve con una base: `/mis-cargos` y los filtros del cierre — 🟡 los filtros ya no

> ## ✅ Los filtros del cierre SÍ se podían testear sin base — 20/08
>
> Esta ficha (la escribí yo) decía que los filtros *"viven en el `where` de Prisma: no hay
> aritmética que extraer y un test puro no lo ve"*. **Es falso.** Lo que no se puede sin base es
> verificar qué DEVUELVE Postgres; pero **construir el `where` es una función como cualquier
> otra**, y ahí es exactamente donde ocurrieron las dos roturas históricas: alguien borró un
> filtro.
>
> Se extrajo `whereCierreDelDia()` a `lib/cierre-caja.ts` y quedaron fijados los cuatro filtros
> —condonados, `PROPIETARIO_DIRECTO`, scope de inmobiliaria y `CONCILIADO`— más el **día civil
> argentino** y que el rango sea **semiabierto** (con `lte`, un pago exacto a las 03:00:00.000Z
> se contaría en los cierres de dos días). **12 tests, mutación 7/7.**
>
> Honestidad sobre el alcance: prueba **la consulta que armamos**, no lo que Postgres devuelve.
> No sustituye integración; agarra lo que pasó las dos veces, que es que alguien borre un filtro.
>
> **Sigue afuera `GET /mis-cargos`**, cuya garantía es el aislamiento multi-tenant: ahí no hay
> forma ni aritmética que valga fijar por separado, necesita integración de verdad.

**Experto:** QA · **Prioridad:** 🟡 · **Depende de:** una base de test (Docker o equivalente)
**Origen:** T-28-N1-N3, que cubrió todo lo cubrible sin base.

Dos cosas quedaron afuera **por ser filtros de query, no aritmética**:

1. **`GET /mis-cargos`** — el aislamiento multi-tenant: que un inquilino no vea cargos de otro
   contrato ni de otra inmobiliaria.
2. **Los filtros del `where` de `/caja/cierre`** — excluir `PROPIETARIO_DIRECTO`, excluir
   condonados, el aislamiento por inmobiliaria y el rango del **día civil argentino** (un pago
   conciliado a las 23:30 hora local tiene que caer en el arqueo de ESE día, no del siguiente).

**Ojo con la falsa sensación de cobertura:** la aritmética del cierre ya está cubierta y en
verde, pero **estos filtros no**, y dos de ellos —`PROPIETARIO_DIRECTO` y los condonados— ya
rompieron una vez, inflando el arqueo con plata que nunca entró a la caja.

**Experto:** QA + BE · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** T-28-N1.

De los 5 que listaba T-28: `descobrar` lo cerró T-28-N1 y `/aprobaciones` ya tenía. Faltan
**`GET /caja/cierre`**, **`POST /internal/cron/devengar`** y **`GET /mis-cargos`**.

**El bloqueo era falso** (ver T-28). Con `docker-compose.test.yml` corren en local. Los de mayor
riesgo, en orden:

1. **`/caja/cierre` — NaN silencioso.** Una liquidación con total 0 (SOLO_EXPENSAS sin expensas
   cargadas) vuelve `NaN` la comisión del pago, del acumulado y del total; `JSON.stringify` lo
   serializa como `null` y la cajera cierra el día sin comisión **sin que nada falle**.
2. **`/caja/cierre` — comisión sobre expensas.** Va sobre la porción de alquiler, no sobre
   `montoTotal`. Al 8%, ~$8.000/mes de más por contrato con expensas.
3. **`/internal/cron/devengar` — aislamiento de fallos.** Un contrato con datos malos ya dejó sin
   facturar a **todas** las inmobiliarias una vez. Hoy lo frena un try/catch por contrato que
   **ningún test ejercita**. Se cubre **sin base**, con un cliente Prisma falso: la orquestación
   es pura.


## T-29 · Los eventos de contrato que nunca se escriben

**Experto:** BE + PROD · **Prioridad:** 🟡 · **Depende de:** T-07 (hecha)
**Origen:** detectada al ejecutar T-07, no salió de la reunión.

**Estado verificado.** `TipoEventoContrato` tiene 8 valores: `CREADO`, `AJUSTE_APLICADO`,
`PAGO_RECIBIDO`, `PAGO_VENCIDO`, `RECLAMO_CREADO`, `COMUNICACION_ENVIADA`, `GARANTE_RENOVADO`,
`INTENCION_RENOVACION`. **Sólo se escribe uno**: `AJUSTE_APLICADO`, desde `core.ts:1793`
(renovación, reusando el valor por no haber uno propio) y `core.ts:2846` (ajuste de monto).

Ahora que el Historial se ve (T-07), el hueco quedó a la vista: el timeline de un contrato
muestra los ajustes y **nada más**. No aparece cuándo se firmó, cuándo se cobró, cuándo venció,
ni cuándo se abrió un reclamo — que es justamente lo que hace útil un expediente.

**Qué hay que hacer.**
1. Decidir con PROD **qué eventos merecen estar en el timeline del contrato**. Ojo: no es lo
   mismo que la auditoría (`EventoAuditoria`, que registra quién hizo qué en el sistema). Éste
   es el expediente del contrato, para mirar de un vistazo la vida de ese alquiler.
2. Escribirlos donde ya ocurren los hechos: alta del contrato, conciliación de un pago,
   vencimiento (en el barrido del cron), alta de reclamo, renovación (y agregarle su propio
   valor al enum en vez de reusar `AJUSTE_APLICADO`).
3. Cuidar el volumen: un evento por pago en un contrato de 36 meses son 36 filas. Está bien,
   pero hay que confirmar que el timeline pagine o acote.

**Criterio de aceptación.** El Historial de un contrato con vida real (firma, pagos, un ajuste,
un reclamo) cuenta esa historia sin huecos.

---

# Resumen para planificar

| Bloque | Tareas | Perfil dominante |
|---|---|---|
| **A — Cerrar lo hecho** | T-01 a T-05 | OPS, DATA, QA |
| **B — Terminar lo a medias** | T-06, T-07 | FE-P, FS |
| **C — Alta y carga** | T-08 a T-11 | FE-P, PROD, BE |
| **D — Pagos y caja** | T-12 a T-15 | FE-P, FE-I |
| **E — Notificaciones** | T-16 a T-18 | BE, FS |
| **F — Consorcio** | T-19 a T-22 | QA, PROD, FS |
| **G — Los tres grandes** | T-23 a T-25 | Arquitectura, SEC, FS |
| **H — Salud del proyecto** | T-26 a T-28 | SEC, OPS, QA |

### Las que abren camino (hacerlas primero)

- **T-04** bloquea todo el bloque D.
- **T-01 + T-02 + T-03** bloquean que Camila vea cualquier cosa de lo ya hecho.
- **T-26** no bloquea código, pero es una credencial viva en un repo que estuvo público.
- **T-19** es barata y desactiva un miedo que le está condicionando todo el resto del feedback
  sobre consorcios.

### Las que necesitan decisión de producto ANTES de escribir código

**T-10** (flujo unificado) · **T-11** (qué se puede editar) · **T-14** (parcial sí/no) ·
**T-17** (quién recibe qué) · **T-20** (comisión en sólo-expensas) · **T-23** (alcance y
monetización del portal) · **T-24** (dónde cuelga la deuda histórica).

### Lo que este documento NO cubre

Los riesgos del sistema que no salieron de la reunión —agujeros de plata, deuda técnica,
asimetrías entre los dos lados del mostrador— están en
[`07-ECOSISTEMA.md`](./07-ECOSISTEMA.md) §9. Varios son más graves que algunas tareas de acá y
merecen su propia planificación.

---

## T-30 · El mail sale de un `no-reply` y el copy invita a responderlo — ✅ HECHA

**Experto:** BE + PROD · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** role play de Camila al ejecutar T-16. No salió de la reunión.
**Resuelta** en `feat/T-30-mail-responde`. Se tomó la opción 1 (`replyTo`) en los cuatro mails
que son comunicación de la inmobiliaria —aviso de ajuste, anuncios, bienvenida al inquilino,
invitación al equipo— y el copy pasó a depender de que exista dirección: si no la hay, no
invita a responder. Los mails de la plataforma (los dos OTP y la bienvenida a la inmobiliaria)
siguen sin `replyTo` a propósito. De yapa: el pie compartido decía *"si no pediste este
código"* en TODOS los mails, incluido el aviso de aumento. Abre **T-30-N1** y **T-30-N2**.

**Estado verificado.** `apps/api/src/mailer.ts` usa
`from = process.env.SMTP_FROM ?? 'My Alquiler <no-reply@myalquiler.app>'`. Todos los mails
salen de ahí: OTP, invitaciones, anuncios y ahora el aviso de ajuste.

El problema es el copy. El aviso de ajuste cierra con *"si algo no te cierra, respondele a
&lt;inmobiliaria&gt; antes del próximo vencimiento"*, y `enviarAnuncioEmail` manda comunicaciones
de la inmobiliaria al inquilino. **El inquilino va a apretar Responder**, y esa respuesta se
pierde: no llega ni a la inmobiliaria ni a nadie.

En palabras de Camila: *"¿Responderle a dónde? Si el mail sale de no-reply, me van a contestar
ahí y no me va a llegar nunca."*

Es el mismo patrón que T-18: texto que promete un canal que no existe.

**Qué hay que hacer.** Elegir una de las dos:
1. **`replyTo` con el email de la inmobiliaria.** `InmobiliariaContacto` ya lo trae y varios
   mails lo muestran en el pie. Es una línea por envío y resuelve el caso real.
2. Si no se quiere exponer ese email, **cambiar el copy** para decir por dónde sí se contesta
   (teléfono, la app), y no invitar a responder el mail.

La 1 es mejor: la inmobiliaria QUIERE que le escriban, es su cliente.

**Criterio de aceptación.** Un inquilino que responde el aviso de ajuste le llega a su
inmobiliaria; o el texto no lo invita a responder.

---

## T-31 · El ajuste masivo manda un mail por contrato, sin throttle

**Estado: ✅ HECHA** — commit `b48ba58`. Cola con espaciado (`SMTP_GAP_MS`, default 400) para
los 5 envíos masivos, y **el OTP fuera de la cola**: con una FIFO compartida, un anuncio a 200
inquilinos dejaba el próximo login esperando el código ~80 s (regresión que introdujo la propia
cola, encontrada en el role play). El ajuste devuelve `avisoInquilino`, y el ajuste masivo lista
en un panel persistente a quiénes no les llega el aviso por falta de email. Un rebote de SMTP
queda como `EventoContrato` en el historial. **Además:** la renovación —tercer camino que cambia
el canon— tampoco avisaba; T-16 había cubierto solo los otros dos. Tests: `mailer-cola` (4) y
`mailer-otp-no-espera` (1), verificados por mutación.

**Deuda:** el rebote se registra con `tipo: COMUNICACION_ENVIADA` (el título aclara que falló).
Agregar `COMUNICACION_FALLIDA` al enum exige migración; hasta aplicarla en prod el insert
fallaría y el fallo volvería a ser invisible. Sumarlo junto a las migraciones de T-01.

**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** T-16 (hecha)
**Origen:** role play de Camila al ejecutar T-16. No salió de la reunión.

**Estado verificado.** Desde T-16 (`f2d3298`), cada ajuste dispara
`avisarAjusteAlInquilino` → un `sendMail` por contrato, secuencial pero **sin pausa**.

El caso real de Camila es ajustar veinte o más contratos el mismo día —los ajustes se agrupan
por índice y fecha—, así que salen veinte mails casi simultáneos desde la misma cuenta SMTP.
Sus palabras: *"si el servidor de correo me los rebota por spam, me quedo sin avisarle a nadie
y encima no me entero."*

**El proyecto ya resolvió esto una vez y no se replicó.** `enviarAnuncioEmail`
(`mailer.ts`) tiene la nota explícita: *"Un destinatario por email (nunca listas/BCC), pensado
para mandarse en loop secuencial con throttle (deliverability: parecer humano, no ráfaga)"*.

**Qué hay que hacer.**
1. Ver cómo dispara el ajuste masivo el panel: si son N llamadas al endpoint individual, el
   throttle va del lado del front; si hay un endpoint masivo, del lado del server.
2. Aplicar el mismo criterio que los anuncios.
3. **Y lo más importante: que un rebote no sea silencioso.** Hoy
   `avisarAjusteAlInquilino` se traga el error con un `log.warn` — correcto para no romper el
   ajuste, pero la inmobiliaria no se entera de que a diez inquilinos no les llegó el aviso.
   Debería quedar visible en algún lado (contador en la respuesta del ajuste masivo, o una
   marca en el contrato).

**Criterio de aceptación.** Ajustar 20 contratos manda los 20 avisos sin ráfaga, y si alguno
falla la inmobiliaria puede saber cuál.

**Riesgo.** Ninguno de plata. Es deliverability y visibilidad.

---

## T-33 · Un pago informado contra una cuota futura le congela el aumento para siempre

**Experto:** BE · **Prioridad:** 🔴 · **Depende de:** T-04 (bloqueante: toca el flujo de pagos)
**Origen:** relevamiento de T-14. No salió de la reunión.

**Estado verificado — a mano, los tres eslabones.** Informar un pago contra una liquidación de
un período **futuro** excluye a esa cuota del reajuste por aumento de forma **permanente**,
incluso si la inmobiliaria después lo rechaza.

1. `recomputarLiquidacionesFuturas` saltea toda cuota con `cantidadPagos > 0`
   (`apps/api/src/lib/liquidaciones.ts:366`).
2. Ese contador es `_count: { select: { pagos: true } }`, **sin filtro de estado**
   (`apps/api/src/routes/core.ts:3011`). Un `INFORMADO` o un `RECHAZADO` pesan igual que un
   `CONCILIADO`.
3. Rechazar **no borra** el `Pago`: lo pasa a `RECHAZADO`
   (`apps/api/src/routes/plata.ts:495-497`). El contador queda `> 0` para siempre.

Y `POST /pagos/informar` valida que la **fecha de transferencia** no sea futura
(`plata.ts:1186`), pero **no valida el período de la liquidación**: la busca por
`id + contratoId` y nada más (`plata.ts:1191`). `GET /mis-liquidaciones` devuelve las futuras con
su `id` (`plata.ts:1323-1326`).

**El escenario.** Un inquilino informa $1 contra la cuota del mes que viene. La inmobiliaria la
rechaza. Meses después se aplica el aumento por IPC: esa cuota **queda al alquiler viejo**, y
nadie se entera hasta que la cobra de menos.

**Por qué es 🔴.** Es plata que no se cobra, es silencioso, y sobrevive al rechazo — o sea que la
acción correctiva obvia de la inmobiliaria **no lo arregla**. Toca el mismo endpoint que T-16
(`PATCH /contratos/:id/monto`), así que cualquiera que trabaje ajustes lo va a rozar.

**Qué hay que hacer.**
1. Que el contador filtre por estado: sólo `CONCILIADO` (y quizá `INFORMADO`) debería frenar un
   reajuste. Un `RECHAZADO` **nunca**.
2. Validar el período en `POST /pagos/informar`: no se debería poder informar contra una cuota
   que todavía no venció (o al menos no contra una futura).
3. Decidir qué pasa con las cuotas ya congeladas en prod — hace falta una consulta.

### ⚠️ SON DOS SUPERFICIES, NO UNA — verificado el 19/08

El mismo defecto está **replicado en el camino de las expensas**. Quien arregle esto tiene que
arreglar las dos, o va a quedar la mitad:

| Camino | Función que saltea | Caller que no filtra |
|---|---|---|
| Ajuste del **alquiler** | `recomputarLiquidacionesFuturas` → `if (l.cantidadPagos > 0) continue` (`lib/liquidaciones.ts:366`) | `core.ts:3011` — `_count: { select: { pagos: true } }` |
| Cambio de **expensas** | `recomputarExpensasFuturas` → misma línea (`lib/liquidaciones.ts`) | `core.ts:3695` — mismo `_count` sin filtro |

Los dos callers piden `_count: { select: { pagos: true } }` **sin `where` de estado**, así que un
`RECHAZADO` pesa igual que un `CONCILIADO`. Resultado en el camino nuevo: informar $1 contra una
cuota futura y que se lo rechacen **le congela las expensas viejas a esa cuota, para siempre**.

Es el mismo arreglo en los dos lugares: filtrar el conteo por estado.

**Criterio de aceptación.** Informar y que te rechacen un pago sobre una cuota futura **no**
impide que esa cuota se reajuste después — **ni el alquiler ni las expensas**.

**Riesgo.** ⚠️ Toca el flujo de pagos **y** el de ajustes. Va después de T-04, y con test que
falle primero.

**No verificado.** Si la UI de la PWA expone alguna liquidación futura con link al checkout. Por
API es alcanzable con seguridad; por interfaz, sin confirmar. Eso cambia si es explotable por un
inquilino común o sólo pegándole al endpoint.

---

## T-34 · `payment-hero.tsx` es código muerto

**Experto:** FE-I · **Prioridad:** 🟢 · **Depende de:** T-04 (por prudencia: vive en la carpeta de pagos)
**Origen:** relevamiento de T-14.

`apps/inquilino/src/app/(app)/payment-hero.tsx` se exporta en `:29` y **no lo importa nadie**: la
única otra mención en todo el árbol es un comentario (`app/(app)/page.tsx:888`).

Dato de color que vale para T-14/T-19: ese componente abandonado ya colapsaba alquiler y expensas
en **una sola fila** ("Alquiler + expensas", `:147-150`) — o sea que la versión que se descartó ya
iba en la dirección que Camila terminó pidiendo.

**Qué hacer.** Borrarlo. Borrar un archivo que ningún módulo importa no puede cambiar
comportamiento, pero como vive bajo pagos conviene no meterlo en la misma pasada que otra cosa,
para que nadie tenga que discutir si cuenta como "tocar el flujo".

---

## T-35 · Los usuarios extra heredan la contraseña Y el PIN del admin

**Experto:** SEC · **Prioridad:** 🔴 · **Depende de:** nada · **BLOQUEA T-25**
**Origen:** modelo de amenazas de T-25. No salió de la reunión.

**Estado verificado — leído a mano, no inferido.**

`scripts/onboarding-real.mjs:98` crea cada usuario de `usuariosExtra` así:

```js
passwordHash: bcrypt.hashSync(u.password ?? A.password, 10),
pinHash:      bcrypt.hashSync(u.pin      ?? A.pin,      10),
```

Los dos `??` caen en las credenciales del **admin**. Si al script no se le pasa una contraseña
y un PIN propios para cada persona, **la cajera queda con la contraseña y el PIN de Camila**.
Y la validación de formato del PIN (`/^\d{4,6}$/`, `:46`) corre **sólo sobre `A.pin`**: al de los
extras no lo mira nadie.

Lo mismo en el seed de desarrollo: `PIN_DEV` se hashea una vez y se le pone a los tres usuarios
(`apps/api/prisma/seed.ts:13`, `:41`, `:51`).

### Por qué es 🔴 y no 🟠: el login por contraseña está VIVO

`POST /auth/login` (`apps/api/src/routes/auth.ts:109`) hace
`bcrypt.compareSync(body.data.password, usuario.passwordHash)` (`:114`). O sea que **esto no es
latente**: en cualquier tenant dado de alta con ese script sin contraseñas individuales, un
usuario de rol bajo puede entrar **hoy** como ADMIN, con una credencial que ya conoce porque es
la suya. Sin adivinar nada y sin dejar rastro de intrusión: para el sistema es el admin
logueándose.

El `pinHash` compartido hoy sí es inofensivo —nadie compara ese hash contra nada, porque
`verificarPinUsuario` siempre aprueba (`apps/api/src/auth/pin.ts:11-13`)—. **Pero T-25 convierte
`pinHash` en la credencial para convertirse en otra persona.** El día que eso entre, el PIN
heredado se vuelve un segundo camino de escalamiento.

### Lo que NO está verificado

**No sé si el tenant real se dio de alta con este script, ni si tiene `usuariosExtra` sin
contraseña propia.** No consulté producción: es owner-only y la instrucción es no tocar el
tenant real. **Puede que no haya ningún usuario afectado.** La consulta que lo responde, de sólo
lectura:

```sql
SELECT id, email, rol, activo,
       ("passwordHash" IS NOT NULL) AS tiene_pass,
       ("pinHash"      IS NOT NULL) AS tiene_pin
FROM usuarios
WHERE "inmobiliariaId" = '<tenant>'
ORDER BY rol;
```

> **Corrección.** La primera versión de esta consulta usaba `pin_hash` / `password_hash` /
> `inmobiliaria_id` y **habría fallado**: el modelo tiene `@@map("usuarios")` para la tabla pero
> las columnas **no** tienen `@map`, así que quedan en camelCase y hay que citarlas. Lo detectó
> el chat que ejecutó T-35.

Si dos usuarios de **roles distintos** comparten `password_hash`, está confirmado. (Los hashes
bcrypt de la misma clave difieren por el salt, así que comparar los hashes entre sí **no** sirve:
hay que probar la contraseña del admin contra el `password_hash` de un extra, o simplemente
asumir lo peor y rotar.)

### Qué hay que hacer

1. **Arreglar el script**: que `usuariosExtra` **exija** contraseña propia, o que se cree sin
   `passwordHash` (la cuenta entra por OTP, que es el camino que el propio código ya contempla en
   `auth.ts:141-143`). Y **nunca** poner `pinHash` desde el alta: que cada uno lo cree desde su
   sesión.
2. **Rotar** lo que haya quedado compartido en producción, si la consulta lo confirma.
3. **En la misma migración que habilite T-25**, limpiar los PIN heredados:
   `UPDATE usuarios SET pin_hash = NULL, pin_intentos_fallidos = 0, pin_bloqueado_hasta = NULL;`
   No se pierde nada —esos hashes nunca autenticaron nada— y es la única forma de garantizar que
   todo `pinHash` vivo lo escribió su dueño desde su propia sesión.
4. Sacar el `pinHash` del seed.

**Criterio de aceptación.** Dos usuarios distintos no pueden compartir credencial, y ningún
usuario nace con una credencial que no eligió.

**Riesgo de no hacerlo.** Escalamiento de privilegios silencioso. Es exactamente el escenario que
Camila describe en la reunión —una máquina, varias personas, roles distintos— pero al revés: en
vez de separar quién hace qué, hoy podría estar todo el mostrador operando con la misma llave.

---

### ✅ RESUELTO (código) — commit `310645c` · **quedan 3 acciones del owner**

Todo lo que afirmaba el relevamiento se verificó a mano y era cierto. **Dos cosas que no decía:**

- **Las invitaciones de equipo ya estaban bien** (`core.ts:2810`, `:2832`): sólo escriben
  `passwordHash` si viene contraseña. El agujero era exclusivo del script de alta.
- **La SQL de limpieza que proponía esta tarea estaba mal.** Usaba `pin_hash` y la columna real
  es `"pinHash"` (camelCase citado; el modelo no tiene `@map`). Habría fallado al correrla.

**El arreglo no es acordarse de pasar contraseñas.** La decisión se mudó a
`scripts/lib/credenciales-alta.mjs`, y esa función **no recibe al admin**: heredarle es imposible
por la forma, no por disciplina. Sin contraseña propia la cuenta queda con `passwordHash: null` y
entra por OTP —el camino que el producto ya eligió, porque `/auth/registro` hace lo mismo. Vive
separada del script para poder testearla: `onboarding-real.mjs` lee disco y abre una conexión a
la base al importarse.

El PIN no se escribe más desde el alta, para nadie. `admin.pin` se ignora **con aviso** en vez de
callado. Mismo criterio en el seed, donde los tres usuarios nacían con `1234`.

La contraseña compartida del seed **se dejó**, documentada como decisión de fixture: ~64 tests
loguean con ella como los tres roles, y esos tests no se pueden correr desde acá. Cambiarla a
ciegas era el riesgo mayor.

> **Corrección.** Antes esta línea decía que esos tests *"pegan a la Postgres de producción"*.
> **Es falso** y lo escribí yo en varios archivos. `docs/TESTING.md` dice lo contrario: prod
> corre dentro de Railway con host interno (`*.railway.internal`), inalcanzable desde una
> máquina de trabajo; el proxy público es la instancia de **test/dev**. El motivo real para no
> correrlos sigue en pie y es otro: esa instancia es **compartida** y el seed la destruye, y
> además `apps/api/.env` no existe en esta máquina.

**112 tests puros** (8 nuevos). El de la firma verificado en rojo reintroduciendo el `?? admin`.

**Lo que el código NO puede cerrar:** (1) averiguar si hay alguien afectado en el tenant real
—consulta de sólo lectura en `work-agent/.tareas/T-35/estado.md`—; (2) **rotar** lo que haya
quedado compartido, porque si el tenant se dio de alta así, esas cuentas tienen acceso ADMIN
**hoy**; (3) aplicar `20260819140000_limpiar_pines_heredados` **antes o junto con** la migración
de T-25 — si T-25 entra primero, hay una ventana en la que los PIN heredados autentican de verdad.

### Actualización post-deploy — 20/08/2026, 01:10 UTC

El punto (3) **ya está resuelto**: las dos migraciones entraron en el mismo deploy (`94d4000`),
así que la ventana nunca existió. `limpiar_pines_heredados` se aplicó a las 01:10:30.879 UTC y
**todos los `pinHash` de producción quedaron en NULL.**

**Qué evidencia se perdió y cuánto importa.** La pregunta *"¿quién tenía PIN heredado?"* ya no se
puede responder: el `UPDATE` borró justamente el dato que la contestaba. Alcancé a escribir una
migración que guardaba un censo previo (sólo booleanos, sin copiar hashes), pero el deploy salió
antes y **ya no sirve de nada**: la migración corre una sola vez, y para cuando el censo existiera
en el archivo, las filas que iba a censar ya estaban en NULL. Habría creado una tabla vacía.

Peor: ese cambio se pusheó por error a `main` y quedó un rato en el repo describiendo una tabla
que en producción nunca se creó. Se revirtió al contenido realmente aplicado. El detalle completo
—incluida una afirmación falsa que hice sobre checksums de Prisma— está en T-01.

**Cuesta poco, y conviene tener claro por qué:** ningún `pinHash` autenticó nunca nada
—`verificarPinUsuario` siempre devolvía `{ok:true}`—, así que el PIN heredado era un riesgo
*latente*, que era exactamente lo que la migración venía a desactivar antes de que T-25 lo
volviera real. No hubo acceso indebido que investigar por esa vía.

**Lo que sí importaba sigue intacto, y sigue abierto.** El escalamiento *vivo* nunca fue el PIN:
era la **contraseña**, porque `POST /auth/login` compara contra `passwordHash` y el script viejo
hacía `u.password ?? A.password`. La migración **no tocó `passwordHash`** —sólo `pinHash`,
`pinIntentosFallidos` y `pinBloqueadoHasta`—, así que:

- La evidencia que hace falta para responder la pregunta que importa **está entera en la base**.
- Y el riesgo también: **el fix protege las altas nuevas, no las viejas.** Cualquier tenant dado
  de alta con el script anterior puede seguir teniendo hoy usuarios con la contraseña del admin.

**Queda para el dueño** (puntos 1 y 2 de arriba, sin cambios): correr la consulta de sólo lectura
y rotar lo que aparezca. Un detalle para no sacar una conclusión falsa: **comparar los
`passwordHash` entre sí no prueba nada** —bcrypt salea cada hash, dos personas con la misma
contraseña tienen hashes distintos—. Hay que probar la contraseña del admin contra el hash del
otro usuario, y eso sólo lo puede hacer quien la tenga.

---

## T-43 · Tres avisos de reclamo esquivan la cola de mails

**Estado: ✅ HECHA** — los tres avisos de reclamo (`enviarReclamoNuevoInmo`,
`enviarReclamoAsignadoInquilino`, `enviarReclamoResueltoInquilino`) van por `enviarEnCola`.
Verificado: `grep -c "await t.sendMail({" apps/api/src/mailer.ts` devuelve **0** — ningún envío
esquiva los carriles. El guardarraíl `test/mailer-todos-por-la-cola.test.ts` lo mantiene así.

**Experto:** BE · **Prioridad:** 🟡 · **Depende de:** nada · **Vive en:** la integración, no en `feat/reunion-camila-0308`
**Origen:** revisión de integración de las ramas paralelas. No salió de la reunión.

**Estado verificado.** En `tmp/integracion`, las tres notificaciones de reclamos que trajo T-17
llaman al transporter **directo**, salteándose los dos carriles que puso T-31:

| Función | Línea en el mailer integrado |
|---|---|
| `enviarReclamoNuevoInmo` | `mailer.ts:894` |
| aviso de profesional asignado | `mailer.ts:930` |
| aviso de reclamo resuelto | `mailer.ts:960` |

No es culpa de nadie: T-17 y T-31 se escribieron **en paralelo**, en worktrees distintos, y la
rama de T-17 no podía saber que la cola existía. Es el costo previsible de trabajar en paralelo
sobre el mismo archivo — y de hecho la integración ya tuvo que *"reconstruir mailer.ts, que la
unión automática partió al medio"* (`2a86689`).

**Por qué importa igual siendo 🟡.** Un reclamo suelto no hace ráfaga. Pero T-31 existe porque
todos los mails salen de la **misma cuenta SMTP**, y tres envíos fuera de la serialización pueden
solaparse entre sí y con un ajuste masivo. Lo más importante no es el daño de estos tres: es que
el invariante *"todo envío pasa por un carril"* **se rompió tres veces en pocas horas y en
silencio**, porque la regla vivía sólo en un docblock.

**Ya está el guardarraíl.** `apps/api/test/mailer-todos-por-la-cola.test.ts` (en
`feat/reunion-camila-0308`) falla si aparece un `sendMail` fuera de `enviarEnCola` / `enviarYa`, y
nombra archivo y línea. Verificado contra el mailer integrado: **detecta los tres**. También
fija que `enviarYa` lo use **sólo** el OTP.

**Qué hay que hacer.** Al mergear, cambiar los tres `t.sendMail(` por `enviarEnCola(`. Son tres
líneas. El test dice cuáles.

**Criterio de aceptación.** `mailer-todos-por-la-cola` en verde sobre la rama integrada.

---

## T-44 · Dos líneas de integración divergentes, y ninguna tiene todo
**Estado: ✅ RESUELTA** — merge `ba2247a`.

Las dos líneas dejaron de existir: `git log HEAD..tmp/union` y `git log HEAD..tmp/integracion`
devuelven **0** las dos. Rescató los 8 arreglos que vivían sólo en `tmp/integracion` —la matriz
de permisos que prometía un circuito de aprobación inexistente, el historial que fallaba en
silencio, T-36/T-38/T-39–T-42— y `apps/propietario` entera quedó del lado bueno.

Verificado sobre el árbol ya mergeado: `tsc` en **0** en los cuatro paquetes y **317 tests** sin
DB en verde.

Un solo conflicto real (`evento-contrato.ts`), y resultó ser **el mismo hallazgo hecho dos
veces**: dos chats descubrieron por separado que el `try/catch` del historial mentía, porque en
Postgres un statement fallido aborta la transacción igual. Se combinaron las dos explicaciones.

Costó **cinco intentos**: el worktree principal casi nunca estaba limpio y la rama se movió
cuatro veces, una de ellas cambiando de nombre. El detalle está en
`work-agent/tareas/_integracion/`.

**Experto:** OPS + el dueño · **Prioridad:** 🔴 · **Depende de:** nada · **BLOQUEA EL DEPLOY**
**Origen:** revisión de integración. No salió de la reunión.

**Esto no es un bug: es una decisión que nadie tomó.** Hay **dos ramas de consolidación** y cada
una tiene trabajo que la otra no:

| Rama | Tiene en exclusiva |
|---|---|
| `feat/reunion-camila-0308` (la de trabajo) | **T-23 con la app `apps/propietario` ENTERA**, T-14, T-21-N1 (+N1/N2/N3), T-24-N1, T-24-N2, T-25, T-33, T-35 |
| `tmp/integracion` | T-08, T-11, T-17 (+N1), T-18 (+N1/N2), T-19, T-20, T-22, T-28, T-29, T-30 (+N1/N2) |

**Verificado:** `apps/propietario` **no existe** en `tmp/integracion`
(`git ls-tree -d --name-only tmp/integracion apps/`). Son **6.625 líneas** de producto ya escrito
y verificado en su rama que se caerían del deploy si se sale desde ahí
(`git diff --stat tmp/integracion...feat/reunion-camila-0308 -- apps packages`).

**Qué cuesta unirlas.** Ensayado con `git merge-tree`: **13 regiones en conflicto** en ~11
archivos. Tres son los archivos de plata, que es donde una resolución apurada hace más daño:

```
apps/api/src/routes/core.ts      apps/api/src/routes/plata.ts
apps/api/src/lib/liquidaciones.ts    apps/api/prisma/seed.ts
apps/api/src/routes/anuncios.ts      apps/inmobiliaria/src/lib/api/use-ajustes.ts
apps/inmobiliaria/src/app/(app)/caja/page.tsx
apps/inquilino/src/app/(full)/pago/[liqId]/{page-client,checkout/page-client}.tsx
work-agent/09-TAREAS-REUNION-CAMILA.md    work-agent/PROMPT-EJECUTAR-TAREA.md
```

**Qué hay que hacer.** Decidir **cuál es la línea de integración** y llevar todo ahí. No dejarlo
implícito: si nadie lo escribe, en dos semanas alguien va a asumir que el portal del propietario
se perdió en un merge. Después de unir hay que **re-revisar el conjunto**: la app del propietario
nunca se miró contra el resto.

**Criterio de aceptación.** Una sola rama contiene todas las tareas cerradas, con `tsc` en 0 y los
tests sin DB en verde, y está escrito en este documento cuál es.

---

## T-45 · El home de la PWA ignora el pago informado en modo demo

**Experto:** FE-I · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** revisión de integración.

**Estado verificado.** `BannerPagoPendiente` (`apps/inquilino/src/app/(app)/page.tsx:568-570`)
calcula el pago vivo así:

```ts
const pagoVivo = apiEnabled ? ((liq.pagos ?? []).find((p) => p.estado === 'INFORMADO') ?? null) : null;
```

En demo es **siempre `null`**, así que la rama ámbar *"Comprobante en revisión"* (`:599`) nunca se
alcanza y el home cae en *"Tenés un pago atrasado"* (`:671`) — a un inquilino que en el demo
acaba de informar el pago completo. El comentario dice *"en demo `liq.pagos` no existe (mocks) →
comportamiento igual"*, y no es igual: el pago demo existe, sólo que en `localStorage`.

**Ahora se nota más**, porque el detalle del pago **sí** quedó honesto en los dos modos (ver el
arreglo del recibo prematuro): el home dice "atrasado" y la pantalla a la que linkea dice "En
revisión". Dos verdades sobre la misma cuota.

**Qué hay que hacer.** Que en demo `pagoVivo` salga de `listarPagosDeLiq(liq.id)`, con lectura
hidratación-segura (el resto de la PWA ya usa ese patrón). **No se hizo en la misma pasada** para
no meter una lectura de `localStorage` en render dentro de un archivo que están tocando otros
chats.

**Criterio de aceptación.** En demo, después de informar el pago completo, el home dice
"Comprobante en revisión" y no "atrasado".


---

## T-30-N1 · El remitente sigue diciendo "My Alquiler", no la inmobiliaria

## T-30-N1 · El remitente sigue diciendo "My Alquiler", no la inmobiliaria — ✅ RESUELTO

> **Hecho, apagado por default.** El rótulo del remitente ahora puede ser
> `"Tapia Propiedades vía My Alquiler" <no-reply@myalquiler.app>` en los mails que la
> inmobiliaria le manda a SU gente (aumento, anuncios, invitación a inquilino y a equipo,
> reclamos). **La dirección no cambia → SPF/DKIM intactos.** El OTP, la bienvenida a la
> inmobiliaria y el aviso interno de reclamo siguen saliendo como My Alquiler a propósito.
> Se prende con `EMAIL_FROM_CON_INMOBILIARIA=1` (documentado en `docs/CONFIG.md`) y se apaga
> sin deploy. **Queda para el dueño la decisión de prenderlo**, que es lo que la tarea pedía
> evaluar: el código está y la deliverability no se movió sola.

**Experto:** BE + PROD · **Prioridad:** 🟡 · **Depende de:** T-30 (hecha)
**Origen:** role play del inquilino al ejecutar T-30.

**Estado verificado.** Con T-30 el "Responder" ya cae en la inmobiliaria, pero el `From` de
todos los mails sigue siendo `My Alquiler <no-reply@myalquiler.app>` (`mailer.ts:16`). En la
bandeja del celular el inquilino ve **"My Alquiler"**, una marca que no conoce, avisándole que
le suben el alquiler. El asunto sí lleva `· {inmobiliaria}` al final, que es donde se salva.

**Qué hay que hacer.** Evaluar poner el nombre de la inmobiliaria como *display name* del mismo
buzón: `Tapia Propiedades vía My Alquiler <no-reply@myalquiler.app>`. La dirección no cambia,
así que **SPF/DKIM siguen intactos** — es sólo el rótulo.

**Por qué NO se hizo en T-30.** Cambia el remitente de TODOS los mails, incluido el OTP, y el
remitente es lo que más pesa en si un proveedor te manda a spam. Es una decisión de
deliverability del dueño, no un efecto colateral de arreglar el "Responder".

**Criterio de aceptación.** El inquilino reconoce quién le escribe sin abrir el mail, y la tasa
de entrega no empeora.

---

## T-30-N2 · La invitación al equipo no escapa el HTML — ✅ RESUELTO

> **Hecho.** `enviarInvitacionEquipo` ahora pasa por `shell()` como todos los demás y escapa
> `inmobiliariaNombre`, el rol, el email y la URL. Gana además la marca y el pie de T-30.
> Test: una inmobiliaria `Suárez & Cía <Córdoba>` recibe el mail bien renderizado.

**Experto:** SEC + BE · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** lectura del mailer al ejecutar T-30.

**Estado verificado.** `enviarInvitacionEquipo` (`mailer.ts`) es el ÚNICO template que no pasa
por `shell()` y arma su HTML a mano: interpola `inmobiliariaNombre`, `rolTxt` y `email`
**sin `esc()`**. Todos los demás templates escapan.

**Riesgo real: bajo.** Los valores los carga el ADMIN de la propia inmobiliaria (su razón
social, el mail del compañero que invita), no un tercero. No hay escalada de privilegios: el
HTML se renderiza en la casilla del invitado, que es de la misma oficina.

**Por qué igual hay que arreglarlo.** Una razón social con un `&` o un `<` ya rompe el mail hoy,
sin malicia de por medio. Y es la única excepción a una regla que el resto del archivo cumple.

**Qué hay que hacer.** Pasar `enviarInvitacionEquipo` por `shell()` como los demás —gana el
diseño de marca y el pie de T-30 de arrastre— o, como mínimo, envolver las interpolaciones en
`esc()`.

**Criterio de aceptación.** Una inmobiliaria llamada `Suárez & Cía <Córdoba>` recibe su mail de
invitación bien renderizado.

### T-18-N1 · Que el historial muestre el cuerpo del mensaje, no sólo el asunto
**Experto:** FE-P · **Prioridad:** 🟠 · **Detectada en:** T-18 (Fase 7)
**Estado: ✅ HECHA** — commit `c454098`. **La verificación que pedía dio que SÍ se renderiza**: el texto completo siempre estuvo guardado (`EventoContrato.detalle`, hasta 4000 caracteres) y el GET lo devuelve entero. Pero se mostraba con el mismo `<p>` gris de metadato que los demás eventos —donde el detalle es una línea tipo "$405.000 · transferencia"— y con `white-space` normal, así que un mensaje de varios párrafos llegaba **colapsado en un bloque corrido**. Para releerlo y discutir, casi tan inservible como no guardarlo. Ahora una `COMUNICACION_ENVIADA` se renderiza como cita, con `whitespace-pre-line`. El tab Comunicaciones NO era el lugar: en prod viene vacío (`comunicaciones: []`) y su `preview` usa `line-clamp-2` a propósito. tsc 0, lint sin warnings nuevos.

`POST /contratos/:id/comunicaciones` guarda el texto completo en `EventoContrato.detalle`, pero
falta verificar si la pestaña Historial lo renderiza o sólo muestra `titulo`. Camila:
*"queda anotado que mandé un mensaje, pero no queda el mensaje… si guarda sólo el asunto no me
sirve para discutir después."* Sin el cuerpo, el registro no cubre el caso de uso real.

### T-18-N2 · El copy de espera de país promete un mail que nadie manda
**Experto:** PROD · **Prioridad:** 🟢 · **Detectada en:** T-18
**Estado: ✅ HECHA** — commit `5525b1e`. Verificado que **no hay ninguna lista de espera** en el repo (grep de waitlist / lista de espera / notificar lanzamiento → cero). Eran **TRES** promesas del mismo tipo, no una: el banner comercial de `configuracion-pais.tsx` (*"elegilo igual y te avisamos cuando abramos, **con descuento de lanzamiento**"* — la peor, porque compromete un beneficio comercial sobre una acción que no registra nada), la que nombraba la tarea, y el popup de beta de `screening/page.tsx". Arreglar una y dejar dos idénticas a dos pantallas no servía. **No** se reemplazó por "escribinos a Soporte": `/soporte` es el proxy al bug tracker con allowlist por tenant, sería cambiar una media promesa por otra. Si se quiere capturar ese interés de verdad —para el país tiene valor comercial claro— hay que construirlo: modelo, endpoint y disparo de mail al abrir el mercado. tsc 0, lint sin warnings nuevos.

`apps/inmobiliaria/src/components/configuracion-pais.tsx:183` dice *"avisamos por mail cuando
esté listo"* para un país todavía no disponible. No hay lista de espera detrás. O se construye,
o se cambia el texto.
### T-18-N2-N1 · El onboarding promete avisar de un costo que el sistema no calcula
**Experto:** PROD · **Prioridad:** 🟡 · **Detectada en:** T-18-N2
**Estado: ✅ CERRADA SIN CAMBIO** — el dueño confirmó que **el aviso lo hace una persona del equipo** cuando el cliente se pasa de tramo. La frase es cierta, entonces, aunque el software no participe: se deja como está. Queda anotado que si en algún momento ese aviso manual se deja de hacer, la frase pasa a ser falsa — y que el modelo de facturación (`Factura`, `KeyTramoPlan`, `propiedadesEnPlan`) sigue existiendo en el schema sin una sola línea de código que lo use.

`apps/inmobiliaria/src/components/onboarding.tsx:77` dice, como bullet del slide de
Propiedades: *"Cargá nuevas propiedades (te avisamos del costo extra)"*.

**Estado verificado.** El modelo de facturación **existe en el schema y no está implementado**:
`Factura` (con `propiedadesEnPlan`, `plan`, `importeBase`…), `KeyTramoPlan`
(STARTER/GROWTH/PRO/ENTERPRISE), `EstadoFactura` y `Suscripcion`. Pero en todo `apps/api/src` la
**única** referencia a `Factura` es un `prisma.factura.count()` en `uploads.ts:223`, usado para
detectar PDFs huérfanos. Nadie emite una factura, nadie calcula un tramo, nadie compara la
cantidad de propiedades contra el plan, y `POST /propiedades` no chequea límite ni devuelve
ningún aviso de costo. El panel tampoco muestra nada.

**Por qué NO se cambió el copy de una.** A diferencia de las otras tres promesas de T-18-N2
—donde el canal directamente no existe— acá el aviso puede ser **verdadero fuera del sistema**:
si alguien del equipo le avisa al cliente cuando se pasa de tramo, la frase es cierta aunque el
software no participe. Eso sólo lo sabe el dueño.

**Qué hay que decidir.** Si el aviso lo hace una persona, la frase queda como está. Si no lo
hace nadie, hay que sacarla — o construir el cálculo de tramo, que ya tiene el modelo hecho.

---

## Tareas nuevas detectadas al ejecutar

### T-17-N1 · Destinatario configurable por tipo de aviso
**Experto:** BE + PROD · **Prioridad:** 🟠 · **Detectada en:** T-17 (Fase 7)
**Estado: ✅ HECHA** — commit `de64f5b`. El dueño eligió **casilla por tipo de aviso**. Modelo `DestinatarioAviso` + enum `TipoAvisoInmo`, endpoints sólo-ADMIN y card en Mi Inmobiliaria. **La ausencia de fila = usá `Inmobiliaria.email`**: la tabla nace vacía, así que hasta que alguien configure algo no cambia nada, y vaciar el campo BORRA la fila en vez de guardar `''`. El enum arranca con **un solo valor** a propósito: `RECLAMO_NUEVO` es hoy el único aviso por mail a la inmobiliaria, y listar tipos que no mandan nada sería ofrecer una configuración vacía — el mismo patrón que venimos sacando. **Migración sin aplicar:** `20260819180000_destinatario_por_aviso`, va ANTES del código. 6 tests puros verificados en rojo; 303 puros en verde.

Hoy **todos** los avisos a la inmobiliaria van a `Inmobiliaria.email`, una sola casilla. Camila
administra 220 propiedades: *"me va a llegar un mail por cada reclamo… y todos van a mi misma
casilla, no a la de la chica que los maneja. Habría que poder decir a quién le llega cada cosa."*

Hace falta un modelo de preferencias (por tipo de evento → destinatario), y probablemente un
digest para los eventos de alto volumen. **Definir con PROD antes de modelar.**

### T-17-N2 · El estado EN_CURSO sigue siendo inalcanzable
**Experto:** BE + FE-P · **Prioridad:** 🟠 · **Detectada en:** T-17 (Fase 7)
**Estado: ✅ HECHA** — commit `bccd4f1`. `POST /reclamos/:id/tomar` (ABIERTO → EN_CURSO) con el mismo patrón que asignar/resolver/rechazar: lock atómico (`count===0` → 409 si alguien lo cerró mientras tanto), evento en el historial, scoping por tenant. **Idempotente**: tomar algo ya en curso devuelve 200 sin duplicar el evento — el caso real es que dos personas de la oficina abran el mismo reclamo. NO asigna profesional (eso es `/asignar`, son cosas distintas), y por eso en prod el botón no exige operador asignado, a diferencia de la demo, donde esa exigencia era lo que trababa el flujo. El botón del panel ya existía gateado a `!apiEnabled` con el comentario "no tiene endpoint"; ahora lo tiene. tsc 0, 297 tests puros en verde.

Ya estaba documentado en `07-ECOSISTEMA.md §3.4`: *"tomar / poner en curso"* no tiene endpoint,
así que a `EN_CURSO` sólo se llega si el inquilino **reabre** un reclamo resuelto. Con el mail
de T-17, Camila se entera antes de un reclamo que después **no puede mover**: *"me entero más
rápido de algo que después no puedo mover. Me sirve igual, pero es media solución."*

---

## T-21-N3-N1-N1 · El onboarding del inquilino promete una IA que no existe — 🔴

**Experto:** FE-I + PROD · **Prioridad:** 🔴 · **Depende de:** nada
**Estado: ✅ HECHA** — commit `48ff8e6`. Se sacó el slide del onboarding (no se reescribió: los otros ya cubren lo que la app hace). El botón CENTRAL del nav pasó de "Asistente" → /broker a **"Reportar" → /reclamos/nuevo**: acción real, frecuente, y la semántica clásica de un FAB. `/ayuda` repetía la promesa en TRES lugares (una FAQ entera, el empty state de la búsqueda y el CTA del pie) — ahora mandan a la inmobiliaria, que es el canal que existe, y ese botón pasó de secundario a primario. **En producción no queda ningún camino a /broker**; la card del home vive en `HomeDemo`, o sea sólo en el build demo → eso es T-21-N3-N3. tsc 0, lint limpio, build con 45 páginas.
**Origen:** auditoría de T-21-N3-N1. Es la promesa que llega a **usuarios reales**, no a prospectos.

**Estado verificado.** `<Onboarding/>` se monta en `apps/inquilino/src/app/(app)/layout.tsx:37`
**sin gate de `apiEnabled`**, así que lo ve todo inquilino en producción. El slide dice textual
(`components/onboarding.tsx:81-88`):

> *"Chateá con el Asistente — Una IA que leyó tus cláusulas y te responde al instante"*
> *"Te cita la cláusula exacta del contrato"* · CTA: *"Probar el Asistente"* → `/broker`

Y `/broker` en producción devuelve **`<Proximamente/>`** (`broker/page.tsx:113`). El botón
**central** del nav —el más prominente del mobile— se llama **"Asistente"** y lleva al mismo
lugar (`components/nav-bar.tsx:36`). `/ayuda` repite la promesa.

No hay ningún LLM en el monorepo: el "chat" es un simulacro de keyword-matching que sólo existe
en el build demo (`apps/inquilino/src/lib/contrato-chat.ts`).

**Es el mismo patrón que T-18 y T-30**, pero peor: acá el producto no promete un canal, promete
una capacidad entera, en el onboarding, a cada usuario nuevo.

**Qué hay que hacer.** Sacar el slide (o reescribirlo con lo que la app SÍ hace) y decidir qué
pasa con el botón central del nav: hoy el lugar más caro de la pantalla lleva a un cartel de
"Próximamente".

**Criterio de aceptación.** Un inquilino que entra por primera vez no lee ninguna promesa de IA,
y ningún botón principal lleva a una pantalla vacía.

---

## T-21-N3-N2 · `POST /screening` fabrica informes crediticios sobre personas reales — 🔴

**Experto:** SEC + BE + PROD · **Prioridad:** 🔴 · **Depende de:** nada
**Estado: ✅ HECHA** — commit `791a232`. `POST /screening` devuelve 501 (`SCREENING_SIN_FUENTE`), y se borró el generador entero (~270 líneas): dejarlo dormido con el endpoint apagado era un arma cargada. 501 y no 404 a propósito — el endpoint existe, lo que falta es la integración. Las lecturas NO se tocaron: si hay filas fabricadas el dueño tiene que poder verlas. **Necesita tu mano:** correr `work-agent/tareas/T-21-N3-N2/diagnostico-screenings-fabricados.sql`, que dice sobre QUÉ PERSONAS se emitieron y cuáles terminaron ligadas a un contrato. tsc 0, 285 tests puros en verde.
**Origen:** auditoría de T-21-N3-N1. `work-agent/07-ECOSISTEMA.md` ya lo tenía como riesgo.

**Estado verificado.** El endpoint está registrado, autenticado y con guard multi-tenant. El
informe entero —score, deudas BCRA, cheques rechazados, juicios, familia, domicilio, empleador,
patrimonio— sale de un **PRNG FNV-1a sembrado con los dígitos del CUIT**
(`routes/inquilino-mundo.ts:173-180` y `:240-437`). El score es `480 + (semilla % 470)` y la
recomendación son dos comparaciones sobre ese número inventado. **Cero llamadas a Nosis, BCRA,
RENAPER, ARCA o Veraz** — el único `fetch()` saliente de toda la API va al bug tracker.

Y lo persiste con `estado: 'COMPLETO'` sobre **personas reales identificadas por CUIT y nombre**.

**Lo que hoy lo contiene, y no alcanza:** ningún front lo llama y la pantalla está bloqueada en
producción. Pero **el endpoint sigue vivo y sin gate**: cualquiera con un token de usuario del
panel puede pedirlo y recibir un informe crediticio fabricado que se ve oficial, sobre una
persona identificada, y decidir a quién le alquila mirando eso.

**Qué hay que hacer.** Devolver **501** hasta que exista una fuente real, como ya recomienda
`07-ECOSISTEMA.md`. Costo: minutos. Y decidir qué se hace con las filas que puedan existir en
`screenings` — hay que mirar la base, no el código.

**Criterio de aceptación.** No se puede obtener un informe crediticio que el sistema no pueda
respaldar con una fuente real.

---

## T-21-N3-N3 · La landing y el demo público venden IA que no existe — ✅ HECHA

**Experto:** PROD + FE-P · **Prioridad:** 🟠 · **Depende de:** nada
**Resuelta** en `fix/T-21-N3-N3-copy-sin-ia`, commit `9b93f54`.

**Lo peor no era la IA.** Dos hallazgos pesan más que el marketing:
1. *"Cobranzas con IA + ARCA"* estaba dentro del `<ul>` de features que se renderiza para **los
   cuatro tramos pagos** ($50k a $350k). No es exageración de copy: es un ítem de "qué incluye tu
   plan". El que firma Growth cree que lo compró.
2. *"Conectás ARCA + tu CBU · facturás automático el primer mes"* es una **promesa fiscal con
   fecha**. No hay una sola llamada a AFIP/ARCA; el diálogo "Conectar ARCA" del panel declara en
   su propio comentario que **simula** el OAuth y escribe un flag en localStorage.

Y la más cara comercialmente: *"Ajustes ICL e IPC automáticos"* / *"el índice se aplica solo"*.
ICL e IPC son valores de un enum; cero consultas a INDEC o BCRA. El ajuste lo carga una persona.

**Regla que se siguió:** no alcanza con borrar la palabra "IA" — lo que el producto hace de
verdad tiene que quedar vendido igual de fuerte. *"IA carga 200+ contratos en minutos"* pasó a
describir el importador real (reconoce tus encabezados, fila por fila, hasta 2.000 contratos,
reanudable), que es mejor argumento y además es cierto.

**Superficies tocadas:** `/precios`, `/inicio`, la metadata de `layout.tsx` que heredan las rutas
del panel, `llms.txt` y `pricing.md` (lo que citan los motores de IA — `robots.ts` los habilita,
así que `llms.txt` suma una sección **"Qué NO hace"** para *contradecir* lo ya cacheado), el
demo público (banda de simulación en el picker + limpieza de `landing-data.json`: se eliminó la
sección de facturación ARCA, 2 FAQ y 3 bullets) y `.claude/agents/landing.md`, que suma una
**regla 4 de honestidad de capacidades** para que el próximo agente no reescriba la mentira
leyendo su propio brief.

**No se tocó la PWA** (onboarding y nav prometen "Asistente IA" en producción): es
**T-21-N3-N1-N1**, de otro chat.

---

### Contexto original
**Origen:** auditoría de T-21-N3-N1.

**Estado verificado.**
- **`/precios`** vende *"Cobranzas con IA"*, *"Cobranzas con IA + ARCA"*, *"Negociador IA al
  renovar"* —que el propio `CLAUDE.md` pone en el roadmap 2027— e *"IA carga 200+ contratos en
  minutos"*, describiendo la importación de Excel, que es determinística y no usa IA.
- **El demo público de GitHub Pages** se construye sin `NEXT_PUBLIC_API_URL`, o sea en modo
  demo: `/contratos/nuevo` muestra *"Extrayendo datos con IA · Claude está leyendo el contrato"*
  con checklist falso y datos hardcodeados, y la simulación de screening dice *"Validando
  identidad contra RENAPER y ARCA"* y firma el PDF con *"Fuentes: Nosis, BCRA, ARCA"*.
- **`package.json:5`** describe el producto como *"(alquiler + expensas + chat IA + screening)"*.

**Qué hay que hacer.** Depende de la decisión abierta de `CLAUDE.md` §1.5. Mientras tanto: o se
sacan esas pantallas del build demo, o llevan un cartel inequívoco de "simulación, datos de
ejemplo". Un PDF que firma *"Fuentes: Nosis, BCRA, ARCA"* sobre datos inventados no es una
exageración de marketing.

Y "IA carga 200+ contratos en minutos" se puede reemplazar por lo que el importador **sí** hace
—mapeo de columnas por sinónimos, validación fila por fila, reanudable— que es buen argumento de
venta por sí solo y además es cierto.

**Criterio de aceptación.** Nada de lo que ve alguien de afuera promete una capacidad que el
sistema no tiene.

---

### T-18-N1 · Que el historial muestre el cuerpo del mensaje, no sólo el asunto
**Experto:** FE-P · **Prioridad:** 🟠 · **Detectada en:** T-18 (Fase 7)

`POST /contratos/:id/comunicaciones` guarda el texto completo en `EventoContrato.detalle`, pero
falta verificar si la pestaña Historial lo renderiza o sólo muestra `titulo`. Camila:
*"queda anotado que mandé un mensaje, pero no queda el mensaje… si guarda sólo el asunto no me
sirve para discutir después."* Sin el cuerpo, el registro no cubre el caso de uso real.

### T-18-N2 · El copy de espera de país promete un mail que nadie manda
**Experto:** PROD · **Prioridad:** 🟢 · **Detectada en:** T-18

`apps/inmobiliaria/src/components/configuracion-pais.tsx:183` dice *"avisamos por mail cuando
esté listo"* para un país todavía no disponible. No hay lista de espera detrás. O se construye,
o se cambia el texto.


---

### T-01-N1 · Nadie corre los tests. Ni el compilador. ✅ HECHA
**Experto:** INFRA · **Prioridad:** 🔴 · **Detectada en:** T-01 (al contar las migraciones)

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-01-N1/REQUISITOS.md`.

El único workflow del repo era `deploy.yml`: publicaba la demo a Pages sin correr `tsc`, ni
lint, ni un solo test. Había **725 tests escritos que no ejecutaba nadie**, nunca.

Y `pnpm typecheck` en la raíz **salteaba `apps/api` en silencio**: el paquete tenía el chequeo
con el nombre `lint`, así que `turbo run typecheck` lo listaba como `<NONEXISTENT>`. Quien lo
corría veía verde sin haber mirado el paquete donde vive la plata.

Eso explica el patrón del día: ocho regresiones cruzadas encontradas en tres pases **manuales**
(`00fc8a3`, `7346ca8`, `4f59794`). Las ocho las encontró alguien mirando, porque no había
ninguna máquina mirando.

**Lo que se hizo:** `.github/workflows/revision.yml` (typecheck de los cinco paquetes + 341
tests, en cada push y PR), `apps/api/vitest.sin-db.config.ts` (parte el suite por si necesita
base viva, calculado leyendo los imports, no a mano), y los scripts `typecheck` y `test:sin-db`.

**Verificado:** 341 tests verdes en 7 s sin ninguna base; `tsc` 0 en los cinco paquetes; y
—lo que importa— se revirtió una de las ocho regresiones cruzadas de hoy y la compuerta la
atajó con exit 1 en 7 segundos.

**Sigue abierto:** `T-01-N1-N1` — los 52 archivos que sí necesitan base (los de plata, auth y
conciliación) siguen sin correr nunca. Depende de la decisión de infraestructura de T-28.

---

## T-29-N1 · El historial se escribe dentro de la transacción, y ahí no puede ser best-effort — ✅ YA ESTABA HECHA

> **Verificado el 20/08 mientras se buscaba tarea.** Ya está resuelto, y mejor de lo que pedía la
> ficha: no sólo se movió a post-commit, sino que **la firma lo garantiza**. `registrarEventoContrato`
> recibe `PrismaClient` y **no acepta un `tx`**, así que es el compilador el que impide volver a
> meterlo adentro de una transacción. Los cinco call sites pasan `prisma`
> (`core.ts:1496`, `core.ts:2397`, `operacion.ts:332`, `operacion.ts:872`, `plata.ts:525`);
> **cero** pasan `tx`.
>
> El docblock además deja escrito el porqué: en PostgreSQL una sentencia fallida deja la
> transacción abortada, así que el `catch` no protegía la operación — escondía que se había
> perdido, devolviendo 200.

**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** revisión adversarial de la consolidación (19/08). No salió de la reunión.

`registrarEventoContrato` (`lib/evento-contrato.ts`) promete no voltear la operación que lo
generó. **Con los cinco callers actuales no puede cumplirlo**, porque los cinco le pasan un `tx`
y en PostgreSQL una sentencia fallida deja la transacción abortada: el COMMIT se cae igual.

El `catch {}` que tenía no rescataba nada — sólo convertía una falla ruidosa en pérdida
silenciosa de datos con un 200. Ya se sacó (commit `ddd2b34`), así que hoy **falla fuerte**, que
es el comportamiento correcto mientras siga adentro de la transacción.

**Qué falta.** Moverlo a post-commit, con el cliente base en vez del `tx`, que es exactamente lo
que ya hace `registrarEvento` de auditoría: *"se llama DESPUÉS de que la acción ya commiteó, no
dentro de su transacción"*. Recién ahí el best-effort es real y el docblock dice la verdad.

Los cinco call sites: `core.ts:1310`, `core.ts:2307`, `operacion.ts:327`, `operacion.ts:863`,
`plata.ts:470`. Cada uno necesita que los datos del evento sigan en scope después del
`$transaction`.

**Criterio de aceptación.** Un fallo al escribir el historial deja un hueco en el timeline y
nada más: la operación que lo generó queda commiteada y el endpoint responde OK.

**Por qué no se hizo junto.** Son cinco handlers de plata y no hay forma de correr los tests de
integración desde esta máquina. Un refactor a ciegas sobre conciliar pagos y renovar contratos no
vale el riesgo comparado con lo que ya se ganó (que la falla deje de ser silenciosa).
### T-01-N1-N2 · La rendición le manda al dueño las palabras del inquilino ✅ HECHA
**Experto:** SEC · **Prioridad:** 🔴 · **Detectada en:** barrido de regresiones (T-01-N1)

> **Estado: ✅ hecha** en el código. **Falta aplicar la migración** de limpieza (va con T-01).
> Ver `work-agent/tareas/T-01-N1-N2/REQUISITOS.md`.

`plata.ts`, al armar los gastos de una rendición, rotulaba el arreglo así:

```ts
rec.costoTrabajoNotas || `Reparación (${categoria}): ${rec.descripcion.slice(0, 60)}`
```

`rec.descripcion` es **el texto libre que escribió el inquilino** al reportar el problema. Como
`costoTrabajoNotas` es opcional y casi nunca se carga, el caso por defecto era guardar en
`GastoRendido.descripcion` 60 caracteres del relato del inquilino sobre su propia casa — y de
ahí salían al portal del propietario (`portal-propietario.ts:451`) y al PDF imprimible.

**Lo que lo vuelve un descuido y no una decisión:** el mismo archivo ya cerró esta misma puerta
50 líneas más abajo. `portal-propietario.ts:505-511` recorta los reclamos a contratos vigentes
diciendo textualmente que si no, *"quien compra un departamento en marzo abre el portal y lee
los reclamos de 2024 de un inquilino con el que no tuvo ninguna relación, con la `descripcion`
en texto libre que esa persona escribió"*. Mismo dato, misma persona, mismos ojos, otra puerta.

**Lo que se hizo:** el rótulo pasa por `lib/descripcion-gasto-rendido.ts` y el fallback es la
categoría sola. El dueño sigue viendo qué se arregló y cuánto; lo que describe el trabajo es
`costoTrabajoNotas`, que lo escribe el operador sabiendo que se muestra.

**Verificado:** 5 tests puros, y se confirmó que **4 se ponen rojos** al revertir el fix.

**Pendiente del dueño:** aplicar `20260819220000_sacar_texto_del_inquilino_de_gastos` — las
filas ya escritas siguen con el texto adentro. Son **once** migraciones ahora, no diez.

---

### T-01-N1-N3 · La caja mezcla monedas en tres lugares ✅ HECHA
**Experto:** BE-P · **Prioridad:** 🔴 · **Detectada en:** barrido de regresiones (T-01-N1)

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-01-N1-N3/REQUISITOS.md`.

`MovimientoCaja.moneda` es `@default(ARS)` y el schema dice que ARS *"es la única moneda que la
UI de caja permite cargar hoy"*. **Ya no es cierto:** `POST /caja/movimientos` escribe la
moneda del body. Los consumidores que asumían "todo es ARS" pasaron de correctos a incorrectos
sin que nadie los tocara. `cuentas.ts` ya se adaptó; quedaron estos tres.

1. 🔴 **`plata.ts:846`** — cobrar un cargo del inquilino creaba el movimiento **sin** moneda.
   `CargoContrato` sí la tiene y el dato estaba a mano, sin usar. Como la columna tiene default,
   no fallaba: escribía ARS igual. Un cargo de US$800 quedaba en caja como $800. **Es el peor
   de los tres: escribe mal, permanentemente**, y una vez escrita la fila ya no dice de dónde
   vino. Este el barrido no lo había encontrado.
2. 🟠 **`metricas.ts`** — el `groupBy` de caja sin filtro de moneda, dentro de una respuesta
   rotulada `moneda: 'ARS'`.
3. 🟡 **`metricas.ts`** — el aviso de "hay otras monedas" contaba **contratos**, no movimientos.
   Con el filtro del punto 2 puesto, un gasto en USD queda fuera del neto sin avisar: excluir en
   silencio es tan engañoso como sumar mal. Por eso 2 y 3 van juntos.

**Verificado:** `tsc` 0 en API y panel, 350 tests verdes, y los tres tests se ponen rojos al
revertir cada fix **por separado**.

**Pendiente del dueño:** correr `work-agent/tareas/T-01-N1-N3/diagnostico-caja-moneda.sql`
(solo lectura) para ver si hay filas ya escritas mal. No se pueden corregir a ciegas: cambiar
la moneda de un movimiento mueve el cierre de caja de ese día y puede mover rendiciones ya
emitidas.

---

## T-46 · El portal del propietario existe, compila… y no se despliega en ningún lado

**Estado: ✅ HECHA (el camino 1) — commits `da2a708`, `75ad907`, `010d2fc`.** El portal ya sale
en el sitio: `build-static.sh` lo buildea a `out/propietario/` y el picker tiene su puerta.
Detalle en `work-agent/tareas/T-46/estado.md`.

**Se hizo el camino 1 (demo), y no cierra la puerta del 2.** El 2 es deploy, y queda como
**T-46-N1**, que es del dueño. La demo NO se prende con `!apiEnabled` —que es justo el caso que
protegía el comentario de `api.ts`— sino con `NEXT_PUBLIC_DEMO=1`, que escribe sólo
`build-static.sh`: una app de producción sin `NEXT_PUBLIC_API_URL` sigue diciendo "no estoy
conectada" en vez de inventarle rendiciones a un propietario real.

Dato que inclinó la decisión: `next.config.mjs` de propietario **ya tenía** el bloque de static
export con su `basePath` de GitHub Pages. No era un camino nuevo, era uno empezado y sin
terminar.

Verificado recorriendo el sitio buildeado (login → pagos con detalle → unidades → reclamos →
perfil), no sólo compilando. De ahí salieron dos bugs que se arreglaron: las fechas del portal
se mostraban **un día antes** para todo el país (T-46, `75ad907`) y el guard de build miraba el
puerto del API en vez del propio.

**Experto:** OPS + PROD · **Prioridad:** 🔴 · **Depende de:** una decisión tuya (ver abajo)
**Origen:** revisión post-merge. No salió de la reunión.

**Estado verificado.** `apps/propietario` son **1.210 líneas** en 9 archivos —login, home, selector
de cartera, detalle de rendición e impresión— y **ningún pipeline la construye**:

- `scripts/build-static.sh` compila **sólo** `inmobiliaria` e `inquilino`, y copia sólo esos dos
  a `out/`. No hay una línea que nombre a `propietario`.
- No aparece en `.github/workflows/`, ni en el `picker.html` que es el índice del sitio.
  (Los dos hits de "propietario" en el picker son la palabra suelta en copy descriptivo.)

Verificado con `grep -rn "propietario" scripts/build-static.sh scripts/picker.html
.github/workflows/*.yml`: **cero coincidencias reales**.

**O sea: T-23 entregó una app entera y no la ve nadie.** No es que esté rota — compila (`tsc` en
0) y maneja bien el modo sin API (`lib/api.ts:12`, y el login corta con un mensaje honesto en vez
de fingir). Simplemente no sale.

**Lo que hay que decidir antes de tocar el pipeline** — por eso no se agregó de una:

El portal **necesita un API vivo** (`apiEnabled = NEXT_PUBLIC_API_URL.length > 0`). El sitio
estático que arma `build-static.sh` es la **demo** y no tiene API detrás. Si se lo agrega ahí sin
más, el propietario que entre se come el "El portal no está conectado al servidor" — honesto,
pero inútil como demo.

Hay dos caminos y no son intercambiables:

1. **Va al sitio estático, como demo**, y entonces hace falta darle un modo demo con datos mock
   —que hoy **no tiene**, a diferencia del panel y de la PWA—.
2. **Va a un host propio con el API real** (Vercel/Railway, como el resto de producción), y
   entonces esto es una tarea de infraestructura y no de build estático.

**Criterio de aceptación.** Un propietario puede entrar al portal desde una URL, o está escrito
en este documento por qué todavía no y qué falta.

**Riesgo de no hacerlo.** Que el trabajo se dé por entregado. Es el modo de fallo más caro del
trabajo en paralelo: la tarea figura ✅, el código está mergeado y verificado, y el usuario final
no tiene forma de llegar.
### T-01-N1-N4 · Los dos fronts se caen abriendo un reclamo ✅ HECHA
**Experto:** FE · **Prioridad:** 🔴 · **Detectada en:** barrido de regresiones (T-01-N1)

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-01-N1-N4/REQUISITOS.md`.

`TipoEventoReclamo` tiene **13** valores en Prisma. Cada front mantiene su copia a mano y las
dos se quedaron cortas, **en mitades distintas**:

| | conocía | se caía con | quién los escribe |
|---|---|---|---|
| Panel | 10 | los tres `VISITA_*` | el profesional, desde el link público |
| PWA inquilino | 11 | `CLASIFICADO`, `PROFESIONAL_ASIGNADO` | la inmobiliaria |

Los dos hacen `labelForTipo[ev.tipo](ev)`: un valor desconocido no es un renglón feo, es
`undefined(ev)` y **la pantalla se cae entera**. Ningún endpoint filtra eventos por tipo.

En concreto: el profesional confirma la visita → Camila abre ese reclamo → pantalla rota. Y al
revés: la inmobiliaria clasifica un reclamo → el inquilino abre el suyo → pantalla rota. Se cae
justo en los reclamos donde **algo está pasando**; los quietos se ven bien, y por eso duró.

**TypeScript no lo agarró y no era culpa suya:** `Record<TipoEventoReclamo, X>` sí exige
exhaustividad y estaba completo. Comparaba contra la lista local, que era la que estaba mal.

**Lo que se hizo:** los valores faltantes en los dos, un test que ata las **tres** listas
(Prisma + los dos fronts) y una guarda de runtime para el rato entre que se despliega la API y
se despliega cada front. A `CLASIFICADO` en la PWA se le saca el `contenido` — es
*"Paga: Propietario"*, una decisión interna sobre la plata de otros — y queda rotulado
*"La inmobiliaria revisó el reclamo"*.

**Verificado:** se recreó el bug sacando los tres `VISITA_*` y dispararon **las dos defensas**:
3 tests en rojo y 3 errores de `tsc` señalando la línea. `tsc` 0 en los cinco paquetes, 359
tests verdes.

**No verificado:** no se probó en el navegador.

---

### T-45 · El home de la PWA ignora el pago informado en modo demo — ✅ HECHA

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-45/REQUISITOS.md`.

Confirmado lo que decía la tarea: `pagoVivo` era `null` fijo en demo, así que el home decía
"atrasado" a alguien que acababa de informar el pago completo, mientras la pantalla a la que
linkea decía "en revisión".

**Lo que la tarea no decía, y aparece al arreglarlo:** poner `pagoVivo` no alcanzaba. Tres
líneas más abajo, `saldoDeLiquidacion` decide entre *"Te faltan $X"* y *"Comprobante en
revisión"* y **también** lee sólo `liq.pagos`. En demo eso daba `faltaPagar = total`, o sea el
banner habría dicho "Te faltan $TOTAL" justo abajo del cartel que reconoce el comprobante. La
letra del criterio de aceptación se cumplía; el espíritu no.

**Cómo se arregló de raíz:** `saldoDeLiquidacion` pedía una `Liquidacion` entera y sólo usa tres
cosas de ella. Se declaró ese tipo estructural (`LiquidacionParaSaldo`), y con eso el
`PagoInformado` del store local **encaja tal cual** — antes había que fabricar un
`PagoDeLiquidacion` completo, doce campos inventados, para colar dos números. Ese era el motivo
real de que nadie lo hubiera hecho.

Es, además, el mismo problema que el propio encabezado de `saldo-liquidacion.ts` dice que vino a
resolver ("dos pantallas, dos verdades sobre la misma deuda"): unificaron el cálculo pero la
fuente de datos seguía partida según el modo.

**Verificado:** 8 tests puros, 5 se ponen rojos al revertir; `tsc` 0 en los cinco paquetes; 360
tests verdes en la compuerta.
**Pendiente:** esos 8 tests **no corren en CI todavía** — `apps/inquilino` no tiene runner, que
es lo que está haciendo T-32. Se corrieron a mano.
**No verificado:** no se probó en el navegador.

---

## T-46-N1 · El portal del propietario está en la demo, pero no en producción — ✅ HECHA 20/08

**Experto:** OPS + el dueño · **Prioridad:** 🔴 · **Depende de:** nada · **ES DEL DUEÑO**
**Origen:** T-46. Es el camino 2 que T-46 dejó explícitamente abierto.

T-46 resolvió que el portal **se vea** (sitio estático, datos de ejemplo). Falta que un
propietario **de verdad** pueda entrar: un host propio —Vercel o Railway, como el resto— con
`NEXT_PUBLIC_API_URL` apuntando al API y **sin** `NEXT_PUBLIC_DEMO`.

Con esas dos variables así, el modo demo queda apagado por construcción: `demoEnabled` exige la
bandera **y** la ausencia de API, así que aunque alguien dejara la bandera puesta, gana el API
real. Hay un test que lo fija.

Lo que falta es infraestructura, no código: el `basePath` de GitHub Pages vive en el bloque
`STATIC_EXPORT` del `next.config.mjs`, así que un deploy normal (sin esa variable) sale con
basePath vacío, que es lo correcto para un dominio propio.

**Criterio de aceptación.** Un propietario de la inmobiliaria entra desde una URL, con su email,
y ve SUS rendiciones.

**Riesgo de no hacerlo.** Que se dé por entregado dos veces: primero porque el código existía,
ahora porque la demo se ve. Ninguna de las dos le sirve al dueño de un departamento.

**Cómo se resolvió — y no por el camino que esta hoja esperaba.** No se levantó un host propio:
el portal se compila como export estático bajo `/propietario` y lo sirve el MISMO servicio del
panel (`768e8de2`, "feat(deploy): el portal del propietario, servido en /propietario del panel").
Por eso no aparece como servicio nuevo en Railway — son tres, no cuatro.

**Verificado el 20/08 contra producción**, no contra el repo:
`curl -o /dev/null -w '%{http_code}' https://admin.myalquiler.com/propietario/login` → **200**,
con `<title>My Alquiler · Propietarios</title>` y el mismo `build-commit` que el panel. El job
`build` de `revision.yml` cubre además esta tercera combinación con asserts de que el export
tenga las rutas y el `basePath` horneado.

**Lo que NO se verificó**, y hace falta que lo haga una persona con datos reales: que un
propietario **de verdad** entre con su email y vea SUS rendiciones. Lo comprobado es que la URL
existe y sirve la app; el login end-to-end contra un dueño real de la cartera de Camila queda
pendiente y es de producción.

---

## T-46-N2 · Los tests de los fronts siguen sin correr — ✅ HECHA

**Estado: ✅ HECHA** — commit `1aecb47`. T-32 había montado el runner; faltaba la mitad de
atrás, que era la peor.

**Los tests corrían SIN tipar.** Los tres tsconfig seguían con `"exclude": [..., "*.test.ts"]` y
su propio comentario "⚠️ Al cerrar T-32: borrar esta línea". Parecían cubiertos y no lo estaban.
Al sacar las tres líneas aparecieron errores reales en dos archivos que nunca habían pasado por
`tsc`: 12 accesos por índice sin chequear en `resumen-pagos.test.ts`, y un grupo de regex
`string | undefined` en `demo-coherente-con-panel.test.ts`.

**Y el CI no los corría**: `revision.yml` sólo tenía los de `api`. Los **95 tests de front**
(24 inquilino + 27 inmobiliaria + 44 propietario) no los ejecutaba nadie salvo a mano.

El runner nuevo es `scripts/test-fronts.mjs` y no un `pnpm --filter`: en Windows pnpm corre los
scripts vía `cmd.exe` y un `pnpm` anidado no se resuelve con corepack, así que esa versión era
config de CI imposible de probar en local antes de pushear.

**Experto:** BE/OPS · **Prioridad:** 🟡 · **Depende de:** T-32 (ya tomada)
**Origen:** T-46.

No hay runner de tests para las apps de front: ni `vitest` ni config en ninguna, ni tarea `test`
en `turbo.json`. Montarlo es **T-32**, que ya está tomada — esto no es una tarea paralela, es el
recordatorio de lo que hay que limpiar **al cerrarla**.

Archivos que hoy no corre nadie:

| Archivo | De |
|---|---|
| `apps/inquilino/src/lib/tipo-contrato.test.ts` | previo |
| `apps/inquilino/src/lib/saldo-liquidacion.test.ts` | T-45 |
| `apps/propietario/src/lib/demo-data.test.ts` | T-46 |
| `apps/propietario/src/lib/format.test.ts` | T-46 |
| `apps/inmobiliaria/src/lib/alquiler-cobrado.test.ts` | T-01-N1-N5 |

**Al cerrar T-32 hay que borrar la línea `exclude` de los `*.test.ts` en los tsconfig de
`apps/inquilino`, `apps/propietario` Y `apps/inmobiliaria`** — las TRES la tienen, con el aviso
puesto. Si se cierra T-32 sin sacarlas, el runner existe y estos archivos siguen sin tipar ni
correr, que es el peor de los dos mundos.

> La del panel se agregó en **T-01-N1-N5**, por el mismo motivo que las otras dos: sin ella, el
> primer `*.test.ts` del paquete rompe `pnpm typecheck`, porque `vitest` no es dependencia suya.

---

## T-46-N3 · La demo del portal copia los montos del panel a mano

**Experto:** FE · **Prioridad:** 🟢 · **Depende de:** nada
**Origen:** T-46.

`apps/propietario/src/lib/demo-data.ts` cuenta la misma historia que
`apps/inmobiliaria/src/lib/mock-data.ts` —Silvana Morales es `own_002`, con sus tres unidades y
los montos de sus contratos— pero los números están **copiados a mano**, porque son dos apps que
no comparten paquete.

Si alguien cambia el alquiler de Gorriti en el panel, la demo del portal queda contando otra
historia y nadie se entera. Lo que sí está atado es la aritmética interna de cada rendición, que
tiene test.

No es urgente: es barato de sostener a mano y un paquete compartido de mocks es más costo que
beneficio hoy. Queda escrito para que el día que se desincronice, se sepa por qué.

---

## T-44-N1 · Volvió a haber trabajo terminado fuera de la rama que se deploya — ✅ HECHA

**Estado: ✅ CONSOLIDADA** — commits `eec9270`, `1a4dbb1`, `012b374`. Detalle en
`work-agent/tareas/T-44-N1/estado.md`.

**Experto:** OPS · **Prioridad:** 🔴 · **Origen:** revisión post-T-46.

T-44 consolidó bien lo que había, pero el problema **no es un evento, es un goteo**: mientras se
mergeaba, otros chats seguían terminando tareas en sus worktrees. En horas volvió a haber **diez
ramas** con nueve commits afuera.

Lo grave: **cinco tareas figuraban ✅ en este mismo documento y su código no estaba en la rama
que se deployaría** — T-36, T-40, T-23-N3, T-23-N1 y T-21-N3-N3 — más **T-25 entera**
(conmutador + bloqueo por inactividad, 17 archivos y una migración). Un ✅ que no está en la rama
de deploy es peor que un pendiente: nadie lo vuelve a mirar.

Cuatro conflictos, **ninguno cosmético**. El más caro: un mensaje que decía "cambiar expensas
todavía no se puede desde el panel, avisale al equipo" cuando el endpoint y el botón ya existen
—verificado, no asumido—. Entraba una regresión que mandaba al operador a pedir por mail algo
que ya podía hacer solo.

Verificado: `tsc` 0 en los seis paquetes y **385/385** tests sin base (39 archivos), contra
360/37 antes de consolidar: **+25 tests que estaban escritos y no corría nadie**.

⚠️ **Sube la cuenta de T-01.** Entraron migraciones que no estaban en la rama, entre ellas
`20260819180000_conmutador_usuarios`, que agrega cuatro valores a `TipoEventoAuditoria`. El
código de T-25 los escribe: **deployar el código sin la migración rompe el conmutador al
auditar**, igual que pasó con `RENOVACION`. Van juntos.

---

## T-44-N2 · Los otros tres `?? 100` de la rendición — ✅ HECHA

**Estado: ✅ HECHA** — commit `647d892`. Los cuatro repartos de `POST /rendiciones` tiran ahora
`ParticipacionAusente`; no queda ningún `?? 100`. Se verificó la cadena `propIds` →
`propIdsConIngreso` y **ninguno era bug vivo**: son minas que se activan el día que las
participaciones se filtren por vigencia. El 409 dejó de nombrar sólo a las liquidaciones, porque
ahora lo tiran cuatro caminos. Test de fuente que se comprobó en rojo inyectando la regresión.
Detalle en `work-agent/tareas/T-44-N2/estado.md`.

**Experto:** BE · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** T-44-N1.

T-23-N3 sacó el `part?.porcentaje ?? 100` del bucle de **alquileres** de `POST /rendiciones`,
porque un `find` que no matchea le atribuye el alquiler ENTERO a ese dueño, en silencio.

En el mismo endpoint quedan **otros tres** con el patrón idéntico: gastos, gastos de reclamos y
otros ingresos. El razonamiento aplica igual —un gasto mal atribuido le carga al dueño el 100% de
algo que era parcial—, pero se dejaron como están: extenderlo cambia el comportamiento de rutas
que el autor de T-23-N3 no testeó, y meterlo adentro de un merge de consolidación era la forma
más fácil de romper algo sin que se note.

**Criterio de aceptación.** O los tres tiran `ParticipacionAusente` como el de alquileres, o está
escrito por qué en esos tres el `?? 100` sí es correcto.

---

## T-44-N3 · Nada avisa cuando una rama terminada se queda afuera — ✅ HECHA

**Estado: ✅ HECHA** — commit `121ce0c`. `pnpm ramas` en local + un job aparte en `revision.yml`.
Detalle en `work-agent/tareas/T-44-N3/estado.md`.

⚠️ **Al hacerla apareció algo más grande que la tarea:** ninguna rama de tarea está pusheada, y la
rama de integración **no existe en origin** — 263 commits en un solo disco, sin backup y sin que
el CI los haya visto nunca. El script avisa las dos cosas por eso. **Pushear es tuyo.**

**Experto:** OPS · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** T-44-N1.

Van dos rondas de consolidación (T-44 y T-44-N1) y las dos empezaron igual: alguien se sentó a
mirar y encontró trabajo terminado que no estaba en la rama de deploy. Entre una y otra pasaron
horas.

No hay nada que lo detecte. El CI corre typecheck y tests **de la rama que le toca**, así que una
rama sana y olvidada da verde para siempre sin que su código llegue a ningún lado.

Lo que alcanzaría: un job que liste las ramas con commits fuera de la de integración y falle —o
avise— si alguna tiene más de N días o más de N commits. Es la misma consulta que se corrió a
mano acá:

```bash
for b in $(git branch --format='%(refname:short)'); do
  n=$(git log --oneline "$INTEGRACION..$b" | wc -l)
  [ "$n" -gt 0 ] && echo "$b: $n commits afuera"
done
```

**Criterio de aceptación.** Que enterarse deje de depender de que a alguien se le ocurra mirar.

---

### T-01-N1-N5 · El panel muestra números de rendición que no son los de la rendición — ✅ HECHA
**Experto:** FE-P · **Prioridad:** 🟠 · **Detectada en:** barrido adversarial (T-01-N1)

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-01-N1-N5/REQUISITOS.md`.

Dos hallazgos que el barrido marcó como deuda vieja —no eran regresiones del merge— y quedaron
sin registrar. Revalidados hoy contra el código: seguían.

**1. La plata.** El KPI del dashboard prorrateaba la porción de alquiler cobrado contra
`l.montoTotal`, con el comentario *"el cap deja afuera la mora"*. No la deja: ese `montoTotal`
viene decorado por `conSaldo` con el punitorio al día, y el tipo del propio panel lo dice tres
líneas más arriba. El server prorratea contra la base de la fila, sin mora.

| caso | server (lo que se rinde) | panel (lo que mostraba) |
|---|---|---|
| pago total sin mora | 100,00 | 100,00 |
| pago **parcial** en mora | 50,00 | **45,45** |
| con expensas y mora | 100,00 | **90,91** |

Coincidían mientras no hubiera atrasos, que es por qué duró. Con mora, el panel le mostraba a
la inmobiliaria **menos alquiler cobrado del que la rendición le iba a pagar al propietario**.

**2. La fecha.** `RendicionApi` declaraba `createdAt?: string`, un campo que el modelo
`Rendicion` **no tiene** — el API devuelve la fila cruda de Prisma, que trae `rendidoAt`. Como
llegaba siempre `undefined`, las dos pantallas caían al fallback `${periodo}-01`: una rendición
de julio hecha el 12 de agosto se mostraba como **1 de julio**. Es el dato con el que alguien
contesta *"¿cuándo le pagaste a Silvana?"*.

**Verificado:** 10 tests que comparan contra la fórmula del server (2 rojos al anular el cap);
la fecha la agarra `tsc` con dos TS2339; `tsc` 0 en los cinco paquetes; 391 tests verdes.
**No verificado:** no se probó en el navegador.

---

## T-27-N1 · El sitio estático se verificó entero por primera vez — ✅ HECHA

**Estado: ✅ HECHA** — commit `f94a5f9`.

**Experto:** OPS · **Prioridad:** 🟡 · **Origen:** verificación posterior a T-46.

Se corrió `scripts/build-static.sh` de verdad, con las tres apps, cosa que no se había hecho
nunca —T-46 sumó `propietario` al pipeline pero sólo se había buildeado esa app suelta—.

**El sitio se arma bien.** Las cuatro puertas del picker resuelven a páginas reales
(`presentacion/`, `inmobiliaria/`, `inquilino/`, `propietario/`, más `legales/`), y el portal del
propietario sale con sus datos de demo horneados y sin el mensaje de "no conectado".

**Lo único que falla es conocido y es de Windows.** `/(landing)/inicio/opengraph-image` tira
`TypeError: Invalid URL`: `@vercel/og` le pasa una URL a `path.join`, que en Windows devuelve
`file:\C:\...` —inválida— y en POSIX `file:/...`, que Node acepta. Ya estaba diagnosticado en
T-27 (`eb1e1c2`). **No afecta el deploy**, que corre en `ubuntu-latest`. Apartando esa ruta, el
panel compila entero.

**Dos defectos del propio script, arreglados:**

1. El apagado de dev servers era un **no-op silencioso**: usaba `lsof`, que no existe en Git Bash
   de Windows, y el `|| true` se comía el error. El script decía "Apagando proceso" sin apagar
   nada.
2. **Abortaba tarde.** El guard por app salta recién al llegar a la suya, así que con el 3003
   tomado se buildeaban inmobiliaria e inquilino enteras —minutos— antes de morir. Ahora se
   miran los tres puertos antes de compilar nada.

Ninguno de los dos rompía el deploy real (en el runner hay `lsof` y no hay dev servers): rompían
la prueba local, que es donde uno mira antes de pushear.
### T-01-N1-N6 · Se podía borrar un gasto que a un co-dueño ya se le descontó — ✅ HECHA
**Experto:** BE-P · **Prioridad:** 🟠 · **Detectada en:** barrido adversarial (T-01-N1)

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-01-N1-N6/REQUISITOS.md`.

`DELETE /caja/movimientos/:id` protegía el borrado con `descontadoEnRendicion: false`. Ese flag
**no significa "no se le descontó a nadie"**: significa "todavía no se cubrió el 100%". Lo dice
el propio armado de la rendición, más abajo en el mismo archivo.

Departamento 50/50: se rinde a Silvana, se le descuentan $50.000, el flag sigue en `false`
porque falta el hermano, y el borrado **pasaba**. Ella quedaba con el descuento hecho sobre un
gasto que ya no existe, él no lo pagaba nunca, y el movimiento no estaba ni para auditarlo. Con
un solo dueño no pasa —la primera rendición cubre el 100%—, que es por qué duró: el caso roto es
el minoritario.

**El candado pasa a mirar `GastoRendido`**, que es el registro que dice que a alguien ya se le
cobró y que existe desde la **primera** parte rendida. Va dentro de una transacción para no
reabrir la carrera que el `deleteMany` atómico había cerrado; el flag se conserva en el `where`
del delete, que es el candado contra una rendición concurrente.

**Verificado:** 5 tests puros, 2 se ponen rojos al volver al candado viejo; `tsc` 0 en los cinco
paquetes; 395 tests verdes.

---

### T-01-N1-N7 · La baja de un propietario existe en la API y no hay cómo usarla
**Experto:** FE-P + PROD · **Prioridad:** 🟠 · **Depende de:** una decisión de UX
**Origen:** barrido adversarial de T-01-N1.

**Estado verificado.** `PATCH /propietarios/:id/activo` está construido, autenticado, con su
409 de cobranza directa y su migración escrita (T-23-N4). **Ningún front lo llama:**

```
grep -rn "/activo" apps/inmobiliaria/src/   →  sin resultados
```

O sea: se puede dar de baja a un propietario por HTTP y **no desde el producto**. Camila no
tiene botón. La feature está entregada del lado del server y es inalcanzable del lado de quien
la iba a usar.

**Por qué importa más de lo que parece.** T-23-N4 explica que la baja lógica es lo que corta el
acceso de un ex-propietario al portal. Hoy, para que un dueño que vendió su departamento deje de
ver la cartera, hay que **borrarle el email a mano** desde la ficha — que funciona, pero es un
efecto lateral de otra cosa, no está documentado como el procedimiento, y nadie lo sabe.

**Por qué no se hizo acá.** Agregar el control es una decisión de UX sobre el producto
terminado: dónde va (¿ficha del propietario? ¿listado?), qué dice, si pide PIN como las otras
acciones sensibles, y qué pasa con los que ya están dados de baja (¿se listan? ¿se filtran?).
Eso lo define el dueño, no un agente. **Queda escrito, no construido.**

**Riesgo de no hacerlo.** Que se dé por entregada una capacidad que nadie puede ejercer — el
mismo patrón que T-46 con el portal del propietario.

---

### T-02-N1 · Los fronts no decían qué commit estaban corriendo — ✅ HECHA
**Experto:** OPS + FE · **Prioridad:** 🟠 · **Detectada en:** T-02, al verificarla contra Railway

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-02-N1/REQUISITOS.md`.

T-02 partía de dos afirmaciones. La primera —*"los servicios no están conectados a GitHub,
pushear a `main` no deploya"*— es **falsa** y ya está corregida arriba y en `02-DEPLOY.md`.

La segunda sí era cierta: *"ningún front expone un build-id cruzable con git, así que hoy no hay
forma de saber en qué commit están el panel y la PWA"*. Ese era el agujero que hacía imposible
**verificar** un deploy: con la API se puede desde que existe `/health`; con los fronts no.

**Lo que se hizo:** un `<meta name="build-commit">` en el `<head>` de los tres fronts, con el
SHA horneado en build. Va como meta y no como endpoint porque los tres se buildean también en
static export para Pages, donde no hay servidor que conteste un `/version`. El SHA sale de
`RAILWAY_GIT_COMMIT_SHA` (declarado como ARG en cada Dockerfile, igual que las de PostHog) o de
`GITHUB_SHA` en Actions; sin ninguna de las dos dice `desconocido`, mismo criterio que `/health`.

De ahora en más:

```bash
curl -s https://admin.myalquiler.com | grep build-commit
```

**Verificado buildeando de verdad, los tres:** con la variable sale el SHA truncado a 7
(`abc1234`, `feedfac`, `cafebab`); sin la variable sale `desconocido`, no vacío ni `undefined`.
`tsc` 0 en los cinco paquetes y 395 tests verdes.

**Nota:** el build del panel **falla en Windows** (la imagen OpenGraph de la landing revienta en
`@vercel/og` con `fileURLToPath` sobre una ruta `file:///C:/...`). En Linux compila —CI está en
verde— así que no bloquea nada, pero el meta se verificó leyendo el HTML que Next genera antes
de ese paso. Queda anotado en T-02-N2.

### T-02-N2 · El panel no compila en Windows — ✅ HECHA

> ### ✅ Resuelta el 20/08. Ver `work-agent/tareas/T-02-N2/REQUISITOS.md`.
>
> **Las opciones que parecían baratas no servían, y se comprobó.** `next/og` lee su fuente en el
> TOP LEVEL de su módulo, así que revienta apenas se renderiza, antes de mirar ninguna prop:
> `new ImageResponse(...).arrayBuffer()` tira `Invalid URL` con cualquier contenido. No hay
> arreglo por configuración.
>
> **Lo que se hizo:** la imagen pasa a ser un PNG estático —**el mismo que ya estaba publicado**,
> bajado de la landing, 1200×630 y 114.844 bytes, no cambió un pixel— con su `alt` en un `.txt`,
> y el JSX se mueve a `_og/` (fuera del ruteo) como fuente regenerable, con las instrucciones
> adentro.
>
> **Verificado:** `next build` del panel **en Windows da exit 0** y genera `out/` completo; el
> PNG sale con el mismo nombre-hash y los mismos bytes; y la metadata queda igual (`og:image`,
> type, width, height y alt).
**Experto:** FE · **Prioridad:** 🟡 · **Depende de:** nada

`next build` de `apps/inmobiliaria` termina en exit 1 en esta máquina:

```
Error occurred prerendering page "/inicio/opengraph-image-b368cs"
TypeError: Invalid URL … at fileURLToPath … @vercel/og/index.node.js:18988
```

**En Linux no pasa** — el `Deploy to GitHub Pages` del merge `94d4000` compiló las tres apps en
2m24s. Es un problema conocido de `@vercel/og` en Windows.

**Por qué igual importa:** cualquiera que trabaje en el panel desde Windows no puede correr
`pnpm build` localmente, y el error no dice "esto es de Windows" — dice que falla el prerender,
que parece un bug propio.

**Contexto de cómo apareció:** el `main` anterior (`70d4be8`) también fallaba, pero **antes**, en
`/inquilinos/[id]` sin `generateStaticParams()`. Ese se arregló y el build ahora llega más lejos
y choca con éste. O sea no es una regresión: es el siguiente escalón, que antes estaba tapado.

**Opciones** (no se eligió ninguna, es decisión de quién mantiene la landing): darle a la ruta
un `export const dynamic = 'force-static'` con la imagen pre-generada, reemplazar `next/og` por
un PNG estático en `public/`, o dejarlo y documentar que el build local del panel no corre en
Windows.


---

## T-37-N2 · La matriz prometía un "queda pendiente" que sólo existe para contratos — ✅ HECHA

**Estado: ✅ HECHA** — commit `60a268d`. Detalle en `work-agent/tareas/T-37-N2/estado.md`.

**Experto:** FE-P · **Prioridad:** 🟠 · **Origen:** se tomó T-37-N1 y apareció esto al leer la matriz.

T-37 sacó de `pago.manual.cargar` un `rolesAprobacion: ['OPERADOR']` que describía un circuito
nunca construido. La misma mentira seguía viva en **otros dos lugares de la misma pantalla**
(Configuración → Equipo, donde se reparten los roles):

1. El rótulo del grupo decía *"(queda pendiente si no es Admin)"* arriba de **cinco** filas y era
   cierto en **una** — circuito hay uno solo, el de contratos.
2. La descripción del rol CARGA decía *"Lo que carga queda pendiente de aprobación"*, y de las
   tres cosas que carga eso vale para los contratos nomás.

El test fija el invariante de fondo: `rolesAprobacion` es lo único que pinta el badge
"pendiente", así que sólo puede estar donde el circuito existe. Comprobado en rojo reinyectando
las dos mentiras.

**No construye el circuito de pagos** — eso sigue siendo T-37-N1, y sigue necesitando tu decisión.
---

### T-01-N1-N1 · Los 52 tests que nunca corrieron — ✅ HECHA (el job no bloquea todavía)
**Experto:** QA + OPS · **Prioridad:** 🟠

> **Estado: ✅ hecha.** Ver `work-agent/tareas/T-01-N1-N1/REQUISITOS.md`.

De 94 archivos de test, la compuerta miraba 42. Los otros **52 no habían corrido nunca**: la
única base era una remota compartida que `seedBase` siembra destructivamente. Son los de plata,
auth, depósitos, conciliación y rendición multi-dueño.

Ahora corren contra un **service container de Postgres**, efímero por corrida. Verificado contra
una Postgres en Docker antes de escribir el YAML: **378 de 383 pasan**, las 57 migraciones
aplican desde cero en ~25 s, y **`postgres:16` pelado alcanza** — la nota original decía que
hacía falta pgvector y estaba equivocada (venía de `CLAUDE.md`, que describe una extensión que
el proyecto nunca usó).

**Correrlos encontró un bug real, el primero que agarra este job:** dar de alta a otra persona
(distinto DNI) con un email ya usado devolvía **200** en vez del 409 que el propio endpoint
promete. `buscarOCrearPersona` devuelve la Persona existente en ese caso —deliberado, lo necesita
la importación de cartera— y al compartirse con el alta manual dejó ese 409 inalcanzable: el
contrato quedaba colgando en silencio de **la persona equivocada**. Arreglado sólo en el alta
manual, sin tocar la importación.

**El job NO bloquea todavía**, a propósito. Las 4 rojas restantes son de `core.test.ts`, que
cuenta filas del seed y encuentra las que dejaron las suites anteriores — corriéndolo solo da
7/7. No son bugs del producto. Ver **T-01-N1-N1-N1**.

### T-01-N1-N1-N1 · Las suites de integración se pisan entre sí — ✅ HECHA

> ### ✅ Cerrada el 20/08. La suite da **52/52 · 387 tests** y el job **ya bloquea**.
>
> Eran dos causas distintas, no una:
>
> **1. Los conteos del seed** (4 rojas de `core.test.ts`). Ya lo había arreglado otro chat
> cambiando `toBe(8)` por `toBeGreaterThanOrEqual(8)`: la aserción pasa a decir lo que de
> verdad importa —que los 8 del seed están y vienen con sus joins— en vez de exigir que la base
> no tenga nada más.
>
> **2. Una limpieza que se salía de su territorio** (el archivo entero de `multi-alquiler`).
> Su `afterAll` borraba propiedades matcheando `direccion contains "Rivadavia"`, y
> `importacion-morosos.test.ts` **también usa direcciones con Rivadavia**. En una corrida
> completa intentaba borrar propiedades ajenas, con contratos y pagos que no limpia, y moría
> con violación de FK. Por eso corriéndolo solo pasaba y en la suite era el único rojo.
>
> Se acotó a las propiedades que el propio archivo crea (por id, no por texto), y de paso le
> faltaban dos pasos que el limpiador oficial documenta: cortar el lazo `propiedad.contratoActualId`
> antes de borrar el contrato, y borrar el `EventoContrato` que el alta escribe desde T-29.
>
> **Se sacó el `continue-on-error` del job `integracion`.** Si vuelve a ponerse rojo, frena el
> merge — que es el punto: con push a `main` deployando producción, ese job es lo único que hay
> entre un merge y la plata de la inmobiliaria.
**Experto:** QA · **Prioridad:** 🟡 · **Depende de:** nada

Las ~50 suites comparten una base y las que cuentan filas del seed fallan por lo que dejó la
anterior. El síntoma es reconocible: **"expected 19 to be 8"**. No es un bug del producto —
`core.test.ts` corriendo solo contra una base limpia da 7/7.

Es lo único que falta para que el job de integración **bloquee** en vez de sólo mirar.

**Dos caminos ya probados y descartados, para no repetirlos:**

| intento | qué pasó |
|---|---|
| `limpiar-test-db.ts` como `setupFiles` | **empeoró: de 6 rojas a 39 archivos rotos.** Está escrito para correr ENTRE corridas; a mitad de suite choca con las FK RESTRICT y deja los `afterAll` sin `app` ni `prisma` |
| ordenar `include` para que las sensibles vayan primero | **vitest no respeta ese orden** — se pidió `core.test.ts` primero y corrió `plata.test.ts` |

**Lo que probablemente sí funciona** (sin probar): un `sequence.sequencer` propio de vitest para
forzar el orden, o que cada suite cree su tenant `ZZ-TEST-*` en vez de compartir el del seed —
que es lo que ya hacen varias y por eso no se pisan.

**Cuando cierre:** sacar `continue-on-error: true` del job `integracion` en
`.github/workflows/revision.yml`. Está anotado ahí también.

---

## T-28-N3 · Las limpiezas de los tests se rompen solas cuando el alta escribe un hijo nuevo — ✅ HECHA

> ### ✅ Resuelta el 20/08 por un tercer camino. Ver `work-agent/tareas/T-28-N3/REQUISITOS.md`.
>
> **Los dos caminos que propone abajo quedaron descartados, con razón.** Cascadear cambiaría
> PRODUCCIÓN —las migraciones se aplican solas en el deploy y hoy el RESTRICT es lo que impide
> que borrar un contrato se lleve pagos en silencio—. Y envolver cada test en una transacción
> no funciona acá: los tests pegan por `app.inject` y la app tiene su propio cliente de Prisma
> en otra conexión, así que la transacción del test no envuelve lo que escribe la app.
>
> **Lo que se hizo:** `prisma/borrar-contratos-de-test.ts` (nietos → los 22 hijos en orden → el
> contrato → el lazo) y `test/hijos-de-contrato-sincronizados.test.ts`, que lee el schema y se
> pone rojo si aparece un hijo o un nieto nuevo, si el orden viola una FK entre hijos, o si el
> nombre de una columna FK no coincide.
>
> **Corrección al texto de abajo:** no son 22 FK todas RESTRICT. Son 23 constraints hacia
> `contratos` —**16 RESTRICT y 7 SET NULL**— y una de ellas es la inversa
> (`propiedades.contratoActualId`, SET NULL, que **nunca** bloqueó borrar el contrato). El dato
> está en el SQL de las migraciones, no en `schema.prisma`, que no declara los `onDelete`.

**Experto:** BE · **Prioridad:** 🟡 · **Depende de:** nada
**Origen:** T-28-N2, corriendo los 94 archivos del API por primera vez.

**El síntoma.** `multi-alquiler.test.ts` se cayó entero — no por su lógica, sino por su
`afterAll`. Borraba los contratos que crea, y desde **T-29** el alta escribe además una fila en
`eventos_contrato`. Como ninguno de esos FK cascadea, el `deleteMany` se comió un
`eventos_contrato_contratoId_fkey`. El test no cambió: cambió lo que el alta hace.

**El problema de fondo.** De los **22 modelos que cuelgan de `Contrato`, ninguno declara
`onDelete: Cascade`**:

`AjusteAlquiler`, `BoletaServicio`, `CargoContrato`, `CargoPagado`, `CertificadoInquilino`,
`ChatMensaje`, `CoInquilino`, `Comprobante`, `ContratoDraft`, `DocumentoContrato`,
`EventoContrato`, `Garante`, `Inquilino`, `InquilinoInvitado`, `IntencionRenovacion`,
`Liquidacion`, `MovimientoCaja`, `MovimientoFeed`, `Pago`, `Reclamo`, `RenovacionContrato`,
`Screening`.

Cada teardown borra a mano los pocos hijos que su propio flujo llega a crear, y **funciona por
casualidad**: mientras el alta no escriba uno más. Es una bomba de tiempo repartida por toda la
suite, y explota lejos de su causa — el fallo aparece en el `deleteMany` del teardown, no en la
feature que agregó el hijo.

**Por qué no se arregló en T-28-N2.** Ahí se tapó el agujero puntual (dos capas: los eventos, y
que los contratos se deducían de un solo lado). El arreglo de fondo son dos caminos y ninguno
entra en un fix de limpieza:

1. **Cascadear** los FK que son de composición de verdad (evento, liquidación, cargo, documento…)
   — es una migración y hay que pensar cuáles NO deben cascadear, porque borrar un contrato no
   debería llevarse pagos en silencio.
2. **Envolver cada test en una transacción que revierta** al terminar, y así no borrar nada a
   mano. Es el patrón estándar y mata la clase entera de bug, pero toca todos los `afterAll` y
   hay que ver cómo convive con `seedBase`.

**Criterio de aceptación.** Que agregar un hijo nuevo de `Contrato` no rompa el teardown de
ningún test — o que esté escrito cuál de los dos caminos se eligió y por qué.

**Riesgo de no hacerlo.** Bajo hoy, molesto siempre: cada vez que alguien toque el alta, algún
test lejano se pone rojo por una razón que no tiene nada que ver con lo que cambió, y se pierde
media hora entendiendo que era la limpieza.

---

### T-01-N1-N9 · La compuerta reporta, no frena — y yo dije que frenaba
**Experto:** OPS + **el dueño** · **Prioridad:** 🟠 · **Depende de:** una acción tuya

> Ver `work-agent/tareas/T-01-N1-N9/REQUISITOS.md`. **La corrección de las afirmaciones está
> hecha; lo que cierra la tarea es de configuración y no lo corrí yo.**

Durante los últimos días construí `revision.yml`, le puse base de datos, le saqué el
`continue-on-error` y le sumé los builds — y en cada paso dije que **bloqueaba**. **No frena
nada.** Verificado el 20/08:

- **`main` no tiene branch protection**: `GET /branches/main/protection` → 404.
- **`deploy.yml` (Pages) no depende de `Revisión`**: se dispara solo con el push.
- **Railway deploya con el push**, y eso no se puede condicionar desde el repo.

Con los cuatro jobs en rojo, el código sale a producción igual. Que un job falle no es lo mismo
que frenar un merge, y la diferencia es justo la que importa.

**Lo notable:** el encabezado original del workflow lo decía bien —*"NO bloquea el deploy
todavía… volverlo required es del dueño"*—. La afirmación se deslizó **después**, al sacar el
`continue-on-error`. Confundí "el job hace fallar el workflow" con "el workflow frena algo".

**Por qué es serio:** el riesgo es la confianza falsa. Un verde que no frena se lee igual que uno
que sí, y este proyecto ya tuvo el deploy roto dos semanas y media porque nadie miraba lo que
nadie estaba obligado a mirar.

**Lo que falta y es tuyo:** marcar `revision`, `integracion`, `build` y `ramas-sin-integrar` como
**required** en la branch protection de `main`. El comando exacto está en la hoja, junto con las
tres cosas que hay que saber antes de apretar — sobre todo que **se acabaría el push directo a
`main`**, que es como trabajan hoy todos los chats.

> ### 🟢 Hallazgo de otra sesión (20/08) — hay un camino que NO termina con el push directo
>
> **Railway tiene `Wait for CI` nativo**, y hace innecesario tanto desconectar el repo como
> marcar los checks *required*. De su doc (`docs.railway.com/deployments/github-autodeploys`):
> el deployment queda en **`WAITING`** mientras corren los workflows; si alguno falla queda
> **`SKIPPED`**; si dan verde, procede.
>
> **Por qué importa más que la opción de esta hoja:** *required checks* gatea el **merge** —y
> por eso se lleva puesto el push directo a `main`, que es como trabajan los ~40 chats—.
> `Wait for CI` gatea el **deploy**. Misma protección sobre la plata de la inmobiliaria, sin
> tocar el modelo de trabajo. Y no se pierde `RAILWAY_GIT_COMMIT_SHA` (o sea `/health` sigue
> diciendo qué commit corre), ni el rollback de la UI, ni el historial de deployments.
>
> **Costo:** tres toggles en la UI, uno por servicio. **No se puede por API** — verificado:
> `update_service` de la MCP de Railway no expone ni ese flag ni el de autodeploy.
>
> **Lo único a verificar al activarlo:** Railway documenta como requisito un workflow con
> `on: push: branches: [main]`. `deploy.yml` tiene esa forma exacta; **`revision.yml` usa
> `branches-ignore: [gh-pages]`**. Si Railway sólo reconoce la forma literal, esperaría a Pages
> y **no** a esta compuerta — lo peor de los dos mundos. Se comprueba mirando que el próximo
> deploy pase por `WAITING` y tarde lo que tarda `integracion`. Si no, es una línea.
>
> **Contexto que se relevó de paso, por si sirve:** se diseñó y se sometió a revisión
> adversarial la alternativa de desconectar el repo y deployar desde Actions con `railway up`.
> Tiene cuatro roturas reales y por eso NO se recomienda: (1) `railway up --ci` termina cuando
> termina el *build*, no cuando el contenedor está sano, y un smoke test por commit da verde
> leyendo el contenedor viejo; (2) el run pasaría a durar ~25-30 min contra una cadencia de un
> push cada ~5 min (105 commits a `main` en 24 h), así que la cola no drena y **producción
> retrocede sola**; (3) `needs:` espera a que los jobs concluyan aunque el `if:` ignore el
> resultado, así que una palanca de emergencia sirve con la CI en rojo pero no con la CI
> colgada —y no hay un solo `timeout-minutes` en `revision.yml`—; (4) al desconectar se pierde
> `RAILWAY_GIT_COMMIT_SHA` y hay que inyectar el SHA a mano en los tres Dockerfiles.
>
> **Dato verificado que despeja una objeción:** `ramas-sin-integrar` **no puede** poner rojo el
> workflow — `scripts/ramas-sin-integrar.mjs` sólo sale con 1 si recibe `--fallar`, y el
> workflow lo invoca con `--remotas`. Así que el job-aviso no bloquearía ningún deploy.

**Corrección al dato de las cancelaciones:** escribí que `Revisión` "se cancela sola seguido" y
lo medí después: **3 de 40 (7,5%)** — y más tarde **7 de 40 (17,5%)**, porque el job `build` que
agregué es largo y se lleva las cancelaciones. **Corregido en T-01-N1-N12:** ya no se cancela en
`main`. No es un obstáculo para
volverlos required — alcanza con re-correr esa una.

---

### T-01-N1-N10 · Hay trabajo terminado varado en ramas que nadie mira — ✅ RELEVADA
**Experto:** OPS · **Prioridad:** 🟠

El job `ramas-sin-integrar` viene reportando y nadie actúa. Medido el 20/08, lo que falta de
`main`:

| rama | commits | archivos | edad | veredicto |
|---|---|---|---|---|
| `feat/corregir-contrato-rechazado` | 22 | 23 | 16d | **falta en parte** |
| `feat/revision-contrato-aprobacion` | 10 | 13 | 16d | **falta en parte** |
| `fix/camila-loop2` | 5 | 15 | 31d | **ya está** (squash-merge `e6e098f3`) → se puede borrar |
| `fix/followups-noche-2026-07-14` | 5 | 3 | 37d | **faltaba una parte** → rescatada en T-01-N1-N11 |
| `feat/landing-mejoras` | 4 | 7 | 37d | **falta entero** |

Se limpiaron además las seis ramas de tarea mías que ya estaban 100% en `main`: ensuciaban el
reporte, que existe para que se vea lo que quedó afuera.

**Lo que queda por decidir es tuyo:** las dos de aprobación de contratos son una feature entera
(revisar antes de aprobar, y corregir + reenviar un contrato rechazado). Ver **T-01-N1-N13**, que
verifica qué pasa hoy al rechazar.

> **Corrección a lo que escribí acá antes.** Había repetido, sin verificarlo, que al rechazar se
> borraba también el `Inquilino` justificándose en un `@@unique` que ya no existe. **Eso no se
> sostiene**: no hay ningún `delete` en el camino de rechazo. Lo verifiqué línea por línea antes
> de dejarlo escrito como si fuera un hecho. Lo que sí es cierto está en T-01-N1-N13.

### T-01-N1-N11 · Al inquilino cuyo pago confirmó el banco se le decía que se lo rechazaron — ✅ HECHA
**Experto:** BE · **Prioridad:** 🔴

> Ver `work-agent/tareas/T-01-N1-N11/REQUISITOS.md`. Rescatado de la rama varada de 37 días.

`Pago` usa un solo `RECHAZADO` para "el comprobante del inquilino no servía" y para "la
inmobiliaria dio de baja un cobro propio". Los distingue **un prefijo en la `observacion`**, que
estaba escrito a mano en tres archivos. Cuando la conciliación por extracto bancario empezó a
cerrar avisos de pago, su autor no tenía cómo saber que la convención existía.

**Resultado:** el inquilino avisaba que pagó, **el banco lo confirmaba**, y se le mostraba *"Tu
pago fue rechazado"*, se lo publicaba en el feed con severidad crítica, se le filtraba la nota
interna y **se le bajaba el nivel de buen pagador del certificado** — exactamente lo que el
comentario de `PAGO_RECHAZADO_REAL` dice que hay que evitar.

**Arreglado**, con el prefijo centralizado en `lib/reversion-interna.ts` y un guard que prohíbe
armar una `observacion` a mano en `routes/`. Verificado reintroduciendo el bug: el guard lo
señala con archivo y línea.

**No se inventó un tercer estado:** decirle "la inmobiliaria revirtió este cobro" sigue siendo
raro cuando lo que pasó es que su pago se confirmó. Eso es cambio de producto y queda anotado.

---

### T-01-N1-N12 · El job que agregué para tapar el punto ciego era el que más se cancelaba — ✅ HECHA
**Experto:** OPS · **Prioridad:** 🟠

`Revisión` tenía `cancel-in-progress: true` para todas las ramas. Tiene sentido en una rama de
trabajo: si se pushean tres commits seguidos, sólo interesa el veredicto del último.

**En `main` no, y la diferencia importa: cada commit de `main` se deploya a producción**, así que
cada uno merece un veredicto propio. Cancelar ahí deja commits que salieron a producción sin que
nadie los haya verificado nunca.

**Y lo empeoré yo.** Al sumar el job `build` (3-4 min, T-01-N1-N8) la tasa de cancelación en
`main` pasó de **3/40 a 7/40**, y el que se cancelaba era **siempre `build`**: con pushes cada
pocos minutos, el job más largo es el más expuesto. O sea que el job agregado justamente para
tapar el punto ciego de los builds era el que más veces no llegaba a correr.

**Arreglado:** `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. Se sigue cancelando
en ramas, nunca en `main`.

**Efecto colateral bueno:** cuando se marquen los checks como *required* (T-01-N1-N9), esto deja
de ser un problema — que era la objeción #2 de esa tarea.

---

### T-01-N1-N13 · Rechazar un contrato tira la deuda que alguien tipeó, y no hay forma de reenviarlo
**Experto:** BE + PROD · **Prioridad:** 🟠 · **Depende de:** una decisión de producto
**Origen:** T-01-N1-N10, verificando el camino de rechazo de la bandeja de aprobaciones.

**Verificado línea por línea el 20/08** (esto reemplaza lo que había escrito antes de mirar):

1. **Rechazar SÍ borra la deuda declarada.** `plata.ts` pone
   `periodosAnterioresPendientes: Prisma.DbNull` en el mismo `updateMany` que saca el
   `pendienteAprobacion`. Es deliberado y está comentado.
2. 🔴 **SÍ borra el `Inquilino`, y con él sus DOCUMENTOS.** Corregido el 02/09 mirando el
   código: `plata.ts:3311-3317` hace `deleteMany` de `CodigoOtp`, `AnuncioAcuse`,
   **`Documento`** y **`CertificadoInquilino`**, y después del `Inquilino`. Y se justifica
   exactamente en el `@@unique([inmobiliariaId, email])` que **ya no existe**: el schema de
   hoy dice textual «El email NO es único a nivel Inquilino».

   > ⚠️ **Esta nota decía lo contrario, y lo decía como una corrección verificada:** «no hay
   > ningún `delete` en ese camino. Lo verifiqué línea por línea». Era falso — y la versión
   > *anterior*, la que esa corrección tachó, tenía razón. El commit fue `53585412` (20/08).
   >
   > Es la peor forma del error: un documento que afirma que el defecto **no está**, con el
   > tono de quien ya fue a mirar. El que lo lee no vuelve a abrir el archivo. Si algo de acá
   > te suena raro, abrí `plata.ts` — no me creas a mí.
3. **La mitad de corregir ya entró.** `PUT /contratos/:id/borrador` **está en `main`** desde
   el 02/09 (PR #51). Lo que sigue sin existir es `POST /contratos/:id/reenviar-aprobacion`:
   se puede corregir un borrador rechazado, pero no volver a mandarlo a aprobación.

**Lo que esto significa hoy, y por qué NO es un bug.** El comentario del código justifica el
borrado diciendo que *"el contrato rechazado nunca se va a aprobar, así que esa deuda histórica
queda colgada para siempre si no la borramos"*. Con el punto 3 confirmado, **esa premisa es
cierta hoy**: sin camino de reenvío, guardar la deuda dejaría un Json colgando de un contrato
muerto. El borrado es internamente consistente.

**Lo que cuesta.** Quien cargó un contrato con deuda histórica —períodos, montos, todo tipeado a
mano— y se lo rechazan por una coma, **pierde eso y lo tiene que volver a tipear desde cero**.
No es plata perdida: es trabajo perdido y una invitación a equivocarse la segunda vez.

**La decisión.** Son dos caminos y no es mía:

- **Construir el reenvío** (rescatar `feat/corregir-contrato-rechazado`): editar el borrador
  rechazado y volver a mandarlo, con candado de una sola aprobación pendiente por contrato. Ahí
  el borrado de la deuda **hay que sacarlo**, porque su premisa deja de valer. Es lo que la rama
  hacía, y es la razón por la que hacía las dos cosas juntas.
- **Dejarlo como está** y asumir que rechazar significa cargar de nuevo. Entonces al menos
  convendría **avisarlo en el diálogo de rechazo**, que hoy no dice que se pierde nada.

Lo que **no** hay que hacer es sacar el borrado sin construir el reenvío: quedaría el Json
colgado que el comentario describe.

---

### T-01-N1-N14 · El invariante de plata más frágil estaba escrito cuatro veces — ✅ HECHA
**Experto:** BE · **Prioridad:** 🟠

> Ver `work-agent/tareas/T-01-N1-N14/REQUISITOS.md`.

`work-agent/tareas/_integracion/invariantes-plata.md` verifica cinco invariantes **leyendo el
código** — lo dice textual: *"Nada se ejecutó"*. El #1, que él mismo llama el más frágil, decía
que el prorrateo estaba *"espejado en TRES lugares y los tres coinciden"*.

**Eran cuatro, y el cuarto había derivado**: el KPI del panel prorrateaba contra un total que ya
traía la mora sumada, y le mostraba a la inmobiliaria menos alquiler cobrado del que la rendición
realmente pagaba. Se arregló en T-01-N1-N5, pero el episodio es el punto: **una lista a mano de
"dónde vive esta regla" siempre puede quedarse corta**, y nadie se entera hasta que la plata no
cierra.

**Ahora la regla vive una sola vez** en `packages/shared/src/prorrateo.ts` y los cuatro lugares
la consumen. Antes de unificar se verificó que fueran la MISMA función y no cuatro reglas
parecidas; lo son, y la del panel tenía un guard extra —más seguro— que es el que quedó.

**Y un guard contra la quinta copia:** un test barre los cuatro paquetes buscando el esqueleto de
la fórmula y falla si aparece fuera de `shared`. Comprobado reintroduciendo una copia.

**Los invariantes #3 a #6 siguen verificados sólo por lectura.** El #2 se desprende del #1 y
queda cubierto de rebote.

---

## T-28-N2-N1 · Segunda corrida completa: 1057/1065, y una falla que no era del código — ✅ HECHA

**Estado: ✅ HECHA** — commit `e231b79b`.

**Experto:** BE/OPS · **Prioridad:** 🟡 · **Origen:** T-28-N2.

Desde la primera corrida entraron muchísimos commits (los tests puros pasaron de 475 a 647), así
que se volvió a correr la suite entera con base: **125 archivos** ahora, contra los 97 de la vez
pasada. **1057 tests en verde de 1065**, 123 archivos de 125.

**Las 7 fallas eran todas del mismo archivo y ninguna era una regresión.**
`ecosistema-profesionales.test.ts` dio 7 × `expected 401 to be 200`, y **pasa 7/7 corriendo
solo** — y también con los 18 archivos que lo preceden. Tardó **116 s** cuando en aislamiento
tarda 15 s: el `/auth/login` de su `beforeAll` se cayó bajo carga, `token` quedó `undefined`, y
los 7 casos salieron con `Bearer undefined`.

**Lo que se arregló es el diagnóstico, no ese archivo.** El patrón está en **25 archivos**:
loguean con `login.json().token` sin chequear nada, así que cualquier login transitoriamente
fallido produce una tormenta de 401 que parece un problema de permisos, con la causa a un
`beforeAll` de distancia. Ahora hay `test/_login.ts` con `loginTest()`, que falla en el primer
renglón diciendo si fue el rate limit (30 en 15 min) o un usuario que otro archivo dejó
inutilizable.

**El suite es flaky bajo corridas largas, y conviene saberlo antes de creerle:** la primera
corrida tuvo 3 archivos caídos por contención y la segunda 1, siempre distintos y siempre verdes
en aislamiento. La regla quedó en `docs/TESTING.md`: **ante una falla rara, correr el archivo
solo antes de debuggear el código.**

---

## T-28-N2-N2 · Los otros archivos que loguean sin chequear el token — ✅ HECHA (casi)

**Estado: ✅ HECHA en lo que se podía barrer** — commit `612c2fbd`. Eran **68 apariciones, no 25**
(el conteo original miraba archivos, no ocurrencias). Se convirtieron **48 en 37 archivos**: 43 de
`/auth/login` y 5 de `/auth/demo`. Se agregó `loginDemoTest`, porque `/auth/demo` falla igual de
mudo y por dos motivos propios (404 sin `DEMO_MODE`, 500 sin el inquilino demo sembrado).

**Quedan 20 en 13 archivos, y quedaron a propósito:** `return X.json().token as string`, tokens
inline dentro de `headers:`, e injects encadenados. El matcher exigía ver el `inject`
inmediatamente antes Y la URL, así que sólo tocó lo inequívoco — en 46 archivos de test un regex
ambicioso hace más daño que el problema que arregla. Esas formas piden lectura caso por caso.

Verificado con la suite COMPLETA con base, que es la única que prueba algo acá: **1099 tests en
verde, 0 fallas, 128 archivos**.

**Criterio de aceptación original, revisado:** pedía que el grep no devolviera nada. Con las 20
formas irregulares eso es una tarea de lectura, no de barrido, y no vale forzarla con regex.

---

### T-01-N1-N15 · El suite rápido daba 3 rojos falsos, y el guard no decía qué no ve — ✅ HECHA
**Experto:** BE · **Prioridad:** 🟠

> Ver `work-agent/tareas/T-01-N1-N15/REQUISITOS.md`.

Revisión del trabajo de T-01-N1-N14. Cuatro hallazgos; **dos eran falsas alarmas y se anotan
con la evidencia para que nadie los persiga de nuevo.**

**1. `pnpm test:sin-db` no era self-contained.** En un worktree limpio daba 3 rojos en
`sonar-correlacion.test.ts` con `ZodError: DATABASE_URL Required`: varios de esos tests hacen
`buildApp()` y `env.ts` valida con zod al importarse. **Nunca se notó porque los dos lugares
donde se corría lo tapaban** — CI inyecta las variables a mano y el worktree de trabajo tiene un
`.env` sin trackear. Cualquiera que clonara hoy se comía 3 rojos ajenos a su cambio, que es
justo el rojo que enseña a ignorar los rojos. Arreglado en la config, sin pisar el entorno de
quien lo tenga. **De paso: los 16 tests que salían `skipped` también los saltaba la falta de
entorno.** Ahora corren. 625/625.

**2. El guard de prorrateo no decía qué NO ve.** Busca el *esqueleto* `Math.min(...) * (../..)`,
así que una copia que aplique la regla por omisión se le escapa entera. Queda escrito en el test.

**3. `dashboard-helpers.ts:61` comisiona sin capear — NO es bug.** Es deliberado y está
documentado en `lib/api/hooks.ts:1557`: el demo mantiene el 0.08 fijo por paridad byte-for-byte.

**4. `cierre-caja.ts` (demo) no tiene rama PARCIAL — NO es bug.** Es inalcanzable:
`generarLiquidaciones` emite `PAGADO | PENDIENTE | VENCIDO` y nunca `PARCIAL`, y sus cinco
callers la usan cruda. **Pero esa seguridad descansa en el GENERADOR, no en el consumidor**, así
que va un tripwire: si el demo aprende a emitir PARCIAL, `efectivoEnMano` contaría ese mes como
0 de alquiler cobrado en silencio. Verificado en rojo forzando el generador.

**Y dos documentos que quedaron mintiendo:** la tabla de `invariantes-plata.md` apunta a tres
líneas y tres fórmulas inline que ya no existen —se marca en vez de reescribirse, porque el
punto es que tres números de línea a mano se pudrieron en semanas—, y el docstring de
`alquiler-cobrado.test.ts` decía replicar `plata.ts`, hoy un consumidor más del helper.
---

## T-27-N2 · El sitio estático, reverificado 206 commits después — ✅ HECHA

**Estado: ✅ HECHA** — verificación, sin cambios de código.

**Experto:** OPS · **Prioridad:** 🟡 · **Origen:** T-27-N1 lo había verificado y desde entonces
entraron **206 commits**.

**El sitio se arma entero y las cinco puertas resuelven** (`presentacion/`, `inmobiliaria/`,
`inquilino/`, `propietario/`, `legales/`). El portal del propietario sale con sus datos de demo
horneados y **sin** el mensaje de "no está conectado".

**El bloqueante de `opengraph` ya no existe.** En T-27 quedó documentado que `@vercel/og` fallaba
sólo en Windows (le pasa una URL a `path.join`), y había que apartar la ruta para poder verificar.
Alguien la reemplazó por un **PNG estático** y movió el generador a
`(landing)/inicio/_og/opengraph-image.fuente.tsx`. Ya no hay que apartar nada.

**Y el guard de T-27-N1 hizo su trabajo en la vida real:** el 3001 estaba ocupado por el dev server
de otra sesión, así que `build-static.sh` aborta **antes** de compilar nada en vez de gastar dos
builds y morir en el tercero. Para verificar se compiló en un worktree propio, sin tocar ese dev
server.
---

## T-02-N1 · El deploy ya es automático, y eso cambia T-01, T-02 y T-05 — ✅ VERIFICADO

**Estado: ✅ verificado en producción el 21/08**, leyendo Railway, no suponiendo.

**Railway auto-deploya desde `main`.** No hay paso manual que gestionar: cada push a `main`
redeploya los tres servicios (`myalquiler-back`, `myalquiler-front`, `myalquiler-inquilino`), y el
contenedor del API corre `prisma migrate deploy` antes de arrancar.

### T-01 (aplicar migraciones) — ya está hecho

El log del deploy de las 11:24 dice **`63 migrations found`** y sólo una pendiente
(`20260821030000_backfill_pago_condonado`), aplicada con **`All migrations have been successfully
applied`**. Las trece que auditó T-01-N2 **ya habían entrado en los deploys de la madrugada**. El
deploy siguiente confirma: `No pending migrations to apply`.

### T-02 (deployar los tres servicios) — ya está hecho, y se repite solo

API en **SUCCESS**; panel y PWA construyendo commits aún más nuevos. El API quedó sirviendo
tráfico real, con el cron de devengo programado y ejecutado, y **sin errores** en los logs (sólo
un aviso de corepack y un deprecation de Prisma). El apagado del contenedor viejo fue prolijo:
`SIGTERM recibido — drenando requests en vuelo` → `[shutdown] listo`.

### T-05 (congelar deploys en las pruebas) — sube de prioridad

**Es la consecuencia incómoda de lo anterior.** Como *cada* merge a `main` sale a la producción de
la clienta cero sin ningún portón, mientras Camila prueba puede estar cambiándole el piso: es
literalmente lo que pasó en la reunión del 03/08 y lo que T-05 vino a evitar. Hoy no hay nada que
lo impida, y con varias sesiones mergeando en paralelo el riesgo es mayor que cuando se escribió.

Lo barato: acordar la ventana (T-05 tal cual), y anotar el SHA de `/health` al empezar la sesión
para poder descartar después los reportes de una ventana con deploy en el medio.
---

## T-02-N2 · Consolidación a `main`: los 8 arreglos de ola-1 que faltaban — ✅ HECHA

**Estado: ✅ en `main` y deployado** — merge `c83cb5e0`, push a `main` el 21/08.

**Experto:** OPS · **Prioridad:** 🔴 · **Origen:** auditoría de "¿está todo en main y producción?".

`fix/ola-1-riesgos-confirmados` tenía **8 arreglos cerrados que nunca se mergearon**: la demo
pública pidiendo tarjeta y CVV, el recibo del browser declarándose con validez legal, tres
superficies prometiendo Mercado Pago o QR, la conciliación por extracto sin rastro de auditoría,
el alta pública sin freno propio, el arqueo cobrando comisión sobre la migración de cartera, y un
empleado dado de baja bajando archivos del tenant por 15 días.

**El único conflicto no era el esperado.** Se anticipaba un choque con la cuota de disco puesta en
`uploads.ts`; eran en realidad **dos versiones de la revalidación de auth**. Ganó la de ola-1 por
ser superior, no por ser la entrante: `main` revalidaba inquilino y co-inquilino, la de ola-1
revalida **también al `usuario`**, y delega en `requireUsuario`, que devuelve el `inmobiliariaId`
**vigente de la tabla** en vez del congelado en el JWT — clave acá, porque `tenantDe` elige la
carpeta del Volume con ese id, así que un usuario movido de inmobiliaria seguía escribiendo en la
del tenant viejo. Se verificó que los dos arreglos del archivo sobrevivieran.

**Verificado antes de producción:** tsc 0 en los seis paquetes y la suite COMPLETA con base —
**1137 tests en verde, 0 fallas, 134 archivos**.

**Lo que NO se tocó, a propósito:** dos worktrees con trabajo sin commitear
(`docs/verificar-promesas-publicas`, `docs/T-61-canon-snapshot`). Son sesiones escribiendo, y con
`main` auto-deployando a producción, commitear trabajo ajeno a medias shippea algo incompleto.

**Dato operativo:** entre empezar a verificar y pushear, `main` se movió **cuatro veces** en dos
tandas. El push tuvo que rebotar, re-mergear y re-verificar. Es la misma presión que hace falta
para T-05: no hay ventana tranquila si nadie la acuerda.
