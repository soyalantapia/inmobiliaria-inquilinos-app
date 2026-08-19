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

> ⚠️ **Regla que atraviesa todo el documento**: los tests de `apps/api` pegan a la Postgres de
> producción y hacen reset/seed (`docs/TESTING.md:25`). **Nadie los corre** salvo con certeza
> de que la base no es prod. De los 64 archivos de test, **14 son puros** y son los únicos
> seguros de correr en cualquier lado.

---

# BLOQUE A — Cerrar lo que ya está construido

Sin este bloque, el trabajo hecho no le llega a Camila. **Es lo primero.**

---

## T-01 · Aplicar las migraciones pendientes (ahora son CUATRO)

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

## T-23-N1 · El aislamiento del portal no tiene test de integración

**Experto:** BE · **Prioridad:** 🟠 · **Depende de:** base de prueba

Los 5 endpoints del portal están scopeados por `propietarioId` **e** `inmobiliariaId`, y eso se
verificó leyendo y con una revisión adversarial. Pero **no hay una prueba que falle** si mañana
alguien saca un `inmobiliariaId` de un `where`. Para una superficie de lectura sobre datos
financieros de terceros, eso es poco.

Pide una base de prueba (los tests de `apps/api` hoy pegan a la Postgres de producción, así que
esto se cruza con T-28). El caso mínimo: dos tenants, dos propietarios, y que cada endpoint
devuelva 404/vacío al pedir lo del otro.

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

## T-23-N4-N1 · El inquilino titular y la persona no son revocables de ninguna forma

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

## T-30 · El mail sale de un `no-reply` y el copy invita a responderlo

**Experto:** BE + PROD · **Prioridad:** 🟠 · **Depende de:** nada
**Origen:** role play de Camila al ejecutar T-16. No salió de la reunión.

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

**Criterio de aceptación.** Informar y que te rechacen un pago sobre una cuota futura **no**
impide que esa cuota se reajuste después.

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
loguean con ella como los tres roles, y esos tests no se pueden correr desde acá (pegan a la
Postgres de producción). Cambiarla a ciegas era el riesgo mayor.

**112 tests puros** (8 nuevos). El de la firma verificado en rojo reintroduciendo el `?? admin`.

**Lo que el código NO puede cerrar:** (1) averiguar si hay alguien afectado en el tenant real
—consulta de sólo lectura en `work-agent/.tareas/T-35/estado.md`—; (2) **rotar** lo que haya
quedado compartido, porque si el tenant se dio de alta así, esas cuentas tienen acceso ADMIN
**hoy**; (3) aplicar `20260819140000_limpiar_pines_heredados` **antes o junto con** la migración
de T-25 — si T-25 entra primero, hay una ventana en la que los PIN heredados autentican de verdad.

---

## T-36 · Tres avisos de reclamo esquivan la cola de mails

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

## T-37 · Dos líneas de integración divergentes, y ninguna tiene todo

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

## T-38 · El home de la PWA ignora el pago informado en modo demo

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
