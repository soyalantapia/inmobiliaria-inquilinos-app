'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  FileEdit,
  FileText,
  Plus,
  Search,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Input } from '@llave/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import { contratosMock } from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';
import type { EstadoLiquidacion } from '@/lib/types';

type Filtro = 'TODOS' | 'ACTIVO' | 'BORRADOR' | 'ARCHIVADO';

const FILTROS = [
  {
    key: 'ACTIVO' as const,
    label: 'Activos',
    descripcion: 'Contratos vigentes',
    icon: CheckCircle2,
    colorActive: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20',
    colorIdle:
      'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300',
    badgeBg: 'bg-emerald-500/20',
  },
  {
    key: 'BORRADOR' as const,
    label: 'Borradores',
    descripcion: 'Sin terminar de cargar',
    icon: FileEdit,
    colorActive: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20',
    colorIdle:
      'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300',
    badgeBg: 'bg-amber-500/20',
  },
  {
    key: 'ARCHIVADO' as const,
    label: 'Finalizados',
    descripcion: 'Cerrados o rescindidos',
    icon: Archive,
    colorActive: 'bg-slate-600 text-white border-slate-600 shadow-lg shadow-slate-600/20',
    colorIdle:
      'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-900/40 dark:bg-slate-900/10 dark:text-slate-300',
    badgeBg: 'bg-slate-500/20',
  },
] as const;

const FILTROS_LABELS: Record<Filtro, string> = {
  TODOS: 'Todos',
  ACTIVO: 'Activos',
  BORRADOR: 'Borradores',
  ARCHIVADO: 'Finalizados',
};

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

export default function ContratosPage() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  const counters = useMemo(
    () => ({
      ACTIVO: contratosMock.filter((c) => c.estado === 'ACTIVO').length,
      BORRADOR: contratosMock.filter((c) => c.estado === 'BORRADOR').length,
      ARCHIVADO: contratosMock.filter(
        (c) => c.estado === 'FINALIZADO' || c.estado === 'RESCINDIDO',
      ).length,
    }),
    [],
  );

  const filtrados = useMemo(() => {
    return contratosMock.filter((c) => {
      // filtro por estado
      if (filtro === 'ACTIVO' && c.estado !== 'ACTIVO') return false;
      if (filtro === 'BORRADOR' && c.estado !== 'BORRADOR') return false;
      if (
        filtro === 'ARCHIVADO' &&
        c.estado !== 'FINALIZADO' &&
        c.estado !== 'RESCINDIDO'
      )
        return false;

      const matchQ = q
        ? c.inquilino.toLowerCase().includes(q.toLowerCase()) ||
          c.direccion.toLowerCase().includes(q.toLowerCase())
        : true;
      return matchQ;
    });
  }, [q, filtro]);

  const togglearFiltro = (f: 'ACTIVO' | 'BORRADOR' | 'ARCHIVADO') => {
    setFiltro((prev) => (prev === f ? 'TODOS' : f));
  };

  return (
    <>
      <Topbar titulo="Contratos" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {/* 3 botones grandes de filtro */}
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
                      {f.descripcion}
                    </p>
                  </div>
                </div>
                <span className={cn('text-3xl font-bold tabular-nums', activo ? 'text-white' : '')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador + CTA */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              placeholder="Buscar por inquilino o dirección"
            />
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/contratos/nuevo">
              <Plus className="h-4 w-4" />
              Cargar contrato
            </Link>
          </Button>
        </div>

        {filtro !== 'TODOS' && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Filtrado: <strong className="text-foreground">{FILTROS_LABELS[filtro]}</strong> ·{' '}
              {filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}
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
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado contrato</TableHead>
                <TableHead>Pago actual</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.inquilino}</TableCell>
                  <TableCell className="text-muted-foreground">{c.direccion}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatFecha(c.fechaInicio)} → {formatFecha(c.fechaFin)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMonto(c.monto, c.moneda)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.estado === 'ACTIVO' ? 'success' : 'secondary'}>
                      {c.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant[c.estadoPagoActual]}>
                      {estadoLabel[c.estadoPagoActual]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/contratos/${c.id}`}
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      Ver <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="mx-auto flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p className="font-medium text-foreground">
                        {q ? `Sin resultados para "${q}"` : 'No hay contratos con ese filtro'}
                      </p>
                      <p className="text-xs">Probá ajustar la búsqueda o limpiarla.</p>
                      {(q || filtro !== 'TODOS') && (
                        <button
                          onClick={() => {
                            setQ('');
                            setFiltro('TODOS');
                          }}
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
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
