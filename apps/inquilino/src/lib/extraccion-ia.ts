'use client';

/**
 * Lectura por IA del comprobante de transferencia.
 *
 * En producción esto va a ser una llamada al backend que combina OCR
 * (Textract / Google Vision) + LLM (Claude) para extraer los campos
 * relevantes del recibo: monto, fecha, número de operación, CBU origen,
 * banco, titular, CUIT.
 *
 * En la demo lo simulamos client-side de manera DETERMINÍSTICA: a partir
 * de un "seed" (nombre del archivo + tamaño, o el id del pago en el lado
 * inmo) generamos los mismos campos siempre. Esto hace que la UI sea
 * predecible y se sienta "real" sin necesidad de un backend.
 *
 * El resultado incluye flags de match contra los valores esperados (monto
 * y fecha de vencimiento) para que la UI muestre badges verde/rojo y
 * habilite "Conciliar automático" cuando todo cierra.
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
  /** Marca de versión por si en el futuro extendemos el shape. */
  v: 1;
  /** Monto detectado en el comprobante (en la misma moneda que la liquidación). */
  monto: number;
  /** ISO string. Fecha de la transferencia detectada. */
  fechaTransferencia: string;
  /** Número de operación / referencia del banco. */
  nroOperacion: string;
  /** CBU del origen (22 dígitos). */
  cbuOrigen: string;
  /** Banco que emitió el comprobante. */
  bancoOrigen: BancoOrigen;
  /** Nombre del titular de la cuenta origen. */
  titularOrigen: string;
  /** CUIT/CUIL del titular origen. */
  cuitOrigen: string;
  /** Confianza global del modelo (depende del file y del match). */
  confianza: Confianza;
  /** Si el monto detectado matchea el esperado (±$50 de tolerancia). */
  matchMonto: boolean;
  /** Si la fecha de transferencia está dentro de los últimos 7 días. */
  matchFecha: boolean;
  /** Cuándo se hizo la extracción (ISO). */
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

/**
 * Hash determinístico de un string a un número 32-bit. No es críptico —
 * sólo lo usamos para que la extracción sea reproducible (mismo seed →
 * mismo output).
 */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG determinístico (mulberry32). */
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
 * Extrae los campos del comprobante. El `seed` puede ser:
 * - file.name + file.size (lado inquilino, al subir)
 * - el id del pago informado (lado inmo, para mostrar la extracción de
 *   las entradas mock sin un archivo real)
 *
 * `montoEsperado` se usa para que el monto detectado tenga sentido —
 * en 90% de los casos coincide exacto, en el resto se desvía un poco
 * para emular un OCR no perfecto.
 *
 * `fechaEsperada` (opcional) sirve para que la fecha caiga cerca del
 * vencimiento. Por defecto la extracción cae en los últimos 3 días.
 */
export function extraerComprobante(
  seed: string,
  montoEsperado: number,
  opts: { fechaEsperada?: string; forzarMatch?: boolean; titularEsperado?: string } = {},
): ExtraccionIA {
  const r = rng(hash32(seed));

  // 85% de los casos el monto matchea perfecto. En el resto, error
  // chico (entre $1 y $200) que dispara badge amarillo del lado inmo.
  const matchMonto = opts.forzarMatch || r() < 0.85;
  const monto = matchMonto
    ? montoEsperado
    : Math.max(0, montoEsperado + (r() < 0.5 ? -1 : 1) * Math.floor(r() * 200 + 1));

  // Fecha de transferencia: por defecto en los últimos 0-3 días desde
  // ahora; si nos pasan fechaEsperada usamos un rango cercano a ella.
  const baseFecha = opts.fechaEsperada
    ? new Date(opts.fechaEsperada).getTime()
    : Date.now();
  const offsetDias = Math.floor(r() * 3); // 0..2
  const fechaTransferencia = new Date(
    baseFecha - offsetDias * 86400000,
  ).toISOString();
  // Match de fecha = dentro de los últimos 7 días respecto a hoy.
  const ahora = Date.now();
  const matchFecha = ahora - new Date(fechaTransferencia).getTime() <= 7 * 86400000;

  // Confianza global: si matchea todo, alta. Si falla monto, media. Si
  // falla fecha, media. Si fallan los dos, baja.
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
    // BUG-03 (walkthrough Jorge): cuando es el propio inquilino subiendo SU
    // comprobante, el titular tiene que ser ÉL — no un nombre random de la
    // lista. Mostrarle "Florencia Russo" en su propio recibo lo hace pensar
    // que pagó a la cuenta equivocada y rompe toda la confianza recién ganada.
    // Si nos pasan titularEsperado (lado inquilino, sabemos quién paga) lo
    // usamos; del lado inmo (sin contexto) cae al random de siempre.
    titularOrigen: opts.titularEsperado ?? pick(NOMBRES, r),
    cuitOrigen: generarCuit(r),
    confianza,
    matchMonto,
    matchFecha,
    extraidoAt: new Date().toISOString(),
  };
}
