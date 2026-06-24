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
import { apiEnabled } from '@/lib/api/client';
import { useMiContrato } from '@/lib/api/hooks';
import { useMisReclamos } from '@/lib/api/use-mis-reclamos';
import {
  agregarMensajeDelInquilino,
  obtenerReclamo,
} from '@/lib/reclamos-storage';
import {
  datosProfesionalDeInmo,
  estadoReclamoDeInmo,
} from '@/lib/cross-app-inmo';
import {
  marcarConforme,
  marcarPersiste,
  obtenerConfirmacion,
  type DecisionInquilino,
} from '@/lib/confirmaciones-reclamo';
import { obtenerVisita } from '@/lib/visitas-profesional';
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
import type { EventoReclamo, Reclamo } from '@/lib/types';

// Tel de la inmo de muestra para el atajo "Llamar" (Emergencia activa) en modo
// demo. En prod usamos el teléfono real de useMiContrato.
const TELEFONO_INMO_DEMO = '541145321100';

export default function DetalleReclamoPage({ id }: { id: string }) {
  const router = useRouter();
  // En prod los datos vienen del API (GET /mis-reclamos, filtramos por id).
  // En demo seguimos leyendo del storage local + merge cross-app inmo.
  const {
    reclamos: reclamosApi,
    cargando: cargandoApi,
    deApi,
    hayError,
    confirmarResolucion,
    calificarReclamo,
  } = useMisReclamos();
  const { inmobiliariaTelefono } = useMiContrato();
  // Teléfono para el atajo "Llamar" en Emergencia activa. En demo, número de
  // muestra; en prod el real (sin no-dígitos). Sin teléfono en prod, ocultamos
  // el botón de llamada.
  const telInmo = apiEnabled
    ? (inmobiliariaTelefono ?? '').replace(/\D/g, '')
    : TELEFONO_INMO_DEMO;
  const [reclamo, setReclamo] = useState<Reclamo | null | undefined>(undefined);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [decision, setDecision] = useState<DecisionInquilino | null>(null);
  const [persisteOpen, setPersisteOpen] = useState(false);
  const [persisteTexto, setPersisteTexto] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Re-cargar reclamo + estado del inmo. Lo extraemos en función nombrada
  // porque también lo llamamos después de las acciones del inquilino
  // (marcar conforme / persiste) para refrescar la UI. Solo aplica en demo:
  // en prod el reclamo se deriva del API en el effect de abajo.
  const recargar = (id: string) => {
    if (!id) {
      setReclamo(null);
      return;
    }
    const local = obtenerReclamo(id);
    if (!local) {
      setReclamo(local);
      return;
    }
    // Mergeamos los datos del profesional desde el storage del inmo si
    // los hay — así cuando el admin asigna profesional desde su panel, el
    // inquilino lo ve aunque ese reclamo se creó del lado inquilino.
    const fromInmo = datosProfesionalDeInmo(id);
    // Mergeamos también estado/resolución del lado inmo: cuando el inmo
    // (o el auto-cierre por profesional LISTO) marca el reclamo como
    // RESUELTO/CERRADO, el storage del inquilino se queda obsoleto en
    // ABIERTO. estadoReclamoDeInmo ya valida que el estado sea un
    // EstadoReclamo conocido — si vuelve null, dejamos el estado local.
    const estadoInmo = estadoReclamoDeInmo(id);
    setReclamo({
      ...local,
      ...(fromInmo
        ? {
            profesionalAsignadoNombre:
              local.profesionalAsignadoNombre ?? fromInmo.nombre,
            profesionalAsignadoTelefono:
              local.profesionalAsignadoTelefono ?? fromInmo.telefono,
            profesionalAsignadoCategoria:
              local.profesionalAsignadoCategoria ?? fromInmo.categoria,
          }
        : {}),
      estado: estadoInmo?.estado ?? local.estado,
      resolucion: estadoInmo?.resolucion ?? local.resolucion,
      resueltoAt: estadoInmo?.resueltoAt ?? local.resueltoAt,
    });
    setDecision(obtenerConfirmacion(id)?.estado ?? null);
  };

  // Prod (API): el detalle se sirve del mismo GET /mis-reclamos (el inquilino no
  // accede a /reclamos/:id). Mientras carga dejamos `undefined` (skeleton); una
  // vez cargado, si no aparece el id es null (no encontrado). `reclamosApi` está
  // memoizado en el hook, así que su referencia es estable salvo cambio real.
  useEffect(() => {
    if (!deApi) return;
    if (cargandoApi) {
      setReclamo(undefined);
      return;
    }
    setReclamo(reclamosApi.find((r) => r.id === id) ?? null);
  }, [id, deApi, cargandoApi, reclamosApi]);

  // Demo: leemos el reclamo de localStorage al montar / cambiar de id. NO
  // dependemos de `reclamosApi`: en demo el hook devuelve un array NUEVO en cada
  // render (sin memo), y como `recargar` hace setReclamo({...}) con un objeto
  // nuevo, tenerlo en las deps disparaba un loop infinito de renders ("Maximum
  // update depth exceeded"). Las mutaciones de la página refrescan llamando a
  // `recargar` directo (enviar mensaje / confirmar), no por este effect.
  useEffect(() => {
    if (deApi) return;
    recargar(id);
    // recargar es estable: solo usa `id`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, deApi]);

  // Auto-scroll al final del timeline SOLO cuando se agrega un evento nuevo
  // (mensaje enviado) DENTRO del mismo reclamo, no al abrir el detalle. Trackeamos
  // {id, len}: al cambiar de `id` (la ruta [id] reusa la instancia en navegación
  // id→id, p.ej. desde el bell o /calendario) o en el mount, memorizamos sin
  // scrollear; antes el ref no se reseteaba al cambiar de id y volvía a saltar al
  // fondo, ocultando el header/resumen.
  const prevEventos = useRef<{ id: string; len: number } | null>(null);
  useEffect(() => {
    const len = reclamo?.eventos.length;
    if (len == null) return;
    const prev = prevEventos.current;
    if (prev != null && prev.id === id && len > prev.len) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevEventos.current = { id, len };
  }, [id, reclamo?.eventos.length]);

  const Icon = useMemo(
    () => (reclamo ? categoriaIcono[reclamo.categoria] : null),
    [reclamo],
  );

  // Eventos del timeline = eventos persistidos + hitos del profesional
  // (VISITA_*) computados al vuelo. Antes el timeline solo mostraba 1 evento
  // ("Reclamo creado") mientras visualmente pasaban 4 hitos del profesional
  // en otra card. Ahora todo vive en una sola narrativa cronológica (P3 de
  // la auditoría: "dos timelines desconectados").
  const eventosUnificados = useMemo<EventoReclamo[]>(() => {
    if (!reclamo) return [];
    const base = [...reclamo.eventos];
    // La visita del profesional vive en storage cross-app (flujo /p/[token]),
    // sin endpoint en el API → solo en demo. En prod el timeline sale de
    // reclamo.eventos del API.
    const visita = apiEnabled ? null : obtenerVisita(reclamo.id);
    const nombre = reclamo.profesionalAsignadoNombre ?? 'Profesional';
    if (visita?.confirmadaAt) {
      base.push({
        id: `visita_${reclamo.id}_conf`,
        tipo: 'VISITA_CONFIRMADA',
        autor: nombre,
        contenido: visita.fechaVisita
          ? `Va el ${new Date(visita.fechaVisita).toLocaleString('es-AR', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : null,
        fecha: visita.confirmadaAt,
      });
    }
    if (visita?.enCaminoAt) {
      base.push({
        id: `visita_${reclamo.id}_camino`,
        tipo: 'VISITA_EN_CAMINO',
        autor: nombre,
        contenido: null,
        fecha: visita.enCaminoAt,
      });
    }
    if (visita?.listoAt) {
      base.push({
        id: `visita_${reclamo.id}_listo`,
        tipo: 'VISITA_LISTO',
        autor: nombre,
        contenido: visita.notaFinal,
        fecha: visita.listoAt,
      });
    }
    return base.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [reclamo]);

  if (reclamo === undefined) {
    return <DetalleSkeleton />;
  }

  if (reclamo === null) {
    return (
      <>
        <header className="flex items-center gap-3 p-5">
          <button
            type="button"
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
              <p className="font-medium">{hayError ? 'No pudimos cargar el reclamo' : 'No encontramos este reclamo'}</p>
              <p className="text-sm text-muted-foreground">
                {hayError
                  ? 'Si entrás como co-inquilino, es posible que tu permiso no incluya los reclamos. Consultá con el titular del contrato.'
                  : 'Probablemente fue eliminado o el link está roto.'}
              </p>
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
    } else {
      // write falló (cuota de localStorage llena): no limpiamos el borrador.
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar el mensaje',
        description: 'El almacenamiento local está lleno. Probá liberar espacio.',
      });
    }
  };

  const confirmarConforme = async () => {
    if (confirmando) return;
    // Prod: el endpoint cierra el reclamo (CERRADO) y registra la confirmación;
    // el invalidate refetchea y el effect refresca `reclamo` con el nuevo estado.
    if (deApi) {
      setConfirmando(true);
      try {
        await confirmarResolucion(reclamo.id, 'CONFORME');
        toast({ title: 'Confirmado', description: 'Marcamos el reclamo como resuelto.' });
      } catch {
        toast({ variant: 'destructive', title: 'No se pudo confirmar', description: 'Probá de nuevo.' });
      } finally {
        setConfirmando(false);
      }
      return;
    }
    // Demo: la decisión vive en localStorage + un mensaje en el timeline para
    // que quede registro humano del momento en que el inquilino dio el OK.
    marcarConforme(reclamo.id);
    const okConforme = agregarMensajeDelInquilino(
      reclamo.id,
      inquilinoActual.nombre,
      '✅ Confirmo que el problema está resuelto. Gracias.',
    );
    recargar(reclamo.id);
    toast(
      okConforme
        ? { title: 'Confirmado', description: 'Marcamos el reclamo como resuelto.' }
        : {
            variant: 'destructive',
            title: 'Confirmado, pero…',
            description: 'No pudimos guardar la nota en el historial (almacenamiento lleno).',
          },
    );
  };

  const confirmarPersiste = async () => {
    const detalle = persisteTexto.trim();
    if (!detalle || confirmando) return;
    if (deApi) {
      setConfirmando(true);
      try {
        await confirmarResolucion(reclamo.id, 'PERSISTE', detalle);
        setPersisteOpen(false);
        setPersisteTexto('');
        toast({
          variant: 'default',
          title: 'Le avisamos a la inmobiliaria',
          description: 'Reabrimos el reclamo para que vuelvan a intervenir.',
        });
      } catch {
        toast({ variant: 'destructive', title: 'No se pudo enviar', description: 'Probá de nuevo.' });
      } finally {
        setConfirmando(false);
      }
      return;
    }
    marcarPersiste(reclamo.id, detalle);
    const okPersiste = agregarMensajeDelInquilino(
      reclamo.id,
      inquilinoActual.nombre,
      `⚠️ El problema sigue: ${detalle}`,
    );
    setPersisteOpen(false);
    setPersisteTexto('');
    recargar(reclamo.id);
    toast(
      okPersiste
        ? {
            variant: 'default',
            title: 'Le avisamos a la inmobiliaria',
            description: 'Vamos a coordinar una nueva visita.',
          }
        : {
            variant: 'destructive',
            title: 'Le avisamos, pero…',
            description: 'No pudimos guardar la nota en el historial (almacenamiento lleno).',
          },
    );
  };

  const resuelto = reclamo.estado === 'RESUELTO';

  // Decisión del inquilino sobre el cierre. En prod sale del API (la confirmación
  // persistida); en demo, del estado local que setea `recargar` desde localStorage.
  // En prod CONFORME pasa el reclamo a CERRADO (no RESUELTO), por eso las cards de
  // resolución se guían por `decisionActual`, no por `resuelto`.
  const decisionActual: DecisionInquilino | null = deApi
    ? (reclamo.confirmacionInquilino?.estado ?? null)
    : decision;

  // PERSISTE re-abre el reclamo: en demo el estado queda RESUELTO (marcarPersiste
  // solo escribe en confirmaciones-reclamo), así que sin excluir PERSISTE el footer
  // "está cerrado, creá uno nuevo" aparecía a la vez que la card "Reportaste que
  // sigue" y se ocultaba el composer. Excluyéndolo, las tres condiciones cuadran.
  const cerrado =
    (reclamo.estado === 'CERRADO' || resuelto || reclamo.estado === 'RECHAZADO') &&
    decisionActual !== 'PERSISTE';

  // Comentar en el reclamo (composer) sigue siendo demo-only: no hay endpoint
  // para que el inquilino sume mensajes al timeline en prod. Confirmar resolución
  // SÍ tiene endpoint, así que se habilita siempre.
  const puedeComentar = !apiEnabled;

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button
          type="button"
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {/* C2 — Emergencia activa: el inquilino marcó EMERGENCIA en el form
            y aún no resolvió. Le recordamos el atajo a llamar a la inmo —
            antes esto solo aparecía en el form ANTES de enviar y se perdía
            al ver el detalle, dejando al usuario sin canal rápido. */}
        {reclamo.urgencia === 'EMERGENCIA' && !cerrado && (
          <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-4 animate-fade-in">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">¿Hay riesgo real ahora?</p>
                <p className="text-xs">
                  Para fugas, gas, agua corriendo o incendio: llamá a la
                  inmobiliaria YA. El reclamo escrito va igual, pero el
                  teléfono va más rápido.
                </p>
              </div>
            </div>
            {telInmo && (
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                asChild
              >
                <a href={`tel:+${telInmo}`}>
                  <Phone className="h-4 w-4" />
                  Llamar a la inmobiliaria
                </a>
              </Button>
            )}
          </Card>
        )}

        {/* A1 — "Estamos viendo tu reclamo": cuando es nuevo (ABIERTO sin
            profesional asignado) seteamos expectativa de cuándo respondemos.
            Antes el usuario se quedaba con "Abierto" sin saber si pasaba algo
            o cuándo. */}
        {reclamo.estado === 'ABIERTO' &&
          !reclamo.profesionalAsignadoNombre &&
          reclamo.urgencia !== 'EMERGENCIA' && (
            <Card className="flex items-start gap-3 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Estamos viendo tu reclamo
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  Te respondemos en menos de 24 hs hábiles. Te avisamos por
                  WhatsApp cuando asignemos un profesional.
                </p>
              </div>
            </Card>
          )}

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

        {/* Progreso de la visita del profesional (cross-app).
            reclamoYaResuelto le dice al componente que oculte el copy
            "La inmobiliaria lo va a revisar..." porque ya pasó —
            queda la card "Por confirmar" / "Resuelto" abajo guiando. */}
        {!apiEnabled && reclamo.profesionalAsignadoNombre && (
          <ProgresoVisitaInquilino
            reclamoId={reclamo.id}
            profesionalNombre={reclamo.profesionalAsignadoNombre ?? null}
            reclamoYaResuelto={
              reclamo.estado === 'RESUELTO' || reclamo.estado === 'CERRADO'
            }
          />
        )}

        {/* Resolución cuando aplica.
            Estados posibles:
            - RESUELTO + sin decisión del inquilino → mostramos la resolución
              en amarillo y pedimos confirmación (P2 + P4 de la auditoría:
              elimina la contradicción "Abierto + Sergio listo" y le da
              agencia al inquilino).
            - RESUELTO + decision CONFORME → verde + rating.
            - RESUELTO + decision PERSISTE → naranja con su comentario;
              ocultamos rating porque sería contradictorio. */}
        {resuelto && reclamo.resolucion && decisionActual === null && (
          <Card className="space-y-3 border-amber-300 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">
                Por confirmar
              </p>
            </div>
            <p className="text-sm">
              La inmobiliaria dio el reclamo por resuelto:
            </p>
            <p className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm italic dark:border-amber-900/40 dark:bg-amber-950/30">
              “{reclamo.resolucion}”
            </p>
            <p className="text-xs text-muted-foreground">
              ¿Está realmente resuelto? Tu confirmación cierra el reclamo. Si
              el problema sigue, avisanos y volvemos a intervenir.
            </p>

            {!persisteOpen ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={confirmarConforme}
                  disabled={confirmando}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirmando ? 'Confirmando…' : 'Estoy conforme'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPersisteOpen(true)}
                  disabled={confirmando}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Sigue el problema
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-background p-3">
                <p className="text-xs font-medium">¿Qué sigue pasando?</p>
                <Input
                  placeholder="Ej: vuelve a perder a las pocas horas"
                  aria-label="Describir el problema que sigue"
                  value={persisteTexto}
                  onChange={(e) => setPersisteTexto(e.target.value)}
                  disabled={confirmando}
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={confirmando}
                    onClick={() => {
                      setPersisteOpen(false);
                      setPersisteTexto('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!persisteTexto.trim() || confirmando}
                    onClick={confirmarPersiste}
                  >
                    {confirmando ? 'Enviando…' : 'Avisar a la inmobiliaria'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {decisionActual === 'CONFORME' && reclamo.resolucion && (
          <>
            <Card className="space-y-2 border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Resuelto · confirmado por vos
                </p>
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

            <RatingReclamoCard
              reclamoId={reclamo.id}
              apiMode={deApi}
              ratingInicial={reclamo.ratingInquilino ?? null}
              onCalificar={
                deApi
                  ? (estrellas, comentario) =>
                      calificarReclamo(reclamo.id, estrellas, comentario ?? undefined)
                  : undefined
              }
            />
          </>
        )}

        {/* "Reportaste que sigue".
            - Demo: estado queda RESUELTO + decisionActual='PERSISTE' (localStorage).
            - Prod: PERSISTE reabre el reclamo a EN_CURSO conservando la resolución,
              así que lo detectamos por estado EN_CURSO + resolución previa (no hay
              ConfirmacionReclamo PERSISTE: es one-shot por el @unique). */}
        {((resuelto && decisionActual === 'PERSISTE') ||
          (deApi && reclamo.estado === 'EN_CURSO' && !!reclamo.resolucion)) && (
          <Card className="space-y-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">
                Reportaste que sigue
              </p>
            </div>
            <p className="text-sm">
              Le avisamos a la inmobiliaria para que vuelva a intervenir. Mirá
              el historial para seguir la conversación.
            </p>
          </Card>
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

        {/* Timeline unificado: incluye eventos del reclamo + hitos del
            profesional (VISITA_CONFIRMADA, EN_CAMINO, LISTO). Antes el
            contador decía "1 evento" mientras visualmente pasaban 4 hitos
            del profesional en otra card. */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial y mensajes
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {eventosUnificados.length} evento{eventosUnificados.length === 1 ? '' : 's'}
            </span>
          </div>
          <Card role="log" aria-label="Historial y mensajes del reclamo" aria-live="polite" className="p-5">
            <ReclamoTimeline
              eventos={eventosUnificados}
              inquilinoNombre={inquilinoActual.nombre}
            />
            <div ref={scrollEndRef} />
          </Card>
        </section>

        {/* Composer.
            Copy aclarativo (R4 de la auditoría): el inquilino tiene 3 canales
            disponibles y antes no quedaba claro cuál usar para qué.
            - Composer (acá): comentarios sobre ESTE reclamo, quedan en historial.
            - FAB WhatsApp (arriba): consultas generales a la inmo.
            - WhatsApp profesional: coordinar día y hora con el técnico. */}
        {!cerrado && puedeComentar ? (
          <Card className="space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comentarios sobre este reclamo
              </p>
              <p className="text-[11px] text-muted-foreground">
                Quedan en el historial. Para consultas generales usá el botón
                de WhatsApp.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensaje();
              }}
              className="space-y-2"
            >
              <Input
                placeholder="Ej: ¿pueden venir esta tarde?"
                aria-label="Comentario sobre este reclamo"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                disabled={enviando}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={!borrador.trim() || enviando}
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
                {enviando ? 'Enviando…' : 'Enviar'}
              </Button>
            </form>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Te avisamos por WhatsApp cuando te respondan.
            </p>
          </Card>
        ) : !cerrado ? (
          // Prod: no hay endpoint para que el inquilino comente este reclamo.
          // Lo derivamos al canal de WhatsApp en vez de mostrar un form muerto.
          <Card className="space-y-2 p-4 text-center text-sm text-muted-foreground">
            <MessageCircle className="mx-auto h-6 w-6 text-primary" />
            <p>
              ¿Querés agregar algo sobre este reclamo? Escribinos por WhatsApp y
              lo sumamos al seguimiento.
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
