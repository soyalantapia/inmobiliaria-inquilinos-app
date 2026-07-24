'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { Card, CardContent } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';
import { Topbar } from '@/components/topbar';
import { useMetricas, type MetricasResumen } from '@/lib/api/use-metricas';
import { formatMonto } from '@/lib/format';

const mesActualLocal = () => new Date().toISOString().slice(0, 7);

// 'YYYY-MM' → 'jul 2026'
function etiquetaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${meses[m - 1]} ${y}`;
}

export default function EstadisticasPage() {
  const [mes, setMes] = useState(mesActualLocal);
  const { resumen, cargando } = useMetricas(mes);

  return (
    <>
      <Topbar titulo="Estadísticas" />
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            El resumen del mes: qué facturaste, qué cobraste y qué te queda por cobrar.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mes</span>
            <input
              type="month"
              value={mes}
              max={mesActualLocal()}
              onChange={(e) => setMes(e.target.value || mesActualLocal())}
              className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>

        {cargando && <EstadisticasSkeleton />}

        {!cargando && !resumen && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No pudimos cargar las estadísticas de este mes. Probá recargar.
            </CardContent>
          </Card>
        )}

        {!cargando && resumen && <Contenido r={resumen} />}
      </main>
    </>
  );
}

function Contenido({ r }: { r: MetricasResumen }) {
  const f = r.financiero;
  return (
    <div className="space-y-5">
      {r.hayOtrasMonedas && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Estos números son en pesos (ARS). Tenés contratos activos en otra moneda que no se incluyen acá.
        </div>
      )}

      {/* Financiero: los 4 grandes */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Facturado" valor={formatMonto(f.devengado)} sub="lo que devengaron las cuotas del mes" />
        <Kpi titulo="Cobrado" valor={formatMonto(f.cobrado)} sub={`${f.cobrabilidadPct}% de lo facturado`} tono="ok" />
        <Kpi titulo="Por cobrar" valor={formatMonto(f.porCobrar)} sub="lo que todavía deben los inquilinos" tono={f.porCobrar > 0 ? 'warn' : 'muted'} />
        <Kpi titulo="En mora" valor={formatMonto(f.enMora)} sub="intereses por atraso acumulados" tono={f.enMora > 0 ? 'bad' : 'muted'} />
      </div>

      {/* Barra de cobrabilidad */}
      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Cobrabilidad del mes</span>
            <span className="tabular-nums text-muted-foreground">{f.cobrabilidadPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${Math.min(100, f.cobrabilidadPct)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Operativo */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Mini titulo="Contratos activos" valor={r.operativo.contratosActivos} />
        <Mini titulo="Altas del mes" valor={r.operativo.altasMes} />
        <Mini titulo="Reclamos abiertos" valor={r.operativo.reclamosAbiertos} />
        <Mini titulo="Reclamos resueltos" valor={r.operativo.reclamosResueltos} />
      </div>

      {/* Caja del mes */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Wallet className="h-4 w-4 text-muted-foreground" /> Caja del mes
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-4 w-4" /> Ingresos {formatMonto(r.caja.ingresos)}
          </span>
          <span className="flex items-center gap-1.5 text-destructive">
            <ArrowDownRight className="h-4 w-4" /> Egresos {formatMonto(r.caja.egresos)}
          </span>
          <span className="ml-auto tabular-nums text-muted-foreground">
            Neto <strong className={r.caja.neto >= 0 ? 'text-foreground' : 'text-destructive'}>{formatMonto(r.caja.neto)}</strong>
          </span>
        </CardContent>
      </Card>

      {/* Serie de 6 meses: facturado (fondo) vs cobrado (relleno) */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Facturado vs cobrado — últimos 6 meses</span>
            <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-muted" />Facturado</span>
              <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Cobrado</span>
            </span>
          </div>
          <GraficoSerie serie={r.serie} />
        </CardContent>
      </Card>
    </div>
  );
}

function GraficoSerie({ serie }: { serie: MetricasResumen['serie'] }) {
  const max = Math.max(1, ...serie.map((s) => s.devengado));
  return (
    <div className="flex items-end justify-between gap-2 sm:gap-4" style={{ height: 160 }}>
      {serie.map((s) => {
        const hDev = Math.round((s.devengado / max) * 130);
        const hCob = s.devengado > 0 ? Math.round((s.cobrado / max) * 130) : 0;
        return (
          <div key={s.mes} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full max-w-[52px] items-end justify-center" style={{ height: 130 }}>
              {/* facturado (fondo) */}
              <div className="absolute bottom-0 w-full rounded-t bg-muted" style={{ height: `${hDev}px` }} />
              {/* cobrado (relleno) */}
              <div className="absolute bottom-0 w-full rounded-t bg-emerald-500" style={{ height: `${hCob}px` }} />
            </div>
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">{etiquetaMes(s.mes)}</span>
          </div>
        );
      })}
    </div>
  );
}

const TONO: Record<string, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-destructive',
  muted: 'text-foreground',
};

function Kpi({ titulo, valor, sub, tono = 'muted' }: { titulo: string; valor: string; sub: string; tono?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className={`text-2xl font-bold tabular-nums leading-tight ${TONO[tono]}`}>{valor}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardContent className="py-3.5">
        <p className="text-2xl font-bold tabular-nums leading-tight">{valor}</p>
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </CardContent>
    </Card>
  );
}

function EstadisticasSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="space-y-2 py-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
