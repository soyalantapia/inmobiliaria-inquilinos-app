'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Receipt, Sparkles, Wallet, Wrench } from 'lucide-react';
import { cn } from '@llave/ui/cn';

const items = [
  { href: '/', label: 'Pagos', icon: Wallet },
  { href: '/broker', label: 'Broker', icon: Sparkles },
  { href: '/contrato', label: 'Contrato', icon: FileText },
  { href: '/comprobantes', label: 'Recibos', icon: Receipt },
  { href: '/reclamos/nuevo', label: 'Reclamo', icon: Wrench },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden">
      <ul className="flex h-16 items-center justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 min-w-0">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-1 py-2 text-[10px] transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Sidebar para desktop (>=md). Mismo set de items, layout vertical.
export function SideNav() {
  const pathname = usePathname() ?? '/';
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
          L
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Llave</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Inquilino</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tu hogar</p>
        <p className="mt-0.5 font-medium leading-tight">Gorriti 4521, 3°B</p>
        <p className="text-[10px] text-muted-foreground">Inmobiliaria del Sol</p>
      </div>
    </aside>
  );
}
