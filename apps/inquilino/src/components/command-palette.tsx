'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Bot,
  CalendarHeart,
  FileText,
  HelpCircle,
  Home,
  KeyRound,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { Dialog, DialogContent } from '@llave/ui/dialog';
import { comprobantesMock } from '@/lib/mock-data';
import { listarReclamos } from '@/lib/reclamos-storage';
import { categoriaLabel } from '@/lib/reclamos-config';
import type { Reclamo } from '@/lib/types';

// Command palette estilo Cmd+K. Indexa navegación + comprobantes + reclamos +
// FAQs. Filtra por substring case-insensitive. Mantiene foco con flechas y
// confirma con Enter. Cmd+K (o Ctrl+K) lo abre desde cualquier lado.

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  icon: LucideIcon;
  href: string;
  keywords?: string;
}

const NAV_ITEMS: CommandItem[] = [
  { id: 'nav-pagos', title: 'Pagos', subtitle: 'Alquiler, expensas, vencimientos', group: 'Ir a', icon: Home, href: '/' },
  { id: 'nav-broker', title: 'Broker', subtitle: 'Asistente IA del contrato', group: 'Ir a', icon: Bot, href: '/broker' },
  { id: 'nav-contrato', title: 'Mi contrato', subtitle: 'Datos, ajustes, garante', group: 'Ir a', icon: FileText, href: '/contrato' },
  { id: 'nav-comprobantes', title: 'Comprobantes', subtitle: 'Histórico de pagos', group: 'Ir a', icon: Receipt, href: '/comprobantes' },
  { id: 'nav-reclamos', title: 'Reclamos', subtitle: 'Tus pedidos al admin', group: 'Ir a', icon: Wrench, href: '/reclamos' },
  { id: 'nav-cuenta', title: 'Mi cuenta', subtitle: 'Perfil, notificaciones', group: 'Ir a', icon: Settings, href: '/cuenta' },
  { id: 'nav-ayuda', title: 'Ayuda', subtitle: 'FAQ y glosario', group: 'Ir a', icon: HelpCircle, href: '/ayuda' },
  { id: 'nav-docs', title: 'Mis documentos', subtitle: 'DNI, recibos, garantes', group: 'Ir a', icon: FileText, href: '/documentos' },
  { id: 'nav-renov', title: 'Renovación', subtitle: 'Decidí si renovás', group: 'Ir a', icon: CalendarHeart, href: '/contrato/renovacion' },
];

const ACCIONES_ITEMS: CommandItem[] = [
  { id: 'act-pagar', title: 'Pagar este mes', subtitle: 'Ir al flujo de pago', group: 'Acciones', icon: KeyRound, href: '/pago' },
  { id: 'act-reclamo-nuevo', title: 'Crear reclamo', subtitle: 'Nuevo pedido al admin', group: 'Acciones', icon: Wrench, href: '/reclamos/nuevo' },
  { id: 'act-garante', title: 'Compartir con garante', subtitle: 'Link público read-only', group: 'Acciones', icon: ShieldCheck, href: '/contrato' },
  { id: 'act-recordatorios', title: 'Configurar recordatorios', subtitle: 'Avisos antes del vencimiento', group: 'Acciones', icon: Bell, href: '/cuenta' },
];

const FAQ_ITEMS: CommandItem[] = [
  { id: 'faq-aumento', title: '¿Cuándo me suben el alquiler?', group: 'Ayuda', icon: HelpCircle, href: '/ayuda#aumento', keywords: 'ajuste icl ipc indice' },
  { id: 'faq-mascotas', title: '¿Puedo tener mascotas?', group: 'Ayuda', icon: HelpCircle, href: '/ayuda#mascotas', keywords: 'perro gato' },
  { id: 'faq-deposito', title: '¿Cuándo me devuelven el depósito?', group: 'Ayuda', icon: HelpCircle, href: '/ayuda#deposito', keywords: 'garantia' },
  { id: 'faq-vencimiento', title: '¿Cuándo vence mi contrato?', group: 'Ayuda', icon: HelpCircle, href: '/ayuda#vencimiento', keywords: 'finaliza termina' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Hidratamos reclamos al abrir
  useEffect(() => {
    if (open) {
      setReclamos(listarReclamos());
      setQuery('');
      setHighlight(0);
      // Focus al abrir
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Indexamos comprobantes y reclamos dinámicamente
  const dynItems = useMemo<CommandItem[]>(() => {
    const compItems: CommandItem[] = comprobantesMock.map((c) => ({
      id: `cmp-${c.id}`,
      title: `Comprobante ${c.periodo}`,
      subtitle: `Pagado el ${c.fechaPago}`,
      group: 'Comprobantes',
      icon: Receipt,
      href: '/comprobantes',
      keywords: c.periodo,
    }));
    const recItems: CommandItem[] = reclamos.map((r) => ({
      id: `rec-${r.id}`,
      title: r.descripcion,
      subtitle: `${categoriaLabel[r.categoria]} · ${r.estado.toLowerCase()}`,
      group: 'Reclamos',
      icon: Wrench,
      href: `/reclamos/${r.id}`,
      keywords: r.categoria,
    }));
    return [...compItems, ...recItems];
  }, [reclamos]);

  const allItems = useMemo(
    () => [...NAV_ITEMS, ...ACCIONES_ITEMS, ...FAQ_ITEMS, ...dynItems],
    [dynItems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((it) => {
      const haystack = `${it.title} ${it.subtitle ?? ''} ${it.keywords ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allItems, query]);

  // Agrupamos visualmente respetando orden de aparición de cada grupo
  const grouped = useMemo(() => {
    const groups: { name: string; items: CommandItem[] }[] = [];
    for (const it of filtered) {
      let g = groups.find((g) => g.name === it.group);
      if (!g) {
        g = { name: it.group, items: [] };
        groups.push(g);
      }
      g.items.push(it);
    }
    return groups;
  }, [filtered]);

  // Reset highlight cuando cambia el filtro
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const ejecutar = (it: CommandItem) => {
    setOpen(false);
    router.push(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[highlight];
      if (it) ejecutar(it);
    }
  };

  // Reconstruyo el índice plano respetando orden de grouped para que el
  // highlight numerado coincida con la lista renderizada
  const flatIndex: CommandItem[] = grouped.flatMap((g) => g.items);
  // sincronizamos el `filtered` real con el orden visual
  // (en este caso son equivalentes porque grouped preserva el orden original)
  void flatIndex;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, comprobantes, reclamos…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin resultados para “{query}”
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.name} className="mb-2">
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.name}
                </p>
                {g.items.map((it) => {
                  const idx = filtered.indexOf(it);
                  const active = idx === highlight;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      onClick={() => ejecutar(it)}
                      onMouseEnter={() => setHighlight(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/40',
                      )}
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{it.title}</p>
                        {it.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="rounded border bg-background px-1.5 py-0.5">↑↓</kbd>
            <span>navegar</span>
            <kbd className="rounded border bg-background px-1.5 py-0.5">↵</kbd>
            <span>abrir</span>
          </div>
          <span>Llave search</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Botón trigger reusable para mostrar en topbar/header.
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);

  const open = () => {
    // Disparamos un evento sintético que CommandPalette escucha vía atajo.
    // Más simple: simulamos Cmd+K.
    const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true });
    window.dispatchEvent(ev);
  };

  return (
    <button
      onClick={open}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40',
        className,
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span>Buscar…</span>
      <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
        {mac ? '⌘K' : 'Ctrl+K'}
      </kbd>
    </button>
  );
}
