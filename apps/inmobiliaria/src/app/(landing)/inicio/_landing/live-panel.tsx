'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Wallet,
} from 'lucide-react';

/**
 * EL PANEL VIVO — el signature move de la landing. Un dashboard de cobranzas
 * (réplica del real, datos argentinos creíbles) que se anima solo en loop
 * mostrando el flujo completo: llega el comprobante → se valida → "cobrado" →
 * rendición al propietario. Hace en 7 segundos lo que el copy tarda 3 párrafos.
 *
 * Sin librería de motion: una state machine de 4 pasos (setInterval) + CSS.
 * Tilt 3D sutil que sigue al cursor. Respeta prefers-reduced-motion (se queda
 * en el paso "cobrado", sin loop).
 */

type Beat = 0 | 1 | 2 | 3;

const KPIS: Record<Beat, { cobrado: string; mora: string; rendir: string }> = {
  0: { cobrado: '12,84', mora: '1,90', rendir: '2,10' },
  1: { cobrado: '12,84', mora: '1,90', rendir: '2,10' },
  2: { cobrado: '13,49', mora: '1,25', rendir: '2,75' },
  3: { cobrado: '13,49', mora: '1,25', rendir: '2,75' },
};

export function LivePanel() {
  const [beat, setBeat] = useState<Beat>(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce.current) {
      setBeat(2);
      return;
    }
    const id = setInterval(() => {
      setBeat((b) => ((b + 1) % 4) as Beat);
    }, 2100);
    return () => clearInterval(id);
  }, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: +(py * -5).toFixed(2), y: +(px * 6).toFixed(2) });
  };

  const k = KPIS[beat];

  return (
    <div
      className="group/panel [perspective:1600px]"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      aria-hidden
    >
      <div
        className="relative transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        {/* halo violeta detrás, no un blob genérico: un solo resplandor del color del producto */}
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_60%_30%,hsl(262_78%_56%/0.18),transparent_70%)] blur-2xl" />

        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-30px_rgba(60,30,120,0.45)] ring-1 ring-black/[0.06]">
          {/* chrome navegador */}
          <div className="flex h-9 items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
            <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-[10px] font-medium text-gray-400 ring-1 ring-gray-200/70">
              <Lock className="h-2.5 w-2.5" />
              admin.myalquiler.com
            </div>
          </div>

          <div className="space-y-3 bg-[#fbfafc] p-4">
            {/* header */}
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-bold text-gray-900">Cobranzas</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                Junio 2026
              </p>
            </div>

            {/* 3 KPIs que cambian con el beat */}
            <div className="grid grid-cols-3 gap-2">
              <Kpi
                tone="emerald"
                icon={CheckCircle2}
                label="Cobrado"
                value={k.cobrado}
                delta={beat >= 2 ? '+650k' : undefined}
                pulse={beat === 2}
              />
              <Kpi tone="red" icon={AlertTriangle} label="En mora" value={k.mora} pulse={beat === 2} />
              <Kpi tone="primary" icon={Wallet} label="A rendir" value={k.rendir} />
            </div>

            {/* lista: pago a validar */}
            <div className="rounded-xl border border-gray-100 bg-white p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-700">Pagos a validar</p>
                <span className="text-[9px] font-medium text-gray-400">Junio</span>
              </div>
              <PaymentRow beat={beat} />
            </div>
          </div>
        </div>

        {/* TOAST flotante — entra en beat 1 (comprobante) y beat 3 (rendición) */}
        <Toast show={beat === 1} variant="comprobante" />
        <Toast show={beat === 3} variant="rendicion" />

        {/* progreso de la historia (4 pasos) — señal de que es intencional */}
        <div className="absolute -bottom-7 left-1/2 flex -translate-x-1/2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === beat ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-500',
  primary: 'bg-primary/[0.07] text-primary',
} as const;

function Kpi({
  tone,
  icon: Icon,
  label,
  value,
  delta,
  pulse,
}: {
  tone: keyof typeof TONES;
  icon: typeof Wallet;
  label: string;
  value: string;
  delta?: string;
  pulse?: boolean;
}) {
  return (
    <div className={`relative flex flex-col gap-1 rounded-lg p-2 ${TONES[tone].split(' ')[0]}`}>
      {pulse && (
        <span className="absolute inset-0 animate-[kpiPulse_0.7s_ease-out] rounded-lg ring-2 ring-emerald-400/0" />
      )}
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className={`h-3 w-3 ${TONES[tone].split(' ')[1]}`} />
      </div>
      <div className="flex items-baseline gap-0.5 leading-none">
        <span className={`text-[10px] font-semibold ${TONES[tone].split(' ')[1]}`}>$</span>
        {/* key={value} re-monta el número → micro fade-up al cambiar (sin lib) */}
        <span
          key={value}
          className={`animate-[numIn_0.45s_ease-out] text-[17px] font-bold tabular-nums ${TONES[tone].split(' ')[1]}`}
        >
          {value}
        </span>
        <span className={`text-[10px] font-semibold ${TONES[tone].split(' ')[1]}`}>M</span>
      </div>
      <div className="h-2.5">
        {delta && (
          <span className="inline-flex animate-[numIn_0.45s_ease-out] items-center gap-0.5 text-[8px] font-bold text-emerald-600">
            <ArrowUpRight className="h-2 w-2" />
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

function PaymentRow({ beat }: { beat: Beat }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg p-2 ring-1 transition-colors duration-500 ${
        beat === 1
          ? 'bg-primary/[0.04] ring-primary/25'
          : beat >= 2
            ? 'bg-emerald-50/60 ring-emerald-200'
            : 'bg-white ring-gray-100'
      }`}
    >
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-[9px] font-bold text-white">
        MG
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[10px] font-semibold text-gray-900">Martín Gómez</p>
        <p className="truncate text-[8.5px] text-gray-400">Av. Colón 1240 · $650.000</p>
      </div>
      <RowState beat={beat} />
    </div>
  );
}

function RowState({ beat }: { beat: Beat }) {
  if (beat === 0) {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[8.5px] font-semibold text-amber-600">
        Vence en 4 días
      </span>
    );
  }
  if (beat === 1) {
    return (
      <span className="flex shrink-0 animate-[numIn_0.4s_ease-out] items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[8.5px] font-semibold text-primary">
        <FileText className="h-2.5 w-2.5" /> Comprobante
      </span>
    );
  }
  if (beat === 2) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-1 text-[8.5px] font-semibold text-white">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Validando
      </span>
    );
  }
  return (
    <span className="flex shrink-0 animate-[numIn_0.4s_ease-out] items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-[8.5px] font-semibold text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} /> Cobrado
    </span>
  );
}

function Toast({ show, variant }: { show: boolean; variant: 'comprobante' | 'rendicion' }) {
  const comprobante = variant === 'comprobante';
  return (
    <div
      className={`absolute -right-3 ${comprobante ? 'top-6' : 'bottom-10'} z-10 w-[200px] transition-all duration-500 ${
        show ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'
      }`}
    >
      <div className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white/95 p-2.5 shadow-[0_12px_30px_-12px_rgba(60,30,120,0.4)] backdrop-blur">
        <div
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${
            comprobante ? 'bg-primary' : 'bg-emerald-500'
          }`}
        >
          {comprobante ? <Bell className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-bold text-gray-900">
            {comprobante ? 'Comprobante recibido' : 'Rendición lista'}
          </p>
          <p className="mt-0.5 text-[9px] text-gray-500">
            {comprobante
              ? 'Martín subió su pago desde la app.'
              : 'María Paz cobra su alquiler hoy.'}
          </p>
        </div>
      </div>
    </div>
  );
}
