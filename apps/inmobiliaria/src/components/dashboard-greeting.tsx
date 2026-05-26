'use client';

import { useUser } from '@clerk/nextjs';
import { isClerkEnabled, mockUser } from '@/lib/auth';

export function DashboardGreeting() {
  const nombre = useNombre();
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {saludoSegunHora()}, {nombre}.
      </p>
      {/* "Esto pasó hoy" era engañoso — abajo se ven KPIs del mes
          completo y la agenda futura. Hablamos del estado general
          de la cartera, no del día concreto. */}
      <p className="text-2xl font-semibold">Tu cartera al día.</p>
    </div>
  );
}

/**
 * Saludo según la hora local (no la del servidor). Lo calculamos en
 * cada render del cliente — esto es un client component, no se
 * pre-renderiza con hora UTC y por eso no genera mismatch.
 */
function saludoSegunHora(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function useNombre(): string {
  if (isClerkEnabled()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user } = useUser();
    return user?.firstName ?? user?.username ?? 'Operador';
  }
  return mockUser.user.firstName;
}
