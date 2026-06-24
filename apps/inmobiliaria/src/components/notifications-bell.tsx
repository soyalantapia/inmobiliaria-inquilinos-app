'use client';

import { useEffect, useRef, useState } from 'react';
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

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const unreadCount = notifs.filter((n) => n.unread).length;

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
            {unreadCount > 0 && (
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
            {notifs.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                No tenés notificaciones nuevas.
              </li>
            )}
            {notifs.map((n) => {
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
