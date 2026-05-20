'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Loader2,
  MessageCircle,
  Receipt,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  marcarRendido,
  obtenerRendicion,
  periodoActual,
  type Rendicion,
} from '@/lib/rendiciones-storage';
import { registrarEvento } from '@/lib/auditoria-storage';
import { gastosAtribuidos, type GastoAtribuido } from '@/lib/gastos-rendicion';
import type { Propietario } from '@/lib/types';
import { formatMonto } from '@/lib/format';

/**
 * Dialog para marcar como rendido el mes al propietario.
 *
 * Muestra el desglose: bruto cobrado, comisión, neto a transferir, CBU
 * del propietario. Al confirmar persiste y opcionalmente abre WhatsApp
 * con un comprobante pre-armado.
 */

interface RendirPropietarioDialogProps {
  propietario: Propietario | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRendido?: (rendicion: Rendicion) => void;
}

const periodoLabel = (p: string): string => {
  const [year, month] = p.split('-');
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${meses[parseInt(month!, 10) - 1]} ${year}`;
};

export function RendirPropietarioDialog({
  propietario,
  open,
  onOpenChange,
  onRendido,
}: RendirPropietarioDialogProps) {
  const [metodo, setMetodo] = useState<Rendicion['metodo']>('TRANSFERENCIA');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [gastosOpen, setGastosOpen] = useState(true);
  const periodo = periodoActual();
  const yaRendido = propietario ? obtenerRendicion(propietario.id, periodo) : null;

  // Gastos del período (caja + trabajos DESPERFECTO con costo cargado).
  // Si ya rendimos, esto devuelve el snapshot guardado.
  const gastos = useMemo<GastoAtribuido[]>(() => {
    if (!propietario) return [];
    return gastosAtribuidos(propietario.id, periodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propietario, periodo, open]);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  useEffect(() => {
    if (open) {
      setMetodo('TRANSFERENCIA');
      setNotas('');
      setGuardando(false);
      setGastosOpen(true);
    }
  }, [open]);

  if (!propietario) return null;

  const bruto = propietario.totalCobradoMes;
  const comisionMonto = Math.round(bruto * (propietario.comisionPct / 100));
  const neto = bruto - comisionMonto - totalGastos;

  const copiarCbu = async () => {
    if (!propietario.cbuAlias) return;
    try {
      await navigator.clipboard.writeText(propietario.cbuAlias);
      toast({ title: 'CBU/Alias copiado' });
    } catch {
      toast({ title: 'No pudimos copiar', variant: 'destructive' });
    }
  };

  const handleRendir = async (alsoWhatsapp: boolean) => {
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 300));
    const rendicion = marcarRendido({
      propietarioId: propietario.id,
      periodo,
      montoBruto: bruto,
      comisionPct: propietario.comisionPct,
      gastos,
      metodo,
      notas: notas.trim() || undefined,
    });
    registrarEvento({
      tipo: 'PROPIETARIO_RENDIDO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: rendicion.id,
      entidadDescripcion: `${propietario.nombre} ${propietario.apellido} · ${periodoLabel(periodo)}`,
      detalle: `${formatMonto(rendicion.montoNeto)} · ${metodo.toLowerCase()}`,
    });
    toast({
      variant: 'success',
      title: `¡${propietario.nombre} rendido!`,
      description: `Transferimos ${formatMonto(rendicion.montoNeto)} por ${metodo.toLowerCase()}.`,
    });
    onRendido?.(rendicion);
    onOpenChange(false);

    if (alsoWhatsapp) {
      const mensaje = mensajeRendicion(propietario, rendicion);
      const tel = propietario.telefono.replace(/[^\d]/g, '');
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    setGuardando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Rendir a {propietario.nombre} {propietario.apellido}
          </DialogTitle>
          <DialogDescription>
            Período: <strong>{periodoLabel(periodo)}</strong>
            {yaRendido && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Ya rendido
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Desglose */}
        <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
          <DesgloseRow label="Bruto cobrado" value={formatMonto(bruto)} />
          <DesgloseRow
            label={`Comisión inmo (${propietario.comisionPct}%)`}
            value={`− ${formatMonto(comisionMonto)}`}
            muted
          />

          {/* Bloque de gastos atribuidos (collapsable) */}
          {gastos.length > 0 ? (
            <div className="rounded-md border border-amber-200/60 bg-amber-50/40 p-2 dark:border-amber-900/30 dark:bg-amber-900/10">
              <button
                type="button"
                onClick={() => setGastosOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Gastos del mes ({gastos.length})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                    − {formatMonto(totalGastos)}
                  </span>
                  {gastosOpen ? (
                    <ChevronUp className="h-3 w-3 text-amber-700 dark:text-amber-300" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-amber-700 dark:text-amber-300" />
                  )}
                </div>
              </button>
              {gastosOpen && (
                <div className="mt-2 space-y-1.5">
                  {gastos.map((g) => (
                    <GastoRow key={g.refId} gasto={g} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-background/40 p-2 text-[11px] text-muted-foreground">
              Sin gastos atribuidos este mes — la rendición se transfiere
              completa (menos comisión).
            </div>
          )}

          <div className="my-2 border-t" />
          <DesgloseRow
            label="A transferir"
            value={formatMonto(neto)}
            highlight
          />
        </div>

        {/* CBU / Alias */}
        {propietario.cbuAlias ? (
          <div className="space-y-1">
            <Label className="text-xs">Datos para transferir</Label>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <code className="flex-1 truncate font-mono text-xs">
                {propietario.cbuAlias}
              </code>
              <Button size="sm" variant="ghost" onClick={copiarCbu}>
                <Copy className="h-3 w-3" />
                Copiar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
            <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="space-y-0.5">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Sin CBU/Alias cargado
              </p>
              <p className="text-amber-800/80 dark:text-amber-300/80">
                Pediselo al propietario antes de transferir.
              </p>
            </div>
          </div>
        )}

        {/* Método */}
        <div className="space-y-1">
          <Label className="text-xs">Método de transferencia</Label>
          <Select value={metodo} onValueChange={(v) => setMetodo(v as Rendicion['metodo'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TRANSFERENCIA">Transferencia bancaria</SelectItem>
              <SelectItem value="MERCADOPAGO">Mercado Pago</SelectItem>
              <SelectItem value="EFECTIVO">Efectivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notas (opcional)</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Ej: Adelanto del 50%, descuento por reparación..."
          />
        </div>

        <Badge variant="outline" className="text-[10px]">
          Modo demo · la transferencia se simula
        </Badge>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleRendir(false)}
            disabled={guardando}
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Marcar como rendido
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={() => handleRendir(true)}
            disabled={guardando}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Rendir + WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DesgloseRow({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        highlight ? 'text-base font-semibold text-primary' : ''
      } ${muted ? 'text-muted-foreground' : ''}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function GastoRow({ gasto }: { gasto: GastoAtribuido }) {
  const icon =
    gasto.tipo === 'TRABAJO' ? (
      <Wrench className="h-3 w-3 text-primary" />
    ) : (
      <Receipt className="h-3 w-3 text-amber-700 dark:text-amber-300" />
    );
  return (
    <div className="flex items-start gap-2 rounded bg-background/40 px-2 py-1.5">
      <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-amber-100 dark:bg-amber-900/30">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium">{gasto.descripcion}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {gasto.proveedor ? `${gasto.proveedor} · ` : ''}
          {gasto.fecha}
          {gasto.participacion < 1 && (
            <span> · {Math.round(gasto.participacion * 100)}% de tu parte</span>
          )}
        </p>
      </div>
      <p
        className={cn(
          'shrink-0 text-xs font-semibold tabular-nums text-amber-900 dark:text-amber-200',
        )}
      >
        − {formatMonto(gasto.monto)}
      </p>
    </div>
  );
}

/* ============================================================
 * Helpers exportados para reuso en cards
 * ============================================================ */
export function mensajeRendicion(prop: Propietario, rend: Rendicion): string {
  const nombrePila = prop.nombre.split(' ')[0] ?? prop.nombre;
  const comisionMonto = Math.round(rend.montoBruto * (rend.comisionPct / 100));
  const gastos = rend.gastos ?? [];
  const detalleGastos =
    gastos.length > 0
      ? `\n*Gastos del mes:* -${formatMonto(rend.totalGastos ?? 0)}\n` +
        gastos
          .map((g) => {
            const prov = g.proveedor ? `${g.proveedor} · ` : '';
            return `  • ${prov}${g.descripcion} (${formatMonto(g.monto)})`;
          })
          .join('\n') +
        '\n'
      : '';
  return (
    `Hola ${nombrePila}! Te paso la rendición de ${periodoLabel(rend.periodo)}:\n\n` +
    `*Bruto cobrado:* ${formatMonto(rend.montoBruto)}\n` +
    `*Comisión (${rend.comisionPct}%):* -${formatMonto(comisionMonto)}\n` +
    detalleGastos +
    `\n*A transferirte:* ${formatMonto(rend.montoNeto)}\n\n` +
    `Te transferimos por ${rend.metodo.toLowerCase()} en el día. ` +
    `Cualquier cosa avisame.`
  );
}

export function mensajePedirCbu(prop: Propietario): string {
  const nombrePila = prop.nombre.split(' ')[0] ?? prop.nombre;
  return (
    `Hola ${nombrePila}! Estamos por rendirte la cobranza del mes. ` +
    `¿Me podés pasar tu CBU o alias para transferirte? ¡Gracias!`
  );
}
