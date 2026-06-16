'use client';

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BatteryFull,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  Signal,
  Users,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Mockup del producto para el hero de auth. Réplica fiel (a escala) de las
 * pantallas reales:
 *  - Browser → dashboard del panel (sidebar real + KPIs Cobrado/Por cobrar/
 *    En mora/A rendir, idénticos a `(app)/page.tsx` → KpiBig).
 *  - iPhone → home del inquilino (greeting + banner de pago con desglose +
 *    quick actions + card inmobiliaria, idéntico a inquilino `(app)/page.tsx`).
 * Todo dibujado con divs + Tailwind, `aria-hidden` (no aporta contenido leíble).
 */
export function AppMockup() {
  return (
    <div aria-hidden className="relative w-full select-none pb-6 pr-2 sm:pr-8">
      <PanelBrowser />
      <InquilinoPhone />
    </div>
  );
}

/* ============================================================
 * BROWSER + DASHBOARD DEL PANEL
 * ============================================================ */
function PanelBrowser() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
      {/* Chrome del navegador */}
      <div className="flex h-9 items-center gap-2 border-b border-gray-100 bg-gray-50 px-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-[9px] font-medium text-gray-400 ring-1 ring-gray-200/70">
          <Lock className="h-2.5 w-2.5" />
          admin.myalquiler.com
        </div>
      </div>

      {/* Cuerpo: sidebar + main */}
      <div className="flex bg-[#fafafa] text-gray-900">
        <PanelSidebar />
        <PanelMain />
      </div>
    </div>
  );
}

const NAV: Array<{ icon: LucideIcon; label: string; active?: boolean; badge?: number }> = [
  { icon: LayoutDashboard, label: 'Inicio', active: true },
  { icon: Building2, label: 'Propiedades' },
  { icon: Users, label: 'Propietarios' },
  { icon: CreditCard, label: 'Pagos' },
  { icon: Wallet, label: 'Caja' },
  { icon: FileText, label: 'Contratos' },
  { icon: Inbox, label: 'Aprobaciones', badge: 3 },
  { icon: Wrench, label: 'Reclamos' },
];

function PanelSidebar() {
  return (
    <aside className="hidden w-[34%] shrink-0 flex-col border-r border-gray-100 bg-white sm:flex">
      {/* Logo */}
      <div className="flex h-11 items-center gap-2 border-b border-gray-100 px-3">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[8px] font-bold text-primary-foreground">
          My
        </div>
        <div className="leading-none">
          <p className="text-[10px] font-semibold text-gray-800">My Alquiler</p>
          <p className="text-[7px] uppercase tracking-wider text-gray-400">Panel inmobiliaria</p>
        </div>
      </div>
      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[9px] font-medium ${
              item.active ? 'bg-primary/10 text-primary' : 'text-gray-400'
            }`}
          >
            <item.icon className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[7px] font-bold text-primary-foreground">
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </nav>
      {/* Footer cuenta */}
      <div className="border-t border-gray-100 p-2.5">
        <p className="text-[8px] font-semibold text-gray-700">Inmobiliaria del Sol</p>
        <p className="text-[7px] text-gray-400">Plan Pro · 28 propiedades</p>
      </div>
    </aside>
  );
}

function PanelMain() {
  return (
    <div className="min-w-0 flex-1">
      {/* Topbar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-100 bg-white px-4">
        <p className="text-[11px] font-semibold text-gray-800">Inicio</p>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-md px-2 py-1 text-[8px] font-medium text-gray-500 ring-1 ring-gray-200">
            <ShieldCheck className="h-2.5 w-2.5" /> Verificar inquilino
          </span>
          <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[8px] font-semibold text-primary-foreground">
            <Plus className="h-2.5 w-2.5" /> Cargar contrato
          </span>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        {/* Saludo */}
        <div>
          <p className="text-[12px] font-bold text-gray-900">Hola, Roberto</p>
          <p className="text-[8px] text-gray-400">Esto es lo que pasa en tu cartera hoy.</p>
        </div>

        <p className="pt-0.5 text-[7px] font-semibold uppercase tracking-wider text-gray-400">
          Plata · Junio 2026
        </p>

        {/* 4 KPIs (2×2) — fiel a KpiBig */}
        <div className="grid grid-cols-2 gap-2">
          <Kpi
            label="Cobrado"
            valor="$1.34M"
            icon={CheckCircle2}
            tone="emerald"
            delta="+8.4%"
            up
            hint="92% de cobrabilidad"
          />
          <Kpi label="Por cobrar" valor="$420k" icon={Clock} tone="amber" hint="Pendientes este mes" />
          <Kpi
            label="En mora"
            valor="$185k"
            icon={AlertTriangle}
            tone="red"
            delta="-25%"
            hint="1 contrato atrasado"
          />
          <Kpi label="A rendir" valor="$1.23M" icon={Wallet} tone="primary" hint="Comisión: $107k" />
        </div>
      </div>
    </div>
  );
}

const TONES = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  primary: { bg: 'bg-primary/5', text: 'text-primary' },
} as const;

function Kpi({
  label,
  valor,
  icon: Icon,
  tone,
  delta,
  up,
  hint,
}: {
  label: string;
  valor: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  delta?: string;
  up?: boolean;
  hint: string;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex flex-col gap-1 rounded-lg p-2.5 ${t.bg}`}>
      <div className="flex items-start justify-between">
        <p className="text-[7px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <Icon className={`h-3 w-3 ${t.text}`} />
      </div>
      <p className={`text-[15px] font-bold leading-none tabular-nums ${t.text}`}>{valor}</p>
      <div className="flex items-center gap-1 text-[6.5px] leading-none">
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              up ? 'text-emerald-600' : 'text-emerald-600'
            }`}
          >
            {up ? <ArrowUpRight className="h-2 w-2" /> : <ArrowDownRight className="h-2 w-2" />}
            {delta}
          </span>
        )}
        <span className="truncate text-gray-400">{hint}</span>
      </div>
    </div>
  );
}

/* ============================================================
 * iPHONE + HOME DEL INQUILINO
 * ============================================================ */
function InquilinoPhone() {
  return (
    <div className="absolute -bottom-4 -right-2 w-[38%] max-w-[182px] sm:-right-3">
      {/* Botones laterales */}
      <div className="absolute -left-[2px] top-[22%] h-5 w-[2px] rounded-l bg-gray-700" />
      <div className="absolute -left-[2px] top-[32%] h-8 w-[2px] rounded-l bg-gray-700" />
      <div className="absolute -left-[2px] top-[46%] h-8 w-[2px] rounded-l bg-gray-700" />
      <div className="absolute -right-[2px] top-[30%] h-12 w-[2px] rounded-r bg-gray-700" />

      {/* Frame titanio */}
      <div className="rounded-[2rem] bg-gradient-to-b from-gray-700 via-gray-900 to-black p-[3px] shadow-2xl ring-1 ring-white/10">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-white">
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-1.5 z-20 h-3.5 w-12 -translate-x-1/2 rounded-full bg-black" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pb-1 pt-2 text-gray-900">
            <span className="text-[8px] font-semibold">9:41</span>
            <div className="flex items-center gap-1">
              <Signal className="h-2.5 w-2.5" />
              <Wifi className="h-2.5 w-2.5" />
              <BatteryFull className="h-3 w-3" />
            </div>
          </div>

          <div className="space-y-2.5 px-3 pb-5">
            {/* Greeting */}
            <div className="flex items-center justify-between pt-1">
              <div className="leading-tight">
                <p className="text-[7px] text-gray-400">Hola,</p>
                <p className="text-[12px] font-bold text-gray-900">Martín 👋</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="grid h-5 w-5 place-items-center rounded-full bg-gray-100">
                  <Bell className="h-2.5 w-2.5 text-gray-500" />
                </div>
                <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  MG
                </div>
              </div>
            </div>

            {/* Banner de pago (pendiente, violeta) */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-white">
                  <Wallet className="h-3 w-3" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-[9px] font-semibold text-gray-900">Pago pendiente</p>
                  <p className="text-[7px] text-gray-400">Vence en 4 días</p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-2 py-1 text-[7px] font-semibold text-primary-foreground">
                  Pagar <ChevronRight className="h-2 w-2" />
                </span>
              </div>
              {/* Desglose */}
              <div className="mt-2 space-y-0.5 rounded-lg bg-white/70 px-2 py-1.5 text-[7px]">
                <Row label="Alquiler" value="$580.000" />
                <Row label="Expensas" value="$70.000" />
                <div className="my-1 h-px bg-primary/20" />
                <Row label="Total a pagar" value="$650.000" bold />
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-1.5">
              <Quick icon={CreditCard} label="Pagar" tint="text-emerald-600" />
              <Quick icon={Wrench} label="Reclamo" tint="text-amber-600" />
              <Quick icon={FileText} label="Contrato" tint="text-primary" />
              <Quick icon={Zap} label="Boleta" tint="text-violet-600" />
            </div>

            {/* Card inmobiliaria */}
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm">
              <div className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <MapPin className="h-2.5 w-2.5" />
              </div>
              <p className="flex-1 truncate text-[7px] text-gray-400">
                Administra <span className="font-semibold text-gray-700">Inmobiliaria del Sol</span>
              </p>
              <div className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                <MessageCircle className="h-2.5 w-2.5" />
              </div>
              <div className="grid h-5 w-5 place-items-center rounded-full bg-gray-100 text-gray-500">
                <Phone className="h-2.5 w-2.5" />
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-1.5">
            <div className="h-1 w-16 rounded-full bg-gray-900/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold text-gray-700' : 'text-gray-400'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
        {value}
      </span>
    </div>
  );
}

function Quick({ icon: Icon, label, tint }: { icon: LucideIcon; label: string; tint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-100 bg-white py-1.5">
      <div className={`grid h-5 w-5 place-items-center rounded-md bg-gray-50 ${tint}`}>
        <Icon className="h-2.5 w-2.5" />
      </div>
      <span className="text-[6.5px] font-medium text-gray-600">{label}</span>
    </div>
  );
}
