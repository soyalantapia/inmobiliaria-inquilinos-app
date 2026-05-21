'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { visitaDeReclamo, type VisitaProfesional } from '@/lib/visitas-cross-app';
import { formatMonto } from '@/lib/format';

/**
 * Card que muestra el progreso de la visita del profesional al reclamo,
 * tal como la confirmó/actualizó él desde su link mágico /p/[token].
 *
 * Polls cada N segundos para que los cambios cross-app se reflejen.
 */
interface ProgresoVisitaCardProps {
  reclamoId: string;
}

const ESTADOS = ['ASIGNADO', 'CONFIRMADA', 'EN_CAMINO', 'LISTO'] as const;
type Estado = (typeof ESTADOS)[number];

const ESTADO_INFO: Record<
  Estado,
  { label: string; tono: string; icon: typeof CheckCircle2; descripcion: string }
> = {
  ASIGNADO: {
    label: 'Esperando confirmación',
    tono: 'bg-muted text-muted-foreground',
    icon: Clock,
    descripcion: 'El profesional todavía no confirmó día.',
  },
  CONFIRMADA: {
    label: 'Visita confirmada',
    tono: 'bg-primary/10 text-primary',
    icon: CalendarClock,
    descripcion: 'Tiene fecha y hora coordinada con el inquilino.',
  },
  EN_CAMINO: {
    label: 'En camino',
    tono: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: Truck,
    descripcion: 'Salió hacia la propiedad.',
  },
  LISTO: {
    label: 'Trabajo terminado',
    tono: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: CheckCircle2,
    descripcion: 'Cerró el trabajo y dejó nota + costo.',
  },
};

export function ProgresoVisitaCard({ reclamoId }: ProgresoVisitaCardProps) {
  const [visita, setVisita] = useState<VisitaProfesional | null>(null);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setHidratado(true);
    setVisita(visitaDeReclamo(reclamoId));
    // Poll cada 3 segs para reflejar updates del profesional. En backend
    // real esto sería un websocket / SSE.
    const id = setInterval(() => setVisita(visitaDeReclamo(reclamoId)), 3000);
    return () => clearInterval(id);
  }, [reclamoId]);

  if (!hidratado || !visita) return null;

  const idxActual = ESTADOS.indexOf(visita.estado);
  const info = ESTADO_INFO[visita.estado];
  const Icon = info.icon;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Progreso del trabajo
          </h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            Vivo
          </Badge>
        </div>

        {/* Stepper visual */}
        <div className="flex items-center justify-between gap-1">
          {ESTADOS.map((e, i) => {
            const Active = ESTADO_INFO[e].icon;
            const completado = i <= idxActual;
            const actual = i === idxActual;
            return (
              <div key={e} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all',
                    completado
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground',
                    actual && 'ring-2 ring-primary/30',
                  )}
                >
                  <Active className="h-3 w-3" />
                </div>
                <span
                  className={cn(
                    'text-center text-[9px] uppercase tracking-wide leading-tight',
                    completado ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {e === 'ASIGNADO' && 'Asignado'}
                  {e === 'CONFIRMADA' && 'Confirmó'}
                  {e === 'EN_CAMINO' && 'En camino'}
                  {e === 'LISTO' && 'Listo'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Detalle del paso actual */}
        <div
          className={cn(
            'flex items-start gap-2 rounded-md border p-3 text-xs',
            visita.estado === 'LISTO'
              ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
              : visita.estado === 'EN_CAMINO'
                ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10'
                : visita.estado === 'CONFIRMADA'
                  ? 'border-primary/20 bg-primary/5'
                  : 'border-border bg-muted/20',
          )}
        >
          <div className={cn('grid h-6 w-6 shrink-0 place-items-center rounded', info.tono)}>
            <Icon className="h-3 w-3" />
          </div>
          <div className="space-y-0.5">
            <p className="font-medium">{info.label}</p>
            <p className="text-muted-foreground">{info.descripcion}</p>
            {visita.fechaVisita && visita.estado !== 'LISTO' && (
              <p className="text-muted-foreground">
                Visita programada:{' '}
                <strong className="text-foreground">
                  {new Date(visita.fechaVisita).toLocaleString('es-AR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </p>
            )}
            {visita.notaFinal && (
              <p className="italic text-muted-foreground">
                &ldquo;{visita.notaFinal}&rdquo;
              </p>
            )}
            {visita.montoCobrado ? (
              <p className="font-medium">
                Costo cobrado: {formatMonto(visita.montoCobrado)}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
