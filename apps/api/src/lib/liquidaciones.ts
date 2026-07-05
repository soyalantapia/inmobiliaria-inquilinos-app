import type { Prisma, PrismaClient } from '@prisma/client';

type TxOrClient = Prisma.TransactionClient | PrismaClient;

export type ContratoParaLiquidar = {
  id: string;
  inmobiliariaId: string;
  monto: Prisma.Decimal | number;
  montoExpensas: Prisma.Decimal | number | null;
  moneda: 'ARS' | 'USD';
  fechaInicio: Date;
  fechaFin: Date;
  diaPago: number;
};

/**
 * Calcula (puro, sin tocar la DB) las liquidaciones que corresponden a un
 * contrato a una fecha `now` dada. Separado del writer para poder testear el
 * cómputo de períodos/vencimientos sin una base de datos, y para que `now` sea
 * inyectable (determinismo en los tests).
 *
 * Criterio: una liquidación por mes, desde `fechaInicio` hasta el MES QUE VIENE
 * inclusive (para no pre-facturar todo el futuro, pero dejando siempre el
 * próximo período disponible), sin pasar nunca de `fechaFin`. Así, al activar
 * un contrato nuevo el inquilino ya tiene el período actual + el siguiente para
 * pagar (cubre 1er y 2º pago del circuito).
 *
 * Vencimiento = `diaPago` de cada mes (clamp al último día del mes).
 * `montoPunitorio` queda en 0: se recalcula al día en el cliente/checkout.
 */
export function computarLiquidacionesContrato(
  contrato: ContratoParaLiquidar,
  now: Date,
): Prisma.LiquidacionCreateManyInput[] {
  const alquiler = Number(contrato.monto);
  const expensas = contrato.montoExpensas != null ? Number(contrato.montoExpensas) : null;
  const total = alquiler + (expensas ?? 0);

  const inicio = new Date(contrato.fechaInicio);
  const fin = new Date(contrato.fechaFin);

  // Tope = el menor entre (mes que viene) y (mes de fin del contrato).
  const proximoMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const finMes = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 1));
  const tope = proximoMes < finMes ? proximoMes : finMes;
  const topeY = tope.getUTCFullYear();
  const topeM = tope.getUTCMonth();

  let y = inicio.getUTCFullYear();
  let m = inicio.getUTCMonth();

  const data: Prisma.LiquidacionCreateManyInput[] = [];
  let guard = 0;
  while (guard < 600) {
    const periodo = `${y}-${String(m + 1).padStart(2, '0')}`;
    const diasMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dia = Math.min(contrato.diaPago, diasMes);
    const venc = new Date(Date.UTC(y, m, dia));
    data.push({
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      periodo,
      montoAlquiler: alquiler,
      montoExpensas: expensas,
      montoTotal: total,
      fechaVencimiento: venc,
      estado: venc < now ? 'VENCIDO' : 'PENDIENTE',
      moneda: contrato.moneda,
    });
    // Generamos hasta el tope inclusive; si el inicio ya superó el tope
    // (contrato futuro), queda solo el primer mes.
    if (y > topeY || (y === topeY && m >= topeM)) break;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    guard += 1;
  }

  return data;
}

/**
 * Genera (persiste) las liquidaciones de un contrato.
 *
 * Antes el API NO generaba liquidaciones en ningún lado (solo el seed) → un
 * contrato nuevo no tenía nada que cobrar. Esta función lo resuelve: al activar
 * el contrato se devengan los períodos.
 *
 * Es IDEMPOTENTE (skipDuplicates sobre @@unique([contratoId, periodo])), así se
 * puede llamar de nuevo sin duplicar. Para devengar meses nuevos con el correr
 * del tiempo, volver a llamarla (cron / acción del panel). Devuelve cuántas
 * liquidaciones nuevas se crearon.
 */
export async function generarLiquidacionesContrato(
  tx: TxOrClient,
  contrato: ContratoParaLiquidar,
): Promise<number> {
  const data = computarLiquidacionesContrato(contrato, new Date());
  if (data.length === 0) return 0;
  const res = await tx.liquidacion.createMany({ data, skipDuplicates: true });
  return res.count;
}

/**
 * Marca VENCIDO las liquidaciones PENDIENTE cuyo vencimiento ya pasó.
 *
 * El estado se congelaba al CREAR (computarLiquidacionesContrato:67, `venc < now`)
 * y NADA lo re-evaluaba después: una liquidación devengada con vencimiento futuro
 * nacía PENDIENTE y NUNCA pasaba a VENCIDO al vencer, así que los morosos reales
 * figuraban PENDIENTE y la cobranza no los veía. Este barrido (idempotente) lo
 * corrige. Se dispara junto al devengo (cron in-process + endpoint del panel).
 * NO toca PARCIAL (mantiene el dato "pagó una parte"); la mora de un parcial
 * vencido la resuelve la derivación on-read de estadoPagoActual (core.ts).
 * `inmobiliariaId` opcional: acota el barrido al tenant (disparo del panel).
 */
export async function marcarLiquidacionesVencidas(
  tx: TxOrClient,
  inmobiliariaId?: string,
): Promise<number> {
  const res = await tx.liquidacion.updateMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: new Date() },
      // Sólo contratos ACTIVO: una liquidación remanente de un contrato finalizado
      // NO debe vencerse sola y convertirse en morosidad fantasma (finalizar ya
      // anula las cuotas futuras sin pago; esto es el cinturón de seguridad).
      contrato: { estado: 'ACTIVO' },
      ...(inmobiliariaId ? { inmobiliariaId } : {}),
    },
    data: { estado: 'VENCIDO' },
  });
  return res.count;
}

/**
 * Devenga (top-up) las liquidaciones de TODOS los contratos ACTIVO de TODAS las
 * inmobiliarias. Es la versión global (no tenant-scopeada) que dispara el cron:
 * el endpoint POST /liquidaciones/devengar solo cubre el tenant del usuario, y
 * sin un disparo periódico global cada contrato se queda sin liquidaciones a
 * partir del 2º mes. IDEMPOTENTE (skipDuplicates) → seguro de repetir y seguro
 * aunque corran dos réplicas a la vez. Además marca vencidas (top-up + mora).
 */
export async function devengarTodosLosTenants(
  prisma: PrismaClient,
): Promise<{ contratosProcesados: number; liquidacionesNuevas: number; liquidacionesVencidas: number }> {
  const contratos = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO' },
    select: {
      id: true,
      inmobiliariaId: true,
      monto: true,
      montoExpensas: true,
      moneda: true,
      fechaInicio: true,
      fechaFin: true,
      diaPago: true,
    },
  });
  let liquidacionesNuevas = 0;
  for (const c of contratos) {
    liquidacionesNuevas += await generarLiquidacionesContrato(prisma, c);
  }
  // Tras devengar, marcamos vencidas las que ya pasaron su vencimiento.
  const liquidacionesVencidas = await marcarLiquidacionesVencidas(prisma);
  return { contratosProcesados: contratos.length, liquidacionesNuevas, liquidacionesVencidas };
}
