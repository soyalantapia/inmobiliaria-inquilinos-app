'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  CircleHelp,
  FileText,
  Receipt,
  Sparkles,
  User,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { useMiContrato } from '@/lib/api/hooks';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// El Asistente IA va en el CENTRO (índice 2 de 5) y se renderiza como botón
// elevado (FAB) en el bottom-nav mobile: es el diferenciador del producto y
// el patrón moderno de navegación. El orden agrupa lo "de plata" a la
// izquierda (Inicio, Pagos) y lo documental a la derecha (Contrato, Reclamos).
const itemsPrimarios: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Wallet },
  { href: '/comprobantes', label: 'Pagos', icon: Receipt },
  { href: '/broker', label: 'Asistente', icon: Sparkles },
  { href: '/contrato', label: 'Contrato', icon: FileText },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench },
];

const itemsSecundarios: NavItem[] = [
  { href: '/servicios', label: 'Servicios', icon: Zap },
  { href: '/certificado', label: 'Mi certificado', icon: BadgeCheck },
  { href: '/ayuda', label: 'Ayuda', icon: CircleHelp },
  { href: '/cuenta', label: 'Mi cuenta', icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname() ?? '/';
  // El ítem del medio (Asistente) se renderiza como botón central elevado.
  const centerIndex = Math.floor(itemsPrimarios.length / 2);
  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden"
    >
      <ul role="list" className="flex h-16 items-end justify-around">
        {itemsPrimarios.map((item, i) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          // Botón central elevado (FAB): el Asistente IA, diferenciador del
          // producto. Sobresale por encima del borde del nav; el anillo del
          // color de fondo crea el efecto "notch" alrededor del círculo.
          if (i === centerIndex) {
            return (
              <li key={item.href} className="flex flex-1 justify-center">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  className="group flex flex-col items-center"
                >
                  <span
                    className={cn(
                      '-mt-8 grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-primary to-fuchsia-600 text-white shadow-lg shadow-primary/40 ring-4 ring-background transition-transform group-active:scale-95',
                      active && 'ring-primary/15',
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span
                    className={cn(
                      'mb-2 mt-1 text-[10px] font-semibold',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1 min-w-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
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

// Sidebar para desktop (>=md). Tiene los items primarios + sección secundaria
// (Cuenta, Ayuda) abajo. En mobile la NavBar solo muestra los primarios (5
// caben justo) y Cuenta/Ayuda se acceden por el avatar del header.
export function SideNav() {
  const pathname = usePathname() ?? '/';
  const { contrato } = useMiContrato();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          My
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">My Alquiler</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Inquilino</p>
        </div>
      </div>
      <nav aria-label="Navegación principal" className="flex-1 space-y-4 p-3">
        <ul role="list" className="space-y-1">
          {itemsPrimarios.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </ul>

        <div>
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cuenta
          </p>
          <ul role="list" className="space-y-1">
            {itemsSecundarios.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </ul>
        </div>
      </nav>
      {contrato && (
        <div className="border-t p-3 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tu hogar</p>
          <p className="mt-0.5 font-medium leading-tight">{contrato.direccion}</p>
          <p className="text-[10px] text-muted-foreground">{contrato.inmobiliaria}</p>
        </div>
      )}
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
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
    </li>
  );
}
