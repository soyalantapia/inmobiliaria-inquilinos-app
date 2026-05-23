import {
  CalendarCheck,
  CheckCircle2,
  Flag,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { hitosContratoMock, type HitoContrato } from '@/lib/mock-data';
import { formatFecha } from '@/lib/format';

const iconConfig: Record<
  HitoContrato['tipo'],
  { icon: LucideIcon; cumplido: string; pendiente: string }
> = {
  INICIO: {
    icon: Flag,
    cumplido: 'bg-emerald-500 text-white',
    pendiente: 'bg-emerald-500 text-white',
  },
  AJUSTE_APLICADO: {
    icon: TrendingUp,
    cumplido: 'bg-primary text-primary-foreground',
    pendiente: 'bg-primary text-primary-foreground',
  },
  AJUSTE_FUTURO: {
    icon: Sparkles,
    cumplido: 'bg-primary text-primary-foreground',
    pendiente: 'bg-primary/15 text-primary border-2 border-primary',
  },
  FIN_CONTRATO: {
    icon: CalendarCheck,
    cumplido: 'bg-muted text-muted-foreground',
    pendiente: 'bg-muted text-muted-foreground border-2 border-dashed border-border',
  },
};

export function ContratoTimeline() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Filtramos el hito FIN_CONTRATO porque ese dato ya aparece arriba de la
  // página en dos lugares: el card resumen ("31/08/2025 → 30/08/2028") y el
  // RenovacionBanner. Tenerlo también acá generaba ruido.
  const hitos = hitosContratoMock.filter((h) => h.tipo !== 'FIN_CONTRATO');

  return (
    <ol className="space-y-0">
      {hitos.map((h, i) => {
        const fechaHito = new Date(h.fecha);
        const cumplido = fechaHito <= hoy;
        const cfg = iconConfig[h.tipo];
        const Icon = cumplido ? CheckCircle2 : cfg.icon;
        const esUltimo = i === hitos.length - 1;

        return (
          <li key={i} className="relative flex gap-4">
            {/* Línea vertical conectora */}
            {!esUltimo && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[19px] top-10 h-[calc(100%-32px)] w-0.5',
                  cumplido && hitos[i + 1] && new Date(hitos[i + 1]!.fecha) <= hoy
                    ? 'bg-primary/40'
                    : cumplido
                      ? 'bg-gradient-to-b from-primary/40 to-border'
                      : 'bg-border',
                )}
              />
            )}

            {/* Punto */}
            <div
              className={cn(
                'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors',
                cumplido ? cfg.cumplido : cfg.pendiente,
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            {/* Contenido */}
            <div className={cn('flex-1 min-w-0 pb-6', esUltimo && 'pb-0')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className={cn(
                    'text-sm font-medium',
                    !cumplido && 'text-muted-foreground',
                  )}
                >
                  {h.titulo}
                </p>
                <p
                  className={cn(
                    'text-[11px] tabular-nums',
                    cumplido ? 'text-muted-foreground' : 'font-medium text-primary',
                  )}
                >
                  {formatFecha(h.fecha)}
                </p>
              </div>
              {h.detalle && (
                <p
                  className={cn(
                    'mt-0.5 text-xs',
                    cumplido ? 'text-muted-foreground' : 'text-muted-foreground/70',
                  )}
                >
                  {h.detalle}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
