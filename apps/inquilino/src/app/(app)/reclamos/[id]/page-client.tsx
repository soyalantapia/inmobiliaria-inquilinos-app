'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Skeleton } from '@llave/ui/skeleton';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { RatingReclamoCard } from '@/components/rating-reclamo';
import { ReclamoTimeline } from '@/components/reclamo-timeline';
import { inquilinoActual } from '@/lib/mock-data';
import {
  agregarMensajeDelInquilino,
  obtenerReclamo,
} from '@/lib/reclamos-storage';
import { datosProfesionalDeInmo } from '@/lib/cross-app-inmo';
import { ProgresoVisitaInquilino } from '@/components/progreso-visita-inquilino';
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

export default function DetalleReclamoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [reclamo, setReclamo] = useState<Reclamo | null | undefined>(undefined);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = obtenerReclamo(params.id);
    if (!local) {
      setReclamo(local);
      return;
    }
    // Mergeamos los datos del profesional desde el storage del inmo si
    // los hay — así cuando el admin asigna profesional desde su panel, el
    // inquilino lo ve aunque ese reclamo se creó del lado inquilino.
    const fromInmo = datosProfesionalDeInmo(params.id);
    if (fromInmo) {
      setReclamo({
        ...local,
        profesionalAsignadoNombre:
          local.profesionalAsignadoNombre ?? fromInmo.nombre,
        profesionalAsignadoTelefono:
          local.profesionalAsignadoTelefono ?? fromInmo.telefono,
        profesionalAsignadoCategoria:
          local.profesionalAsignadoCategoria ?? fromInmo.categoria,
      });
    } else {
      setReclamo(local);
    }
  }, [params.id]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [reclamo?.eventos.length]);

  const Icon = useMemo(
    () => (reclamo ? categoriaIcono[reclamo.categoria] : null),
    [reclamo],
  );

  if (reclamo === undefined) {
    return <DetalleSkeleton />;
  }

  if (reclamo === null) {
    return (
      <>
        <header className="flex items-center gap-3 p-5">
          <button
            onClick={() => router.push('/reclamos')}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Reclamo</h1>
        </header>
        <main className="flex-1 px-5">
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <p className="font-medium">No encontramos este reclamo</p>
              <p className="text-sm text-muted-foreground">Probablemente fue eliminado o el link está roto.</p>
              <Button asChild className="mt-2">
                <Link href="/reclamos">Volver al listado</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <NavBar />
      </>
    );
  }

  const enviarMensaje = async () => {
    const texto = borrador.trim();
    if (!texto) return;
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 300));
    const updated = agregarMensajeDelInquilino(reclamo.id, inquilinoActual.nombre, texto);
    setEnviando(false);
    if (updated) {
      setReclamo(updated);
      setBorrador('');
      toast({ title: 'Mensaje enviado' });
    }
  };

  const cerrado = reclamo.estado === 'CERRADO' || reclamo.estado === 'RESUELTO' || reclamo.estado === 'RECHAZADO';

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button
          onClick={() => router.push('/reclamos')}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold">{categoriaLabel[reclamo.categoria]}</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        {/* Card resumen */}
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={estadoVariant[reclamo.estado]}>
                  {estadoLabel[reclamo.estado]}
                </Badge>
                <Badge variant={urgenciaVariant[reclamo.urgencia]}>
                  {urgenciaLabel[reclamo.urgencia]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Reportado {tiempoRelativo(reclamo.createdAt)} · {reclamo.direccion}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{reclamo.descripcion}</p>

          {reclamo.fotoUrl && (
            <div className="rounded-md border bg-muted/30 p-2">
              <img
                src={reclamo.fotoUrl}
                alt="Foto adjunta"
                className="max-h-72 w-full rounded object-contain"
              />
            </div>
          )}

          {reclamo.asignadoA && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Trabajando en esto:</span>
              <span className="font-medium">{reclamo.asignadoA}</span>
            </div>
          )}
        </Card>

        {/* Profesional asignado por la inmobiliaria */}
        {reclamo.profesionalAsignadoNombre && (() => {
          const tel = (reclamo.profesionalAsignadoTelefono ?? '').replace(
            /[^\d]/g,
            '',
          );
          const nombrePila =
            reclamo.profesionalAsignadoNombre.split(' ')[0] ??
            reclamo.profesionalAsignadoNombre;
          const mensajeWA = encodeURIComponent(
            `Hola ${nombrePila}! Soy ${inquilinoActual.nombre.split(' ')[0]}, ` +
              `inquilino/a en ${reclamo.direccion}. La inmobiliaria te asignó mi ` +
              `reclamo de ${(reclamo.profesionalAsignadoCategoria ?? '').toLowerCase()}: ` +
              `${reclamo.descripcion}. ¿Cuándo podés pasar?`,
          );
          const waUrl = tel ? `https://wa.me/${tel}?text=${mensajeWA}` : null;
          const telUrl = reclamo.profesionalAsignadoTelefono
            ? `tel:${reclamo.profesionalAsignadoTelefono.replace(/\s/g, '')}`
            : null;
          return (
            <Card className="space-y-3 border-emerald-300 bg-emerald-50/60 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <UserCheck className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Profesional asignado
                </p>
              </div>
              <div>
                <p className="font-medium">
                  {reclamo.profesionalAsignadoNombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reclamo.profesionalAsignadoCategoria}
                </p>
              </div>
              {reclamo.profesionalAsignadoTelefono && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Tel: </span>
                  <span className="font-medium tabular-nums">
                    {reclamo.profesionalAsignadoTelefono}
                  </span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Coordiná día y hora con él. Si no responde en 48 hs, avisanos
                por WhatsApp.
              </p>
              {(waUrl || telUrl) && (
                <div className="grid grid-cols-2 gap-2 border-t border-emerald-200 pt-3 dark:border-emerald-900/40">
                  {waUrl && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      asChild
                    >
                      <a href={waUrl} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {telUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={telUrl}>
                        <Phone className="h-3.5 w-3.5" />
                        Llamar
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })()}

        {/* Progreso de la visita del profesional (cross-app) */}
        {reclamo.profesionalAsignadoNombre && (
          <ProgresoVisitaInquilino
            reclamoId={reclamo.id}
            profesionalNombre={reclamo.profesionalAsignadoNombre ?? null}
          />
        )}

        {/* Resolución cuando aplica */}
        {reclamo.estado === 'RESUELTO' && reclamo.resolucion && (
          <>
            <Card className="space-y-2 border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Resolución</p>
              </div>
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                {reclamo.resolucion}
              </p>
              {reclamo.resueltoAt && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {tiempoRelativo(reclamo.resueltoAt)}
                </p>
              )}
            </Card>

            <RatingReclamoCard reclamoId={reclamo.id} />
          </>
        )}

        {reclamo.estado === 'RECHAZADO' && reclamo.resolucion && (
          <Card className="space-y-2 border-destructive/30 bg-destructive/5 p-5">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Rechazado</p>
            </div>
            <p className="text-sm">{reclamo.resolucion}</p>
          </Card>
        )}

        {/* Timeline */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial y mensajes
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {reclamo.eventos.length} evento{reclamo.eventos.length === 1 ? '' : 's'}
            </span>
          </div>
          <Card className="p-5">
            <ReclamoTimeline
              eventos={reclamo.eventos}
              inquilinoNombre={inquilinoActual.nombre}
            />
            <div ref={scrollEndRef} />
          </Card>
        </section>

        {/* Composer */}
        {!cerrado ? (
          <Card className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escribile a la inmobiliaria
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensaje();
              }}
              className="flex items-end gap-2"
            >
              <Input
                placeholder="Ej: ¿pueden venir esta tarde?"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                disabled={enviando}
              />
              <Button type="submit" size="icon" disabled={!borrador.trim() || enviando}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Te avisamos por WhatsApp cuando te respondan.
            </p>
          </Card>
        ) : (
          <Card className="space-y-2 p-4 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto h-6 w-6" />
            <p>Este reclamo está cerrado. Si volvés a tener el problema, creá uno nuevo.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/reclamos/nuevo">Crear otro reclamo</Link>
            </Button>
          </Card>
        )}
      </main>

      <NavBar />
    </>
  );
}

function DetalleSkeleton() {
  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </header>
      <main className="flex-1 space-y-5 px-5 pb-6">
        <Card className="space-y-3 p-5">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
        <Card className="space-y-3 p-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </Card>
      </main>
      <NavBar />
    </>
  );
}
