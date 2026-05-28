'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import {
  DIAS_HASTA_CORTE,
  calcularEstadoCuenta,
  ESTADO_CUENTA_LABEL,
  guardarEstadoCuenta,
  leerEstadoCuenta,
  leerFormaPago,
  type EstadoCuentaCalculado,
} from '@/lib/forma-pago-storage';
import { formatFechaCorta } from '@/lib/format';

/**
 * Card que muestra el estado actual del cobro de My Alquiler:
 * - AL_DIA: verde, "tu próximo cobro es el X"
 * - GRACIA (solo prepago): amber, "tenés N días para transferir"
 * - ATRASADO: rojo, "se corta en N días"
 * - PAUSADO: rojo intenso, "servicio pausado, regularizá para volver"
 *
 * Incluye toggle de demo para forzar estados (útil para testear).
 */
export function EstadoCuentaCard() {
  const [estado, setEstado] = useState<EstadoCuentaCalculado | null>(null);
  const [formaPago, setFormaPago] = useState<ReturnType<typeof leerFormaPago> | null>(null);

  useEffect(() => {
    setFormaPago(leerFormaPago());
    setEstado(calcularEstadoCuenta(leerFormaPago().forma));
  }, []);

  if (!estado || !formaPago) return null;

  const { estado: e, diasDesdeVencimiento, diasHastaCorte } = estado;

  const tono: Record<typeof e, { card: string; chip: string; icon: typeof CheckCircle2 }> = {
    AL_DIA: {
      card: 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10',
      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: CheckCircle2,
    },
    GRACIA: {
      card: 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10',
      chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      icon: Clock,
    },
    ATRASADO: {
      card: 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10',
      chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      icon: AlertTriangle,
    },
    PAUSADO: {
      card: 'border-red-300 bg-red-50/70 dark:border-red-900/60 dark:bg-red-900/20',
      chip: 'bg-red-500 text-white',
      icon: ShieldAlert,
    },
  };
  const t = tono[e];
  const Icon = t.icon;

  /** Botones para simular estados — útil para la demo. */
  const simular = (dias: number, ok = false) => {
    const v = new Date();
    v.setDate(v.getDate() - dias);
    guardarEstadoCuenta({
      vencimientoUltimo: v.toISOString(),
      ultimoCobroOk: ok,
    });
    setEstado(calcularEstadoCuenta(formaPago.forma));
    toast({ title: 'Estado simulado actualizado' });
  };

  return (
    <Card className={cn('border-2', t.card)}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', t.chip)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold">{ESTADO_CUENTA_LABEL[e]}</p>
              {e === 'PAUSADO' && (
                <Badge variant="destructive" className="text-[10px]">
                  Acción urgente
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {e === 'AL_DIA' && (
                <>
                  Tu próximo cobro es el{' '}
                  <strong className="text-foreground">
                    {formatFechaCorta(estado.vencimientoUltimo)}
                  </strong>
                  . Todo en orden.
                </>
              )}
              {e === 'GRACIA' && (
                <>
                  Tu cobro venció hace{' '}
                  <strong className="text-foreground">
                    {diasDesdeVencimiento} día{diasDesdeVencimiento === 1 ? '' : 's'}
                  </strong>
                  , pero estás dentro del período de gracia de prepago. Transferí
                  antes del corte.
                </>
              )}
              {e === 'ATRASADO' && (
                <>
                  Tu cobro venció hace{' '}
                  <strong className="text-foreground">
                    {diasDesdeVencimiento} día{diasDesdeVencimiento === 1 ? '' : 's'}
                  </strong>
                  . El servicio se pausa en{' '}
                  <strong className="text-foreground">
                    {Math.max(0, diasHastaCorte)} día
                    {diasHastaCorte === 1 ? '' : 's'}
                  </strong>
                  . Regularizá ahora para evitarlo.
                </>
              )}
              {e === 'PAUSADO' && (
                <>
                  El servicio está pausado por falta de pago (
                  {diasDesdeVencimiento} día{diasDesdeVencimiento === 1 ? '' : 's'} vencido). Tus datos están guardados.
                  Apenas regularices, vuelve a funcionar al instante.
                </>
              )}
            </p>
          </div>
          {e !== 'AL_DIA' && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() =>
                toast({
                  variant: 'success',
                  title: '¡Listo!',
                  description:
                    'Procesamos el pago. Tu cuenta queda al día en unos minutos.',
                })
              }
            >
              {e === 'PAUSADO' ? 'Reactivar' : 'Regularizar'}
            </Button>
          )}
        </div>

        {/* Progress bar al corte */}
        {(e === 'GRACIA' || e === 'ATRASADO') && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Vencimiento</span>
              <span>Corte automático ({DIAS_HASTA_CORTE} días)</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={diasDesdeVencimiento}
              aria-valuemin={0}
              aria-valuemax={DIAS_HASTA_CORTE}
              aria-label={`Días desde vencimiento: ${diasDesdeVencimiento} de ${DIAS_HASTA_CORTE}`}
            >
              <div
                className={cn(
                  'h-full transition-all',
                  diasDesdeVencimiento <= 15 ? 'bg-amber-500' : 'bg-red-500',
                )}
                style={{
                  width: `${Math.min(100, (diasDesdeVencimiento / DIAS_HASTA_CORTE) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Día {diasDesdeVencimiento} de {DIAS_HASTA_CORTE}
            </p>
          </div>
        )}

        {/* Toggle demo */}
        <details className="rounded-md border border-dashed bg-muted/30 p-2 text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground">
            Simular estados (demo)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => simular(-7, true)}>
              Al día
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => simular(10, false)}>
              Gracia (10d)
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => simular(30, false)}>
              Atrasado (30d)
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => simular(50, false)}>
              Pausado (50d)
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
