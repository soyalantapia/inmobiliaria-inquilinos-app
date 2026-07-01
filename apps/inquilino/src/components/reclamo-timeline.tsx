import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FileEdit,
  MessageCircle,
  Plus,
  ShieldX,
  Truck,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import type { EventoReclamo, TipoEvento } from '@/lib/types';
import { tiempoRelativo } from '@/lib/reclamos-config';
import { urlDeArchivo } from '@/lib/api/client';

const esImagen = (url: string) => /\.(jpe?g|png|webp|gif|heic)$/i.test(url);

const iconForTipo: Record<TipoEvento, LucideIcon> = {
  CREADO: Plus,
  ASIGNADO: UserCheck,
  EN_CURSO: Clock,
  RESUELTO: CheckCircle2,
  CERRADO: FileEdit,
  RECHAZADO: ShieldX,
  MENSAJE_INQUILINO: MessageCircle,
  MENSAJE_INMO: MessageCircle,
  VISITA_CONFIRMADA: CalendarClock,
  VISITA_EN_CAMINO: Truck,
  VISITA_LISTO: CheckCircle2,
};

const colorForTipo: Record<TipoEvento, string> = {
  CREADO: 'bg-primary text-primary-foreground',
  ASIGNADO: 'bg-muted text-muted-foreground',
  EN_CURSO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  RESUELTO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CERRADO: 'bg-muted text-muted-foreground',
  RECHAZADO: 'bg-destructive/10 text-destructive',
  MENSAJE_INQUILINO: 'bg-secondary text-secondary-foreground',
  MENSAJE_INMO: 'bg-primary/10 text-primary',
  VISITA_CONFIRMADA: 'bg-primary/10 text-primary',
  VISITA_EN_CAMINO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VISITA_LISTO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const labelForTipo: Record<TipoEvento, (e: EventoReclamo) => string> = {
  CREADO: () => 'Reclamo creado',
  ASIGNADO: (e) => `Asignado a ${e.contenido ?? '—'}`,
  EN_CURSO: () => 'Tomado por la inmobiliaria',
  RESUELTO: () => 'Marcado como resuelto',
  CERRADO: () => 'Reclamo cerrado',
  RECHAZADO: () => 'Reclamo rechazado',
  MENSAJE_INQUILINO: (e) => e.autor,
  MENSAJE_INMO: (e) => e.autor,
  VISITA_CONFIRMADA: (e) => `${e.autor} confirmó visita`,
  VISITA_EN_CAMINO: (e) => `${e.autor} está en camino`,
  VISITA_LISTO: (e) => `${e.autor} terminó el trabajo`,
};

export function ReclamoTimeline({
  eventos,
  inquilinoNombre,
}: {
  eventos: EventoReclamo[];
  inquilinoNombre: string;
}) {
  return (
    <ol role="list" className="space-y-4">
      {eventos.map((ev, i) => {
        const Icon = iconForTipo[ev.tipo];
        const esMensaje = ev.tipo === 'MENSAJE_INQUILINO' || ev.tipo === 'MENSAJE_INMO';
        const esPropio = ev.tipo === 'MENSAJE_INQUILINO' && ev.autor === inquilinoNombre;

        return (
          <li key={ev.id} className="relative flex gap-3">
            {/* línea vertical conectora */}
            {i < eventos.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-border" aria-hidden />
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
              {esMensaje && (ev.contenido || ev.adjuntoUrl) && (
                <div
                  className={cn(
                    'space-y-2 rounded-lg px-3 py-2 text-sm',
                    esPropio
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {ev.contenido && <p className="whitespace-pre-wrap break-words">{ev.contenido}</p>}
                  {ev.adjuntoUrl &&
                    (esImagen(ev.adjuntoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={urlDeArchivo(ev.adjuntoUrl)}
                        alt="Adjunto del mensaje"
                        className="max-h-60 w-full rounded object-contain"
                      />
                    ) : (
                      <a
                        href={urlDeArchivo(ev.adjuntoUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline"
                      >
                        Ver archivo adjunto
                      </a>
                    ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
