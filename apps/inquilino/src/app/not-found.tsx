'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';

export default function NotFound() {
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const esCertificado = pathname.startsWith('/verificar/');
  const esGarante = pathname.startsWith('/garantes/');

  if (esCertificado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Certificado no válido</h1>
            <p className="text-sm text-muted-foreground">
              Este link no corresponde a ningún certificado activo.
            </p>
          </div>
          <Card className="text-left">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="font-medium">Puede deberse a que:</p>
              <ul role="list" className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-amber-600">·</span>
                  El certificado fue regenerado y este link quedó obsoleto.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-amber-600">·</span>
                  El link fue copiado incompleto o con caracteres de más.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-amber-600">·</span>
                  El inquilino revocó el acceso al certificado.
                </li>
              </ul>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Pedile al inquilino que te reenvíe el link desde{' '}
            <strong>Mi certificado</strong> en My Alquiler.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <RefreshCw className="h-3.5 w-3.5" />
              Ir a My Alquiler
            </Link>
          </Button>
          <p className="text-[10px] text-muted-foreground">My Alquiler · myalquiler.com.ar</p>
        </div>
      </main>
    );
  }

  if (esGarante) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Link vencido o inválido</h1>
            <p className="text-sm text-muted-foreground">
              Este link de consulta de garantía ya no es válido.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Pedile al inquilino que genere un nuevo link desde{' '}
            <strong>Mi contrato</strong> en My Alquiler.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <RefreshCw className="h-3.5 w-3.5" />
              Ir a My Alquiler
            </Link>
          </Button>
        </div>
      </main>
    );
  }

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
