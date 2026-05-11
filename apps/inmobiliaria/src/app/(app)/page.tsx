import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { DashboardGreeting } from '@/components/dashboard-greeting';
import { Topbar } from '@/components/topbar';
import { agendaMock, alertasMock, dashboardMetricsMock } from '@/lib/mock-data';
import { calcularDashboardStats } from '@/lib/dashboard-helpers';
import { formatMonto } from '@/lib/format';

export default function DashboardPage() {
  const stats = calcularDashboardStats();
  const m = dashboardMetricsMock;

  return (
    <>
      <Topbar titulo="Dashboard" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
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

        {/* 4 KPIs financieros principales */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plata · Mayo 2026
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiBig
              label="Cobrado"
              valor={formatMonto(stats.cobradoMes)}
              icon={CheckCircle2}
              tone="emerald"
              delta={m.variacionIngresos}
              deltaLabel="vs abril"
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
              deltaLabel="vs abril"
              deltaInverso
              hint={`${stats.enMora.cantidad} contrato${stats.enMora.cantidad === 1 ? '' : 's'} atrasados`}
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
              hint={`${m.reclamosResueltosMes} resueltos este mes`}
              alert={stats.reclamosAbiertos > 0}
              href="/reclamos"
            />
            <KpiSmall
              label="Próximos ajustes"
              valor={m.proximosAjustes30d.toString()}
              icon={TrendingUp}
              hint="En los próximos 30 días"
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
                  Mayo 2026 · cobrabilidad promedio {stats.cobrabilidadPct}%
                </CardDescription>
              </div>
              <Badge variant="secondary">Live</Badge>
            </CardHeader>
            <CardContent>
              <ChartSemanas />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Próximos 14 días</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">{agendaMock.length} eventos</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {agendaMock.map((e) => (
                <AgendaItem key={e.id} evento={e} />
              ))}
              <Link
                href="#"
                className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Ver agenda completa
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
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
                  {m.tiempoPromedioResolucionDias} días
                  <span className="ml-2 text-xs font-normal text-emerald-600">↓ -0.4d</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
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

  return (
    <Card className="overflow-hidden">
      <CardContent className={cn('space-y-3 p-5', toneBg)}>
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <Icon className={cn('h-5 w-5', toneColor)} />
        </div>
        <p className={cn('text-2xl font-bold tabular-nums md:text-3xl', toneColor)}>{valor}</p>
        <div className="flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', deltaColor)}>
              {delta > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}{deltaLabel && delta !== undefined && ` · ${deltaLabel}`}</span>}
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
  // Mock visual: barras stacked con cobrado / pendiente / vencido por semana
  const semanas = [
    { label: 'Sem 1', cobrado: 78, pendiente: 18, vencido: 4 },
    { label: 'Sem 2', cobrado: 92, pendiente: 6, vencido: 2 },
    { label: 'Sem 3', cobrado: 81, pendiente: 14, vencido: 5 },
    { label: 'Sem 4', cobrado: 84, pendiente: 12, vencido: 4 },
  ];

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-4 items-end gap-4">
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
            <p className="text-xs text-muted-foreground">{s.label}</p>
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
  const fecha = new Date(evento.fecha);
  const ahora = new Date();
  const dias = Math.ceil((fecha.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
  const fechaCorta = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

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
        <p className="text-[10px] text-muted-foreground">
          {dias === 0 ? 'hoy' : dias < 0 ? `hace ${-dias}d` : `en ${dias}d`}
        </p>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
  hint: string;
}) {
  return (
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
}
