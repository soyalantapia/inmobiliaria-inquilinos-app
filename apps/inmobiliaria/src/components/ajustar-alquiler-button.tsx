'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, varianteError } from '@/lib/api/client';
import { MoneyInput } from '@/components/money-input';
import { useAjustarAlquiler } from '@/lib/api/use-ajustes';
import { formatMonto } from '@/lib/format';
import type { Moneda } from '@/lib/types';

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ajusta el alquiler de un contrato (manual-asistido): el operador confirma el nuevo canon
 * y desde qué período aplica. Actualiza el contrato + las cuotas futuras impagas.
 */
export function AjustarAlquilerButton({
  contratoId,
  montoActual,
  moneda,
}: {
  contratoId: string;
  montoActual: number;
  moneda: Moneda;
}) {
  const ajustar = useAjustarAlquiler(contratoId);
  const [open, setOpen] = useState(false);
  const [montoNuevo, setMontoNuevo] = useState('');
  const [periodoDesde, setPeriodoDesde] = useState(periodoActual());
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) {
      setMontoNuevo('');
      setPeriodoDesde(periodoActual());
      setMotivo('');
    }
  }, [open]);

  const nuevoNum = montoNuevo === '' ? 0 : Math.max(0, Number(montoNuevo) || 0);
  const pct = montoActual > 0 && nuevoNum > 0 ? Math.round(((nuevoNum - montoActual) / montoActual) * 1000) / 10 : 0;
  const valido = nuevoNum > 0 && nuevoNum !== montoActual && /^\d{4}-\d{2}$/.test(periodoDesde);

  const confirmar = async () => {
    if (!valido) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Indicá un monto nuevo distinto al actual y el período.' });
      return;
    }
    try {
      const res = await ajustar.mutateAsync({ montoNuevo: nuevoNum, periodoDesde, motivo: motivo.trim() || undefined });
      toast({
        variant: 'success',
        title: 'Alquiler ajustado',
        description: `Nuevo canon ${formatMonto(nuevoNum, moneda)} desde ${periodoDesde}. Se actualizaron ${res.liquidacionesActualizadas} cuota${res.liquidacionesActualizadas === 1 ? '' : 's'} futura${res.liquidacionesActualizadas === 1 ? '' : 's'}.`,
      });
      setOpen(false);
    } catch (e) {
      toast({ variant: varianteError(e), title: 'No se pudo ajustar', description: e instanceof ApiError ? e.message : 'Probá de nuevo.' });
    }
  };

  const descripcion = (
    <span className="block space-y-3 text-xs">
      <span className="block text-muted-foreground">
        Alquiler actual: <strong className="text-foreground">{formatMonto(montoActual, moneda)}</strong>. El nuevo canon
        aplica desde el período que elijas y actualiza las cuotas futuras impagas (no las ya pagadas o vencidas).
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Nuevo alquiler</span>
        <MoneyInput
          value={montoNuevo}
          onChange={setMontoNuevo}
          moneda={moneda}
          className="inline-block w-36"
          placeholder="0"
        />
      </span>
      {nuevoNum > 0 && nuevoNum !== montoActual && (
        <span className={`block text-right ${pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {pct >= 0 ? '+' : ''}
          {pct}% vs actual
        </span>
      )}
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Aplica desde</span>
        <input
          type="month"
          value={periodoDesde}
          onChange={(e) => setPeriodoDesde(e.target.value)}
          className="w-36 rounded border border-border bg-background px-2 py-1"
        />
      </span>
      <input
        type="text"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1"
        placeholder="Motivo (ej. ICL 12 meses) — opcional"
        maxLength={200}
      />
    </span>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <TrendingUp className="h-4 w-4" />
        Ajustar alquiler
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Ajustar el alquiler"
        description={descripcion}
        confirmLabel="Aplicar ajuste"
        loading={ajustar.isPending}
        onConfirm={confirmar}
      />
    </>
  );
}
