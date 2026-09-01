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
