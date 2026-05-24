'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  Receipt,
  Wrench,
} from 'lucide-react';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { comprobantesMock, contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import {
  cargosExtraDelInquilino,
  totalCargosExtra,
} from '@/lib/cross-app-inmo';
import { diasHastaVencimiento, formatFecha, formatFechaCorta, formatMonto, formatPeriodo } from '@/lib/format';
import type { Comprobante, Liquidacion } from '@/lib/types';

import {
  aplicarEstadoDemo,
  useDemoEstado,
  useDemoVisible,
  type DemoEstado,
} from '@/lib/demo-estado';

// Labels cortos para los métodos de pago — entran sin truncar en filas
// estrechas. Antes "Transferencia" se cortaba a "Tra..." en 375px.
const metodoLabel = {
  MERCADOPAGO: 'MP',
  TRANSFERENCIA: 'Transf.',
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
  // Modo demo sincronizado con el resto de la app vía localStorage.
  // Solo se muestra el switcher si el flag demo-visible está activo (?demo=1).
  const [demoEstado, setDemoEstado] = useDemoEstado();
  const demoVisible = useDemoVisible();

  // Cargos USO_Y_GOCE que el inmo asignó al inquilino desde reclamos
  // resueltos. Vienen cross-app del storage del inmo — los hidratamos
  // post-mount para evitar mismatch con el HTML de SSR.
  const [cargosExtra, setCargosExtra] = useState<ReturnType<typeof cargosExtraDelInquilino>>([]);
  const [totalExtra, setTotalExtra] = useState(0);
  useEffect(() => {
    setCargosExtra(cargosExtraDelInquilino(contratoMock.id));
    setTotalExtra(totalCargosExtra(contratoMock.id));
  }, []);

  // Pago pendiente del mock. El modo demo decide cómo se muestra:
  // atrasado, a tiempo (fecha futura), o al día (null).
  const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const pendiente = aplicarEstadoDemo(demoEstado, pendienteMock);

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

  // El pago urgente (atrasado/a-pagar) se saca del listado y va arriba
  // como card destacada con desglose. Antes vivía como una fila más entre
  // los cobrados — el inquilino con deuda no veía la urgencia a simple vista.
  const pagoUrgente: Movimiento | null = useMemo(() => {
    if (!pendiente) return null;
    const calc = calcularPunitorios(pendiente, TASA_PUNITORIA_DIARIA_DEFAULT);
    return {
      kind: calc.diasAtraso > 0 ? 'atrasado' : 'a-pagar',
      liq: pendiente,
    };
  }, [pendiente]);

  // Lista de movimientos = próximos + cobrados (sin el urgente).
  const movimientos: Movimiento[] = useMemo(() => {
    const items: Movimiento[] = [];
    proximas.forEach((l) => items.push({ kind: 'proximo', liq: l }));
    cobradosDelAnio.forEach((c) => items.push({ kind: 'cobrado', comp: c }));
    return items;
  }, [proximas, cobradosDelAnio]);

  // Total cobrado en el año seleccionado — para el footer del listado.
  const totalCobradoAnio = useMemo(
    () => cobradosDelAnio.reduce((acc, c) => acc + c.monto, 0),
    [cobradosDelAnio],
  );

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
            {totalExtra > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
                <Wrench className="h-3 w-3" />
                + {formatMonto(totalExtra)} en cargos extra este mes
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Título y demo toggle debajo del precio */}
      <header className="space-y-3 px-5 pb-1 pt-5 md:px-8">
        <div>
          <h1 className="text-xl font-semibold leading-tight md:text-2xl">Recibos</h1>
          <p className="text-sm text-muted-foreground">
            Pendientes, próximos y cobrados.
          </p>
        </div>
        {demoVisible && (
          <DemoSwitch estado={demoEstado} onChange={setDemoEstado} />
        )}
      </header>

      <main className="flex-1 space-y-4 px-5 pb-6 md:px-8">
        {/* Card destacada del pago urgente: aparece arriba con desglose
            (alquiler + punitorios) y CTA Regularizar/Pagar prominente. */}
        {pagoUrgente && <PagoUrgenteCard mov={pagoUrgente} />}

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

        {/* CARGOS EXTRA — reparaciones USO_Y_GOCE que el inquilino debe pagar */}
        {cargosExtra.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wrench className="h-3 w-3 text-amber-600" />
                Cargos extra del mes
              </h2>
              <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                + {formatMonto(totalExtra)}
              </span>
            </div>
            <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
              <CardContent className="space-y-2 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Reparaciones por uso normal de la propiedad. Se suman a tu
                  próximo pago.
                </p>
                <div className="divide-y divide-amber-200/60 dark:divide-amber-900/30">
                  {cargosExtra.map((c) => (
                    <div
                      key={c.reclamoId}
                      className="flex items-start gap-3 py-2"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Wrench className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-1 text-sm font-medium">
                          {c.descripcion}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.profesional ? `${c.profesional} · ` : ''}
                          {formatFecha(c.fechaResolucion)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                        + {formatMonto(c.monto)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* LISTA UNIFICADA de movimientos */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Movimientos
            </h2>
            <button
              type="button"
              onClick={() =>
                toast({
                  title: 'Preparando descarga…',
                  description: `Estamos generando el ZIP con los recibos. Te lo enviamos por mail en unos segundos.`,
                })
              }
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              Descargar PDFs del año
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

          {/* Footer con total cobrado del año seleccionado. Aporta una métrica
              útil ("cuánto pagué en 2026") sin saturar — solo si hay >=2 cobrados. */}
          {cobradosDelAnio.length >= 2 && (
            <div className="flex items-center justify-between px-2 pt-1 text-xs">
              <span className="text-muted-foreground">
                Pagaste en {anioSel}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMonto(totalCobradoAnio)}
              </span>
            </div>
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
            Vence el {formatFechaCorta(mov.liq.fechaVencimiento)} · en {dias} día
            {dias === 1 ? '' : 's'}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
          {formatMonto(mov.liq.montoTotal, mov.liq.moneda)}
        </p>
      </div>
    );
  }

  // cobrado: agregamos badge sutil "Pagado" además del icono check verde,
  // así no se confía solo en interpretar el icono visualmente.
  const c = mov.comp;
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium leading-tight">
          {formatPeriodo(c.periodo)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="mr-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Pagado
          </span>
          {formatFechaCorta(c.fechaPago)} · {metodoLabel[c.metodo]}
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

// ============================================================
// PagoUrgenteCard — card destacada arriba con desglose
// ============================================================
// Antes el pago atrasado/a-pagar vivía como una fila más en la lista de
// movimientos. Ahora va arriba como card destacada con el desglose
// (alquiler + punitorios) visible — para que el inquilino entienda por qué
// el total a pagar es mayor al alquiler vigente.
function PagoUrgenteCard({ mov }: { mov: Movimiento }) {
  if (mov.kind !== 'atrasado' && mov.kind !== 'a-pagar') return null;
  const calc = calcularPunitorios(mov.liq, TASA_PUNITORIA_DIARIA_DEFAULT);
  const diasV = diasHastaVencimiento(mov.liq.fechaVencimiento);
  const vencido = mov.kind === 'atrasado';
  const hayPunitorios = calc.punitorioAcumulado > 0;

  return (
    <Card
      className={cn(
        'overflow-hidden border-2',
        vencido
          ? 'border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
          : 'border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
      )}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
              vencido
                ? 'bg-red-500 text-white'
                : 'bg-amber-500 text-white',
            )}
          >
            {vencido ? (
              <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />
            ) : (
              <CalendarClock className="h-5 w-5" strokeWidth={2.5} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {vencido ? 'Pago atrasado' : 'Próximo pago'} ·{' '}
              {formatPeriodo(mov.liq.periodo)}
            </p>
            <p
              className={cn(
                'text-xs',
                vencido
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-muted-foreground',
              )}
            >
              {vencido
                ? `Venció hace ${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} · ${formatFechaCorta(mov.liq.fechaVencimiento)}`
                : diasV === 0
                  ? `Vence hoy · ${formatFechaCorta(mov.liq.fechaVencimiento)}`
                  : `Vence en ${diasV} día${diasV === 1 ? '' : 's'} · ${formatFechaCorta(mov.liq.fechaVencimiento)}`}
            </p>
          </div>
        </div>

        {/* Desglose: el total a pagar = alquiler + (expensas) + punitorios.
            Antes solo se mostraba el total, lo que generaba la pregunta
            "¿por qué pago más que mi alquiler vigente?". */}
        <div className="space-y-1.5 rounded-md border bg-background/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Alquiler</span>
            <span className="font-medium tabular-nums">
              {formatMonto(mov.liq.montoAlquiler, mov.liq.moneda)}
            </span>
          </div>
          {mov.liq.montoExpensas ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expensas</span>
              <span className="font-medium tabular-nums">
                {formatMonto(mov.liq.montoExpensas, mov.liq.moneda)}
              </span>
            </div>
          ) : null}
          {hayPunitorios && (
            <div className="flex items-center justify-between">
              <span className="text-red-700 dark:text-red-300">
                Punitorios ({calc.diasAtraso} día{calc.diasAtraso === 1 ? '' : 's'})
              </span>
              <span className="font-medium tabular-nums text-red-700 dark:text-red-300">
                + {formatMonto(calc.punitorioAcumulado, mov.liq.moneda)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between border-t pt-2">
            <span className="text-sm font-semibold">Total a pagar</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMonto(calc.totalAPagar, mov.liq.moneda)}
            </span>
          </div>
        </div>

        <Link
          href={`/pago/${mov.liq.id}`}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
            vencido
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {vencido ? 'Regularizar pago' : 'Pagar ahora'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
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
