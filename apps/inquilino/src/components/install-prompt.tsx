'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';

// Captura el evento beforeinstallprompt (Chrome/Android, Edge) y muestra un
// banner discreto. En iOS no se dispara el evento, ahí mostramos un hint
// con las instrucciones de "Agregar a pantalla de inicio".

const DISMISSED_KEY = 'llave:install-dismissed';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ¿ya está instalada?
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // ¿el usuario la cerró antes? la respetamos por 7 días
    const dismissed = window.localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // iOS Safari: no dispara beforeinstallprompt. Detección por UA y ausencia
    // de standalone-mode.
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos) setShowIos(true);

    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'dismissed') {
      try {
        window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    }
  };

  const dismiss = () => {
    setDeferred(null);
    setShowIos(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  if (!deferred && !showIos) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 animate-fade-in md:inset-x-auto md:left-3 md:right-auto md:w-80">
      <Card className="relative flex items-start gap-3 border-primary/20 bg-primary/5 p-4 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2 pr-4">
          <div>
            <p className="text-sm font-medium">Instalá My Alquiler en tu celular</p>
            <p className="text-xs text-muted-foreground">
              {deferred
                ? 'Tocás una vez y queda como app, sin pasar por el navegador.'
                : 'En Safari, tocá Compartir → Agregar a pantalla de inicio.'}
            </p>
          </div>
          {deferred && (
            <Button size="sm" onClick={install}>
              Instalar
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
