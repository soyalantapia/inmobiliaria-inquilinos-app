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
> **Quedan 17 accionables, 1 a medias y 1 bloqueada.**
>
> Y esta lista tampoco es eterna: cada tarea trae la evidencia con la que se la verificó, para que
> se pueda desconfiar de ella igual que de la otra.

---

## Antes de empezar: las 19 que NO hay que tocar

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

## T-21-N3-N1 · La capacidad #1 del MVP no está construida

**Objetivo.** Cerrar la contradicción entre lo que el documento fundacional promete y lo que el
producto hace.

**Problema.** `CLAUDE.md` §1 lista **"Carga de contrato con IA"** como la primera de las cuatro
capacidades **no negociables** del MVP, y §5.1 la describe con endpoint, flujo, prompt y tests.
**No existe**, verificado por tres caminos independientes: no hay endpoint `/contratos/parse`, el
SDK de Anthropic no está en ninguna dependencia, y `ANTHROPIC_*` no se lee en ningún archivo de
`apps/api/src`.

Lo que sí hay para cargar contratos: el wizard manual y la importación de cartera desde Excel/CSV
— determinística, sin IA, y que funciona.

**Solución.** Es **decisión de producto, no tarea técnica**: o se construye, o se saca de la lista
de capacidades no negociables. Mientras no se decida, el documento que define el MVP promete algo
que el producto no hace — y eso contamina cualquier conversación de alcance.

---

# 🟠 Código, con diagnóstico cerrado

## T-61 · Un ajuste posterior a una renovación queda anulado en el devengo

**Objetivo.** Que el último cambio de canon sea el que manda.

**Problema.** Si se carga una renovación y **después** un ajuste, el devengo usa el snapshot de la
renovación y el ajuste queda anulado. Verificado que sigue abierto: `lib/liquidaciones.ts` **no
compara `createdAt`** en ningún lado.

**Solución.** Ya está relevada y **no necesita migración**: `AjusteAlquiler` y `RenovacionContrato`
**ya tienen `createdAt`**, así que el dato para distinguir "el snapshot sigue valiendo" de "alguien
tocó el canon después" existe. Son tres puntos de escritura: `core.ts:2460` y `core.ts:3813`
(ajustes) y `core.ts:2574` (renovación).

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

### ✅ Relevado → `work-agent/T-22-RELEVAMIENTO-CONSORCIO.md` · 🔴 BLOQUEADO en producto

**La parte de consorcio está construida a la mitad, y la mitad que falta no es una pantalla: es una
foreign key.** `UnidadFuncional` no tiene ninguna referencia a `Propiedad`. Hay dos universos
paralelos que no se tocan: el del consorcio (unidad, `titular` como string, coeficiente,
`saldoDeudor` a mano) y el de los alquileres (propiedad → contrato → liquidación → pago). Sin esa
FK **ningún dato puede cruzar**, y todo lo demás de T-22 depende de ella.

Los cuatro agujeros son el mismo visto de cuatro lados: (1) la expensa del mes no llega a las
cuotas *(T-19)*; (2) la cobranza no entra al libro del consorcio *(T-20)*; (3) **hay dos verdades
sobre la misma deuda** — el 1°A puede decir AL_DIA en el consorcio mientras su inquilino debe tres
meses, y la que se ve al abrir el edificio es la de a mano; (4) no se le puede avisar a nadie,
porque `enviarAnuncioEmail` necesita un email y la unidad sólo guarda un nombre suelto.

**Cinco decisiones de producto antes de construir** (en el relevamiento, con mi lectura de cada
una): si unidad y propiedad son la misma cosa; quién manda con la deuda; qué hace exactamente
"aplicar la expensa del período"; a quién avisa el mail; y qué pasa si los coeficientes no suman
100. **Orden sugerido: la FK primero — sin eso no se puede construir nada más.**

---

## T-20 · Consorcio con propiedades de régimen mixto

**Objetivo.** Confirmar que un edificio con unidades propias y unidades de sólo-expensas funciona.

**Problema.** El modelo **ya lo soporta**: `tipoContrato` (`ALQUILER | SOLO_EXPENSAS |
ALQUILER_Y_EXPENSAS`) vive en el **contrato**, no en el consorcio, así que dos unidades del mismo
edificio pueden tener regímenes distintos sin hacer nada especial.

**Solución.** Verificar el caso E2E, prestando atención a que `montoAlquilerSegunTipo` devuelve
**0** para `SOLO_EXPENSAS` — que es correcto, pero conviene ver qué hace la rendición con eso.

---

# 🟢 Baratas

## T-34 · `payment-hero.tsx` es código muerto

**Objetivo.** Sacar un archivo que no importa nadie.

**Problema.** Se exporta y **ningún módulo lo importa** (verificado hoy: cero importadores). La
única otra mención en todo el árbol es un comentario.

**Solución.** Borrarlo. No puede cambiar comportamiento. Conviene hacerlo **solo, en su propia
pasada**, porque vive bajo la carpeta de pagos y así nadie discute si cuenta como "tocar plata".

---

## T-51 · Los datos de demo usan dominios de correo reales

**Objetivo.** Que la demo pública no exponga direcciones de terceros.

**Problema.** Ningún email ficticio usa un dominio reservado. Verificado hoy en el seed:
`@gmail.com`, `@hotmail.com`, `@yahoo.com`, y dominios con pinta de negocio real. Desde el 19/08
está **publicado en internet**, con nombre y apellido al lado, y algunas de esas direcciones pueden
ser de personas reales que no tienen nada que ver con el producto.

**Solución.** Pasar todo a `example.com` (RFC 2606). Toca el seed → correr la suite después.

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
