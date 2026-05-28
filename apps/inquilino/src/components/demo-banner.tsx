'use client';

import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';

// L-DEEP-LINK-01: cuando alguien aterriza en el demo desde un link profundo
// de la landing (ej. "Ver pagos pendientes"), no sabía que estaba en una demo
// ni cómo volver. Este banner discreto da contexto ("esto es la demo, datos de
// ejemplo") y una vía de regreso a la landing. Es dismissable y recuerda la
// elección en localStorage para no molestar en visitas siguientes.
//
// La landing vive FUERA del basePath de esta app (/inmobiliaria-inquilinos-app/
// presentacion/), por eso usamos un <a> plano con el path absoluto de producción
// en vez de next/link (que prefijaría el basePath de la app).
const LANDING_URL = '/inmobiliaria-inquilinos-app/presentacion/';
const DISMISS_KEY = 'demo-banner-dismissed';

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    // Posicionado abajo y elevado sobre el bottom-nav mobile (~64px + safe
    // area): un banner fixed top tapaba el header de la app. Abajo-centro a
    // bottom-24 queda sobre el nav sin chocar, y no compite con el FAB de
    // WhatsApp (abajo-derecha).
    <div
      role="region"
      aria-label="Aviso de demostración"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex justify-center px-3"
    >
      <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
        <Info className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate text-muted-foreground">
          Estás en la <strong className="text-foreground">demo</strong> · datos de ejemplo
        </span>
        <a
          href={LANDING_URL}
          className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
        >
          Conocé la plataforma
        </a>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso de demostración"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
