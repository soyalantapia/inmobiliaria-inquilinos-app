'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Truck,
  Wrench,
} from 'lucide-react';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { obtenerVisita, type VisitaProfesional } from '@/lib/visitas-profesional';

/**
 * Card del lado inquilino que muestra dónde está el profesional en el
 * workflow de visita. Se ubica debajo de la card "Profesional asignado"
 * en /reclamos/[id].
 *
 * Solo lee del storage; el profesional actualiza desde /p/[token].
 */
interface ProgresoVisitaInquilinoProps {
  reclamoId: string;
  profesionalNombre: string | null;
  /**
   * Si el reclamo ya fue cerrado por la inmo, escondemos la frase
   * "La inmobiliaria lo va a revisar y, si todo OK, lo da por resuelto":
   * para entonces ya está RESUELTO y la card "Por confirmar" o "Resuelto"
   * de la página de detalle se ocupa de guiar al inquilino. Mostrarla
   * cuando ya pasó deja tres componentes diciendo cosas contradictorias.
   */
  reclamoYaResuelto?: boolean;
}

const ESTADOS = ['ASIGNADO', 'CONFIRMADA', 'EN_CAMINO', 'LISTO'] as const;
type Estado = (typeof ESTADOS)[number];

export function ProgresoVisitaInquilino({
  reclamoId,
  profesionalNombre,
  reclamoYaResuelto = false,
}: ProgresoVisitaInquilinoProps) {
  const [visita, setVisita] = useState<VisitaProfesional | null>(null);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setHidratado(true);
    setVisita(obtenerVisita(reclamoId));
    const id = setInterval(() => setVisita(obtenerVisita(reclamoId)), 3000);
    return () => clearInterval(id);
  }, [reclamoId]);

  if (!hidratado || !visita || visita.estado === 'ASIGNADO') return null;

  const nombrePila = (profesionalNombre ?? '').split(' ')[0] ?? 'El profesional';

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estado del trabajo
        </h3>
      </div>

      {/* Stepper */}
      <Stepper estado={visita.estado} />

      {/* Detalle del paso actual */}
      <div
        className={cn(
          'flex items-start gap-2 rounded-md p-3 text-xs',
          visita.estado === 'LISTO'
            ? 'bg-emerald-50 dark:bg-emerald-900/20'
            : visita.estado === 'EN_CAMINO'
              ? 'bg-amber-50 dark:bg-amber-900/20'
              : 'bg-primary/5',
        )}
      >
        {visita.estado === 'CONFIRMADA' && (
          <>
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium">{nombrePila} confirmó visita</p>
              {visita.fechaVisita && (
                <p className="text-muted-foreground">
                  Va el{' '}
                  <strong className="text-foreground">
                    {new Date(visita.fechaVisita).toLocaleString('es-AR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                  . Te avisará cuando salga.
                </p>
              )}
            </div>
          </>
        )}
        {visita.estado === 'EN_CAMINO' && (
          <>
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="font-medium">{nombrePila} está en camino 🚗</p>
              <p className="text-muted-foreground">
                Salió hace un rato. Si te demorás en abrir, avisale al teléfono
                que aparece arriba.
              </p>
            </div>
          </>
        )}
        {visita.estado === 'LISTO' && (
          <>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <div className="space-y-1">
              <p className="font-medium">{nombrePila} terminó el trabajo</p>
              {visita.notaFinal && (
                <p className="italic text-muted-foreground">
                  &ldquo;{visita.notaFinal}&rdquo;
                </p>
              )}
              {!reclamoYaResuelto && (
                <p className="text-muted-foreground">
                  La inmobiliaria lo va a revisar y, si todo OK, lo da por resuelto.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fotos antes / después del trabajo */}
      {(visita.fotoAntes || visita.fotoDespues) && (
        <div className="grid grid-cols-2 gap-2">
          {visita.fotoAntes && (
            <FotoCard label="Antes" url={visita.fotoAntes} />
          )}
          {visita.fotoDespues && (
            <FotoCard label="Después" url={visita.fotoDespues} />
          )}
        </div>
      )}
    </Card>
  );
}

function FotoCard({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="aspect-square w-full rounded-md border object-cover"
      />
    </div>
  );
}

function Stepper({ estado }: { estado: Estado }) {
  const idx = ESTADOS.indexOf(estado);
  const items: Array<{ label: string; icon: typeof Clock }> = [
    { label: 'Asignado', icon: Clock },
    { label: 'Confirmó', icon: CalendarClock },
    { label: 'En camino', icon: Truck },
    { label: 'Listo', icon: CheckCircle2 },
  ];
  return (
    <div className="flex items-center justify-between gap-1">
      {items.map((it, i) => {
        const completado = i <= idx;
        const Icon = it.icon;
        return (
          <div key={it.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all',
                completado
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
            </div>
            <span
              className={cn(
                'text-center text-[9px] uppercase tracking-wide leading-tight',
                completado ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
