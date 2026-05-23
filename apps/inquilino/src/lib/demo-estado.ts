'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
const VISIBLE_KEY = 'llave-inquilino:demo-visible';
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
 * Hook que controla si el switcher de modo demo es visible en la UI.
 *
 * Default: oculto — un inquilino real no debería ver controles de demo
 * (parece producto a medio terminar). Para activarlo, el equipo entra con
 * `?demo=1` una vez; el flag queda guardado en localStorage. `?demo=0`
 * lo apaga. Esto permite usar el switcher en demos sin exponerlo a usuarios.
 */
export function useDemoVisible(): boolean {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const q = searchParams?.get('demo');
    if (q === '1') {
      try {
        window.localStorage.setItem(VISIBLE_KEY, '1');
      } catch {
        // ignore
      }
      setVisible(true);
      return;
    }
    if (q === '0') {
      try {
        window.localStorage.removeItem(VISIBLE_KEY);
      } catch {
        // ignore
      }
      setVisible(false);
      return;
    }
    // Sin query: leer flag persistido
    try {
      setVisible(window.localStorage.getItem(VISIBLE_KEY) === '1');
    } catch {
      setVisible(false);
    }
  }, [searchParams]);

  return visible;
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
