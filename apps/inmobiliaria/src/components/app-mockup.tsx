'use client';

import { CreditCard, FileText, MessageSquare, Receipt } from 'lucide-react';

/**
 * Mockup decorativo del producto, dibujado 100% con divs + Tailwind (sin imágenes).
 * Muestra el panel de la inmobiliaria (browser) con un teléfono superpuesto que
 * representa la app del inquilino. Es puramente presentacional — vive dentro del
 * hero del {@link AuthShell} para "vender" el registro. `aria-hidden` porque no
 * aporta contenido leíble.
 */
export function AppMockup() {
  return (
    <div aria-hidden className="relative w-full select-none pb-10 pr-8">
      {/* Browser falso — panel de la inmobiliaria */}
      <div className="overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Barra del navegador */}
        <div className="flex h-8 items-center gap-2 border-b border-gray-100 bg-gray-50 px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="mx-auto rounded-full bg-gray-200/80 px-3 py-0.5 text-[9px] font-medium text-gray-500">
            admin.myalquiler.com
          </div>
        </div>

        {/* Cuerpo del dashboard */}
        <div className="flex">
          {/* Sidebar finita */}
          <div className="flex w-14 flex-col items-center gap-3 bg-violet-50 py-3">
            <div className="h-5 w-5 rounded-md bg-primary" />
            <div className="h-2 w-7 rounded-full bg-violet-200" />
            <div className="h-2 w-7 rounded-full bg-violet-200" />
            <div className="h-2 w-7 rounded-full bg-violet-200" />
            <div className="h-2 w-7 rounded-full bg-violet-200" />
            <div className="mt-1 h-2 w-7 rounded-full bg-violet-200" />
          </div>

          {/* Área principal */}
          <div className="flex-1 space-y-3 p-4">
            <div className="space-y-1">
              <div className="h-1.5 w-16 rounded-full bg-gray-200" />
              <p className="text-[13px] font-semibold text-gray-800">Tu cartera al día</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="COBRADO" value="$2.4M" className="bg-emerald-50 text-emerald-700" />
              <Stat label="EN MORA" value="$180k" className="bg-red-50 text-red-700" />
              <Stat label="A RENDIR" value="$1.9M" className="bg-violet-50 text-primary" />
            </div>

            {/* Lista de movimientos */}
            <div className="space-y-2 pt-0.5">
              <ListRow nameWidth="w-20" amount="$650k" />
              <ListRow nameWidth="w-16" amount="$420k" />
            </div>
          </div>
        </div>
      </div>

      {/* Teléfono falso superpuesto — app del inquilino */}
      <div className="absolute -bottom-2 right-0 w-40 rounded-[2rem] bg-gray-900 p-1.5 shadow-2xl ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[1.6rem] bg-white">
          {/* Notch */}
          <div className="flex h-5 items-center justify-center">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>

          <div className="space-y-3 px-3 pb-4">
            <p className="text-[11px] font-semibold text-gray-800">Hola, Martín</p>

            {/* Card de pago */}
            <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-sm">
              <p className="text-[8px] font-medium uppercase tracking-wide text-white/70">
                Alquiler de junio
              </p>
              <p className="mt-0.5 text-base font-bold leading-none">$ 650.000</p>
              <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-white/15 py-1 text-[9px] font-semibold">
                <CreditCard className="h-3 w-3" />
                Pagar
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="grid grid-cols-4 gap-1.5">
              <QuickAction icon={Receipt} />
              <QuickAction icon={FileText} />
              <QuickAction icon={MessageSquare} />
              <QuickAction icon={CreditCard} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`rounded-lg p-2 ${className}`}>
      <p className="text-[7px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  );
}

function ListRow({ nameWidth, amount }: { nameWidth: string; amount: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 shrink-0 rounded-full bg-violet-100" />
      <div className="space-y-1">
        <div className={`h-1.5 rounded-full bg-gray-200 ${nameWidth}`} />
        <div className="h-1.5 w-10 rounded-full bg-gray-100" />
      </div>
      <span className="ml-auto text-[10px] font-semibold text-gray-700">{amount}</span>
    </div>
  );
}

function QuickAction({ icon: Icon }: { icon: typeof CreditCard }) {
  return (
    <div className="grid aspect-square place-items-center rounded-lg bg-violet-50">
      <Icon className="h-3.5 w-3.5 text-primary" />
    </div>
  );
}
