import type { Prisma, PrismaClient } from '@prisma/client';

type TxOrClient = Prisma.TransactionClient | PrismaClient;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface DepositoEstado {
  /** Lo que el inquilino entregó al firmar. */
  bruto: number;
  /** Reparaciones ya imputadas contra el depósito (CargoContrato contraDeposito). */
  deducciones: number;
  /** Lo que realmente queda para devolver. Nunca negativo. */
  disponible: number;
  /** Deducciones que exceden el depósito: no se pueden cobrar de acá. */
  excedente: number;
}

/**
 * FUENTE ÚNICA de "cuánto depósito queda".
 *
 * Existía la misma cuenta en tres lugares y sólo uno la hacía bien: /depositos/en-custodia
 * restaba las deducciones, mientras que finalizar-preview y deposito/resolver usaban el
 * BRUTO. Consecuencias: el diálogo de rescisión mostraba más depósito del que había (y el
 * saldo neto salía a favor del inquilino por el monto de las reparaciones), y se podía
 * devolver el 100% del depósito teniendo arreglos ya imputados contra él — la inmobiliaria
 * pagaba esos arreglos de su bolsillo, sin vuelta atrás.
 */
export function componerDeposito(bruto: number, deducciones: number): DepositoEstado {
  const b = r2(bruto);
  const d = r2(deducciones);
  return {
    bruto: b,
    deducciones: d,
    disponible: r2(Math.max(0, b - d)),
    // Si las reparaciones superan el depósito, el resto NO desaparece: queda expuesto para
    // que el operador lo reclame por otra vía (antes se evaporaba en silencio).
    excedente: r2(Math.max(0, d - b)),
  };
}

/** Deducciones imputadas al depósito de UN contrato. */
export async function deduccionesDeposito(
  tx: TxOrClient,
  contratoId: string,
  inmobiliariaId: string,
): Promise<number> {
  const agg = await tx.cargoContrato.aggregate({
    where: { contratoId, inmobiliariaId, contraDeposito: true },
    _sum: { monto: true },
  });
  return Number(agg._sum.monto ?? 0);
}

/** Versión batch para listados (evita el N+1 de /depositos/en-custodia). */
export async function deduccionesPorContrato(
  tx: TxOrClient,
  contratoIds: string[],
  inmobiliariaId: string,
): Promise<Map<string, number>> {
  if (contratoIds.length === 0) return new Map();
  const rows = await tx.cargoContrato.groupBy({
    by: ['contratoId'],
    where: { inmobiliariaId, contraDeposito: true, contratoId: { in: contratoIds } },
    _sum: { monto: true },
  });
  return new Map(rows.map((r) => [r.contratoId, Number(r._sum.monto ?? 0)]));
}

/** Estado del depósito de un contrato, leyendo las deducciones. */
export async function estadoDepositoContrato(
  tx: TxOrClient,
  args: { contratoId: string; inmobiliariaId: string; depositoGarantia: Prisma.Decimal | number | null },
): Promise<DepositoEstado> {
  const deducciones = await deduccionesDeposito(tx, args.contratoId, args.inmobiliariaId);
  return componerDeposito(Number(args.depositoGarantia ?? 0), deducciones);
}

/**
 * Cierra los cargos que se cobraron CONTRA el depósito, cuando el depósito se resuelve.
 *
 * La plata ya se retuvo, así que dejan de estar pendientes. Sin esto quedan `saldadoAt: null`
 * PARA SIEMPRE e **insaldables por los cuatro caminos**: invisibles en `/depositos/en-custodia`
 * (filtra RETENIDO), rechazados por `/cargos/:id/saldar`, excluidos de saldar-deuda, y
 * `deposito/resolver` ya no los alcanza porque devuelve 409 si el depósito no está RETENIDO.
 * Deuda fantasma en los libros, sin forma de bajarla.
 *
 * ⚠️ SÓLO se llama cuando el monto devuelto ya fue topeado contra `disponible`. Cerrarlos
 * después de haber devuelto plata comprometida en reparaciones taparía la pérdida en vez de
 * exponerla: la inmobiliaria pagaría esos arreglos de su bolsillo y el libro diría que están
 * saldados.
 *
 * Vivía inline en `deposito/resolver` y `POST /contratos/:id/finalizar` no lo tenía —el mismo
 * patrón que ya había pasado con los guards de reclamos (T-65)—. Está acá para que los dos
 * caminos que resuelven un depósito cierren igual.
 */
export async function cerrarCargosContraDeposito(
  tx: Prisma.TransactionClient,
  args: { contratoId: string; inmobiliariaId: string; usuarioId: string },
): Promise<number> {
  const r = await tx.cargoContrato.updateMany({
    where: {
      contratoId: args.contratoId,
      inmobiliariaId: args.inmobiliariaId,
      contraDeposito: true,
      saldadoAt: null,
    },
    data: { saldadoAt: new Date(), saldadoPorId: args.usuarioId },
  });
  return r.count;
}
