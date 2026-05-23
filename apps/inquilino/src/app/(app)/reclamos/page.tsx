'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Plus, Wrench, X } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const idNuevo = searchParams?.get('nuevo') ?? null;
  const [reclamos, setReclamos] = useState<Reclamo[] | null>(null);
  // El banner pasa por 3 etapas: visible → desvaneciéndose (clase animada) → oculto.
  const [bannerEstado, setBannerEstado] = useState<'visible' | 'saliendo' | 'oculto'>(
    idNuevo ? 'visible' : 'oculto',
  );

  useEffect(() => {
    setReclamos(listarReclamos());
  }, []);

  // Auto-dismiss del banner: empieza a salir después de 5s, se oculta tras 600ms más
  useEffect(() => {
    if (bannerEstado !== 'visible') return;
    const tSalir = setTimeout(() => setBannerEstado('saliendo'), 5000);
    return () => clearTimeout(tSalir);
  }, [bannerEstado]);

  useEffect(() => {
    if (bannerEstado !== 'saliendo') return;
    const tOcultar = setTimeout(() => setBannerEstado('oculto'), 600);
    return () => clearTimeout(tOcultar);
  }, [bannerEstado]);

  const cerrarBanner = () => setBannerEstado('saliendo');

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
              Nuevo reclamo
            </Link>
          </Button>
        </div>

        {/* Banner de confirmación si venimos de crear un reclamo.
            - Entra con animación fade-in
            - Se queda 5 segundos
            - Sale con fade-out + slide-up (saliendo)
            - Después se desmonta del DOM (oculto) */}
        {idNuevo && bannerEstado !== 'oculto' && (
          <Card
            className={`flex items-start gap-3 border-emerald-200 bg-emerald-50/60 p-3 transition-all duration-500 ${
              bannerEstado === 'saliendo'
                ? 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                : 'animate-fade-in opacity-100'
            }`}
          >
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
              onClick={cerrarBanner}
              className="rounded-full p-1 text-emerald-700 transition-colors hover:bg-emerald-100"
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
  const mensajesPendientes = reclamo.eventos.filter((e) => e.tipo === 'MENSAJE_INMO').length;

  // Rol del profesional asignado: si la inmo asignó a alguien, mostrarlo con
  // su rol ("Pablo · plomero") para que el inquilino sepa quién es ese nombre
  // sin tener que entrar al detalle.
  const profesionalConRol = (() => {
    if (reclamo.profesionalAsignadoNombre) {
      const rol = (reclamo.profesionalAsignadoCategoria ?? '').toLowerCase();
      return rol
        ? `${reclamo.profesionalAsignadoNombre} · ${rol}`
        : reclamo.profesionalAsignadoNombre;
    }
    if (reclamo.asignadoA) return reclamo.asignadoA;
    return null;
  })();

  return (
    <Link
      href={`/reclamos/r?id=${reclamo.id}`}
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
        resaltado ? 'ring-2 ring-primary/40 bg-primary/5' : ''
      }`}
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
          {/* Urgencia siempre visible — antes solo se mostraba si era EMERGENCIA.
              La urgencia es info de prioridad para el inquilino y la inmo, así
              que tiene que aparecer en la jerarquía de la lista. */}
          <Badge variant={urgenciaVariant[reclamo.urgencia]} className="text-[10px]">
            {urgenciaLabel[reclamo.urgencia]}
          </Badge>
          {resaltado && (
            <Badge variant="secondary" className="text-[10px]">
              Recién enviado
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{reclamo.descripcion}</p>
        <p className="text-[11px] text-muted-foreground">
          {tiempoRelativo(reclamo.createdAt)}
          {profesionalConRol && ` · ${profesionalConRol}`}
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
