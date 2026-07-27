'use client';

import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { UserMenu } from './user-menu';
import { useCurrentUser } from '@/lib/use-current-user';
import { useMiContrato } from '@/lib/api/hooks';

/**
 * Header mobile consistente para las pestañas principales del inquilino
 * (Inicio, Pagos, Contrato, Reclamos): saludo "Hola, {nombre} 👋" a la
 * izquierda + UserMenu compacto (avatar + campana) a la derecha.
 *
 * Debajo del saludo va la dirección de la propiedad ACTUAL, linkeada a
 * /mis-alquileres: con dos alquileres, en un teléfono las dos sesiones se veían
 * idénticas (no había forma de saber en cuál estabas parado), y la lista de
 * propiedades estaba escondida detrás de Mi cuenta.
 *
 * `md:hidden` — en desktop lo cubre la topbar del layout. Es el ÚNICO origen
 * de verdad del header mobile para que todas las pantallas se vean iguales.
 */
export function MobileGreetingHeader() {
  const user = useCurrentUser();
  const { contrato } = useMiContrato();
  const tieneNombre = user.firstName.length > 0;
  return (
    <header className="flex items-start justify-between px-5 pt-5 md:hidden">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Hola,</p>
        <p className="truncate text-lg font-semibold leading-tight">
          {tieneNombre ? (
            <>
              {user.firstName} <span aria-hidden="true">👋</span>
            </>
          ) : (
            <span aria-hidden="true">👋</span>
          )}
        </p>
        {contrato?.direccion && (
          <div className="mt-0.5 flex">
            {/*
             * `py-3.5 -my-3.5` en el <Link>: agranda el área táctil a 44px
             * de alto (mínimo WCAG 2.5.5 / Apple HIG) sin correr el layout.
             * El padding y el margen negativo son simétricos, así que el
             * aporte neto de este nodo al flujo del documento no cambia
             * (el wrapper `flex` evita que ese margen negativo colapse con
             * el párrafo del nombre de arriba): el texto se ve exactamente
             * en la misma posición, pero el link ahora "come" el espacio
             * muerto de alrededor en vez de que el dedo caiga en la
             * tarjeta de Pagos que está justo debajo.
             */}
            <Link
              href="/mis-alquileres"
              aria-label={`Ver mis propiedades. Actual: ${contrato.direccion}`}
              className="flex items-center gap-1 py-3.5 -my-3.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="truncate">{contrato.direccion}</span>
              <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      <UserMenu compact />
    </header>
  );
}
