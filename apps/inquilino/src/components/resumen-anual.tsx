'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, BarChart3, TrendingUp } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { comprobantesMock } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';

// Gráfico de barras anual mes a mes + breakdown por categoría.
// Esto es completamente SVG hecho a mano: no agregamos recharts/chart.js
// para mantener el bundle chico. Cuando integremos analítica avanzada
// migramos a una lib (recharts es la candidata natural).

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Para esta demo asumimos que del total pagado, ~75% es alquiler y ~25% expensas.
// Cuando tengamos liquidaciones reales con su breakdown lo reemplazamos.
const RATIO_ALQUILER = 0.75;

export function ResumenAnual({ anio }: { anio: number }) {
  const datos = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, m) => {
      const periodo = `${anio}-${String(m + 1).padStart(2, '0')}`;
      const comp = comprobantesMock.find((c) => c.periodo === periodo);
      const total = comp?.monto ?? 0;
      return {
        mes: MESES[m]!,
        total,
        alquiler: Math.round(total * RATIO_ALQUILER),
        expensas: total - Math.round(total * RATIO_ALQUILER),
      };
    });
    return buckets;
  }, [anio]);

  const max = Math.max(...datos.map((d) => d.total), 1);
  const totalAnio = datos.reduce((acc, d) => acc + d.total, 0);
  const totalAlquiler = datos.reduce((acc, d) => acc + d.alquiler, 0);
  const totalExpensas = datos.reduce((acc, d) => acc + d.expensas, 0);
  const mesesPagados = datos.filter((d) => d.total > 0).length;
  const promedio = mesesPagados > 0 ? Math.round(totalAnio / mesesPagados) : 0;

  // Variación: comparamos primer mes pagado vs último para ver evolución
  const pagados = datos.filter((d) => d.total > 0);
  const primero = pagados[0]?.total ?? 0;
  const ultimo = pagados[pagados.length - 1]?.total ?? 0;
  const variacion =
    primero > 0 ? Math.round(((ultimo - primero) / primero) * 100) : 0;

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Resumen del año</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Mes a mes, qué pagaste en {anio}
          </p>
        </div>
        {primero > 0 && ultimo > 0 && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
              variacion >= 0
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
            )}
          >
            {variacion >= 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(variacion)}%
          </div>
        )}
      </div>

      {/* Gráfico de barras */}
      <div className="space-y-2">
        <div className="flex h-32 items-end gap-1">
          {datos.map((d) => {
            const altura = (d.total / max) * 100;
            const vacio = d.total === 0;
            return (
              <div key={d.mes} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex h-full w-full items-end justify-center">
                  {vacio ? (
                    <div className="h-1 w-full rounded-sm bg-muted" />
                  ) : (
                    <div
                      className="group relative flex w-full flex-col overflow-hidden rounded-t-sm transition-all hover:opacity-90"
                      style={{ height: `${altura}%`, minHeight: '4px' }}
                    >
                      <div
                        className="bg-primary/30 transition-colors"
                        style={{ flex: d.expensas }}
                      />
                      <div
                        className="bg-primary transition-colors"
                        style={{ flex: d.alquiler }}
                      />
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md group-hover:block">
                        <div className="font-medium">{formatMonto(d.total)}</div>
                        <div className="text-muted-foreground">
                          alq {formatMonto(d.alquiler)} · exp {formatMonto(d.expensas)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px]',
                    vacio ? 'text-muted-foreground/40' : 'text-muted-foreground',
                  )}
                >
                  {d.mes}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda + totales */}
      <div className="grid grid-cols-2 gap-3 border-t pt-4">
        <BreakdownItem
          color="bg-primary"
          label="Alquiler"
          value={formatMonto(totalAlquiler)}
          subtitle={`${Math.round((totalAlquiler / Math.max(totalAnio, 1)) * 100)}% del año`}
        />
        <BreakdownItem
          color="bg-primary/30"
          label="Expensas"
          value={formatMonto(totalExpensas)}
          subtitle={`${Math.round((totalExpensas / Math.max(totalAnio, 1)) * 100)}% del año`}
        />
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Promedio mensual</span>
        </div>
        <span className="font-semibold tabular-nums">{formatMonto(promedio)}</span>
      </div>
    </Card>
  );
}

function BreakdownItem({
  color,
  label,
  value,
  subtitle,
}: {
  color: string;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-sm', color)} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}
