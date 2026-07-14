'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { AlertaPlan } from '@/components/alerta-plan';
import { DashboardGreeting } from '@/components/dashboard-greeting';
import { InboxDelDia } from '@/components/inbox-del-dia';
import { Topbar } from '@/components/topbar';
import { agendaMock, alertasMock, dashboardMetricsMock } from '@/lib/mock-data';
import { calcularDashboardStats } from '@/lib/dashboard-helpers';
import { totalGastosPendientesGlobal } from '@/lib/caja-storage';
import { listarReclamos } from '@/lib/reclamos-store';
import { apiEnabled } from '@/lib/api/client';
import { useDashboard } from '@/lib/api/hooks';
import { diasHastaVencimiento, formatFechaCorta, formatMonto, formatPeriodo, periodoActualFormat } from '@/lib/format';

export default function DashboardPage() {
  // Gastos de caja pendientes: se leen tras montar (localStorage) para no romper
  // la hidratación — en el primer render (SSR/export) valen 0 y el KPI "A rendir"
  // se ajusta al instante en cliente. El hook va ANTES del return condicional.
  const [gastosPendientes, setGastosPendientes] = useState(0);
  // Reclamos abiertos: arranca undefined (SSR/primer render usa el mock) y se
  // resuelve contra el store tras montar, para que el KPI refleje resoluciones
  // de la sesión (igual fuente que el Inbox) sin romper la hidratación.
  const [reclamosAbiertos, setReclamosAbiertos] = useState<number | undefined>(undefined);
  useEffect(() => {
    setGastosPendientes(totalGastosPendientesGlobal());
    setReclamosAbiertos(
      listarReclamos().filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO').length,
    );
  }, []);

  // En producción (API) el dashboard se arma con agregados reales. El render
  // demo (mocks: Roberto, 6 contratos, $1.34M…) queda intacto para el build
  // de GH Pages sin backend (!apiEnabled).
  if (apiEnabled) return <DashboardReal />;

  const stats = calcularDashboardStats(gastosPendientes, reclamosAbiertos);
  const m = dashboardMetricsMock;

  return (
    <>
      <Topbar titulo="Inicio" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Bienvenida post-registro (?bienvenida=1), una sola vez. */}
        <BienvenidaBanner />

        {/* Header con saludo + CTAs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardGreeting />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/screening">
                <ShieldCheck className="h-4 w-4" />
                Verificar inquilino
              </Link>
            </Button>
            <Button asChild>
              <Link href="/contratos/nuevo">
                <Plus className="h-4 w-4" />
                Cargar contrato
              </Link>
            </Button>
          </div>
        </div>

        {/* Alerta de plan cerca del tope */}
        <AlertaPlan />

        {/* Inbox de acciones del día */}
        <InboxDelDia />

        {/* 4 KPIs financieros principales */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plata · {formatPeriodo(periodoActualFormat())}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBig
              label="Cobrado"
              valor={formatMonto(stats.cobradoMes)}
              icon={CheckCircle2}
              tone="emerald"
              delta={m.variacionIngresos}
              deltaLabel="vs mes anterior"
              hint={`${stats.cobrabilidadPct}% de cobrabilidad`}
            />
            <KpiBig
              label="Por cobrar"
              valor={formatMonto(stats.porCobrarMes)}
              icon={Clock}
              tone="amber"
              hint="Pendientes este mes"
            />
            <KpiBig
              label="En mora"
              valor={formatMonto(stats.enMora.monto)}
              icon={AlertTriangle}
              tone={stats.enMora.cantidad > 0 ? 'red' : 'muted'}
              delta={m.variacionMorosos}
              deltaInverso
              deltaLabel="vs mes anterior"
              hint={`${stats.enMora.cantidad} contrato${stats.enMora.cantidad === 1 ? ' atrasado' : 's atrasados'}`}
            />
            <KpiBig
              label="A rendir a propietarios"
              valor={formatMonto(stats.aRendirMes)}
              icon={Wallet}
              tone="primary"
              hint={`Tu comisión: ${formatMonto(stats.comisionMes)}`}
            />
          </div>
        </section>

        {/* 4 KPIs operacionales */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Operación
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiSmall
              label="Contratos activos"
              valor={stats.contratosActivos.toString()}
              icon={FileText}
              hint={`${stats.ocupacionPct}% ocupación`}
              href="/contratos"
            />
            <KpiSmall
              label="Reclamos abiertos"
              valor={stats.reclamosAbiertos.toString()}
              icon={Wrench}
              hint={`${m.reclamosResueltosMes} resuelto${m.reclamosResueltosMes === 1 ? '' : 's'} este mes`}
              alert={stats.reclamosAbiertos > 0}
              href="/reclamos"
            />
            <KpiSmall
              label="Ajustes de alquiler"
              valor={m.proximosAjustes30d.toString()}
              icon={TrendingUp}
              hint="Aumentos programados (próx. 30 días)"
              href="/contratos"
            />
            <KpiSmall
              label="Screenings pendientes"
              valor={m.screeningsPendientes.toString()}
              icon={Search}
              hint="Verificaciones en curso"
              href="/screening"
            />
          </div>
        </section>

        {/* Tendencia mensual + Agenda 14 días */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Cobro de las últimas 4 semanas</CardTitle>
                <CardDescription>
                  {formatPeriodo(periodoActualFormat())} · cobrabilidad promedio {stats.cobrabilidadPct}%
                </CardDescription>
              </div>
              <Badge variant="secondary">Live</Badge>
            </CardHeader>
            <CardContent>
              <ChartSemanas />
            </CardContent>
          </Card>

          {(() => {
            // Defensive: filtramos eventos pasados para que "Próximos 14
            // días" no muestre nada vencido. Si la fecha del mock quedó
            // desactualizada, evitamos el reporte "tu agenda dice 11-may
            // pero hace 13 días que pasó".
            const hoyMs = (() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              return d.getTime();
            })();
            const proximos = agendaMock.filter((e) => {
              const [y, m, d] = e.fecha.split('-').map(Number);
              return new Date(y!, m! - 1, d!).getTime() >= hoyMs;
            });
            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Próximos 14 días</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {proximos.length} evento{proximos.length === 1 ? '' : 's'}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  {proximos.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No hay eventos en los próximos 14 días.
                    </p>
                  ) : (
                    proximos.map((e) => <AgendaItem key={e.id} evento={e} />)
                  )}
                  <Link
                    href="/renovaciones"
                    className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    Ver agenda completa
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Top alertas + Métricas estratégicas */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-900/5 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-base">Necesitan tu atención</CardTitle>
              </div>
              <Badge variant="warning">{alertasMock.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertasMock.map((a) => (
                <AlertaItem key={a.id} alerta={a} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos vencimientos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RowVencimiento
                icon={FileText}
                label="Contratos a renovar"
                valor={m.contratosVencen90d}
                hint="próximos 90 días"
                href="/renovaciones"
              />
              <RowVencimiento
                icon={KeyRound}
                label="Garantías por vencer"
                valor={m.garantiasVencen30d}
                hint="próximos 30 días"
              />
              <RowVencimiento
                icon={TrendingUp}
                label="Ajustes por aplicar"
                valor={m.proximosAjustes30d}
                hint="próximos 30 días"
              />
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Tiempo promedio de resolución
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {m.tiempoPromedioResolucionDias} día{m.tiempoPromedioResolucionDias === 1 ? '' : 's'}
                  <span className="ml-2 text-xs font-normal text-emerald-600">
                    ↓ 0,4 d vs mes pasado
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

// ─────────────────── Dashboard REAL (modo API) ───────────────────

function DashboardReal() {
  const { stats, morosos, propietariosSinCbu, porRendir, proximosVencimientos, cargando, error, propiedadesTotal } =
    useDashboard();

  // Durante el fetch inicial, stats viene en $0 y los KPIs mostraban un falso
  // "Todo al día". Mostramos un estado de carga hasta tener los datos reales.
  if (cargando) {
    return (
      <>
        <Topbar titulo="Inicio" />
        <main className="flex-1 p-4 md:p-6">
          <p className="text-sm text-muted-foreground">Cargando tu panel…</p>
        </main>
      </>
    );
  }

  // Falló la carga (contratos o propiedades). Mostramos error + reintento en
  // lugar del dashboard en $0 o — peor — el estado vacío "cuenta nueva", que le
  // mentiría a una inmobiliaria con cartera diciéndole que no tiene propiedades.
  if (error) {
    return (
      <>
        <Topbar titulo="Inicio" />
        <main className="flex-1 px-4 py-10 text-center md:p-6">
          <AlertTriangle className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No pudimos cargar tu panel.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisá tu conexión e intentá de nuevo. No mostramos datos para no darte información incorrecta.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </main>
      </>
    );
  }

  // Cuenta nueva/vacía: SIN propiedades cargadas. Usamos `propiedadesTotal === 0`
  // (no `contratosActivos === 0`): una cuenta con todos los contratos finalizados
  // tiene 0 contratos activos pero conserva sus propiedades y trabajo pendiente
  // (rendiciones, CBUs) — esa NO es una cuenta nueva y debe ver el dashboard.
  if (propiedadesTotal === 0) {
    return (
      <>
        <Topbar titulo="Inicio" />
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <BienvenidaBanner />
          {/* Cuenta sin propiedades: NO afirmamos "Tu cartera al día." (no hay
              cartera). Titular de bienvenida coherente con el empty-state. */}
          <DashboardGreeting titulo="Bienvenido a My Alquiler." />
          <PrimerPasoCard />
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar titulo="Inicio" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Bienvenida post-registro (?bienvenida=1), una sola vez. */}
        <BienvenidaBanner />

        {/* Header con saludo + CTAs. El CTA "Verificar inquilino" se OCULTÓ en
            prod (pedido del dueño 07/07): el screening se rehace la semana
            próxima. El render demo (arriba) lo conserva para las demos. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardGreeting />
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/contratos/nuevo">
                <Plus className="h-4 w-4" />
                Cargar contrato
              </Link>
            </Button>
          </div>
        </div>

        {/* Para resolver hoy (derivado de datos reales) */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Para resolver hoy
          </h2>
          {morosos.length === 0 && propietariosSinCbu === 0 && porRendir === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Todo al día — no tenés acciones urgentes.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {morosos.length > 0 && (
                <Link href="/pagos">
                  <Card className="cursor-pointer border-red-200 bg-red-50/40 transition-shadow hover:shadow-md dark:border-red-900/40 dark:bg-red-900/10">
                    <CardContent className="flex items-center justify-between p-5">
                      <div>
                        <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          Inquilinos atrasados
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {morosos.length} contrato{morosos.length === 1 ? '' : 's'} ·{' '}
                          {formatMonto(morosos.reduce((a, m) => a + m.monto, 0))}
                        </p>
                      </div>
                      <span className="text-3xl font-bold tabular-nums text-destructive">
                        {morosos.length}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {propietariosSinCbu > 0 && (
                <Link href="/propietarios?filtro=sin-cbu">
                  <Card className="cursor-pointer border-amber-200 bg-amber-50/40 transition-shadow hover:shadow-md dark:border-amber-900/40 dark:bg-amber-900/10">
                    <CardContent className="flex items-center justify-between p-5">
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Propietarios sin CBU
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pediles los datos antes de rendir
                        </p>
                      </div>
                      <span className="text-3xl font-bold tabular-nums text-amber-600">
                        {propietariosSinCbu}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {porRendir > 0 && (
                <Link href="/propietarios?filtro=sin-rendir">
                  <Card className="cursor-pointer border-primary/30 bg-primary/5 transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between p-5">
                      <div>
                        <p className="text-sm font-medium text-primary">Propietarios por rendir</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Esperando sus transferencias
                        </p>
                      </div>
                      <span className="text-3xl font-bold tabular-nums text-primary">{porRendir}</span>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          )}
        </section>

        {/* 4 KPIs financieros */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plata · {formatPeriodo(periodoActualFormat())}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBig
              label="Cobrado"
              valor={formatMonto(stats.cobradoMes)}
              icon={CheckCircle2}
              tone="emerald"
              hint={`${stats.cobrabilidadPct}% de cobrabilidad`}
            />
            <KpiBig label="Por cobrar" valor={formatMonto(stats.porCobrarMes)} icon={Clock} tone="amber" hint="Pendientes este mes" />
            <KpiBig
              label="En mora"
              valor={formatMonto(stats.enMora.monto)}
              icon={AlertTriangle}
              tone={stats.enMora.cantidad > 0 ? 'red' : 'muted'}
              hint={`${stats.enMora.cantidad} contrato${stats.enMora.cantidad === 1 ? ' atrasado' : 's atrasados'}`}
            />
            <KpiBig
              label="A rendir a propietarios"
              valor={formatMonto(stats.aRendirMes)}
              icon={Wallet}
              tone="primary"
              hint={`Tu comisión: ${formatMonto(stats.comisionMes)}`}
            />
          </div>
        </section>

        {/* 4 KPIs operacionales */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operación</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiSmall
              label="Contratos activos"
              valor={stats.contratosActivos.toString()}
              icon={FileText}
              hint={`${stats.ocupacionPct}% ocupación`}
              href="/contratos"
            />
            <KpiSmall
              label="Reclamos abiertos"
              valor={stats.reclamosAbiertos.toString()}
              icon={Wrench}
              alert={stats.reclamosAbiertos > 0}
              href="/reclamos"
            />
            <KpiSmall
              label="En mora"
              valor={stats.enMora.cantidad.toString()}
              icon={AlertTriangle}
              alert={stats.enMora.cantidad > 0}
              href="/pagos"
            />
            <KpiSmall
              label="Propietarios por rendir"
              valor={porRendir.toString()}
              icon={Wallet}
              href="/propietarios"
            />
          </div>
        </section>

        {/* Necesitan tu atención + Próximos 14 días */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-900/5 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-base">Necesitan tu atención</CardTitle>
              </div>
              <Badge variant="warning">{morosos.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {morosos.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Sin alertas por ahora.</p>
              ) : (
                morosos.map((m) => (
                  <Link
                    key={m.contratoId}
                    href={`/contratos/${m.contratoId}`}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.inquilino}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.direccion}</p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="font-semibold tabular-nums text-destructive">
                        {formatMonto(m.monto, m.moneda)}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Próximos 14 días</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">
                {proximosVencimientos.length} vencimiento{proximosVencimientos.length === 1 ? '' : 's'}
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {proximosVencimientos.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No hay vencimientos en los próximos 14 días.
                </p>
              ) : (
                proximosVencimientos.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.inquilino}</p>
                      <p className="truncate text-xs text-muted-foreground">{v.direccion}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{formatFechaCorta(v.fecha)}</p>
                      <p className="text-sm font-semibold tabular-nums">{formatMonto(v.monto)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

// ─────────────────────────── Onboarding / primer uso ───────────────────────────

/**
 * Banner de confirmación post-registro. El alta redirige a `/?bienvenida=1`;
 * acá lo leemos (client-only, tras montar, para no romper la hidratación),
 * mostramos una tira de bienvenida y limpiamos el query param con
 * replaceState para que un refresh no la vuelva a mostrar. Es dismissible.
 */
function BienvenidaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('bienvenida') === '1') {
        setVisible(true);
        // Sacamos el param de la URL sin recargar: la bienvenida es de una sola
        // vez, no debe persistir si el usuario refresca o comparte el link.
        sp.delete('bienvenida');
        const qs = sp.toString();
        window.history.replaceState(
          null,
          '',
          window.location.pathname + (qs ? `?${qs}` : ''),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-fuchsia-500/5 px-4 py-3 animate-fade-in">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-600 text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">¡Tu cuenta está lista! 🎉</p>
        <p className="truncate text-xs text-muted-foreground">
          Bienvenido a My Alquiler. Te mandamos un mail con los primeros pasos.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Cerrar bienvenida"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Estado vacío del dashboard para una cuenta nueva (0 contratos activos).
 * En vez de mostrar 8 KPIs en $0 y "Todo al día" — que a un recién llegado le
 * dicen nada — lo guiamos al primer paso real: cargar su primera propiedad.
 */
function PrimerPasoCard() {
  const pasos = [
    // Mencionamos al dueño: el alta exige asignar 1 propietario (gate real del
    // backend), así que lo anticipamos para que no sea una sorpresa a mitad.
    { n: 1, texto: 'Cargás tu primera propiedad: dirección y dueño.' },
    { n: 2, texto: 'Le sumás el alquiler (contrato) y el inquilino entra por mail.' },
    { n: 3, texto: 'Ves cobros, mora y agenda del mes en tu tablero.' },
  ];
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="space-y-5 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-600 text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold md:text-xl">Empecemos por tu primera propiedad</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Todavía no cargaste ninguna. En un par de minutos tenés tu primer alquiler andando.
            </p>
          </div>
        </div>

        <ol className="space-y-2">
          {pasos.map((p) => (
            <li key={p.n} className="flex items-start gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {p.n}
              </span>
              <span className="pt-0.5">{p.texto}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="sm:flex-1">
            <Link href="/propiedades/nueva">
              <Plus className="h-4 w-4" />
              Cargar mi primera propiedad
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="sm:flex-1">
            <Link href="/contratos/nuevo">
              <FileText className="h-4 w-4" />
              Ya tengo la propiedad: cargar contrato
            </Link>
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5" />
          ¿Tenés muchas propiedades? Escribinos por WhatsApp y las migramos por vos.
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Componentes ───────────────────────────

function KpiBig({
  label,
  valor,
  icon: Icon,
  tone,
  delta,
  deltaLabel,
  deltaInverso,
  hint,
}: {
  label: string;
  valor: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'amber' | 'red' | 'primary' | 'muted';
  delta?: number;
  deltaLabel?: string;
  deltaInverso?: boolean;
  hint?: string;
}) {
  const toneColor = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    primary: 'text-primary',
    muted: 'text-muted-foreground',
  }[tone];

  const toneBg = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10',
    amber: 'bg-amber-50 dark:bg-amber-900/10',
    red: 'bg-red-50 dark:bg-red-900/10',
    primary: 'bg-primary/5',
    muted: 'bg-muted/30',
  }[tone];

  // Delta inverso: ej. "morosos -25%" es positivo (verde). Para ingresos, +8% es positivo.
  const deltaEsPositivo =
    delta === undefined ? null : deltaInverso ? delta < 0 : delta > 0;
  const deltaColor =
    deltaEsPositivo === null
      ? 'text-muted-foreground'
      : deltaEsPositivo
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

  // Footer siempre toma exactamente UNA línea (truncate) y reservamos su
  // altura aunque no haya delta ni hint, para que las 4 cards del grid
  // tengan exactamente la misma altura — antes el hint "42% de cobrabilidad
  // · vs abril" wrappeaba en dos líneas y dejaba un hueco blanco en las
  // demás cards.
  return (
    <Card className="overflow-hidden">
      <CardContent className={cn('flex h-full flex-col gap-3 p-5', toneBg)}>
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <Icon className={cn('h-5 w-5', toneColor)} />
        </div>
        <p className={cn('text-2xl font-bold tabular-nums md:text-3xl', toneColor)}>{valor}</p>
        {/* Antes este footer era de UNA línea con `truncate` → cuando
            hint + deltaLabel no entraban, terminaba "1 contrato atrasado
            · v…". Lo dejamos en 2 líneas con line-clamp-2 y altura mínima
            estable para que todas las cards mantengan el mismo alto. */}
        <div className="mt-auto flex min-h-10 items-start gap-2 text-xs leading-tight">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 pt-px font-medium',
                deltaColor,
              )}
            >
              {delta > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          )}
          {hint && (
            <span className="min-w-0 line-clamp-2 text-muted-foreground">
              {hint}
              {deltaLabel && delta !== undefined && ` · ${deltaLabel}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiSmall({
  label,
  valor,
  icon: Icon,
  hint,
  alert,
  href,
}: {
  label: string;
  valor: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  alert?: boolean;
  href?: string;
}) {
  const inner = (
    <CardContent className="flex items-start justify-between p-5">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 text-2xl font-semibold tabular-nums',
            alert ? 'text-amber-600 dark:text-amber-400' : '',
          )}
        >
          {valor}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Icon className={cn('h-5 w-5', alert ? 'text-amber-600' : 'text-primary')} />
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">{inner}</Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

function ChartSemanas() {
  // Mock visual: barras stacked con cobrado / pendiente / vencido por semana.
  // Las etiquetas muestran el rango "5–11 may" en vez de "Sem 1" para que
  // el inmo entienda a qué fechas se refiere cada barra (antes era ambiguo).
  const semanas = (() => {
    const hoy = new Date();
    const hoyDom = new Date(hoy);
    // Buscar el domingo de "esta semana" (índice 0 = domingo).
    hoyDom.setDate(hoyDom.getDate() - hoyDom.getDay());
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fmtRango = (offset: number) => {
      const lun = new Date(hoyDom);
      lun.setDate(hoyDom.getDate() - 7 * (3 - offset) + 1); // lunes de hace 3 semanas + offset
      const dom = new Date(lun);
      dom.setDate(lun.getDate() + 6);
      return `${lun.getDate()}–${dom.getDate()} ${meses[dom.getMonth()]}`;
    };
    return [
      { label: fmtRango(0), cobrado: 78, pendiente: 18, vencido: 4 },
      { label: fmtRango(1), cobrado: 92, pendiente: 6, vencido: 2 },
      { label: fmtRango(2), cobrado: 81, pendiente: 14, vencido: 5 },
      { label: fmtRango(3), cobrado: 84, pendiente: 12, vencido: 4 },
    ];
  })();

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 sm:gap-4">
        {semanas.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-2">
            <div className="relative h-36 w-full overflow-hidden rounded-md bg-muted">
              {/* Vencido al fondo */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-red-500/80"
                style={{ height: `${s.vencido}%` }}
              />
              {/* Pendiente arriba del vencido */}
              <div
                className="absolute left-0 right-0 bg-amber-500/80"
                style={{ height: `${s.pendiente}%`, bottom: `${s.vencido}%` }}
              />
              {/* Cobrado arriba */}
              <div
                className="absolute left-0 right-0 bg-emerald-500"
                style={{
                  height: `${s.cobrado}%`,
                  bottom: `${s.vencido + s.pendiente}%`,
                }}
              />
            </div>
            <p className="whitespace-nowrap text-xs text-muted-foreground">{s.label}</p>
            <p className="text-sm font-semibold tabular-nums">{s.cobrado}%</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <LegendDot color="bg-emerald-500" label="Cobrado" />
        <LegendDot color="bg-amber-500/80" label="Pendiente" />
        <LegendDot color="bg-red-500/80" label="Vencido" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      {label}
    </span>
  );
}

const agendaIconConfig: Record<
  (typeof agendaMock)[number]['tipo'],
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  pago: { icon: DollarSign, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  ajuste: { icon: TrendingUp, color: 'bg-primary/10 text-primary' },
  garantia: { icon: KeyRound, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  renovacion: { icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  rendicion: { icon: Wallet, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
};

function AgendaItem({ evento }: { evento: (typeof agendaMock)[number] }) {
  const cfg = agendaIconConfig[evento.tipo];
  const Icon = cfg.icon;
  // `formatFechaCorta` + `diasHastaVencimiento` usan `parseLocal` adentro,
  // así que el yyyy-mm-dd del mock no se interpreta como UTC y no
  // retrocede un día al renderizarse en zona AR. Antes con
  // `new Date('2026-05-28')` directo aparecía "27 may" — bug clásico.
  const dias = diasHastaVencimiento(evento.fecha);
  const fechaCorta = formatFechaCorta(evento.fecha);
  const etiquetaDias =
    dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : dias < 0 ? `hace ${-dias}d` : `en ${dias}d`;

  return (
    <div className="flex items-start gap-3">
      <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="line-clamp-1 text-sm font-medium leading-tight">{evento.titulo}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{evento.detalle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium">{fechaCorta}</p>
        <p className="text-[10px] text-muted-foreground">{etiquetaDias}</p>
      </div>
    </div>
  );
}

function AlertaItem({ alerta }: { alerta: (typeof alertasMock)[number] }) {
  const severityConfig = {
    critica: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200',
    alta: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200',
    media: 'border-border bg-background',
  }[alerta.severidad];

  const iconColor =
    alerta.severidad === 'critica'
      ? 'text-red-600 dark:text-red-400'
      : alerta.severidad === 'alta'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <Link
      href={alerta.href}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 transition-colors hover:opacity-90',
        severityConfig,
      )}
    >
      <AlertOctagon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{alerta.titulo}</p>
        <p className="text-xs opacity-80">{alerta.detalle}</p>
      </div>
      <ArrowUpRight className={cn('mt-1 h-3.5 w-3.5 shrink-0', iconColor)} />
    </Link>
  );
}

function RowVencimiento({
  icon: Icon,
  label,
  valor,
  hint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
  hint: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className="text-xl font-bold tabular-nums">{valor}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-md transition-colors hover:bg-muted/40">
        {content}
      </Link>
    );
  }
  return content;
}
