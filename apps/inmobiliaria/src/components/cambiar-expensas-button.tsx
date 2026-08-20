'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, varianteError } from '@/lib/api/client';
import { MoneyInput } from '@/components/money-input';
import { useCambiarExpensas } from '@/lib/api/use-ajustes';
import { formatMonto } from '@/lib/format';
import type { Moneda } from '@/lib/types';

/**
 * Cambiar el monto de expensas de un contrato.
 *
 * Hermano de `AjustarAlquilerButton`, y sigue su forma a propósito: es el mismo
 * gesto para el operador. Existe porque hasta ahora las expensas se podían
 * escribir UNA sola vez, en el alta — y suben todos los meses. Para corregirlas
 * había que rehacer el contrato entero; en uno de solo expensas era peor todavía,
 * porque es el único monto que tiene.
 */
export function CambiarExpensasButton({
  contratoId,
  expensasActuales,
  tipoContrato,
  moneda,
}: {
  contratoId: string;
  /** null / 0 = el contrato hoy no tiene expensas. */
  expensasActuales: number | null;
  tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS';
  moneda: Moneda;
}) {
  const cambiar = useCambiarExpensas(contratoId);
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');

  const actual = expensasActuales ?? 0;

  useEffect(() => {
    if (open) {
      setMonto('');
      setMotivo('');
    }
  }, [open]);

  const nuevoNum = monto === '' ? 0 : Math.max(0, Number(monto) || 0);
  const pct = actual > 0 && nuevoNum > 0 ? Math.round(((nuevoNum - actual) / actual) * 1000) / 10 : 0;
  // Un solo expensas no puede quedar en cero: es lo único que factura. El server
  // lo rechaza igual; acá se evita que el operador llegue a mandarlo.
  const ceroProhibido = tipoContrato === 'SOLO_EXPENSAS' && nuevoNum === 0;
  const valido = monto !== '' && nuevoNum !== actual && !ceroProhibido;

  const confirmar = async () => {
    if (!valido) {
      toast({
        variant: 'destructive',
        title: 'Datos incompletos',
        description: ceroProhibido
          ? 'Este contrato es de solo expensas: el monto tiene que ser mayor a cero.'
          : 'Indicá un monto distinto al actual.',
      });
      return;
    }
    try {
      const res = await cambiar.mutateAsync({ montoExpensas: nuevoNum, motivo: motivo.trim() || undefined });
      const n = res.liquidacionesReajustadas;
      toast({
        variant: 'success',
        title: 'Expensas actualizadas',
        description:
          `Nuevas expensas ${formatMonto(nuevoNum, moneda)}. ` +
          (n > 0
            ? `Se actualizaron ${n} cuota${n === 1 ? '' : 's'} impaga${n === 1 ? '' : 's'}.`
            : 'No había cuotas impagas para actualizar.'),
      });
      setOpen(false);
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: 'No se pudieron cambiar las expensas',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo.',
      });
    }
  };

  const descripcion = (
    <span className="block space-y-3 text-xs">
      <span className="block text-muted-foreground">
        Expensas actuales:{' '}
        <strong className="text-foreground">{actual > 0 ? formatMonto(actual, moneda) : 'sin expensas'}</strong>. El
        monto nuevo actualiza las cuotas impagas de este mes en adelante. No toca las ya pagadas, las
        que tienen un pago informado, ni los meses anteriores.
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Nuevas expensas</span>
        <MoneyInput
          value={monto}
          onChange={setMonto}
          moneda={moneda}
          className="inline-block w-36"
          placeholder="0"
        />
      </span>
      {nuevoNum > 0 && actual > 0 && nuevoNum !== actual && (
        <span className={`block text-right ${pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {pct >= 0 ? '+' : ''}
          {pct}% vs actual
        </span>
      )}
      {ceroProhibido && (
        <span className="block text-destructive">
          Este contrato es de solo expensas: el monto tiene que ser mayor a cero.
        </span>
      )}
      {/* Cambiar el monto puede cambiar QUÉ es el contrato, y el inquilino lo ve
          en la PWA. Se avisa antes, no después. */}
      {tipoContrato === 'ALQUILER' && nuevoNum > 0 && (
        <span className="block text-muted-foreground">
          Este contrato hoy no tiene expensas: al cargarlas pasa a ser de <strong>alquiler + expensas</strong>.
        </span>
      )}
      {tipoContrato === 'ALQUILER_Y_EXPENSAS' && monto !== '' && nuevoNum === 0 && (
        <span className="block text-muted-foreground">
          Al dejarlas en cero, el contrato pasa a ser de <strong>solo alquiler</strong>.
        </span>
      )}
      <input
        type="text"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1"
        placeholder="Motivo (ej. liquidación de agosto del consorcio) — opcional"
        maxLength={200}
      />
    </span>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="h-4 w-4" />
        Cambiar expensas
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cambiar las expensas"
        description={descripcion}
        confirmLabel="Guardar expensas"
        loading={cambiar.isPending}
        onConfirm={confirmar}
      />
    </>
  );
}
