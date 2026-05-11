'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Inbox } from 'lucide-react';
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
import { listarReclamos } from '@/lib/reclamos-store';
import type { EstadoReclamo, Reclamo } from '@/lib/types';

type FiltroEstado = 'TODOS' | EstadoReclamo;

const tabs: Array<{ value: FiltroEstado; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABIERTO', label: 'Abiertos' },
  { value: 'EN_CURSO', label: 'En curso' },
  { value: 'RESUELTO', label: 'Resueltos' },
  { value: 'RECHAZADO', label: 'Rechazados' },
];

export default function ReclamosPage() {
  const [reclamos, setReclamos] = useState<Reclamo[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS');

  useEffect(() => {
    setReclamos(listarReclamos());
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
    return filtro === 'TODOS' ? ordenados : ordenados.filter((r) => r.estado === filtro);
  }, [reclamos, filtro]);

  const counters = useMemo(() => {
    if (!reclamos) return null;
    return {
      ABIERTO: reclamos.filter((r) => r.estado === 'ABIERTO').length,
      EN_CURSO: reclamos.filter((r) => r.estado === 'EN_CURSO').length,
      RESUELTO: reclamos.filter((r) => r.estado === 'RESUELTO').length,
      RECHAZADO: reclamos.filter((r) => r.estado === 'RECHAZADO').length,
      EMERGENCIA: reclamos.filter(
        (r) => r.urgencia === 'EMERGENCIA' && (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO'),
      ).length,
    };
  }, [reclamos]);

  return (
    <>
      <Topbar titulo="Reclamos" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        {counters && counters.EMERGENCIA > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {counters.EMERGENCIA} reclamo{counters.EMERGENCIA === 1 ? '' : 's'} de emergencia
                  sin resolver
                </p>
                <p className="text-xs text-muted-foreground">Atendelos primero.</p>
              </div>
            </CardContent>
          </Card>
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
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function EmptyState({ filtro }: { filtro: FiltroEstado }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
        <Inbox className="mx-auto h-10 w-10" />
        <p className="font-medium text-foreground">
          {filtro === 'TODOS' ? 'No hay reclamos' : 'Sin reclamos en este estado'}
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
