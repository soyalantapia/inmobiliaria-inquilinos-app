import type { TipoMora } from '@prisma/client';

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
 * para una ya PAGADA (la mora se congela cuando se saldó).
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
  const ref = new Date(asOf);
  ref.setUTCHours(0, 0, 0, 0);
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
