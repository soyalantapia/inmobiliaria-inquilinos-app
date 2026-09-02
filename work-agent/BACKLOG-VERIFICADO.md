# Backlog verificado — qué queda de verdad

> **Qué es esto.** Las tareas que `09-TAREAS-REUNION-CAMILA.md` daba por abiertas, **verificadas
> una por una contra `origin/main`** el 31/08/2026. Cada una tiene lo mismo: **objetivo, problema
> y solución**, para atacarlas de a una.
>
> 🔴 **Por qué hizo falta verificar.** El documento de tareas marcaba **39 abiertas**. Contra el
> código, **19 ya estaban hechas** y una está mal diagnosticada. Ese documento describe el estado
> del día en que se escribió cada bloque, y el proyecto siguió: atacar desde ahí es trabajo
> tirado. **Manda el código.**
>
> **Quedan 17 accionables, 1 a medias y 1 bloqueada.** *(31/08: T-61 cerrada, y entró T-73.)*
>
> Y esta lista tampoco es eterna: cada tarea trae la evidencia con la que se la verificó, para que
> se pueda desconfiar de ella igual que de la otra.

---

## Antes de empezar: las 20 que NO hay que tocar

| Tarea | Evidencia de que está hecha |
|---|---|
| **T-03** rol CAJA | `enum Rol { ADMIN, CAJA, OPERADOR, CARGA, LECTURA }` — *queda sólo la parte operativa: reasignar a la gente de mostrador* |
| **T-08** propiedad fija en el wizard | `sticky top-0` en `contratos/nuevo/page.tsx:1575` |
| **T-16** avisar el aumento al inquilino | el aviso de aumento está cableado en `mailer.ts` |
| **T-17** notificar reclamos por mail | `enviarReclamoNuevoInmo`, `enviarReclamoAsignadoInquilino`, `enviarReclamoResueltoInquilino` |
| **T-18** sacar el copy que promete WhatsApp | no queda ninguna promesa de aviso automático en la PWA; lo que hay son botones que **la persona** aprieta |
| **T-21-N1-N1** cambiar expensas de un contrato cargado | `PATCH /contratos/:id/expensas` |
| **T-24** cargar morosos históricos | `/importaciones-morosos/{campos,analizar,validar,confirmar}` |
| **T-24-N2-N2** el DNI en la query string | `lib/redactar-url.ts` lo redacta antes del log |
| **T-24-N2-N3** el monto del Excel mal interpretado | usa `MoneyInput` (dígitos crudos) y muestra el **total** en el resumen |
| **T-24-N2-N4** el moroso que se fue este mes | el corte pasó a ser **el mes, no el día**: el mes en curso entra |
| **T-25** conmutador de usuarios | `POST /auth/usuario/conmutar` |
| **T-29** los eventos del contrato que no se leían | `GET /contratos/:id/eventos` |
| **T-30-N1** el remitente dice la inmobiliaria | `from: remitente(inmobiliariaNombre)` |
| **T-32** runner de tests de los fronts | `scripts/test-fronts.mjs` |
| **T-35** los usuarios extra heredaban la clave del admin | el código lo dice textual: *"NUNCA hereda del admin"*; usa `passwordDeUsuarioExtra(u)` y el PIN lo crea su dueño |
| **T-45** el home de la PWA ignoraba el pago informado | usa el mismo helper que el detalle y muestra el faltante |
| **T-57** la mora sobre el saldo | **hecho y desplegado el 31/08** — PR #66 |
| **T-58** monto fijo según la moneda | test en `mora-cascada.test.ts:109` |
| **T-51** los dominios de correo de la demo Y del seed | **hecho el 31/08** — PR #72; entraron además dos generadores que la ficha no tenía |
| **T-61** el ajuste posterior a una renovación | **hecho el 31/08** — PR #69, reparación al escribir en los tres puntos de canon |
| **T-72** el candado de archivos | **prendido el 31/08** — `UPLOADS_AMBITO=on` en Render |

Y una que se cierra sin trabajo: **T-23-N3-N2** está marcada **mal diagnosticada** en el propio
documento — el cambio que pedía era una regresión. La ausencia del piso es deliberada y el
anti-doble no es la fecha, es un flag. **No hacer nada.**

---

# 🔴 Las dos que pesan

## T-13-N1 · El cierre de caja nunca se congela

**Objetivo.** Que el arqueo de un día quede sellado y no vuelva a cambiar.

**Problema.** `GET /caja/cierre` **no lee ni escribe nada persistido**: recalcula el arqueo en vivo
cada vez que se abre la pantalla. Y existe `model CierreCaja` —creada en la migración inicial del
12/06, con `ingresos`, `egresos`, `balanceDia`, `efectivoEnMano`, `cerradoAt`, `cerradoPor` y un
`@@unique([inmobiliariaId, fecha])`— que **nadie escribe ni lee** (verificado: cero usos en
`apps/api/src`).

La consecuencia es concreta: anular un pago lo pasa a `RECHAZADO` **y le reescribe `decididoAt` a
hoy**. El cierre filtra por esos dos campos, así que el pago **desaparece del arqueo del día en
que se cobró**. O sea: **el cierre de un día pasado cambia solo, en silencio, días después.** La
cajera cerró con un número y mañana el sistema muestra otro.

**Solución.** Escribir el snapshot al cerrar el día en la tabla que ya existe; que la pantalla lea
el snapshot cuando el día está cerrado y calcule en vivo sólo el día abierto.

**Necesita una definición tuya:** ¿qué pasa si alguien anula un pago de un día ya cerrado? ¿Se
rechaza, o se registra como ajuste del día en curso?

---

## T-21-N3-N1 · Las cuatro capacidades del brief: qué se hace con ellas — ◑ reencuadrada

**Objetivo.** Decidir el roadmap de las cuatro capacidades del brief de mayo.

**Lo que la ficha decía, y ya no es cierto.** Decía que `CLAUDE.md` promete la carga de contrato
con IA como capacidad **no negociable** y el producto no la hace — o sea, que el documento
fundacional mentía. **Verificado el 31/08: esa mitad ya está resuelta.** `CLAUDE.md` §1.2 se
reescribió el 19/08 y hoy dice, textual:

> *"Estas son las que este documento llamó «no-negociables». **Ninguna está construida como está
> escrita.**"*

…con una tabla del estado real de cada una. **El documento ya no promete nada que el producto no
haga.**

**Lo que sigue abierto** —y verificado hoy por los tres caminos: sin endpoint `/contratos/parse`,
sin SDK de ningún LLM en las dependencias, sin `ANTHROPIC_*` en el código— es **la decisión de
roadmap**, y no es sólo la #1:

| Capacidad | Estado real |
|---|---|
| 1 · Carga de contrato con IA | no existe. En su lugar: wizard manual + importación de cartera, las dos en producción |
| 2 · Pago unificado con Mercado Pago | **el resultado sí, el medio no**: una pantalla y un botón, pero se cobra por transferencia con validación humana |
| 3 · Chat con el contrato (RAG) | no existe. La tabla de mensajes está y nadie la escribe |
| 4 · Screening crediticio | cáscara: el informe sale de un PRNG. *(El endpoint ya devuelve 501, no inventa más.)* |

**Solución.** Es **decisión de producto**, y la pregunta está en `PARA-ALAN.md`. Ninguna de las
cuatro es trabajo que un agente pueda tomar sin esa respuesta.

---

# 🟠 Código, con diagnóstico cerrado

## T-73 · `portal-propietario-e2e` falla de a ratos y enseña a ignorar los rojos

**Objetivo.** Que un rojo del CI vuelva a significar algo.

**Problema.** En el PR #69, **el mismo commit** dio una corrida de `integracion` en rojo y otra en
verde. La falla es *"pedir el código tiene que dejarlo guardado: expected 2 to be 1"* en
`test/portal-propietario-e2e.test.ts`: cuenta los códigos OTP guardados y a veces encuentra uno de
más. Al relanzar el job, verde.

O sea: **el test no está aislado de lo que dejó una corrida anterior.** No es un defecto del
producto — pero es el mismo mecanismo que ya costó nueve días de CI en rojo acá: un semáforo que
falla sin motivo entrena a mirar para otro lado.

**Solución.** Aislar el conteo: o limpiar los códigos de ese propietario en el `beforeEach`, o
contar sólo los emitidos después de una marca de tiempo tomada dentro del test, en vez de contar
todos los que existen.

---

## T-23-N2-N1 · Verificar el email del propietario (doble opt-in)

**Objetivo.** Que la llave del portal del dueño no sea un campo que tipea el staff.

**Problema.** Con el portal, `Propietario.email` dejó de ser un dato de contacto y pasó a ser **la
llave de entrada** — y sigue igual que antes: lo tipea el staff a mano, **no se verifica nunca**,
no se normaliza a minúsculas al escribirlo, no tiene `@@unique([inmobiliariaId, email])` —a
diferencia de `Usuario`, que sí lo tiene— y el `PUT` lo pisa en cada edición, incluso a `''`.
Verificado: **no existe ningún `emailVerificado` en el código.**

Si hay un typo, quien controle esa casilla entra a una cartera ajena.

**Solución.** Mail de confirmación, estado `emailVerificado` en el modelo (migración), y sobre todo
**decidir qué pasa con los que ya están cargados sin verificar**: bloquearles el portal es lo
seguro, pero deja afuera a toda la cartera existente el día 1.

---

## T-28-N1-N1 · `MovimientoCaja` no tiene `cargoId`

**Objetivo.** Que descobrar un cargo borre el ingreso que le corresponde, no otro.

**Problema.** El vínculo entre el movimiento de caja y el cargo es un **string**, no una FK
(verificado: no hay `cargoId` en el schema). El daño está **confirmado con test**
(`test/descobrar-cargo.test.ts`): mientras ninguno de los dos ingresos se rindió no pasa nada —son
fungibles—, pero **dejan de serlo apenas uno se rinde**: ahí tienen historias distintas y borrar el
equivocado descuadra.

**Solución.** Agregar `cargoId` como FK. **Toca schema → necesita tu OK por la migración.**

---

## T-37-N1 · Circuito de aprobación para el pago manual del operador

**Objetivo.** Que una operadora pueda registrar un cobro en efectivo sin darle rol CAJA.

**Problema.** Hoy no hay término medio: o tiene `pago.conciliar` —y da plata por cobrada sola— o no
puede registrar nada. `requiereAprobacion` existe para pagos pero **no se llama desde ningún lado
de `apps/api`** (verificado: cero llamadas).

**Solución.** Que `POST /pagos/manual` exija `pago.manual.cargar` y que, cuando
`requiereAprobacion(rol, 'pago.manual.cargar')` sea `true`, el pago quede pendiente hasta que un
ADMIN lo confirme — el mismo patrón que ya funciona para contratos.

---

## T-33 · Un pago informado contra una cuota futura congela el aumento — ◑ a medias

**Objetivo.** Que un aumento alcance a todas las cuotas futuras que corresponde.

**Problema, corregido.** El diagnóstico original decía que un `INFORMADO` **o un `RECHAZADO`**
pesaban igual que un `CONCILIADO`, y que el congelamiento era permanente. **La mitad ya se
arregló:** hoy el conteo filtra `estado: { in: ['INFORMADO', 'CONCILIADO'] }` (`core.ts:3863`), o
sea que **un rechazado ya no congela nada** — que era la parte injusta.

**Lo que queda es una decisión, no un bug:** un pago **informado y todavía sin validar** sigue
excluyendo a esa cuota del reajuste. El código lo llama "pago VIVO" y lo trata como deliberado.

**Solución.** Decidir si un informado pendiente debe congelar el aumento de una cuota futura. Si la
respuesta es no, es un filtro más en el `_count`.

---

# 🟡 Relevar y definir

## T-11 · Que la administradora pueda editar un contrato que ya tiene pagos

**Objetivo.** Que corregir un dato no obligue a rescindir el contrato.

**Problema.** Hoy, para corregir algo, Camila **rescinde** — *"y me sale rescisión del contrato en
el sistema porque me equivoqué… la rescisión siempre tiene un costo"*. Le está ensuciando el
historial con rescisiones falsas. Pidió editar teléfono del inquilino y garante; el límite
acordado: **la fecha de vigencia no**, y la dirección tampoco.

**Hay más de lo que parece:** ya existen `PATCH /contratos/:id/monto`, `/expensas`,
`/modo-cobranza`, `/inquilino-contacto`, `PUT /contratos/:id/mora` y el CRUD de garantes.

**Solución.** Relevar campo por campo qué se puede editar hoy y cerrar la brecha contra la lista de
Camila — probablemente falte poco. Y que la capacidad sea **de la administradora**, no de todos.

### ✅ Relevamiento hecho → `work-agent/T-11-QUE-SE-PUEDE-EDITAR.md`

**El ticket describe un bloqueo que no existe.** Ningún endpoint de edición se niega a trabajar
porque el contrato tenga pagos: todos editan igual y lo que hacen es proteger las cuotas que ya
tienen plata, dejándolas con su monto histórico. Los dos datos que Camila pidió —teléfono del
inquilino y garante— **ya se editan hoy**, y CARGA puede hacerlo.

Lo que sí encontró el relevamiento, y es lo que se arregla acá:

- 🔴 **`PATCH /contratos/:id/inquilino-contacto` no cortaba a CARGA**, y desde T-45 escribe
  `Inquilino.email`, que es el **login** del inquilino (el OTP viaja ahí). Un rol cuyo trabajo
  espera aprobación podía reapuntar el acceso a la app de cualquier inquilino, sin aprobación y
  sin rastro. Los cuatro endpoints vecinos de edición sí cortan; el gemelo del lado del
  propietario ya estaba cerrado. **Arreglado + test de comportamiento + test estructural** que
  obliga al próximo endpoint de edición a decidir explícitamente qué hace con CARGA.
- **Hay nueve datos que no tienen endpoint de edición por ningún camino** —ni con pagos ni sin
  pagos—: propiedad, inquilino titular, `fechaInicio`, moneda, **índice de ajuste**, frecuencia
  de ajuste, comisión, sociedad y penalidad. Ahí sí hay que rehacer el contrato: **esa es la
  rescisión falsa**. El más probable de los nueve es el índice.

**Queda abierto** (tickets sugeridos, con su detalle en el relevamiento): T-11-a editar índice y
frecuencia de ajuste *(necesita una decisión de producto: ¿recalcula hacia atrás o rige desde el
próximo?)*, T-11-b cambiar la propiedad, T-11-c corregir `fechaInicio`.

---

## T-13 · Cuentas de caja: que se entiendan

**Objetivo.** Que Camila encuentre las cuentas donde las busca.

**Problema.** Está **construido y mal ubicado**. Existe `CuentaCaja` con dirección
(ENTRADA/SALIDA/AMBAS), su ruta, la pantalla `/cuentas`, y los movimientos muestran su cuenta. Lo
que Camila no encontró es la relación entre "cuentas" y "caja": son **dos pantallas separadas** y
ella esperaba las cuentas adentro de caja.

**Solución.** Relevar el flujo real —cargar un gasto eligiendo cuenta, ver el saldo por cuenta,
mover plata entre cuentas— y decidir si `/cuentas` se integra dentro de `/caja` o se enlaza
claramente. **Es UX, no backend.**

---

## T-22 · Consorcio: avisar por mail y cargar la expensa del período

**Objetivo.** Que Camila cargue la expensa del mes y las unidades se enteren.

**Problema.** Existe el CRUD de consorcios y `Consorcio` tiene `periodoActual` y
`expensasPeriodoActual`, pero **falta relevar qué se puede hacer hoy** desde la pantalla del
consorcio.

**Solución.** Relevar, definir el flujo con producto e implementarlo **reusando
`enviarAnuncioEmail`**, que ya existe.

---

## T-20 · Consorcio con propiedades de régimen mixto

**Objetivo.** Confirmar que un edificio con unidades propias y unidades de sólo-expensas funciona.

**Problema.** El modelo **ya lo soporta**: `tipoContrato` (`ALQUILER | SOLO_EXPENSAS |
ALQUILER_Y_EXPENSAS`) vive en el **contrato**, no en el consorcio, así que dos unidades del mismo
edificio pueden tener regímenes distintos sin hacer nada especial.

**Solución.** Verificar el caso E2E, prestando atención a que `montoAlquilerSegunTipo` devuelve
**0** para `SOLO_EXPENSAS` — que es correcto, pero conviene ver qué hace la rendición con eso.

### ✅ Verificado → `work-agent/T-20-REGIMEN-MIXTO.md`

Funciona, y sin nada especial. E2E en `apps/api/test/consorcio-regimen-mixto.test.ts`, con las dos
unidades colgando del mismo `Consorcio`: la alquilada devenga $400.000 de alquiler; la de sólo
expensas devenga **$0 de alquiler** y $150.000 de total.

**Y la pregunta anotada tiene respuesta:** la rendición del dueño de la unidad de sólo expensas
devuelve **409 aunque el inquilino haya pagado todo**, porque esa plata es del consorcio. Correcto.
El contraste está en el mismo test: la unidad alquilada del mismo consorcio sí se rinde, y con
plata.

**🟡 T-20-a (nuevo):** el 409 dice *"No hay cobros nuevos"* y sí los hubo — lo que no hay es nada
*rendible*. Para Camila, parada frente a una unidad cuyo inquilino pagó todo, ese texto dice lo
contrario de lo que pasó. No se arregló acá porque el 409 se lanza desde adentro de la transacción
y se traduce ~430 líneas más abajo sin acceso a lo cobrado: distinguir los dos casos es más que un
cambio de copy.

**Y el hallazgo grande:** la plata de las expensas **entra y desaparece de la vista**. El libro del
consorcio (`MovimientoConsorcio`, categoría `COBRANZA`) **sólo se escribe a mano**; nada conecta el
pago del inquilino con el consorcio. Sumado a que el `expensasPeriodoActual` tampoco llega a las
cuotas (T-19), la parte de consorcio está **construida a la mitad: la estructura existe y la plata
no la recorre**. Todo eso es T-22, que sube de prioridad.

---

# 🟢 Baratas

## T-34 · `payment-hero.tsx` es código muerto

**Objetivo.** Sacar un archivo que no importa nadie.

**Problema.** Se exporta y **ningún módulo lo importa** (verificado hoy: cero importadores). La
única otra mención en todo el árbol es un comentario.

**Solución.** Borrarlo. No puede cambiar comportamiento. Conviene hacerlo **solo, en su propia
pasada**, porque vive bajo la carpeta de pagos y así nadie discute si cuenta como "tocar plata".

---


---

## T-46-N3 · La demo del portal copia los montos del panel a mano

**Objetivo.** Que las dos demos cuenten la misma historia.

**Problema.** `apps/propietario/src/lib/demo-data.ts` repite los números de
`apps/inmobiliaria/src/lib/mock-data.ts` **copiados a mano**, porque son dos apps que no comparten
paquete. Si alguien cambia un alquiler en el panel, la demo del portal queda contando otra cosa.

**Solución. Hoy, ninguna.** Es barato de sostener a mano y un paquete compartido de mocks cuesta
más que el problema. Queda anotada por si vuelve a morder.

---

# 🔵 No son código

## T-19 · Verificar y comunicarle a Camila que el pago ya va unificado

**Objetivo.** Sacarle un miedo. Es lo más importante de su parte de consorcio y **no es un pedido
de feature**.

**Problema.** *"Si yo te lo separo, que tengas que hacer dos transferencias o entrar a dos lugares
distintos para pagarme el alquiler y las expensas, no cobro más, la gente no la paga."* **Ya está
como ella quiere**: `montoTotal = alquiler + expensas (+ punitorios)` y el inquilino paga contra el
total, en una sola operación. No existe ningún camino que le cobre las expensas por separado.

**Solución.** E2E completo con un contrato `ALQUILER_Y_EXPENSAS` y **mostrárselo**. Verificación y
comunicación.

### ✅ Verificado → `work-agent/T-19-EL-PAGO-VA-UNIFICADO.md`

Está como ella quiere, y más de lo que pidió: **no existe la opción de pagarlo separado**. El E2E
(`apps/api/test/pago-unificado-alquiler-y-expensas.test.ts`) recorre alta → devengo → informar →
validar → rendir con un contrato de $500.000 + $100.000. El caso que lo demuestra: **pagar
exactamente el alquiler NO salda la cuota**, queda debiendo las expensas. Y esa plata le llega al
dueño **prorrateada** ($416.666,67, no $500.000), que es la prueba del otro lado del mostrador.

Nadie lo había probado antes: el devengo mixto estaba testeado como función pura y el
informar/validar sobre contratos de sólo alquiler; el cruce de los dos no tenía cobertura.

**Pero hay que decirle la otra mitad en la misma conversación:** *cobrar* la expensa unificada
funciona, **cargarla no**. El `expensasPeriodoActual` del consorcio no llega a ninguna cuota — el
devengo lee `Contrato.montoExpensas` y nada lo copia desde el consorcio. Cuando llega la expensa
del mes, hay que entrar contrato por contrato. Si se olvida una unidad, se le cobra de menos al
inquilino y la inmobiliaria le paga igual al consorcio. **Eso es T-22, y sube de prioridad.**

---

## T-04 · Cerrar la duda de los $850 con una consulta a la base

**Objetivo.** Contestarle a Camila qué pasó con esos $300 de diferencia.

**Problema.** En la prueba del 03/08: *"me sale que yo cobro 850, yo solo autoricé 550 mil"*. En la
reunión se concluyó que *"los pagos parciales no pasan por aprobación"*. **Esa conclusión no es lo
que hace el código**, trazado línea por línea: `POST /pagos/informar` crea el pago sin setear
estado (default `INFORMADO`), `GET /pagos` no filtra por tipo, y sólo los `CONCILIADO` suman.
**Ninguna ruta convierte un informado en cobrado sin que alguien valide.**

**Solución.** Una consulta **de sólo lectura** sobre esa liquidación: quién creó cada pago, con qué
estado y quién lo decidió. Hasta que no se cierre queda una desconfianza sobre la caja que no
corresponde. ⚠️ **Depende de que haya datos en producción** — hoy la base está vacía.

---

## T-26 · Rotar la credencial de producción

**Objetivo.** Cerrar el riesgo de la credencial que estuvo en el repo.

**Problema.** Estuvo en texto plano en **cinco** archivos trackeados, y el repo es público. Ya se
sacó del árbol el 20/08, **y eso no la invalida**: sigue viva en el historial de git.

⚠️ **Ojo con el diagnóstico:** la revisión del 30/08 lo **corrigió a la baja** — lo que se baja del
repo hoy es la credencial del **seed**, no una de producción.

**Solución.** La rota **el dueño**; ningún agente toca credenciales de producción. Y la pregunta
que sigue abierta se contesta con una consulta a la tabla de usuarios de producción buscando
`roberto@delsol.com`: **¿ese seed corrió alguna vez contra la base real?**

---

## T-05 · Congelar los deploys durante las sesiones de prueba

**Objetivo.** Que la clienta cero pruebe contra un blanco quieto.

**Problema.** Durante la prueba del 03/08 el equipo estaba **deployando en vivo**. Camila probó
contra un blanco móvil: parte de lo que reportó puede ser estado intermedio de deploy y no un bug —
y **no hay forma de distinguirlo después**. Es tiempo de la clienta cero gastado en ruido.

**Solución.** Acuerdo, no código: durante las sesiones no se deploya; lo que aparece se anota y se
sube después. Si hay que subir algo sí o sí, avisarlo y anotar la hora. La sesión arranca
registrando el SHA de `/health`.

---

## T-28 · Cubrir con tests los flujos de plata que no tienen ninguno — ◑ parcial

**Objetivo.** Que la plata tenga red.

**Problema.** El motivo por el que se había abandonado **era falso**: decía que los tests *"pegan a
la Postgres de producción"*. No es cierto — producción corre con host interno de Railway,
inalcanzable desde una máquina de trabajo.

**Solución.** El bloqueante ya no existe: `docker-compose.test.yml` levanta una Postgres local y
efímera, y la suite entera corre contra ella (verificado el 31/08: **61 archivos, 458 tests**, sin
una falla). Terminar los endpoints que faltan.

---

# ⛔ Bloqueada

## T-23-N3-N1 · Que el propietario vea "desde que sos dueño"

**Estado: ◑ mitad hecha.** Se construyó la mitad que no dependía de nadie: **registrar** los
cambios de reparto en una tabla append-only, escrita **dentro** de la transacción del PUT (no por
`registrarEvento`, que es best-effort y no puede sostener un recorte de privacidad). Hoy sólo se
escribe: nadie la lee, cero cambio de comportamiento. Se hizo ya porque cada día sin eso es
**historial que se pierde y no se puede reconstruir**.

**La otra mitad —usar el dato para recortar lo que ve el dueño— espera una respuesta de Camila:**
¿un propietario que compró en marzo puede ver los reclamos y las liquidaciones de enero?

⚠️ **Y tiene una deuda con fecha: la migración `20260819200000_historial_reparto` está sin
aplicar.** Cuanto antes.

---

## Cómo atacarlas

El orden que yo tomaría:

1. **T-13-N1** (el cierre de caja) y **T-61** (el ajuste anulado): las dos tocan plata, las dos
   tienen diagnóstico cerrado y ninguna necesita relevar nada. **T-61 ni siquiera necesita
   migración.**
1. **T-13-N1** (el cierre de caja): toca plata, tiene diagnóstico cerrado y no necesita relevar
   nada. ~~T-61~~ ya está cerrada (PR #69).
2. **T-34** y **T-51**: baratas, cierran en una pasada cada una y bajan el ruido.
3. **T-21-N3-N1**: no es código, es una definición tuya — y hasta que no esté, el documento que
   define el MVP promete algo que el producto no hace.
4. **T-23-N2-N1** y **T-28-N1-N1**: las dos tocan schema, así que conviene juntarlas en una tanda
   de migración.
5. Los bloques temáticos juntos: consorcios (T-19, T-20, T-22) y caja (T-13, T-37-N1).
6. **T-04** y **T-26** quedan esperando: la primera necesita datos en producción, la segunda te
   necesita a vos.

**Y la regla que este documento aprendió de la manera cara:** antes de atacar cualquiera, verificar
contra `origin/main` que siga abierta. **Diecinueve de treinta y nueve no lo estaban** — y una de
ellas la puse yo como prioridad #1 antes de ir a mirar el código.
