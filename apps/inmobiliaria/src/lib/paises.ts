/**
 * Catálogo de países soportados + configuración local.
 *
 * Quote de Ramiro en el meeting:
 *   "Largarla en España, largarla en Brasil, largarla en Uruguay,
 *    en Paraguay... el molde nuestro funciona en cualquier lado.
 *    Lo que le va a cambiar es la variable con la que va a ajustar
 *    el contrato, algunas normas en el contrato que cambiarán pero
 *    después el uso va a ser el mismo."
 *
 * Confirma la tesis: la base del producto no cambia, solo varían:
 *  - moneda local
 *  - índice de ajuste del contrato
 *  - ley aplicable / referencia normativa
 *  - formato de identificación fiscal (CUIT / CNPJ / RUT / RUC)
 *  - locale de formateo (miles, decimales)
 *
 * Acá centralizamos toda esa data por país para que cada pantalla
 * tire del bloque correcto.
 */

export type CodigoPais = 'AR' | 'UY' | 'BR' | 'PY';

export type Moneda = 'ARS' | 'UYU' | 'BRL' | 'PYG' | 'USD';

export interface IndiceAjuste {
  codigo: string;
  nombre: string;
  fuente: string;
  /** Periodicidad típica de ajuste (cada cuántos meses). */
  periodicidadMeses: number;
}

export interface NormaContrato {
  /** Identificación de la ley aplicable (ej "Ley 27.737"). */
  leyAplicable: string;
  /** Plazo mínimo legal del contrato de vivienda en meses. */
  plazoMinimoMeses: number;
  /** Depósito en garantía máximo permitido (en cantidad de cánones). */
  depositoMaximoCanones: number;
  /** Multa máxima por rescisión anticipada (en cantidad de cánones). */
  multaRescisionMaximaCanones: number;
}

export interface Pais {
  codigo: CodigoPais;
  nombre: string;
  emoji: string;
  monedaDefault: Moneda;
  /** Locale BCP-47 para formateo. */
  locale: string;
  /** Identificación fiscal de personas jurídicas. */
  identificadorFiscal: string;
  /** Índices de ajuste aceptados. El primero es el más común. */
  indicesAjuste: IndiceAjuste[];
  norma: NormaContrato;
  /** Sigla de la unidad de medida del precio de mercado en la zona. */
  unidadMercado: string;
  /** True si el producto está disponible en este país. */
  activo: boolean;
  /** Trimestre estimado de apertura si todavía no está activo. */
  apertura?: string;
}

export const PAISES: Pais[] = [
  {
    codigo: 'AR',
    nombre: 'Argentina',
    emoji: '🇦🇷',
    monedaDefault: 'ARS',
    locale: 'es-AR',
    identificadorFiscal: 'CUIT',
    indicesAjuste: [
      {
        codigo: 'ICL',
        nombre: 'Índice para Contratos de Locación',
        fuente: 'BCRA',
        periodicidadMeses: 3,
      },
      {
        codigo: 'IPC',
        nombre: 'Índice de Precios al Consumidor',
        fuente: 'INDEC',
        periodicidadMeses: 6,
      },
      {
        codigo: 'CASA_PROPIA',
        nombre: 'Casa Propia (CER + paritarias)',
        fuente: 'INDEC/RIPTE',
        periodicidadMeses: 3,
      },
    ],
    norma: {
      leyAplicable: 'Ley 27.737 / 27.551 + CCyC',
      plazoMinimoMeses: 36,
      depositoMaximoCanones: 1,
      multaRescisionMaximaCanones: 1.5,
    },
    unidadMercado: 'ARS/m²',
    activo: true,
  },
  {
    codigo: 'UY',
    nombre: 'Uruguay',
    emoji: '🇺🇾',
    monedaDefault: 'UYU',
    locale: 'es-UY',
    identificadorFiscal: 'RUT',
    indicesAjuste: [
      {
        codigo: 'UR',
        nombre: 'Unidad Reajustable',
        fuente: 'INE',
        periodicidadMeses: 12,
      },
      {
        codigo: 'IPC_UY',
        nombre: 'Índice de Precios al Consumo',
        fuente: 'INE',
        periodicidadMeses: 6,
      },
      {
        codigo: 'MEDIO_SALARIO_BPS',
        nombre: 'Medio Salario Mínimo (BPS)',
        fuente: 'BPS',
        periodicidadMeses: 12,
      },
    ],
    norma: {
      leyAplicable: 'Ley 14.219 / Decreto-Ley 14.384',
      plazoMinimoMeses: 24,
      depositoMaximoCanones: 5,
      multaRescisionMaximaCanones: 1,
    },
    unidadMercado: 'UYU/m²',
    activo: false,
    apertura: '2026-Q4',
  },
  {
    codigo: 'BR',
    nombre: 'Brasil',
    emoji: '🇧🇷',
    monedaDefault: 'BRL',
    locale: 'pt-BR',
    identificadorFiscal: 'CNPJ',
    indicesAjuste: [
      {
        codigo: 'IGPM',
        nombre: 'Índice Geral de Preços do Mercado',
        fuente: 'FGV',
        periodicidadMeses: 12,
      },
      {
        codigo: 'IPCA',
        nombre: 'Índice de Preços ao Consumidor Amplo',
        fuente: 'IBGE',
        periodicidadMeses: 12,
      },
      {
        codigo: 'INCC',
        nombre: 'Índice Nacional de Custo da Construção',
        fuente: 'FGV',
        periodicidadMeses: 12,
      },
    ],
    norma: {
      leyAplicable: 'Lei do Inquilinato (Lei 8.245/91)',
      plazoMinimoMeses: 30,
      depositoMaximoCanones: 3,
      multaRescisionMaximaCanones: 3,
    },
    unidadMercado: 'BRL/m²',
    activo: false,
    apertura: '2027-Q1',
  },
  {
    codigo: 'PY',
    nombre: 'Paraguay',
    emoji: '🇵🇾',
    monedaDefault: 'PYG',
    locale: 'es-PY',
    identificadorFiscal: 'RUC',
    indicesAjuste: [
      {
        codigo: 'IPC_PY',
        nombre: 'Índice de Precios al Consumidor',
        fuente: 'BCP',
        periodicidadMeses: 12,
      },
      {
        codigo: 'SALARIO_MINIMO',
        nombre: 'Salario Mínimo Vital y Móvil',
        fuente: 'Ministerio de Trabajo',
        periodicidadMeses: 12,
      },
    ],
    norma: {
      leyAplicable: 'Código Civil del Paraguay · Libro III',
      plazoMinimoMeses: 24,
      depositoMaximoCanones: 2,
      multaRescisionMaximaCanones: 1,
    },
    unidadMercado: 'PYG/m²',
    activo: false,
    apertura: '2027-Q2',
  },
];

export function paisPorCodigo(codigo: CodigoPais): Pais {
  return PAISES.find((p) => p.codigo === codigo) ?? PAISES[0]!;
}

/* ============================================================
 * Configuración persistida por inmobiliaria
 * ============================================================ */

const STORAGE_KEY = 'llave-inmo:pais-configuracion:v1';

export interface ConfiguracionPais {
  codigo: CodigoPais;
  /** Moneda elegida (puede ser distinta a la default si se opera en USD). */
  moneda: Moneda;
  /** Índice de ajuste por default para contratos nuevos. */
  indiceDefault: string;
}

export const DEFAULT_CONFIG: ConfiguracionPais = {
  codigo: 'AR',
  moneda: 'ARS',
  indiceDefault: 'ICL',
};

export function leerConfiguracionPais(): ConfiguracionPais {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConfiguracionPais) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function guardarConfiguracionPais(config: ConfiguracionPais): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('llave:pais-cambiado', { detail: config }));
  } catch {
    // ignore
  }
}

/* ============================================================
 * Formateo
 *
 * Helpers que reemplazan a formatMonto() del lib/format en cuando
 * la inmo opere en otro país. Usan Intl.NumberFormat con el locale
 * correspondiente.
 * ============================================================ */

export function simboloMoneda(moneda: Moneda): string {
  return {
    ARS: '$',
    UYU: '$U',
    BRL: 'R$',
    PYG: '₲',
    USD: 'US$',
  }[moneda];
}

export function formatearMontoConPais(
  monto: number,
  config: ConfiguracionPais,
): string {
  const pais = paisPorCodigo(config.codigo);
  try {
    return new Intl.NumberFormat(pais.locale, {
      style: 'currency',
      currency: config.moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto);
  } catch {
    return `${simboloMoneda(config.moneda)} ${Math.round(monto).toLocaleString(pais.locale)}`;
  }
}

export const MONEDA_LABEL: Record<Moneda, string> = {
  ARS: 'Peso argentino',
  UYU: 'Peso uruguayo',
  BRL: 'Real brasileño',
  PYG: 'Guaraní paraguayo',
  USD: 'Dólar estadounidense',
};
