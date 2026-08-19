import type { Prisma, PrismaClient, TipoEventoContrato } from '@prisma/client';

type TxOrClient = Prisma.TransactionClient | PrismaClient;

/**
 * Escribe una entrada en el HISTORIAL del contrato (el expediente que ve el operador en
 * la pestaña "Historial"), no en la auditoría.
 *
 * La distinción importa y es la razón de que existan las dos tablas:
 *  - `EventoAuditoria` responde "quién hizo qué en el sistema" — es trazabilidad interna.
 *  - `EventoContrato` responde "qué le pasó a este alquiler" — es la vida del contrato,
 *    y se lee para entender un caso, no para auditar a un empleado.
 *
 * POR QUÉ ESTE HELPER. Hasta ahora los eventos se escribían inline en cada handler, y de
 * los 8 valores del enum **sólo se escribía uno** (`AJUSTE_APLICADO`). Con el Historial ya
 * visible, un timeline que sólo muestra ajustes es peor que no tenerlo: parece que en ese
 * contrato no pasó nada más.
 *
 * SÍ TIRA, Y ES DELIBERADO. Antes se tragaba el error con este razonamiento: "un evento del
 * historial es informativo, no puede voltear la operación que lo generó; el precio es un hueco
 * en el timeline". La intención era correcta; **la premisa es falsa cuando se llama dentro de
 * una transacción, que es como se lo llama en los 5 call sites (todos pasan `tx`).**
 *
 * En PostgreSQL, un statement que falla dentro de una transacción la deja ABORTADA: todo lo que
 * venga después falla con 25P02 y el COMMIT se comporta como ROLLBACK. Así que atrapar el error
 * no salvaba nada — la conciliación del pago, o la renovación del contrato, se perdía igual.
 * Lo único que lograba el `catch` era que el handler devolviera 200 y el operador creyera que
 * había quedado hecho.
 *
 * El caso concreto que lo destapó: con la migración de `RENOVACION` sin aplicar, renovar un
 * contrato corría toda su transacción, fallaba al escribir el evento por un valor de enum
 * inexistente, el catch lo tragaba, la transacción se revertía entera y el endpoint respondía
 * OK. La renovación desaparecía sin que nadie se enterara.
 *
 * O sea: el precio real no era "un hueco en el timeline", era **perder la operación en
 * silencio**. Entre perderla avisando y perderla callando, avisar gana: el operador reintenta.
 *
 * PARA CUMPLIR LA PROMESA DE VERDAD hay que escribir el evento FUERA de la transacción, con el
 * cliente global y después del commit — que es exactamente lo que ya hace `registrarEvento` de
 * auditoría ("se llama DESPUÉS de que la acción ya commiteó"). Es un refactor de los cinco call
 * sites y queda anotado como tarea aparte. Lo que NO hay que hacer es volver a poner el catch.
 */
export async function registrarEventoContrato(
  tx: TxOrClient,
  datos: {
    inmobiliariaId: string;
    contratoId: string;
    tipo: TipoEventoContrato;
    titulo: string;
    detalle?: string | null;
    /** userId de quien lo hizo, o 'Sistema' si lo generó un proceso automático. */
    autor?: string;
    fecha?: Date;
  },
): Promise<void> {
  await tx.eventoContrato.create({
    data: {
      inmobiliariaId: datos.inmobiliariaId,
      contratoId: datos.contratoId,
      tipo: datos.tipo,
      titulo: datos.titulo,
      detalle: datos.detalle ?? null,
      fecha: datos.fecha ?? new Date(),
      autor: datos.autor ?? 'Sistema',
    },
  });
}
