'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { contratoMock } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/use-current-user';

// FAB para contactar a la inmobiliaria por WhatsApp.
// Aparece SOLO en la home (/) — antes estaba en toda la app y tapaba
// CTAs primarios en /reclamos, /pago, etc. La acción de "hablar con la
// inmo" también vive en /cuenta (botón "WhatsApp con la inmobiliaria"),
// así que mantener el FAB en TODA la app era duplicado y ruidoso.
//
// El número de la inmobiliaria sale del contratoMock; en backend real
// viene de contrato.inmobiliaria.telefono.

const TELEFONO_INMO = '541145321100'; // sin + ni espacios para wa.me

export function WhatsappFab() {
  const user = useCurrentUser();
  const pathname = usePathname() ?? '';
  // Solo en la home — cualquier otra ruta lo oculta.
  if (pathname !== '/') return null;

  const mensaje = `Hola! Soy ${user.fullName}, inquilino/a en ${contratoMock.direccion}. Tengo una consulta.`;
  const url = `https://wa.me/${TELEFONO_INMO}?text=${encodeURIComponent(mensaje)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Hablar con la inmobiliaria por WhatsApp"
      /* bottom-24 (no bottom-20) — el nav inferior mide ~72-80px en
         mobile y con bottom-20 el FAB pisaba los iconos "Recibos" y
         "Reclamos". El comment de arriba ya decía bottom-24, este es
         el fix que faltaba aplicar. */
      className="fixed bottom-24 right-3 z-30 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 md:bottom-6 md:right-6 md:h-12 md:w-12"
    >
      <MessageCircle className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.5} />
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 md:block">
        Hablar con la inmobiliaria
      </span>
    </a>
  );
}
