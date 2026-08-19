'use client';

import { Loader2 } from 'lucide-react';
import { Card } from '@llave/ui/card';

/** Encabezado de sección. Lo comparten las cuatro pestañas para que se lean igual. */
export function Seccion({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icono}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export const Cargando = () => (
  <Card className="p-6 text-center">
    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Cargando" />
  </Card>
);

export const Vacio = ({ texto }: { texto: string }) => (
  <Card className="p-6 text-center text-sm text-muted-foreground">{texto}</Card>
);

/**
 * Cuando una pestaña no puede traer sus datos.
 *
 * Va con el motivo que devolvió la API, no un "hubo un error": el propietario no puede hacer
 * nada con un mensaje genérico, y si el problema es que su sesión venció el texto se lo dice.
 */
export const ErrorCarga = ({ mensaje }: { mensaje?: string }) => (
  <Card className="p-6 text-center text-sm text-muted-foreground">
    {mensaje ?? 'No pudimos traer esta información en este momento. Probá de nuevo en un rato.'}
  </Card>
);
