import Link from 'next/link';
import { ArrowUpRight, DollarSign, FileWarning, Plus, ShieldCheck, TrendingUp, Users, Wrench } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { DashboardGreeting } from '@/components/dashboard-greeting';
import { Topbar } from '@/components/topbar';
import { dashboardMetricsMock, eventosMock } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';

const eventoIcono = {
  dollar: DollarSign,
  wrench: Wrench,
  'trending-up': TrendingUp,
  'shield-check': ShieldCheck,
} as const;

const cards = [
  {
    label: 'Contratos activos',
    value: dashboardMetricsMock.contratosActivos.toString(),
    sub: '+3 este mes',
    icon: Users,
  },
  {
    label: 'Cobro del mes',
    value: `${dashboardMetricsMock.cobroDelMesPct}%`,
    sub: '5 días para vencimiento medio',
    icon: TrendingUp,
  },
  {
    label: 'Morosos',
    value: dashboardMetricsMock.morosos.toString(),
    sub: 'Recordatorio enviado',
    icon: FileWarning,
  },
  {
    label: 'Ingresos del mes',
    value: formatMonto(dashboardMetricsMock.ingresosMes),
    sub: 'Cobrado vía Llave',
    icon: DollarSign,
  },
];

export default function DashboardPage() {
  return (
    <>
      <Topbar titulo="Dashboard" />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardGreeting />

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/screening"><ShieldCheck className="h-4 w-4" />Verificar inquilino</Link>
            </Button>
            <Button asChild>
              <Link href="/contratos/nuevo"><Plus className="h-4 w-4" />Cargar contrato</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <Card
                key={c.label}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="flex items-start justify-between p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.sub}</p>
                  </div>
                  <Icon className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Cobro del mes</CardTitle>
              <CardDescription>Mayo 2026 — última actualización hace 2 minutos</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartMock />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Actividad reciente</CardTitle>
              <Badge variant="secondary">Live</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {eventosMock.map((e) => {
                const Icon = eventoIcono[e.icono as keyof typeof eventoIcono];
                return (
                  <div key={e.id} className="flex items-start gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-tight">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">{e.subtitulo}</p>
                    </div>
                  </div>
                );
              })}
              <Link
                href="#"
                className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Ver toda la actividad
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function ChartMock() {
  // Mock visual de gráfico de barras (mayo 2026, 4 semanas)
  const semanas = [
    { label: 'Sem 1', cobrado: 78, total: 100 },
    { label: 'Sem 2', cobrado: 92, total: 100 },
    { label: 'Sem 3', cobrado: 81, total: 100 },
    { label: 'Sem 4', cobrado: 84, total: 100 },
  ];
  return (
    <div className="grid grid-cols-4 items-end gap-4 pt-4">
      {semanas.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-2">
          <div className="relative h-32 w-full overflow-hidden rounded-md bg-muted">
            <div
              className="absolute bottom-0 left-0 right-0 bg-primary transition-all"
              style={{ height: `${s.cobrado}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="text-sm font-semibold">{s.cobrado}%</p>
        </div>
      ))}
    </div>
  );
}
