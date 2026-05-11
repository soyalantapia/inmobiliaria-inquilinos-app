import {
  CheckCircle2,
  Clock,
  FileEdit,
  MessageCircle,
  Plus,
  ShieldX,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import type { EventoReclamo, TipoEventoReclamo } from '@/lib/types';
import { tiempoRelativo } from '@/lib/reclamos-config';

const iconForTipo: Record<TipoEventoReclamo, LucideIcon> = {
  CREADO: Plus,
  ASIGNADO: UserCheck,
  EN_CURSO: Clock,
  RESUELTO: CheckCircle2,
  CERRADO: FileEdit,
  RECHAZADO: ShieldX,
  MENSAJE_INQUILINO: MessageCircle,
  MENSAJE_INMO: MessageCircle,
};

const colorForTipo: Record<TipoEventoReclamo, string> = {
  CREADO: 'bg-primary text-primary-foreground',
  ASIGNADO: 'bg-muted text-muted-foreground',
  EN_CURSO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  RESUELTO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CERRADO: 'bg-muted text-muted-foreground',
  RECHAZADO: 'bg-destructive/10 text-destructive',
  MENSAJE_INQUILINO: 'bg-secondary text-secondary-foreground',
  MENSAJE_INMO: 'bg-primary/10 text-primary',
};

const labelForTipo: Record<TipoEventoReclamo, (e: EventoReclamo) => string> = {
  CREADO: (e) => `${e.autor} creó el reclamo`,
  ASIGNADO: (e) => `Asignado a ${e.contenido ?? '—'}`,
  EN_CURSO: () => 'Tomado',
  RESUELTO: () => 'Resuelto',
  CERRADO: () => 'Cerrado',
  RECHAZADO: () => 'Rechazado',
  MENSAJE_INQUILINO: (e) => `${e.autor} (inquilino)`,
  MENSAJE_INMO: (e) => `${e.autor} (inmobiliaria)`,
};

export function ReclamoTimeline({ eventos }: { eventos: EventoReclamo[] }) {
  return (
    <ol className="space-y-4">
      {eventos.map((ev, i) => {
        const Icon = iconForTipo[ev.tipo];
        const esMensaje = ev.tipo === 'MENSAJE_INQUILINO' || ev.tipo === 'MENSAJE_INMO';
        const desdeInmo = ev.tipo === 'MENSAJE_INMO';

        return (
          <li key={ev.id} className="relative flex gap-3">
            {i < eventos.length - 1 && (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-border"
                aria-hidden
              />
            )}
            <div
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                colorForTipo[ev.tipo],
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{labelForTipo[ev.tipo](ev)}</p>
                <p className="text-[11px] text-muted-foreground">{tiempoRelativo(ev.fecha)}</p>
              </div>
              {ev.contenido && !esMensaje && ev.tipo !== 'ASIGNADO' && (
                <p className="text-sm text-muted-foreground">{ev.contenido}</p>
              )}
              {esMensaje && ev.contenido && (
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    desdeInmo
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {ev.contenido}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
