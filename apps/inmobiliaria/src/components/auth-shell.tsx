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
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* IZQUIERDA — formulario */}
      <div className="flex min-h-screen flex-col bg-background lg:min-h-0">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-6 py-10 sm:px-10">
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
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[hsl(262_78%_56%)] to-[hsl(262_70%_42%)] lg:flex">
        {/* Glows decorativos sutiles */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col justify-center gap-8 px-12 py-12 text-white">
          <div className="space-y-4">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Para inmobiliarias
            </span>
            <h1 className="text-3xl font-bold leading-tight xl:text-4xl">
              Cobrá tus alquileres sin perseguir a nadie
            </h1>
            <p className="max-w-md text-sm text-white/80 xl:text-base">
              El panel que ordena tu cartera + la app donde tus inquilinos pagan, reclaman y ven su
              contrato.
            </p>
          </div>

          {/* Value props */}
          <div className="space-y-3">
            <ValueProp icon={Wallet} text="Cobranzas y mora en tiempo real" />
            <ValueProp icon={Smartphone} text="Tus inquilinos pagan desde su app" />
            <ValueProp icon={FileText} text="Rendí a propietarios sin Excel" />
          </div>

          {/* Mockup del producto */}
          <AppMockup />

          {/* Badge de cierre */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium">
            <Rocket className="h-4 w-4" />
            Gratis hasta el lanzamiento · sin tarjeta
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueProp({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <span className="text-sm font-medium text-white/90">{text}</span>
    </div>
  );
}
