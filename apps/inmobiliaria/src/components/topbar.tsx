'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Input } from '@llave/ui/input';
import { isClerkEnabled, mockUser } from '@/lib/auth';
import { MobileSidebarTrigger } from './sidebar';

export function Topbar({ titulo }: { titulo: string }) {
  const router = useRouter();
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <MobileSidebarTrigger />
        <h1 className="truncate text-xl font-semibold">{titulo}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-72 pl-9" placeholder="Buscar contrato, inquilino…" />
        </div>
        <button className="rounded-full p-2 hover:bg-muted" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
        </button>

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
