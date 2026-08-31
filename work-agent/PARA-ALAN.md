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
