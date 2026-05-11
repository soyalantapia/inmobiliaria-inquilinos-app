'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, KeyRound, Wallet } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { diasHastaVencimiento, formatMonto } from '@/lib/format';
import { leerInventario } from '@/lib/inventario-storage';
import { liquidacionesMock } from '@/lib/mock-data';

// Tracker visual del depósito: cuánto te van a devolver al final del contrato.
// Lo calculamos sumando posibles descuentos (items en mal estado del inventario
// + deudas pendientes) sobre el monto original del depósito.

interface Props {
  depositoOriginal: number;
  fechaFin: string;
}

export function DepositoTracker({ depositoOriginal, fechaFin }: Props) {
  const [descuentoInventario, setDescuentoInventario] = useState(0);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    const inv = leerInventario();
    // Estimación: cada item en mal estado o faltante penaliza un 3% del depósito
    const malos = inv.items.filter((i) => i.estado === 'MALO' || i.estado === 'FALTANTE').length;
    setDescuentoInventario(Math.round(depositoOriginal * 0.03 * malos));
    setHidratado(true);
  }, [depositoOriginal]);

  if (!hidratado) return null;

  // Descuento por deudas: liquidaciones vencidas
  const descuentoDeudas = liquidacionesMock
    .filter((l) => l.estado === 'VENCIDO')
    .reduce((acc, l) => acc + l.montoTotal, 0);

  const aDevolver = Math.max(0, depositoOriginal - descuentoInventario - descuentoDeudas);
  const porcentajeDevolver = (aDevolver / depositoOriginal) * 100;
  const diasFin = diasHastaVencimiento(fechaFin);
  const tieneRiesgo = descuentoInventario > 0 || descuentoDeudas > 0;

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
        <p className="text-xs text-muted-foreground">
          {tieneRiesgo
            ? `Hoy te devolverían el ${Math.round(porcentajeDevolver)}% si entregaras así.`
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
          {descuentoDeudas > 0 && (
            <DescuentoRow
              label="Deuda actual"
              value={descuentoDeudas}
              hint="Liquidaciones vencidas sin pagar"
            />
          )}
          {descuentoInventario > 0 && (
            <DescuentoRow
              label="Items en mal estado"
              value={descuentoInventario}
              hint="3% por item con MALO o FALTANTE"
            />
          )}
        </div>
      )}

      {/* Info estado */}
      <div className="space-y-2 border-t pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fin del contrato</span>
          <span className="font-medium tabular-nums">en {diasFin} días</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Te devuelven</span>
          <span className="font-medium tabular-nums">
            {diasFin > 60 ? '~30 días después' : 'a la entrega de llaves'}
          </span>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/inventario"
          className="flex flex-1 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ver inventario</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
        {descuentoDeudas > 0 && (
          <Link
            href="/"
            className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Saldar deuda</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
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
