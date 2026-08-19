'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { cn } from '@llave/ui/cn';
import { apiEnabled } from '@/lib/api/client';
import { listarReclamos } from '@/lib/reclamos-store';
import { useAResolverCount } from '@/lib/api/use-pagos';
import { useAprobaciones, useMe } from '@/lib/api/hooks';
import { useReclamos } from '@/lib/api/use-reclamos';
import { rolTienePermiso } from '@/lib/permisos';
import { normalizarRol } from '@/lib/rol-storage';

interface Notif {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  cuando: string;
  unread: boolean;
  icono: 'wrench' | 'card' | 'trend' | 'alert' | 'check';
}

const ICONS = {
  wrench: Wrench,
  card: CreditCard,
  trend: TrendingUp,
  alert: AlertTriangle,
  check: CheckCircle2,
} as const;

function buildNotifs(): Notif[] {
  // En producción todavía no hay feed de notificaciones en el API → vacío
  // (no mostramos eventos ficticios del mock como si fueran reales).
  if (apiEnabled) return [];
  // construimos las notificaciones a partir de los reclamos abiertos del STORE
  // (no del mock congelado) + algunos eventos sintéticos del dashboard. Así, al
  // resolver un reclamo, la campana deja de listarlo igual que el Inbox del día.
  const reclamosAbiertos = listarReclamos().filter((r) => r.estado === 'ABIERTO');

  const fromReclamos: Notif[] = reclamosAbiertos.map((r, idx) => ({
    id: `n-rec-${r.id}`,
    titulo: `Nuevo reclamo de ${r.inquilino}`,
    detalle: `${r.categoria.toLowerCase()} · ${r.urgencia.toLowerCase()}`,
    href: '/reclamos',
    cuando: tiempoRelativo(r.createdAt),
    unread: idx < 2,
    icono: r.urgencia === 'EMERGENCIA' ? 'alert' : 'wrench',
  }));

  const sinteticas: Notif[] = [
    {
      id: 'n-pago-1',
      titulo: 'Cobraste a Juan Pérez',
      detalle: '$620.000 vía Mercado Pago',
      href: '/pagos',
      cuando: 'hace 12 min',
      unread: true,
      icono: 'card',
    },
    {
      id: 'n-aumento-1',
      titulo: 'Ajuste aplicado a 5 contratos',
      detalle: 'ICL +18,4% · revisalo en cada contrato',
      href: '/contratos',
      cuando: 'hace 1 día',
      unread: false,
      icono: 'trend',
    },
    {
      id: 'n-screening-1',
      titulo: 'Screening de Tomás Bravo listo',
      detalle: 'APTO · score 742',
      href: '/screening',
      cuando: 'hace 1 día',
      unread: false,
      icono: 'check',
    },
  ];

  return [...fromReclamos, ...sinteticas].slice(0, 8);
}

/**
 * Notificaciones REALES del panel (prod).
 *
 * En producción la campana existía en la topbar y NO mostraba nunca nada
 * (`buildNotifs` devolvía [] con apiEnabled). El efecto práctico es que la
 * inmobiliaria no se enteraba de que había un pago informado esperando validación
 * salvo que entrara a /pagos a mirar — reportado en la prueba del 03/08:
 * "¿dónde tenés las notificaciones acá?" / "interno en la aplicación".
 *
 * Criterio: la campana NO es un log de lo que pasó, es **lo que está esperando una
 * acción tuya**. Por eso sale de las tres colas que ya expone el API (pagos
 * informados, aprobaciones pendientes, reclamos abiertos) y no de EventoAuditoria.
 * Como son pendientes y no eventos, no se "marcan leídos": el badge baja solo
 * cuando el trabajo se resolvió. Marcar leído algo que sigue pendiente sería
 * justamente la forma de que se pierda de vista.
 */
function useNotifsProd(puede: { pagos: boolean; aprobaciones: boolean; reclamos: boolean }): Notif[] {
  // Cada query se dispara SÓLO si el rol puede resolver ese pendiente. Sin esto, la campana
  // —que vive en el topbar, o sea en todas las páginas— le pegaba un 403 por navegación a
  // /pagos y /reclamos con un rol CARGA, que no tiene esas capacidades.
  const { count: pagosPorValidar, isError: pagosError } = useAResolverCount({ enabled: puede.pagos });
  const { aprobaciones } = useAprobaciones({ enabled: puede.aprobaciones });
  const { reclamos } = useReclamos({ enabled: puede.reclamos });

  return useMemo(() => {
    if (!apiEnabled) return [];
    const out: Notif[] = [];

    // isError ⇒ el count es un 0 FALSO. Preferimos no decir nada antes que decir
    // "no tenés nada pendiente" cuando en realidad no pudimos preguntar.
    if (puede.pagos && !pagosError && pagosPorValidar > 0) {
      out.push({
        id: 'n-pagos-validar',
        titulo: `${pagosPorValidar} pago${pagosPorValidar === 1 ? '' : 's'} esperando que lo valides`,
        detalle: 'El inquilino ya informó la transferencia',
        href: '/pagos',
        cuando: 'ahora',
        unread: true,
        icono: 'card',
      });
    }

    const aprobPend = puede.aprobaciones
      ? aprobaciones.filter((a) => a.estado === 'PENDIENTE').length
      : 0;
    if (aprobPend > 0) {
      out.push({
        id: 'n-aprobaciones',
        titulo: `${aprobPend} carga${aprobPend === 1 ? '' : 's'} esperando tu aprobación`,
        detalle: 'Revisá qué se cargó antes de aprobar',
        href: '/pagos?tab=aprobaciones',
        cuando: 'ahora',
        unread: true,
        icono: 'check',
      });
    }

    const abiertos = puede.reclamos
      ? (reclamos ?? []).filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO').length
      : 0;
    if (abiertos > 0) {
      out.push({
        id: 'n-reclamos',
        titulo: `${abiertos} reclamo${abiertos === 1 ? '' : 's'} sin resolver`,
        detalle: 'Asignale un profesional o resolvelo',
        href: '/reclamos',
        cuando: 'ahora',
        unread: true,
        icono: 'wrench',
      });
    }

    return out;
  }, [puede, pagosPorValidar, pagosError, aprobaciones, reclamos]);
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { me } = useMe();

  // La campana lista lo que este usuario PUEDE RESOLVER, no lo que puede mirar. Un rol
  // CARGA no concilia pagos, no aprueba y no gestiona reclamos: para él la campana está
  // vacía, y además no dispara ninguna de las tres queries.
  const puede = useMemo(() => {
    const rol = normalizarRol(me?.rol, 'LECTURA');
    return {
      pagos: rolTienePermiso(rol, 'pago.conciliar'),
      aprobaciones: rolTienePermiso(rol, 'contrato.aprobar'),
      reclamos: rolTienePermiso(rol, 'reclamos.gestionar'),
    };
  }, [me?.rol]);

  const notifsProd = useNotifsProd(puede);

  useEffect(() => {
    setNotifs(buildNotifs());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Escape cierra el popover (declaramos aria-haspopup="dialog" → el teclado
    // espera poder cerrarlo con Escape).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // En prod la lista son PENDIENTES derivados del API (no eventos guardados), así que
  // no hay estado local de leído: la campana se vacía cuando el trabajo se resolvió.
  const lista = apiEnabled ? notifsProd : notifs;
  const unreadCount = lista.filter((n) => n.unread).length;

  const marcarTodoLeido = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 hover:bg-muted"
        aria-label={unreadCount > 0 ? `${unreadCount} notificación${unreadCount === 1 ? '' : 'es'} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notificaciones" className="absolute right-0 top-12 z-50 w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b p-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unreadCount > 0 && !apiEnabled && (
              <button
                type="button"
                onClick={marcarTodoLeido}
                className="text-xs font-medium text-primary hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>
          <ul role="list" aria-label="Notificaciones" className="max-h-96 overflow-y-auto">
            {lista.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {apiEnabled ? 'No tenés nada esperando tu acción.' : 'No tenés notificaciones nuevas.'}
              </li>
            )}
            {lista.map((n) => {
              const Icon = ICONS[n.icono];
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => {
                      setOpen(false);
                      // Marcar esta notificación como leída (antes el badge solo
                      // se limpiaba con "Marcar todas leídas").
                      setNotifs((prev) =>
                        prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)),
                      );
                    }}
                    className={cn(
                      'flex gap-3 border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/60',
                      n.unread && 'bg-primary/5',
                    )}
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="truncate text-sm font-medium">{n.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.detalle}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {n.cuando}
                      </p>
                    </div>
                    {n.unread && (
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-label="Sin leer"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function tiempoRelativo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMin = Math.floor((now - t) / 60000);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return `hace ${Math.floor(diffH / 24)} día${Math.floor(diffH / 24) === 1 ? '' : 's'}`;
}
