/**
 * Matching determinístico (SIN IA) de un crédito detectado en un extracto
 * bancario contra pagos informados / liquidaciones pendientes de la cartera.
 * Portado 1:1 de la lógica del demo (resumen-cuenta.ts), adaptado a datos
 * reales: en vez de "contrato.monto" usamos el SALDO real de la liquidación
 * (lib/saldos.ts) — la mora ya incluida, no el monto base nominal.
 */

export type ConfianzaMatch = 'ALTA' | 'MEDIA' | 'BAJA' | 'SIN_MATCH';

export interface CandidatoPago {
  pagoId: string;
  contratoId: string;
  liquidacionId: string;
  monto: number;
  inquilino: string;
}

export interface CandidatoLiquidacion {
  liquidacionId: string;
  contratoId: string;
  saldo: number;
  inquilino: string;
}

export interface CreditoParaMatch {
  monto: number;
  titularOrigen: string;
}

export interface MatchSugerido {
  confianza: ConfianzaMatch;
  motivo: string;
  pagoId: string | null;
  contratoId: string | null;
  liquidacionId: string | null;
  inquilino: string | null;
}

export function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True si alguna palabra (≥4 letras) del inquilino aparece en el remitente. */
export function coincideAlgunNombre(inquilino: string, remitente: string): boolean {
  const partesInq = normalizarNombre(inquilino)
    .split(' ')
    .filter((p) => p.length >= 4);
  const remN = normalizarNombre(remitente);
  return partesInq.some((p) => remN.includes(p));
}

export function sugerirMatch(
  credito: CreditoParaMatch,
  pagosInformados: CandidatoPago[],
  liquidacionesPendientes: CandidatoLiquidacion[],
): MatchSugerido {
  // 1. Monto exacto (±$50) + nombre coincide con un pago YA informado por el inquilino.
  const pagoExacto = pagosInformados.find(
    (p) => Math.abs(p.monto - credito.monto) <= 50 && normalizarNombre(p.inquilino) === normalizarNombre(credito.titularOrigen),
  );
  if (pagoExacto) {
    return {
      confianza: 'ALTA',
      motivo: 'Monto y titular coinciden con un pago informado',
      pagoId: pagoExacto.pagoId,
      contratoId: pagoExacto.contratoId,
      liquidacionId: pagoExacto.liquidacionId,
      inquilino: pagoExacto.inquilino,
    };
  }
  // 1.b Monto exacto, remitente distinto (pago de garante/familiar).
  const pagoMonto = pagosInformados.find((p) => Math.abs(p.monto - credito.monto) <= 50);
  if (pagoMonto) {
    return {
      confianza: 'MEDIA',
      motivo: 'Monto coincide pero el remitente es distinto al inquilino',
      pagoId: pagoMonto.pagoId,
      contratoId: pagoMonto.contratoId,
      liquidacionId: pagoMonto.liquidacionId,
      inquilino: pagoMonto.inquilino,
    };
  }
  // 2. Monto cercano (±5%) al saldo pendiente de una liquidación + nombre coincide.
  const liqConNombre = liquidacionesPendientes.find(
    (l) => l.saldo > 0 && Math.abs(l.saldo - credito.monto) / Math.max(l.saldo, 1) < 0.05 && coincideAlgunNombre(l.inquilino, credito.titularOrigen),
  );
  if (liqConNombre) {
    return {
      confianza: 'MEDIA',
      motivo: 'Monto cercano al saldo pendiente y nombre similar al titular',
      pagoId: null,
      contratoId: liqConNombre.contratoId,
      liquidacionId: liqConNombre.liquidacionId,
      inquilino: liqConNombre.inquilino,
    };
  }
  // 3. Monto cercano (±5%), sin verificar nombre — confianza baja.
  const liqSoloMonto = liquidacionesPendientes.find((l) => l.saldo > 0 && Math.abs(l.saldo - credito.monto) / Math.max(l.saldo, 1) < 0.05);
  if (liqSoloMonto) {
    return {
      confianza: 'BAJA',
      motivo: 'Sólo coincide el monto. Verificá manualmente.',
      pagoId: null,
      contratoId: liqSoloMonto.contratoId,
      liquidacionId: liqSoloMonto.liquidacionId,
      inquilino: liqSoloMonto.inquilino,
    };
  }
  return { confianza: 'SIN_MATCH', motivo: 'Sin match en la cartera', pagoId: null, contratoId: null, liquidacionId: null, inquilino: null };
}

/* ============================================================
 * Parseo de filas del extracto (CSV/Excel), por sinónimos de columna.
 * Determinístico: sin IA, sin inferencia — si no encuentra la columna
 * esperada, la fila se descarta y se reporta.
 * ============================================================ */

const SINONIMOS: Record<string, string[]> = {
  fecha: ['fecha', 'date', 'fecha valor', 'fecha de acreditacion'],
  concepto: ['concepto', 'detalle', 'descripcion', 'descripción', 'leyenda', 'referencia descriptiva'],
  monto: ['monto', 'importe', 'credito', 'crédito', 'importe credito', 'haber'],
  titular: ['titular', 'remitente', 'ordenante', 'titular origen', 'nombre'],
  cbu: ['cbu', 'cbu origen', 'cuenta origen', 'cuenta'],
  nroOperacion: ['nro operacion', 'número de operación', 'numero operacion', 'nro. operacion', 'referencia', 'comprobante'],
  banco: ['banco', 'banco origen', 'entidad'],
};

function normalizarHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Mapea los headers detectados a nuestros campos, por sinónimo exacto (normalizado). */
export function mapearColumnas(headers: string[]): Partial<Record<keyof typeof SINONIMOS, number>> {
  const norm = headers.map(normalizarHeader);
  const map: Partial<Record<keyof typeof SINONIMOS, number>> = {};
  for (const campo of Object.keys(SINONIMOS) as (keyof typeof SINONIMOS)[]) {
    const idx = norm.findIndex((h) => SINONIMOS[campo]!.includes(h));
    if (idx >= 0) map[campo] = idx;
  }
  return map;
}

export interface FilaCredito {
  fecha: Date;
  concepto: string;
  monto: number;
  titularOrigen: string;
  cbuOrigen: string | null;
  nroOperacion: string;
  bancoOrigen: string;
}

export interface ParseoResumen {
  creditos: FilaCredito[];
  filasIgnoradas: number;
  columnasFaltantes: string[];
}

/** Parsea filas ya tabuladas (array de arrays) — la 1ra fila son headers. */
export function parsearFilasResumen(filas: unknown[][]): ParseoResumen {
  if (filas.length === 0) return { creditos: [], filasIgnoradas: 0, columnasFaltantes: ['fecha', 'monto'] };
  const headers = (filas[0] ?? []).map((h) => String(h ?? ''));
  const col = mapearColumnas(headers);
  const faltantes = (['fecha', 'monto'] as const).filter((c) => col[c] === undefined);
  if (faltantes.length > 0) return { creditos: [], filasIgnoradas: filas.length - 1, columnasFaltantes: faltantes };

  const creditos: FilaCredito[] = [];
  let ignoradas = 0;
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i] ?? [];
    const montoRaw = col.monto !== undefined ? fila[col.monto] : undefined;
    const monto = Number(String(montoRaw ?? '').replace(/[^\d.-]/g, ''));
    const fechaRaw = col.fecha !== undefined ? fila[col.fecha] : undefined;
    const fecha = parsearFecha(fechaRaw);
    // Solo créditos (monto positivo): un extracto trae débitos y créditos
    // mezclados, y acá solo nos interesa lo que ENTRÓ (pago de alquiler).
    if (!fecha || !Number.isFinite(monto) || monto <= 0) {
      ignoradas++;
      continue;
    }
    creditos.push({
      fecha,
      concepto: col.concepto !== undefined ? String(fila[col.concepto] ?? '') : '',
      monto,
      titularOrigen: col.titular !== undefined ? String(fila[col.titular] ?? '') : '',
      cbuOrigen: col.cbu !== undefined ? String(fila[col.cbu] ?? '') || null : null,
      nroOperacion: col.nroOperacion !== undefined ? String(fila[col.nroOperacion] ?? '') : String(i),
      bancoOrigen: col.banco !== undefined ? String(fila[col.banco] ?? '') : '',
    });
  }
  return { creditos, filasIgnoradas: ignoradas, columnasFaltantes: [] };
}

function parsearFecha(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Serial de fecha de Excel (días desde 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  // dd/mm/yyyy (formato AR habitual en exports de banco)
  const ar = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (ar) {
    const [, d, m, y] = ar.map(Number) as unknown as [never, number, number, number];
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
