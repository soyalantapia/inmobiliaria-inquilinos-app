'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, KeyRound } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { diasHastaVencimiento, formatMonto } from '@/lib/format';
import { liquidacionesMock } from '@/lib/mock-data';

// Tracker visual del depósito: cuánto te van a devolver al final del contrato.
// Lo calculamos sumando posibles descuentos (deudas pendientes) sobre el monto
// original del depósito.

interface Props {
  depositoOriginal: number;
  fechaFin: string;
}

export function DepositoTracker({ depositoOriginal, fechaFin }: Props) {
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setHidratado(true);
  }, []);

  if (!hidratado) return null;

  // Descuento por deudas: liquidaciones vencidas
  const descuentoDeudas = liquidacionesMock
    .filter((l) => l.estado === 'VENCIDO')
    .reduce((acc, l) => acc + l.montoTotal, 0);

  const aDevolver = Math.max(0, depositoOriginal - descuentoDeudas);
  const porcentajeDevolver = (aDevolver / depositoOriginal) * 100;
  const diasFin = diasHastaVencimiento(fechaFin);
  const tieneRiesgo = descuentoDeudas > 0;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Estado del depósito</h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          al finalizar el contrato
        </span>
      </div>

      {/* Monto principal */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums">{formatMonto(aDevolver)}</p>
          <p className="text-xs text-muted-foreground">
            de {formatMonto(depositoOriginal)}
          </p>
        </div>
        {/* Copy más directo — antes era "Tu deuda actual reduciría tu depósito
            al X%. Saldarla te devuelve el total." que combinaba dos ideas y
            sonaba condicional/alejado. Ahora separamos en dos frases claras. */}
        <p className="text-xs text-muted-foreground">
          {tieneRiesgo
            ? `Con tu deuda actual, te devolverían el ${Math.round(porcentajeDevolver)}%. Si la saldás antes, recuperás todo.`
            : 'Si no hay daños ni deudas, te devuelven el total.'}
        </p>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            porcentajeDevolver >= 90
              ? 'bg-emerald-500'
              : porcentajeDevolver >= 60
                ? 'bg-amber-500'
                : 'bg-red-500',
          )}
          style={{ width: `${porcentajeDevolver}%` }}
        />
      </div>

      {/* Descuentos posibles */}
      {tieneRiesgo && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-medium">Descuentos estimados</p>
          <DescuentoRow
            label="Deuda actual"
            value={descuentoDeudas}
            hint="Liquidaciones vencidas sin pagar"
          />
        </div>
      )}

      {/* Info estado.
          Quitamos "Fin del contrato" — ya está en el card resumen
          ("Te quedan 2 años y 3 meses"). Acá dejamos solo cuándo te
          devuelven el depósito, que es info específica de este tracker. */}
      <div className="space-y-2 border-t pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Te devuelven</span>
          <span className="font-medium tabular-nums">
            {diasFin > 60 ? '~30 días después de entregar llaves' : 'a la entrega de llaves'}
          </span>
        </div>
      </div>

      {/* CTA cuando hay deuda — lleva a /comprobantes (gestión de pagos). */}
      {descuentoDeudas > 0 && (
        <Link
          href="/comprobantes"
          className="flex items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Regularizar deuda para recuperar el total</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </Card>
  );
}

function DescuentoRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/70">{hint}</p>
      </div>
      <p className="shrink-0 font-medium tabular-nums text-red-600">
        − {formatMonto(value)}
      </p>
    </div>
  );
}
