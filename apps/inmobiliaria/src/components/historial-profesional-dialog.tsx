'use client';

import { useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  Wrench,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import {
  type ProfesionalAdmin,
  profesionalCategoriaLabelAdmin,
} from '@/lib/mock-data';
import { listarReclamos } from '@/lib/reclamos-store';
import { calificacionesPorProfesional, ratingPonderado } from '@/lib/ratings-cross-app';
import { formatFecha } from '@/lib/format';
import type { EstadoReclamo, Reclamo } from '@/lib/types';
import { mensajeWhatsappGenerico } from './asignar-profesional-dialog';

/**
 * Drawer/dialog que muestra el track record completo del profesional:
 * reclamos donde trabajó, calificaciones, métricas operativas.
 *
 * Se usa desde /profesionales al clickear la card o pulsar "Ver historial".
 */

const estadoLabel: Record<EstadoReclamo, string> = {
  ABIERTO: 'Abierto',
  EN_CURSO: 'En curso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
};

const estadoColor: Record<EstadoReclamo, string> = {
  ABIERTO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  EN_CURSO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  RESUELTO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CERRADO: 'bg-muted text-muted-foreground',
  RECHAZADO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface HistorialProfesionalDialogProps {
  profesional: ProfesionalAdmin | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function HistorialProfesionalDialog({
  profesional,
  open,
  onOpenChange,
}: HistorialProfesionalDialogProps) {
  // Reclamos asignados a este profesional, ordenados por fecha desc.
  const reclamosAsignados = useMemo(() => {
    if (!profesional) return [];
    return listarReclamos()
      .filter((r) => r.profesionalAsignadoId === profesional.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [profesional]);

  // Calificaciones recibidas indexadas por reclamoId.
  const califsByReclamo = useMemo(() => {
    if (!profesional) return {};
    const all = calificacionesPorProfesional()[profesional.id] ?? [];
    return Object.fromEntries(all.map((c) => [c.reclamoId, c]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesional, open]);

  // Métricas
  const metricas = useMemo(() => {
    if (!profesional)
      return { tiempoPromedio: null, ratingPromedio: 0, totalCalifs: 0, resueltos: 0 };
    const califs = Object.values(califsByReclamo);
    const totalCalifs = califs.length;
    const ratingNuevo = ratingPonderado(profesional.rating, profesional.cantTrabajos, califs);
    const resueltos = reclamosAsignados.filter((r) => r.estado === 'RESUELTO');
    // Tiempo promedio de resolución (en horas) sobre reclamos resueltos.
    const tiempos = resueltos
      .filter((r) => r.resueltoAt)
      .map((r) => {
        const inicio = new Date(r.createdAt).getTime();
        const fin = new Date(r.resueltoAt!).getTime();
        return (fin - inicio) / (1000 * 60 * 60); // horas
      });
    const tiempoPromedio =
      tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
    return {
      tiempoPromedio,
      ratingPromedio: ratingNuevo.promedio,
      totalCalifs,
      resueltos: resueltos.length,
    };
  }, [reclamosAsignados, califsByReclamo, profesional]);

  if (!profesional) return null;

  const tel = profesional.telefono.replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(
    mensajeWhatsappGenerico(profesional),
  )}`;
  const telUrl = `tel:${profesional.telefono.replace(/\s/g, '')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            {profesional.nombre}
            <Badge variant="outline" className="text-[10px]">
              {profesionalCategoriaLabelAdmin[profesional.categoria]}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {profesional.zona}
            </span>
            <span>·</span>
            <span>{profesional.telefono}</span>
            {profesional.email && (
              <>
                <span>·</span>
                <span>{profesional.email}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Métricas top */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricBox
            label="Rating"
            value={
              metricas.ratingPromedio > 0
                ? metricas.ratingPromedio.toFixed(1)
                : '—'
            }
            icon={<Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
          />
          <MetricBox
            label="Asignados"
            value={reclamosAsignados.length.toString()}
            icon={<Wrench className="h-3 w-3 text-primary" />}
          />
          <MetricBox
            label="Resueltos"
            value={metricas.resueltos.toString()}
            icon={<CheckCircle2 className="h-3 w-3 text-emerald-600" />}
          />
          <MetricBox
            label="Tiempo prom."
            value={formatHoras(metricas.tiempoPromedio)}
            icon={<Clock className="h-3 w-3 text-blue-600" />}
          />
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            asChild
          >
            <a href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={telUrl}>
              <Phone className="h-4 w-4" />
              Llamar
            </a>
          </Button>
        </div>

        {/* Historial de reclamos */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de trabajos ({reclamosAsignados.length})
          </h3>
          {reclamosAsignados.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">Sin trabajos asignados todavía</p>
              <p className="text-xs text-muted-foreground">
                Cuando le asignes el primer reclamo va a aparecer acá.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reclamosAsignados.map((r) => (
                <ReclamoHistorialRow
                  key={r.id}
                  reclamo={r}
                  calif={califsByReclamo[r.id]}
                  onClose={() => onOpenChange(false)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notas internas si las hay */}
        {profesional.notas && (
          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <p className="font-medium">Notas internas</p>
            <p className="italic text-muted-foreground">{profesional.notas}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReclamoHistorialRow({
  reclamo,
  calif,
  onClose,
}: {
  reclamo: Reclamo;
  calif?: { estrellas: number; comentario: string | null; enviadoAt: string };
  onClose: () => void;
}) {
  const tiempoRes =
    reclamo.estado === 'RESUELTO' && reclamo.resueltoAt
      ? (new Date(reclamo.resueltoAt).getTime() - new Date(reclamo.createdAt).getTime()) /
        (1000 * 60 * 60)
      : null;
  return (
    <Link
      href={`/reclamos/${reclamo.id}`}
      onClick={onClose}
      className="block rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{reclamo.direccion}</p>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                estadoColor[reclamo.estado],
              )}
            >
              {estadoLabel[reclamo.estado]}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {reclamo.categoria.toLowerCase()}
            </Badge>
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {reclamo.descripcion}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {reclamo.inquilino} · creado {formatFecha(reclamo.createdAt)}
            {tiempoRes !== null && (
              <>
                {' '}
                · resuelto en {formatHoras(tiempoRes)}
              </>
            )}
          </p>
        </div>
        {calif ? (
          <div className="shrink-0 text-right">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-3 w-3',
                    i < calif.estrellas
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-amber-200',
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {formatFecha(calif.enviadoAt)}
            </p>
          </div>
        ) : reclamo.estado === 'RESUELTO' ? (
          <div className="shrink-0 text-right">
            <Badge variant="outline" className="text-[10px]">
              Sin calificar
            </Badge>
          </div>
        ) : null}
      </div>
      {calif?.comentario && (
        <p className="mt-2 rounded-md bg-amber-50/60 px-2 py-1.5 text-xs italic text-muted-foreground dark:bg-amber-900/10">
          “{calif.comentario}”
        </p>
      )}
    </Link>
  );
}

function formatHoras(h: number | null): string {
  if (h === null || h === undefined || Number.isNaN(h)) return '—';
  if (h < 24) return `${Math.round(h)}h`;
  const dias = Math.round(h / 24);
  return `${dias}d`;
}
