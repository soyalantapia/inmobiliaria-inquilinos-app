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

