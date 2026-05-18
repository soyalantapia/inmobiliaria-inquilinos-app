'use client';

import { MessageCircle } from 'lucide-react';
import { contratoMock } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/use-current-user';

// FAB para contactar a la inmobiliaria por WhatsApp.
// Aparece siempre en pages con shell. En mobile lo levantamos sobre el
// NavBar (bottom-24); en desktop queda libre (bottom-6).
//
// El número de la inmobiliaria sale del contratoMock; en backend real
// viene de contrato.inmobiliaria.telefono.

const TELEFONO_INMO = '541145321100'; // sin + ni espacios para wa.me

export function WhatsappFab() {
  const user = useCurrentUser();
  const mensaje = `Hola! Soy ${user.fullName}, inquilino/a en ${contratoMock.direccion}. Tengo una consulta.`;
  const url = `https://wa.me/${TELEFONO_INMO}?text=${encodeURIComponent(mensaje)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Hablar con la inmobiliaria por WhatsApp"
      className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 md:bottom-6 md:right-6 md:h-12 md:w-12"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={2.5} />
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 md:block">
        Hablar con la inmobiliaria
      </span>
    </a>
  );
}
