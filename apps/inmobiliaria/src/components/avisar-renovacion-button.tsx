'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';
import { cn } from '@llave/ui/cn';
import { registrarDecisionApi } from '@/lib/api/use-renovaciones';
import { formatFechaCorta } from '@/lib/format';
import type { DecisionRenovacionMock } from '@/lib/mock-data';

/**
 * Registrar la intención de renovación DESDE el detalle del contrato — el mismo
 * flujo que /renovaciones, pero accesible donde el operador aterriza cuando el
 * inquilino le avisa "me voy": abre el contrato, no la lista de renovaciones.
 * Cerraba el gap de descubribilidad (#11): la capacidad ya existía pero vivía
 * SOLO en /renovaciones y el label "Registrar aviso" no delataba de qué se
 * trataba. Reusa registrarDecisionApi (POST /renovaciones/:id/decision) — cero
 * backend nuevo.
 */
export function AvisarRenovacionButton({
  contratoId,
  inquilino,
  direccion,
  decisionActual,
  fechaEgresoActual,
}: {
  contratoId: string;
  inquilino: string;
  direccion: string;
  decisionActual?: DecisionRenovacionMock | null;
  fechaEgresoActual?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionRenovacionMock>('SIN_RESPUESTA');
  const [fechaEgreso, setFechaEgreso] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setDecision(decisionActual ?? 'SIN_RESPUESTA');
      setFechaEgreso(fechaEgresoActual ?? '');
      setNotas('');
    }
  }, [open, decisionActual, fechaEgresoActual]);

  const opciones: { value: DecisionRenovacionMock; label: string; sub: string }[] = [
    { value: 'RENOVAR', label: 'Renueva', sub: 'Quiere seguir' },
    { value: 'PENSANDO', label: 'Lo está pensando', sub: 'Sin definir' },
    { value: 'NO_RENOVAR', label: 'No renueva — se va', sub: 'Avisó que deja el inmueble' },
  ];

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      await registrarDecisionApi(contratoId, { decision, notas, fechaEgreso: fechaEgreso || null });
      // El detalle del contrato y la lista de renovaciones comparten este dato:
      // invalidamos ambos para que se refresquen sin recargar.
      void qc.invalidateQueries({ queryKey: ['renovaciones'] });
      void qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      toast({
        variant: 'success',
        title: 'Aviso registrado',
        description:
          decision === 'NO_RENOVAR'
            ? `${inquilino} no renueva${fechaEgreso ? ` — se va el ${formatFechaCorta(fechaEgreso)}` : ''}.`
            : 'Actualizamos la intención de renovación.',
      });
      setOpen(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar',
        description: e instanceof Error ? e.message : 'Probá de nuevo.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setOpen(true)}>
        <CalendarClock className="h-4 w-4" />
        Avisar: renueva / se va
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aviso del inquilino</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {inquilino} · {direccion}
            </p>
            <div className="space-y-2">
              {opciones.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setDecision(o.value)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    decision === o.value
                      ? o.value === 'NO_RENOVAR'
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <span>
                    <span className="font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.sub}</span>
                  </span>
                  {decision === o.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            {decision === 'NO_RENOVAR' && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  ¿Cuándo se va? <span className="font-normal text-muted-foreground">(preaviso)</span>
                </span>
                <input
                  type="date"
                  value={fechaEgreso}
                  onChange={(e) => setFechaEgreso(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Nota <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Ej: avisó por WhatsApp, se muda por trabajo…"
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Registrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
