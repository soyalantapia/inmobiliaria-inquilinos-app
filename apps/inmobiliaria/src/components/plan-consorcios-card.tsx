'use client';

import { useMemo } from 'react';
import { Building, CheckCircle2, Sparkles, TrendingDown } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import {
  TRAMOS_PLAN_CONSORCIOS,
  calcularResumenConsorcios,
} from '@/lib/plan';
import { formatMonto } from '@/lib/format';

/**
 * Card del plan de consorcios para /configuracion → Plan y facturas.
 * Sólo aparece si la inmo administra al menos 1 consorcio. Muestra:
 *  - Tramo actual + costo mensual
 *  - Bonificación equivalente vs plan de alquileres del mismo tope
 *  - Grilla de tramos disponibles con el actual resaltado
 */
export function PlanConsorciosCard() {
  const resumen = useMemo(() => calcularResumenConsorcios(), []);

  // No administra consorcios → no mostramos nada
  if (!resumen.tramo) return null;

  return (
    <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-900/40 dark:bg-violet-900/10">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-600 text-white">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Plan Consorcios</p>
              <p className="text-xs text-muted-foreground">
                {resumen.consorcios} consorcio{resumen.consorcios === 1 ? '' : 's'} ·{' '}
                {resumen.ufsTotales} unidades funcionales administradas
              </p>
            </div>
          </div>
          <Badge className="shrink-0 bg-violet-600 text-white">
            {resumen.tramo.nombre.replace('Consorcios · ', '')}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y py-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Costo mensual
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {formatMonto(resumen.costoMensual)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {resumen.tramo.rango.toLowerCase()}
            </p>
          </div>
          {resumen.bonificacionVsAlquileres > 0 && (
            <div className="rounded-md bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <TrendingDown className="h-2.5 w-2.5" />
                Bonificación
              </p>
              <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                − {formatMonto(resumen.bonificacionVsAlquileres)}
              </p>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                Lo que ahorrás vs administrar la misma cantidad como alquileres
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tramos disponibles
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TRAMOS_PLAN_CONSORCIOS.map((t) => {
              const actual = t.key === resumen.tramo?.key;
              return (
                <div
                  key={t.key}
                  className={`rounded-md border p-3 text-xs ${
                    actual
                      ? 'border-violet-500 bg-background ring-2 ring-violet-200 dark:ring-violet-900/40'
                      : 'border-border bg-background/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {t.nombre.replace('Consorcios · ', '')}
                    </p>
                    {actual && (
                      <Badge className="bg-violet-600 text-[9px] text-white">
                        <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                        Actual
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{t.rango}</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {formatMonto(t.precio)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      / mes
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-background/60 p-3 text-[11px]">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-600" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">¿Por qué más barato?</strong>{' '}
            El ticket promedio de un consorcio (expensas) es menor que el de un
            alquiler. Tu pricing por UF está pensado para que la herramienta
            sea siempre rentable contra hacerlo a mano.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
