'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@llave/ui/dropdown-menu';
import { isClerkEnabled, mockUser } from '@/lib/auth';
import { ConvenioBadgeTopbar } from './convenio-badge-topbar';
import { MobileSidebarTrigger } from './sidebar';
import { NotificationsBell } from './notifications-bell';
import { PilotoBadgeTopbar } from './piloto-badge-topbar';
import { SelectorSociedadTopbar } from './selector-sociedad-topbar';

export function Topbar({ titulo }: { titulo: string }) {
  const router = useRouter();
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
        <SelectorSociedadTopbar />
        {/* I2-02: el search global del topbar era decorativo (sin value ni
            onChange — no buscaba nada) y convivía con el buscador real de
            cada sección (ej. Propietarios), confundiendo al usuario. Lo
            quitamos hasta tener búsqueda global de verdad: cada sección ya
            tiene su buscador funcional. Mejor sin search que con uno fake. */}
        <ConvenioBadgeTopbar />
        <NotificationsBell />

        {isClerkEnabled() ? (
          <>
            <UserButton afterSignOutUrl="/login" />
            <SignOutButton redirectUrl="/login">
              <button type="button" className="rounded-full p-2 hover:bg-muted md:hidden" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </SignOutButton>
          </>
        ) : (
          // El "Cerrar sesión" vivía como botón suelto siempre visible al lado
          // del avatar — muy fácil de tocar sin querer. Ahora vive detrás del
          // avatar, en un menú (click avatar → Cerrar sesión).
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menú de cuenta"
                className="rounded-full outline-none transition-shadow hover:ring-2 hover:ring-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {mockUser.user.firstName.slice(0, 1)}
                    {mockUser.user.lastName.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium leading-none">
                  {mockUser.user.firstName} {mockUser.user.lastName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Inmobiliaria del Sol</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/login')}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
