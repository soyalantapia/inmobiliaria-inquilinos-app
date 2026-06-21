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
import { MobileGreetingHeader } from '@/components/mobile-greeting-header';
import { useMisReclamos } from '@/lib/api/use-mis-reclamos';
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
  // Datos reales del API (o storage local en demo). `cargando` controla el
  // skeleton; en error de API `reclamos` viene vacío (sin caer al mock).
  const { reclamos, cargando, hayError } = useMisReclamos();
  // El banner pasa por 3 etapas: visible → desvaneciéndose (clase animada) → oculto.
  // No inicializamos desde idNuevo: si Next navega client-side entre
  // /reclamos/nuevo y /reclamos?nuevo=X, el componente persiste y el useState
  // inicial nunca se vuelve a evaluar. Usamos un useEffect que reacciona a
  // cambios de idNuevo. NO usamos useRef como guard porque en StrictMode dev
  // el ref persiste entre los dos mounts y el segundo mount queda con state
  // 'oculto' y ref ya igual al id (skip), dejando el banner invisible.
  const [bannerEstado, setBannerEstado] = useState<'visible' | 'saliendo' | 'oculto'>('oculto');

  // R13: cuando aparece un id nuevo por query, abrimos el banner.
  useEffect(() => {
    if (idNuevo) setBannerEstado('visible');
  }, [idNuevo]);

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
    () => reclamos.filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO'),
    [reclamos],
  );
  const archivados = useMemo(
    () =>
      reclamos.filter(
        (r) => r.estado === 'RESUELTO' || r.estado === 'CERRADO' || r.estado === 'RECHAZADO',
      ),
    [reclamos],
  );

  return (
    <>
      <MobileGreetingHeader />

      {/* pb-40: deja espacio para el footer sticky con el CTA "Nuevo
          reclamo" + el NavBar inferior. Sin esto, el último item se
          quedaba escondido detrás del footer. */}
      <main className="flex-1 space-y-6 px-5 pb-40 md:px-8 md:pb-32 md:pt-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold md:text-3xl">Reclamos</h1>
          <p className="text-sm text-muted-foreground">
            Mantenimiento y consultas a la inmobiliaria.
          </p>
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

        {cargando ? (
          <ListaSkeleton />
        ) : hayError ? (
          <Card className="p-8 text-center">
            <p className="font-medium">No pudimos cargar tus reclamos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisá tu conexión e intentá de nuevo. Si entrás como co-inquilino, es posible que tu permiso no
              incluya los reclamos — consultá con el titular.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              Reintentar
            </button>
          </Card>
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

      {/* Footer sticky con el CTA principal. Antes "Nuevo reclamo" vivía
          arriba al lado del título — pero el inquilino llega a esta
          pantalla con la intención de o (a) ver el estado de un reclamo
          existente, o (b) crear uno nuevo. Tener el CTA fijo abajo lo
          hace siempre alcanzable sin importar cuántos items haya en la
          lista, y respeta el patrón mobile de "acción primaria al
          alcance del pulgar". En desktop usa el mismo footer porque la
          app es mobile-first y mantenemos consistencia. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border/60 bg-background/95 px-5 py-3 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.08)] backdrop-blur md:bottom-0 md:px-8">
        <div className="mx-auto w-full max-w-md md:max-w-3xl">
          <Button asChild className="w-full md:w-auto md:ml-auto md:flex">
            <Link href="/reclamos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo reclamo
            </Link>
          </Button>
        </div>
      </div>

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
          {/* EMERGENCIA queda como badge solid rojo: es la urgencia que tiene
              que destacar SÍ o SÍ. Las otras urgencias se rebajan a texto
              modificador con prefijo "Urgencia:" en la metaline de abajo —
              antes eran badges paralelos al estado y el usuario las leía
              como una segunda categoría (P A2 del audit). */}
          {reclamo.urgencia === 'EMERGENCIA' && (
            <Badge variant="destructive" className="text-[10px]">
              Emergencia
            </Badge>
          )}
          {resaltado && (
            <Badge variant="secondary" className="text-[10px]">
              Recién enviado
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{reclamo.descripcion}</p>
        <p className="text-[11px] text-muted-foreground">
          {tiempoRelativo(reclamo.createdAt)}
          {reclamo.urgencia !== 'EMERGENCIA' && (
            <> · Urgencia {urgenciaLabel[reclamo.urgencia].toLowerCase()}</>
          )}
          {profesionalConRol && ` · ${profesionalConRol}`}
        </p>
      </div>
      {mensajesPendientes > 0 && reclamo.estado !== 'CERRADO' && (
        <span
          className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
          aria-label={`${mensajesPendientes} mensaje${mensajesPendientes === 1 ? '' : 's'} nuevo${mensajesPendientes === 1 ? '' : 's'}`}
        >
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
