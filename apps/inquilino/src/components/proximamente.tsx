'use client';

import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { NavBar } from '@/components/nav-bar';

interface ProximamenteProps {
  /** Título corto de la función, ej. "Asistente" o "Documentos". */
  titulo: string;
  /** Texto explicativo opcional bajo el título. */
  descripcion?: string;
  /** Ícono a mostrar en el círculo (default: reloj). */
  icon?: React.ReactNode;
  /**
   * Header opcional con botón "volver". Si se pasa `volverHref`, se muestra
   * una barra superior con la flecha hacia esa ruta (igual que el resto de
   * las sub-pantallas de la app).
   */
  volverHref?: string;
  volverLabel?: string;
  /** Si es false, no renderiza el NavBar inferior (para vistas públicas). */
  conNavBar?: boolean;
}

/**
 * Estado neutro "Disponible pronto" para funciones que en producción todavía
 * NO tienen endpoint en el API. Reemplaza al mock para no mostrar datos
 * falsos ni permitir guardar algo que solo iría a localStorage.
 *
 * En build demo (sin API) las pantallas siguen usando su UI mock — este
 * componente solo se renderiza cuando `apiEnabled === true`.
 */
export function Proximamente({
  titulo,
  descripcion,
  icon,
  volverHref,
  volverLabel = 'Volver',
  conNavBar = true,
}: ProximamenteProps) {
  return (
    <>
      {volverHref && (
        <header className="flex items-center gap-3 p-5 md:px-8">
          <Button size="icon" variant="ghost" asChild>
            <Link href={volverHref} aria-label={volverLabel}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold md:text-2xl">{titulo}</h1>
          </div>
        </header>
      )}

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 md:px-8">
        <Card className="w-full max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            {icon ?? <Clock className="h-7 w-7" />}
          </div>
          <div className="space-y-1.5">
            {!volverHref && <h1 className="text-lg font-semibold">{titulo}</h1>}
            <p className="text-sm font-medium text-foreground">Disponible pronto</p>
            <p className="text-sm text-muted-foreground">
              {descripcion ?? 'Esta función estará disponible en breve. Estamos terminando de conectarla.'}
            </p>
          </div>
        </Card>
      </main>

      {conNavBar && <NavBar />}
    </>
  );
}
