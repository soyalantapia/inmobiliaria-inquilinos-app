import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  FileEdit,
  HardHat,
  MessageCircle,
  Plus,
  ShieldX,
  Tag,
  Truck,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import type { EventoReclamo, TipoEventoReclamo } from '@/lib/types';
import { tiempoRelativo } from '@/lib/reclamos-config';
import { urlDeArchivo } from '@/lib/api/client';

const esImagen = (url: string) => /\.(jpe?g|png|webp|gif|heic)$/i.test(url);

const iconForTipo: Record<TipoEventoReclamo, LucideIcon> = {
  CREADO: Plus,
  ASIGNADO: UserCheck,
  EN_CURSO: Clock,
  RESUELTO: CheckCircle2,
  CERRADO: FileEdit,
  RECHAZADO: ShieldX,
  MENSAJE_INQUILINO: MessageCircle,
  MENSAJE_INMO: MessageCircle,
  CLASIFICADO: Tag,
  PROFESIONAL_ASIGNADO: HardHat,
  VISITA_CONFIRMADA: CalendarClock,
  VISITA_EN_CAMINO: Truck,
  VISITA_LISTO: CheckCircle2,
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
  CLASIFICADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PROFESIONAL_ASIGNADO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VISITA_CONFIRMADA: 'bg-primary/10 text-primary',
  VISITA_EN_CAMINO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  VISITA_LISTO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
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
  CLASIFICADO: (e) => `Clasificado como ${e.contenido ?? '—'}`,
  PROFESIONAL_ASIGNADO: (e) => `Profesional asignado: ${e.contenido ?? '—'}`,
  // Los escribe el profesional desde el link público, sin cuenta en el sistema.
  VISITA_CONFIRMADA: (e) => `${e.autor} confirmó la visita`,
  VISITA_EN_CAMINO: (e) => `${e.autor} está en camino`,
  VISITA_LISTO: (e) => `${e.autor} terminó el trabajo`,
};

export function ReclamoTimeline({ eventos }: { eventos: EventoReclamo[] }) {
  return (
    <ol role="list" className="space-y-4">
      {eventos.map((ev, i) => {
        // Los tres lookups con fallback. La segunda línea de defensa: la primera es el test
        // que compara `TipoEventoReclamo` contra el enum de Prisma, pero eso no cubre el rato
        // entre que se despliega la API y se despliega el front — en ese rato la base ya tiene
        // eventos que este código no conoce. Antes eso era `undefined(ev)` y la pantalla se
        // caía entera; ahora es un renglón sin gracia. Degradar se banca, caerse no.
        const Icon = iconForTipo[ev.tipo] ?? Circle;
        const color = colorForTipo[ev.tipo] ?? 'bg-muted text-muted-foreground';
        const label = labelForTipo[ev.tipo]?.(ev) ?? 'Actualización del reclamo';
        const esMensaje = ev.tipo === 'MENSAJE_INQUILINO' || ev.tipo === 'MENSAJE_INMO';
        const desdeInmo = ev.tipo === 'MENSAJE_INMO';

        return (
          <li key={ev.id} className="relative flex gap-3">
            {i < eventos.length - 1 && (
              <span
                className="bg-border absolute left-[15px] top-8 h-[calc(100%-12px)] w-px"
                aria-hidden
              />
            )}
            <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-muted-foreground text-[11px]">{tiempoRelativo(ev.fecha)}</p>
              </div>
              {ev.contenido && !esMensaje && ev.tipo !== 'ASIGNADO' && (
                <p className="text-muted-foreground text-sm">{ev.contenido}</p>
              )}
              {esMensaje && (ev.contenido || ev.adjuntoUrl) && (
                <div
                  className={cn(
                    'space-y-2 rounded-lg px-3 py-2 text-sm',
                    desdeInmo ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                  )}
                >
                  {ev.contenido && (
                    <p className="whitespace-pre-wrap break-words">{ev.contenido}</p>
                  )}
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
