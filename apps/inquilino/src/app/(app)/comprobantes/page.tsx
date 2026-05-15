'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  Receipt,
} from 'lucide-react';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { NavBar } from '@/components/nav-bar';
import { comprobantesMock, contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import { diasHastaVencimiento, formatFecha, formatMonto, formatPeriodo } from '@/lib/format';
import type { Comprobante, Liquidacion } from '@/lib/types';

type DemoEstado = 'al-dia' | 'a-tiempo' | 'atrasado';

// Genera la liquidación pendiente correspondiente al modo demo.
// - 'al-dia': null (no hay nada que pagar)
// - 'atrasado': la liquidación original (con fecha pasada → diasAtraso > 0)
// - 'a-tiempo': clonamos la liquidación pero con fecha de vencimiento futura
//   para que no aparezca como vencida, y el inquilino pueda "pagar y quedar al día"
function getDemoPendiente(
  estado: DemoEstado,
  base: Liquidacion | undefined,
): Liquidacion | null {
  if (estado === 'al-dia' || !base) return null;
  if (estado === 'atrasado') return base;
  // 'a-tiempo': vencimiento en 5 días desde hoy
  const hoy = new Date();
  const venc = new Date(hoy);
  venc.setDate(hoy.getDate() + 5);
  return {
    ...base,
    fechaVencimiento: venc.toISOString().slice(0, 10),
    montoPunitorio: 0,
    montoTotal: base.montoAlquiler + (base.montoExpensas ?? 0),
    estado: 'PENDIENTE',
  };
}

const metodoLabel = {
  MERCADOPAGO: 'Mercado Pago',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  CRIPTO: 'Cripto',
} as const;

// Cada fila de la lista unificada es un movimiento de uno de estos tipos.
type Movimiento =
  | { kind: 'atrasado'; liq: Liquidacion }
  | { kind: 'a-pagar'; liq: Liquidacion }
  | { kind: 'proximo'; liq: Liquidacion }
  | { kind: 'cobrado'; comp: Comprobante };

export default function RecibosPage() {
  const [demoEstado, setDemoEstado] = useState<DemoEstado>('atrasado');

  // Pago pendiente del mock (real). El modo demo decide si lo mostramos como
  // atrasado, a tiempo (fecha futura), o al día (null).
  const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const pendiente = getDemoPendiente(demoEstado, pendienteMock);

  // Liquidaciones futuras (no la actual, con fecha > hoy)
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

  // Filtro por año para los cobrados
  const anios = useMemo(() => {
    const set = new Set(comprobantesMock.map((c) => Number(c.periodo.split('-')[0])));
    return Array.from(set).sort((a, b) => b - a);
  }, []);
  const [anioSel, setAnioSel] = useState<number>(anios[0] ?? new Date().getFullYear());
  const cobradosDelAnio = useMemo(
    () =>
      [...comprobantesMock.filter((c) => c.periodo.startsWith(String(anioSel)))].sort((a, b) =>
        b.periodo.localeCompare(a.periodo),
      ),
    [anioSel],
  );

  // Lista unificada de movimientos. El kind se decide por dias de atraso real:
  //   diasAtraso > 0 → "atrasado" (rojo, botón Regularizar)
  //   diasAtraso = 0 → "a-pagar" (ámbar, botón Pagar — caso "a tiempo")
  const movimientos: Movimiento[] = useMemo(() => {
    const items: Movimiento[] = [];
    if (pendiente) {
      const calc = calcularPunitorios(pendiente, TASA_PUNITORIA_DIARIA_DEFAULT);
      items.push({
        kind: calc.diasAtraso > 0 ? 'atrasado' : 'a-pagar',
        liq: pendiente,
      });
    }
    proximas.forEach((l) => items.push({ kind: 'proximo', liq: l }));
    cobradosDelAnio.forEach((c) => items.push({ kind: 'cobrado', comp: c }));
    return items;
  }, [pendiente, proximas, cobradosDelAnio]);

  return (
    <>
      {/* PRECIO MENSUAL arriba de todo — primera cosa que ve el inquilino */}
      <div className="px-5 pt-5 md:px-8">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-xl shadow-primary/20 md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
          <div className="relative space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-80">
              Tu alquiler vigente
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold leading-none tracking-tight tabular-nums md:text-5xl">
                {formatMonto(contratoMock.montoActual, contratoMock.moneda)}
              </p>
              <span className="text-base font-medium opacity-85">/ mes</span>
            </div>
            <p className="text-xs opacity-85">
              Pagás el día {contratoMock.diaPago} de cada mes · {contratoMock.inmobiliaria}
            </p>
          </div>
        </Card>
      </div>

      {/* Título y demo toggle debajo del precio */}
      <header className="space-y-3 px-5 pb-1 pt-5 md:px-8">
        <div>
          <h1 className="text-xl font-semibold leading-tight md:text-2xl">Recibos</h1>
          <p className="text-sm text-muted-foreground">
            Tus pagos pendientes, los próximos y los cobrados.
          </p>
        </div>
        <DemoSwitch estado={demoEstado} onChange={setDemoEstado} />
      </header>

      <main className="flex-1 space-y-4 px-5 pb-6 md:px-8">
        {/* FILTRO por año (solo si hay cobrados de varios años) */}
        {anios.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {anios.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAnioSel(a)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
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

        {/* LISTA UNIFICADA de movimientos */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Movimientos
            </h2>
            <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Download className="h-3 w-3" />
              Descargar año
            </button>
          </div>

          {movimientos.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-8 text-center text-muted-foreground">
                <Receipt className="mx-auto h-9 w-9" />
                <p className="font-medium text-foreground">Sin movimientos</p>
                <p className="text-sm">Probá otro año o esperá tu próximo pago.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y">
              {movimientos.map((m) => (
                <MovimientoRow key={keyForMovimiento(m)} mov={m} />
              ))}
            </Card>
          )}
        </section>
      </main>

      <NavBar />
    </>
  );
}

// ============================================================
// MovimientoRow: una fila con icono, título, sub, monto y acción
// ============================================================
function MovimientoRow({ mov }: { mov: Movimiento }) {
  if (mov.kind === 'atrasado' || mov.kind === 'a-pagar') {
    const calc = calcularPunitorios(mov.liq, TASA_PUNITORIA_DIARIA_DEFAULT);
    const diasV = diasHastaVencimiento(mov.liq.fechaVencimiento);
    const vencido = mov.kind === 'atrasado';

    return (
      <div className="flex items-center gap-3 p-4">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            vencido ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {vencido ? <AlertTriangle className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {formatPeriodo(mov.liq.periodo)}
          </p>
          <p
            className={`truncate text-xs ${
              vencido ? 'text-red-600 font-medium' : 'text-muted-foreground'
            }`}
          >
            {vencido
              ? `${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} de atraso`
              : diasV === 0
                ? 'Vence hoy'
                : `Vence en ${diasV} día${diasV === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="text-sm font-semibold tabular-nums">
            {formatMonto(calc.totalAPagar, mov.liq.moneda)}
          </p>
          <Link
            href={`/pago/${mov.liq.id}`}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              vencido
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {vencido ? 'Regularizar' : 'Pagar'}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  if (mov.kind === 'proximo') {
    const dias = diasHastaVencimiento(mov.liq.fechaVencimiento);
    return (
      <div className="flex items-center gap-3 p-4 opacity-90">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {formatPeriodo(mov.liq.periodo)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Vence el {formatFecha(mov.liq.fechaVencimiento)} · en {dias} día
            {dias === 1 ? '' : 's'}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
          {formatMonto(mov.liq.montoTotal, mov.liq.moneda)}
        </p>
      </div>
    );
  }

  // cobrado
  const c = mov.comp;
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{formatPeriodo(c.periodo)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatFecha(c.fechaPago)} · {metodoLabel[c.metodo]}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-sm font-semibold tabular-nums">{formatMonto(c.monto, c.moneda)}</p>
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
  );
}

function keyForMovimiento(m: Movimiento): string {
  if (m.kind === 'cobrado') return `c:${m.comp.id}`;
  return `${m.kind}:${m.liq.id}`;
}

// ============================================================
// Selector demo
// ============================================================
function DemoSwitch({
  estado,
  onChange,
}: {
  estado: DemoEstado;
  onChange: (e: DemoEstado) => void;
}) {
  const opciones: { value: DemoEstado; label: string }[] = [
    { value: 'al-dia', label: 'Al día' },
    { value: 'a-tiempo', label: 'A tiempo' },
    { value: 'atrasado', label: 'Retrasado' },
  ];
  return (
    <div className="flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 p-1 text-xs">
      <span className="pl-2 pr-1 text-[10px] font-bold uppercase tracking-wider text-primary">
        Demo
      </span>
      <div className="flex flex-1 gap-1">
        {opciones.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              estado === op.value
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={estado === op.value}
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}
