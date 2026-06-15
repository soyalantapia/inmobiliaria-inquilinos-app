'use client';

import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';

/**
 * Estado "Próximamente" para pantallas completas cuya acción todavía NO tiene
 * endpoint en el API. En prod (apiEnabled) reemplaza al formulario mock para
 * no dejar al operador "guardar" algo que solo iría a localStorage; en demo
 * (!apiEnabled) NO se usa: ahí queda el flujo mock intacto.
 *
 * Mantené el Topbar/Nav por fuera: este componente es solo el cuerpo central.
 */
export function Proximamente({
  titulo,
  descripcion,
  volverHref,
  volverLabel = 'Volver',
}: {
  /** Ej: "La carga de propiedades estará disponible pronto". */
  titulo: string;
  /** Línea de apoyo opcional. */
  descripcion?: string;
  /** A dónde vuelve el botón (ej "/propiedades"). */
  volverHref?: string;
  volverLabel?: string;
}) {
  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Clock className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold">{titulo}</h1>
              {descripcion && (
                <p className="text-sm text-muted-foreground">{descripcion}</p>
              )}
            </div>
            {volverHref && (
              <Button asChild variant="outline" className="mt-1">
                <Link href={volverHref}>
                  <ArrowLeft className="h-4 w-4" />
                  {volverLabel}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
