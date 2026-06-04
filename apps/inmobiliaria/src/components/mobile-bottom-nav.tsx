'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  Plus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { estadoDePago } from '@/lib/conciliacion-storage';
import { pagosInformadosMock } from '@/lib/mock-data';
import { listarReclamos } from '@/lib/reclamos-store';
import type { Capacidad, Rol } from '@/lib/permisos';
import { rolTienePermiso } from '@/lib/permisos';
import { getRolActual, ROL_CHANGE_EVENT } from '@/lib/rol-storage';

// Barra de navegación inferior tipo app, SOLO en mobile (`md:hidden`; en
// desktop manda la Sidebar). Trae las 4 secciones del día a día —Inicio,
// Propiedades, Pagos, Reclamos— y en el centro un FAB elevado para la acción
// primaria de una inmobiliaria: "Cargar contrato". El resto de las secciones
// sigue accesible desde el menú (hamburguesa) del topbar.
//
// Respeta permisos por rol (igual que la Sidebar) y muestra badges de
// pendientes en Pagos (comprobantes a validar) y Reclamos (sin asignar),
// con los mismos filtros que el inbox "Para resolver hoy".

type Tab = { href: string; label: string; icon: LucideIcon; capacidad?: Capacidad };

const TABS_IZQ: Tab[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard, capacidad: 'home.ver' },
  { href: '/propiedades', label: 'Propiedades', icon: Building2, capacidad: 'propiedades.ver' },
];

const TABS_DER: Tab[] = [
  { href: '/pagos', label: 'Pagos', icon: CreditCard, capacidad: 'pagos.ver' },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench, capacidad: 'reclamos.ver' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Conteos de pendientes — mismos filtros que components/inbox-del-dia.tsx
// (única fuente de verdad para no divergir del dashboard).
function contarPagosAValidar(): number {
  return pagosInformadosMock.filter((p) => estadoDePago(p.id) === 'INFORMADO').length;
}
function contarReclamosSinAsignar(): number {
  return listarReclamos().filter(
    (r) => (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') && !r.profesionalAsignadoId,
  ).length;
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? '/';
  const [rol, setRol] = useState<Rol>('ADMIN');
  const [pagosBadge, setPagosBadge] = useState(0);
  const [reclamosBadge, setReclamosBadge] = useState(0);

  useEffect(() => {
    setRol(getRolActual());
    const handler = () => setRol(getRolActual());
    window.addEventListener('storage', handler);
    window.addEventListener(ROL_CHANGE_EVENT, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(ROL_CHANGE_EVENT, handler);
    };
  }, []);

  // Refrescamos los badges al montar, al navegar (pathname) y cuando otra
  // pestaña/app toca el localStorage — igual que el badge de la Sidebar.
  useEffect(() => {
    const refrescar = () => {
      setPagosBadge(contarPagosAValidar());
      setReclamosBadge(contarReclamosSinAsignar());
    };
    refrescar();
    window.addEventListener('storage', refrescar);
    return () => window.removeEventListener('storage', refrescar);
  }, [pathname]);

  const puede = (c?: Capacidad) => !c || rolTienePermiso(rol, c);
  const izq = TABS_IZQ.filter((t) => puede(t.capacidad));
  const der = TABS_DER.filter((t) => puede(t.capacidad));
  const puedeCargar = rolTienePermiso(rol, 'contratos.crear');

  const badgeDe = (href: string): number =>
    href === '/pagos' ? pagosBadge : href === '/reclamos' ? reclamosBadge : 0;

  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="flex h-16 items-end justify-around pb-[env(safe-area-inset-bottom)]">
        {izq.map((t) => (
          <NavTab key={t.href} tab={t} active={isActive(pathname, t.href)} badge={badgeDe(t.href)} />
        ))}

        {/* FAB central elevado: "Cargar contrato", la acción primaria. */}
        {puedeCargar && (
          <li className="flex flex-1 justify-center">
            <Link
              href="/contratos/nuevo"
              aria-label="Cargar contrato"
              aria-current={isActive(pathname, '/contratos/nuevo') ? 'page' : undefined}
              className="group flex flex-col items-center"
            >
              <span
                className={cn(
                  '-mt-8 grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-white shadow-lg shadow-primary/40 ring-4 ring-background transition-transform group-active:scale-95',
                  isActive(pathname, '/contratos/nuevo') && 'ring-primary/20',
                )}
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <span
                className={cn(
                  'mb-2 mt-1 text-[10px] font-semibold',
                  isActive(pathname, '/contratos/nuevo') ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                Cargar
              </span>
            </Link>
          </li>
        )}

        {der.map((t) => (
          <NavTab key={t.href} tab={t} active={isActive(pathname, t.href)} badge={badgeDe(t.href)} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({ tab, active, badge = 0 }: { tab: Tab; active: boolean; badge?: number }) {
  const Icon = tab.icon;
  return (
    <li className="min-w-0 flex-1">
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center gap-1 px-1 py-2 text-[10px] transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span className="relative">
          <Icon className="h-5 w-5" />
          {badge > 0 && (
            <span
              aria-label={`${badge} pendiente${badge === 1 ? '' : 's'}`}
              className="absolute -right-2.5 -top-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background"
            >
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span className="max-w-full truncate">{tab.label}</span>
      </Link>
    </li>
  );
}
