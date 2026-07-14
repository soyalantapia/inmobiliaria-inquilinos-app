'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';
import { LogOut } from 'lucide-react';
import { isClerkEnabled } from '@/lib/auth';
import { ConvenioBadgeTopbar } from './convenio-badge-topbar';
import { MobileSidebarTrigger } from './sidebar';
import { NotificationsBell } from './notifications-bell';
import { PilotoBadgeTopbar } from './piloto-badge-topbar';

export function Topbar({ titulo }: { titulo: string }) {
  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b bg-background px-3 md:gap-3 md:px-6">
      <div className="flex flex-shrink-0 items-center gap-2">
        <MobileSidebarTrigger />
        {/* El título no usa truncate — preferimos que el lado derecho se
            comprima a que el título quede como "Verificar inq...". Como
            ya pasa de 13 chars solo "Verificar inquilino", igual entra. */}
        <h1 className="whitespace-nowrap text-base font-semibold sm:text-lg xl:text-xl">{titulo}</h1>
        <PilotoBadgeTopbar />
      </div>
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        {/* I2-02: el search global del topbar era decorativo (sin value ni
            onChange — no buscaba nada) y convivía con el buscador real de
            cada sección (ej. Propietarios), confundiendo al usuario. Lo
            quitamos hasta tener búsqueda global de verdad: cada sección ya
            tiene su buscador funcional. Mejor sin search que con uno fake. */}
        <ConvenioBadgeTopbar />
        <NotificationsBell />

        {/* El avatar con iniciales (y su menú de cuenta) se quitó del topbar:
            la cuenta y el "Cerrar sesión" viven ahora en el footer del sidebar
            (visible también en el drawer mobile). Con Clerk activo se conserva
            su UserButton, que además maneja el sign-out. */}
        {isClerkEnabled() && (
          <>
            <UserButton afterSignOutUrl="/login" />
            <SignOutButton redirectUrl="/login">
              <button type="button" className="rounded-full p-2 hover:bg-muted md:hidden" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </SignOutButton>
          </>
        )}
      </div>
    </header>
  );
}
