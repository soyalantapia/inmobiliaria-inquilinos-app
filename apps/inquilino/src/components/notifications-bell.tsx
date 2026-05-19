'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Star,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { diasHastaVencimiento, formatFecha } from '@/lib/format';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import { listarReclamos } from '@/lib/reclamos-storage';
import { obtenerRating } from '@/lib/ratings-storage';
import { leerPagoInformado } from '@/lib/pago-storage';
import { datosProfesionalDeInmo } from '@/lib/cross-app-inmo';
import type { Reclamo } from '@/lib/types';

interface Notif {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  cuando: string;
  unread: boolean;
  icono: 'pago_vencido' | 'pago_pendiente' | 'ajuste' | 'reclamo_inmo' | 'pago_validacion' | 'rating' | 'profesional';
  severidad: 'critica' | 'alta' | 'media' | 'baja';
}

const ICONS = {
  pago_vencido: AlertTriangle,
  pago_pendiente: CreditCard,
  ajuste: TrendingUp,
  reclamo_inmo: MessageCircle,
  pago_validacion: CheckCircle2,
  rating: Star,
  profesional: Wrench,
} as const;

const READ_KEY = 'llave:notif-leidas:v1';

function leerLeidas(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function guardarLeidas(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function tiempoCorto(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}

function ultimoMensajeInmoEnReclamo(r: Reclamo): { texto: string; fecha: string } | null {
  // Si el último evento (más reciente) viene de la inmo, hay mensaje pendiente
  // de leer. Si después hay respuesta del inquilino, no.
  for (let i = r.eventos.length - 1; i >= 0; i--) {
    const ev = r.eventos[i]!;
    if (ev.tipo === 'MENSAJE_INMO' && ev.contenido) {
      return { texto: ev.contenido, fecha: ev.fecha };
    }
    if (ev.tipo === 'MENSAJE_INQUILINO') {
      return null;
    }
  }
  return null;
}

function construirNotifs(leidas: Set<string>): Notif[] {
  const out: Notif[] = [];

  // 1. Pagos vencidos / próximos / en validación
  const liqsActivas = liquidacionesMock.filter((l) => l.estado !== 'PAGADO');
  for (const liq of liqsActivas) {
    const informado = leerPagoInformado(liq.id);
    if (informado?.estado === 'INFORMADO') {
      out.push({
        id: `pago-val-${liq.id}`,
        titulo: 'Comprobante en revisión',
        detalle: 'Te avisamos cuando lo validemos (24-48 hs)',
        href: `/pago/${liq.id}`,
        cuando: tiempoCorto(informado.enviadoAt),
        unread: !leidas.has(`pago-val-${liq.id}`),
        icono: 'pago_validacion',
        severidad: 'media',
      });
      continue;
    }
    const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
    const dias = diasHastaVencimiento(liq.fechaVencimiento);
    if (calc.diasAtraso > 0) {
      out.push({
        id: `pago-venc-${liq.id}`,
        titulo: 'Tu alquiler está atrasado',
        detalle: `${calc.diasAtraso} días · sumás $${Math.round(calc.punitorioPorDia).toLocaleString('es-AR')} por día`,
        href: `/pago/${liq.id}`,
        cuando: `desde ${formatFecha(liq.fechaVencimiento)}`,
        unread: !leidas.has(`pago-venc-${liq.id}`),
        icono: 'pago_vencido',
        severidad: 'critica',
      });
    } else if (dias <= 5) {
      out.push({
        id: `pago-prox-${liq.id}`,
        titulo:
          dias === 0
            ? 'Tu alquiler vence hoy'
            : `Tu alquiler vence en ${dias} día${dias === 1 ? '' : 's'}`,
        detalle: `Vence ${formatFecha(liq.fechaVencimiento)}`,
        href: `/pago/${liq.id}`,
        cuando: dias === 0 ? 'hoy' : `en ${dias}d`,
        unread: !leidas.has(`pago-prox-${liq.id}`),
        icono: 'pago_pendiente',
        severidad: 'alta',
      });
    }
  }

  // 2. Próximo ajuste si está cerca
  const diasAjuste = diasHastaVencimiento(contratoMock.proximoAjuste);
  if (diasAjuste >= 0 && diasAjuste <= 45) {
    out.push({
      id: `ajuste-${contratoMock.proximoAjuste}`,
      titulo: `Próximo ajuste en ${diasAjuste} días`,
      detalle: `Índice ${contratoMock.indiceAjuste} · ${formatFecha(contratoMock.proximoAjuste)}`,
      href: '/contrato',
      cuando: `en ${diasAjuste}d`,
      unread: !leidas.has(`ajuste-${contratoMock.proximoAjuste}`),
      icono: 'ajuste',
      severidad: 'media',
    });
  }

  // 3. Mensajes nuevos de la inmobiliaria en reclamos activos
  const reclamos = listarReclamos();
  for (const r of reclamos) {
    if (r.estado === 'RESUELTO' || r.estado === 'CERRADO' || r.estado === 'RECHAZADO') continue;
    const ultimo = ultimoMensajeInmoEnReclamo(r);
    if (ultimo) {
      out.push({
        id: `inmo-${r.id}-${ultimo.fecha}`,
        titulo: 'Te respondieron tu reclamo',
        detalle: ultimo.texto.length > 60 ? `${ultimo.texto.slice(0, 60)}…` : ultimo.texto,
        href: `/reclamos/${r.id}`,
        cuando: tiempoCorto(ultimo.fecha),
        unread: !leidas.has(`inmo-${r.id}-${ultimo.fecha}`),
        icono: 'reclamo_inmo',
        severidad: 'alta',
      });
    }

    // 3.b. Profesional asignado al reclamo (cross-app del lado inmo).
    // Si el reclamo todavía no tiene profesional local pero sí en el storage
    // del inmo, lo levantamos como notif para que el inquilino lo coordine.
    const profLocal = r.profesionalAsignadoNombre;
    const profInmo = profLocal ? null : datosProfesionalDeInmo(r.id);
    const profNombre = profLocal ?? profInmo?.nombre ?? null;
    if (profNombre) {
      out.push({
        id: `prof-${r.id}-${profNombre}`,
        titulo: `Te asignaron a ${profNombre}`,
        detalle: 'Coordiná día y hora para que pase a tu propiedad.',
        href: `/reclamos/${r.id}`,
        cuando: 'reciente',
        unread: !leidas.has(`prof-${r.id}-${profNombre}`),
        icono: 'profesional',
        severidad: 'alta',
      });
    }
  }

  // 4. Reclamos resueltos sin calificar todavía
  for (const r of reclamos) {
    if (r.estado !== 'RESUELTO') continue;
    if (obtenerRating(r.id)) continue;
    out.push({
      id: `rating-${r.id}`,
      titulo: 'Calificá tu última reparación',
      detalle: `${r.categoria.toLowerCase()} · ${r.asignadoA ?? 'operador'}`,
      href: `/reclamos/${r.id}`,
      cuando: r.resueltoAt ? tiempoCorto(r.resueltoAt) : 'hace poco',
      unread: !leidas.has(`rating-${r.id}`),
      icono: 'rating',
      severidad: 'baja',
    });
  }

  const sevPeso = { critica: 4, alta: 3, media: 2, baja: 1 };
  out.sort((a, b) => sevPeso[b.severidad] - sevPeso[a.severidad]);

  return out.slice(0, 8);
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [leidas, setLeidas] = useState<Set<string>>(new Set());
  const [hidratado, setHidratado] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLeidas(leerLeidas());
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Recalcular al abrir (por si cambió algo en otra pestaña / ruta)
  const notifs = useMemo(
    () => (hidratado ? construirNotifs(leidas) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hidratado, leidas, open],
  );

  const unread = notifs.filter((n) => n.unread).length;

  const marcarTodasLeidas = () => {
    const next = new Set([...leidas, ...notifs.map((n) => n.id)]);
    setLeidas(next);
    guardarLeidas(next);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 hover:bg-muted"
        aria-label={`${unread} notificaciones sin leer`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 && (
              <button onClick={marcarTodasLeidas} className="text-xs font-medium text-primary">
                Marcar leídas
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifs.length === 0 && (
              <li className="p-8 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-6 w-6 opacity-50" />
                <p className="font-medium text-foreground">Estás al día</p>
                <p className="text-xs">No hay nada que requiera tu atención.</p>
              </li>
            )}
            {notifs.map((n) => {
              const Icon = ICONS[n.icono];
              const colorIcon =
                n.severidad === 'critica'
                  ? 'bg-destructive/10 text-destructive'
                  : n.severidad === 'alta'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-primary/10 text-primary';
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => {
                      setOpen(false);
                      const next = new Set([...leidas, n.id]);
                      setLeidas(next);
                      guardarLeidas(next);
                    }}
                    className={cn(
                      'flex gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-muted/60',
                      n.unread && 'bg-primary/5',
                    )}
                  >
                    <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', colorIcon)}>
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
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
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
