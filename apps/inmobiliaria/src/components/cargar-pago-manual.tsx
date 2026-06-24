'use client';

import { useEffect, useState } from 'react';
import { Banknote, Plus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { contratosMock } from '@/lib/mock-data';
import { conciliarPago } from '@/lib/conciliacion-storage';
import { formatMonto, fechaHoyLocal } from '@/lib/format';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';

// Dialog para que la administradora cargue manualmente un pago que recibió
// (efectivo, transferencia que vino fuera de la app, cheque). Se concilia
// automáticamente porque la admin lo está confirmando.

type MetodoManual = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'MERCADOPAGO';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}

export function CargarPagoManualDialog({ open, onOpenChange, onDone }: Props) {
  const [contratoId, setContratoId] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoManual>('EFECTIVO');
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [nota, setNota] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (open) {
      setContratoId('');
      setMonto('');
      setMetodo('EFECTIVO');
      setFecha(fechaHoyLocal());
      setNota('');
      setShowPin(false);
    }
  }, [open]);

  const contratoSel = contratosMock.find((c) => c.id === contratoId);

  // Si elegís contrato pero no escribiste monto, sugerimos el del contrato.
  useEffect(() => {
    if (contratoSel && !monto) {
      setMonto(String(contratoSel.monto));
    }
  }, [contratoSel, monto]);

  // Validar y pedir PIN. Conciliar un pago es una acción que el modelo de
  // permisos marca con requierePin (permisos.ts: pago.conciliar) — el resto de
  // los flujos de conciliación pasan por PinPromptDialog. Antes esta ruta
  // llamaba conciliarPago() directo, bypasseando el 2º factor.
  const guardar = () => {
    if (!contratoSel) {
      toast({ title: 'Elegí un contrato', variant: 'destructive' });
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast({ title: 'El monto tiene que ser positivo', variant: 'destructive' });
      return;
    }
    setShowPin(true);
  };

  // Se ejecuta sólo tras confirmar el PIN. Genera un id sintético y marca el
  // pago como CONCILIADO (no nace de una liquidación → liqId null).
  const confirmarConPin = () => {
    if (!contratoSel) return;
    const montoNum = Number(monto);
    const pagoId = `pag_manual_${contratoSel.id}_${fecha}`;
    conciliarPago(pagoId, 'Roberto Tapia', {
      observacion: `Pago manual · ${metodo} · ${formatMonto(montoNum)}${nota ? ` · ${nota}` : ''}`,
    });
    toast({
      title: `Pago de ${contratoSel.inquilino} cargado`,
      description: `${formatMonto(montoNum)} · ${metodo.toLowerCase()}`,
    });
    setShowPin(false);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar pago manual</DialogTitle>
          <DialogDescription>
            Para cuando recibís el pago en efectivo, por transferencia directa, cheque o
            cualquier vía que no pasó por la app del inquilino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cpm-contrato" className="text-xs" aria-required>
              Contrato <span className="text-destructive">*</span>
            </Label>
            <select
              id="cpm-contrato"
              value={contratoId}
              onChange={(e) => {
                setContratoId(e.target.value);
                setMonto('');
              }}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Elegí un contrato…</option>
              {contratosMock
                .filter((c) => c.estado === 'ACTIVO')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.inquilino} · {c.direccion}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cpm-monto" className="text-xs" aria-required>
                Monto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cpm-monto"
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                required
              />
              {contratoSel && (
                <p className="text-[10px] text-muted-foreground">
                  Sugerido: {formatMonto(contratoSel.monto, contratoSel.moneda)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cpm-metodo" className="text-xs">Método</Label>
              <select
                id="cpm-metodo"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoManual)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
                <option value="MERCADOPAGO">Mercado Pago</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cpm-fecha" className="text-xs">Fecha de cobro</Label>
            <Input id="cpm-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cpm-nota" className="text-xs">Nota (opcional)</Label>
            <Textarea
              id="cpm-nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: vino al estudio el viernes, pagó en efectivo."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar}>
            <Banknote className="h-4 w-4" />
            Registrar cobro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <PinPromptDialog
      abierto={showPin}
      accion="Confirmar cobro manual"
      subaccion={contratoSel ? `${contratoSel.inquilino} · ${formatMonto(Number(monto) || 0)}` : undefined}
      onClose={() => setShowPin(false)}
      onConfirmado={() => confirmarConPin()}
    />
    </>
  );
}

/** Botón compacto para abrir el dialog. Reusable desde cualquier pantalla. */
export function CargarPagoManualButton({
  variant = 'default',
}: {
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Cargar pago
      </Button>
      <CargarPagoManualDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
