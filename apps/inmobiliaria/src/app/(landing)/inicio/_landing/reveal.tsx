'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fade-up on scroll, UNA sola vez (viewport once). Sin librería de motion:
 * IntersectionObserver + transición CSS. Respeta prefers-reduced-motion.
 *
 * El movimiento es consecuencia del diseño, no el diseño: lo usamos con
 * mesura (no en cada elemento) y con un único easing.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(true);
      return;
    }
    // Red de seguridad: pase lo que pase, revelamos a los 1.8s. Una sección NUNCA
    // debe quedar invisible (observer que no dispara, scroll muy rápido, layout raro,
    // o un crawler con JS que no scrollea). El scroll normal lo dispara mucho antes.
    const safety = window.setTimeout(() => setShown(true), 1800);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            clearTimeout(safety);
          }
        }
      },
      // threshold 0 = dispara apenas asoma un pixel; rootMargin negativo abajo hace
      // que empiece a revelar un poco ANTES de entrar del todo (nada de flash de vacío).
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      style={{
        transitionDelay: shown ? `${delay}ms` : '0ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      className={[
        'transition-[opacity,transform] duration-500 motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
