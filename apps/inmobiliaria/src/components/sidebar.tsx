'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Isotipo } from './isotipo';
import { ReportBugButton } from './report-bug-button';
import {
  BarChart3,
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
import { limpiarSociedadesCache } from '@/lib/sociedades-storage';
import { useAprobaciones, useMe } from '@/lib/api/hooks';
import { cn } from '@llave/ui/cn';
import { CountBadge } from '@/components/count-badge';
import { AvatarUsuario } from '@/components/avatar-usuario';
import { calcularResumenPlan } from '@/lib/plan';
import { diasRestantesTrial, leerTrial, trialVigente } from '@/lib/trial-storage';
import type { Capacidad, Rol } from '@/lib/permisos';
import { rolTienePermiso } from '@/lib/permisos';
import { getRolActual, normalizarRol, ROL_CHANGE_EVENT } from '@/lib/rol-storage';

/**
 * Los bloques del menú, en orden. El menú tenía 19 filas planas donde una
 * entidad real (Propiedades) y una vista derivada (Inquilinos, que no tiene ni
 * una acción de escritura) se dibujaban con exactamente el mismo peso.
 * Agrupar no saca ninguna sección: sólo deja de pedirle al usuario que ordene
 * 19 cosas en la cabeza cada vez que busca una.
 */
const GRUPOS = ['Día a día', 'Personas', 'Plata', 'Seguimiento', 'Sistema'] as const;
type Grupo = (typeof GRUPOS)[number];

/**
 * A partir de cuántos ítems visibles conviene agrupar. Con menos, los
 * encabezados cuestan más de lo que ordenan: el rol CARGA ve 9 ítems y dos de
 * los bloques le quedarían con UNA fila cada uno, que se lee peor que la lista
 * plana. Se descubrió mirando el mockup con el selector de rol.
 */
const MINIMO_PARA_AGRUPAR = 11;

type NavLink = {
  href: string;
  label: string;
  icon: React.ElementType;
  sub?: boolean;
  capacidad?: Capacidad;
  grupo: Grupo;
};

// El orden del array define el orden dentro de cada bloque.
// Los RENOMBRES son de la auditoría 03/08: el problema no era sólo la cantidad
// de filas, era que el mismo sustantivo significaba dos cosas distintas en dos
// ítems distintos ("está todo bien dicho y me confundo igual").
const links: NavLink[] = [
  /* ---- Día a día: lo que se toca todos los días ---- */
  { href: '/', label: 'Inicio', icon: LayoutDashboard, capacidad: 'home.ver', grupo: 'Día a día' },
  { href: '/propiedades', label: 'Propiedades', icon: Building2, capacidad: 'propiedades.ver', grupo: 'Día a día' },
  { href: '/contratos', label: 'Contratos', icon: FileText, capacidad: 'contratos.ver', grupo: 'Día a día' },
  { href: '/pagos', label: 'Pagos', icon: CreditCard, capacidad: 'pagos.ver', grupo: 'Día a día' },
  { href: '/reclamos', label: 'Reclamos', icon: Wrench, capacidad: 'reclamos.ver', grupo: 'Día a día' },

  /* ---- Personas ---- */
  // Propietarios como sección propia: la inmobiliaria piensa por dueño ("rendirle
  // a X", "cargar el CBU de Y"), no sólo por propiedad. Antes sólo se llegaba de
  // rebote desde tarjetas del dashboard y nadie la encontraba.
  { href: '/propietarios', label: 'Propietarios', icon: KeyRound, capacidad: 'propiedades.ver', grupo: 'Personas' },
  { href: '/inquilinos', label: 'Inquilinos', icon: Users, capacidad: 'contratos.ver', grupo: 'Personas' },
  { href: '/profesionales', label: 'Profesionales', icon: HardHat, capacidad: 'profesionales.ver', grupo: 'Personas' },
  // Red compartida: acceso directo al ecosistema cross-tenant (antes solo se
  // llegaba desde dentro de "Profesionales"). Es el gancho comercial del producto.
  { href: '/profesionales/red', label: 'Red compartida', icon: ShieldCheck, sub: true, capacidad: 'profesionales.ver', grupo: 'Personas' },

  /* ---- Plata ---- */
  // "Caja" a secas se confundía con la caja del día y con Cuentas; el ícono de
  // "Depósitos" es un banco, y para una recepcionista un depósito es primero un
  // depósito bancario, no la garantía del inquilino.
  { href: '/caja', label: 'Caja de gastos', icon: Wallet, capacidad: 'caja.ver', grupo: 'Plata' },
  { href: '/cuentas', label: 'Cuentas', icon: WalletCards, capacidad: 'cuentas.ver', grupo: 'Plata' },
  { href: '/depositos', label: 'Depósitos de garantía', icon: Landmark, capacidad: 'contratos.ver', grupo: 'Plata' },

  /* ---- Seguimiento ---- */
  { href: '/estadisticas', label: 'Estadísticas', icon: BarChart3, capacidad: 'metricas.ver', grupo: 'Seguimiento' },
  // "Renovaciones" pasó a "Vencimientos y avisos" porque eso es lo que hace:
  // registra la intención del inquilino (y el preaviso de egreso) sin tocar el
  // contrato. La renovación real es POST /contratos/:id/renovar, desde la ficha.
  // El renombre sale JUNTO con el CTA "Renovar el contrato" que ahora aparece
  // en las filas ya marcadas como RENOVAR y lleva hasta ahí: renombrarlo solo
  // habría sido hacer que mintiera un poco menos, dejando el hueco.
  { href: '/renovaciones', label: 'Vencimientos y avisos', icon: CalendarHeart, capacidad: 'contratos.ver', grupo: 'Seguimiento' },
  { href: '/anuncios', label: 'Anuncios', icon: Megaphone, capacidad: 'comunicaciones.enviar', grupo: 'Seguimiento' },
  { href: '/consorcios', label: 'Consorcios', icon: Building, capacidad: 'propiedades.ver', grupo: 'Seguimiento' },

  /* ---- Sistema ---- */
  { href: '/screening', label: 'Verificar inquilino', icon: ShieldCheck, capacidad: 'screening.ver', grupo: 'Sistema' },
  // "Auditoría" y "Soporte" decían otra cosa de la que son: la primera es el
  // historial de lo que hizo el equipo, y la segunda NO es ayuda al usuario
  // sino la bandeja de bugs de Sonar. El que se trababa y buscaba ayuda en el
  // menú caía justamente ahí.
  { href: '/auditoria', label: 'Historial de acciones', icon: ScrollText, capacidad: 'auditoria.ver', grupo: 'Sistema' },
  { href: '/soporte', label: 'Bugs reportados', icon: Bug, capacidad: 'auditoria.ver', grupo: 'Sistema' },
  { href: '/configuracion', label: 'Configuración', icon: Settings, capacidad: 'configuracion.ver', grupo: 'Sistema' },
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
    // Limpiar el cache de sociedades: es dato del TENANT, no de la app. En una PC
    // compartida (el mostrador de la inmobiliaria) el siguiente que entraba heredaba la
    // razón social y el CUIT del anterior y los imprimía en sus PDF de cobranza.
    limpiarSociedadesCache();
    router.replace('/login');
  };
  const plan = calcularResumenPlan();
  const trial = leerTrial();
  const trialActivo = trialVigente(trial);
  const diasTrial = trialActivo ? diasRestantesTrial(trial) : 0;
  const [pendientesLocal, setPendientesLocal] = useState(0);
  // rolDemo: SOLO para el build demo (sin API), donde el rol se elige localmente.
  // En prod el rol efectivo se deriva de la sesión real (`me.rol`) más abajo.
  const [rolDemo, setRolDemo] = useState<Rol>('ADMIN');

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
    if (apiEnabled) return; // en prod el rol viene de me.rol, no del localStorage
    setRolDemo(getRolActual());
    const handleRolChange = () => setRolDemo(getRolActual());
    window.addEventListener('storage', handleRolChange);
    window.addEventListener(ROL_CHANGE_EVENT, handleRolChange);
    return () => {
      window.removeEventListener('storage', handleRolChange);
      window.removeEventListener(ROL_CHANGE_EVENT, handleRolChange);
    };
  }, []);

  // Rol EFECTIVO con el que se filtra el menú. En prod sale de la sesión real
  // (`me.rol` de /auth/me); antes se leía del localStorage, que nadie seteaba
  // nunca, así que TODO usuario —auditora incluida— veía el menú de ADMIN y
  // comía 403 al clickear (por eso "parecía roto" y nadie creaba usuarios
  // secundarios). Mientras `me` carga, piso a LECTURA: nunca de más.
  const rol: Rol = apiEnabled ? normalizarRol(me?.rol, 'LECTURA') : rolDemo;

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
        {(() => {
          // El padre NO se prende si otro ítem visible matchea la ruta exacta.
          // Sin esto, en /profesionales/red se prendían las dos filas a la vez
          // (Profesionales por el startsWith y Red compartida por el match).
          const hayHijoExacto = linksVisibles.some((otro) => otro.href === pathname);

          const fila = (l: NavLink) => {
            const active =
              l.href === '/'
                ? pathname === '/'
                : pathname === l.href || (!hayHijoExacto && pathname.startsWith(`${l.href}/`));
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
                {l.href === '/pagos' && pendientes > 0 && <CountBadge count={pendientes} />}
              </Link>
            );
          };

          // Con pocos ítems los encabezados estorban más de lo que ordenan
          // (ver MINIMO_PARA_AGRUPAR): el rol CARGA queda mejor con la lista plana.
          if (linksVisibles.length < MINIMO_PARA_AGRUPAR) return linksVisibles.map(fila);

          return GRUPOS.map((grupo) => {
            const items = linksVisibles.filter((l) => l.grupo === grupo);
            // El encabezado no se dibuja si al rol no le quedó ningún hijo visible.
            if (items.length === 0) return null;
            return (
              <div key={grupo} className="space-y-1 pt-3 first:pt-0">
                <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {grupo}
                </p>
                {items.map(fila)}
              </div>
            );
          });
        })()}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        {apiEnabled ? (
          <div className="flex items-center gap-2">
            <AvatarUsuario
              imageUrl={me?.imageUrl ?? null}
              iniciales={me?.iniciales ?? '?'}
              editable={!!me}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{me?.nombre ?? 'Mi cuenta'}</p>
              {me?.email && <p className="truncate">{me.email}</p>}
            </div>
            {/* Acciones secundarias como iconos, pegadas a la cuenta: reportar un
                bug (antes un FAB flotante que tapaba contenido) y cerrar sesión. */}
            <div className="flex shrink-0 items-center gap-0.5">
              <ReportBugButton />
              <button
                type="button"
                onClick={cerrarSesion}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
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
        {/* Con API, cerrar sesión vive arriba como icono al lado de la cuenta.
            En demo (sin API) no hay bloque de cuenta, así que mantenemos el
            botón con texto para que no quede un icono suelto sin contexto. */}
        {!apiEnabled && (
          <button
            type="button"
            onClick={cerrarSesion}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        )}
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
