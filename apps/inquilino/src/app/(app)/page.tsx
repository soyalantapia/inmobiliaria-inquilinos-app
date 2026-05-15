'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
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
} from 'lucide-react';
import { Card } from '@llave/ui/card';
import { InstallPrompt } from '@/components/install-prompt';
import { NavBar } from '@/components/nav-bar';
import { UserMenu } from '@/components/user-menu';
import { contratoMock, inquilinoActual, liquidacionesMock } from '@/lib/mock-data';
import { movimientosMock, type Movimiento } from '@/lib/movimientos-mock';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import { PaymentHero } from './payment-hero';

type DemoEstado = 'atrasado' | 'al-dia';

export default function PagosPage() {
  // Modo demo: alterna entre "atrasado" (pago pendiente real del mock) y
  // "al día" (sin pago pendiente). Persiste en localStorage para que se
  // mantenga si el usuario hace refresh durante la presentación.
  const [demoEstado, setDemoEstado] = useState<DemoEstado>('atrasado');

  const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const proximoPagado = liquidacionesMock.find((l) => l.estado === 'PAGADO');
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
// ESTADO "AL DÍA": notificación compacta, no hero gigante
// ============================================================
function AlDiaHero({ proxima }: { proxima: string | null }) {
  return (
    <Card className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/60 p-3 animate-fade-in">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-sm">
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight text-emerald-900">Estás al día</p>
        {proxima ? (
          <p className="truncate text-xs text-emerald-700/80">
            Próximo vencimiento: {formatFecha(proxima)}
          </p>
        ) : (
          <p className="truncate text-xs text-emerald-700/80">No tenés pagos pendientes</p>
        )}
      </div>
    </Card>
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
