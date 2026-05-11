'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Flag,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { NavBar } from '@/components/nav-bar';
import {
  agruparPorMes,
  generarEventos,
  type EventoCalendario,
  type TipoEvento,
} from '@/lib/calendario-eventos';
import { formatFecha, formatMonto } from '@/lib/format';

const iconoTipo: Record<TipoEvento, LucideIcon> = {
  PAGO_MENSUAL: CalendarDays,
  PAGO_VENCIDO: AlertCircle,
  PAGO_REALIZADO: CheckCircle2,
  AJUSTE: TrendingUp,
  FIN_CONTRATO: Flag,
  RECLAMO_ABIERTO: Wrench,
};

const colorTipo: Record<TipoEvento, string> = {
  PAGO_MENSUAL: 'bg-primary/10 text-primary',
  PAGO_VENCIDO: 'bg-red-500/10 text-red-600',
  PAGO_REALIZADO: 'bg-emerald-500/10 text-emerald-600',
  AJUSTE: 'bg-amber-500/10 text-amber-600',
  FIN_CONTRATO: 'bg-purple-500/10 text-purple-600',
  RECLAMO_ABIERTO: 'bg-blue-500/10 text-blue-600',
};

type Filtro = 'TODOS' | 'PAGOS' | 'CONTRATO' | 'RECLAMOS';

export default function CalendarioPage() {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setEventos(generarEventos(6));
    setHidratado(true);
  }, []);

  const filtrados = useMemo(() => {
    if (filtro === 'TODOS') return eventos;
    if (filtro === 'PAGOS')
      return eventos.filter((e) =>
        ['PAGO_MENSUAL', 'PAGO_VENCIDO', 'PAGO_REALIZADO'].includes(e.tipo),
      );
    if (filtro === 'CONTRATO')
      return eventos.filter((e) => ['AJUSTE', 'FIN_CONTRATO'].includes(e.tipo));
    return eventos.filter((e) => e.tipo === 'RECLAMO_ABIERTO');
  }, [eventos, filtro]);

  const grupos = useMemo(() => agruparPorMes(filtrados), [filtrados]);

  // Próximo evento futuro (para hero)
  const hoy = new Date().toISOString().slice(0, 10);
  const proximo = eventos.find((e) => e.fecha.slice(0, 10) >= hoy);

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/cuenta">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tu agenda</p>
          <h1 className="text-xl font-semibold md:text-2xl">Mi calendario</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        {/* Hero: próximo evento */}
        {hidratado && proximo && (
          <Card className="space-y-3 border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', colorTipo[proximo.tipo])}>
                {(() => {
                  const Icon = iconoTipo[proximo.tipo];
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tu próximo evento
                </p>
                <p className="text-base font-semibold leading-tight">{proximo.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFecha(proximo.fecha)} · {diasDesdeHoy(proximo.fecha)}
                </p>
              </div>
              {proximo.monto && (
                <p className="text-sm font-semibold tabular-nums">{formatMonto(proximo.monto)}</p>
              )}
            </div>
          </Card>
        )}

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['TODOS', 'PAGOS', 'CONTRATO', 'RECLAMOS'] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filtro === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              {labelFiltro(f)}
            </button>
          ))}
        </div>

        {/* Timeline agrupado por mes */}
        {hidratado && grupos.length === 0 ? (
          <Card className="p-8 text-center">
            <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">Sin eventos en este filtro</p>
            <p className="text-xs text-muted-foreground">Probá con otro filtro o esperá.</p>
          </Card>
        ) : (
          grupos.map((g) => (
            <section key={g.mes} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h2>
              <Card className="divide-y">
                {g.items.map((e) => (
                  <EventoRow key={e.id} evento={e} />
                ))}
              </Card>
            </section>
          ))
        )}
      </main>

      <NavBar />
    </>
  );
}

// Parsea una fecha ISO evitando el corrimiento por UTC en ARG.
// Las fechas tipo "2026-06-01" sin hora se interpretan como UTC midnight,
// que en ARG (UTC-3) queda el día anterior. Forzamos hora local mediodía.
function parseFechaLocal(iso: string): Date {
  if (iso.includes('T')) return new Date(iso);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

function EventoRow({ evento }: { evento: EventoCalendario }) {
  const Icon = iconoTipo[evento.tipo];
  const fechaEvento = parseFechaLocal(evento.fecha);
  const dia = fechaEvento.getDate();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const futuro = fechaEvento >= hoy;

  const content = (
    <div className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40">
      <div className="flex shrink-0 flex-col items-center">
        <span className={cn('text-lg font-semibold tabular-nums', !futuro && 'text-muted-foreground')}>
          {dia}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground">
          {fechaEvento.toLocaleDateString('es-AR', { month: 'short' })}
        </span>
      </div>
      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', colorTipo[evento.tipo])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('truncate text-sm font-medium', !futuro && 'text-muted-foreground')}>
          {evento.titulo}
        </p>
        <p className="truncate text-xs text-muted-foreground">{evento.detalle}</p>
      </div>
      {evento.monto && (
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{formatMonto(evento.monto)}</p>
          {evento.tipo === 'PAGO_VENCIDO' && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              vencido
            </Badge>
          )}
        </div>
      )}
    </div>
  );

  if (evento.href) {
    return <Link href={evento.href}>{content}</Link>;
  }
  return content;
}

function labelFiltro(f: Filtro): string {
  if (f === 'TODOS') return 'Todos';
  if (f === 'PAGOS') return 'Pagos';
  if (f === 'CONTRATO') return 'Contrato';
  return 'Reclamos';
}

function diasDesdeHoy(fecha: string): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  const diff = Math.floor((f.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff > 0 && diff <= 7) return `en ${diff} días`;
  if (diff > 0) return `en ${Math.round(diff / 30)} mes${Math.round(diff / 30) === 1 ? '' : 'es'}`;
  if (diff === -1) return 'ayer';
  return `hace ${Math.abs(diff)} días`;
}
