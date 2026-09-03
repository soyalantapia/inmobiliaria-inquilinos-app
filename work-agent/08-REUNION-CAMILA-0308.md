# Reunión con Camila Vargas — 2026-08-03 · backlog de cierre

> **Qué es esto.** El backlog completo de lo que Camila pidió en la sesión del 3 de agosto
> (73 min, prueba en vivo con su equipo en la oficina), cruzado contra el código en `70d4be8`
> (= lo que corre en producción).
>
> **Quién es Camila.** Administradora de inmobiliaria, **clienta cero**. Prueba el producto en vivo
> con su equipo (dos operadoras + una de consorcio) mientras Alan entra como inquilino. Es la fuente
> de verdad de producto: lo que ella dice que no sirve, no sirve.
>
> **Contexto que hay que tener presente al leer:** durante la reunión el equipo estaba **deployando
> a producción en vivo** (`[15:36]`, `[35:05]`, `[43:04]`, `[49:49]`). Camila probó contra un blanco
> móvil, así que algunos síntomas que reportó pueden ser estados intermedios de deploy y no bugs
> reales. Está marcado donde aplica.
>
> **Y lo más importante:** en las 24-36 h siguientes a la reunión entraron 8 commits que atacan
> varios de estos puntos (`898e451`, `e0dd7a8`, `a3921e8`, `2c81a2f`, `0427afa`, `9b21af0`,
> `fffe826`, `26fdfa6`). **Antes de trabajar cualquier ítem hay que confirmar si ya está cerrado.**
>
> ---
>
> **📍 ESTADO AL 03/09/2026.** Un mes después, todo esto se volvió a medir contra `main`, tarea
> por tarea. **Este documento es el backlog crudo del día de la reunión y no se actualizó**: lo
> que dice acá abajo describe el código de agosto. El estado real vive en
> [`09-TAREAS-REUNION-CAMILA.md`](./09-TAREAS-REUNION-CAMILA.md), en la tabla «Dónde quedó
> todo», y las preguntas que frenan una tarea en [`PARA-ALAN.md`](./PARA-ALAN.md).
>
> El resumen: de 40 tareas, 20 cerradas, 5 operativas, 5 esperando una decisión tuya, 1 obsoleta.
> Las 9 que estaban a medias se trabajaron el 03/09 y quedaron 6 cerradas.
>
> Y una corrección al párrafo de arriba: **el equipo ya no puede deployar en vivo sin querer.**
> Desde la migración a Render del 29/08 los tres servicios tienen `autoDeploy: no`, así que
> mergear a `main` no despliega. El «blanco móvil» de la reunión no se puede repetir solo.

---

## Estado de ejecución — rama `feat/reunion-camila-0308`

| # | Pedido | Estado | Commit |
|---|---|---|---|
| **C1** | Cambiar a cobranza directa en un contrato existente | ✅ hecho | `b00f5c1` |
| **C2** | La falta de CBU no bloquea el alta | ✅ hecho | `b00f5c1` |
| **R1** | "No me deja cargar contrato" | ✅ hecho (era un botón muerto, no permisos) | `afbf08f` |
| **N1** | Notificaciones internas del panel | ✅ hecho | `afbf08f` |
| **A7** | Ver el contrato antes de aprobarlo | ✅ hecho | `89132c9` |
| **A8** | El expediente aparecía vacío | ✅ parcial: la ficha de aprobación ya dice qué falta | `89132c9` |
| **R2** | Dos usuarias con el mismo rol veían distinto | ✅ hecho | `f90232d` |
| **R3** | OPERADOR no debe autorizar pagos | ✅ hecho | `f90232d` |
| **R4** | Rol caja / nombres de los roles | ✅ hecho (rol `CAJA` + relabel) | `f90232d` |
| **P3** | Gasto de caja sin propiedad | ✅ hecho | `b04b13a` |
| **A4** | El complejo en grande | ✅ parcial: helper único + listado y aprobación | `b04b13a` |
| **P1** | "$850 cobrado sin que yo lo autorice" | ⏸️ **no se toca**: el código está bien (ver abajo). Falta una consulta a la base |
| **A2** | Encabezado fijo con la propiedad en el wizard | ❌ pendiente |
| **A5 / A6** | Alta por secciones / unificar el flujo | ❌ pendiente |
| **A9** | ¿WhatsApp y DNI bloquean el avance? | ❌ sin verificar |
| **R5** | La administradora puede editar un contrato con pagos | ❌ pendiente |
| **P2** | El pago no aparece en caja | 🟡 mitigado por N1 (ahora se entera de que hay algo por validar) |
| **P4 / P5 / P6** | Cuentas de caja · anular pago · parcial desde la PWA | ❌ pendiente |
| **C4** | Avisar del aumento cuando el ajuste es manual | ❌ pendiente |
| **N2** | Notificar reclamos por mail y plataforma | ❌ pendiente |
| **N3–N7** | Consorcio (unificado, mixto, solo expensas, mail, pago) | ❌ pendiente (N5 necesita diseño) |
| **G1** | Portal del propietario | ❌ pendiente (L) |
| **G2** | Morosos históricos | ❌ pendiente (M) |
| **G3** | Cambio rápido de usuario | ❌ pendiente — **decisión del owner tomada: el PIN vuelve SOLO para esto** |

### Dos migraciones escritas y NO aplicadas

- `20260818120000_rol_caja` — `ALTER TYPE "Rol" ADD VALUE 'CAJA'`
- `20260818130000_movimiento_caja_sin_propiedad` — `DROP NOT NULL` en `propiedadId`

Las dos son aditivas y no destructivas: no tocan filas, no reasignan nada, no borran.
**Hay que aplicarlas ANTES de subir el backend** (agregar un valor de enum y relajar un
NOT NULL son compatibles con el código viejo; al revés, no).
Después del deploy hay que **pasar a rol CAJA a quien atienda el mostrador**, desde
Configuración → Equipo: hasta que se haga, esas personas dejan de poder confirmar pagos,
porque OPERADOR ya no tiene esa capacidad. **Eso es intencional, pero es un cambio
operativo que Camila tiene que saber antes de que su equipo se lo encuentre.**

### Sobre P1, que es lo que más ruido hizo en la reunión

La conclusión de la reunión (*"parece que los pagos parciales no pasan por aprobación"*)
**no es lo que hace el código**. Verificado línea por línea:

- `POST /pagos/informar` (`plata.ts:1275-1300`) crea el `Pago` **sin setear `estado`** ⇒
  toma el default del schema, que es `INFORMADO` (`schema.prisma:1691`). Parcial y total
  nacen exactamente igual.
- `GET /pagos` (`plata.ts:279-306`) **no filtra por `tipo`** ⇒ el parcial informado sí
  aparece en la bandeja.
- `montoPagadoPorLiquidacion` (`lib/saldos.ts:15`) suma **sólo `CONCILIADO`**.
- `GET /caja/cierre` (`plata.ts:174-186`) filtra `CONCILIADO` + `condonado:false` +
  día civil argentino + `modoCobranza:'INMOBILIARIA'`.
- El cartelón "Cobrado" usa `montoPagado`, que viene del API.

**Ninguna ruta convierte un pago informado por el inquilino en cobrado sin que alguien lo
valide.** Quedan tres explicaciones y se cierran con una consulta de lectura a la base
(los `Pago` de ese contrato del 03/08 con `estado`, `tipo`, `monto`, `decididoPorId`,
`decididoAt`): que se haya validado sin registrarlo, que estuviera mirando el cartelón del
mes en vez de la bandeja, o que fuera un estado intermedio de deploy.

**Hasta no hacer esa consulta no hay que tocar el flujo de pagos.** Es el código mejor
blindado del sistema (índice único parcial, locks atómicos, seis caminos que setean `tipo`
explícito) y el riesgo de "arreglar" algo que funciona es alto.

---

## Cómo cerró la reunión (el compromiso asumido)

Alan `[1:07:19]`: *"me llevé mucho feedback… me conviene darme vuelta, trabajar el feedback, y el
jueves nos reunimos de vuelta, así ya tengo todo esto liquidado. Hacemos otra prueba más."*
Camila, al cerrar `[1:10:13]`: **"avancemos con la cuenta directo al propietario"** — ése fue el
único ítem que ella marcó explícitamente como el próximo.

---

## Los 28 pedidos

Prioridad: 🔴 bloquea la operación diaria · 🟠 duele pero hay workaround · 🟡 mejora · ⬜ diseño de producto.

### A. Cobranza directa al propietario — lo que ella marcó como prioridad

| # | Pedido | Cita | Prioridad |
|---|---|---|---|
| **C1** | Poder cambiar un contrato existente de cuenta recaudadora a **directo al propietario** | `[12:06]` *"te quiero modificar que de cuenta recaudadora me pases a directo el propietario y no puedo, me vuelve"* | 🔴 |
| **C2** | Que la falta de CBU del propietario **no bloquee el alta** del contrato | `[33:07]` *"no me deja terminar de cargar el contrato porque cuando pongo directo al propietario me salta como que no tiene CBU. Ya me quedé ahí"* | 🔴 |
| **C3** | Que el inquilino **vea los datos para transferir** directamente en el checkout | `[11:31]` *"me gustaría que los datos para transferir… sería bueno que digan los datos directamente"* | 🟠 |

**Lo que ya sé del código** (§5.5 de `07-ECOSISTEMA.md`): `PATCH /contratos/:id/modo-cobranza`
(`core.ts:2861-2938`) tiene **tres** ramas que pueden estar frenándola, y hay que saber cuál fue:

1. **Guard de rol** (`core.ts:2862-2866`): `if (u.rol === 'CARGA') → 403`.
2. **Guard de cobros del período** (`core.ts:2888-2900`): si hay algún `Pago` CONCILIADO del mes en
   curso → **409**. Camila **ya le había validado un pago a Alan ese mismo día**, así que
   **ésta es casi con certeza la que la frenó**.
3. **Falta de `CuentaCobranzaDirecta`** del dueño principal → 400 (`core.ts:2902-2921`).

⚠️ Ojo con el guard 2: es el que protege de un agujero real de plata (cambiar el modo deja cobros
viejos sin poder rendirse — ver §9.1 de `07-ECOSISTEMA.md`). **No se saca sin más**: hay que
reemplazarlo por uno que mire lo efectivamente rendido, no los pagos del mes.

Y sobre C2: `Propietario.cbuAlias` y el modelo `CuentaCobranzaDirecta` son **dos campos distintos**;
el mensaje de error lo aclara pero **el operador no tiene forma de entender la diferencia**.
Alan ya acordó la solución en la reunión `[33:35]`: *"si no la tiene, el alta te la va a pedir…
debería pedírtelo después, cuando terminás"*.

### B. Roles y permisos

| # | Pedido | Cita | Prioridad |
|---|---|---|---|
| **R1** | La operadora **no pudo cargar un contrato** | `[12:43]` *"no me dejó operador cargar contrato"*, `[13:33]` *"ninguna de las dos operadoras"* | 🔴 |
| **R2** | Dos usuarias con el **mismo rol** ven **paneles distintos** | `[44:27]` *"las dos tienen diferentes cosas en el panel"* · `[44:29]` *"la que maneja la caja no puede ver mi caja, no puede ver los pagos, cuentas tampoco"* | 🔴 |
| **R3** | Operador y carga limitada **pueden autorizar pagos y no deberían** | `[42:43]` *"operador y carga limitada me está dando que puede pagar"* | 🔴 |
| **R4** | **Rediseñar los roles**: caja · auditora · administradora · consulta | `[46:06-47:00]`; `[45:47]` *"no sé por qué usaste esos nombres"* | 🟠 |
| **R5** | La **administradora** debe poder editar un contrato **aunque ya tenga pagos** | `[55:30]` *"que se pueda editar siempre, pero solamente la administradora"* | 🟠 |

Sobre **R1**: hipótesis fuerte a verificar antes de tocar nada — la feature de **aprobación
configurable** entró el 29-30/07 (`6f6e1bb`..`2db4cde`). Con ella, un OPERADOR **sí puede** crear el
contrato, pero éste nace en **BORRADOR pendiente de aprobación** y no reclama la propiedad ni
devenga. **Es muy posible que no sea un permiso denegado sino un flujo que no se explica en pantalla**
y que la operadora leyó como "no me deja". Hay que trazar el mensaje exacto que ve.

Sobre **R5**, el alcance ya quedó acordado en la reunión: **sí** se puede editar teléfono del
inquilino, garante (*"por ley también se puede"* `[56:28]`) y datos básicos; **no** la fecha de
vigencia (`[56:55]`) ni la dirección.

Sobre **R4**, el mapeo tentativo sobre las capacidades que ya existen:

| Rol que pide Camila | Rol actual más cercano | Cambio principal |
|---|---|---|
| **administradora** | ADMIN | ninguno |
| **caja** | — (no existe) | rol nuevo: `pago.conciliar`, `pago.rechazar`, `pago.manual.cargar`, `gasto.caja.cargar`, `caja.ver` — y **nada más** |
| **auditora / consulta** | LECTURA | separar: auditora ve auditoría, consulta no |
| (a quitar de OPERADOR) | OPERADOR | sacarle `pago.conciliar` y `pago.rechazar` |

⚠️ **Migración**: hay usuarios reales en producción con los roles viejos. Cambiar el enum `Rol`
requiere migración + backfill, y `Usuario.rol` se lee en cada request (`guards.ts:56`).

### C. Alta de propiedad / contrato

| # | Pedido | Cita | Estado |
|---|---|---|---|
| **A1** | Mascotas va en la **propiedad**, no en el contrato | `[22:11]` *"ya estaría en la propiedad, no en el inquilino"* | ✅ probable: `898e451` + migración `20260803120000_mascotas_en_propiedad` (**confirmar**) |
| **A2** | Ver **siempre arriba** de qué propiedad es el contrato que estás cargando | `[21:19]` *"que quede siempre arriba, que se vea la propiedad"* | ❌ |
| **A3** | Volver atrás **sin perder** lo cargado | `[19:29]` *"pierdo lo que estoy haciendo"* | 🟡 parcial: `cbaa62c`+`df23fab` (autosave). Ella misma lo valida después `[30:42]` |
| **A4** | Mostrar el **nombre del complejo** en grande, no la dirección | `[24:04]` *"todos tenemos un nombre de referencia"*, `[25:09]` | ❌ existe `Propiedad.complejo` (migr. `20260714000000`) — falta usarlo |
| **A5** | El alta **por secciones**, no todo junto | `[14:19]` *"me pidió todos los datos de los garantes, todo incluido… lo tenemos separado por secciones"* | ❌ |
| **A6** | Unificar el flujo disperso propiedad → contrato → inquilino | `[37:56]` *"me pierdo, me cuesta"* | 🟡 `0427afa` atacó parte (**confirmar qué**) |
| **A7** | **Ver el contrato antes de aprobarlo** | `[41:01]` *"me sale aprobar o rechazar pero no puedo [verlo]"* · `[49:02]` *"no pude visualizar lo que ella estaba cargando"* | 🔴 ❌ |
| **A8** | El **expediente** del contrato aparece vacío | `[49:52]` *"no cargó nada de los garantes, no tengo documentos, no tengo servicios"* | ❌ |
| **A9** | ¿WhatsApp y foto de DNI del inquilino bloquean el avance? | `[15:01]` | ⚠️ sin verificar |

**A7 es un bloqueante operativo serio**: Camila está **aprobando contratos a ciegas**. Y se agrava
con lo que ya sabíamos: de los 4 tipos de `Aprobacion`, **solo `CONTRATO_CARGADO` ejecuta algo**;
los otros tres devuelven 501 desde `26fdfa6`.

### D. Pagos y caja

| # | Pedido | Cita | Prioridad |
|---|---|---|---|
| **P1** | *"Tengo algo contabilizado que yo no aprobé"* — **$850 cobrado habiendo autorizado $550** | `[59:22]` *"ahora yo tengo algo contabilizado que es tuyo, que yo no lo aprobé ni sé qué pagaste"* | 🔴 |
| **P2** | El pago del inquilino **no aparece en caja** | `[31:45]` *"si voy a caja, movimiento cero, no tengo tu pago"* · se repite `[48:31]` | 🔴 |
| **P3** | Cargar un gasto de caja **sin tener que elegir una propiedad** | `[35:12]` *"sí o sí tengo que elegir una propiedad"* | 🟠 |
| **P4** | Las **cuentas de caja** (entradas/salidas) *"no están"* | `[34:44]` · Alan `[35:50]`: *"abajo de caja no aparece, pero sí aparece cuentas"* | 🟠 |
| **P5** | Cómo **anular un pago** mal cargado | `[57:12]` *"¿cómo elimino un pago ya cargado que me lo contabilizó en caja?"* | 🟠 |
| **P6** | Pago **parcial** desde la PWA (pagar el alquiler y dejar expensas) | `[1:00:24]` *"lo más frecuente es que no paguen todo, sino que quede algún saldo"* | 🟡 |

#### P1 — verificado: **la hipótesis de la reunión era incorrecta**

En la reunión Alan concluyó `[59:47]`: *"parece que los pagos parciales no [pasan por] aprobación"*.
**Eso no es lo que hace el código.** Verificado línea por línea:

- `POST /pagos/informar` (`plata.ts:1275-1300`) crea el `Pago` **sin setear `estado`** ⇒ toma el
  default del schema, que es **`INFORMADO`** (`schema.prisma:1691`). Parcial y total nacen igual.
- `GET /pagos` (`plata.ts:279-306`) **no filtra por `tipo`** ⇒ un parcial informado **sí aparece**
  en la bandeja "a resolver".
- `montoPagadoPorLiquidacion` (`lib/saldos.ts:11-19`) suma **solo `CONCILIADO`**.
- `GET /caja/cierre` (`plata.ts:174-186`) filtra `CONCILIADO` + `condonado:false` +
  `decididoAt` dentro del día argentino + `modoCobranza:'INMOBILIARIA'`.
- El cartelón "Cobrado" del panel usa `c.montoPagado` que viene del API (`pagos/page.tsx:265-279`).

**Ninguna ruta convierte un pago informado por el inquilino en cobrado sin que alguien lo valide.**

Entonces quedan tres explicaciones, y **hay que descartarlas contra la base antes de tocar código**:
1. Camila **validó el segundo pago sin registrarlo** (estuvo clickeando mucho; a `[40:11]` aprueba
   algo y a `[43:04]` Alan le avisa que acaba de deployar).
2. Estaba mirando **otro número** (el cartelón del mes, no la bandeja).
3. **Estado intermedio de deploy** — se estaba subiendo a producción durante la sesión.

> **Acción concreta**: consultar en la base los `Pago` de ese contrato del 03/08 con
> `estado`, `tipo`, `monto`, `decididoPorId` y `decididoAt`. Con eso se cierra en 5 minutos.
> **Hasta no hacer eso, no tocar el flujo de pagos**: el código está bien y el riesgo de
> "arreglar" algo que funciona es alto.

#### P2 — la explicación más probable

Un pago **INFORMADO no debe aparecer en caja** — caja es plata que entró, y entra recién al
conciliar. Si Camila no lo había validado todavía, **el comportamiento es correcto y lo que falta es
que la pantalla se lo explique**. Se cruza directamente con **N1** (no se entera de que hay algo
para validar). Verificar además el caso del pago de un **mes futuro** (Alan pagó septiembre estando
en agosto): entra al cierre del día en que se concilia, lo que puede confundir.

### E. Notificaciones

| # | Pedido | Cita | Estado |
|---|---|---|---|
| **N1** | **Feed de notificaciones dentro del panel** | `[31:15]` *"¿dónde tenés las notificaciones acá?"* · `[31:43]` *"interno en la aplicación"* | 🔴 ❌ **confirmado**: `notifications-bell.tsx:39` hace `if (apiEnabled) return [];` — la campana existe y **nunca muestra nada** |
| **N2** | Los **reclamos** deben notificar por email **y** por la plataforma | `[47:36]` | ❌ |
| **C4** | **Avisar al inquilino del aumento** cuando el ajuste es manual | `[10:45]` *"con ajuste manual necesitamos avisarle"* | ❌ |

**N1 ya estaba identificado** en `07-ECOSISTEMA.md` §7.C como una de las asimetrías no deliberadas:
*"el que más necesita enterarse —la inmo, de un pago informado— es el que no tiene feed"*.
Es, junto a A7, lo que más fricción operativa le genera.

Base sobre la que construirlo: `EventoAuditoria` + `registrarEvento` (`lib/auditoria.ts`) ya
registran los eventos; `GET /eventos` (`core.ts:2718`) ya los expone y `/auditoria` los muestra.
**El feed es en gran medida re-usar eso con un flag de leído.** Camila además menciona `[48:03]` que
sí le apareció *"un puntito al lado de donde era pago"* — hay que averiguar qué es, porque puede
ser el 80% del camino.

### F. Consorcio

| # | Pedido | Cita | Prioridad |
|---|---|---|---|
| **N3** | **No separar** el pago de expensas del alquiler | `[27:16]` *"si te lo separo… no cobro más, la gente no la paga"* | 🔴 verificar |
| **N4** | Un consorcio con propiedades de **régimen mixto** | `[29:21]` *"tengo cinco departamentos propios, lo demás solo cobro [expensas]"* | 🟠 |
| **N5** | Caso **"solo expensas"**: pago mensual **sin contrato de alquiler** | `[30:08]` Alan: *"no sería un contrato… tengo que pensarlo bien esto"* | ⬜ |
| **N6** | Consorcio: mandar mail, notificar y **subir la expensa** | `[57:35]` | 🟠 |
| **N7** | ¿El inquilino puede **pagar expensas de consorcio** desde la app? | `[1:00:01]` | ⚠️ |

**N3 probablemente ya está cumplido**: la `Liquidacion` tiene `montoAlquiler` + `montoExpensas` +
`montoPunitorio` = `montoTotal`, y el inquilino paga contra **el total**, en una sola operación.
Hay que confirmarlo y **decírselo a Camila con esas palabras**, porque es un miedo suyo explícito y
está basado en cómo funciona su sistema actual, no en el nuestro.

**N5 es el único ítem que necesita diseño de producto**, y Alan ya lo dijo en la reunión. Antes de
diseñarlo hay que verificar si el `tipoContrato` / `SOLO_EXPENSAS` que aparece en el código
(`montoAlquilerSegunTipo`, `liquidaciones.ts:359-367`) ya cubre el caso.

### G. Los tres pedidos grandes

| # | Pedido | Cita | Esfuerzo |
|---|---|---|---|
| **G1** | 🔴 **Portal del propietario** | `[1:02:00]` *"no podemos vender la aplicación a una persona que no sea inmobiliaria"* | L |
| **G2** | 🔴 Cargar **morosos históricos** sin contrato vigente | `[51:06]` *"tendría que empezar cargando los morosos… ni en pedo"* | M |
| **G3** | 🟠 **Cambio rápido de usuario** en la misma máquina | `[1:08:01]` *"aprieto un botoncito arriba y cambio el usuario"* | M |

**G1 no es un nice-to-have: es modelo de negocio.** Camila lo dice explícito `[1:05:51]`:
*"las inmobiliarias que no trabajan con departamentos propios van a tener que cobrarle al
propietario… hay un porcentaje que lo va a tener que pagar el propietario"*. Y lo que quiere que
vea el propietario **ya existe como dato**: `Rendicion` + `AlquilerRendido` + `GastoRendido` +
`IngresoRendido` tienen bruto, comisión, gastos y neto. **El MVP es una vista de lectura sobre datos
que ya están**, más un tipo de sesión nuevo.

**G3 choca con una decisión LOCKED.** `05-DECISIONES.md §7` dice que el PIN se **eliminó** de toda
la plataforma el 05/07 y que **no hay que re-agregarlo**. Camila pide exactamente un login corto de
5 dígitos para cambiar de usuario. Alan aceptó en la reunión `[1:09:37]`: *"ya te entendí perfecto,
lo tenía pensado diferente, vamos igual así como lo tenés"*.
**Es una decisión del owner, no técnica.** La infraestructura está intacta:
`Usuario.pinHash`/`pinIntentosFallidos`/`pinBloqueadoHasta` siguen en el schema (`~761`),
`POST /auth/pin` sigue vivo (`auth.ts:660`) y `verificarPinUsuario` es un kill-switch de una línea
que hoy siempre aprueba (`auth/pin.ts:11`). Revivirlo **solo para el cambio de usuario** —sin volver
a poner prompts de PIN en las acciones de plata— es compatible con el espíritu de la decisión.
⚠️ Al implementarlo, cuidar el aislamiento de los JWT de varias sesiones en el mismo browser.

---

## Orden de ataque propuesto

**Tanda 1 — desbloquear la operación (lo que le impide trabajar hoy)**
1. **C1 + C2** cobranza directa — es lo que ella pidió al cerrar.
2. **R1** por qué la operadora no pudo cargar el contrato (probablemente es copy, no permisos).
3. **A7** poder ver el contrato antes de aprobarlo.
4. **N1** feed de notificaciones del panel (destraba también P2).
5. **P1** cerrar la duda contra la base **antes** de tocar el flujo de pagos.

**Tanda 2 — que el equipo pueda trabajar sin pisarse**
6. **R2 + R3** roles: el bug de menús distintos y sacarle conciliar a OPERADOR.
7. **R4** rediseño de roles con migración.
8. **A2 + A4** encabezado con la propiedad, y complejo en vez de dirección.
9. **P3 + P4 + P5** caja: gasto sin propiedad, cuentas, anular pago.

**Tanda 3 — lo grande**
10. **G2** morosos históricos (le bloquea la carga inicial de su cartera real).
11. **G1** portal del propietario.
12. **G3** cambio de usuario (previa decisión del owner sobre el PIN).
13. **N5** consorcio "solo expensas" (previo diseño de producto).

---

## Lo que NO está verificado todavía

La verificación en paralelo contra el código quedó **incompleta**: el clasificador de seguridad de
la sesión estaba rate-limited y bloqueó los subagentes y el acceso a shell. Lo que sí quedó
verificado de primera mano está marcado arriba con archivo:línea. **Todo lo demás son hipótesis
fundadas, no hechos** — y está marcado como tal.

Falta específicamente:
- Revisar `git show` de los 8 commits posteriores a la reunión para confirmar A1, A6 y qué más cayó.
- Confirmar R1 trazando el mensaje real que ve un OPERADOR al crear un contrato.
- Confirmar N3 (si expensas y alquiler ya van unificados) y N5 (si existe `SOLO_EXPENSAS`).
- Consultar la base para cerrar P1.
