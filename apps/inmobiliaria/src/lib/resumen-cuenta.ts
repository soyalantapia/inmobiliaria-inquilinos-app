'use client';

/**
 * Validador por resumen de cuenta.
 *
 * El admin sube el resumen del banco (PDF / imagen). El sistema "lee"
 * todos los créditos del período y para cada uno sugiere a qué
 * inquilino corresponde haciendo match por monto + fecha + nombre del
 * remitente.
 *
 * Constraint duro (Ramiro): NUNCA pedir credenciales bancarias del
 * usuario para entrar en su cuenta. El admin SIEMPRE sube el archivo
 * manualmente. Esto es lo que distingue al "validador" de una
 * integración bancaria directa (que sería más cómoda pero peligrosa).
 *
 * En producción esto va a ser una llamada al backend que usa OCR +
 * LLM (similar al lector de comprobantes) para parsear el resumen.
 * En la demo lo simulamos client-side con un generador determinístico
 * a partir del nombre + tamaño del archivo.
 */

import {
  contratosMock,
  pagosInformadosMock,
  type PagoInformado,
} from './mock-data';

export type ConfianzaMatch = 'alta' | 'media' | 'baja';

export interface CreditoDetectado {
  /** id sintético del crédito en el resumen (linea N). */
  id: string;
  /** Fecha de acreditación en el banco (ISO). */
  fecha: string;
  /** Texto que el banco pone en el extracto. */
  concepto: string;
  /** Monto acreditado (siempre positivo). */
  monto: number;
  /** Nombre del titular de la cuenta origen (lo extraemos del concepto). */
  titularOrigen: string;
  /** CBU de origen (parseado del concepto). */
  cbuOrigen: string | null;
  /** Número de operación / referencia. */
  nroOperacion: string;
  /** Banco emisor (deducido). */
  bancoOrigen: string;
}

export interface MatchSugerido {
  creditoId: string;
  /** ID del pago informado al que matchea (cuando hay uno). */
  pagoInformadoId: string | null;
  /** ID del contrato sugerido (cuando no hay pago informado pero el monto
   *  matchea con la liquidación esperada). */
  contratoId: string | null;
  /** Nombre del inquilino sugerido (para mostrar en la UI). */
  inquilino: string | null;
  confianza: ConfianzaMatch;
  /** Texto explicativo del por qué del match (auditoría). */
  motivo: string;
}

const BANCOS_REMITENTES = [
  'Galicia',
  'Santander',
  'BBVA',
  'Macro',
  'ICBC',
  'Nación',
  'Provincia',
  'Mercado Pago',
];

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

function generarCbu(r: () => number): string {
  let out = '';
  for (let i = 0; i < 22; i++) out += Math.floor(r() * 10);
  return out;
}

function generarNroOperacion(r: () => number): string {
  return String(Math.floor(r() * 1e9)).padStart(9, '0');
}

/**
 * Genera la lista de créditos que aparecen en el resumen. Mezcla:
 * - Cada pago informado pendiente (alta probabilidad de aparecer)
 * - Algunos pagos directos al CBU del titular (sin comprobante previo)
 * - 1-2 movimientos sin match (un sueldo, una devolución de IVA, etc.)
 *
 * El seed se construye con `${nombreArchivo}|${tamañoEnBytes}` para que
 * el mismo upload genere siempre la misma lista.
 */
export function analizarResumen(
  fileName: string,
  fileSize: number,
): CreditoDetectado[] {
  const r = rng(hash32(`${fileName}|${fileSize}`));
  const creditos: CreditoDetectado[] = [];

  // Iteramos los pagos informados pendientes y simulamos que cada uno
  // tiene su crédito correspondiente en el resumen (con el mismo monto).
  // Esto da los matches "alta confianza" — el inmo los va a aprobar en bloque.
  pagosInformadosMock.forEach((p, idx) => {
    const banco = pick(BANCOS_REMITENTES, r);
    // Para el monto: 90% exacto, 10% diferencia chica (caso parcial / error).
    const variarMonto = r() < 0.1;
    const monto = variarMonto
      ? Math.max(0, p.monto + Math.floor((r() - 0.5) * 600))
      : p.monto;
    creditos.push({
      id: `crd_${(idx + 1).toString().padStart(3, '0')}`,
      fecha: new Date(p.fechaTransferencia).toISOString(),
      concepto: `TRANSF DESDE ${p.inquilino.toUpperCase()} · BCO ${banco.toUpperCase()}`,
      monto,
      titularOrigen: p.inquilino,
      cbuOrigen: generarCbu(r),
      nroOperacion: generarNroOperacion(r),
      bancoOrigen: banco,
    });
  });

  // Un crédito "huérfano": pagado directo desde otra cuenta sin avisar.
  // El inmo lo va a tener que matchear manualmente con la liq pendiente
  // de un contrato.
  if (contratosMock.length >= 4) {
    const cnt = contratosMock[3]!;
    creditos.push({
      id: `crd_${(creditos.length + 1).toString().padStart(3, '0')}`,
      fecha: new Date(Date.now() - 2 * 86400000).toISOString(),
      concepto: `TRANSF DESDE FAMILIA ${cnt.inquilino.split(' ').slice(-1)[0]?.toUpperCase()} · BCO ${pick(BANCOS_REMITENTES, r).toUpperCase()}`,
      monto: cnt.monto,
      titularOrigen: `Familia ${cnt.inquilino.split(' ').slice(-1)[0]}`,
      cbuOrigen: generarCbu(r),
      nroOperacion: generarNroOperacion(r),
      bancoOrigen: pick(BANCOS_REMITENTES, r),
    });
  }

  // Un crédito sin match (ej: devolución de IVA, sueldo recibido).
  creditos.push({
    id: `crd_${(creditos.length + 1).toString().padStart(3, '0')}`,
    fecha: new Date(Date.now() - 5 * 86400000).toISOString(),
    concepto: 'ACR. SUELDO INMO DEL SOL SRL',
    monto: 420000,
    titularOrigen: 'Inmobiliaria del Sol SRL',
    cbuOrigen: null,
    nroOperacion: generarNroOperacion(r),
    bancoOrigen: 'Galicia',
  });

  // Ordenamos por fecha desc (lo más reciente primero).
  return creditos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Calcula el match sugerido para un crédito. Estrategia:
 * 1. Buscar pago informado pendiente con monto y nombre que matchee → alta.
 * 2. Si no hay pago informado, buscar contrato con monto del alquiler
 *    parecido (±5%) → media (el inmo lo va a tener que confirmar).
 * 3. Si nada matchea → baja, sin match.
 */
export function matchearCredito(
  credito: CreditoDetectado,
  /**
   * Pagos informados que TODAVÍA no fueron conciliados / rechazados
   * (los que están en estado INFORMADO). Vienen del filtro que hace
   * el caller.
   */
  pagosPendientes: PagoInformado[],
): MatchSugerido {
  // 1. Match por monto exacto + nombre similar en pagos informados.
  const matchPagoExacto = pagosPendientes.find(
    (p) =>
      Math.abs(p.monto - credito.monto) <= 50 &&
      normalizarNombre(p.inquilino) === normalizarNombre(credito.titularOrigen),
  );
  if (matchPagoExacto) {
    return {
      creditoId: credito.id,
      pagoInformadoId: matchPagoExacto.id,
      contratoId: matchPagoExacto.contratoId,
      inquilino: matchPagoExacto.inquilino,
      confianza: 'alta',
      motivo: 'Monto y titular coinciden con un pago informado',
    };
  }

  // 1.b Match por monto exacto, nombre distinto (pago de garante / familia).
  const matchPagoMonto = pagosPendientes.find(
    (p) => Math.abs(p.monto - credito.monto) <= 50,
  );
  if (matchPagoMonto) {
    return {
      creditoId: credito.id,
      pagoInformadoId: matchPagoMonto.id,
      contratoId: matchPagoMonto.contratoId,
      inquilino: matchPagoMonto.inquilino,
      confianza: 'media',
      motivo: 'Monto coincide pero el remitente es distinto al inquilino',
    };
  }

  // 2. Match por monto contra alquiler de algún contrato (sin comprobante).
  const matchContrato = contratosMock.find(
    (c) =>
      Math.abs(c.monto - credito.monto) / Math.max(c.monto, 1) < 0.05 &&
      coincideAlgunNombre(c.inquilino, credito.titularOrigen),
  );
  if (matchContrato) {
    return {
      creditoId: credito.id,
      pagoInformadoId: null,
      contratoId: matchContrato.id,
      inquilino: matchContrato.inquilino,
      confianza: 'media',
      motivo: 'Monto cercano al alquiler del contrato y nombre similar al titular',
    };
  }

  // 3. Match débil: monto cerca de algún alquiler, sin nombre.
  const matchSoloMonto = contratosMock.find(
    (c) => Math.abs(c.monto - credito.monto) / Math.max(c.monto, 1) < 0.05,
  );
  if (matchSoloMonto) {
    return {
      creditoId: credito.id,
      pagoInformadoId: null,
      contratoId: matchSoloMonto.id,
      inquilino: matchSoloMonto.inquilino,
      confianza: 'baja',
      motivo: 'Sólo coincide el monto. Verificá manualmente.',
    };
  }

  return {
    creditoId: credito.id,
    pagoInformadoId: null,
    contratoId: null,
    inquilino: null,
    confianza: 'baja',
    motivo: 'Sin match en la cartera',
  };
}

function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True si algún apellido / palabra del inquilino aparece en el remitente. */
function coincideAlgunNombre(inquilino: string, remitente: string): boolean {
  const partesInq = normalizarNombre(inquilino).split(' ').filter((p) => p.length >= 4);
  const remN = normalizarNombre(remitente);
  return partesInq.some((p) => remN.includes(p));
}

/**
 * Lista de candidatos para el dropdown "Editar match": pagos informados
 * pendientes + algunos contratos con liq pendiente para casos donde el
 * inquilino no subió comprobante.
 */
export interface OpcionMatch {
  label: string;
  pagoInformadoId: string | null;
  contratoId: string | null;
  /** Inquilino + dirección para mostrar en el dropdown. */
  hint: string;
}

export function opcionesDeMatch(
  pagosPendientes: PagoInformado[],
): OpcionMatch[] {
  const opciones: OpcionMatch[] = [];
  for (const p of pagosPendientes) {
    opciones.push({
      label: `${p.inquilino} · ${p.direccion}`,
      pagoInformadoId: p.id,
      contratoId: p.contratoId,
      hint: `Pago informado ${p.id}`,
    });
  }
  for (const c of contratosMock) {
    // Solo agregar si el contrato no tiene ya un pago informado pendiente
    // (para no duplicar).
    if (pagosPendientes.some((p) => p.contratoId === c.id)) continue;
    opciones.push({
      label: `${c.inquilino} · ${c.direccion}`,
      pagoInformadoId: null,
      contratoId: c.id,
      hint: `Sin comprobante todavía`,
    });
  }
  return opciones;
}
