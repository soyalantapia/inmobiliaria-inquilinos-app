'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // `retry: 0`: un 401 acá significa sesión vencida o revocada, y reintentar sólo
          // demora el redirect al login. El resto de los errores los muestra la pantalla.
          queries: { staleTime: 30_000, retry: 0, refetchOnWindowFocus: true },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
