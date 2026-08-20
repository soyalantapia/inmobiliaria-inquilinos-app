import type { TipoMora } from '@prisma/client';
import { diaCivilAR } from '@llave/shared';

/**
 * Mora (punitorio por pago tardío) DINÁMICA, calculada ON-READ (no se congela
 * en la DB: crece cada día hasta que se paga, salvo override manual).
 *
 * Esquemas (`TipoMora`):
 *  - PORCENTAJE_DIARIO: base × (valor%/100) × díasAtraso        (lineal, modelo original)
 *  - MONTO_FIJO:        valor × meses de atraso INICIADOS       (estilo consorcio: $5k el
 *                       1er mes, $10k el 2do… acumula solo porque cada liquidación vieja
 *                       lleva más meses vencida; en la moneda del contrato)
 *  - PORCENTAJE_MENSUAL: base × (valor%/100) × (días/30)        (tasa mensual prorrateada
 *                       por día, p.ej. la de Banco Nación cargada a mano)
 *  - SIN_MORA:          0
 *
 * `asOf`: hoy para una liquidación impaga (sigue corriendo); la fecha de pago
 * para una ya PAGADA (la mora se congela cuando se saldó). Para elegirlo cuando
 * hay un pago de por medio, usar `asOfMora` (abajo).
 */
export interface EsquemaMora {
  tipo: TipoMora;
  /** % diario, $ fijo por mes de atraso, o % mensual — según `tipo`. */
  valor: number | null;
}

/** Campos de mora que puede traer un contrato (nuevos + legacy). */
export interface ContratoConMora {
  moraTipo?: TipoMora | null;
  moraValor?: number | null;
  tasaPunitorioDiaria?: number | null;
}

export interface DefaultsMora {
  moraTipoDefault?: TipoMora | null;
  moraValorDefault?: number | null;
}

export type OrigenMora = 'CONTRATO' | 'LEGACY' | 'INMOBILIARIA' | 'SIN_MORA';

/**
 * Resuelve el esquema de mora efectivo de un contrato con la cascada:
 *
 *   contrato.moraTipo (override explícito)
 *     → legacy contrato.tasaPunitorioDiaria (compat: % diario; la migración ya
 *       backfilleó moraTipo, esto cubre datos que entren por caminos viejos)
 *       → default de la inmobiliaria (config de Cobranza)
 *         → SIN_MORA
 *
 * Devuelve también el `origen` para que el panel pueda mostrar "(heredada)".
 */
export function resolverEsquemaMora(
  contrato: ContratoConMora | null | undefined,
  defaults?: DefaultsMora | null,
): EsquemaMora & { origen: OrigenMora } {
  if (contrato?.moraTipo) {
    return { tipo: contrato.moraTipo, valor: contrato.moraValor ?? null, origen: 'CONTRATO' };
  }
  const tasaLegacy = contrato?.tasaPunitorioDiaria;
  if (tasaLegacy != null && Number(tasaLegacy) > 0) {
    return { tipo: 'PORCENTAJE_DIARIO', valor: Number(tasaLegacy), origen: 'LEGACY' };
  }
  if (defaults?.moraTipoDefault && defaults.moraTipoDefault !== 'SIN_MORA') {
    return {
      tipo: defaults.moraTipoDefault,
      valor: defaults.moraValorDefault ?? null,
      origen: 'INMOBILIARIA',
    };
  }
  return { tipo: 'SIN_MORA', valor: null, origen: 'SIN_MORA' };
}

const DIA_MS = 86400000;

function diasAtraso(fechaVencimiento: Date | string, asOf: Date): number {
  const venc = new Date(fechaVencimiento);
  venc.setUTCHours(0, 0, 0, 0);
  // `asOf` es un INSTANTE; el vencimiento es un DÍA CIVIL. Normalizarlo con
  // setUTCHours lo llevaba al día UTC, que desde las 21:00 hora argentina ya es
  // el día siguiente: cobraba un día de mora mientras al inquilino todavía le
  // quedaban tres horas del día de pago. El corte va en hora local.
  const ref = diaCivilAR(asOf);
  return Math.max(0, Math.floor((ref.getTime() - venc.getTime()) / DIA_MS));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Mora de UNA liquidación según el esquema, a la fecha `asOf`.
 *
 * `manual` (Liquidacion.montoPunitorioManual) PISA el cálculo: es la mora
 * histórica confirmada al migrar un contrato en curso — congelada (no sigue
 * creciendo) y editable desde el panel. Un manual de 0 también pisa (permite
 * condonar la mora de un período puntual sin tocar el esquema).
 */
export function calcularMora(
  base: number,
  esquema: EsquemaMora,
  fechaVencimiento: Date | string,
  asOf: Date,
  manual?: number | null,
): number {
  if (manual != null) return r2(Math.max(0, Number(manual)));
  if (base <= 0 || esquema.tipo === 'SIN_MORA' || !esquema.valor || esquema.valor <= 0) return 0;
  const dias = diasAtraso(fechaVencimiento, asOf);
  if (dias === 0) return 0;
  switch (esquema.tipo) {
    case 'PORCENTAJE_DIARIO':
      return r2(base * (esquema.valor / 100) * dias);
    case 'MONTO_FIJO':
      // Meses INICIADOS (día 1-30 de atraso = 1 mes, 31-60 = 2…): así el fijo
      // "acumula" como lo describió el piloto ($5k → $10k → $15k).
      return r2(esquema.valor * Math.ceil(dias / 30));
    case 'PORCENTAJE_MENSUAL':
      return r2(base * (esquema.valor / 100) * (dias / 30));
    default:
      return 0;
  }
}

/**
 * LEGACY: firma original (% diario) — wrapper de calcularMora para los call
 * sites aún no migrados a esquemas. No agregar usos nuevos.
 */
export function calcularPunitorio(
  base: number,
  tasaDiaria: number | null | undefined,
  fechaVencimiento: Date | string,
  asOf: Date,
): number {
  return calcularMora(
    base,
    { tipo: 'PORCENTAJE_DIARIO', valor: tasaDiaria != null ? Number(tasaDiaria) : null },
    fechaVencimiento,
    asOf,
  );
}

/**
 * Con qué instante se corta la mora de una liquidación que tiene un pago asociado.
 *
 * Existe para que la BANDEJA DE VALIDACIÓN y `POST /pagos/:id/validar` no puedan
 * discrepar. El renglón "si lo validás queda $X" es una PREDICCIÓN de lo que va a
 * hacer validar, y validar congela la mora en la `fechaTransferencia` del pago que
 * está validando. Mientras la bandeja calculaba con `hoy`, cada día de demora en
 * decidir inventaba un saldo residual que al validar valía cero.
 *
 * DÓNDE **NO** VA. En `deudaTotal` (core.ts) ni en las métricas de morosidad
 * (metricas.ts). Ahí un INFORMADO no puede congelar nada: la `fechaTransferencia`
 * la carga el inquilino —con backdate de hasta 30 días, ver el guard de
 * /pagos/informar— y todavía nadie verificó que la plata haya entrado. Si el KPI
 * de mora la respetara, cualquiera se borraría de la lista de morosos informando
 * un pago que no existe, y encima quedaría escondido hasta que alguien lo rechace.
 * En la bandeja no aplica: ahí el operador está mirando esa fila para decidirla.
 */
export function asOfMora(
  pago: { estado: string; fechaTransferencia: Date },
  liquidacion: { estado: string; fechaPago: Date | null },
  hoy: Date,
): Date {
  if (pago.estado === 'INFORMADO') return new Date(pago.fechaTransferencia);
  if (liquidacion.estado === 'PAGADO' && liquidacion.fechaPago)
    return new Date(liquidacion.fechaPago);
  return hoy;
}
