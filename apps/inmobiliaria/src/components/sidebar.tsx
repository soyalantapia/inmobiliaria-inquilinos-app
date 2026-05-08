'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Plus,
  ShieldCheck,
  CreditCard,
  Settings,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contratos', label: 'Contratos', icon: FileText },
  { href: '/contratos/nuevo', label: 'Cargar contrato', icon: Plus },
  { href: '/screening', label: 'Screening', icon: ShieldCheck },
  { href: '/pagos', label: 'Pagos del mes', icon: CreditCard },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
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
    </aside>
  );
}
