'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../lib/cn';

const STORAGE_KEY = 'llave:theme';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Script inline que fuerza light mode siempre. No se respeta el dark mode
// del SO ni el toggle manual — la app queda blanca en celular y compu.
export const themeScript = `
  (function() {
    try {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'only light';
    } catch (_) {}
  })();
`;

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
      className={cn(
        'rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
      // suppress hydration mismatch en el ícono inicial — el script inline ya pintó
      // bien el body, solo el botón se sincroniza después de mount
      suppressHydrationWarning
    >
      {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
