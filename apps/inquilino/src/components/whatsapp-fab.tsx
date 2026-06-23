'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { contratoMock } from '@/lib/mock-data';
import { apiEnabled } from '@/lib/api/client';
import { useMiContrato } from '@/lib/api/hooks';
import { useCurrentUser } from '@/lib/use-current-user';

// FAB para contactar a la inmobiliaria por WhatsApp. Solo en la home (/).
// El teléfono y la dirección salen del CONTRATO REAL del inquilino
// (GET /mi-contrato). En build demo (!apiEnabled) se usan los del mock.
const TELEFONO_DEMO = '541145321100';

export function WhatsappFab() {
  const user = useCurrentUser();
  const pathname = usePathname() ?? '';
  const { contrato, inmobiliariaTelefono } = useMiContrato();

  // Solo en la home — cualquier otra ruta lo oculta.
  if (pathname !== '/') return null;

  const tel = (apiEnabled ? inmobiliariaTelefono : TELEFONO_DEMO) ?? '';
  // En prod, sin teléfono real de la inmobiliaria no mostramos el FAB
  // (no inventamos un número).
  if (apiEnabled && !tel) return null;

  const telLimpio = tel.replace(/\D/g, '');
  const direccion = contrato?.direccion ?? contratoMock.direccion;
  const mensaje = `Hola! Soy ${user.fullName}, inquilino/a en ${direccion}. Tengo una consulta.`;
  const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Hablar con la inmobiliaria por WhatsApp"
      className="group fixed bottom-24 right-3 z-30 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 md:bottom-6 md:right-6 md:h-12 md:w-12"
    >
      <MessageCircle className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.5} />
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 md:block">
        Hablar con la inmobiliaria
      </span>
    </a>
  );
}
