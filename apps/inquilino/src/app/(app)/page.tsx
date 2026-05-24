'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import { Card } from '@llave/ui/card';
import { AnunciosFeed } from '@/components/anuncios-feed';
import { InstallPrompt } from '@/components/install-prompt';
import { NavBar } from '@/components/nav-bar';
import { UserMenu } from '@/components/user-menu';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { useCurrentUser } from '@/lib/use-current-user';
import { movimientosMock, type Movimiento } from '@/lib/movimientos-mock';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import { diasHastaVencimiento, formatFecha, formatFechaCorta, formatMonto } from '@/lib/format';
import {
  aplicarEstadoDemo,
  useDemoEstado,
  useDemoVisible,
  type DemoEstado,
} from '@/lib/demo-estado';
import type { Liquidacion } from '@/lib/types';

export default function PagosPage() {
  // Modo demo sincronizado entre pantallas vía localStorage.
  // El switcher solo se muestra si el flag `demo-visible` está activo —
  // un inquilino real no debería ver controles "Al día / A tiempo / Retrasado".
  // Para activarlo en una demo: entrar con `?demo=1`.
  const [demoEstado, setDemoEstado] = useDemoEstado();
  const demoVisible = useDemoVisible();

  const pendienteMock = liquidacionesMock.find((l) => l.estado !== 'PAGADO');
  const pendiente = aplicarEstadoDemo(demoEstado, pendienteMock);

  const diasAjuste = diasHastaVencimiento(contratoMock.proximoAjuste);
  const alertaAjuste = diasAjuste >= 0 && diasAjuste <= 30;
  const ajusteCritico = diasAjuste >= 0 && diasAjuste <= 7;

  const user = useCurrentUser();
  const nombreCorto = user.firstName;

  // Movimientos recientes (últimos 60 días). Si no hay nada reciente
  // mostramos un empty state que linkea a /comprobantes — antes la lista
  // tiraba pagos de hace 2+ meses en home y parecía obsoleta.
  const HOY = Date.now();
  const LIMITE_DIAS = 60;
  const movimientos = movimientosMock
    .filter(
      (m) =>
        (HOY - new Date(m.fecha).getTime()) / (1000 * 60 * 60 * 24) <= LIMITE_DIAS,
    )
    .slice(0, 3);

  // Próximo pago: si no hay nada pendiente, calculamos cuándo es la próxima
  // liquidación a vencer (día de pago del mes siguiente). Sirve para el
  // empty state "Estás al día" + el saludo contextual.
  const proximoPagoDate = (() => {
    const hoy = new Date();
    const diaPago = contratoMock.diaPago;
    const candidato = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
    if (candidato.getTime() <= hoy.getTime()) {
      candidato.setMonth(candidato.getMonth() + 1);
    }
    return candidato;
  })();
  const diasAlProximoPago = Math.ceil(
    (proximoPagoDate.getTime() - HOY) / (1000 * 60 * 60 * 24),
  );

  // Saludo contextual: una frase breve que cambia según el estado real.
  // Es la primera info que ve el inquilino, así que prioriza lo urgente.
  // Versión CORTA — en mobile angosto (320px) entra completo sin truncate.
  // El banner grande de abajo ya tiene el detalle completo.
  const mensajeContextual = pendiente
    ? (() => {
        const diasV = diasHastaVencimiento(pendiente.fechaVencimiento);
        if (diasV < 0)
          return `Atrasado · ${Math.abs(diasV)} día${Math.abs(diasV) === 1 ? '' : 's'}`;
        if (diasV === 0) return 'Vence hoy';
        return `Vence en ${diasV} día${diasV === 1 ? '' : 's'}`;
      })()
    : `Al día · próximo en ${diasAlProximoPago} día${diasAlProximoPago === 1 ? '' : 's'}`;

  // Smart nudge del Broker IA: la card solo aparece si el inquilino nunca
  // entró a /broker. Una vez visitado, la home queda más limpia. El flag
  // lo setea la propia page /broker en localStorage la primera vez.
  // Estado inicial = "no visitado" (mostrar el nudge) para que la card se
  // renderice por default; el effect lo apaga si el flag ya estaba seteado.
  const [brokerVisitado, setBrokerVisitado] = useState(false);
  useEffect(() => {
    try {
      setBrokerVisitado(
        window.localStorage.getItem('llave-inquilino:broker-visitado') === '1',
      );
    } catch {
      // ignore — quedaría en false (mostrar)
    }
  }, []);

  return (
    <>
      {/* Saludo + menú (mobile).
          La sub-línea es contextual al estado real (atrasado / vence pronto /
          al día). Le da al inquilino el resumen de su situación apenas abre
          la app, antes incluso de bajar a las cards. */}
      <header className="flex items-center justify-between px-5 pt-5 md:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Hola,</p>
          <p className="truncate text-lg font-semibold leading-tight">
            {nombreCorto} <span aria-hidden="true">👋</span>
          </p>
          <p
            className={`mt-0.5 truncate text-[11px] ${
              pendiente ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {mensajeContextual}
          </p>
        </div>
        <UserMenu compact />
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8 md:pt-8">
        {/* Selector de modo demo — alterna entre "atrasado" y "al día"
            para mostrar ambos casos en presentaciones. Oculto por default
            para que un inquilino real no lo vea; se activa con ?demo=1. */}
        {demoVisible && (
          <DemoSwitch estado={demoEstado} onChange={setDemoEstado} />
        )}

        {/* Estado financiero principal. Lo más urgente primero:
            1. Si hay pago pendiente/atrasado: banner con CTA "Regularizar".
            2. Si no hay nada pendiente: banner verde "Estás al día" con
               próximo pago — refuerza la sensación de control y elimina
               el espacio vacío que dejaba la home al estar al día.
            3. Banner de ajuste — informativo, va después. */}
        {pendiente ? (
          <BannerPagoPendiente liq={pendiente} />
        ) : (
          <BannerAlDia
            diasAlProximoPago={diasAlProximoPago}
            fechaProximo={proximoPagoDate}
            monto={contratoMock.montoActual}
            moneda={contratoMock.moneda}
          />
        )}

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

        {/* Acciones rápidas: 4 atajos visuales para las cosas que más hace un
            inquilino. Reemplaza la sensación de "tengo que buscar dónde está
            cada cosa" con un acceso directo desde la pantalla principal. */}
        <QuickActions />

        {/* Card compacta de inmo + acciones rápidas.
            Antes mostraba dirección/ciudad arriba + inmo abajo en dos bloques.
            La dirección ya aparece en el sidenav desktop y en /contrato, así
            que en home la quitamos para no duplicar y dejar una card de una
            sola línea: "Inmobiliaria del Sol · WA · Llamar". */}
        <Card className="flex items-center gap-2 p-3 animate-fade-in">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <MapPin className="h-4 w-4" />
          </div>
          <p className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
            Administra{' '}
            <span className="font-medium text-foreground">
              {contratoMock.inmobiliaria}
            </span>
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
        </Card>

        {/* Anuncios desde la inmobiliaria (corte de agua, cambios de CBU,
            avisos urgentes). Cross-app de la inmo. */}
        <AnunciosFeed compacto />

        {/* Broker IA — diferenciador del producto, destacado pero sin saturar.
            Smart nudge: solo mostramos esta card si el inquilino nunca abrió
            /broker. Una vez que la conoce, la home queda más limpia y se le
            sigue mostrando el atajo en el nav inferior. */}
        {!brokerVisitado && (
          <Link href="/broker" className="block">
            <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-4 text-white shadow-md shadow-purple-500/20 transition-transform active:scale-[0.99] animate-fade-in">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider opacity-85">
                    Broker IA · nuevo
                  </p>
                  <p className="truncate text-sm font-semibold">
                    Preguntá lo que quieras sobre tu contrato
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-80 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        )}

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
          {movimientos.length === 0 ? (
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">
                Sin movimientos en los últimos {LIMITE_DIAS} días.
              </p>
              <Link
                href="/comprobantes"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver todos los recibos
                <ChevronRight className="h-3 w-3" />
              </Link>
            </Card>
          ) : (
            <Card className="divide-y">
              {movimientos.map((m) => (
                <MovimientoRow key={m.id} mov={m} />
              ))}
            </Card>
          )}
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

  // Cuando hay pago vencido, mostramos un pill "Regularizar" en lugar del
  // ChevronRight discreto. El card entero sigue siendo el link, así que el
  // pill es decorativo — refuerza visualmente la acción y elimina la duda
  // "¿esto es solo info o lo puedo tocar para pagar?" detectada en la auditoría.
  return (
    <Link
      href="/comprobantes"
      className={`flex flex-col gap-3 rounded-xl border ${tono.border} ${tono.bg} px-3 py-3 transition-colors hover:bg-opacity-100 active:scale-[0.99] sm:flex-row sm:items-center`}
    >
      {/* En mobile angosto (<sm), el monto + texto compite con el pill por
          el ancho y queda todo cortado. Solución: stack vertical en mobile,
          horizontal en sm+. El pill abajo full-width refuerza la acción. */}
      <div className="flex items-center gap-3">
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
      </div>
      {vencido ? (
        <span className="flex shrink-0 items-center justify-center gap-1 rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm sm:py-1.5">
          Regularizar
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className="flex shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm sm:py-1.5">
          Pagar
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </Link>
  );
}

// ============================================================
// BANNER POSITIVO cuando el inquilino está al día
// ============================================================
// Espejo del BannerPagoPendiente para el caso "todo OK". Antes la home
// quedaba semi-vacía cuando estaba al día — ahora muestra refuerzo
// positivo + cuándo cae el próximo pago, para que sepa qué esperar.
function BannerAlDia({
  diasAlProximoPago,
  fechaProximo,
  monto,
  moneda,
}: {
  diasAlProximoPago: number;
  fechaProximo: Date;
  monto: number;
  moneda: 'ARS' | 'USD';
}) {
  return (
    <Link
      href="/comprobantes"
      className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3 transition-colors hover:bg-emerald-100/70 active:scale-[0.99] dark:border-emerald-900/40 dark:bg-emerald-900/10"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-sm">
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight text-emerald-900 dark:text-emerald-100">
          Estás al día ·{' '}
          <span className="tabular-nums">{formatMonto(monto, moneda)}</span>
        </p>
        <p className="truncate text-xs text-emerald-800/80 dark:text-emerald-200/80">
          Próximo pago en {diasAlProximoPago} día
          {diasAlProximoPago === 1 ? '' : 's'} ·{' '}
          {fechaProximo.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
          })}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
    </Link>
  );
}

// ============================================================
// QUICK ACTIONS — atajos visuales para las 4 tareas más comunes
// ============================================================
// La home antes era casi 100% informacional. Esta fila convierte la
// pantalla en algo accionable: en un tap el inquilino llega a las 4
// cosas que más quiere hacer (pagar, hacer un reclamo, ver el contrato
// o subir una boleta de servicios).
function QuickActions() {
  const acciones: Array<{
    href: string;
    label: string;
    icon: typeof Wrench;
    color: string;
  }> = [
    { href: '/comprobantes', label: 'Pagar', icon: CreditCard, color: 'text-emerald-600 dark:text-emerald-400' },
    { href: '/reclamos/nuevo', label: 'Reclamo', icon: Wrench, color: 'text-amber-600 dark:text-amber-400' },
    { href: '/contrato', label: 'Contrato', icon: FileText, color: 'text-blue-600 dark:text-blue-400' },
    { href: '/servicios', label: 'Boleta', icon: Zap, color: 'text-violet-600 dark:text-violet-400' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {acciones.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-3 text-center transition-colors hover:bg-muted active:scale-[0.97]"
          >
            <div className={`grid h-9 w-9 place-items-center rounded-lg bg-muted ${a.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="truncate text-[11px] font-medium">{a.label}</span>
          </Link>
        );
      })}
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
        <p className="truncate text-[11px] text-muted-foreground">{formatFechaCorta(mov.fecha)}</p>
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
  const opciones: { value: DemoEstado; label: string }[] = [
    { value: 'al-dia', label: 'Al día' },
    { value: 'a-tiempo', label: 'A tiempo' },
    { value: 'atrasado', label: 'Retrasado' },
  ];
  return (
    <div className="flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 p-1 text-xs">
      <span className="pl-2 pr-1 text-[10px] font-bold uppercase tracking-wider text-primary">
        Demo
      </span>
      <div className="flex flex-1 gap-1">
        {opciones.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              estado === op.value
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={estado === op.value}
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}
