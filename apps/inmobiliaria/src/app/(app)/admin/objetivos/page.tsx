import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Lock,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { Topbar } from '@/components/topbar';
import {
  BLOQUEADORES,
  COHORTS,
  FUENTES,
  FUNNEL,
  META_SEMESTRE,
  UNIT_ECONOMICS,
} from '@/lib/objetivos-data';
import { formatMonto, formatPeriodo } from '@/lib/format';

/**
 * Dashboard interno de objetivos del semestre.
 *
 * Esta página NO la ven las inmobiliarias clientes — es para el equipo
 * de My Alquiler. La marca arriba con un banner de "Panel interno" y
 * los datos son del datawarehouse propio (clientes activos, MRR,
 * funnel, cohorts, unit economics).
 *
 * En producción esto debería tener auth basada en rol "FOUNDER" o
 * "INTERNAL". Por ahora la ruta está visible sólo si la URL se
 * conoce.
 */
export default function DashboardObjetivosPage() {
  // Tomamos el último mes con datos REALES (los proyectados los marcamos
  // visualmente distinto). Asumimos los que tienen activos < meta como
  // reales, los siguientes como proyección.
  const ultimoReal = COHORTS[3]!; // 2026-05 con 804 activos
  const proyectados = COHORTS.slice(4); // 2026-06 y 2026-07

  const progresoClientes = ultimoReal.activos / META_SEMESTRE.clientesActivos;
  const progresoMrr = ultimoReal.mrr / META_SEMESTRE.mrrArs;

  const mesesTranscurridos = 4;
  const mesesTotales = 6;
  const progresoTemporal = mesesTranscurridos / mesesTotales;

  const totalSpend = FUENTES.reduce((s, f) => s + f.costoTotal, 0);
  const totalClientesAdq = FUENTES.reduce((s, f) => s + f.clientes, 0);

  return (
    <>
      <Topbar titulo="Objetivos 2026 · interno" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-medium">Panel interno · equipo My Alquiler</p>
            <p className="text-xs text-muted-foreground">
              Este dashboard es para founders, sales y producto. No lo ven las
              inmobiliarias clientes. Los datos vienen del datawarehouse —
              actualización cada 4 hs.
            </p>
          </div>
        </div>

        {/* HERO con meta + progreso */}
        <div className="grid gap-4 md:grid-cols-2">
          <MetaCard
            icon={<Building2 className="h-5 w-5" />}
            tono="primary"
            label="Inmobiliarias clientes activas"
            actual={ultimoReal.activos}
            meta={META_SEMESTRE.clientesActivos}
            progreso={progresoClientes}
            progresoTemporal={progresoTemporal}
          />
          <MetaCard
            icon={<TrendingUp className="h-5 w-5" />}
            tono="emerald"
            label="MRR mensual (ARS)"
            actual={ultimoReal.mrr}
            meta={META_SEMESTRE.mrrArs}
            progreso={progresoMrr}
            progresoTemporal={progresoTemporal}
            formato="moneda"
          />
        </div>

        {/* Cohorts por mes */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Cohorts mes a mes</h2>
              <span className="text-[11px] text-muted-foreground">
                · gris claro = proyección
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              {COHORTS.map((c, idx) => {
                const real = idx <= 3;
                return (
                  <div
                    key={c.periodo}
                    className={`space-y-1 rounded-md border p-3 ${
                      real ? 'bg-card' : 'border-dashed bg-muted/30'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {c.periodo.slice(-2)}/{c.periodo.slice(0, 4)}
                    </p>
                    <p className="text-lg font-bold tabular-nums">{c.activos}</p>
                    <p className="text-[10px] text-muted-foreground">activos</p>
                    <div className="flex items-center gap-2 pt-1 text-[10px]">
                      <span className="text-emerald-700 dark:text-emerald-300">
                        +{c.nuevos}
                      </span>
                      {c.churn > 0 && (
                        <span className="text-amber-700 dark:text-amber-300">
                          −{c.churn}
                        </span>
                      )}
                    </div>
                    <div className="pt-1 text-[10px] font-medium tabular-nums">
                      {formatMonto(c.mrr)}
                    </div>
                  </div>
                );
              })}
            </div>
            {proyectados.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Proyección actual: cerramos {proyectados[proyectados.length - 1]!.activos} clientes y{' '}
                {formatMonto(proyectados[proyectados.length - 1]!.mrr)} de MRR en {formatPeriodo(META_SEMESTRE.cierre)}.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Funnel */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-600" />
                <h2 className="text-sm font-semibold">Funnel de adquisición</h2>
              </div>
              <div className="space-y-2">
                {FUNNEL.map((f, i) => {
                  const max = FUNNEL[0]!.cantidad;
                  const width = (f.cantidad / max) * 100;
                  return (
                    <div key={f.etapa} className="space-y-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium">{f.etapa}</span>
                        <span className="tabular-nums">
                          {f.cantidad.toLocaleString('es-AR')}
                          {i < FUNNEL.length - 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              → {Math.round(f.conversion * 100)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-violet-500 transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Fuentes */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold">Top fuentes de adquisición</h2>
              </div>
              <div className="space-y-2">
                {FUENTES.sort((a, b) => b.clientes - a.clientes).map((f) => {
                  const cacFuente =
                    f.costoTotal > 0 ? Math.round(f.costoTotal / Math.max(f.clientes, 1)) : 0;
                  const pct = (f.clientes / totalClientesAdq) * 100;
                  return (
                    <div key={f.nombre} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{f.nombre}</span>
                        <span className="shrink-0 tabular-nums">
                          {f.clientes}
                          {cacFuente > 0 ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              · CAC ${(cacFuente / 1000).toFixed(0)}k
                            </span>
                          ) : (
                            <span className="ml-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                              · CAC $0
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all ${
                            f.costoTotal === 0 ? 'bg-emerald-500' : 'bg-primary'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">{totalClientesAdq}</strong> clientes adquiridos ·{' '}
                <strong className="text-foreground">{formatMonto(totalSpend)}</strong> de spend acumulado
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unit economics */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Unit economics</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {UNIT_ECONOMICS.map((u) => (
                <div
                  key={u.label}
                  className="space-y-1 rounded-md border bg-muted/20 p-3"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {u.label}
                  </p>
                  <p
                    className={`text-2xl font-bold tabular-nums ${
                      u.tono === 'positivo'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : u.tono === 'negativo'
                          ? 'text-amber-700 dark:text-amber-300'
                          : ''
                    }`}
                  >
                    {u.valor}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{u.detalle}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bloqueadores */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold">Bloqueadores para llegar a la meta</h2>
            </div>
            <div className="space-y-2">
              {BLOQUEADORES.map((b, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-md border p-3">
                  <Badge
                    className={`shrink-0 text-[10px] ${
                      b.prioridad === 'alta'
                        ? 'bg-destructive text-destructive-foreground'
                        : b.prioridad === 'media'
                          ? 'bg-amber-500 text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {b.prioridad.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">{b.titulo}</p>
                    <p className="text-xs text-muted-foreground">{b.detalle}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Responsable: <strong className="text-foreground">{b.responsable}</strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

/* ============================================================
 * Card del KPI principal con barra de progreso + comparación
 * vs el progreso temporal del semestre.
 * ============================================================ */
function MetaCard({
  icon,
  tono,
  label,
  actual,
  meta,
  progreso,
  progresoTemporal,
  formato = 'numero',
}: {
  icon: React.ReactNode;
  tono: 'primary' | 'emerald';
  label: string;
  actual: number;
  meta: number;
  progreso: number;
  progresoTemporal: number;
  formato?: 'numero' | 'moneda';
}) {
  const fmt = (n: number) =>
    formato === 'moneda' ? formatMonto(n) : n.toLocaleString('es-AR');
  const pct = Math.round(progreso * 100);
  const adelantado = progreso >= progresoTemporal;
  const ringClass = tono === 'primary' ? 'ring-primary/20' : 'ring-emerald-300/40';
  const iconClass =
    tono === 'primary'
      ? 'bg-primary/10 text-primary'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  return (
    <Card className={`ring-2 ${ringClass}`}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <div className={`grid h-9 w-9 place-items-center rounded-lg ${iconClass}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-xs text-muted-foreground">
              Meta {formatPeriodo(META_SEMESTRE.cierre)}: <strong className="text-foreground">{fmt(meta)}</strong>
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold tabular-nums md:text-4xl">{fmt(actual)}</p>
            <p className="text-sm text-muted-foreground">/ {fmt(meta)}</p>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                tono === 'primary' ? 'bg-primary' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
            {/* Marker del "estás-acá-según-el-tiempo" */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
              style={{ left: `${Math.min(100, progresoTemporal * 100)}%` }}
              aria-label="Donde deberías estar según el tiempo transcurrido"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{pct}% del objetivo</span>
            <span
              className={`flex items-center gap-1 font-medium ${
                adelantado
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {adelantado ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {adelantado ? 'Adelantado' : 'Atrasado'} vs línea de tiempo
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
