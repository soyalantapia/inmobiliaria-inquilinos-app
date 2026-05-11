'use client';

import { useMemo, useState } from 'react';
import { Download, Receipt, Wallet } from 'lucide-react';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { NavBar } from '@/components/nav-bar';
import { ResumenAnual } from '@/components/resumen-anual';
import { comprobantesMock } from '@/lib/mock-data';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';

const metodoLabel = {
  MERCADOPAGO: 'Mercado Pago',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  CRIPTO: 'Cripto',
} as const;

export default function ComprobantesPage() {
  // años disponibles (más reciente primero)
  const anios = useMemo(() => {
    const set = new Set(comprobantesMock.map((c) => Number(c.periodo.split('-')[0])));
    return Array.from(set).sort((a, b) => b - a);
  }, []);

  const [anioSel, setAnioSel] = useState<number>(anios[0] ?? new Date().getFullYear());

  const delAnio = useMemo(
    () => comprobantesMock.filter((c) => c.periodo.startsWith(String(anioSel))),
    [anioSel],
  );

  const totalAnio = useMemo(() => delAnio.reduce((acc, c) => acc + c.monto, 0), [delAnio]);
  const promedio = delAnio.length > 0 ? Math.round(totalAnio / delAnio.length) : 0;

  return (
    <>
      <header className="p-5">
        <h1 className="text-2xl font-semibold md:text-3xl">Comprobantes</h1>
        <p className="text-sm text-muted-foreground">Tu historial de pagos.</p>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        {/* Total anual hero */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-xl shadow-primary/20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] opacity-80">
              <Wallet className="h-3.5 w-3.5" />
              Pagaste en {anioSel}
            </div>
            <p className="text-4xl font-bold leading-none tracking-tight tabular-nums md:text-5xl">
              {formatMonto(totalAnio)}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs opacity-90">
              <span>
                {delAnio.length} pago{delAnio.length === 1 ? '' : 's'}
              </span>
              {delAnio.length > 0 && (
                <>
                  <span>·</span>
                  <span>Promedio {formatMonto(promedio)}/mes</span>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Resumen anual con gráfico */}
        {delAnio.length > 0 && <ResumenAnual anio={anioSel} />}

        {/* Pill buttons de año */}
        {anios.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {anios.map((a) => (
              <button
                key={a}
                onClick={() => setAnioSel(a)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  a === anioSel
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {delAnio.length} comprobante{delAnio.length === 1 ? '' : 's'}
            </h2>
            {delAnio.length > 0 && (
              <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Download className="h-3 w-3" />
                Descargar todos
              </button>
            )}
          </div>

          {delAnio.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
                <Receipt className="mx-auto h-10 w-10" />
                <p className="font-medium text-foreground">Sin comprobantes en {anioSel}</p>
                <p className="text-sm">Probá otro año o esperá tu próximo pago.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y">
              {delAnio.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{formatPeriodo(c.periodo)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatFecha(c.fechaPago)} · {metodoLabel[c.metodo]}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">
                      {formatMonto(c.monto, c.moneda)}
                    </span>
                    <a
                      href={c.pdfUrl}
                      download
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </a>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      </main>

      <NavBar />
    </>
  );
}
