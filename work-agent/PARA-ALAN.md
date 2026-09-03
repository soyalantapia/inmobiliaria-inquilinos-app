# Para Alan — las que no puede decidir un agente

> Preguntas que frenaron una tarea del backlog. Cada una trae **el contexto mínimo para
> contestarla sin volver a investigar**. Cuando una se contesta, la tarea vuelve a la fila.
>
> El ciclo **no se frena por estas**: se anotan acá y se sigue con la siguiente tarea.

---

## T-13-N1 · El cierre de caja: tres preguntas, y sin ellas no se puede construir

**Fecha:** 31/08/2026 · **Bloquea:** T-13-N1 (🔴, la más pesada del backlog)

### Lo que ya está verificado, para que no haya que mirarlo de nuevo

- `GET /caja/cierre` **recalcula el arqueo en vivo** cada vez que se abre la pantalla. No lee ni
  escribe nada persistido.
- El modelo **`CierreCaja` existe desde la migración inicial** (12/06) con todo lo que hace falta
  —`ingresos`, `egresos`, `balanceDia`, `efectivoEnMano`, `pendienteRendir`, `movimientos`,
  `cerradoAt`, `cerradoPor`, y un `@@unique([inmobiliariaId, fecha])`— y **nadie lo escribe ni lo
  lee**.
- 🔴 **No existe ninguna acción de "cerrar el día".** Sólo el `GET`. Construir esto es agregar un
  verbo nuevo a la operación diaria, no cablear uno que ya está.
- La consecuencia que lo hace urgente: anular un pago lo pasa a `RECHAZADO` **y le reescribe
  `decididoAt` a hoy**. El cierre filtra por esos dos campos, así que el pago **desaparece del
  arqueo del día en que se cobró**. El cierre de un día pasado cambia solo, días después.

### Las preguntas

**1. ¿Quién cierra el día, y es obligatorio?**
La cajera al terminar su turno, ¿o la administradora? ¿Y si nadie cierra —el día queda abierto
para siempre y se sigue recalculando, o se cierra solo a la medianoche?

**2. ¿Un día cerrado se puede reabrir?**
Si la respuesta es sí, el snapshot deja de ser una garantía y pasa a ser una foto más. Si es no,
hay que decidir la 3.

**3. 🔴 La que más importa: ¿qué pasa si alguien anula un pago de un día YA CERRADO?**
Tres caminos posibles, y cada uno significa algo distinto para la contabilidad:

| Camino | Qué implica |
|---|---|
| **Se rechaza** | El día cerrado es intocable. La corrección se hace por fuera del sistema |
| **Se registra como ajuste del día en curso** | El arqueo de ayer queda quieto y la corrección aparece hoy. Es lo que haría un contador |
| **Se permite y el día se reabre** | Vuelve el problema que esto viene a arreglar |

**Mi recomendación**, si sirve: la segunda. Deja el pasado quieto —que es todo el punto del
snapshot— sin perder la plata de vista, y es la forma en que ya funciona cualquier libro contable.
Pero es tu llamada, no la mía: define qué le muestra el sistema a la cajera cuando cierra la caja.

### Lo que se puede hacer sin la respuesta

Nada útil. Escribir el snapshot sin decidir qué pasa después deja la plata anulada **sin aparecer
en ningún día**, que es peor que el problema actual.

---

## T-21-N3-N1 · Las cuatro capacidades del brief de mayo: ¿cuáles se construyen?

**Fecha:** 31/08/2026 · **Bloquea:** T-21-N3-N1

### Por qué la pregunta es otra de la que decía la ficha

Decía que `CLAUDE.md` prometía la carga de contrato con IA como **no negociable** y el producto no
la hacía. **Esa contradicción ya no existe:** el documento se corrigió el 19/08 y hoy declara el
estado real de las cuatro. No hay nada que "cerrar" ahí.

Lo que queda es una decisión de roadmap, y conviene tomarla **por las cuatro juntas**: salieron del
mismo brief y están en el mismo lugar.

| Capacidad | Hoy | Qué costaría |
|---|---|---|
| 1 · Carga de contrato con IA | no existe; hay wizard manual e importación de cartera, las dos andando | un LLM, parseo de PDF y revisión humana — la carga hoy la hace una persona en minutos |
| 2 · Pago unificado con Mercado Pago | **el resultado ya está**: una pantalla, un botón. Falta el medio | integración + webhook. Cambia quién concilia: hoy lo hace una persona |
| 3 · Chat con el contrato (RAG) | no existe, y es el **botón central de la PWA** cayendo en «Próximamente» | embeddings + pgvector + endpoint |
| 4 · Screening crediticio | cáscara; el endpoint ya devuelve 501 en vez de inventar | un proveedor real (Nosis) y su costo por consulta |

### La pregunta

**De las cuatro, ¿cuáles entran al roadmap y en qué orden — y cuáles se sacan del brief?**

Sacarlas es una respuesta tan válida como construirlas, y más barata: el producto **ya resuelve el
problema del cliente sin ellas** — la carga por Excel funciona, y el pago unificado en una sola
transferencia es exactamente lo que Camila pidió. Lo que no es una opción es dejarlas en el limbo
donde se venden afuera y no existen adentro: el «Asistente» de la PWA es la prueba — es el botón
más destacado de la app del inquilino y no hace nada.

---


## Anuncios · ¿un inquilino de SOLO EXPENSAS recibe los anuncios generales?

**Fecha:** 01/09/2026 · **Bloquea:** el residuo del hallazgo de anuncios de la tercera auditoría
(lo demás ya está arreglado en #90 y #112)

### Lo que está verificado, para no volver a mirarlo

El panel y el server **no coinciden en a quién alcanza un anuncio**, y no por un bug de
derivación —eso era el hallazgo y ya está resuelto— sino por un filtro que uno tiene y el otro no:

- **El panel** arma la lista de inquilinos alcanzables con
  `contratosApi.filter((c) => c.estado === 'ACTIVO' && c.tipoContrato !== 'SOLO_EXPENSAS')`
  (`anuncios/page.tsx:489`). De ahí sale **el número que ves antes de confirmar** y también
  **la lista donde elegís contratos uno por uno**.
- **El server** (`resolverAudiencia`, `anuncios.ts`) busca con
  `where: { contrato: { estado: 'ACTIVO' } }`. Sin filtro de tipo.

O sea: hoy **un inquilino de solo expensas SÍ recibe el anuncio** —en la app y por mail—, pero
**no está contado** en el «Enviar a N destinatarios» que confirmás, ni aparece en la lista para
elegirlo a mano.

No es un número al voleo: es la diferencia entre lo que confirmás y lo que sale.

### Por qué no lo arreglé solo

Las dos direcciones son defendibles y significan cosas distintas para el producto:

**A · El server tiene razón: reciben.** Un inquilino de solo expensas es un inquilino de la
inmobiliaria, y «el 12 cortan el agua» le importa igual. El arreglo es sacar el filtro del panel
para que el número diga la verdad. **Costo:** también aparecen en la lista de selección manual, que
es lo que probablemente alguien quiso evitar.

**B · El panel tiene razón: no reciben.** El arreglo es agregar el filtro al `where` del server.
**Costo:** hoy les llega y dejaría de llegarles — un cambio de comportamiento silencioso para
quien ya está usando el producto.

Mi lectura, para que no cuente como neutral: el filtro del panel **parece copiado** del ajuste
masivo, donde sí tiene sentido (un solo-expensas no tiene canon que ajustar). Acá no hay nada
equivalente: las expensas también se deben, y el anuncio no habla de plata. Eso inclina hacia **A**,
pero no lo suficiente como para cambiarlo sin que lo digas.

### La pregunta

**¿Un contrato de SOLO EXPENSAS entra en «Todos los inquilinos», «Morosos» y «Pendientes»?**

Y si la respuesta es sí (opción A): ¿querés que además aparezca en la lista de selección manual, o
sólo que se lo cuente en las audiencias masivas?

## Auth · el techo por IP que falta en el login del propietario, y por qué no lo puse

**Fecha:** 01/09/2026 · **Bloquea:** nada urgente. Es defensa en profundidad, y las dos salidas
tienen consecuencias operativas distintas.

### El hecho, verificado

`POST /auth/propietario/otp/verify` limita **por cuenta** (10 intentos cada 15 minutos, con la
key armada desde el email). Eso es correcto y protege lo que importa: sin él, un atacante con un
proxy rotativo tenía intentos infinitos contra UN propietario.

Lo que ese endpoint **no** tiene es un techo **por IP**. El comentario del código decía que sí
—"el global de 300/min sigue aplicando"— y es falso: el `onRoute` de `@fastify/rate-limit` es un
if/else, así que declarar `config.rateLimit` en una ruta **reemplaza** al global en vez de
sumarse. Ya está corregido el comentario.

Sin ese techo, un host sin autenticar puede mandar requests con un email distinto cada vez: la
key nunca se repite, nada lo cuenta, y **cada request se queda 900 ms** en el piso anti-timing
sosteniendo un socket y un timer. No entra a ninguna cuenta; hace ruido y consume el servidor.

### Por qué no lo arreglé solo

Probé lo obvio —agregar un segundo limitador por IP en `onRequest`— y **desactiva el de cuenta
en silencio**. El plugin marca la request con un flag interno y **corre sólo el primero**: el
techo por IP le come el lugar al que protege la cuenta. Lo agarró un test que ya existía, que
pasó de 429 a 401.

O sea: **no se puede apilar**. Queda fijado con un caso de prueba para que el próximo que lo
intente se entere antes y no después.

### Las dos salidas reales

**A · Una segunda instancia del plugin con `global: false`.** Tendría su propio flag, así que
los dos limitadores correrían. **Costo:** las otras seis rutas que declaran `config.rateLimit`
—los logins del panel, del inquilino y el registro— pasarían a tener **dos** limitadores
contando lo mismo. No cambia el comportamiento, pero es una pieza de infraestructura nueva que
toca todas las puertas de entrada a la vez.

**B · El techo en el borde: Render, o el proxy que esté adelante.** Es donde vive naturalmente
un límite por IP, no cuesta código, y no toca ninguna ruta. **Costo:** vive afuera del repo, así
que no lo ve el que lee el handler ni lo prueba la suite — y esta sesión ya mostró varias veces
lo que pasa con las reglas que viven en un solo lado.

### La pregunta

**¿Va A o B?** Y si es B: ¿quién lo configura y dónde queda anotado para que el que lea el
handler sepa que existe?

Mi lectura, para que no cuente como neutral: **B**, porque el daño que falta cubrir es de
recursos y no de cuentas, y el borde es donde eso se resuelve barato. Pero A es la única que
deja el techo dentro del repo, y eso vale.

## Renovaciones · qué queda anotado cuando un contrato se renueva

**Fecha:** 01/09/2026 · **Bloquea:** nada. Está arreglado y funcionando; esto es para que la
decisión sea tuya y no mía.

### Lo que estaba roto

Renovar un contrato **no limpiaba la intención de renovación**. `IntencionRenovacion` es una
fila por contrato y hasta hoy sólo la escribía la pantalla de decisión. Así que si el inquilino
avisaba que no renovaba —con su fecha de egreso— y después negociaban y renovaban, quedaba un
contrato con plazo hasta 2028 y, colgado, un "se va el 30/09/2026".

Se veía en tres lados a la vez: el KPI **"No renuevan"** lo seguía contando, la tarjeta mostraba
las dos fechas juntas, y el expediente de la propiedad seguía empujando el hito "Aviso de egreso
del inquilino". Ya está arreglado.

### La decisión que tomé, y que podés dar vuelta

Cuando se renueva, la intención vuelve a **SIN_RESPUESTA** y se limpian la fecha de egreso, el
comentario y la fecha de la decisión.

La alternativa obvia era escribir **RENOVAR**: al fin y al cabo renovaron. **No la elegí**
porque esa pregunta es sobre *el vencimiento que viene*, y la pantalla la muestra contra la
fecha de fin NUEVA. Poniendo RENOVAR, en 2028 el contrato aparecería como "quieren renovar" sin
que nadie se lo haya preguntado a nadie: el mismo defecto de hoy con el signo cambiado. Lo
cierto después de renovar es que **sobre el plazo nuevo todavía no se habló**.

El hecho de la renovación no se pierde: queda en la tabla de renovaciones y en el historial del
contrato.

**Consecuencia práctica:** un contrato recién renovado aparece en "Falta avisar" cuando entra en
los últimos 6 meses del plazo nuevo. Que es, me parece, lo que querés que pase.

### La pregunta

**¿Va así, o preferís que renovar deje anotado RENOVAR?** Si preferís lo segundo, es cambiar una
palabra — pero conviene decidirlo sabiendo que la pantalla va a decir que quieren renovar sin
que nadie haya preguntado.

Y una que no depende de esto: **¿querés que el aviso de egreso quede en la historia de la
propiedad aunque después renueven?** Hoy no queda —la intención es una sola fila y se pisa—, y
eso ya pasaba antes con cualquier cambio de opinión. Guardarlo pide una tabla de historial.

## Consorcios · el estado de una unidad, ¿lo escribe alguien o sale solo?

**Fecha:** 01/09/2026 · **Bloquea:** nada. La mentira ya está tapada; falta decidir si el
campo tiene dueño.

### Lo que estaba roto y ya se arregló

Toda unidad funcional cargada desde el panel figuraba con badge verde **"Al día"**, debiera
lo que debiera. El formulario nunca manda el campo `estado` —no tiene ningún control para
eso— así que se quedaba en el valor por defecto para siempre. En la fila quedaba "$480.000"
en ámbar y, al lado, "Al día" en verde.

Ahora el badge no puede contradecir el número: con deuda dice "Con deuda", sin deuda dice
"Al día", y si hay un estado guardado que cuadra —"Plan de pago", "Vencido"— manda ése,
porque dice más.

### Lo que sigue faltando

La administradora **no puede** marcar una unidad como "plan de pago" ni como "vencido"
desde el panel. Son estados reales de la administración de un consorcio, y hoy sólo existen
en las unidades del seed.

Hay dos formas de resolverlo y no son la misma cosa:

**A · Un selector en el formulario de la unidad.** La administradora lo pone a mano. Rápido
de hacer. **Costo:** es un dato que envejece solo — se acuerda de ponerlo el día que arma el
plan de pago, y nadie se acuerda de sacarlo cuando el plan se cumple o se cae. En seis meses
la columna dice cosas de hace seis meses.

**B · Que salga de la emisión de expensas, cuando exista.** Con períodos emitidos hay fecha
de vencimiento, y "pendiente" vs. "vencido" se calcula solo. **Costo:** no existe todavía, y
"plan de pago" igual va a necesitar que alguien lo marque —eso no lo deduce ningún sistema—.

### La pregunta

**¿Va A ahora, o se espera a B?** Y si va A: **¿quién lo saca?** Un estado que sólo se
prende y nunca se apaga es peor que no tenerlo, porque se lee como si estuviera al día.

Mi lectura: **esperar a B para pendiente/vencido**, y si hace falta ya, un selector sólo
para "plan de pago" —que es el único que un sistema no puede deducir— con la fecha de hasta
cuándo vale, así se apaga solo.

## Servicios · las boletas que sube el inquilino no las ve nadie

**Fecha:** 01/09/2026 · **Bloquea:** decidir esto antes de escribir código, porque la
pregunta no es técnica.

### El hecho

El inquilino saca foto de la boleta de luz y la sube. La fila se guarda bien. Y ahí queda:
**ningún endpoint del panel la lee**. Las únicas lecturas de esa tabla en toda la API son
el listado del propio inquilino y dos chequeos internos de permisos de archivos. Del lado
de la inmobiliaria hay tres pantallas escritas para mostrarlas y las tres están apagadas en
producción, leyendo datos de mentira.

Además el inquilino **no puede marcar una boleta como paga**: el estado existe en la base
(PAGADA, EN_REVISION) pero no hay ningún endpoint que lo mueva, así que todas quedan en
"subida" para siempre.

Lo que la pantalla *decía* ya lo arreglé (#129): no promete más que la inmobiliaria las ve,
no le pide marcar como paga sin darle el botón, y el aviso de vencimiento dejó de quedarse
pegado con la boleta más vieja. **Eso tapa la mentira, no el pozo.**

### Lo que falta, medido

Tres endpoints chicos y dos pantallas que ya están escritas:

1. `GET /contratos/:id/boletas` para el panel, con filtro por inmobiliaria.
2. Un endpoint que mueva el estado de la boleta (pagada / en revisión).
3. Un borrado, para la boleta subida por error.
4. Prender `BoletasInquilinoPanel` (ficha de la propiedad) y la card de alertas de
   servicios, que hoy leen mocks.

Es de una tarde. **No lo hice porque antes hay que contestar una pregunta de producto.**

### La pregunta

**¿Qué hace la inmobiliaria con una boleta cuando la ve?** De la respuesta depende todo lo
demás:

- **Sólo mirarla** (control de que el inquilino paga los servicios, que suele ser
  obligación del contrato) → alcanza con el listado, y "marcar como paga" lo hace el
  inquilino.
- **Validarla** (la inmobiliaria confirma que está paga) → entonces el estado lo mueve la
  inmobiliaria y no el inquilino, y EN_REVISION empieza a significar algo.
- **Cobrarla o descontarla** (que entre a la liquidación) → es otra cosa, mucho más grande,
  y toca plata.

Y una segunda, más chica: **¿el inquilino puede borrar una boleta que subió?** Si la
inmobiliaria la usa como comprobante de algo, no debería.

Mi lectura: **la primera**. Es lo que la pantalla ya insinuaba, es lo que sirve el día uno,
y no compromete nada de plata. Pero decidilo vos, porque las otras dos no se agregan
después sin rehacer esto.

## Rechazar un contrato borra los documentos del inquilino

**Fecha:** 02/09/2026 · **Bloquea:** sí — hay que decidir antes de que alguien rechace un
contrato con documentos cargados. Hoy no hay datos en producción, así que el reloj todavía no
corre.

### El hecho

Cuando se **rechaza** un contrato desde la bandeja de aprobaciones, el sistema borra al
inquilino y, antes, a todos sus hijos: los códigos de OTP, los acuses de anuncios, **los
documentos que subió** y **sus certificados**. Está en `plata.ts:3311-3317`.

El motivo escrito en el código es que, si no, «su email queda tomado» por un
`@@unique([inmobiliariaId, email])`. **Ese unique ya no existe.** El schema de hoy dice textual
lo contrario: *«El email NO es único a nivel Inquilino»* — cambió con el multi-alquiler, para
que la misma persona pueda tener tres contratos con el mismo mail.

O sea: se destruyen documentos para evitar un choque que no puede ocurrir.

### 🔴 Por qué nadie lo vio

El tablero **decía que esto no pasaba**, y lo decía como una corrección verificada: *«no hay
ningún `delete` en ese camino. Lo verifiqué línea por línea»*. Era falso, y la versión anterior
—la que esa corrección tachó— tenía razón. Ya está arreglado el documento.

Es la peor forma del error: un papel que afirma que el defecto no está, con el tono de quien ya
fue a mirar. El que lo lee no vuelve a abrir el archivo.

### Por qué no lo saqué yo

Porque sacar el borrado tiene una consecuencia visible, y elegirla es tuyo:

**A · Dejar de borrar.** Los documentos se conservan. **Costo:** el inquilino de un contrato
rechazado queda con su fila viva, y el selector «Mis alquileres» del login **no filtra por
estado** — así que vería un borrador rechazado listado como un alquiler suyo. Se arregla
excluyendo los BORRADOR de ese selector (un contrato que nunca existió no es un alquiler), pero
es un segundo cambio, en el camino de login.

**B · Seguir borrando, pero no los documentos.** No se puede: el `Inquilino` no se puede borrar
sin sus hijos, es una FK.

**C · Dejarlo como está.** Se pierden los documentos de cada contrato rechazado. Hoy eso es
gratis porque no hay datos; el día que Camila rechace un contrato al que el inquilino ya le
subió el DNI y el recibo de sueldo, no.

### La pregunta

**¿Va A?** Es lo que yo haría —los documentos son irrecuperables y el motivo del borrado se
evaporó—, pero arrastra el cambio en el selector del login, que es una superficie sensible.

Y la de al lado, que es la que cierra el círculo: **¿se construye
`POST /contratos/:id/reenviar-aprobacion`?** Corregir un borrador rechazado ya se puede desde
hoy (#51); volver a mandarlo a aprobación, no. Sin eso, un contrato rechazado es papel mojado
igual, se borren o no los documentos. El PR **#49** construye las dos mitades y sigue abierto.

## Los PRs de julio: qué quedó vivo del alta de contrato

**Fecha:** 02/09/2026 · **Bloquea:** decidir el alcance. Nada urgente, pero cada semana que
pasa el rebase es más caro.

### Qué se hizo con los 14

Antes de rebasar nada se midió, uno por uno, si el problema que cada PR dice arreglar **sigue
existiendo en el `main` de hoy** — después de los 62 PRs que entraron. El resultado:

| | |
|---|---|
| **Entraron** | #7 (páginas legales) · #38 (instalar la app) · #51 (corregir borrador) · #5 (landing) · #47 (semáforo del DNI, por cherry-pick en #135) |
| **Cerrados: ya estaban arreglados** | #4 · #45 · #46 — los tres por otra mano, con otro nombre, y en mejor versión |
| **Quedan abiertos** | #37 · #39 · #41 · #44 · #48 · #49 |

De los que entraron, dos traían sorpresas: **#5** revivía una promesa que sacamos hoy («el
ajuste por índice se aplica solo»), y **#51** violaba un guard que entró después de que se
escribiera. Las dos se resolvieron a mano.

Y del triage salieron **dos defectos vivos** que estaban enterrados en PRs demasiado grandes
para rebasar, y se rescataron solos: la comisión tipeada con coma se guardaba multiplicada por
diez (#138), y el rechazo borra los documentos del inquilino (arriba en este mismo archivo).

### Los seis que quedan son UNA sola cosa

#37, #39, #41, #44 y #48 son el **rework del alta de contrato** de julio. #48 es la rama de
integración que junta a los demás: **5.638 líneas**, contra un `main` que se movió **~700
commits** desde su punto de partida.

Y están medio hechos **por otro lado**: mientras esas ramas esperaban, alguien resolvió la mitad
de cada una con otro nombre. La bandeja hoy ya muestra el contrato entero (`89132c93`), la
propiedad de caja ya es opcional, la cuenta de cobranza ya se carga sin salir del alta
(`b00f5c19`, y mejor que en el PR).

Lo que sigue faltando de cada uno es chico y no se parece a lo que el PR dice en el título:

- **#37** — cuenta obligatoria, cuenta predeterminada, y bloquear la archivada. *Y un guard de
  dos líneas en el KPI «A rendir a propietarios», que hoy resta para siempre los gastos sin
  propiedad y suma los dólares 1 a 1.*
- **#39** — el cartel de cancelar sigue mintiendo («vas a perder el progreso», y el borrador
  sobrevive).
- **#41** — el preview de plata antes de aprobar: cuántas cuotas se van a generar, cuánto se da
  por cobrado, la deuda inicial.
- **#44** — el detalle del contrato sigue con Aprobar/Rechazar en «Próximamente», y
  `GET /contratos/:id` imprime el user id crudo en vez del nombre.
- **#49** — corregir y **reenviar** un contrato rechazado.

### La pregunta

**¿Se rebasan, o se reescribe lo que queda contra el `main` de hoy?**

Mi lectura: **reescribir**. Rebasar 5.638 líneas contra 700 commits de deriva, sobre
`core.ts`, `plata.ts` y el wizard del alta —los tres archivos más calientes del repo— es donde
se pierde trabajo en silencio, y hoy ya sabemos que la mitad de lo que traen ya está. Lo que
falta suma unas pocas pantallas, cada una con su propio PR chico y su test.

Pero es tu llamada, porque significa **cerrar cinco PRs con trabajo real adentro**. Y hay una
que va antes que todas: **¿se construye el reenvío de un contrato rechazado?** De esa respuesta
depende si el trabajo de #41 y #49 es una especificación o se tira.

## El tablero suma pesos y dólares en el mismo número

**Fecha:** 02/09/2026 · **Bloquea:** no urgente, pero el número está mal hoy para cualquier
inmobiliaria con un contrato en dólares — que en Argentina son casi todas.

### El hecho

Los KPIs de plata del tablero —«Cobrado», «Por cobrar», «En mora», «A rendir a propietarios»—
suman **todos los contratos juntos, sin mirar la moneda**. Un alquiler de USD 1.200 entra al
mismo total que uno de $600.000, uno a uno. Lo mismo los gastos de caja, que tienen su propia
moneda y se restan sin convertir.

No es que falte una cotización: **el número no significa nada**. No es ni pesos ni dólares.

### El repo ya decidió qué hacer con esto, en otro lado

En el detalle por propietario, cuando hay dos monedas, el código hace esto —y está comentado—:

> *«Mezcladas → 0 y sin moneda: la UI muestra "—" en vez de un total falso.»*

Y la rendición **sólo toma los movimientos de SU moneda**. O sea que la regla existe y está
aplicada donde alguien la pensó. Al tablero no llegó.

### Por qué no lo arreglé solo

Porque aplicar esa misma regla al tablero **cambia lo que ve la administradora todos los días**:
el KPI principal pasaría a mostrar «—», o a partirse en dos números, para cualquier cartera con
un contrato en dólares. Eso es una decisión de producto, no una corrección.

Las tres salidas, con su costo:

**A · La regla que ya existe: si hay mezcla, «—».** Consistente con el resto del sistema y
honesta. **Costo:** una cartera con un solo contrato en dólares pierde el número del tablero
entero, que es el que se mira primero a la mañana.

**B · Dos números, uno por moneda.** «A rendir: $1.240.000 · US$ 3.400». **Costo:** hay que
rehacer las tarjetas del tablero, y hay que decidir qué pasa con los porcentajes (la
cobrabilidad, la ocupación).

**C · Convertir a pesos con una cotización.** **Costo:** el sistema no tiene cotización de nada,
y meterla es un componente nuevo que envejece cada día. Sería la primera vez que el producto
inventa un número que nadie cargó.

### La pregunta

**¿A, B o C?** Mi lectura es **B**: es lo que la administradora ya tiene en la cabeza —lleva las
dos monedas por separado— y no le saca información como A. Pero es la más cara de las tres.

*(Lo que sí arreglé aparte, porque no dependía de esto: el KPI restaba el alquiler de la oficina
y los sueldos de lo que hay que rendirle a los propietarios, todos los meses y para siempre.)*

### 🔎 Ampliación del 02/09 — hay una cuarta salida, y ya está construida

Barrí el producto entero buscando esta clase de defecto y aparecieron **quince** lugares, todos
vivos en producción. Nueve **no piden ninguna decisión**: el repo ya tiene el helper
`formatTotalPorMoneda` —con su test y con el porqué escrito— y esos sitios simplemente no lo
usaban. Ésos los arreglé y van aparte.

Los otros seis son los KPIs del tablero, que son los que dependen de esta decisión.

**Y apareció una opción D que no había visto: la que `/estadisticas` ya usa.** Esa pantalla
resuelve el mismo problema así: el server **filtra a pesos**, rotula la respuesta como ARS, y
devuelve un `hayOtrasMonedas` que enciende un cartel ámbar —«Estos números son en pesos
(ARS)»—. O sea que el producto **ya tiene una respuesta construida y probada** para esta
pregunta, en otra pantalla.

**D · Copiar lo de `/estadisticas`: mostrar sólo pesos y avisar que hay más.** **Costo:** el
tablero deja de contar los contratos en dólares, pero lo dice. **Ventaja sobre A, B y C:** ya
está escrito, ya se probó, y hace que dos pantallas del panel cuenten la misma historia en vez
de tres.

Con eso, mi lectura cambia: **D primero** (barato, consistente, y saca el número falso hoy), y
B —los dos números— cuando se quiera dar el paso completo.

---

## T-17 · ¿Qué eventos avisan por mail, y a quién?

**Fecha:** 03/09/2026 · **Bloquea:** el punto 1 de T-17, que es el que quedó abierto.

### Lo que ya está resuelto

Camila lo pidió así: *«tiene que notificarle también los reclamos, tiene todo por email y por
la plataforma, por si no no está enterada»*. Los reclamos ya están cerrados de punta a punta:

| evento | a quién | desde |
|---|---|---|
| reclamo nuevo | a la inmobiliaria (a la casilla que ella configure) | T-17 |
| profesional asignado | al inquilino titular | T-17 |
| reclamo resuelto — desde el panel | al inquilino titular | T-17 |
| reclamo resuelto — **desde el link del profesional** | al inquilino titular | #158, hoy |

Esa última faltaba, y era la que más se usa: el profesional cerraba el trabajo, el reclamo
quedaba resuelto y al inquilino no le llegaba nada.

### Lo que falta, y es una decisión tuya

El requerimiento original pedía «hacer el inventario de qué eventos disparan mail». Ese
inventario **no está escrito ni decidido**, y el mailer hoy no tiene nada para:

- **pago informado** (el inquilino subió el comprobante) → ¿le avisa a la inmobiliaria? ¿a qué
  casilla, la de reclamos o la general?
- **pago validado** → ¿al inquilino? Hoy lo ve en la app si entra.
- **pago rechazado** → éste es el más fuerte: el inquilino cree que pagó y no pagó.
- **contrato pendiente de aprobación** → ¿al que aprueba, o alcanza con la campana del panel?
- **vencimiento próximo** → el recordatorio antes del día de pago. Es el único de la lista que
  necesita algo que hoy no existe: un disparador por tiempo, no por acción.

### Por qué no lo decidí solo

Porque cada mail de más es una razón para que alguien mande todo a spam, y ahí se pierden los
que sí importan. La pregunta no es técnica: es **cuántos mails tolera por mes un inquilino
tuyo**. Escribir los cinco es una tarde; elegir cuáles, no.

### La pregunta

¿Cuáles de esos cinco van, y a quién? Con una lista alcanza. Mi lectura, como punto de partida:
**pago rechazado** sí —el inquilino está en falta y no lo sabe— y **vencimiento próximo** sí,
que es el que evita la mora. Los otros tres ya los cubre la app.

---

## T-22 · El consorcio no tiene a quién mandarle el mail

**Fecha:** 03/09/2026 · **Bloquea:** la segunda mitad de T-22.

### Lo que está hecho

Camila carga la expensa del período desde la ficha del consorcio: lápiz sobre el stat «Expensa
del mes», elige período e importe, y sale un `PUT /consorcios/:id`. Eso ya funciona (entró como
T-47).

### El hecho

**No hay ninguna dirección de correo a la que avisarles.** `UnidadFuncional` tiene `titular` y
`telefono`, y **no tiene email**. En concreto:

- la audiencia `TODOS_CONSORCIOS` de `POST /anuncios` cuenta destinatarios, manda **cero** mails
  y lo loguea;
- la única audiencia que sí manda mail al consorcio —`INQUILINOS_CONSORCIO`— resuelve por
  `propiedad.consorcioId` y sólo alcanza a inquilinos con contrato ACTIVO cargado. O sea que
  **no llega al titular de una unidad que la inmobiliaria sólo administra**, que es exactamente
  el caso que planteó Camila;
- lo único que ofrece la ficha para avisar es un enlace `wa.me` **sin número de destino**: abre
  WhatsApp con el texto y sin destinatario;
- y los dos flujos están desconectados: cargar la expensa no dispara ningún aviso.

### Lo que hay que construir, medido

1. **Email en `UnidadFuncional`** (o un vínculo UF → persona), con su alta y edición en el panel.
   Es un cambio de modelo, y por eso no lo hice: CLAUDE.md pide consultarte antes.
2. Que la audiencia de consorcio **incluya a los titulares de UF**, no sólo a inquilinos.
3. El gesto «cargué la expensa del mes → avisales», reusando `enviarAnuncioEmail`.

### La pregunta

Dos, y la segunda depende de la primera:

- **¿Le agregamos email a la unidad funcional?** Es la única forma de que esto exista. Si va, el
  resto es trabajo mecánico.
- **¿Quién carga esos mails?** Porque el punto 1 sin el 2 es una columna vacía. Si la
  inmobiliaria los tiene en una planilla, conviene pensar una importación; si no los tiene, esto
  no se resuelve con código.

---

## T-13 · Mover plata entre cuentas de caja

**Fecha:** 03/09/2026 · **Bloquea:** el punto 3 de T-13. Los puntos 1 y 2 ya están cerrados.

### El hecho

`TipoMovimientoCaja` tiene dos valores: `GASTO` e `INGRESO_EXTRA`. No hay traspaso. Hoy la única
forma de pasar plata de una cuenta a otra es **cargar una salida y una entrada sueltas**, y si
alguien anula una, **la otra queda colgada**: la caja queda descuadrada y nada avisa.

### Lo que hay que construir

Un tipo de movimiento de traspaso (o un par vinculado) en `MovimientoCaja`, su endpoint, y la UI
en `/caja`. Toca el modelo de datos: por eso está acá y no hecho.

### La pregunta

¿Traspaso como **un** movimiento con cuenta origen y destino, o como **dos** movimientos
vinculados por un id común? Los dos andan; la diferencia es qué pasa cuando alguien anula.

Mi lectura: **un solo movimiento** con las dos cuentas. Es la única forma de que el estado a
medias no pueda existir, que es justo el problema que la tarea vino a resolver.

---

## T-23-N2-N1 · El propietario que nunca entra al portal

**Fecha:** 03/09/2026 · **Bloquea:** los puntos 2 y 3 de la ficha. El punto 1 ya está (#162).

### Lo que ya está

`emailVerificadoAt` existe, se sella al canjear el OTP, se cae sola si alguien edita el email, y
desde hoy **se ve en el panel**: el propietario que entró alguna vez y después quedó con un mail
que nadie probó aparece con «Mail sin confirmar». Eso era el «primero se mide» que la ficha
pedía y que no se podía hacer desde el producto.

### Los dos que quedan

1. **No hay circuito para el que NUNCA entra.** La única vía de verificación es completar un
   OTP. O sea que justamente la población riesgosa —el typo, el mail de placeholder— queda sin
   verificar **para siempre**, y sin forma de invitarla a probarlo. Un doble opt-in explícito
   («confirmá tu mail») es una decisión de producto y de tono: sería el primer mail que le
   mandamos a un dueño que quizá ni sabe que existimos.

2. **¿Se bloquea a los no verificados?** Está abierta a propósito. Hay un test que existe
   justamente para impedir que alguien la «complete» cerrando la puerta sin esta decisión, y no
   lo toqué. Bloquear protege de mandarle plata al mail equivocado; también deja afuera a un
   dueño legítimo que no revisa el correo.

### La pregunta

¿Mandamos un mail de confirmación a los propietarios que nunca entraron? Y si sí, ¿una vez, o
cada tanto hasta que confirme?

---

## T-11 · El depósito de garantía no se puede corregir

**Fecha:** 03/09/2026 · **Bloquea:** nada urgente. Es un hueco chico que quedó abierto.

`Contrato.depositoGarantia` **sólo se escribe en el alta**. No hay ningún endpoint que lo toque
después. Si se cargó mal, la única salida es rehacer el contrato — que es la rescisión falsa de
la que se queja Camila, y es justo lo que T-11 vino a evitar.

`montoExpensas`, que la ficha ponía en el mismo renglón, ya se cerró (`PATCH
/contratos/:id/expensas`). Éste quedó.

### La pregunta

¿Lo puede corregir un ADMIN, o el depósito es intocable una vez firmado? Es plata que el
inquilino entregó: cambiarlo cambia cuánto se le devuelve al final. Si va, va con rastro de
auditoría y probablemente sólo para ADMIN.

---

## Lo que no es una decisión: cuatro cosas que sólo podés hacer vos

**Fecha:** 03/09/2026

No son preguntas: son tareas de la reunión que **no se resuelven con código** y que quedan
esperando que alguien las haga a mano. Las dejo acá para que no se pierdan en el backlog.

- **T-03 · Poner en rol CAJA a quien atienda el mostrador.** La cadena está verificada de punta
  a punta: el panel ofrece CAJA, el `PUT /usuarios/:id` lo acepta, el enum de Postgres lo tiene
  y la matriz le da conciliar/rechazar. Falta el gesto humano, en Configuración → Equipo.
  **Avisale a Camila antes**: desde ese cambio un OPERADOR ya no puede confirmar un pago, y
  enterarse en el mostrador es un mal momento.

- **T-04 · La consulta contra producción.** Hay que mirar si existe algún pago `CONCILIADO` con
  `decididoPorId` en null, y escribir cuál de las tres hipótesis era. Dos advertencias: (a) el
  bloqueo que la propia tarea imponía —«ninguna tarea puede tocar el flujo de pagos antes de que
  ésta cierre»— ya se violó de hecho: 54 commits tocaron `plata.ts` desde el 01/08 y salieron a
  producción el 02/09, así que la hipótesis del «estado intermedio de deploy» es hoy más difícil
  de descartar, no menos; (b) si aparece uno, antes de declararlo bug grave conviene mirar si
  viene de `aplicar-deposito.ts`, que acepta `usuarioId` null por firma aunque hoy ningún
  llamador lo ejerza.

- **T-05 · La sesión de prueba con Camila.** La nota vieja decía que «cada merge a main sale a
  la producción de la clienta cero sin ningún portón». **Eso ya no es cierto**: se escribió
  cuando producción estaba en Railway y `git push` era el deploy. Desde la migración a Render
  del 29/08 los tres servicios tienen `autoDeploy: no` — mergear a main **no** despliega, hay
  que apretar Deploy a mano. O sea que el riesgo de moverle el piso sin querer ya no existe.
  Queda el acuerdo humano: durante la sesión nadie toca Deploy. Y conviene anotar al empezar el
  SHA que devuelve `curl -s https://myalq-api.onrender.com/health`, para poder descartar después
  los reportes de una ventana con un deploy en el medio.

- **T-19 · Monedas.** Lo de código está cerrado (T-57 y T-58). Lo que queda de esta tarea es
  operativo.
---

## T-11 · ¿La edición del contrato la puede hacer sólo la administradora?

**Estado: la traza ya está hecha. Esto es lo único que falta, y es tuyo.**

### Lo que ya no hay que mirar

Camila pidió (55:30) poder corregir el teléfono de un inquilino y cambiar un garante en un
contrato con pagos, sin rescindir nada, **y que quede registrado quién lo hizo**. Las tres
cláusulas:

1. Se puede editar sin rescindir → **hecho**. Ningún endpoint corta por tener pagos.
2. El garante se puede cambiar en un contrato vigente → **hecho**, y la UI es real (`use-garantes`
   pega contra la API, los lápices están en la pestaña Garantes, que no está gateada por estado).
3. Queda registrado quién lo hizo → **hecho hoy (03/09)**. Eran las dos únicas ediciones de
   contrato sin autor. Ahora escriben `EventoAuditoria`, y como el garante se borra **duro**, el
   evento guarda lo que decía la póliza: es el único lugar donde ese dato sobrevive.

### La pregunta

Camila dijo textual **«solamente la administradora»**. Hoy los tres endpoints piden la capacidad
`contratos.crear`, que en `permisos.ts` es `['ADMIN', 'OPERADOR', 'CARGA']`. O sea que el teléfono
lo puede editar CARGA y el garante de un contrato vigente lo puede editar OPERADOR.

**¿Lo recorto a ADMIN?**

### Por qué no lo hice solo

Porque no agrega una capacidad: **saca** una que hoy alguien está usando. Si una operadora
corrige teléfonos todos los días, mañana le aparece un 403 y nadie le avisó. Eso no lo puede
decidir el que escribe el código.

Y hay una versión intermedia que quizá sea la que querés: **dejar que OPERADOR corrija el
teléfono** —que no reapunta nada, y es justo el caso que el endpoint vino a resolver— y recortar
a ADMIN sólo **el email** (que ya está recortado para CARGA, porque es la credencial del
inquilino) **y la garantía de un contrato vigente** (que hoy ya está recortada para CARGA por el
estado del contrato).

Tres opciones, en orden de cuánto rompen:

| | Quién puede | Qué se rompe |
|---|---|---|
| **A. Como está** | ADMIN, OPERADOR, CARGA | nada, pero no es lo que Camila pidió |
| **B. Intermedia** | teléfono: los tres · email y garante vigente: ADMIN | el operador pierde la garantía, que hoy toca |
| **C. Literal** | sólo ADMIN | la operadora pierde el teléfono, que es el caso que motivó todo |

Mi recomendación es **B**: cumple el espíritu —lo que da poder queda arriba— sin sacarle a nadie
el trabajo del día. Pero decidilo vos.

