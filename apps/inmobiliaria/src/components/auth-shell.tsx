'use client';

import type { JSX } from 'react';
import { FileText, Rocket, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { AppMockup } from './app-mockup';

/**
 * Contenedor de presentación para las pantallas de auth (login / registro).
 * Split-screen: a la IZQUIERDA el formulario (`children`), a la DERECHA un hero
 * violeta premium con value-props + el mockup del producto. No maneja lógica de
 * auth — sólo el marco visual que convence de registrarse.
 */
export function AuthShell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="min-h-screen lg:grid lg:h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:overflow-hidden">
      {/* IZQUIERDA — formulario */}
      <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:min-h-0 lg:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-6 py-8 sm:px-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
              My
            </div>
            <div>
              <p className="font-semibold leading-tight">My Alquiler</p>
              <p className="text-xs text-muted-foreground">Panel inmobiliaria</p>
            </div>
          </div>

          {/* Mini-tira de marca: sólo en mobile, para no perder el gancho del hero */}
          <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50 p-3 lg:hidden dark:border-violet-900/40 dark:bg-violet-900/10">
            <p className="text-sm font-medium text-primary">
              Cobrá tus alquileres sin perseguir a nadie.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              El panel + la app donde tus inquilinos pagan y reclaman.
            </p>
          </div>

          {/* Form */}
          <div className="flex flex-1 flex-col justify-center py-10">{children}</div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            © My Alquiler · Hecho para inmobiliarias
          </p>
        </div>
      </div>

      {/* DERECHA — hero premium */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[hsl(262_78%_56%)] to-[hsl(262_70%_42%)] lg:flex lg:h-screen">
        {/* Glows decorativos sutiles */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col justify-center gap-3 px-10 py-5 text-white xl:gap-4 xl:px-12 xl:py-8">
          <div className="space-y-2">
            <span className="inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              Hecho por inmobiliarias, para inmobiliarias
            </span>
            <h1 className="text-[22px] font-bold leading-[1.08] xl:text-[32px]">
              Cobrá tus alquileres sin perseguir a nadie
            </h1>
            <p className="max-w-md text-[13px] leading-snug text-white/80 xl:text-sm">
              El panel que ordena tu cartera + la app donde tus inquilinos pagan, reclaman y ven su
              contrato.
            </p>
          </div>

          {/* Badge de oferta — arriba, junto al pitch */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium">
            <Rocket className="h-4 w-4" />
            Gratis hasta el lanzamiento · sin tarjeta
          </div>

          {/* Value props */}
          <div className="space-y-2">
            <ValueProp icon={Wallet} text="Cobranzas y mora en tiempo real" />
            <ValueProp icon={Smartphone} text="Tus inquilinos pagan desde su app" />
            <ValueProp icon={FileText} text="Rendí a propietarios sin Excel" />
          </div>

          {/* Mockup del producto */}
          <AppMockup />

          {/* Apoyan — CPI Córdoba */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Apoyan
            </span>
            <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
              <CpiLogo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueProp({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-[13px] font-medium text-white/90">{text}</span>
    </div>
  );
}

/**
 * Logo del Colegio Profesional de Inmobiliarios de Córdoba (CPI), recreado en
 * HTML/CSS para usarlo como sello "Apoyan". Va sobre un chip blanco para que el
 * verde petróleo y el wordmark se lean. Para usar el asset oficial exacto:
 * dejar el archivo en `public/cpi-cordoba.svg` y reemplazar este componente por
 * un <Image src="/cpi-cordoba.svg" .../>.
 */
function CpiLogo() {
  return (
    <div className="flex items-center gap-1.5">
      {/* Sello CPI */}
      <div className="flex flex-col items-center justify-center rounded-[5px] bg-[#0E4C46] px-1.5 py-1 leading-none">
        <span className="text-[15px] font-extrabold leading-none tracking-tight text-[#F3D24E]">
          CPI
        </span>
        <span className="mt-px text-[4px] font-bold leading-none tracking-[0.18em] text-[#F3D24E]">
          CÓRDOBA
        </span>
      </div>
      {/* Wordmark */}
      <div className="leading-[1.1]">
        <p className="text-[6.5px] font-extrabold uppercase tracking-wide text-[#0E4C46]">Colegio</p>
        <p className="text-[6.5px] font-extrabold uppercase tracking-wide text-[#0E4C46]">
          Profesional de
        </p>
        <p className="text-[6.5px] font-extrabold uppercase tracking-wide text-[#0E4C46]">
          Inmobiliarios
        </p>
      </div>
    </div>
  );
}
