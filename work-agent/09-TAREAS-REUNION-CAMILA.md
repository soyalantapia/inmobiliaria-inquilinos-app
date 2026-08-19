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

## T-01 · Aplicar las dos migraciones pendientes

**Experto:** DATA + OPS · **Prioridad:** 🔴 · **Depende de:** nada

**Estado verificado.** Hay dos migraciones **escritas y sin aplicar** en la rama:

- `apps/api/prisma/migrations/20260818120000_rol_caja/migration.sql`
  → `ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'CAJA'`
- `apps/api/prisma/migrations/20260818130000_movimiento_caja_sin_propiedad/migration.sql`
  → `ALTER TABLE "movimientos_caja" ALTER COLUMN "propiedadId" DROP NOT NULL`

**Qué hay que hacer.** Aplicarlas contra producción, en ese orden, **antes** de subir el
backend nuevo.

**Por qué ese orden importa.** Las dos son *aditivas*: agregar un valor a un enum y relajar un
`NOT NULL` son compatibles con el código viejo, así que aplicarlas primero no rompe nada. Al
revés sí rompe: código nuevo contra enum viejo hace que un alta con rol `CAJA` falle con un
error de enum inválido, y un movimiento sin propiedad reviente el `NOT NULL`.

**Criterio de aceptación.**
- `SELECT unnest(enum_range(NULL::"Rol"));` incluye `CAJA`.
- `movimientos_caja.propiedadId` es nullable.
- Ninguna fila existente cambió: los usuarios conservan su rol y todos los movimientos
  conservan su propiedad.

**Riesgo.** Bajo, pero es producción. Las dos son reversibles *mientras no se use la
capacidad nueva*: para volver atrás del `DROP NOT NULL` habría que imputarle una propiedad a
los movimientos que se hayan cargado sin ella.

---

## T-02 · Deployar los tres servicios y verificar qué quedó arriba

**Experto:** OPS · **Prioridad:** 🔴 · **Depende de:** T-01

**Estado verificado.** Los servicios de Railway **no están conectados a GitHub**
(`02-DEPLOY.md:31`): pushear a `main` **no** deploya. Hay que correr `railway up` a mano, por
servicio. El backend expone la versión que corre en `GET /health` (`health.ts:29-31`), pero
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

## T-12 · Hacer descubrible "anular un pago"

**Experto:** FE-P · **Prioridad:** 🟠 · **Depende de:** T-04

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

**Criterio de aceptación.** Camila carga un gasto en una cuenta concreta y ve el saldo de esa
cuenta, sin que nadie le explique dónde está la pantalla.

**Bug adyacente detectado en el mapa del sistema** (no lo pidió ella, pero está acá): el saldo
por cuenta **mezcla monedas** — `cuentas.ts:25-51` agrupa por `cuentaId` y `tipo` **sin
`moneda`**, así que un gasto de US$800 y uno de $80.000 se restan como si fueran la misma
unidad. El resto del sistema es riguroso con esto (la rendición exige moneda única, el cierre
expone `porMoneda`). Vale arreglarlo en la misma pasada.

---

## T-14 · Pago parcial desde la PWA del inquilino

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

## T-24-N2 · Avisar "este DNI ya está en tu cartera" al cargar deuda histórica

**Experto:** FE-P · **Prioridad:** 🟢 · **Depende de:** T-24 (hecho)

Punto 4 del T-24 original, que quedó a medias. El backend **ya unifica** por DNI
(`buscarOCrearPersona`), así que no se duplica nada; pero el diálogo sólo lo dice en texto de
ayuda, no lo confirma después. Camila `[52:00]`: su sistema le avisa *"ya estás registrado"*.

Falta el buscador "¿Ya está en tu cartera?" que el alta normal sí tiene, y que el toast diga a
qué ficha se unió (la respuesta ya devuelve `personaId`).

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

**Estado verificado.** El usuario y la contraseña del admin del tenant real están **en texto
plano** en cuatro archivos versionados: `README.md:24`, `PROJECT.MD:42`,
`work-agent/00-ESTADO.md:39` y `work-agent/05-DECISIONES.md:95`. **El repo estuvo público.**

**Qué hay que hacer.**
1. **Rotar la contraseña** (esto primero, lo demás es secundario).
2. Sacar la línea de los cuatro archivos.
3. Decidir qué hacer con el historial de git, donde va a seguir viva aunque se borre del working
   tree.

**Criterio de aceptación.** La contraseña vieja no sirve y no queda ninguna credencial viva en
archivos trackeados.

---

## T-27 · Arreglar la CI y descongelar la demo

**Experto:** OPS · **Prioridad:** 🟠 · **Depende de:** nada
**Estado: 🟡 PARCIAL** — commit `3a9db72`.
El bloqueante documentado está arreglado y **verificado corriendo el script real de la CI**:
antes moría recolectando page data, ahora genera las 74 páginas.
Dos cosas quedaron abiertas y están en `work-agent/.tareas/T-27/estado.md`:
1. **Endurecer la CI (typecheck/lint) exige editar `.github/workflows/`, y eso lo prohíbe
   05-DECISIONES §5** (el gh token no tiene workflow scope: el push fallaría). El YAML propuesto
   quedó escrito para que lo aplique el dueño a mano.
2. **Apareció un segundo bloqueante que estaba tapado** detrás del primero: la ruta
   `opengraph-image` de la landing falla al prerenderizar (`Invalid URL` en `@vercel/og`).
   Parece específico de Windows y la CI corre en ubuntu, pero no es verificable desde acá.

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

## T-28 · Cubrir con tests los flujos de plata que no tienen ninguno

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

## T-30-N1 · El remitente sigue diciendo "My Alquiler", no la inmobiliaria

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

## T-30-N2 · La invitación al equipo no escapa el HTML

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

`POST /contratos/:id/comunicaciones` guarda el texto completo en `EventoContrato.detalle`, pero
falta verificar si la pestaña Historial lo renderiza o sólo muestra `titulo`. Camila:
*"queda anotado que mandé un mensaje, pero no queda el mensaje… si guarda sólo el asunto no me
sirve para discutir después."* Sin el cuerpo, el registro no cubre el caso de uso real.

### T-18-N2 · El copy de espera de país promete un mail que nadie manda
**Experto:** PROD · **Prioridad:** 🟢 · **Detectada en:** T-18

`apps/inmobiliaria/src/components/configuracion-pais.tsx:183` dice *"avisamos por mail cuando
esté listo"* para un país todavía no disponible. No hay lista de espera detrás. O se construye,
o se cambia el texto.
