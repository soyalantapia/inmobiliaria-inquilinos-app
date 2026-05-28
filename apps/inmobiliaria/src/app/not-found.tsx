import Link from 'next/link';
import { FileText, MapPin, Users } from 'lucide-react';
import { Button } from '@llave/ui/button';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-6">
        <div>
          <p className="text-6xl font-bold text-primary">404</p>
          <p className="mt-2 text-xl font-semibold">Página no encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No encontramos lo que estabas buscando.
          </p>
        </div>

        <Button asChild size="lg">
          <Link href="/">Volver al panel</Link>
        </Button>

        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-3">O ir directamente a:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contratos"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
            >
              <FileText className="h-3.5 w-3.5" />
              Contratos
            </Link>
            <Link
              href="/propiedades"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
            >
              <MapPin className="h-3.5 w-3.5" />
              Propiedades
            </Link>
            <Link
              href="/propietarios"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
            >
              <Users className="h-3.5 w-3.5" />
              Propietarios
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
