'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, apiFetch } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { MoneyInput } from '@/components/money-input';
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

  const finActualCorta = fechaFinActual ? fechaFinActual.slice(0, 10) : '';
  const nuevoNum = montoNuevo === '' ? 0 : Math.max(0, Number(montoNuevo) || 0);
  const finOk = !!fechaFinNueva && (!fechaFinActual || fechaFinNueva > finActualCorta);
  const desdeOk = /^\d{4}-\d{2}$/.test(montoDesde);
  const valido = finOk && nuevoNum > 0 && desdeOk;

  // Antes el botón "Renovar" quedaba deshabilitado SIN decir por qué (Camila:
  // "pongo fecha y precio pero no me da el botón azul"). Ahora le decimos justo
  // qué falta, priorizando el bloqueante más común (fecha no posterior a la actual).
  const faltante = !fechaFinNueva
    ? 'Elegí la nueva fecha de fin.'
    : !finOk
      ? `La nueva fecha de fin tiene que ser posterior a la actual${finActualCorta ? ` (hoy vence el ${finActualCorta})` : ''}.`
      : nuevoNum <= 0
        ? 'Poné el monto del nuevo alquiler.'
        : !desdeOk
          ? 'Elegí desde qué mes arranca el nuevo alquiler.'
          : null;

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
      // La lista de Renovaciones usa la key ['renovaciones'] (sin id); invalidar
      // ['renovaciones', contratoId] no matcheaba nada. El prefijo cubre ambas.
      qc.invalidateQueries({ queryKey: ['renovaciones'] });
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
        <span className="font-medium text-foreground">
          Nueva fecha de fin
          {finActualCorta && (
            <span className="block text-[10px] font-normal text-muted-foreground">Actual: vence el {finActualCorta}</span>
          )}
        </span>
        <input
          type="date"
          value={fechaFinNueva}
          min={finActualCorta || undefined}
          onChange={(e) => setFechaFinNueva(e.target.value)}
          className="w-40 rounded border border-border bg-background px-2 py-1"
        />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Nuevo alquiler</span>
        <MoneyInput value={montoNuevo} onChange={setMontoNuevo} moneda={moneda} className="inline-block w-40" />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">El nuevo canon aplica desde</span>
        <input type="month" value={montoDesde} onChange={(e) => setMontoDesde(e.target.value)} className="w-40 rounded border border-border bg-background px-2 py-1" />
      </span>
      <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1" placeholder="Motivo (opcional)" maxLength={200} />
      {faltante && (
        <span className="block rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] font-medium text-destructive">
          Para poder confirmar: {faltante}
        </span>
      )}
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
