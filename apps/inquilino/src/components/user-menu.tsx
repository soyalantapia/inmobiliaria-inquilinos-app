'use client';

import { SignOutButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { isClerkEnabled } from '@/lib/auth';
import { useCurrentUser } from '@/lib/use-current-user';

export function UserMenu() {
  const router = useRouter();
  const user = useCurrentUser();

  const button = (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback className="bg-primary/10 text-primary">{user.initial}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-xs text-muted-foreground">Hola</p>
        <p className="font-semibold">{user.firstName}</p>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between">
      {button}
      {isClerkEnabled() ? (
        <SignOutButton redirectUrl="/login">
          <button className="rounded-full p-2 hover:bg-muted" aria-label="Cerrar sesión">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </SignOutButton>
      ) : (
        <button
          onClick={() => router.push('/login')}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Cerrar sesión (mock)"
        >
          <LogOut className="h-5 w-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
