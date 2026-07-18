'use client';

/**
 * Diálogo para resolver el depósito de garantía al egreso del inquilino:
 * devolver todo / devolver menos (netear por deuda o daños) / pelear-retener.
 * Antes esto solo existía en la rescisión → un contrato finalizado dejaba el
 * depósito trabado en "En custodia". Postea a POST /contratos/:id/deposito/resolver.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { Button } from '@llave/ui/button';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { MoneyInput } from '@/components/money-input';
import { formatMonto } from '@/lib/format';
import type { DecisionDeposito, DepositoContrato } from '@/lib/api/use-depositos';

const OPCIONES: { value: DecisionDeposito; label: string; desc: string }[] = [
  { value: 'DEVOLVER', label: 'Devolver todo', desc: 'Le devolvés el disponible completo.' },
  { value: 'NETEAR', label: 'Devolver menos', desc: 'Retenés una parte (deuda/daños) y devolvés el resto.' },
  { value: 'EJECUTAR', label: 'Pelear / retener', desc: 'Retenés todo el depósito (no se devuelve).' },
];

export function ResolverDepositoDialog({
  deposito,
  resolver,
  onClose,
}: {
  deposito: DepositoContrato | null;
  resolver: (contratoId: string, decision: DecisionDeposito, monto: number, motivo?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<DecisionDeposito>('DEVOLVER');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Al abrir un depósito, precargamos "devolver todo el disponible".
  useEffect(() => {
    if (deposito) {
      setDecision('DEVOLVER');
      setMonto(String(Math.round(deposito.disponible)));
      setMotivo('');
    }
  }, [deposito]);

  const cambiarDecision = (d: DecisionDeposito) => {
    setDecision(d);
    // DEVOLVER (todo) = disponible completo. EJECUTAR (retener todo) = 0.
    // NETEAR (devolver menos) = vacío: la inmo tiene que decidir cuánto devuelve;
    // antes se pre-llenaba con el total y era fácil devolver de más sin querer.
    if (deposito) setMonto(d === 'DEVOLVER' ? String(Math.round(deposito.disponible)) : d === 'EJECUTAR' ? '0' : '');
  };

  const confirmar = async () => {
    if (!deposito) return;
    const montoNum = Number(monto) || 0;
    if ((decision === 'NETEAR' || decision === 'EJECUTAR') && !motivo.trim()) {
      toast({ title: 'Contá por qué retenés', description: 'Poné el motivo (deuda, daños, etc.).', variant: 'destructive' });
      return;
    }
    // "Devolver menos" = devolver algo, pero menos que el total.
    if (decision === 'NETEAR' && !(montoNum > 0 && montoNum < deposito.disponible)) {
      toast({ title: 'Revisá el monto a devolver', description: `Tiene que ser mayor a $0 y menor a ${formatMonto(deposito.disponible)} (lo disponible). Si devolvés todo usá "Devolver", y si no devolvés nada usá "Retener todo".`, variant: 'destructive' });
      return;
    }
    setGuardando(true);
    try {
      await resolver(deposito.contratoId, decision, montoNum, motivo.trim() || undefined);
      toast({ title: 'Depósito resuelto' });
      onClose();
    } catch (e) {
      toast({ title: 'No se pudo resolver', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!deposito} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver depósito</DialogTitle>
          <DialogDescription>
            {deposito?.inquilino} · {deposito?.propiedad}
          </DialogDescription>
        </DialogHeader>
        {deposito && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">En custodia</span>
                <span className="font-medium tabular-nums">{formatMonto(deposito.monto, deposito.moneda)}</span>
              </div>
              {deposito.deducciones > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deducciones (reparaciones)</span>
                  <span className="tabular-nums text-amber-700 dark:text-amber-300">
                    − {formatMonto(deposito.deducciones, deposito.moneda)}
                  </span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t pt-1">
                <span className="font-medium">Disponible para devolver</span>
                <span className="font-semibold tabular-nums">{formatMonto(deposito.disponible, deposito.moneda)}</span>
              </div>
            </div>

            <div className="grid gap-2">
              {OPCIONES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => cambiarDecision(o.value)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    decision === o.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <p className="font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.desc}</p>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="dep-monto" className="text-xs">Monto que le devolvés</Label>
              <MoneyInput
                id="dep-monto"
                value={monto}
                onChange={setMonto}
                moneda={deposito.moneda}
                disabled={decision === 'EJECUTAR'}
              />
            </div>

            {(decision === 'NETEAR' || decision === 'EJECUTAR') && (
              <div className="space-y-1">
                <Label htmlFor="dep-motivo" className="text-xs">Motivo (por qué retenés)</Label>
                <Textarea
                  id="dep-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: deuda de 1 mes + reparación de la cocina"
                  rows={2}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
