'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CheckCircle2, Clock, Download } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import { contratosMock } from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';
import type { EstadoLiquidacion } from '@/lib/types';

type Filtro = 'TODOS' | 'VENCIDO' | 'PENDIENTE' | 'PAGADO';

const estadoVariant: Record<EstadoLiquidacion, React.ComponentProps<typeof Badge>['variant']> = {
  PENDIENTE: 'warning',
  PAGADO: 'success',
  PARCIAL: 'warning',
  VENCIDO: 'destructive',
};

const estadoLabel: Record<EstadoLiquidacion, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  PARCIAL: 'Parcial',
  VENCIDO: 'Vencido',
};

// Configuración de los 3 botones de filtro grandes.
const FILTROS = [
  {
    key: 'VENCIDO' as const,
    label: 'Vencidos',
    icon: AlertTriangle,
    colorActive: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20',
    colorIdle:
      'border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:border-red-300 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300',
    badgeBg: 'bg-red-500/20',
  },
  {
    key: 'PENDIENTE' as const,
    label: 'Pendientes',
    icon: Clock,
    colorActive: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20',
    colorIdle:
      'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300',
    badgeBg: 'bg-amber-500/20',
  },
  {
    key: 'PAGADO' as const,
    label: 'Pagados',
    icon: CheckCircle2,
    colorActive: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20',
    colorIdle:
      'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300',
    badgeBg: 'bg-emerald-500/20',
  },
] as const;

export default function PagosPage() {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  const counters = useMemo(
    () => ({
      VENCIDO: contratosMock.filter((c) => c.estadoPagoActual === 'VENCIDO').length,
      PENDIENTE: contratosMock.filter((c) => c.estadoPagoActual === 'PENDIENTE').length,
      PAGADO: contratosMock.filter((c) => c.estadoPagoActual === 'PAGADO').length,
    }),
    [],
  );

  const totalCobrado = useMemo(
    () =>
      contratosMock
        .filter((c) => c.estadoPagoActual === 'PAGADO')
        .reduce((acc, c) => acc + c.monto, 0),
    [],
  );
  const totalPendiente = useMemo(
    () =>
      contratosMock
        .filter((c) => c.estadoPagoActual !== 'PAGADO')
        .reduce((acc, c) => acc + c.monto, 0),
    [],
  );

  const filtradas = useMemo(() => {
    if (filtro === 'TODOS') return contratosMock;
    return contratosMock.filter((c) => c.estadoPagoActual === filtro);
  }, [filtro]);

  const togglearFiltro = (f: 'VENCIDO' | 'PENDIENTE' | 'PAGADO') => {
    setFiltro((prev) => (prev === f ? 'TODOS' : f));
  };

  return (
    <>
      <Topbar titulo="Pagos del mes" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* 2 stats GRANDES: montos cobrado y pendiente */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Cobrado</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-700 tabular-nums dark:text-emerald-300 md:text-4xl">
                {formatMonto(totalCobrado)}
              </p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
                {counters.PAGADO} propiedad{counters.PAGADO === 1 ? '' : 'es'} al día este mes
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Clock className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Pendiente</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-700 tabular-nums dark:text-amber-300 md:text-4xl">
                {formatMonto(totalPendiente)}
              </p>
              <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                Suma de alquileres no cobrados todavía
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 3 stats chicas: cantidad de propiedades por estado */}
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniStat
            label="En mora"
            valor={counters.VENCIDO}
            sufijo="propiedad"
            sufijoPlural="propiedades"
            icon={AlertTriangle}
            tone="red"
          />
          <MiniStat
            label="Pendientes"
            valor={counters.PENDIENTE}
            sufijo="propiedad"
            sufijoPlural="propiedades"
            icon={Clock}
            tone="amber"
          />
          <MiniStat
            label="Pagados"
            valor={counters.PAGADO}
            sufijo="propiedad"
            sufijoPlural="propiedades"
            icon={CheckCircle2}
            tone="emerald"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Liquidaciones — mayo 2026</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm">
              <Bell className="h-4 w-4" />
              Recordar a morosos
            </Button>
          </div>
        </div>

        {/* 3 botones grandes de filtro, ocupan de punta a punta */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FILTROS.map((f) => {
            const Icon = f.icon;
            const activo = filtro === f.key;
            const count = counters[f.key];
            return (
              <button
                key={f.key}
                onClick={() => togglearFiltro(f.key)}
                aria-pressed={activo}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-all duration-200',
                  activo ? f.colorActive : f.colorIdle,
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                      activo ? 'bg-white/20' : f.badgeBg,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide">{f.label}</p>
                    <p className={cn('text-xs', activo ? 'opacity-90' : 'opacity-70')}>
                      {count} contrato{count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    activo ? 'text-white' : '',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filtro !== 'TODOS' && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Filtrado: <strong className="text-foreground">{estadoLabel[filtro]}</strong> ·{' '}
              {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setFiltro('TODOS')}
              className="font-medium text-primary hover:underline"
            >
              Mostrar todos
            </button>
          </div>
        )}

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.inquilino}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.direccion}</TableCell>
                  <TableCell className="text-sm">{formatFecha(c.proximoVencimiento)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMonto(c.monto, c.moneda)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant[c.estadoPagoActual]}>
                      {estadoLabel[c.estadoPagoActual]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <Link href={`/contratos/${c.id}`} className="text-primary hover:underline">
                      Ver contrato
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay contratos {estadoLabel[filtro as EstadoLiquidacion].toLowerCase()}s en
                    este momento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </>
  );
}

function MiniStat({
  label,
  valor,
  sufijo,
  sufijoPlural,
  icon: Icon,
  tone,
}: {
  label: string;
  valor: number;
  sufijo: string;
  sufijoPlural: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'red' | 'amber' | 'emerald';
}) {
  const toneClass = {
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('text-2xl font-semibold tabular-nums', toneClass)}>{valor}</p>
          <p className="text-xs text-muted-foreground">
            {valor === 1 ? sufijo : sufijoPlural}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
