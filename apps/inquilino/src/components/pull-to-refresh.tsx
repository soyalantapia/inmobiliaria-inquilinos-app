'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Pull-to-refresh nativo en mobile. Detecta gesture cuando el scroll está en
// top y el usuario arrastra hacia abajo. Llega a un umbral → ejecuta
// router.refresh() que vuelve a hacer SSR de los Server Components.
//
// Solo se monta en mobile (md:hidden). En desktop no tiene sentido.

const UMBRAL = 80; // px para disparar
const MAX_PULL = 130; // px máximo del pull visual

export function PullToRefresh() {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0); // px arrastrados
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onTouchStart = (e: TouchEvent) => {
      // Solo si estamos en top de la página
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        // Aplico resistencia exponencial para que cueste cada vez más
        const eased = Math.min(delta * 0.5, MAX_PULL);
        setPull(eased);
      } else if (delta <= 0) {
        setPull(0);
      }
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;

      if (pull >= UMBRAL && !refreshing) {
        setRefreshing(true);
        // Mantenemos el indicador visible mientras refresca
        setPull(UMBRAL);
        try {
          router.refresh();
          // Esperamos un poco para que el feedback visual sea claro
          await new Promise((r) => setTimeout(r, 600));
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pull, refreshing, router]);

  if (pull === 0 && !refreshing) return null;

  const progreso = Math.min(pull / UMBRAL, 1);
  const listo = pull >= UMBRAL;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex items-center justify-center md:hidden"
      style={{
        height: `${pull}px`,
        transition: refreshing ? 'none' : 'height 200ms ease-out',
      }}
    >
      <div
        className="rounded-full bg-background/95 p-2.5 shadow-lg ring-1 ring-border backdrop-blur"
        style={{
          opacity: progreso,
          transform: `scale(${0.6 + 0.4 * progreso})`,
        }}
      >
        {refreshing ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <RefreshCw
            className={`h-5 w-5 ${listo ? 'text-primary' : 'text-muted-foreground'}`}
            style={{ transform: `rotate(${progreso * 180}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
