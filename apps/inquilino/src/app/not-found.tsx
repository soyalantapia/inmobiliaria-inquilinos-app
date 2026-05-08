import Link from 'next/link';
import { Button } from '@llave/ui/button';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="mt-2 text-muted-foreground">No encontramos esta página.</p>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
