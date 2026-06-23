'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { InstruccionesIOSDialog } from '@/components/instalar-app';
import { useInstalarApp } from '@/lib/instalar-app';

// Banner flotante (auto) para descubrir la descarga. Aparece cuando el navegador
// ofrece instalar (Android/Chrome) o en iPhone. Si el inquilino lo cierra, lo
// respetamos 7 días. El botón "Descargar app" persistente vive en /cuenta y /ayuda
// (este banner es solo el empujón de la primera vez).

const DISMISSED_KEY = 'llave:install-dismissed';

export function InstallPrompt() {
  const { instalada, tieneNativo, ios, instalar } = useInstalarApp();
  const [oculto, setOculto] = useState(true); // hasta montar, oculto (evita parpadeo/SSR)
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISSED_KEY);
    const sigueVigente = dismissed && Date.now() - Number(dismissed) < 7 * 86400 * 1000;
    setOculto(Boolean(sigueVigente));
  }, []);

  const descargar = async () => {
    const r = await instalar();
    if (r === 'ios') setIosOpen(true);
    else if (r === 'instalada') setOculto(true);
  };

  const dismiss = () => {
    setOculto(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  // Solo si NO está instalada y hay forma de ofrecerla (prompt nativo o iOS).
  if (instalada || oculto || (!tieneNativo && !ios)) {
    return <InstruccionesIOSDialog open={iosOpen} onOpenChange={setIosOpen} />;
  }

  return (
    <>
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
              <p className="text-sm font-medium">Descargá My Alquiler en tu celular</p>
              <p className="text-xs text-muted-foreground">
                {tieneNativo
                  ? 'Tocás una vez y queda como app, sin pasar por el navegador.'
                  : 'Te mostramos cómo agregarla a tu pantalla de inicio.'}
              </p>
            </div>
            <Button size="sm" onClick={descargar}>
              <Download className="h-3.5 w-3.5" />
              Descargar app
            </Button>
          </div>
        </Card>
      </div>
      <InstruccionesIOSDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}
