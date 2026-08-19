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
 * ⚠️ SOBRE TRAGARSE EL ERROR: no se puede, y por eso ya no se hace.
 *
 * La versión anterior envolvía el insert en un `try/catch {}` vacío, con el comentario
 * "el historial no puede voltear la operación que lo generó". La intención era correcta;
 * la implementación **no cumplía esa promesa en ningún caller**, porque los cinco pasan un
 * `tx`: en PostgreSQL, cuando una sentencia falla dentro de una transacción, la transacción
 * queda ABORTADA y el COMMIT se cae igual. Tragarse el error no rescataba nada — sólo
 * convertía "la operación falla y se ve" en "la operación se pierde y devuelve 200".
 *
 * El caso concreto que lo destapó: con la migración de `RENOVACION` sin aplicar, renovar un
 * contrato corría toda su transacción, fallaba al escribir el evento por un valor de enum
 * inexistente, el catch lo tragaba, la transacción se revertía entera y el endpoint
 * respondía OK. La renovación desaparecía sin que nadie se enterara.
 *
 * Ahora se propaga y se loguea. Un 500 sobre una renovación perdida es infinitamente mejor
 * que un 200 sobre una renovación perdida: el operador la repite en vez de creerle.
 *
 * PARA CUMPLIR LA PROMESA DE VERDAD hay que escribir el evento DESPUÉS del commit, con el
 * cliente base en vez del `tx` — que es exactamente lo que ya hace `registrarEvento` de
 * auditoría ("se llama DESPUÉS de que la acción ya commiteó"). Eso es un refactor de los
 * cinco call sites y queda anotado como tarea aparte.
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
