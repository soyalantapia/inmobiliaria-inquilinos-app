'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card } from '@llave/ui/card';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import type { Liquidacion } from '@/lib/types';

/**
 * Card principal del home del inquilino con el próximo pago.
 *
 * - Si está al día / urgente / vencido pinta un gradient distinto.
 * - Cuando está vencido, la vista compacta muestra sólo "incluye X de recargo".
 *   Se puede expandir con un botón inline (Ver desglose) sin disparar la
 *   navegación al detalle del pago.
 */
export function PaymentHero({
  liq,
  ajusteCritico,
  diasAjuste,
}: {
  liq: Liquidacion;
  ajusteCritico: boolean;
  diasAjuste: number;
}) {
  const [desgloseAbierto, setDesgloseAbierto] = useState(false);
  const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
  const diasV = diasHastaVencimiento(liq.fechaVencimiento);
  const vencido = calc.diasAtraso > 0;
  const urgente = !vencido && diasV >= 0 && diasV <= 3;

  const bg = vencido
    ? 'from-red-600 to-red-500'
    : urgente
      ? 'from-amber-600 to-amber-500'
      : 'from-primary to-primary/80';

  // Detener la navegación al apretar el toggle del desglose.
  const toggleDesglose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDesgloseAbierto((v) => !v);
  };

  return (
    <Link href={`/pago/${liq.id}`} className="block">
      <Card
        className={`relative overflow-hidden border-0 p-6 text-primary-foreground shadow-xl shadow-primary/30 transition-transform active:scale-[0.99] md:p-8 bg-gradient-to-br ${bg}`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/5 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-80">
              {vencido ? 'Atrasado' : 'Tu próximo pago'}
            </p>
            {vencido ? (
              <AlertTriangle className="h-4 w-4 opacity-90" />
            ) : (
              <CalendarClock className="h-4 w-4 opacity-80" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-4xl font-bold leading-none tracking-tight md:text-5xl">
              {formatMonto(calc.totalAPagar, liq.moneda)}
            </p>
            <p className="text-sm opacity-90">
              {vencido
                ? `${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} de atraso · venció ${formatFecha(liq.fechaVencimiento)}`
                : diasV === 0
                  ? 'Vence hoy'
                  : `Vence en ${diasV} día${diasV === 1 ? '' : 's'} · ${formatFecha(liq.fechaVencimiento)}`}
            </p>
          </div>

          {/* Resumen compacto del recargo + toggle */}
          {vencido && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={toggleDesglose}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs backdrop-blur transition-colors hover:bg-white/20"
                aria-expanded={desgloseAbierto}
                aria-controls="payment-desglose"
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Incluye{' '}
                  <strong className="tabular-nums">
                    {formatMonto(calc.punitorioAcumulado, liq.moneda)}
                  </strong>{' '}
                  de recargo
                </span>
                <span className="flex items-center gap-1 opacity-90">
                  {desgloseAbierto ? 'Ocultar' : 'Ver desglose'}
                  {desgloseAbierto ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>

              {/* Desglose detallado: aparece sólo si el usuario lo abre */}
              {desgloseAbierto && (
                <div
                  id="payment-desglose"
                  onClick={(e) => e.preventDefault()}
                  className="space-y-2 rounded-lg bg-white/15 p-3 text-xs backdrop-blur animate-fade-in"
                >
                  <DesgloseRow
                    label="Alquiler + expensas"
                    value={formatMonto(calc.montoOriginal, liq.moneda)}
                  />
                  <DesgloseRow
                    label={`Intereses (${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} × ${calc.tasaDiariaPct}%)`}
                    value={`+ ${formatMonto(calc.punitorioAcumulado, liq.moneda)}`}
                    emphasize
                  />
                  <div className="my-1 h-px bg-white/30" />
                  <DesgloseRow
                    label="Total a pagar hoy"
                    value={formatMonto(calc.totalAPagar, liq.moneda)}
                    bold
                  />
                  <p className="pt-1 text-[10px] uppercase tracking-wider opacity-85">
                    +{formatMonto(calc.punitorioPorDia, liq.moneda)} por cada día más
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Banner de ajuste crítico inline: solo si <= 7 días y NO vencido */}
          {ajusteCritico && !vencido && (
            <div className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span className="opacity-90">
                Ojo: el alquiler se ajusta en {diasAjuste} día{diasAjuste === 1 ? '' : 's'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="flex items-center gap-1.5 text-xs opacity-85">
              <Wallet className="h-3.5 w-3.5" />
              Pagás por transferencia
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">
              {vencido ? 'Regularizar' : 'Pagar ahora'}
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function DesgloseRow({
  label,
  value,
  bold,
  emphasize,
}: {
  label: string;
  value: string;
  bold?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={emphasize ? 'font-medium' : 'opacity-90'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'text-base font-semibold' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}
