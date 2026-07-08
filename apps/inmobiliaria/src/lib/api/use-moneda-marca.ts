'use client';

/**
 * Moneda configurada por la marca (inmobiliaria) — sale de la config de Mercado
 * (`useMercado().config.monedaDefault`). La usan los inputs de dinero (`MoneyInput`)
 * para mostrar el símbolo correcto ($ o US$) según lo que tiene configurado la marca.
 * El core del producto maneja ARS/USD; cualquier otra cae a ARS (mismo símbolo '$').
 */
import type { Moneda } from '@/lib/types';
import { useMercado } from './hooks';

export function useMonedaMarca(): Moneda {
  const { config } = useMercado();
  // `ConfiguracionPais.moneda` es más amplio (UYU/BRL); el core del producto y
  // `formatMonto` sólo manejan ARS/USD → cualquier otra cae a ARS (símbolo '$').
  return config?.moneda === 'USD' ? 'USD' : 'ARS';
}
