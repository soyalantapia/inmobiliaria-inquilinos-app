import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card } from '@llave/ui/card';
import { InstallPrompt } from '@/components/install-prompt';
import { NavBar } from '@/components/nav-bar';
import { UserMenu } from '@/components/user-menu';
import { contratoMock, inquilinoActual, liquidacionesMock } from '@/lib/mock-data';
import { movimientosMock, type Movimiento } from '@/lib/movimientos-mock';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import type { Liquidacion } from '@/lib/types';

export default function PagosPage() {
  const pendiente = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const proximoPagado = liquidacionesMock.find((l) => l.estado === 'PAGADO');
  const diasAjuste = diasHastaVencimiento(contratoMock.proximoAjuste);
  const alertaAjuste = diasAjuste >= 0 && diasAjuste <= 30;
  const ajusteCritico = diasAjuste >= 0 && diasAjuste <= 7;

  const nombreCorto = inquilinoActual.nombre.split(' ')[0];
  const movimientos = movimientosMock.slice(0, 3);

  return (
    <>
      {/* Saludo + menú (mobile) */}
      <header className="flex items-center justify-between px-5 pt-5 md:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Hola,</p>
          <p className="truncate text-lg font-semibold leading-tight">
            {nombreCorto} <span aria-hidden="true">👋</span>
          </p>
        </div>
        <UserMenu />
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8 md:pt-8">
        {/* Banner de ajuste (inline, solo si <= 30 días y no es crítico) */}
        {alertaAjuste && !ajusteCritico && (
          <Link
            href="/contrato"
            className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
          >
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Próximo ajuste en {diasAjuste} días</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatFecha(contratoMock.proximoAjuste)} · índice {contratoMock.indiceAjuste}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        {/* HERO ÚNICO: pago pendiente o estado "al día" */}
        {pendiente ? (
          <PaymentHero liq={pendiente} ajusteCritico={ajusteCritico} diasAjuste={diasAjuste} />
        ) : (
          <AlDiaHero proxima={proximoPagado?.fechaVencimiento ?? null} />
        )}

        {/* Card del hogar + inmo (compacta, sin gradient grande) */}
        <Card className="space-y-3 p-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">{contratoMock.direccion}</p>
              <p className="truncate text-xs text-muted-foreground">{contratoMock.ciudad}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <p className="flex-1 min-w-0 text-xs text-muted-foreground">
              Administra <span className="font-medium text-foreground">{contratoMock.inmobiliaria}</span>
            </p>
            <a
              href="https://wa.me/541145321100"
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
              aria-label="WhatsApp a la inmobiliaria"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              href="tel:+541145321100"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent"
              aria-label="Llamar a la inmobiliaria"
            >
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </Card>

        {/* Broker IA — diferenciador del producto, destacado pero sin saturar */}
        <Link href="/broker" className="block">
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-4 text-white shadow-md shadow-purple-500/20 transition-transform active:scale-[0.99] animate-fade-in">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider opacity-85">
                  Broker IA
                </p>
                <p className="truncate text-sm font-semibold">
                  Preguntá lo que quieras sobre tu contrato
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-80 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

        {/* Movimientos compactos (3 últimos) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Últimos movimientos
            </h2>
            <Link
              href="/comprobantes"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todos
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

// ============================================================
// HERO: pago pendiente (con ajuste crítico inline si aplica)
// ============================================================
function PaymentHero({
  liq,
  ajusteCritico,
  diasAjuste,
}: {
  liq: Liquidacion;
  ajusteCritico: boolean;
  diasAjuste: number;
}) {
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

          {/* Banner de ajuste crítico inline: solo si <= 7 días */}
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

// ============================================================
// HERO: estado "al día" cuando no hay pago pendiente
// ============================================================
function AlDiaHero({ proxima }: { proxima: string | null }) {
  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-500 p-6 text-white shadow-xl shadow-emerald-500/20 md:p-8 animate-fade-in">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-90">Estás al día</p>
        </div>
        <p className="text-2xl font-bold leading-tight md:text-3xl">No tenés pagos pendientes</p>
        {proxima && (
          <p className="text-sm opacity-90">Próximo vencimiento: {formatFecha(proxima)}</p>
        )}
      </div>
    </Card>
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

// ============================================================
// Movimientos compactos
// ============================================================
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
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{mov.titulo}</p>
        <p className="truncate text-[11px] text-muted-foreground">{fechaCorta(mov.fecha)}</p>
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
      </div>
    </div>
  );
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
