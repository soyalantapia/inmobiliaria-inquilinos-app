'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Isotipo } from './isotipo';
import {
  Inbox,
  LayoutDashboard,
  FileText,
  LogOut,
  Megaphone,
  ShieldCheck,
  CreditCard,
  Settings,
  Menu,
  Building,
  Building2,
  CalendarHeart,
  HardHat,
  KeyRound,
  Landmark,
  Users,
  Wallet,
  WalletCards,
  Wrench,
  ScrollText,
  Bug,
  X,
} from 'lucide-react';
import { listarPendientes } from '@/lib/aprobaciones-storage';
import { apiEnabled, setToken } from '@/lib/api/client';
import { cargarSociedades } from '@/lib/api/use-sociedades';
import { useAprobaciones, useMe } from '@/lib/api/hooks';
import { cn } from '@llave/ui/cn';
import { CountBadge } from '@/components/count-badge';
import { calcularResumenPlan } from '@/lib/plan';
import { diasRestantesTrial, leerTrial, trialVigente } from '@/lib/trial-storage';
import type { Capacidad, Rol } from '@/lib/permisos';
import { rolTienePermiso } from '@/lib/permisos';
import { getRolActual, ROL_CHANGE_EVENT } from '@/lib/rol-storage';

type NavLink = {
  href: string;
  label: string;
  icon: React.ElementType;
  sub?: boolean;
  capacidad?: Capacidad;
};

const links: NavLink[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard, capacidad: 'home.ver' },
  { href: '/propiedades', label: 'Propiedades', icon: Building2, capacidad: 'propiedades.ver' },
  // Propietarios como sección propia: la inmobiliaria piensa por dueño ("rendirle
  // a X", "cargar el CBU de Y"), no sólo por propiedad. Antes sólo se llegaba de
  // rebote desde tarjetas del dashboard y nadie la encontraba.
  { href: '/propietarios', label: 'Propietarios', icon: KeyRound, capacidad: 'propiedades.ver' },
  { href: '/pagos', label: 'Pagos', icon: CreditCard, capacidad: 'pagos.ver' },
  { href: '/caja', label: 'Caja', icon: Wallet, capacidad: 'caja.ver' },
  { href: '/cuentas', label: 'Cuentas', icon: WalletCards, capacidad: 'cuentas.ver' },
  { href: '/depositos', label: 'Depósitos', icon: Landmark, capacidad: 'contratos.ver' },
  { href: '/contratos', label: 'Contratos', icon: FileText, capacidad: 'contratos.ver' },
  { href: '/inquilinos', label: 'Inquilinos', icon: Users, capacidad: 'contratos.ver' },
  { href: '/aprobaciones', label: 'Aprobaciones', icon: Inbox, capacidad: 'contrato.aprobar' },
  { href: '/renovaciones', label: 'Renovaciones', icon: CalendarHeart, capacidad: 'contratos.ver' },
  { href: '/consorcios', label: 'Consorcios', icon: Building, capacidad: 'propiedades.ver' },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench, capacidad: 'reclamos.ver' },
  { href: '/anuncios', label: 'Anuncios', icon: Megaphone, capacidad: 'comunicaciones.enviar' },
  { href: '/profesionales', label: 'Profesionales', icon: HardHat, capacidad: 'profesionales.ver' },
  // Red compartida: acceso directo al ecosistema cross-tenant (antes solo se
  // llegaba desde dentro de "Profesionales"). Es el gancho comercial del producto.
  { href: '/profesionales/red', label: 'Red compartida', icon: ShieldCheck, sub: true, capacidad: 'profesionales.ver' },
  { href: '/screening', label: 'Verificar inquilino', icon: ShieldCheck, capacidad: 'screening.ver' },
  { href: '/auditoria', label: 'Auditoría', icon: ScrollText, capacidad: 'auditoria.ver' },
  { href: '/soporte', label: 'Soporte', icon: Bug, capacidad: 'auditoria.ver' },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

function SidebarBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();
  // Hidratar las sociedades reales del tenant apenas se entra a la app, para que
  // los PDF de cobranza (que leen sociedadPrincipal() de localStorage) usen la
  // razón social + CUIT reales y no el SEED demo. Idempotente.
  useEffect(() => {
    void cargarSociedades();
  }, []);
  // El "Cerrar sesión" vivía detrás del avatar del topbar (menú de cuenta):
  // costaba encontrarlo y el avatar no aportaba nada. Ahora vive acá, en el
  // footer del sidebar, junto a los datos de la cuenta (I/2026-07: pedido del
  // dueño — sacar el avatar del header).
  const cerrarSesion = () => {
    setToken(null);
    router.replace('/login');
  };
  const plan = calcularResumenPlan();
  const trial = leerTrial();
  const trialActivo = trialVigente(trial);
  const diasTrial = trialActivo ? diasRestantesTrial(trial) : 0;
  const [pendientesLocal, setPendientesLocal] = useState(0);
  const [rol, setRol] = useState<Rol>('ADMIN');

  // En producción el badge cuenta las aprobaciones reales del API; en build
  // demo (!apiEnabled) usa el store local.
  const { aprobaciones } = useAprobaciones();
  // Solo las PENDIENTE: GET /aprobaciones devuelve todas (incl. APROBADA/RECHAZADA)
  // → el badge contaba las ya decididas. El badge refleja lo que falta resolver.
  const pendientes = apiEnabled
    ? aprobaciones.filter((a) => a.estado === 'PENDIENTE').length
    : pendientesLocal;
  const { me } = useMe();

  useEffect(() => {
    if (apiEnabled) return;
    setPendientesLocal(listarPendientes().length);
    const handler = () => setPendientesLocal(listarPendientes().length);
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [pathname]);

  useEffect(() => {
    setRol(getRolActual());
    const handleRolChange = () => setRol(getRolActual());
    window.addEventListener('storage', handleRolChange);
    window.addEventListener(ROL_CHANGE_EVENT, handleRolChange);
    return () => {
      window.removeEventListener('storage', handleRolChange);
      window.removeEventListener(ROL_CHANGE_EVENT, handleRolChange);
    };
  }, []);

  const linksVisibles = links.filter(
    (l) =>
      (!l.capacidad || rolTienePermiso(rol, l.capacidad)) &&
      // "Verificar inquilino" OCULTO en prod (pedido del dueño 07/07): el
      // screening actual no funciona bien y se rehace la semana próxima. En el
      // build demo queda visible (ahí el mock anda y se usa para demos).
      !(apiEnabled && l.href === '/screening'),
  );

  // El header muestra el nombre de la inmobiliaria (que se sienta SU panel).
  // Mientras carga / sin dato cae a la marca genérica.
  const inmoNombre = me?.inmobiliaria?.trim() ?? '';

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Isotipo size={32} className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight" title={inmoNombre || 'My Alquiler'}>
            {inmoNombre || 'My Alquiler'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {inmoNombre ? 'Panel · My Alquiler' : 'Panel inmobiliaria'}
          </p>
        </div>
      </div>
      {/* overflow-y-auto: con el sidebar fijo a viewport (sticky h-screen) la
          nav scrollea sola si no entra, y el footer (cuenta + Cerrar sesión)
          queda SIEMPRE visible abajo. */}
      <nav aria-label="Navegación principal" className="flex-1 space-y-1 overflow-y-auto p-3">
        {linksVisibles.map((l) => {
          const active =
            l.href === '/'
              ? pathname === '/'
              : pathname === l.href || pathname.startsWith(`${l.href}/`);
          const Icon = l.icon;
          const esSub = l.sub === true;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md py-2 text-sm transition-colors',
                // Los sub-items van indentados con el ícono más chico,
                // para que se lean como "acción de Contratos".
                esSub ? 'pl-10 pr-3' : 'px-3',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className={esSub ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span className="flex-1">{l.label}</span>
              {l.href === '/aprobaciones' && (
                <CountBadge count={pendientes} />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        {apiEnabled ? (
          <>
            <p className="font-medium text-foreground">{me?.nombre ?? 'Mi cuenta'}</p>
            {me?.email && <p className="truncate">{me.email}</p>}
          </>
        ) : (
        <>
        <p className="font-medium text-foreground">Inmobiliaria del Sol</p>
        <p>
          Plan {plan.plan} ·{' '}
          {(() => {
            // "propiedad" o "propiedades" según conteo. Si hay tope
            // mostramos "X/Y propiedades" sin singularizar — siempre
            // hay un tope >1, así que el plural es seguro.
            const n = plan.propiedadesActivas;
            const sufijo = n === 1 ? 'propiedad' : 'propiedades';
            return plan.topePlan !== null
              ? `${n}/${plan.topePlan} propiedades`
              : `${n} ${sufijo}`;
          })()}
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
        </>
        )}
        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  return (
    // sticky + h-screen: antes el aside se estiraba a la altura de la página
    // entera y el footer (con "Cerrar sesión") quedaba enterrado al fondo del
    // scroll. Fijo a viewport, la nav scrollea adentro y el footer se ve siempre.
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-card md:flex md:flex-col">
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
        type="button"
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
              type="button"
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
