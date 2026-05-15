'use client';

import { useEffect, useState } from 'react';
import type { Liquidacion } from './types';

/**
 * Modo demo del inquilino — sincronizado entre todas las pantallas vía
 * localStorage. Útil para mostrar los 3 escenarios sin tener que cambiar
 * mock data.
 *
 *   - 'al-dia':   el inquilino no tiene pagos pendientes
 *   - 'a-tiempo': hay un pago pendiente pero la fecha de vencimiento es futura
 *   - 'atrasado': hay un pago vencido (con punitorios acumulados)
 */
export type DemoEstado = 'al-dia' | 'a-tiempo' | 'atrasado';

const STORAGE_KEY = 'llave-inquilino:demo';
const DEFAULT: DemoEstado = 'atrasado';

/**
 * Hook React que lee y persiste el estado demo. Detecta cambios desde otras
 * pestañas / pantallas a través del evento `storage`.
 */
export function useDemoEstado(): [DemoEstado, (e: DemoEstado) => void] {
  const [estado, setEstadoLocal] = useState<DemoEstado>(DEFAULT);

  // Hidratación inicial desde localStorage (post-mount para evitar mismatch SSR)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as DemoEstado | null;
      if (stored === 'al-dia' || stored === 'a-tiempo' || stored === 'atrasado') {
        setEstadoLocal(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  // Listener para cambios en otras pestañas/pantallas
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue as DemoEstado | null;
      if (v === 'al-dia' || v === 'a-tiempo' || v === 'atrasado') {
        setEstadoLocal(v);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setEstado = (nuevo: DemoEstado) => {
    setEstadoLocal(nuevo);
    try {
      window.localStorage.setItem(STORAGE_KEY, nuevo);
    } catch {
      // ignore
    }
  };

  return [estado, setEstado];
}

/**
 * Aplica el estado demo a una liquidación pendiente. Devuelve:
 *   - 'al-dia':   null (no hay nada pendiente)
 *   - 'atrasado': la liquidación tal cual viene del mock (fecha pasada)
 *   - 'a-tiempo': clonamos la liquidación pero con fecha futura y sin
 *                 punitorios para que aparezca como "pendiente pero a tiempo"
 */
export function aplicarEstadoDemo(
  estado: DemoEstado,
  base: Liquidacion | undefined,
): Liquidacion | null {
  if (estado === 'al-dia' || !base) return null;
  if (estado === 'atrasado') return base;
  // 'a-tiempo': vencimiento dentro de 5 días desde hoy, sin punitorios
  const hoy = new Date();
  const venc = new Date(hoy);
  venc.setDate(hoy.getDate() + 5);
  return {
    ...base,
    fechaVencimiento: venc.toISOString().slice(0, 10),
    montoPunitorio: 0,
    montoTotal: base.montoAlquiler + (base.montoExpensas ?? 0),
    estado: 'PENDIENTE',
  };
}
