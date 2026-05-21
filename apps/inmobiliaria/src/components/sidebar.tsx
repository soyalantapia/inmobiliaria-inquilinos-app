'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Plus,
  Rocket,
  ShieldCheck,
  CreditCard,
  Settings,
  Menu,
  Building,
  Building2,
  CalendarHeart,
  HardHat,
  Wallet,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { calcularResumenPlan } from '@/lib/plan';
import { diasRestantesTrial, leerTrial, trialVigente } from '@/lib/trial-storage';

const links = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/propiedades', label: 'Propiedades', icon: Building2 },
  { href: '/propietarios', label: 'Propietarios', icon: Users },
  { href: '/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/caja', label: 'Caja', icon: Wallet },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/contratos/nuevo', label: 'Cargar contrato', icon: Plus },
  { href: '/renovaciones', label: 'Renovaciones', icon: CalendarHeart },
  { href: '/consorcios', label: 'Consorcios', icon: Building },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench },
  { href: '/profesionales', label: 'Profesionales', icon: HardHat },
  { href: '/screening', label: 'Verificar inquilino', icon: ShieldCheck },
  { href: '/roadmap', label: 'Roadmap', icon: Rocket },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
] as const;

function SidebarBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const plan = calcularResumenPlan();
  const trial = leerTrial();
  const trialActivo = trialVigente(trial);
  const diasTrial = trialActivo ? diasRestantesTrial(trial) : 0;
  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
          My
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">My Alquiler</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Panel inmobiliaria
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map((l) => {
          const active =
            l.href === '/'
              ? pathname === '/'
              : pathname === l.href || pathname.startsWith(`${l.href}/`);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Inmobiliaria del Sol</p>
        <p>
          Plan {plan.plan} ·{' '}
          {plan.topePlan !== null
            ? `${plan.propiedadesActivas}/${plan.topePlan} propiedades`
            : `${plan.propiedadesActivas} propiedades`}
        </p>
        {trialActivo && (
          <Link
            href="/configuracion#plan"
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            🎁 Trial · {diasTrial} día{diasTrial === 1 ? '' : 's'}
          </Link>
        )}
        {!trialActivo &&
          plan.topePlan !== null &&
          plan.topePlan - plan.propiedadesActivas <= 3 && (
            <Link
              href="/configuracion#plan"
              className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            >
              ⚡ Cerca del tope · Subir
            </Link>
          )}
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <SidebarBody pathname={pathname} />
    </aside>
  );
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '/';

  // cerrar al cambiar de ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full p-2 hover:bg-muted md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative flex h-full w-64 flex-col bg-card shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-full p-1.5 hover:bg-muted"
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
