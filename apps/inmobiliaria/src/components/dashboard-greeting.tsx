'use client';

import { useUser } from '@clerk/nextjs';
import { isClerkEnabled, mockUser } from '@/lib/auth';

export function DashboardGreeting() {
  const nombre = useNombre();
  return (
    <div>
      <p className="text-sm text-muted-foreground">Buenas, {nombre}.</p>
      <p className="text-2xl font-semibold">Esto pasó hoy en tu cartera.</p>
    </div>
  );
}

function useNombre(): string {
  if (isClerkEnabled()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user } = useUser();
    return user?.firstName ?? user?.username ?? 'Operador';
  }
  return mockUser.user.firstName;
}
