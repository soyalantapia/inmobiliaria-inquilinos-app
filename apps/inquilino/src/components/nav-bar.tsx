'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Receipt, Wrench } from 'lucide-react';
import { cn } from '@llave/ui/cn';

const items = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/contrato', label: 'Contrato', icon: FileText },
  { href: '/comprobantes', label: 'Comprobantes', icon: Receipt },
  { href: '/reclamos/nuevo', label: 'Reclamo', icon: Wrench },
] as const;

export function NavBar() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <ul className="flex h-16 items-center justify-around">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
