'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  FileText,
  ReceiptText,
  XCircle,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { type PagoInformado, pagosInformadosMock } from '@/lib/mock-data';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';
import {
  conciliarPago,
  estadoDePago,
  rechazarPago,
} from '@/lib/conciliacion-storage';

// Sección "Por validar" en /pagos del admin. Muestra los comprobantes que
// los inquilinos subieron y todavía no fueron conciliados. Cuando el admin
// confirma o rechaza, se persiste en localStorage y el pago se saca de la
// lista visible.

const metodoLabel: Record<PagoInformado['metodo'], string> = {
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'Mercado Pago',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
};

export function PagosPorValidar() {
  const [acciones, setAcciones] = useState<Record<string, 'CONCILIADO' | 'RECHAZADO'>>({});
  const [hidratado, setHidratado] = useState(false);
  const [verComprobante, setVerComprobante] = useState<PagoInformado | null>(null);
  const [rechazando, setRechazando] = useState<PagoInformado | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  useEffect(() => {
    setHidratado(true);
    refrescar();
  }, []);

  const refrescar = () => {
    const map: Record<string, 'CONCILIADO' | 'RECHAZADO'> = {};
    pagosInformadosMock.forEach((p) => {
      const e = estadoDePago(p.id);
      if (e !== 'INFORMADO') map[p.id] = e;
    });
    setAcciones(map);
  };

  const pendientes = useMemo(
    () => pagosInformadosMock.filter((p) => !acciones[p.id]),
    [acciones],
  );

  const handleConciliar = (pago: PagoInformado) => {
    conciliarPago(pago.id, 'Roberto Tapia');
    refrescar();
    toast({
      title: `Pago de ${pago.inquilino} confirmado`,
      description: `${formatMonto(pago.monto)} · ${formatPeriodo(pago.periodo)}`,
    });
  };

  const handleRechazar = () => {
    if (!rechazando) return;
    if (!motivoRechazo.trim()) {
      toast({ title: 'Tenés que escribir el motivo', variant: 'destructive' });
      return;
    }
    rechazarPago(rechazando.id, 'Roberto Tapia', motivoRechazo.trim());
    refrescar();
    toast({
      title: 'Pago rechazado',
      description: `Le avisamos a ${rechazando.inquilino} con tu nota.`,
    });
    setRechazando(null);
    setMotivoRechazo('');
  };

  if (!hidratado) return null;
  if (pendientes.length === 0) return null;

  return (
    <>
      <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-semibold">Pagos por validar</h2>
            </div>
            <Badge variant="warning" className="shrink-0">
              {pendientes.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Tus inquilinos informaron estos pagos. Verificá el comprobante y confirmá o
            rechazá.
          </p>

          <div className="space-y-3">
            {pendientes.map((p) => (
              <PagoRow
                key={p.id}
                pago={p}
                onConciliar={() => handleConciliar(p)}
                onRechazar={() => setRechazando(p)}
                onVerComprobante={() => setVerComprobante(p)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal comprobante */}
      <Dialog open={!!verComprobante} onOpenChange={(v) => !v && setVerComprobante(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comprobante de {verComprobante?.inquilino}</DialogTitle>
            <DialogDescription>
              {verComprobante &&
                `${formatPeriodo(verComprobante.periodo)} · ${formatMonto(verComprobante.monto)} · ${metodoLabel[verComprobante.metodo]}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid h-48 place-items-center rounded-md border bg-muted text-center text-xs text-muted-foreground">
              <div className="space-y-1">
                <FileText className="mx-auto h-10 w-10" />
                <p>Vista del comprobante (PDF/imagen)</p>
                <p>En producción se carga acá el archivo real.</p>
              </div>
            </div>
            {verComprobante?.notaInquilino && (
              <div className="rounded-md bg-muted/50 p-3 text-xs">
                <p className="font-medium">Nota del inquilino:</p>
                <p className="text-muted-foreground">{verComprobante.notaInquilino}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (!verComprobante) return;
                  setRechazando(verComprobante);
                  setVerComprobante(null);
                }}
              >
                <XCircle className="h-4 w-4" />
                Rechazar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!verComprobante) return;
                  handleConciliar(verComprobante);
                  setVerComprobante(null);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal rechazo con motivo */}
      <Dialog
        open={!!rechazando}
        onOpenChange={(v) => {
          if (!v) {
            setRechazando(null);
            setMotivoRechazo('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar el pago de {rechazando?.inquilino}</DialogTitle>
            <DialogDescription>
              Le va a llegar la notificación con tu motivo. Probá ser claro para que
              corrija rápido.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Ej: el comprobante no se ve, mandá la imagen de nuevo."
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRechazando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleRechazar}>
              Rechazar pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PagoRow({
  pago,
  onConciliar,
  onRechazar,
  onVerComprobante,
}: {
  pago: PagoInformado;
  onConciliar: () => void;
  onRechazar: () => void;
  onVerComprobante: () => void;
}) {
  return (
    <Card className="space-y-3 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Banknote className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{pago.inquilino}</p>
            <p className="truncate text-xs text-muted-foreground">{pago.direccion}</p>
          </div>
        </div>
        <p className="shrink-0 text-base font-semibold tabular-nums">
          {formatMonto(pago.monto)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs">
        <Field label="Período" value={formatPeriodo(pago.periodo)} />
        <Field label="Método" value={metodoLabel[pago.metodo]} />
        <Field label="Transfirió" value={formatFecha(pago.fechaTransferencia)} />
        <Field
          label="Informado"
          value={`${formatFecha(pago.informadoAt)} ${new Date(pago.informadoAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
        />
      </div>

      {pago.notaInquilino && (
        <p className="rounded-md bg-muted/30 p-2 text-xs italic text-muted-foreground">
          “{pago.notaInquilino}”
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onVerComprobante}>
          <ExternalLink className="h-3.5 w-3.5" />
          Ver comprobante
        </Button>
        <Button size="sm" variant="outline" onClick={onRechazar}>
          <XCircle className="h-3.5 w-3.5" />
          Rechazar
        </Button>
        <Button size="sm" onClick={onConciliar} className="ml-auto">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirmar pago
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('min-w-0')}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
