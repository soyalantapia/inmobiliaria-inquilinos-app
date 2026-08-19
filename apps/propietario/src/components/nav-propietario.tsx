'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Receipt, User, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@llave/ui/cn';

/**
 * Navegación del portal del propietario.
 *
 * Mismo patrón que la app del inquilino: barra inferior en mobile, barra lateral en desktop.
 * El propietario mira esto desde el celular cuando le llega el aviso de que le depositaron, y
 * desde la computadora cuando se sienta a revisar el año — las dos formas tienen que estar.
 *
 * CUATRO PESTAÑAS Y NINGUNA MÁS. Sin ítem central elevado, a diferencia del inquilino: ese FAB
 * existe ahí porque hay una acción de CREAR que se usa todo el tiempo (reportar un problema).
 * Acá no hay ninguna acción: el portal es de sólo lectura, y un botón destacado que sólo
 * navega es ruido con jerarquía prestada.
 */

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: Item[] = [
  { href: '/', label: 'Pagos', icon: Receipt },
  { href: '/unidades', label: 'Unidades', icon: Building2 },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench },
  { href: '/perfil', label: 'Mi perfil', icon: User },
];

function activo(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Barra inferior — sólo mobile. */
export function NavPropietario() {
  const pathname = usePathname() ?? '/';
  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden"
    >
      <ul role="list" className="flex h-16 items-stretch justify-around">
        {ITEMS.map((item) => {
          const act = activo(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={act ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 px-1 text-[10px] transition-colors',
                  act ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barra lateral — desde md. */
export function SideNavPropietario() {
  const pathname = usePathname() ?? '/';
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
          My
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">My Alquiler</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Propietario</p>
        </div>
      </div>
      <nav aria-label="Navegación principal" className="flex-1 p-3">
        <ul role="list" className="space-y-1">
          {ITEMS.map((item) => {
            const act = activo(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={act ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    act ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
