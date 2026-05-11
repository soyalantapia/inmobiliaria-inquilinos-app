import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Info,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card } from '@llave/ui/card';
import { InstallPrompt } from '@/components/install-prompt';
import { NavBar } from '@/components/nav-bar';
import { UserMenu } from '@/components/user-menu';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { movimientosMock, type Movimiento } from '@/lib/movimientos-mock';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import type { Liquidacion } from '@/lib/types';

export default function PagosPage() {
  const pendiente = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const diasAjuste = diasHastaVencimiento(contratoMock.proximoAjuste);
  const alertaAjuste = diasAjuste >= 0 && diasAjuste <= 60;

  const movimientos = movimientosMock.slice(0, 5);

  return (
    <>
      <header className="p-5 md:hidden">
        <UserMenu />
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6 md:px-8 md:pt-8">
        {pendiente ? (
          <PaymentHero liq={pendiente} />
        ) : (
          <Card className="space-y-2 p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="font-medium">Estás al día</p>
            <p className="text-sm text-muted-foreground">
              No tenés alquiler ni expensas por pagar este mes.
            </p>
          </Card>
        )}

        {alertaAjuste && (
          <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4 text-sm animate-fade-in">
            <TrendingUp className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">Próximo ajuste el {formatFecha(contratoMock.proximoAjuste)}</p>
              <p className="text-xs text-muted-foreground">
                Índice {contratoMock.indiceAjuste} · faltan {diasAjuste} días
              </p>
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Movimientos
            </h2>
            <Link
              href="/comprobantes"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver recibos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <Card className="divide-y">
            {movimientos.map((m) => (
              <MovimientoRow key={m.id} mov={m} />
            ))}
          </Card>
        </section>
      </main>

      <NavBar />
      <InstallPrompt />
    </>
  );
}

function PaymentHero({ liq }: { liq: Liquidacion }) {
  const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
  const diasV = diasHastaVencimiento(liq.fechaVencimiento);
  const vencido = calc.diasAtraso > 0;
  const urgente = !vencido && diasV >= 0 && diasV <= 3;

  const bg = vencido
    ? 'from-red-600 to-red-500'
    : urgente
      ? 'from-amber-600 to-amber-500'
      : 'from-primary to-primary/80';

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

          {vencido && (
            <div className="space-y-2 rounded-lg bg-white/15 p-3 text-xs backdrop-blur">
              <DesgloseRow label="Alquiler + expensas" value={formatMonto(calc.montoOriginal, liq.moneda)} />
              <DesgloseRow
                label={`Intereses (${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} × ${calc.tasaDiariaPct}%)`}
                value={`+ ${formatMonto(calc.punitorioAcumulado, liq.moneda)}`}
                emphasize
              />
              <div className="my-1 h-px bg-white/30" />
              <DesgloseRow label="Total a pagar hoy" value={formatMonto(calc.totalAPagar, liq.moneda)} bold />
              <p className="pt-1 text-[10px] uppercase tracking-wider opacity-85">
                +{formatMonto(calc.punitorioPorDia, liq.moneda)} por cada día más
              </p>
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

const iconForTipo: Record<Movimiento['tipo'], React.ComponentType<{ className?: string }>> = {
  pago: ReceiptText,
  pago_expensa: ReceiptText,
  ajuste: TrendingUp,
  punitorio: ArrowUpRight,
  reembolso: ArrowDownLeft,
  aviso: Info,
};

function MovimientoRow({ mov }: { mov: Movimiento }) {
  const Icon = iconForTipo[mov.tipo];
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{mov.titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{mov.detalle}</p>
      </div>
      <div className="shrink-0 text-right">
        {mov.monto !== null ? (
          <p
            className={`text-sm font-semibold tabular-nums ${
              mov.signo === 'salida' ? '' : 'text-emerald-600'
            }`}
          >
            {mov.signo === 'salida' ? '-' : '+'}
            {formatMonto(mov.monto)}
          </p>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
            <Sparkles className="h-2.5 w-2.5" />
            aviso
          </span>
        )}
        <p className="text-[10px] text-muted-foreground">{fechaCorta(mov.fecha)}</p>
      </div>
    </div>
  );
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
