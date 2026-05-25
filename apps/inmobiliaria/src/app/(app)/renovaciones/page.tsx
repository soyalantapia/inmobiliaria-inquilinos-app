'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarHeart,
  CheckCircle2,
  Clock,
  HelpCircle,
  MessageCircle,
  Phone,
  XCircle,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import {
  contactosCobranzaMock,
  contratosMock,
  intencionesRenovacionMock,
  type DecisionRenovacionMock,
} from '@/lib/mock-data';
import { diasHastaVencimiento, formatFecha, formatFechaCorta, formatMonto } from '@/lib/format';
import {
  NegociadorRenovacionPanel,
  ResumenSugerenciasCartera,
} from '@/components/negociador-renovacion';

// Dashboard de renovaciones: muestra los contratos que vencen pronto,
// la decisión de cada inquilino (o falta de respuesta) y permite actuar.
// Esto cierra el loop con el flow /contrato/renovacion del lado inquilino.

type FiltroEstado = 'TODOS' | DecisionRenovacionMock;

const decisionConfig: Record<
  DecisionRenovacionMock,
  {
    label: string;
    badge: React.ComponentProps<typeof Badge>['variant'];
    color: string;
    icon: typeof CheckCircle2;
  }
> = {
  RENOVAR: {
    label: 'Quiere renovar',
    badge: 'success',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  NO_RENOVAR: {
    label: 'No renueva',
    badge: 'destructive',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    icon: XCircle,
  },
  PENSANDO: {
    label: 'Lo está pensando',
    badge: 'secondary',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    icon: Clock,
  },
  SIN_RESPUESTA: {
    label: 'Sin respuesta',
    badge: 'outline',
    color: 'bg-muted text-muted-foreground',
    icon: HelpCircle,
  },
};

export default function RenovacionesPage() {
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS');

  // Cruzamos contratos con intenciones, calculamos urgencia
  const filas = useMemo(() => {
    return contratosMock
      .filter((c) => c.estado === 'ACTIVO')
      .map((c) => {
        const intencion = intencionesRenovacionMock.find((i) => i.contratoId === c.id);
        const decision: DecisionRenovacionMock = intencion?.decision ?? 'SIN_RESPUESTA';
        const dias = diasHastaVencimiento(c.fechaFin);
        return {
          ...c,
          decision,
          comentario: intencion?.comentario ?? null,
          fechaIntencion: intencion?.fechaIntencion ?? null,
          dias,
          urgencia: dias <= 90 ? 'ALTA' : dias <= 180 ? 'MEDIA' : dias <= 365 ? 'BAJA' : 'NINGUNA',
        };
      })
      .sort((a, b) => a.dias - b.dias);
  }, []);

  const filtradas = useMemo(() => {
    if (filtro === 'TODOS') return filas;
    return filas.filter((f) => f.decision === filtro);
  }, [filas, filtro]);

  // KPIs
  const totalEnZona = filas.filter((f) => f.dias <= 365).length;
  const renovarCount = filas.filter((f) => f.decision === 'RENOVAR').length;
  const noRenovarCount = filas.filter((f) => f.decision === 'NO_RENOVAR').length;
  const sinResponderUrgentes = filas.filter(
    (f) => f.decision === 'SIN_RESPUESTA' && f.dias <= 180,
  ).length;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cartera
        </p>
        <h1 className="text-2xl font-semibold md:text-3xl">Renovaciones</h1>
        <p className="text-sm text-muted-foreground">
          Quién vence pronto, qué decidió cada inquilino y a quién falta avisar.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Vencen en <12 meses"
          value={totalEnZona}
          icon={<CalendarHeart className="h-4 w-4" />}
          tone="primary"
        />
        <Kpi
          label="Quieren renovar"
          value={renovarCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="emerald"
        />
        <Kpi
          label="No renuevan"
          value={noRenovarCount}
          icon={<XCircle className="h-4 w-4" />}
          tone="amber"
        />
        <Kpi
          label="Falta avisar (<6m)"
          value={sinResponderUrgentes}
          icon={<HelpCircle className="h-4 w-4" />}
          tone={sinResponderUrgentes > 0 ? 'red' : 'muted'}
          highlight={sinResponderUrgentes > 0}
        />
      </div>

      {/* Resumen Negociador IA: cuánto más entra de plata si todos
          aceptan la sugerencia. Sirve para que el dueño de la inmo vea
          de un solo golpe el potencial de la cartera. */}
      <ResumenSugerenciasCartera contratoIds={filas.map((f) => f.id)} />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['TODOS', 'RENOVAR', 'PENSANDO', 'SIN_RESPUESTA', 'NO_RENOVAR'] as FiltroEstado[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filtro === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              {f === 'TODOS' ? 'Todos' : decisionConfig[f].label}
            </button>
          ),
        )}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Nada para mostrar con este filtro</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtradas.map((c) => {
            const cfg = decisionConfig[c.decision];
            const Icon = cfg.icon;
            const urgenteAvisar = c.decision === 'SIN_RESPUESTA' && c.dias <= 180;
            return (
              <Card
                key={c.id}
                className={cn(
                  'space-y-3 p-5',
                  urgenteAvisar && 'border-amber-300 dark:border-amber-900/60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', cfg.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{c.inquilino}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.direccion}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    {urgenteAvisar && (
                      <Badge variant="destructive" className="text-[10px]">
                        Urgente
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs md:grid-cols-4">
                  <Stat label="Vence" value={formatFechaCorta(c.fechaFin)} />
                  <Stat label="Faltan" value={`${c.dias} día${c.dias === 1 ? '' : 's'}`} />
                  <Stat label="Monto actual" value={formatMonto(c.monto, c.moneda)} />
                  <Stat
                    label="Avisó"
                    value={c.fechaIntencion ? formatFechaCorta(c.fechaIntencion) : '—'}
                  />
                </div>

                {c.comentario && (
                  <p className="rounded-md bg-muted/40 p-3 text-xs italic text-muted-foreground">
                    “{c.comentario}”
                  </p>
                )}

                {/* Panel del Negociador IA con sugerencia de aumento +
                    probabilidad de renovación + borrador de mensaje
                    WhatsApp. Solo lo mostramos si el inquilino no dijo
                    explícitamente que NO renueva (en ese caso ya está
                    cerrado). */}
                {c.decision !== 'NO_RENOVAR' && (
                  <NegociadorRenovacionPanel
                    contratoId={c.id}
                    inquilino={c.inquilino}
                    telefonoInquilino={
                      contactosCobranzaMock.find((x) => x.contratoId === c.id)?.titular
                        .telefono
                    }
                  />
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Hola ${c.inquilino.split(' ')[0]}, te escribo de la inmobiliaria por la renovación de tu contrato.`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp libre
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href="tel:+541145321100">
                        <Phone className="h-3.5 w-3.5" />
                        Llamar
                      </a>
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/contratos/${c.id}`}>
                      Ver contrato
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'primary' | 'emerald' | 'amber' | 'red' | 'muted';
  highlight?: boolean;
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    muted: 'bg-muted text-muted-foreground',
  };

  return (
    <Card className={cn('space-y-2 p-4', highlight && 'ring-2 ring-red-300')}>
      <div className={cn('inline-grid h-8 w-8 place-items-center rounded-md', toneClasses[tone])}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
