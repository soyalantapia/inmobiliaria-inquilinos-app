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
    // Sentry irá acá en Sprint 0+. Por ahora consolemos el error.
    console.error('llave/inquilino unhandled error:', error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertOctagon className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo se rompió</h1>
        <p className="text-sm text-muted-foreground">
          Ya quedó registrado. Reintentá y si vuelve a pasar avisanos por WhatsApp.
        </p>
        {error.digest && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            ref {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} size="lg">
        <RotateCw className="h-4 w-4" />
        Reintentar
      </Button>
    </main>
  );
}
