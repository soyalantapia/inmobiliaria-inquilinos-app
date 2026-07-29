import type { Prisma } from '@prisma/client';
import { conSaldo } from './saldos.js';
import { calcularMora, resolverEsquemaMora } from './punitorios.js';

const r2c = (n: number) => Math.round(n * 100) / 100;

/** Igual criterio que el preview de la baja (core.ts): una cuota es EXIGIBLE si ya está
 *  VENCIDO o si sigue impaga y su vencimiento pasó. Una cuota FUTURA no se toca. */
function esExigible(l: { estado: string; fechaVencimiento: Date | string }, now: Date): boolean {
  if (l.estado === 'VENCIDO') return true;
  if (l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') return new Date(l.fechaVencimiento) < now;
  return false;
}

export interface ResultadoAplicacion {
  /** Cuánto del depósito se usó efectivamente para cancelar deuda. */
  aplicado: number;
  /** Lo que sobró tras cubrir toda la deuda exigible (se le devuelve al inquilino). */
  sobrante: number;
  /** Cuántas cuotas quedaron saldadas del todo. */
  cuotasSaldadas: number;
}

/**
 * Aplica el depósito retenido CONTRA LA DEUDA del contrato, de verdad.
 *
 * EL BUG QUE ARREGLA: al rescindir (o al resolver el depósito con NETEAR/EJECUTAR) el
 * sistema marcaba el depósito como NETEADO/EJECUTADO, cobraba la penalidad… y **no tocaba
 * una sola liquidación**. No se creaba ningún Pago. La garantía se consumía y la deuda
 * quedaba intacta, sumando punitorios, más la penalidad nueva. Y el panel mostraba "Saldo a
 * cobrar al inquilino" con el depósito ya restado: un neto que el backend nunca ejecutaba.
 *
 * Criterio (el MISMO que el preview de la baja, a propósito — si divergen, el diálogo vuelve
 * a prometer un número que no se cumple):
 *  · Sólo cuotas EXIGIBLES (vencidas o impagas ya vencidas). Una futura no se cancela con
 *    el depósito: el ex-inquilino no ocupó ese mes.
 *  · El saldo de cada cuota se calcula CON punitorios (calcularMora + conSaldo), no sobre el
 *    montoTotal pelado. Si no, la cuota quedaba PAGADO cubriendo sólo la base y la mora
 *    desaparecía de los libros.
 *  · De la más vieja a la más nueva (la que más mora acumula primero).
 *  · Cada imputación deja un Pago CONCILIADO trazable, con `condonado: false` — es plata
 *    real que entró (la garantía), así que cuenta para el saldo del inquilino. El método
 *    queda como TRANSFERENCIA porque el depósito entró así en su momento.
 */
export async function aplicarDepositoADeuda(
  tx: Prisma.TransactionClient,
  args: {
    contratoId: string;
    inmobiliariaId: string;
    /** Monto del depósito disponible para imputar (ya neto de deducciones por reparaciones). */
    disponible: number;
    usuarioId?: string | null;
    now?: Date;
  },
): Promise<ResultadoAplicacion> {
  const now = args.now ?? new Date();
  if (args.disponible <= 0) return { aplicado: 0, sobrante: 0, cuotasSaldadas: 0 };

  const contrato = await tx.contrato.findFirst({
    where: { id: args.contratoId, inmobiliariaId: args.inmobiliariaId },
    select: {
      moneda: true,
      moraTipo: true,
      moraValor: true,
      tasaPunitorioDiaria: true,
      inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true } },
    },
  });
  if (!contrato) return { aplicado: 0, sobrante: args.disponible, cuotasSaldadas: 0 };

  const liqs = await tx.liquidacion.findMany({
    where: {
      contratoId: args.contratoId,
      inmobiliariaId: args.inmobiliariaId,
      estado: { in: ['PENDIENTE', 'VENCIDO', 'PARCIAL'] },
    },
    orderBy: { fechaVencimiento: 'asc' },
  });
  // El groupBy va por `tx`, NO por el cliente global: dentro de una transacción interactiva
  // una query por otra conexión suma latencia (y con connection_limit chico puede trabar el
  // pool). Con el proxy de por medio eso hacía expirar la transacción → 500.
  const filas = await tx.pago.groupBy({
    by: ['liquidacionId'],
    where: { liquidacionId: { in: liqs.map((l) => l.id) }, estado: 'CONCILIADO' },
    _sum: { monto: true },
  });
  const pagadoMap = new Map(filas.map((f) => [f.liquidacionId, Number(f._sum.monto ?? 0)]));
  const esquema = resolverEsquemaMora(contrato, contrato.inmobiliaria);

  let restante = args.disponible;
  let aplicado = 0;
  let cuotasSaldadas = 0;

  for (const l of liqs) {
    if (restante <= 0) break;
    if (!esExigible(l, now)) continue;
    const punit = calcularMora(
      Number(l.montoTotal),
      esquema,
      l.fechaVencimiento,
      now,
      l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
    );
    const { saldo } = conSaldo(l, pagadoMap, punit);
    if (saldo <= 0) continue;

    const imputa = r2c(Math.min(saldo, restante));
    if (imputa <= 0) continue;

    await tx.pago.create({
      data: {
        inmobiliariaId: args.inmobiliariaId,
        contratoId: args.contratoId,
        liquidacionId: l.id,
        periodo: l.periodo,
        monto: imputa,
        montoLiqTotal: r2c(Number(l.montoTotal) + punit),
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: now,
        estado: 'CONCILIADO',
        // NO es una condonación: es plata real del inquilino (su garantía) que se usa
        // para cancelar la deuda. Marcarla condonada la sacaría del saldo y de la caja.
        condonado: false,
        decididoPorId: args.usuarioId ?? null,
        decididoAt: now,
        observacion: 'Aplicación del depósito en garantía a la deuda',
      },
    });

    const cubierta = imputa >= r2c(saldo) - 0.01;
    await tx.liquidacion.updateMany({
      where: { id: l.id, inmobiliariaId: args.inmobiliariaId, estado: { not: 'PAGADO' } },
      data: cubierta
        ? { estado: 'PAGADO', fechaPago: now, metodoPago: 'TRANSFERENCIA' }
        : { estado: 'PARCIAL' },
    });
    if (cubierta) cuotasSaldadas++;
    restante = r2c(restante - imputa);
    aplicado = r2c(aplicado + imputa);
  }

  return { aplicado, sobrante: r2c(restante), cuotasSaldadas };
}
