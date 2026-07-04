'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Truck,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import { visitaDeReclamo, type VisitaProfesional } from '@/lib/visitas-cross-app';
import { apiEnabled } from '@/lib/api/client';
import { useVisitaReclamo } from '@/lib/api/use-visita-reclamo';
import { formatMonto } from '@/lib/format';

/**
 * Card que muestra el progreso de la visita del profesional al reclamo, tal
 * como la confirmó/actualizó él desde su link mágico /p/[token].
 *
 * En prod (apiEnabled) lee GET /reclamos/:id (poll cada 20s, no hay push).
 * En demo lee el cross-app localStorage del lado profesional (poll cada 3s).
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

interface ProgresoDatos {
  estado: Estado;
  fechaVisita: string | null;
  notaFinal: string | null;
  montoCobrado: number | null;
  fotoAntes: string | null | undefined;
  fotoDespues: string | null | undefined;
}

export function ProgresoVisitaCard({ reclamoId }: ProgresoVisitaCardProps) {
  return apiEnabled ? <ProgresoVisitaCardReal reclamoId={reclamoId} /> : <ProgresoVisitaCardDemo reclamoId={reclamoId} />;
}

function ProgresoVisitaCardReal({ reclamoId }: ProgresoVisitaCardProps) {
  const { visita, cargando, regenerarLink } = useVisitaReclamo(reclamoId);
  const [copiando, setCopiando] = useState(false);

  if (cargando || !visita) return null;

  const copiarLink = async () => {
    setCopiando(true);
    try {
      const base = process.env.NEXT_PUBLIC_INQUILINO_URL?.replace(/\/$/, '') || 'https://app.myalquiler.com';
      await navigator.clipboard.writeText(`${base}/p/${visita.token}/`);
      toast({ variant: 'success', title: 'Link copiado' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo copiar' });
    } finally {
      setCopiando(false);
    }
  };

  const reenviarLink = async () => {
    try {
      const nuevoToken = await regenerarLink();
      const base = process.env.NEXT_PUBLIC_INQUILINO_URL?.replace(/\/$/, '') || 'https://app.myalquiler.com';
      await navigator.clipboard.writeText(`${base}/p/${nuevoToken}/`);
      toast({ variant: 'success', title: 'Nuevo link generado y copiado' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo regenerar el link' });
    }
  };

  return (
    <VisitaProgresoBody datos={visita}>
      <div className="flex gap-1.5 border-t pt-3">
        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={copiarLink} disabled={copiando}>
          <Copy className="h-3.5 w-3.5" />
          Copiar link
        </Button>
        {visita.estado === 'ASIGNADO' && (
          <Button size="sm" variant="ghost" onClick={reenviarLink}>
            Regenerar
          </Button>
        )}
      </div>
    </VisitaProgresoBody>
  );
}

function ProgresoVisitaCardDemo({ reclamoId }: ProgresoVisitaCardProps) {
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
  return <VisitaProgresoBody datos={visita} />;
}

function VisitaProgresoBody({ datos, children }: { datos: ProgresoDatos; children?: React.ReactNode }) {
  const idxActual = ESTADOS.indexOf(datos.estado);
  const info = ESTADO_INFO[datos.estado];
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
            datos.estado === 'LISTO'
              ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
              : datos.estado === 'EN_CAMINO'
                ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10'
                : datos.estado === 'CONFIRMADA'
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
            {datos.fechaVisita && datos.estado !== 'LISTO' && (
              <p className="text-muted-foreground">
                Visita programada:{' '}
                <strong className="text-foreground">
                  {new Date(datos.fechaVisita).toLocaleString('es-AR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </p>
            )}
            {datos.notaFinal && (
              <p className="italic text-muted-foreground">&ldquo;{datos.notaFinal}&rdquo;</p>
            )}
            {datos.montoCobrado ? (
              <p className="font-medium">Costo cobrado: {formatMonto(datos.montoCobrado)}</p>
            ) : null}
          </div>
        </div>

        {/* Fotos antes / después del trabajo */}
        {(datos.fotoAntes || datos.fotoDespues) && (
          <div className="grid grid-cols-2 gap-2">
            {datos.fotoAntes && <FotoCard label="Antes" url={datos.fotoAntes} />}
            {datos.fotoDespues && <FotoCard label="Después" url={datos.fotoDespues} />}
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );
}

function FotoCard({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="space-y-1" title="Abrir foto">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="aspect-square w-full rounded-md border object-cover" />
    </a>
  );
}
