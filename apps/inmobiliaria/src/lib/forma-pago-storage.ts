'use client';

/**
 * Forma de pago elegida por la inmobiliaria para abonar su plan en My
 * Alquiler. Tres opciones:
 *  - DEBITO_AUTOMATICO: tarjeta con cargo mensual (la más usada)
 *  - PREPAGO: paga adelantado por transferencia. 15 días de gracia
 *    desde el vencimiento; si pasa de eso se corta el servicio (45d).
 *  - ANUAL: paga 12 meses por adelantado con 20% off.
 */

const STORAGE_KEY = 'llave-inmo:forma-pago:v1';

export type FormaPago = 'DEBITO_AUTOMATICO' | 'PREPAGO' | 'ANUAL';

/** Descuento aplicado al pagar el año entero adelantado. */
export const DESCUENTO_ANUAL = 0.20;

export interface ConfigFormaPago {
  forma: FormaPago;
  /** Últimos 4 dígitos de la tarjeta si está en débito automático. */
  ultimos4: string | null;
  /** Marca de la tarjeta (Visa, Mastercard, Amex). */
  marca: string | null;
  /** Próxima fecha de cobro. */
  proximoCobro: string;
  /** Fecha en que se activó esta forma de pago. */
  configuradaAt: string;
}

const DEFAULT_CONFIG: ConfigFormaPago = {
  forma: 'DEBITO_AUTOMATICO',
  ultimos4: '4521',
  marca: 'Visa',
  proximoCobro: '2026-06-01',
  configuradaAt: '2026-01-15T10:00:00-03:00',
};

export function leerFormaPago(): ConfigFormaPago {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConfigFormaPago) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function guardarFormaPago(input: {
  forma: FormaPago;
  ultimos4?: string;
  marca?: string;
}): ConfigFormaPago {
  const ahora = new Date();
  const proximoCobro = new Date(ahora);
  if (input.forma === 'ANUAL') {
    proximoCobro.setFullYear(proximoCobro.getFullYear() + 1);
  } else {
    proximoCobro.setMonth(proximoCobro.getMonth() + 1);
    proximoCobro.setDate(1);
  }
  const cfg: ConfigFormaPago = {
    forma: input.forma,
    ultimos4: input.ultimos4 ?? null,
    marca: input.marca ?? null,
    proximoCobro: proximoCobro.toISOString(),
    configuradaAt: ahora.toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  }
  return cfg;
}

/** Calcula el monto final según forma de pago, dado el precio mensual base. */
export function montoFinalSegunForma(precioMensual: number, forma: FormaPago): {
  importe: number;
  ahorro: number;
  periodo: 'mes' | 'año';
} {
  if (forma === 'ANUAL') {
    const anualBase = precioMensual * 12;
    const ahorro = Math.round(anualBase * DESCUENTO_ANUAL);
    return { importe: anualBase - ahorro, ahorro, periodo: 'año' };
  }
  return { importe: precioMensual, ahorro: 0, periodo: 'mes' };
}

export const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  DEBITO_AUTOMATICO: 'Débito automático',
  PREPAGO: 'Prepago por transferencia',
  ANUAL: 'Pago anual',
};

/* ============================================================
 * Estado de cuenta + corte automático
 * ============================================================ */
const ESTADO_KEY = 'llave-inmo:estado-cuenta:v1';

/** Días desde el vencimiento a partir de los cuales se pausa el servicio. */
export const DIAS_HASTA_CORTE = 45;
/** Días de gracia para prepago (sin penalidad). */
export const DIAS_GRACIA_PREPAGO = 15;

export type EstadoCuenta = 'AL_DIA' | 'GRACIA' | 'ATRASADO' | 'PAUSADO';

export interface EstadoCuentaPayload {
  /** Última fecha en que se debió pagar (ISO). */
  vencimientoUltimo: string;
  /** True si el último cobro fue exitoso. */
  ultimoCobroOk: boolean;
}

const DEFAULT_ESTADO: EstadoCuentaPayload = {
  vencimientoUltimo: new Date(Date.now() + 7 * 86400000).toISOString(),
  ultimoCobroOk: true,
};

export function leerEstadoCuenta(): EstadoCuentaPayload {
  if (typeof window === 'undefined') return DEFAULT_ESTADO;
  try {
    const raw = window.localStorage.getItem(ESTADO_KEY);
    return raw ? (JSON.parse(raw) as EstadoCuentaPayload) : DEFAULT_ESTADO;
  } catch {
    return DEFAULT_ESTADO;
  }
}

export function guardarEstadoCuenta(payload: EstadoCuentaPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ESTADO_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export interface EstadoCuentaCalculado {
  estado: EstadoCuenta;
  diasDesdeVencimiento: number;
  /** Días restantes hasta el corte (puede ser negativo si ya pasó). */
  diasHastaCorte: number;
  vencimientoUltimo: string;
}

/**
 * Calcula el estado actual de la cuenta del inmo en función de la forma
 * de pago y el último vencimiento.
 *  - DEBITO_AUTOMATICO: si el cobro falló, entra en GRACIA inmediatamente.
 *  - PREPAGO: tiene 15 días de gracia + 30 días más antes del corte (total 45).
 *  - ANUAL: si el cobro se procesó ok, está AL_DIA hasta el próximo año.
 */
export function calcularEstadoCuenta(
  forma: FormaPago,
  estadoPayload: EstadoCuentaPayload = leerEstadoCuenta(),
): EstadoCuentaCalculado {
  const vencISO = estadoPayload.vencimientoUltimo;
  const hoy = Date.now();
  const venc = new Date(vencISO).getTime();
  const diasDesde = Math.floor((hoy - venc) / 86400000);
  const diasHastaCorte = DIAS_HASTA_CORTE - diasDesde;

  // Si el cobro fue ok y todavía no llegamos al próximo vencimiento, AL_DIA.
  if (estadoPayload.ultimoCobroOk && diasDesde <= 0) {
    return {
      estado: 'AL_DIA',
      diasDesdeVencimiento: diasDesde,
      diasHastaCorte: DIAS_HASTA_CORTE,
      vencimientoUltimo: vencISO,
    };
  }

  // Cobro falló o pasó el vencimiento.
  let estado: EstadoCuenta;
  if (forma === 'PREPAGO' && diasDesde <= DIAS_GRACIA_PREPAGO) {
    estado = 'GRACIA';
  } else if (diasDesde < DIAS_HASTA_CORTE) {
    estado = 'ATRASADO';
  } else {
    estado = 'PAUSADO';
  }

  return {
    estado,
    diasDesdeVencimiento: diasDesde,
    diasHastaCorte,
    vencimientoUltimo: vencISO,
  };
}

export const ESTADO_CUENTA_LABEL: Record<EstadoCuenta, string> = {
  AL_DIA: 'Al día',
  GRACIA: 'Dentro del período de gracia',
  ATRASADO: 'Atrasado · se va a cortar pronto',
  PAUSADO: 'Servicio pausado',
};
