'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronRight, Clock, Inbox, Timer } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';
import { Topbar } from '@/components/topbar';
import {
  categoriaIcono,
  categoriaLabel,
  estadoConfig,
  tiempoRelativo,
  urgenciaConfig,
} from '@/lib/reclamos-config';
import { useReclamos } from '@/lib/api/use-reclamos';
import {
  ESTADO_SLA_COLOR,
  ESTADO_SLA_LABEL,
  evaluarSla,
} from '@/lib/sla-reclamos';
import type { EstadoReclamo, Reclamo } from '@/lib/types';

// `SIN_ASIGNAR` no es un estado del reclamo (es derivado: abierto/en curso
// sin profesional). Lo metemos como filtro extra para que el card del
// dashboard "Reclamos sin asignar" caiga acá con el filtro ya aplicado.
type FiltroReclamos = 'TODOS' | 'SIN_ASIGNAR' | 'EMERGENCIA' | 'SLA' | EstadoReclamo;

const tabs: Array<{ value: FiltroReclamos; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'SIN_ASIGNAR', label: 'Sin asignar' },
  { value: 'ABIERTO', label: 'Abiertos' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'RESUELTO', label: 'Resueltos' },
  { value: 'RECHAZADO', label: 'Rechazados' },
];

// Mapea ?filtro=slug → tab interno. Soporta `sin-asignar`, `abierto`, etc.
const FILTRO_FROM_PARAM: Record<string, FiltroReclamos> = {
  'sin-asignar': 'SIN_ASIGNAR',
  abierto: 'ABIERTO',
  'en-curso': 'EN_CURSO',
  resuelto: 'RESUELTO',
  rechazado: 'RECHAZADO',
};

export default function ReclamosPage() {
  const searchParams = useSearchParams();
  const { reclamos } = useReclamos();
  const [filtro, setFiltro] = useState<FiltroReclamos>('TODOS');

  // Si el usuario llegó con ?filtro=sin-asignar (típico desde el card
  // del dashboard), aplicamos el filtro al mount. No reseteamos al
  // cambiar el query, así el user puede tocar otro tab y queda.
  useEffect(() => {
    const param = searchParams?.get('filtro');
    if (param && FILTRO_FROM_PARAM[param]) {
      setFiltro(FILTRO_FROM_PARAM[param]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    if (!reclamos) return [];
    const ordenados = [...reclamos].sort((a, b) => {
      const urgPeso = { EMERGENCIA: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };
      const estPeso = { ABIERTO: 5, EN_CURSO: 4, RESUELTO: 2, CERRADO: 1, RECHAZADO: 0 };
      const score = (r: Reclamo) => estPeso[r.estado] * 10 + urgPeso[r.urgencia];
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    if (filtro === 'TODOS') return ordenados;
    if (filtro === 'SIN_ASIGNAR') {
      return ordenados.filter(
        (r) =>
          (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') &&
          !r.profesionalAsignadoId,
      );
    }
    if (filtro === 'EMERGENCIA') {
      return ordenados.filter(
        (r) =>
          r.urgencia === 'EMERGENCIA' &&
          (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO'),
      );
    }
    if (filtro === 'SLA') {
      return ordenados.filter((r) => {
        if (
          r.estado === 'RESUELTO' ||
          r.estado === 'CERRADO' ||
          r.estado === 'RECHAZADO'
        )
          return false;
        const e = evaluarSla(r).estado;
        return e === 'VENCIDO' || e === 'PROXIMO_VENCIMIENTO';
      });
    }
    return ordenados.filter((r) => r.estado === filtro);
  }, [reclamos, filtro]);

  const counters = useMemo(() => {
    if (!reclamos) return null;
    return {
      ABIERTO: reclamos.filter((r) => r.estado === 'ABIERTO').length,
      EN_CURSO: reclamos.filter((r) => r.estado === 'EN_CURSO').length,
      RESUELTO: reclamos.filter((r) => r.estado === 'RESUELTO').length,
      RECHAZADO: reclamos.filter((r) => r.estado === 'RECHAZADO').length,
      SIN_ASIGNAR: reclamos.filter(
        (r) =>
          (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') &&
          !r.profesionalAsignadoId,
      ).length,
      EMERGENCIA: reclamos.filter(
        (r) => r.urgencia === 'EMERGENCIA' && (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO'),
      ).length,
    };
  }, [reclamos]);

  const slaCounters = useMemo(() => {
    if (!reclamos) return null;
    const activos = reclamos.filter(
      (r) => r.estado !== 'RESUELTO' && r.estado !== 'CERRADO' && r.estado !== 'RECHAZADO',
    );
    let vencidos = 0;
    let porVencer = 0;
    for (const r of activos) {
      const sla = evaluarSla(r);
      if (sla.estado === 'VENCIDO') vencidos++;
      else if (sla.estado === 'PROXIMO_VENCIMIENTO') porVencer++;
    }
    return { vencidos, porVencer, activos: activos.length };
  }, [reclamos]);

  return (
    <>
      <Topbar titulo="Reclamos" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {counters && counters.EMERGENCIA > 0 && (
          <button
            type="button"
            onClick={() => setFiltro(filtro === 'EMERGENCIA' ? 'TODOS' : 'EMERGENCIA')}
            aria-pressed={filtro === 'EMERGENCIA'}
            className={`flex w-full items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-left text-sm transition-colors ${
              filtro === 'EMERGENCIA'
                ? 'bg-destructive/10 ring-2 ring-destructive/30'
                : 'bg-destructive/5 hover:bg-destructive/10'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="flex-1 font-medium text-destructive">
              {counters.EMERGENCIA} reclamo{counters.EMERGENCIA === 1 ? '' : 's'} de emergencia sin resolver
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-destructive/70" />
          </button>
        )}

        {slaCounters && (slaCounters.vencidos > 0 || slaCounters.porVencer > 0) && (
          <button
            type="button"
            onClick={() => setFiltro(filtro === 'SLA' ? 'TODOS' : 'SLA')}
            aria-pressed={filtro === 'SLA'}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              slaCounters.vencidos > 0
                ? filtro === 'SLA'
                  ? 'border-destructive/40 bg-destructive/10 ring-2 ring-destructive/30'
                  : 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
                : filtro === 'SLA'
                  ? 'border-amber-300 bg-amber-100/70 ring-2 ring-amber-400/30 dark:border-amber-900/40 dark:bg-amber-900/20'
                  : 'border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 dark:border-amber-900/40 dark:bg-amber-900/10'
            }`}
          >
            <Timer
              className={`h-4 w-4 shrink-0 ${
                slaCounters.vencidos > 0
                  ? 'text-destructive'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            />
            <span
              className={`flex-1 font-medium ${
                slaCounters.vencidos > 0
                  ? 'text-destructive'
                  : 'text-amber-800 dark:text-amber-200'
              }`}
            >
              {slaCounters.vencidos > 0
                ? `${slaCounters.vencidos} reclamo${slaCounters.vencidos === 1 ? '' : 's'} fuera del SLA`
                : `${slaCounters.porVencer} reclamo${slaCounters.porVencer === 1 ? '' : 's'} por vencer pronto`}
            </span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 ${
                slaCounters.vencidos > 0
                  ? 'text-destructive/70'
                  : 'text-amber-700/70 dark:text-amber-300/70'
              }`}
            />
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const count =
              t.value === 'TODOS'
                ? (reclamos?.length ?? 0)
                : (counters?.[t.value as keyof typeof counters] ?? 0);
            const active = filtro === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFiltro(t.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {t.label}
                <span className="ml-2 text-xs opacity-75">{count}</span>
              </button>
            );
          })}
        </div>

        {reclamos === null ? (
          <ListaSkeleton />
        ) : filtrados.length === 0 ? (
          <EmptyState filtro={filtro} />
        ) : (
          <Card className="divide-y">
            {filtrados.map((r) => (
              <ReclamoRow key={r.id} reclamo={r} />
            ))}
          </Card>
        )}
      </main>
    </>
  );
}

function ReclamoRow({ reclamo }: { reclamo: Reclamo }) {
  const Icon = categoriaIcono[reclamo.categoria];
  const mensajesInquilino = reclamo.eventos.filter((e) => e.tipo === 'MENSAJE_INQUILINO').length;
  const sla = evaluarSla(reclamo);
  return (
    <Link
      href={`/reclamos/${reclamo.id}`}
      className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{reclamo.inquilino}</span>
          <Badge variant={urgenciaConfig[reclamo.urgencia].variant}>
            {urgenciaConfig[reclamo.urgencia].label}
          </Badge>
          <Badge variant={estadoConfig[reclamo.estado].variant}>
            {estadoConfig[reclamo.estado].label}
          </Badge>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${ESTADO_SLA_COLOR[sla.estado]}`}
          >
            <Clock className="h-3 w-3" />
            SLA · {ESTADO_SLA_LABEL[sla.estado]}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{reclamo.descripcion}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{categoriaLabel[reclamo.categoria]}</span>
          <span>·</span>
          <span>{reclamo.direccion}</span>
          <span>·</span>
          <span>{tiempoRelativo(reclamo.createdAt)}</span>
          {reclamo.asignadoA && (
            <>
              <span>·</span>
              <span>asignado a {reclamo.asignadoA}</span>
            </>
          )}
          {mensajesInquilino > 0 && (
            <>
              <span>·</span>
              <span className="font-medium text-primary">
                {mensajesInquilino} mensaje{mensajesInquilino === 1 ? '' : 's'} del inquilino
              </span>
            </>
          )}
        </div>
        <p
          className={`text-[10px] ${
            sla.estado === 'VENCIDO'
              ? 'text-destructive'
              : sla.estado === 'PROXIMO_VENCIMIENTO'
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-muted-foreground'
          }`}
        >
          {sla.texto}
        </p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function EmptyState({ filtro }: { filtro: FiltroReclamos }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
        <Inbox className="mx-auto h-10 w-10" />
        <p className="font-medium text-foreground">
          {filtro === 'TODOS'
            ? 'No hay reclamos'
            : filtro === 'SIN_ASIGNAR'
              ? 'Todos los reclamos tienen profesional asignado 🎉'
              : 'Sin reclamos en este estado'}
        </p>
        <p className="text-sm">Cuando lleguen aparecen acá.</p>
      </CardContent>
    </Card>
  );
}

function ListaSkeleton() {
  return (
    <Card className="divide-y">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </Card>
  );
}
