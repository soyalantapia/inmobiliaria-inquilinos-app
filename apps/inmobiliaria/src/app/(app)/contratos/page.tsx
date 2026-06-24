'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronRight,
  FileEdit,
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Input } from '@llave/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import { useContratos, usePropiedades } from '@/lib/api/hooks';
import { formatMonto, formatRangoVigencia } from '@/lib/format';
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

// Variant del badge según el estado del CONTRATO (no el de pago). Antes era un
// ternario ACTIVO?success:secondary que pintaba BORRADOR/FINALIZADO/RESCINDIDO
// todos gris, inconsistente con el detalle. Espejo de contratos/[id].
const estadoContratoVariant: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  ACTIVO: 'success',
  BORRADOR: 'warning',
  FINALIZADO: 'secondary',
  RESCINDIDO: 'destructive',
};

export default function ContratosPage() {
  const { contratos, cargando } = useContratos();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  // Filtro por propietario via query string ?propietario=own_xxx
  // Linkeado desde /propietarios/[id] y /propietarios list.
  const searchParams = useSearchParams();
  const propietarioId = searchParams?.get('propietario') ?? null;
  // Datos REALES (en demo el hook cae a los mocks): antes el filtro ?propietario=
  // se armaba con propiedadesMock/propietariosMock → en prod el Set quedaba vacío y
  // la pantalla mostraba CERO contratos para ese propietario.
  const { propiedades } = usePropiedades();
  const propietario = useMemo(() => {
    if (!propietarioId) return null;
    for (const p of propiedades) {
      const m = p.propietarios.find((o) => o.id === propietarioId);
      if (m) return m;
    }
    return null;
  }, [propietarioId, propiedades]);
  // IDs de contratos (actuales) de las propiedades de este propietario.
  // Wrapped en useMemo para que la referencia sea estable y no invalide
  // el useMemo de `filtrados` en cada render.
  const contratosDelPropietario = useMemo(
    () =>
      propietarioId
        ? new Set(
            propiedades
              .filter((p) => p.propiedad.propietariosIds.includes(propietarioId))
              .map((p) => p.propiedad.contratoActualId)
              .filter((id): id is string => !!id),
          )
        : null,
    [propietarioId, propiedades],
  );

  const counters = useMemo(
    () => ({
      ACTIVO: contratos.filter((c) => c.estado === 'ACTIVO').length,
      BORRADOR: contratos.filter((c) => c.estado === 'BORRADOR').length,
      ARCHIVADO: contratos.filter(
        (c) => c.estado === 'FINALIZADO' || c.estado === 'RESCINDIDO',
      ).length,
    }),
    [contratos],
  );

  const filtrados = useMemo(() => {
    return contratos.filter((c) => {
      // filtro por propietario (vía query string)
      if (contratosDelPropietario && !contratosDelPropietario.has(c.id)) return false;

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
  }, [contratos, q, filtro, contratosDelPropietario]);

  const togglearFiltro = (f: 'ACTIVO' | 'BORRADOR' | 'ARCHIVADO') => {
    setFiltro((prev) => (prev === f ? 'TODOS' : f));
  };

  return (
    <>
      <Topbar titulo="Contratos" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {/* Banner: contratos pendientes de aprobación */}
        {(() => {
          const pendientes = contratos.filter((c) => c.pendienteAprobacion);
          if (pendientes.length === 0) return null;
          return (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {pendientes.length} contrato{pendientes.length === 1 ? '' : 's'} pendiente
                    {pendientes.length === 1 ? '' : 's'} de aprobación
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Revisá los datos cargados por el equipo y aprobá para que pasen a ACTIVO.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendientes.slice(0, 2).map((c) => (
                    <Link
                      key={c.id}
                      href={`/contratos/${c.id}`}
                      className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                    >
                      {c.inquilino} →
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          );
        })()}

        {/* Chip de filtro por propietario */}
        {propietario && (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Filtrando por propietario:</span>
            <span className="font-medium">
              {propietario.nombre} {propietario.apellido}
            </span>
            <Link
              href="/contratos"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Quitar filtro
            </Link>
          </div>
        )}

        {/* 3 botones grandes de filtro */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FILTROS.map((f) => {
            const Icon = f.icon;
            const activo = filtro === f.key;
            const count = counters[f.key];
            return (
              <button
                key={f.key}
                type="button"
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
              aria-label="Buscar contratos"
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
              type="button"
              onClick={() => setFiltro('TODOS')}
              className="font-medium text-primary hover:underline"
            >
              Mostrar todos
            </button>
          </div>
        )}

        {/* Loading: no confundir "cargando" con "no hay contratos" (antes la
            lista vacía durante la carga parecía cartera vacía). */}
        {cargando && filtrados.length === 0 && (
          <Card>
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 animate-pulse" />
              <p className="text-sm">Cargando tus contratos…</p>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {!cargando && filtrados.length === 0 && (
          <Card>
            <div className="py-12 text-center">
              <div className="mx-auto flex flex-col items-center gap-2 text-muted-foreground">
                <FileText className="h-8 w-8" />
                <p className="font-medium text-foreground">
                  {q ? `Sin resultados para "${q}"` : 'No hay contratos con ese filtro'}
                </p>
                <p className="text-xs">Probá ajustar la búsqueda o limpiarla.</p>
                {(q || filtro !== 'TODOS') && (
                  <button
                    type="button"
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
            </div>
          </Card>
        )}

        {/* Cards mobile */}
        {filtrados.length > 0 && (
          <div className="space-y-3 md:hidden">
            {filtrados.map((c) => (
              <Link key={c.id} href={`/contratos/${c.id}`} className="block">
                <Card className="space-y-3 p-4 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium leading-tight">{c.inquilino}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{c.direccion}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={estadoContratoVariant[c.estado] ?? 'secondary'}>
                        {c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}
                      </Badge>
                      <Badge variant={estadoVariant[c.estadoPagoActual]} className="text-[10px]">
                        {estadoLabel[c.estadoPagoActual]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3 border-t pt-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Vigencia
                      </p>
                      <p className="text-xs tabular-nums">
                        {formatRangoVigencia(c.fechaInicio, c.fechaFin)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Monto
                      </p>
                      <p className="text-base font-semibold tabular-nums">
                        {formatMonto(c.monto, c.moneda)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Tabla desktop */}
        {filtrados.length > 0 && (
          <Card className="hidden md:block">
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
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {formatRangoVigencia(c.fechaInicio, c.fechaFin)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMonto(c.monto, c.moneda)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoContratoVariant[c.estado] ?? 'secondary'}>
                        {c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}
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
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </>
  );
}
