'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Plus,
  ShieldCheck,
  CreditCard,
  Settings,
  Menu,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/contratos/nuevo', label: 'Cargar contrato', icon: Plus },
  { href: '/propietarios', label: 'Propietarios', icon: Users },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench },
  { href: '/screening', label: 'Screening', icon: ShieldCheck },
  { href: '/pagos', label: 'Pagos del mes', icon: CreditCard },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
] as const;

function SidebarBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          L
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Llave</p>
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
        <p>Plan Starter · 87/100 contratos</p>
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
