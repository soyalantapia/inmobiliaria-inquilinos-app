'use client';

/**
 * Lectura por IA del comprobante de transferencia (lado inmo).
 *
 * Espejo de `apps/inquilino/src/lib/extraccion-ia.ts`. La extracción es
 * determinística: dado un seed (file name + size en el lado inquilino,
 * o pago.id en el lado inmo) devuelve siempre los mismos campos.
 *
 * En la inmo lo usamos para:
 * - Mostrar la grilla "Detectado por IA" en la card de pagos por validar.
 * - Habilitar "Conciliar automático ✨" cuando todos los matches dan OK
 *   y la confianza es alta.
 * - Como fallback, sintetizar la extracción para las entradas mock
 *   (pagosInformadosMock) que en la demo no nacen de un archivo real.
 *
 * Cuando exista backend, este módulo desaparece y se reemplaza por una
 * llamada a la API que pide la extracción persistida del pago.
 */

export type BancoOrigen =
  | 'Banco Galicia'
  | 'Banco Santander'
  | 'BBVA'
  | 'Banco Macro'
  | 'ICBC'
  | 'Banco Nación'
  | 'Banco Provincia'
  | 'Banco Ciudad'
  | 'Mercado Pago'
  | 'Brubank'
  | 'Ualá';

export type Confianza = 'alta' | 'media' | 'baja';

export interface ExtraccionIA {
  v: 1;
  monto: number;
  fechaTransferencia: string;
  nroOperacion: string;
  cbuOrigen: string;
  bancoOrigen: BancoOrigen;
  titularOrigen: string;
  cuitOrigen: string;
  confianza: Confianza;
  matchMonto: boolean;
  matchFecha: boolean;
  extraidoAt: string;
}

const BANCOS: BancoOrigen[] = [
  'Banco Galicia',
  'Banco Santander',
  'BBVA',
  'Banco Macro',
  'ICBC',
  'Banco Nación',
  'Banco Provincia',
  'Banco Ciudad',
  'Mercado Pago',
  'Brubank',
  'Ualá',
];

const NOMBRES = [
  'Mariela Sosa',
  'Juan Pérez',
  'Ana Pereyra',
  'Lautaro Méndez',
  'Florencia Russo',
  'Tomás García',
  'Sofía López',
  'Federico Bravo',
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

function generarCuit(r: () => number): string {
  const prefijo = pick(['20', '23', '27', '30'], r);
  const cuerpo = String(Math.floor(r() * 1e8)).padStart(8, '0');
  const dv = Math.floor(r() * 10);
  return `${prefijo}-${cuerpo}-${dv}`;
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
 * Versión del lado inmo: además del seed y monto esperado, acepta
 * `nombreInquilinoHint` para que el titularOrigen pueda coincidir con
 * el inquilino y el match visual sea más impactante en la demo (90%
 * de las veces el origen coincide con el inquilino que paga).
 */
export function extraerComprobante(
  seed: string,
  montoEsperado: number,
  opts: {
    fechaEsperada?: string;
    forzarMatch?: boolean;
    nombreInquilinoHint?: string;
  } = {},
): ExtraccionIA {
  const r = rng(hash32(seed));

  const matchMonto = opts.forzarMatch || r() < 0.85;
  const monto = matchMonto
    ? montoEsperado
    : Math.max(0, montoEsperado + (r() < 0.5 ? -1 : 1) * Math.floor(r() * 200 + 1));

  const baseFecha = opts.fechaEsperada
    ? new Date(opts.fechaEsperada).getTime()
    : Date.now();
  const offsetDias = Math.floor(r() * 3);
  const fechaTransferencia = new Date(
    baseFecha - offsetDias * 86400000,
  ).toISOString();
  const ahora = Date.now();
  const matchFecha = ahora - new Date(fechaTransferencia).getTime() <= 7 * 86400000;

  // 90% de los casos: el origen detectado es el inquilino que paga.
  // El otro 10%: alguien más (un familiar, garante) — útil para
  // disparar un warning del lado inmo.
  const titularOrigen =
    opts.nombreInquilinoHint && r() < 0.9
      ? opts.nombreInquilinoHint
      : pick(NOMBRES, r);

  let confianza: Confianza = 'alta';
  if (!matchMonto && !matchFecha) confianza = 'baja';
  else if (!matchMonto || !matchFecha) confianza = 'media';

  return {
    v: 1,
    monto,
    fechaTransferencia,
    nroOperacion: generarNroOperacion(r),
    cbuOrigen: generarCbu(r),
    bancoOrigen: pick(BANCOS, r),
    titularOrigen,
    cuitOrigen: generarCuit(r),
    confianza,
    matchMonto,
    matchFecha,
    extraidoAt: new Date().toISOString(),
  };
}

/**
 * True cuando el match es perfecto y la confianza es alta: en ese caso
 * el admin puede usar "Conciliar automático" en un click.
 */
export function puedeConciliarAutomatico(ex: ExtraccionIA): boolean {
  return ex.confianza === 'alta' && ex.matchMonto && ex.matchFecha;
}
