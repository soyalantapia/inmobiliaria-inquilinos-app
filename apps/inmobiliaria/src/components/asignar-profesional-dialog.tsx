'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Search,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import {
  type CategoriaProfesional,
  type ProfesionalAdmin,
} from '@/lib/mock-data';
import { asignarProfesional, listarReclamos } from '@/lib/reclamos-store';
import type { CategoriaReclamo, Reclamo, UrgenciaReclamo } from '@/lib/types';
import { formatFechaCorta } from '@/lib/format';

/**
 * Mapeo categoría del profesional → categoría del reclamo. Cuando no hay
 * match perfecto (gasista, pintor, flete), caemos a la categoría más
 * cercana. Los reclamos de OTRO siempre aparecen para cualquier categoría.
 */
const profesionalAReclamo: Record<CategoriaProfesional, CategoriaReclamo[]> = {
  PLOMERO: ['PLOMERIA'],
  ELECTRICISTA: ['ELECTRICIDAD'],
  GASISTA: ['CALEFACCION'],
  CERRAJERO: ['CERRADURA'],
  PINTOR: ['OTRO'],
  TECNICO_AC: ['CALEFACCION'],
  FLETE: ['OTRO'],
};

const urgenciaColor: Record<UrgenciaReclamo, string> = {
  EMERGENCIA: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  ALTA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  MEDIA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  BAJA: 'bg-muted text-muted-foreground',
};

interface AsignarProfesionalDialogProps {
  profesional: ProfesionalAdmin | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Se llama después de asignar exitosamente. */
  onAsignado?: (reclamoId: string) => void;
}

export function AsignarProfesionalDialog({
  profesional,
  open,
  onOpenChange,
  onAsignado,
}: AsignarProfesionalDialogProps) {
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [filtro, setFiltro] = useState('');
  const [seleccionado, setSeleccionado] = useState<Reclamo | null>(null);
  const [asignando, setAsignando] = useState(false);

  // Refrescar al abrir
  useEffect(() => {
    if (!open) return;
    setReclamos(listarReclamos());
    setFiltro('');
    setSeleccionado(null);
    setAsignando(false);
  }, [open]);

  // Reclamos elegibles: abiertos o en curso, sin profesional asignado.
  // Si hay match de categoría → arriba; el resto debajo (todavía asignables).
  const { compatibles, otros } = useMemo(() => {
    if (!profesional) return { compatibles: [], otros: [] };
    const categoriasCompat = profesionalAReclamo[profesional.categoria] ?? [];
    const todosElegibles = reclamos.filter(
      (r) =>
        (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') &&
        !r.profesionalAsignadoId,
    );
    const compatibles = todosElegibles.filter((r) =>
      categoriasCompat.includes(r.categoria),
    );
    const otros = todosElegibles.filter(
      (r) => !categoriasCompat.includes(r.categoria),
    );
    const matchFiltro = (r: Reclamo) => {
      const f = filtro.trim().toLowerCase();
      if (!f) return true;
      return (
        r.direccion.toLowerCase().includes(f) ||
        r.inquilino.toLowerCase().includes(f) ||
        r.descripcion.toLowerCase().includes(f)
      );
    };
    return {
      compatibles: compatibles.filter(matchFiltro),
      otros: otros.filter(matchFiltro),
    };
  }, [reclamos, profesional, filtro]);

  if (!profesional) return null;

  const handleAsignar = async (alsoWhatsapp: boolean) => {
    if (!seleccionado) return;
    setAsignando(true);
    asignarProfesional(
      seleccionado.id,
      {
        id: profesional.id,
        nombre: profesional.nombre,
        telefono: profesional.telefono,
        categoria: profesional.categoria,
      },
      'Inmobiliaria',
    );
    await new Promise((r) => setTimeout(r, 250));
    toast({
      variant: 'success',
      title: '¡Profesional asignado!',
      description: `${profesional.nombre} → reclamo en ${seleccionado.direccion}`,
    });
    onAsignado?.(seleccionado.id);
    onOpenChange(false);

    if (alsoWhatsapp) {
      const mensaje = mensajeWhatsappTrabajo(profesional, seleccionado);
      const tel = profesional.telefono.replace(/[^\d]/g, '');
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setAsignando(false);
  };

  const totalElegibles = compatibles.length + otros.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Asignar a {profesional.nombre}
          </DialogTitle>
          <DialogDescription>
            Elegí un reclamo abierto para asignárselo. Después podés mandarle el detalle por
            WhatsApp con un toque.
          </DialogDescription>
        </DialogHeader>

        {totalElegibles === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-sm font-medium">Sin reclamos pendientes</p>
            <p className="text-xs text-muted-foreground">
              No hay reclamos abiertos sin asignar en este momento.
            </p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar reclamo a asignar"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por dirección, inquilino o descripción"
                className="pl-9"
              />
            </div>

            {/* Reclamos compatibles */}
            {compatibles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Compatibles con su rubro ({compatibles.length})
                </p>
                <div className="space-y-2">
                  {compatibles.map((r) => (
                    <ReclamoRow
                      key={r.id}
                      reclamo={r}
                      selected={seleccionado?.id === r.id}
                      onSelect={() => setSeleccionado(r)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Otros reclamos (otra categoría pero asignables igual) */}
            {otros.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Otros pendientes ({otros.length})
                </p>
                <div className="space-y-2">
                  {otros.map((r) => (
                    <ReclamoRow
                      key={r.id}
                      reclamo={r}
                      selected={seleccionado?.id === r.id}
                      onSelect={() => setSeleccionado(r)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {totalElegibles > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {seleccionado
                ? `Reclamo en ${seleccionado.direccion} seleccionado.`
                : 'Elegí un reclamo de la lista.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAsignar(false)}
                disabled={!seleccionado || asignando}
              >
                Asignar solo
              </Button>
              <Button
                size="sm"
                onClick={() => handleAsignar(true)}
                disabled={!seleccionado || asignando}
                className="gap-1.5"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Asignar y mandar WhatsApp
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Fila de reclamo elegible para asignación
 * ============================================================ */
function ReclamoRow({
  reclamo,
  selected,
  onSelect,
}: {
  reclamo: Reclamo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        {reclamo.urgencia === 'EMERGENCIA' ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Wrench className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{reclamo.direccion}</p>
          <Badge variant="outline" className="text-[10px]">
            {reclamo.categoria.toLowerCase()}
          </Badge>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              urgenciaColor[reclamo.urgencia],
            )}
          >
            {reclamo.urgencia.toLowerCase()}
          </span>
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {reclamo.descripcion}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {reclamo.inquilino} · creado {formatFechaCorta(reclamo.createdAt)}
        </p>
      </div>
    </button>
  );
}

/* ============================================================
 * Mensajes pre-armados de WhatsApp
 * ============================================================ */
export function mensajeWhatsappGenerico(prof: ProfesionalAdmin): string {
  const nombrePila = prof.nombre.split(' ')[0] ?? prof.nombre;
  return (
    `Hola ${nombrePila}! Soy del equipo de Inmobiliaria del Sol. ` +
    `Tenemos un trabajo de ${profesionalCategoriaLabelCorto(prof.categoria)} ` +
    `para coordinar. ¿Cuándo tenés disponibilidad?`
  );
}

export function mensajeWhatsappTrabajo(
  prof: ProfesionalAdmin,
  reclamo: Reclamo,
): string {
  const nombrePila = prof.nombre.split(' ')[0] ?? prof.nombre;
  const urg =
    reclamo.urgencia === 'EMERGENCIA'
      ? '🚨 *URGENTE*: '
      : reclamo.urgencia === 'ALTA'
        ? '⚠️ '
        : '';
  const linkProf = linkMagicoProfesional(prof.id);
  return (
    `Hola ${nombrePila}! Soy del equipo de Inmobiliaria del Sol. ` +
    `Te paso un trabajo:\n\n` +
    `${urg}*${reclamo.categoria.toLowerCase()}* en *${reclamo.direccion}*\n` +
    `${reclamo.descripcion}\n\n` +
    `Inquilino: ${reclamo.inquilino}\n` +
    `Reclamo: ${reclamo.id}\n\n` +
    `Confirmá día y hora desde tu panel: ${linkProf}\n\n` +
    `¿Podés ir a revisarlo? Cualquier cosa avisame.`
  );
}

/** URL del link mágico del profesional. En producción se firma con JWT;
 *  acá usamos el id directo. La ruta vive en la app del inquilino bajo /p. */
export function linkMagicoProfesional(profesionalId: string): string {
  if (typeof window === 'undefined') {
    return `/inquilino/p/${profesionalId}/`;
  }
  // En github pages la app del inquilino vive bajo .../inmobiliaria-inquilinos-app/inquilino/
  // En localhost dev usamos http://localhost:3000/p/<id>
  const isLocal = window.location.hostname === 'localhost';
  if (isLocal) {
    return `http://localhost:3000/p/${profesionalId}/`;
  }
  const base = `${window.location.origin}/inmobiliaria-inquilinos-app/inquilino`;
  return `${base}/p/${profesionalId}/`;
}

function profesionalCategoriaLabelCorto(c: CategoriaProfesional): string {
  const map: Record<CategoriaProfesional, string> = {
    PLOMERO: 'plomería',
    ELECTRICISTA: 'electricidad',
    GASISTA: 'gas',
    CERRAJERO: 'cerrajería',
    PINTOR: 'pintura',
    TECNICO_AC: 'aire / calefacción',
    FLETE: 'flete',
  };
  return map[c];
}
