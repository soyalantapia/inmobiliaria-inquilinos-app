'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { liquidacionesMock } from '@/lib/mock-data';
import { formatMonto, formatPeriodo } from '@/lib/format';

type Estado = 'redirecting' | 'simulando' | 'ok';

export default function CheckoutPage({ params }: { params: { liqId: string } }) {
  const router = useRouter();
  const liq = liquidacionesMock.find((l) => l.id === params.liqId);
  const [estado, setEstado] = useState<Estado>('redirecting');

  useEffect(() => {
    // simulación: en Sprint 3 esto pega a /api/pagos/iniciar y redirecciona a init_point de MP
    const t1 = setTimeout(() => setEstado('simulando'), 800);
    const t2 = setTimeout(() => setEstado('ok'), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!liq) {
    return (
      <main className="flex-1 px-5 py-10">
        <p>No encontramos esta liquidación.</p>
        <Button asChild className="mt-4">
          <Link href="/">Volver</Link>
        </Button>
      </main>
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Pagar</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-10 text-center">
        <Card className="w-full p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {formatPeriodo(liq.periodo)}
          </p>
          <p className="mt-1 text-3xl font-semibold">{formatMonto(liq.montoTotal, liq.moneda)}</p>
        </Card>

        {estado === 'redirecting' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Conectando con Mercado Pago…</p>
          </div>
        )}
        {estado === 'simulando' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Procesando el pago…</p>
          </div>
        )}
        {estado === 'ok' && (
          <div className="flex flex-col items-center gap-3 text-emerald-600">
            <CheckCircle2 className="h-12 w-12" />
            <p className="text-lg font-medium text-foreground">Pago confirmado</p>
            <p className="text-sm text-muted-foreground">
              Te llega el comprobante por email y WhatsApp.
            </p>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Pago intermediado por Llave + Mercado Pago
        </p>

        {estado === 'ok' && (
          <Button asChild size="xl" className="w-full">
            <Link href="/comprobantes">Ver comprobantes</Link>
          </Button>
        )}
      </main>
    </>
  );
}
