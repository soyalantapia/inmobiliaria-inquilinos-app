'use client';

import { useEffect } from 'react';
import { Moon } from 'lucide-react';
import { cn } from '../lib/cn';

// LIGHT MODE FORZADO — no respeta el dark mode del SO ni guarda toggle.
// La función mantiene la app blanca en celular y compu siempre.
function forceLight() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'only light';
  try {
    // Limpiamos cualquier preferencia vieja guardada para evitar re-aplicar dark
    window.localStorage.removeItem('llave:theme');
  } catch {
    // ignore
  }
}

// Script inline que se ejecuta antes del primer paint (en <head>).
export const themeScript = `
  (function() {
    try {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'only light';
      try { window.localStorage.removeItem('llave:theme'); } catch (_) {}
    } catch (_) {}
  })();
`;

// El componente sigue exportándose por retrocompatibilidad pero ya no permite
// togglear — sólo refuerza light mode en cada mount. Ícono no clickable.
export function ThemeToggle({ className }: { className?: string }) {
  useEffect(() => {
    forceLight();
    // Observar cambios al html.class para deshacer cualquier intento externo
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        if (document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.remove('dark');
        }
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => mo.disconnect();
    }
    return undefined;
  }, []);

  return (
    <button
      type="button"
      onClick={(e) => e.preventDefault()}
      aria-label="Tema claro"
      className={cn(
        'rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
      suppressHydrationWarning
    >
      <Moon className="h-5 w-5" />
    </button>
  );
}
