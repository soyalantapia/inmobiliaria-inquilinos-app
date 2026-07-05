'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, apiFetch } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { formatMonto } from '@/lib/format';
import type { Moneda } from '@/lib/types';

// Período (YYYY-MM) del mes siguiente a una fecha ISO. Default para montoDesde: el nuevo
// canon suele arrancar cuando termina el plazo anterior.
function mesSiguiente(fechaIso: string): string {
  const d = new Date(fechaIso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 0-based → +1 = mes actual; +1 más = siguiente
  const dt = new Date(Date.UTC(y, m, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Renueva un contrato: extiende el plazo (fechaFin) y fija un nuevo canon desde un período.
 * El contrato es el mismo (continuidad del inquilino, depósito e historial).
 */
export function RenovarContratoButton({
  contratoId,
  montoActual,
  fechaFinActual,
  moneda,
}: {
  contratoId: string;
  montoActual: number;
  fechaFinActual: string;
  moneda: Moneda;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fechaFinNueva, setFechaFinNueva] = useState('');
  const [montoNuevo, setMontoNuevo] = useState('');
  const [montoDesde, setMontoDesde] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) {
      setFechaFinNueva('');
      setMontoNuevo(String(montoActual));
      setMontoDesde(fechaFinActual ? mesSiguiente(fechaFinActual) : '');
      setMotivo('');
    }
  }, [open, montoActual, fechaFinActual]);

  const nuevoNum = montoNuevo === '' ? 0 : Math.max(0, Number(montoNuevo) || 0);
  const finOk = !!fechaFinNueva && (!fechaFinActual || fechaFinNueva > fechaFinActual.slice(0, 10));
  const valido = finOk && nuevoNum > 0 && /^\d{4}-\d{2}$/.test(montoDesde);

  const renovar = useMutation({
    mutationFn: async () => {
      await ensureApiSession();
      return apiFetch<{ liquidacionesNuevas: number }>(`/contratos/${contratoId}/renovar`, {
        method: 'POST',
        body: JSON.stringify({ fechaFinNueva, montoNuevo: nuevoNum, montoDesde, motivo: motivo.trim() || undefined }),
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      qc.invalidateQueries({ queryKey: ['renovaciones', contratoId] });
      toast({
        variant: 'success',
        title: 'Contrato renovado',
        description: `Nuevo plazo hasta ${fechaFinNueva}, canon ${formatMonto(nuevoNum, moneda)} desde ${montoDesde}.`,
      });
      setOpen(false);
    },
    onError: (e) => {
      toast({ variant: 'destructive', title: 'No se pudo renovar', description: e instanceof ApiError ? e.message : 'Probá de nuevo.' });
    },
  });

  const descripcion = (
    <span className="block space-y-3 text-xs">
      <span className="block text-muted-foreground">
        Extiende el plazo del mismo contrato (se conservan inquilino, depósito e historial) y fija el nuevo
        canon desde el período que elijas. Alquiler actual: <strong className="text-foreground">{formatMonto(montoActual, moneda)}</strong>.
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Nueva fecha de fin</span>
        <input type="date" value={fechaFinNueva} onChange={(e) => setFechaFinNueva(e.target.value)} className="w-40 rounded border border-border bg-background px-2 py-1" />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Nuevo alquiler</span>
        <input type="number" inputMode="decimal" value={montoNuevo} onChange={(e) => setMontoNuevo(e.target.value)} className="w-40 rounded border border-border bg-background px-2 py-1 text-right" />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">El nuevo canon aplica desde</span>
        <input type="month" value={montoDesde} onChange={(e) => setMontoDesde(e.target.value)} className="w-40 rounded border border-border bg-background px-2 py-1" />
      </span>
      <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1" placeholder="Motivo (opcional)" maxLength={200} />
    </span>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        Renovar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Renovar el contrato"
        description={descripcion}
        confirmLabel="Renovar"
        confirmDisabled={!valido}
        loading={renovar.isPending}
        onConfirm={() => renovar.mutate()}
      />
    </>
  );
}
