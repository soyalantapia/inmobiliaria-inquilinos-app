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
 * NUNCA TIRA. Un evento del historial es informativo: si falla su escritura, no puede
 * voltear la operación que lo generó —conciliar un pago, activar un contrato—. Se traga
 * el error a propósito. El precio es un hueco en el timeline; la alternativa es perder
 * plata por un renglón de historial.
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
  try {
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
  } catch {
    /* el historial no puede voltear la operación que lo generó */
  }
}
