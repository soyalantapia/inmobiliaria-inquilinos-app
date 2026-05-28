'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { useCurrentUser } from '@/lib/use-current-user';
import { NotificationsBell } from './notifications-bell';

interface UserMenuProps {
  /** Si true, muestra solo el avatar (sin texto "Hola, X"). Útil en mobile
   * cuando la página ya tiene su propio saludo grande. */
  compact?: boolean;
}

export function UserMenu({ compact = false }: UserMenuProps = {}) {
  const user = useCurrentUser();

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href="/cuenta"
        className="flex items-center gap-3 rounded-lg -ml-1 p-1 transition-colors hover:bg-muted"
        aria-label={`Cuenta de ${user.firstName}`}
      >
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">{user.initial}</AvatarFallback>
        </Avatar>
        {!compact && (
          <div>
            <p className="text-xs text-muted-foreground">Hola</p>
            <p className="font-semibold">{user.firstName}</p>
          </div>
        )}
      </Link>
      <div className="flex items-center gap-1">
        <NotificationsBell />
      </div>
    </div>
  );
}
