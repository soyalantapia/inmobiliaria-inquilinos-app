'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarHeart,
  CheckCircle2,
  Clock,
  HelpCircle,
  LogOut,
  MessageCircle,
  Phone,
  XCircle,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';
import { cn } from '@llave/ui/cn';
import { type DecisionRenovacionMock } from '@/lib/mock-data';
import { formatFecha, formatFechaCorta, formatMonto } from '@/lib/format';
import { apiEnabled } from '@/lib/api/client';
import { useRenovaciones, registrarDecisionApi, type RenovacionFila } from '@/lib/api/use-renovaciones';
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
    color: 'bg-primary/10 text-primary',
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
  const [decidiendo, setDecidiendo] = useState<RenovacionFila | null>(null);
  const qc = useQueryClient();

  // Renovaciones reales del API (contratos activos + intención); fallback al
  // mock solo en build demo. La decisión se registra desde el detalle del
  // contrato (botón "Ver contrato").
  const { renovaciones: filas } = useRenovaciones();

  const filtradas = useMemo(() => {
    if (filtro === 'TODOS') return filas;
    return filas.filter((f) => f.decision === filtro);
  }, [filas, filtro]);

  // KPIs
  // "Vencen en <12 meses": sólo contratos que vencen en el futuro (≥ 0 días).
  // Antes contaba también los YA vencidos (días negativos), inflando el KPI.
  const totalEnZona = filas.filter((f) => f.dias >= 0 && f.dias <= 365).length;
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
      {!apiEnabled && (
        <ResumenSugerenciasCartera
          contratoIds={filas.filter((f) => f.decision !== 'NO_RENOVAR').map((f) => f.id)}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['TODOS', 'RENOVAR', 'PENSANDO', 'SIN_RESPUESTA', 'NO_RENOVAR'] as FiltroEstado[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
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
                  {/* Si el contrato ya venció el label "Faltan -5 días"
                      es contraintuitivo — invertimos a "Vencido hace X
                      días" así Roberto lee directo lo que pasó. */}
                  <Stat
                    label={c.dias < 0 ? 'Vencido hace' : 'Faltan'}
                    value={`${Math.abs(c.dias)} día${Math.abs(c.dias) === 1 ? '' : 's'}`}
                  />
                  <Stat label="Monto actual" value={formatMonto(c.monto, c.moneda)} />
                  {c.decision === 'NO_RENOVAR' && c.fechaEgreso ? (
                    <Stat label="Se va el" value={formatFechaCorta(c.fechaEgreso)} />
                  ) : (
                    <Stat
                      label="Avisó"
                      value={c.fechaIntencion ? formatFechaCorta(c.fechaIntencion) : '—'}
                    />
                  )}
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
                {!apiEnabled && c.decision !== 'NO_RENOVAR' && c.monto > 0 && (
                  <NegociadorRenovacionPanel
                    contratoId={c.id}
                    inquilino={c.inquilino}
                    telefonoInquilino={c.telefono ?? undefined}
                  />
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {/* Resolvemos el teléfono real del inquilino por
                        contratoId. Antes el WhatsApp era "libre" (sin
                        destinatario — el usuario tenía que pegarlo
                        manual) y el "Llamar" iba a un número hardcoded
                        +54 11 4532 1100 para TODOS los contratos. */}
                    {(() => {
                      const tel = c.telefono;
                      const telLimpio = tel?.replace(/[^\d]/g, '');
                      const textoWA = encodeURIComponent(
                        `Hola ${c.inquilino.split(' ')[0]}, te escribo de la inmobiliaria por la renovación de tu contrato.`,
                      );
                      return (
                        <>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={
                                telLimpio
                                  ? `https://wa.me/${telLimpio}?text=${textoWA}`
                                  : `https://wa.me/?text=${textoWA}`
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </Button>
                          {telLimpio && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`tel:${telLimpio}`}>
                                <Phone className="h-3.5 w-3.5" />
                                Llamar
                              </a>
                            </Button>
                          )}
                        </>
                      );
                    })()}
                    {apiEnabled && (
                      <Button size="sm" onClick={() => setDecidiendo(c)}>
                        <LogOut className="h-3.5 w-3.5" />
                        Registrar aviso
                      </Button>
                    )}
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

      <RegistrarDecisionDialog
        fila={decidiendo}
        onClose={() => setDecidiendo(null)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ['renovaciones'] })}
      />
    </div>
  );
}

// Registrar el aviso del inquilino: renueva / lo piensa / no renueva (se va, con
// fecha de egreso para verlo venir). Escribe POST /renovaciones/:id/decision.
function RegistrarDecisionDialog({
  fila,
  onClose,
  onSaved,
}: {
  fila: RenovacionFila | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [decision, setDecision] = useState<DecisionRenovacionMock>('SIN_RESPUESTA');
  const [fechaEgreso, setFechaEgreso] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Al abrir, precargamos con lo que ya estaba registrado.
  const filaId = fila?.id ?? null;
  useEffect(() => {
    if (fila) {
      setDecision(fila.decision);
      setFechaEgreso(fila.fechaEgreso ?? '');
      setNotas(fila.comentario ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaId]);

  const opciones: { value: DecisionRenovacionMock; label: string; sub: string }[] = [
    { value: 'RENOVAR', label: 'Renueva', sub: 'Quiere seguir' },
    { value: 'PENSANDO', label: 'Lo está pensando', sub: 'Sin definir' },
    { value: 'NO_RENOVAR', label: 'No renueva — se va', sub: 'Avisó que deja el inmueble' },
  ];

  const guardar = async () => {
    if (!fila || guardando) return;
    setGuardando(true);
    try {
      await registrarDecisionApi(fila.id, { decision, notas, fechaEgreso: fechaEgreso || null });
      onSaved();
      toast({
        variant: 'success',
        title: 'Aviso registrado',
        description:
          decision === 'NO_RENOVAR'
            ? `${fila.inquilino} no renueva${fechaEgreso ? ` — se va el ${formatFechaCorta(fechaEgreso)}` : ''}.`
            : 'Actualizamos la intención de renovación.',
      });
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: 'No se pudo registrar', description: e instanceof Error ? e.message : 'Probá de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!fila} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aviso del inquilino</DialogTitle>
        </DialogHeader>
        {fila && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {fila.inquilino} · {fila.direccion}
            </p>
            <div className="space-y-2">
              {opciones.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setDecision(o.value)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    decision === o.value
                      ? o.value === 'NO_RENOVAR'
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <span>
                    <span className="font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.sub}</span>
                  </span>
                  {decision === o.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            {decision === 'NO_RENOVAR' && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">¿Cuándo se va? <span className="font-normal text-muted-foreground">(preaviso)</span></span>
                <input
                  type="date"
                  value={fechaEgreso}
                  onChange={(e) => setFechaEgreso(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Nota <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Ej: avisó por WhatsApp, se muda por trabajo…"
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1" disabled={guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Registrar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
