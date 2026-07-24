import type { Prisma, PrismaClient } from '@prisma/client';
import { enumerarPeriodosContrato } from '@llave/shared/periodos';

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
  /**
   * Mes desde el que ESTE contrato devenga, si difiere de `fechaInicio` (cartera
   * importada). null/undefined = devengar desde `fechaInicio`.
   */
  devengarDesde?: Date | null;
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

  // La ENUMERACIÓN de períodos (arranque = max(devengarDesde, fechaInicio), skip
  // del primer mes cuando vence antes del inicio, tope al mes que viene / fin del
  // contrato) es la FUENTE ÚNICA compartida con el front (@llave/shared): el
  // wizard de alta usa la MISMA función para ofrecer los "períodos anteriores",
  // así nunca manda un período que este devengo no haya generado (era el bug i36:
  // período huérfano → 400 en aplicarEstadoInicial → rollback del alta entera).
  // Acá sólo le agregamos los montos/estado propios de la liquidación.
  return enumerarPeriodosContrato(contrato, now).map((p) => ({
    inmobiliariaId: contrato.inmobiliariaId,
    contratoId: contrato.id,
    periodo: p.periodo,
    montoAlquiler: alquiler,
    montoExpensas: expensas,
    montoTotal: total,
    fechaVencimiento: p.vencimiento,
    estado: p.vencido ? 'VENCIDO' : 'PENDIENTE',
    moneda: contrato.moneda,
  }));
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
      // Sin esto el cron devengaba desde fechaInicio e ignoraba la decisión de la
      // importación de cartera → resucitaba los meses históricos como deuda falsa.
      devengarDesde: true,
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

/**
 * Suma `meses` a una fecha en UTC, con clamp de fin de mes ("month-end aware"):
 * 31/01 + 1 mes = 28/02 (no 03/03, como haría el rollover nativo de Date). Se
 * usa para calcular `proximoAjuste` (fechaInicio/último ajuste + frecuencia) sin
 * desbordes de días largos. Trabaja SOLO en UTC (evita el corrimiento por huso
 * que daría usar los getters/setters locales del server).
 */
export function sumarMesesUTC(fecha: Date, meses: number): Date {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  const d = fecha.getUTCDate();
  const totalMes = m + meses;
  const targetY = y + Math.floor(totalMes / 12);
  // ((totalMes % 12) + 12) % 12 => índice de mes 0-11 aunque `meses` fuera negativo.
  const targetM = ((totalMes % 12) + 12) % 12;
  // Días del mes destino: si el día original no existe (31 en un mes de 30),
  // clampeamos al último día del mes destino.
  const diasMesDestino = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const targetD = Math.min(d, diasMesDestino);
  return new Date(
    Date.UTC(
      targetY,
      targetM,
      targetD,
      fecha.getUTCHours(),
      fecha.getUTCMinutes(),
      fecha.getUTCSeconds(),
      fecha.getUTCMilliseconds(),
    ),
  );
}

/**
 * Alquiler que corresponde según el tipo de contrato: en SOLO_EXPENSAS el
 * alquiler es SIEMPRE 0 (solo se cobran expensas), en el resto es el `monto`
 * base del contrato. Aísla la regla para que el ajuste manual (PATCH monto) y el
 * devengo compartan el mismo criterio y no dupliquen el `if`.
 */
export function montoAlquilerSegunTipo(
  tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS',
  monto: number,
): number {
  return tipoContrato === 'SOLO_EXPENSAS' ? 0 : monto;
}

/** Período 'YYYY-MM' (UTC) de una fecha. El corte de "liquidación futura" del
 *  ajuste manual usa el período (mes calendario), no la fecha exacta. */
export function periodoDe(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Liquidación tal como la necesita el recompute del ajuste manual. */
export type LiquidacionParaReajustar = {
  id: string;
  periodo: string;
  estado: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
  montoExpensas: Prisma.Decimal | number | null;
  /** Cantidad de pagos (de cualquier estado) asociados a la liquidación. */
  cantidadPagos: number;
};

/**
 * Filtra (PURO, sin DB) qué liquidaciones deben RE-DEVENGARSE al aplicar un
 * ajuste manual de monto, y devuelve el nuevo montoAlquiler/montoTotal de cada
 * una. Criterio (money code — conservador a propósito):
 *
 *  - período >= mes actual (`periodoActual`): NO tocamos meses pasados (histórico
 *    cerrado; el inquilino ya vio/pagó ese valor).
 *  - estado PENDIENTE o VENCIDO: NO tocamos PAGADO ni PARCIAL (ya hay plata en
 *    juego contra el monto viejo).
 *  - SIN ningún pago (cantidadPagos === 0): defensa extra — aunque una liq siga
 *    PENDIENTE/VENCIDO, si tiene un pago INFORMADO en revisión no la reajustamos
 *    (el inquilino informó contra el total que vio).
 *
 * El montoAlquiler nuevo respeta el tipo de contrato (SOLO_EXPENSAS => 0) y el
 * total = alquiler + expensas de LA liquidación (no del contrato: una liq pudo
 * tener expensas distintas). Devuelve solo las que cambian.
 */
export function recomputarLiquidacionesFuturas(
  liquidaciones: LiquidacionParaReajustar[],
  params: {
    montoNuevo: number;
    tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS';
    periodoActual: string;
  },
): Array<{ id: string; montoAlquiler: number; montoTotal: number }> {
  const alquilerNuevo = montoAlquilerSegunTipo(params.tipoContrato, params.montoNuevo);
  const out: Array<{ id: string; montoAlquiler: number; montoTotal: number }> = [];
  for (const l of liquidaciones) {
    // Comparación lexicográfica de 'YYYY-MM': correcta porque ambos tienen el
    // mismo formato ancho-fijo (2026-07 >= 2026-07 incluye el mes en curso).
    if (l.periodo < params.periodoActual) continue;
    if (l.estado !== 'PENDIENTE' && l.estado !== 'VENCIDO') continue;
    if (l.cantidadPagos > 0) continue;
    const expensas = l.montoExpensas != null ? Number(l.montoExpensas) : 0;
    out.push({ id: l.id, montoAlquiler: alquilerNuevo, montoTotal: alquilerNuevo + expensas });
  }
  return out;
}
