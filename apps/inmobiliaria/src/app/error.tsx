'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCw } from 'lucide-react';
import { Button } from '@llave/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('llave/inmobiliaria unhandled error:', error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertOctagon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Algo falló en el panel</h1>
          <p className="text-sm text-muted-foreground">
            Reintentá. Si vuelve a pasar mandanos el código de referencia y lo revisamos.
          </p>
          {error.digest && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              ref {error.digest}
            </p>
          )}
        </div>
        <Button onClick={reset}>
          <RotateCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </main>
  );
}
