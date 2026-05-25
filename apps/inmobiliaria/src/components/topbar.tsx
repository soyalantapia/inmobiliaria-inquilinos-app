'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LogOut, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Input } from '@llave/ui/input';
import { ThemeToggle } from '@llave/ui/theme-toggle';
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
        {/* Search: oculto en mobile, w-48 en lg, w-72 en xl. Se contrae si
            falta espacio porque NO tiene shrink-0. */}
        <div className="relative hidden min-w-0 lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-full pl-9 lg:w-48 xl:w-72" placeholder="Buscar…" />
        </div>
        <ConvenioBadgeTopbar />
        <ThemeToggle />
        <NotificationsBell />

        {isClerkEnabled() ? (
          <>
            <UserButton afterSignOutUrl="/login" />
            <SignOutButton redirectUrl="/login">
              <button className="rounded-full p-2 hover:bg-muted md:hidden" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </SignOutButton>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">
                {mockUser.user.firstName.slice(0, 1)}
                {mockUser.user.lastName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => router.push('/login')}
              className="rounded-full p-2 hover:bg-muted"
              aria-label="Cerrar sesión (mock)"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
