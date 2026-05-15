'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Wrench, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';
import { NavBar } from '@/components/nav-bar';
import { UserMenu } from '@/components/user-menu';
import { misReclamosMock } from '@/lib/mock-data';
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

// IDs que tienen detalle pre-renderizado (los del mock). Los reclamos creados
// por el inquilino tienen IDs dinámicos (rec_<timestamp>) que NO existen como
// página estática, así que los mostramos expandibles inline.
const IDS_CON_DETALLE = new Set(misReclamosMock.map((r) => r.id));

export default function MisReclamosPage() {
  const searchParams = useSearchParams();
  const idNuevo = searchParams?.get('nuevo') ?? null;
  const [reclamos, setReclamos] = useState<Reclamo[] | null>(null);
  const [confirmacionVisible, setConfirmacionVisible] = useState(true);

  useEffect(() => {
    setReclamos(listarReclamos());
  }, []);

  const abiertos = useMemo(
    () =>
      reclamos?.filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') ?? [],
    [reclamos],
  );
  const archivados = useMemo(
    () =>
      reclamos?.filter(
        (r) => r.estado === 'RESUELTO' || r.estado === 'CERRADO' || r.estado === 'RECHAZADO',
      ) ?? [],
    [reclamos],
  );

  return (
    <>
      <header className="p-5 md:hidden">
        <UserMenu />
      </header>

      <main className="flex-1 space-y-6 px-5 pb-24 md:px-8 md:pt-8">
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

        {/* Banner de confirmación si venimos de crear un reclamo */}
        {idNuevo && confirmacionVisible && (
          <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50/60 p-3 animate-fade-in">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-sm">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight text-emerald-900">
                Reclamo enviado
              </p>
              <p className="text-xs text-emerald-700/80">
                La inmobiliaria ya lo tiene. Te avisamos por WhatsApp cuando lo tomen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmacionVisible(false)}
              className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </Card>
        )}

        {reclamos === null ? (
          <ListaSkeleton />
        ) : reclamos.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {abiertos.length > 0 && (
              <Section title="En curso" reclamos={abiertos} idResaltado={idNuevo} />
            )}
            {archivados.length > 0 && (
              <Section title="Historial" reclamos={archivados} muted idResaltado={idNuevo} />
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
  idResaltado,
}: {
  title: string;
  reclamos: Reclamo[];
  muted?: boolean;
  idResaltado?: string | null;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <Card className={muted ? 'divide-y opacity-90' : 'divide-y'}>
        {reclamos.map((r) => (
          <ReclamoRow key={r.id} reclamo={r} resaltado={idResaltado === r.id} />
        ))}
      </Card>
    </section>
  );
}

function ReclamoRow({ reclamo, resaltado }: { reclamo: Reclamo; resaltado: boolean }) {
  const Icon = categoriaIcono[reclamo.categoria];
  const lastEvent = reclamo.eventos[reclamo.eventos.length - 1];
  const mensajesPendientes = reclamo.eventos.filter((e) => e.tipo === 'MENSAJE_INMO').length;
  // Solo los reclamos del mock tienen página de detalle pre-renderizada.
  // Los nuevos (creados por el inquilino, IDs dinámicos) se muestran inline.
  const tieneDetalle = IDS_CON_DETALLE.has(reclamo.id);
  const [expandido, setExpandido] = useState(resaltado);

  // Bloque de contenido principal (icono + texto + meta), reutilizado por
  // ambas variantes (Link vs button expandible).
  const contenido = (
    <>
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
          {resaltado && (
            <Badge variant="secondary" className="text-[10px]">
              Recién enviado
            </Badge>
          )}
        </div>
        <p
          className={`text-sm text-muted-foreground ${expandido ? '' : 'line-clamp-2'}`}
        >
          {reclamo.descripcion}
        </p>
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
    </>
  );

  const wrapperBase = 'flex items-start gap-3 px-4 py-3 transition-colors';
  const wrapperHighlight = resaltado ? 'ring-2 ring-primary/40 bg-primary/5' : '';

  if (tieneDetalle) {
    // Reclamo del mock: tiene página de detalle pre-renderizada → Link funciona
    return (
      <Link
        href={`/reclamos/${reclamo.id}`}
        className={`${wrapperBase} ${wrapperHighlight} hover:bg-muted/40`}
      >
        {contenido}
      </Link>
    );
  }

  // Reclamo nuevo (del localStorage): expandible inline, sin navegación
  return (
    <div className={`${wrapperBase} ${wrapperHighlight}`}>
      {contenido}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent"
        aria-label={expandido ? 'Contraer' : 'Expandir'}
      >
        {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
    </div>
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
