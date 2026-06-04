'use client';

import { UserMenu } from './user-menu';
import { useCurrentUser } from '@/lib/use-current-user';

/**
 * Header mobile consistente para las pestañas principales del inquilino
 * (Inicio, Pagos, Contrato, Reclamos): saludo "Hola, {nombre} 👋" a la
 * izquierda + UserMenu compacto (avatar + campana) a la derecha.
 *
 * `md:hidden` — en desktop lo cubre la topbar del layout. Es el ÚNICO origen
 * de verdad del header mobile para que todas las pantallas se vean iguales
 * (antes cada página armaba el suyo y divergían: unas con el saludo grande,
 * otras con el avatar + nombre del UserMenu no-compacto).
 */
export function MobileGreetingHeader() {
  const user = useCurrentUser();
  return (
    <header className="flex items-center justify-between px-5 pt-5 md:hidden">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Hola,</p>
        <p className="truncate text-lg font-semibold leading-tight">
          {user.firstName} <span aria-hidden="true">👋</span>
        </p>
      </div>
      <UserMenu compact />
    </header>
  );
}
