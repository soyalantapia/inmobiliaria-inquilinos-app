'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardX,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Topbar } from '@/components/topbar';
import {
  type InventarioAdmin,
  contratosMock,
  inventariosMock,
  propiedadesMock,
} from '@/lib/mock-data';
import { formatFecha } from '@/lib/format';

// Listado global de inventarios cruzando todos los contratos activos.
// Por cada propiedad muestra si el inquilino lo cargó, si está firmado,
// cuántos items hay y la antigüedad de la carga. Permite al PM atacar
// los pendientes desde un solo lugar.

type EstadoFila = 'SIN_CARGAR' | 'PENDIENTE_FIRMA' | 'FIRMADO';
type Filtro = 'TODOS' | EstadoFila;

interface FilaInventario {
  propiedadId: string;
  direccion: string;
  inquilino: string;
  contratoId: string;
  inventario: InventarioAdmin | null;
  estadoFila: EstadoFila;
}

const estadoConfig: Record<
  EstadoFila,
  { label: string; badge: React.ComponentProps<typeof Badge>['variant']; icon: typeof ClipboardCheck; color: string }
> = {
  SIN_CARGAR: {
    label: 'Sin cargar',
    badge: 'outline',
    icon: ClipboardX,
    color: 'bg-muted text-muted-foreground',
  },
  PENDIENTE_FIRMA: {
    label: 'Esperando firma',
    badge: 'warning',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  FIRMADO: {
    label: 'Firmado',
    badge: 'success',
    icon: CheckCircle2,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
};

export default function InventariosPage() {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  const filas = useMemo<FilaInventario[]>(() => {
    return propiedadesMock
      .filter((p) => p.estado === 'ALQUILADA')
      .map((p) => {
        const contrato = contratosMock.find((c) => c.id === p.contratoActualId);
        if (!contrato) return null;
        const inv = inventariosMock.find((i) => i.contratoId === contrato.id) ?? null;
        let estadoFila: EstadoFila = 'SIN_CARGAR';
        if (inv) estadoFila = inv.firmadoInmobiliaria ? 'FIRMADO' : 'PENDIENTE_FIRMA';
        return {
          propiedadId: p.id,
          direccion: p.direccion,
          inquilino: contrato.inquilino,
          contratoId: contrato.id,
          inventario: inv,
          estadoFila,
        };
      })
      .filter((x): x is FilaInventario => x !== null);
  }, []);

  const filtradas = useMemo(() => {
    if (filtro === 'TODOS') return filas;
    return filas.filter((f) => f.estadoFila === filtro);
  }, [filas, filtro]);

  // KPIs
  const sinCargar = filas.filter((f) => f.estadoFila === 'SIN_CARGAR').length;
  const pendienteFirma = filas.filter((f) => f.estadoFila === 'PENDIENTE_FIRMA').length;
  const firmados = filas.filter((f) => f.estadoFila === 'FIRMADO').length;

  return (
    <>
      <Topbar titulo="Inventarios" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Operación
          </p>
          <h1 className="text-2xl font-semibold md:text-3xl">Inventarios</h1>
          <p className="text-sm text-muted-foreground">
            Estado del inventario inicial de cada propiedad — qué inquilino lo cargó, qué falta
            firmar y qué falta empezar.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Sin cargar" value={sinCargar} tone={sinCargar > 0 ? 'amber' : 'muted'} />
          <Kpi
            label="Esperando firma"
            value={pendienteFirma}
            tone={pendienteFirma > 0 ? 'amber' : 'muted'}
          />
          <Kpi label="Firmados" value={firmados} tone="emerald" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {(['TODOS', 'SIN_CARGAR', 'PENDIENTE_FIRMA', 'FIRMADO'] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filtro === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              {f === 'TODOS' ? 'Todos' : estadoConfig[f].label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtradas.length === 0 ? (
          <Card className="p-8 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">Nada para mostrar</p>
            <p className="text-xs text-muted-foreground">Probá con otro filtro.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtradas.map((f) => {
              const cfg = estadoConfig[f.estadoFila];
              const Icon = cfg.icon;
              const itemsCount = f.inventario?.items.length ?? 0;
              return (
                <Card key={f.propiedadId} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', cfg.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{f.direccion}</p>
                        <p className="truncate text-xs text-muted-foreground">{f.inquilino}</p>
                      </div>
                    </div>
                    <Badge variant={cfg.badge}>{cfg.label}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs md:grid-cols-3">
                    <Stat label="Items cargados" value={itemsCount > 0 ? String(itemsCount) : '—'} />
                    <Stat
                      label="Cargado el"
                      value={f.inventario?.cargadoAt ? formatFecha(f.inventario.cargadoAt) : '—'}
                    />
                    <Stat
                      label="Firmado el"
                      value={f.inventario?.firmadoAt ? formatFecha(f.inventario.firmadoAt) : '—'}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {f.estadoFila === 'PENDIENTE_FIRMA' && (
                      <Button size="sm">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Revisar y firmar
                      </Button>
                    )}
                    {f.estadoFila === 'SIN_CARGAR' && (
                      <p className="text-xs text-muted-foreground">
                        Pediles al inquilino que cargue el inventario por WhatsApp.
                      </p>
                    )}
                    <Button size="sm" variant="ghost" asChild className="ml-auto">
                      <Link href={`/propiedades/${f.propiedadId}`}>
                        Ir a la propiedad
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'muted';
}) {
  return (
    <Card className="p-4">
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'amber' && value > 0 && 'text-amber-600',
          tone === 'emerald' && 'text-emerald-600',
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
