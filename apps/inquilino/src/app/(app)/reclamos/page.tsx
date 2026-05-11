'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Wrench } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';
import { NavBar } from '@/components/nav-bar';
import { UserMenu } from '@/components/user-menu';
import { listarReclamos } from '@/lib/reclamos-storage';
import {
  categoriaIcono,
  categoriaLabel,
  estadoLabel,
  estadoVariant,
  tiempoRelativo,
  urgenciaLabel,
  urgenciaVariant,
} from '@/lib/reclamos-config';
import type { Reclamo } from '@/lib/types';

export default function MisReclamosPage() {
  const [reclamos, setReclamos] = useState<Reclamo[] | null>(null);

  useEffect(() => {
    setReclamos(listarReclamos());
  }, []);

  const abiertos = reclamos?.filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') ?? [];
  const archivados = reclamos?.filter((r) => r.estado === 'RESUELTO' || r.estado === 'CERRADO' || r.estado === 'RECHAZADO') ?? [];

  return (
    <>
      <header className="p-5 md:hidden">
        <UserMenu />
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">Reclamos</h1>
            <p className="text-sm text-muted-foreground">
              Pedidos de mantenimiento, reparaciones y consultas a la inmobiliaria.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/reclamos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo
            </Link>
          </Button>
        </div>

        {reclamos === null ? (
          <ListaSkeleton />
        ) : reclamos.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {abiertos.length > 0 && (
              <Section title="En curso" reclamos={abiertos} />
            )}
            {archivados.length > 0 && (
              <Section title="Historial" reclamos={archivados} muted />
            )}
          </>
        )}
      </main>

      <NavBar />
    </>
  );
}

function Section({
  title,
  reclamos,
  muted,
}: {
  title: string;
  reclamos: Reclamo[];
  muted?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <Card className={muted ? 'divide-y opacity-90' : 'divide-y'}>
        {reclamos.map((r) => (
          <ReclamoRow key={r.id} reclamo={r} />
        ))}
      </Card>
    </section>
  );
}

function ReclamoRow({ reclamo }: { reclamo: Reclamo }) {
  const Icon = categoriaIcono[reclamo.categoria];
  const lastEvent = reclamo.eventos[reclamo.eventos.length - 1];
  const mensajesPendientes = reclamo.eventos.filter((e) => e.tipo === 'MENSAJE_INMO').length;

  return (
    <Link
      href={`/reclamos/${reclamo.id}`}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{categoriaLabel[reclamo.categoria]}</span>
          <Badge variant={estadoVariant[reclamo.estado]} className="text-[10px]">
            {estadoLabel[reclamo.estado]}
          </Badge>
          {reclamo.urgencia === 'EMERGENCIA' && (
            <Badge variant={urgenciaVariant[reclamo.urgencia]} className="text-[10px]">
              {urgenciaLabel[reclamo.urgencia]}
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{reclamo.descripcion}</p>
        <p className="text-[11px] text-muted-foreground">
          {tiempoRelativo(reclamo.createdAt)}
          {reclamo.asignadoA && ` · ${reclamo.asignadoA}`}
          {lastEvent && lastEvent.tipo !== 'CREADO' && ` · ${tiempoUltimaActividad(lastEvent.fecha)}`}
        </p>
      </div>
      {mensajesPendientes > 0 && reclamo.estado !== 'CERRADO' && (
        <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {mensajesPendientes}
        </span>
      )}
    </Link>
  );
}

function tiempoUltimaActividad(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 60) return `activo hace ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `activo hace ${h} h`;
  return `actualizado ${new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`;
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <Wrench className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Todavía no tenés reclamos</p>
          <p className="text-sm text-muted-foreground">
            Reportá un problema de tu vivienda y la inmobiliaria lo recibe al instante.
          </p>
        </div>
        <Button asChild className="mt-2">
          <Link href="/reclamos/nuevo">
            <Plus className="h-4 w-4" />
            Crear reclamo
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ListaSkeleton() {
  return (
    <Card className="divide-y">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </Card>
  );
}

