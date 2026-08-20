import type { PrismaClient, TipoEventoContrato } from '@prisma/client';

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
 * NUNCA TIRA — y ahora es verdad. Un evento del historial es informativo: si falla su
 * escritura, no puede voltear la operación que lo generó (conciliar un pago, activar un
 * contrato). Se traga el error a propósito; el precio es un hueco en el timeline.
 *
 * ESA PROMESA ESTUVO ROTA, y el arreglo es la firma. Antes esta función aceptaba un
 * `Prisma.TransactionClient`, y los cinco call sites le pasaban su `tx`. En PostgreSQL una
 * sentencia que falla dentro de una transacción la deja ABORTADA: todo lo que venga después
 * falla y el COMMIT se comporta como ROLLBACK. Así que atrapar el error no salvaba nada — la
 * conciliación del pago se perdía igual, sólo que en silencio y con el endpoint devolviendo
 * 200. El `catch` no protegía la operación: escondía que se había perdido.
 *
 * Lo destapó la migración de `RENOVACION`: sin aplicar, renovar un contrato fallaba al
 * escribir el evento por un valor de enum que la base no conocía, y la renovación entera
 * desaparecía sin ruido.
 *
 * Por eso el primer parámetro es `PrismaClient` y NO acepta un `tx`: el compilador es el que
 * garantiza que esto corra siempre fuera de la transacción, con ella ya commiteada. Es el
 * mismo contrato que `registrarEvento` de auditoría ("se llama DESPUÉS de que la acción ya
 * commiteó"). Si alguna vez hace falta escribir el historial adentro de una transacción, no
 * alcanza con ensanchar el tipo: hay que sacar el `catch`, porque ahí deja de ser una red.
 */
export async function registrarEventoContrato(
  db: PrismaClient,
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
    await db.eventoContrato.create({
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
    // AHORA SÍ se puede tragar: la firma ya no acepta un `tx`, así que esto corre
    // siempre fuera de la transacción y con ella ya commiteada. El precio real pasa a
    // ser el que el comentario viejo prometía —un hueco en el timeline— en vez de
    // perder la operación entera en silencio.
  }
}
