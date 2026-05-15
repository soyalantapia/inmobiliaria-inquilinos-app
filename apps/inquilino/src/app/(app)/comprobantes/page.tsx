'use client';

import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Receipt,
} from 'lucide-react';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { NavBar } from '@/components/nav-bar';
import { comprobantesMock, liquidacionesMock } from '@/lib/mock-data';
import { diasHastaVencimiento, formatFecha, formatMonto, formatPeriodo } from '@/lib/format';
import { PaymentHero } from '../payment-hero';

type DemoEstado = 'atrasado' | 'al-dia';

const metodoLabel = {
  MERCADOPAGO: 'Mercado Pago',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  CRIPTO: 'Cripto',
} as const;

export default function RecibosPage() {
  // Toggle demo replicado de la home para que se vean ambos casos también acá.
  const [demoEstado, setDemoEstado] = useState<DemoEstado>('atrasado');

  // Liquidación pendiente (la "a pagar")
  const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const pendiente = demoEstado === 'al-dia' ? null : pendienteMock;

  // Liquidaciones futuras (PENDIENTE pero con fecha > hoy y distinto de la actual)
  const proximas = useMemo(
    () =>
      liquidacionesMock.filter(
        (l) =>
          l.estado !== 'PAGADO' &&
          l.id !== pendienteMock?.id &&
          diasHastaVencimiento(l.fechaVencimiento) > 0,
      ),
    [pendienteMock],
  );

  // Años de comprobantes cobrados (más reciente primero)
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

  return (
    <>
      <header className="space-y-3 p-5">
        <div>
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">Recibos</h1>
          <p className="text-sm text-muted-foreground">
            Tus pagos: lo que tenés que pagar, lo que viene y lo que ya pagaste.
          </p>
        </div>
        <DemoSwitch estado={demoEstado} onChange={setDemoEstado} />
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6 md:px-8">
        {/* ============================================================
            A PAGAR — el pago pendiente (PaymentHero completo con desglose)
            ============================================================ */}
        {pendiente ? (
          <section className="space-y-2">
            <SectionTitle>A pagar</SectionTitle>
            <PaymentHero liq={pendiente} ajusteCritico={false} diasAjuste={0} />
          </section>
        ) : (
          <section className="space-y-2">
            <SectionTitle>Estado</SectionTitle>
            <Card className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-sm">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight text-emerald-900">
                  No tenés pagos pendientes
                </p>
                <p className="truncate text-xs text-emerald-700/80">Estás al día con tu alquiler</p>
              </div>
            </Card>
          </section>
        )}

        {/* ============================================================
            PRÓXIMOS — liquidaciones futuras
            ============================================================ */}
        {proximas.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Próximos</SectionTitle>
            <Card className="divide-y">
              {proximas.map((l) => {
                const dias = diasHastaVencimiento(l.fechaVencimiento);
                return (
                  <div key={l.id} className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">
                        {formatPeriodo(l.periodo)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Vence el {formatFecha(l.fechaVencimiento)} · en {dias} día
                        {dias === 1 ? '' : 's'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMonto(l.montoTotal, l.moneda)}
                    </p>
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        {/* ============================================================
            COBRADOS — historial de recibos pagados
            ============================================================ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Cobrados</SectionTitle>
            {delAnio.length > 0 && (
              <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Download className="h-3 w-3" />
                Descargar año
              </button>
            )}
          </div>

          {anios.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {anios.map((a) => (
                <button
                  key={a}
                  type="button"
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

          {delAnio.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-8 text-center text-muted-foreground">
                <Receipt className="mx-auto h-9 w-9" />
                <p className="font-medium text-foreground">Sin recibos en {anioSel}</p>
                <p className="text-sm">Probá otro año o esperá tu próximo pago.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="divide-y">
                {delAnio.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">
                          {formatPeriodo(c.periodo)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatFecha(c.fechaPago)} · {metodoLabel[c.metodo]}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMonto(c.monto, c.moneda)}
                      </span>
                      <a
                        href={c.pdfUrl}
                        download
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </a>
                    </div>
                  </div>
                ))}
              </Card>
              <p className="px-1 text-xs text-muted-foreground">
                Total {anioSel}:{' '}
                <strong className="text-foreground tabular-nums">{formatMonto(totalAnio)}</strong>
              </p>
            </>
          )}
        </section>
      </main>

      <NavBar />
    </>
  );
}

// ============================================================
// Helpers visuales
// ============================================================
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function DemoSwitch({
  estado,
  onChange,
}: {
  estado: DemoEstado;
  onChange: (e: DemoEstado) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 p-1 text-xs">
      <span className="pl-2 pr-1 text-[10px] font-bold uppercase tracking-wider text-primary">
        Demo
      </span>
      <div className="flex flex-1 gap-1">
        <button
          type="button"
          onClick={() => onChange('atrasado')}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            estado === 'atrasado'
              ? 'bg-white text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={estado === 'atrasado'}
        >
          Atrasado
        </button>
        <button
          type="button"
          onClick={() => onChange('al-dia')}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            estado === 'al-dia'
              ? 'bg-white text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={estado === 'al-dia'}
        >
          Al día
        </button>
      </div>
    </div>
  );
}
