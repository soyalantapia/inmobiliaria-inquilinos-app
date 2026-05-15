'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Plus,
  Wrench,
  X,
} from 'lucide-react';
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
              Nuevo
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
  const lastEvent = reclamo.eventos[reclamo.eventos.length - 1];
  const mensajesPendientes = reclamo.eventos.filter((e) => e.tipo === 'MENSAJE_INMO').length;
  // Solo los reclamos del mock tienen página de detalle pre-renderizada.
  // Los nuevos (creados por el inquilino, IDs dinámicos) se muestran inline.
  const tieneDetalle = IDS_CON_DETALLE.has(reclamo.id);
  const [expandido, setExpandido] = useState(resaltado);

  // Encabezado del item (icono + título + meta) — común a ambas variantes
  const encabezado = (
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
          className={`text-sm text-muted-foreground ${
            expandido && !tieneDetalle ? '' : 'line-clamp-2'
          }`}
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
        {encabezado}
      </Link>
    );
  }

  // Reclamo nuevo (del localStorage): expandible inline con detalle real
  const fechaCreado = new Date(reclamo.createdAt);
  return (
    <div>
      <div className={`${wrapperBase} ${wrapperHighlight}`}>
        {encabezado}
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent"
          aria-label={expandido ? 'Contraer' : 'Expandir'}
        >
          {expandido ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Panel expandido: detalles del reclamo (urgencia, dirección, foto, eventos) */}
      {expandido && (
        <div className="space-y-3 border-t bg-muted/30 px-4 py-4 animate-fade-in">
          <DetalleFila
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Urgencia"
            value={urgenciaLabel[reclamo.urgencia]}
            badge={urgenciaVariant[reclamo.urgencia]}
          />
          <DetalleFila
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Dirección"
            value={reclamo.direccion}
          />
          <DetalleFila
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Enviado el"
            value={fechaCreado.toLocaleString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />

          {reclamo.fotoUrl && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Foto adjunta</p>
              <img
                src={reclamo.fotoUrl}
                alt="Foto del reclamo"
                className="max-h-56 w-full rounded-md object-contain"
              />
            </div>
          )}

          <p className="rounded-md bg-background px-3 py-2 text-[11px] text-muted-foreground">
            La inmobiliaria recibe el reclamo y te avisa por WhatsApp cuando lo tome.
          </p>
        </div>
      )}
    </div>
  );
}

function DetalleFila({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | null;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {badge ? (
          <Badge variant={badge} className="mt-0.5 text-[10px]">
            {value}
          </Badge>
        ) : (
          <p className="text-sm font-medium">{value}</p>
        )}
      </div>
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
