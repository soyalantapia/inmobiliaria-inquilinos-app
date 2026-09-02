'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCw } from 'lucide-react';
import { Button } from '@llave/ui/button';

/**
 * Qué ve el dueño cuando algo se rompe de verdad.
 *
 * POR QUÉ EXISTE: era la única de las tres apps sin `error.tsx`. El panel y la PWA lo tienen
 * desde hace rato; acá un error de render dejaba la pantalla EN BLANCO, sin una palabra.
 *
 * Y es la superficie donde más caro sale: el operador que ve romperse el panel llama; el
 * inquilino que ve romperse la PWA reclama. El dueño no hace ninguna de las dos —abre el
 * portal cada tanto, para controlar plata— y una pantalla en blanco en esa pantalla no se lee
 * como "se rompió la app": se lee como que algo no cierra. Cierra el navegador y desconfía, y
 * nosotros no nos enteramos nunca.
 *
 * El copy no promete lo que el portal no puede cumplir. No dice "avisanos por WhatsApp" como
 * el de la PWA: el dueño no tiene un canal nuestro, tiene el de SU inmobiliaria, y mandarlo a
 * un lugar que no existe es peor que no decir nada.
 */
export default function ErrorDelPortal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sonar levanta los errores no atrapados del window, pero NO los que React captura en un
    // boundary: para él ese error nunca llegó al window. Sin este console.error explícito, el
    // caso que este archivo existe para manejar sería justamente el que no se reporta.
    console.error('myalquiler/propietario error no atrapado:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertOctagon className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo se rompió de nuestro lado</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          No es un problema con tu cuenta ni con tu plata: quedó registrado y lo vamos a mirar.
          Probá de nuevo.
        </p>
        {/* La referencia es lo único que convierte "me falló" en algo que alguien puede
            buscar. Va en chico y sin explicación: el que la necesita sabe qué es. */}
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
      <p className="max-w-xs text-xs text-muted-foreground">
        Si sigue pasando, contale a tu inmobiliaria: ellos pueden ver tus rendiciones igual y
        pasarte lo que necesites mientras tanto.
      </p>
    </main>
  );
}
