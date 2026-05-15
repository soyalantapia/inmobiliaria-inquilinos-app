'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
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
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import type { Liquidacion } from '@/lib/types';

type DemoEstado = 'atrasado' | 'al-dia';

export default function PagosPage() {
  // Modo demo: alterna entre "atrasado" (pago pendiente real del mock) y
  // "al día" (sin pago pendiente).
  const [demoEstado, setDemoEstado] = useState<DemoEstado>('atrasado');

  const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  // Filtrado según el modo demo
  const pendiente = demoEstado === 'al-dia' ? null : pendienteMock;

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
        {/* Selector de modo demo — alterna entre "atrasado" y "al día"
            para que durante la presentación se puedan mostrar ambos casos. */}
        <DemoSwitch estado={demoEstado} onChange={setDemoEstado} />

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

        {/* Banner finito: si hay pago pendiente, avisa y lleva a /comprobantes
            donde se gestiona todo. Si está al día, no mostramos nada (queda
            implícito y la home arranca con el contenido principal). */}
        {pendiente && <BannerPagoPendiente liq={pendiente} />}

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
// BANNER COMPACTO en home cuando hay pago pendiente
// ============================================================
// Reemplaza al hero gigante. Solo avisa que hay algo a pagar y lleva a
// /comprobantes donde se gestiona todo (a pagar, próximos, cobrados).
function BannerPagoPendiente({ liq }: { liq: Liquidacion }) {
  const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
  const diasV = diasHastaVencimiento(liq.fechaVencimiento);
  const vencido = calc.diasAtraso > 0;

  // Color según urgencia
  const tono = vencido
    ? {
        border: 'border-red-300',
        bg: 'bg-red-50/70',
        text: 'text-red-900',
        sub: 'text-red-700/80',
        icon: 'bg-red-500',
      }
    : {
        border: 'border-primary/30',
        bg: 'bg-primary/5',
        text: 'text-foreground',
        sub: 'text-muted-foreground',
        icon: 'bg-primary',
      };

  return (
    <Link
      href="/comprobantes"
      className={`flex items-center gap-3 rounded-xl border ${tono.border} ${tono.bg} px-3 py-3 transition-colors hover:bg-opacity-100 active:scale-[0.99]`}
    >
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tono.icon} text-white shadow-sm`}
      >
        {vencido ? (
          <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Wallet className="h-4 w-4" strokeWidth={2.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${tono.text}`}>
          {vencido ? 'Tenés un pago atrasado' : 'Tenés un pago pendiente'} ·{' '}
          <span className="tabular-nums">{formatMonto(calc.totalAPagar, liq.moneda)}</span>
        </p>
        <p className={`truncate text-xs ${tono.sub}`}>
          {vencido
            ? `Venció hace ${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'}`
            : diasV === 0
              ? 'Vence hoy'
              : `Vence en ${diasV} día${diasV === 1 ? '' : 's'} · ${formatFecha(liq.fechaVencimiento)}`}
        </p>
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 ${tono.sub}`} />
    </Link>
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

// ============================================================
// SELECTOR DE MODO DEMO
// ============================================================
// Toggle visible para alternar entre los dos estados durante la presentación:
//   - "Atrasado": el inquilino tiene un pago vencido (PaymentHero rojo)
//   - "Al día": no tiene pagos pendientes (AlDiaHero verde)
//
// Está marcado claramente como "Demo" para que en una versión real se pueda
// remover sin afectar la lógica de negocio.
function DemoSwitch({
  estado,
  onChange,
}: {
  estado: DemoEstado;
  onChange: (e: DemoEstado) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 p-1 text-xs">
      <span className="pl-2 pr-1 text-[10px] font-bold uppercase tracking-wider text-primary">
        Demo
      </span>
      <div className="flex flex-1 gap-1">
        <button
          type="button"
          onClick={() => onChange('atrasado')}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            estado === 'atrasado'
              ? 'bg-white text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={estado === 'atrasado'}
        >
          Atrasado
        </button>
        <button
          type="button"
          onClick={() => onChange('al-dia')}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            estado === 'al-dia'
              ? 'bg-white text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={estado === 'al-dia'}
        >
          Al día
        </button>
      </div>
    </div>
  );
}
