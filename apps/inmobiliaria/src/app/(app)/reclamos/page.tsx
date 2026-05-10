'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  Key,
  Plug,
  Wrench,
  Zap,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { reclamosMock } from '@/lib/mock-data';
import type { CategoriaReclamo, EstadoReclamo, Reclamo, UrgenciaReclamo } from '@/lib/types';

type FiltroEstado = 'TODOS' | EstadoReclamo;

const categoriaIcono: Record<CategoriaReclamo, React.ComponentType<{ className?: string }>> = {
  PLOMERIA: Plug,
  ELECTRICIDAD: Zap,
  CERRADURA: Key,
  CALEFACCION: Flame,
  OTRO: Wrench,
};

const categoriaLabel: Record<CategoriaReclamo, string> = {
  PLOMERIA: 'Plomería',
  ELECTRICIDAD: 'Electricidad',
  CERRADURA: 'Cerradura',
  CALEFACCION: 'Calefacción',
  OTRO: 'Otro',
};

const urgenciaConfig: Record<
  UrgenciaReclamo,
  { label: string; variant: React.ComponentProps<typeof Badge>['variant'] }
> = {
  BAJA: { label: 'Baja', variant: 'secondary' },
  MEDIA: { label: 'Media', variant: 'warning' },
  ALTA: { label: 'Alta', variant: 'warning' },
  EMERGENCIA: { label: 'Emergencia', variant: 'destructive' },
};

const estadoConfig: Record<
  EstadoReclamo,
  { label: string; variant: React.ComponentProps<typeof Badge>['variant'] }
> = {
  ABIERTO: { label: 'Abierto', variant: 'destructive' },
  EN_CURSO: { label: 'En curso', variant: 'warning' },
  RESUELTO: { label: 'Resuelto', variant: 'success' },
  CERRADO: { label: 'Cerrado', variant: 'secondary' },
};

const tabs: Array<{ value: FiltroEstado; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABIERTO', label: 'Abiertos' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'RESUELTO', label: 'Resueltos' },
];

export default function ReclamosPage() {
  const [reclamos, setReclamos] = useState<Reclamo[]>(reclamosMock);
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS');
  const [seleccionado, setSeleccionado] = useState<string | null>(reclamosMock[0]?.id ?? null);

  const filtrados = useMemo(() => {
    const ordenados = [...reclamos].sort((a, b) => {
      // emergencias arriba, después abiertos, después por fecha desc
      const urgenciaPeso = { EMERGENCIA: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };
      const estadoPeso = { ABIERTO: 3, EN_CURSO: 2, RESUELTO: 1, CERRADO: 0 };
      const score = (r: Reclamo) =>
        estadoPeso[r.estado] * 10 + urgenciaPeso[r.urgencia];
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    if (filtro === 'TODOS') return ordenados;
    return ordenados.filter((r) => r.estado === filtro);
  }, [reclamos, filtro]);

  const counters = useMemo(() => {
    return {
      ABIERTO: reclamos.filter((r) => r.estado === 'ABIERTO').length,
      EN_CURSO: reclamos.filter((r) => r.estado === 'EN_CURSO').length,
      RESUELTO: reclamos.filter((r) => r.estado === 'RESUELTO').length,
      EMERGENCIA: reclamos.filter((r) => r.urgencia === 'EMERGENCIA' && r.estado !== 'RESUELTO')
        .length,
    };
  }, [reclamos]);

  const reclamoActivo = reclamos.find((r) => r.id === seleccionado) ?? null;

  const cambiarEstado = (id: string, nuevo: EstadoReclamo, mensaje: string) => {
    setReclamos((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              estado: nuevo,
              resueltoAt: nuevo === 'RESUELTO' ? new Date().toISOString() : r.resueltoAt,
            }
          : r,
      ),
    );
    toast({ title: mensaje });
  };

  return (
    <>
      <Topbar titulo="Reclamos" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {counters.EMERGENCIA > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {counters.EMERGENCIA} reclamo{counters.EMERGENCIA === 1 ? '' : 's'} de emergencia sin resolver
                </p>
                <p className="text-xs text-muted-foreground">
                  Atendelos antes que los demás.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const count =
              t.value === 'TODOS' ? reclamos.length : counters[t.value as keyof typeof counters];
            const active = filtro === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setFiltro(t.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {t.label}
                <span className="ml-2 text-xs opacity-75">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            {filtrados.length === 0 ? (
              <EmptyState filtro={filtro} />
            ) : (
              filtrados.map((r) => {
                const Icon = categoriaIcono[r.categoria];
                const active = r.id === seleccionado;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSeleccionado(r.id)}
                    className={`block w-full rounded-lg border p-4 text-left transition-colors ${
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.inquilino}</span>
                          <Badge variant={urgenciaConfig[r.urgencia].variant}>
                            {urgenciaConfig[r.urgencia].label}
                          </Badge>
                          <Badge variant={estadoConfig[r.estado].variant}>
                            {estadoConfig[r.estado].label}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {r.descripcion}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{categoriaLabel[r.categoria]}</span>
                          <span>·</span>
                          <span>{r.direccion}</span>
                          <span>·</span>
                          <span>{tiempoRelativo(r.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="hidden lg:block">
            {reclamoActivo ? (
              <DetalleReclamo reclamo={reclamoActivo} onCambioEstado={cambiarEstado} />
            ) : (
              <Card className="grid h-full place-items-center text-center">
                <CardContent className="space-y-2 p-10 text-muted-foreground">
                  <Inbox className="mx-auto h-10 w-10" />
                  <p>Elegí un reclamo para ver el detalle.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function DetalleReclamo({
  reclamo,
  onCambioEstado,
}: {
  reclamo: Reclamo;
  onCambioEstado: (id: string, nuevo: EstadoReclamo, mensaje: string) => void;
}) {
  const Icon = categoriaIcono[reclamo.categoria];

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{reclamo.inquilino}</h2>
              <Badge variant={urgenciaConfig[reclamo.urgencia].variant}>
                {urgenciaConfig[reclamo.urgencia].label}
              </Badge>
              <Badge variant={estadoConfig[reclamo.estado].variant}>
                {estadoConfig[reclamo.estado].label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{reclamo.direccion}</p>
            <Link
              href={`/contratos/${reclamo.contratoId}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver contrato →
            </Link>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Descripción
          </p>
          <p className="text-sm">{reclamo.descripcion}</p>
        </div>

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Categoría" value={categoriaLabel[reclamo.categoria]} />
          <Field label="Recibido" value={tiempoRelativo(reclamo.createdAt)} />
          <Field
            label="Asignado a"
            value={reclamo.asignadoA ?? <span className="text-muted-foreground">Sin asignar</span>}
          />
          {reclamo.resueltoAt && (
            <Field label="Resuelto" value={tiempoRelativo(reclamo.resueltoAt)} />
          )}
        </div>

        {reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'CERRADO' && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {reclamo.estado === 'ABIERTO' && (
                <Button
                  size="sm"
                  onClick={() =>
                    onCambioEstado(reclamo.id, 'EN_CURSO', 'Reclamo asignado y en curso')
                  }
                >
                  <Clock className="h-4 w-4" />
                  Tomar y empezar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onCambioEstado(reclamo.id, 'RESUELTO', 'Reclamo marcado como resuelto')
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar como resuelto
              </Button>
              <Button size="sm" variant="ghost">
                <Check className="h-4 w-4" />
                Mensaje al inquilino
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function EmptyState({ filtro }: { filtro: FiltroEstado }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
        <Inbox className="mx-auto h-10 w-10" />
        <p className="font-medium text-foreground">
          {filtro === 'TODOS' ? 'No tenés reclamos' : `Sin reclamos ${tabFromFiltro(filtro)}`}
        </p>
        <p className="text-sm">Cuando lleguen aparecen acá.</p>
      </CardContent>
    </Card>
  );
}

function tabFromFiltro(filtro: FiltroEstado): string {
  const map: Record<FiltroEstado, string> = {
    TODOS: 'todos',
    ABIERTO: 'abiertos',
    EN_CURSO: 'en curso',
    RESUELTO: 'resueltos',
    CERRADO: 'cerrados',
  };
  return map[filtro];
}

function tiempoRelativo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMin = Math.floor((now - t) / 60000);
  if (diffMin < 1) return 'recién';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} día${diffD === 1 ? '' : 's'}`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
