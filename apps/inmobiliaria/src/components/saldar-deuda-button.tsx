'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HandCoins } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, apiFetch, varianteError } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { formatMonto } from '@/lib/format';
import type { Moneda } from '@/lib/types';

const METODOS = ['TRANSFERENCIA', 'EFECTIVO', 'MERCADOPAGO', 'CHEQUE'] as const;
type Metodo = (typeof METODOS)[number];

/**
 * Registra el cobro (o condona) la deuda vencida de un contrato — pensado para las
 * cuentas por cobrar de EX-inquilinos, cuyo pago no se puede informar por la vía normal
 * (exigirContratoActivo la bloquea). Crea un Pago CONCILIADO por cada cuota vencida.
 */
export function SaldarDeudaButton({ contratoId, deuda, moneda }: { contratoId: string; deuda: number; moneda: Moneda }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>('TRANSFERENCIA');
  const [condonar, setCondonar] = useState(false);

  useEffect(() => {
    if (open) { setMetodo('TRANSFERENCIA'); setCondonar(false); }
  }, [open]);

  const saldar = useMutation({
    mutationFn: async () => {
      await ensureApiSession();
      return apiFetch<{ liquidacionesSaldadas: number; montoAplicado: number }>(
        `/contratos/${contratoId}/saldar-deuda`,
        { method: 'POST', body: JSON.stringify({ metodo, condonar: condonar || undefined }) },
      );
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['persona'] });
      qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      // Crea Pagos CONCILIADO y salda cuotas → refrescar también las listas
      // globales de pagos y liquidaciones (mismo patrón que use-pagos/cargar-pago).
      qc.invalidateQueries({ queryKey: ['pagos'] });
      qc.invalidateQueries({ queryKey: ['liquidaciones'] });
      toast({
        variant: 'success',
        title: condonar ? 'Deuda condonada' : 'Cobro registrado',
        description: `${res.liquidacionesSaldadas} cuota${res.liquidacionesSaldadas === 1 ? '' : 's'} por ${formatMonto(res.montoAplicado, moneda)}.`,
      });
      setOpen(false);
    },
    onError: (e) => {
      toast({ variant: varianteError(e), title: 'No se pudo saldar', description: e instanceof ApiError ? e.message : 'Probá de nuevo.' });
    },
  });

  const chipCls = (activo: boolean) =>
    `rounded-full border px-2 py-0.5 text-[11px] transition-colors ${activo ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`;

  const descripcion = (
    <span className="block space-y-3 text-xs">
      <span className="block text-muted-foreground">
        Deuda vencida a saldar: <strong className="text-foreground">{formatMonto(deuda, moneda)}</strong>. Se registra un
        cobro conciliado por cada cuota vencida y quedan marcadas como pagadas.
      </span>
      <span className="block">
        <span className="mb-1 block font-medium text-foreground">Método</span>
        <span className="flex flex-wrap gap-1">
          {METODOS.map((m) => (
            <button key={m} type="button" className={chipCls(metodo === m && !condonar)} onClick={() => { setMetodo(m); setCondonar(false); }}>
              {m.charAt(0) + m.slice(1).toLowerCase()}
            </button>
          ))}
          <button type="button" className={chipCls(condonar)} onClick={() => setCondonar(true)}>
            Condonar
          </button>
        </span>
      </span>
    </span>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" />
        Saldar deuda
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={condonar ? '¿Condonar la deuda?' : '¿Registrar el cobro?'}
        description={descripcion}
        confirmLabel={condonar ? 'Condonar' : 'Registrar cobro'}
        loading={saldar.isPending}
        onConfirm={() => saldar.mutate()}
      />
    </>
  );
}
