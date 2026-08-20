import type { Prisma } from '@prisma/client';
import { yaVencio } from '@llave/shared';
import { conSaldo } from './saldos.js';
import { calcularMora, resolverEsquemaMora } from './punitorios.js';

const r2c = (n: number) => Math.round(n * 100) / 100;

/** Igual criterio que el preview de la baja (core.ts): una cuota es EXIGIBLE si ya está
 *  VENCIDO o si sigue impaga y su vencimiento pasó. Una cuota FUTURA no se toca. */
function esExigible(l: { estado: string; fechaVencimiento: Date | string }, now: Date): boolean {
  if (l.estado === 'VENCIDO') return true;
  if (l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') return yaVencio(l.fechaVencimiento, now);
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

/** Una cuota candidata, con el saldo YA calculado (con mora) por el caller. */
export interface CuotaParaImputar {
  id: string;
  saldo: number;
  exigible: boolean;
}

export interface Imputacion {
  id: string;
  /** Cuánto del depósito se le imputa a esta cuota. */
  imputa: number;
  /** Si con eso queda saldada del todo (tolerancia de un centavo). */
  cubierta: boolean;
}

export interface PlanImputacion extends ResultadoAplicacion {
  imputaciones: Imputacion[];
}

/**
 * A qué cuotas y por cuánto se imputa el depósito. **Pura**: entra la lista de cuotas con su
 * saldo y lo que hay disponible, sale el plan. El caller hace las escrituras.
 *
 * VIVE SEPARADA PARA PODER TESTEARLA. Acá se decide cuánta deuda del ex-inquilino cancela su
 * garantía y **cuánto se le devuelve**, y hasta ahora esa aritmética sólo se podía ejercitar
 * levantando media base de datos. Un error no se ve como un error: se ve como un número en el
 * cierre de la baja.
 *
 * Las reglas, y por qué cada una:
 *  · **Se respeta el orden que llega** — el caller las trae de la más vieja a la más nueva,
 *    que es la que más mora acumuló.
 *  · **Nunca se imputa más que el saldo de la cuota**: pagar de más una cuota dejaría al
 *    inquilino con crédito en una y deuda viva en la siguiente.
 *  · **Nunca se imputa más que lo disponible**: no se gasta una garantía que no existe.
 *  · **`aplicado + sobrante === disponible`, siempre.** Es la invariante que importa: la
 *    plata del depósito no se puede evaporar ni multiplicar. Lo que no cancela deuda se le
 *    devuelve.
 *  · Las cuotas **no exigibles se saltean** (una futura no se cancela: el ex-inquilino no
 *    ocupó ese mes), y las que ya tienen saldo 0 también.
 */
export function planDeImputacion(cuotas: CuotaParaImputar[], disponible: number): PlanImputacion {
  const imputaciones: Imputacion[] = [];
  let restante = r2c(Math.max(0, disponible));
  let aplicado = 0;
  let cuotasSaldadas = 0;

  for (const c of cuotas) {
    // OJO: este `break` es una OPTIMIZACIÓN, no una garantía. Sin él el resultado es
    // idéntico —con `restante` en 0, `imputa` da 0 y el `continue` de abajo saltea la cuota
    // igual—. Se verificó con mutation testing: sacarlo no pone ningún test en rojo, y eso
    // es correcto, no un agujero de cobertura. Si alguna vez hay que cambiar la aritmética
    // de arriba, no se puede confiar en esta línea para cortar.
    if (restante <= 0) break;
    if (!c.exigible || c.saldo <= 0) continue;

    const imputa = r2c(Math.min(c.saldo, restante));
    if (imputa <= 0) continue;

    // Tolerancia de un centavo, la misma que usan validar y el pago manual: sobre la ÚLTIMA
    // cuota que alcanza a tocar el depósito suele quedar corto, y ahí queda PARCIAL.
    const cubierta = imputa >= c.saldo - 0.01;
    imputaciones.push({ id: c.id, imputa, cubierta });
    if (cubierta) cuotasSaldadas++;
    restante = r2c(restante - imputa);
    aplicado = r2c(aplicado + imputa);
  }

  return { imputaciones, aplicado, sobrante: r2c(restante), cuotasSaldadas };
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

  // El saldo CON punitorios de cada cuota, en el orden en que vienen (más vieja primero).
  // Se calcula acá porque necesita el esquema de mora; la decisión de a cuáles y por cuánto
  // imputar es aritmética y vive en `planDeImputacion`, que sí se puede testear.
  const punitPorLiq = new Map<string, number>();
  const candidatas: CuotaParaImputar[] = liqs.map((l) => {
    const punit = calcularMora(
      Number(l.montoTotal),
      esquema,
      l.fechaVencimiento,
      now,
      l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
    );
    punitPorLiq.set(l.id, punit);
    return { id: l.id, saldo: conSaldo(l, pagadoMap, punit).saldo, exigible: esExigible(l, now) };
  });

  const plan = planDeImputacion(candidatas, args.disponible);
  const porId = new Map(liqs.map((l) => [l.id, l]));

  for (const { id, imputa, cubierta } of plan.imputaciones) {
    const l = porId.get(id)!;
    const punit = punitPorLiq.get(id) ?? 0;
    const saldo = conSaldo(l, pagadoMap, punit).saldo;

    await tx.pago.create({
      data: {
        inmobiliariaId: args.inmobiliariaId,
        contratoId: args.contratoId,
        liquidacionId: l.id,
        periodo: l.periodo,
        monto: imputa,
        // `imputa` es min(saldo, lo que queda del depósito): sobre la ÚLTIMA cuota
        // que alcanza a tocar suele quedar corto, y ahí el pago es PARCIAL. La
        // tolerancia de un centavo es la misma que usan validar/manual.
        tipo: imputa >= saldo - 0.01 ? 'TOTAL' : 'PARCIAL',
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

    await tx.liquidacion.updateMany({
      where: { id: l.id, inmobiliariaId: args.inmobiliariaId, estado: { not: 'PAGADO' } },
      data: cubierta
        ? { estado: 'PAGADO', fechaPago: now, metodoPago: 'TRANSFERENCIA' }
        : { estado: 'PARCIAL' },
    });
  }

  return { aplicado: plan.aplicado, sobrante: plan.sobrante, cuotasSaldadas: plan.cuotasSaldadas };
}
