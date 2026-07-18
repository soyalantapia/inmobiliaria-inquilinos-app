'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Send,
  ShieldX,
  UserCheck,
  X,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Separator } from '@llave/ui/separator';
import { Skeleton } from '@llave/ui/skeleton';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { GestionReclamo } from '@/components/gestion-reclamo';
import { ProgresoVisitaCard } from '@/components/progreso-visita-card';
import { ReclamoTimeline } from '@/components/reclamo-timeline';
import { contactosCobranzaMock, operadoresMock } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';
import { ESTADO_SLA_LABEL, evaluarSla } from '@/lib/sla-reclamos';
import {
  categoriaIcono,
  categoriaLabel,
  estadoConfig,
  tiempoEnPropiedad,
  tiempoRelativo,
  urgenciaConfig,
} from '@/lib/reclamos-config';
import {
  agregarMensajeInmo,
  asignarOperador,
  cambiarEstado,
} from '@/lib/reclamos-store';
import { apiEnabled, subirArchivo, urlDeArchivo } from '@/lib/api/client';
import { useReclamo } from '@/lib/api/use-reclamo';
import { useVisitaReclamo } from '@/lib/api/use-visita-reclamo';
import { mockUser } from '@/lib/auth';
import type { PagadorReclamo, Reclamo } from '@/lib/types';

const OPERADOR_ACTUAL = mockUser.user.fullName; // Roberto Tapia en mock

// Opciones de "¿Quién paga?" en el diálogo de resolución (define el impacto en la plata).
const PAGADORES: { v: PagadorReclamo; label: string; hint: string }[] = [
  { v: 'PROPIETARIO', label: 'Propietario', hint: 'A su rendición' },
  { v: 'DEPOSITO', label: 'Depósito', hint: 'Del depósito' },
  { v: 'INQUILINO', label: 'Inquilino', hint: 'Se le cobra' },
];

export default function DetalleReclamoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  // Fuente de verdad: API real en prod (GET /reclamos/:id) o el store local en
  // build demo (!apiEnabled). En prod las mutaciones pegan al API e invalidan la
  // query; en demo seguimos usando el reclamos-store como antes.
  const {
    reclamo: reclamoFuente,
    contacto: contactoApi,
    asignar: asignarApi,
    resolver: resolverApi,
    clasificar: clasificarApi,
    rechazar: rechazarApi,
    responder: responderApi,
  } = useReclamo(params?.id);
  const { visita } = useVisitaReclamo(params?.id);

  // Copia local para respuesta instantánea: en demo el store devuelve el objeto
  // actualizado y lo pisamos acá; en prod se resincroniza desde la query.
  const [reclamo, setReclamo] = useState<Reclamo | null | undefined>(undefined);
  const [mensaje, setMensaje] = useState('');
  const [adjuntoMsg, setAdjuntoMsg] = useState<File | null>(null);
  const [resolucion, setResolucion] = useState('');
  const [costoStr, setCostoStr] = useState('');
  const [costoNotas, setCostoNotas] = useState('');
  const [pagador, setPagador] = useState<PagadorReclamo | null>(null);
  const [dialogo, setDialogo] = useState<'resolver' | 'rechazar' | 'cerrar' | null>(null);
  const [dialogoCargando, setDialogoCargando] = useState(false);
  // Guard de re-entrancia SÍNCRONO contra el doble-click: setDialogoCargando es un
  // state setter (async) y no bloquea la 2da invocación en el mismo tick.
  const confirmandoRef = useRef(false);
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReclamo(reclamoFuente);
  }, [reclamoFuente]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reclamo?.eventos.length]);

  const Icon = useMemo(() => (reclamo ? categoriaIcono[reclamo.categoria] : null), [reclamo]);

  if (reclamo === undefined) return <DetalleSkeleton />;

  if (reclamo === null) {
    return (
      <>
        <Topbar titulo="Reclamo" />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <p className="font-medium">Reclamo no encontrado</p>
              <Button asChild className="mt-2">
                <Link href="/reclamos">Volver al inbox</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const cerrado =
    reclamo.estado === 'RESUELTO' ||
    reclamo.estado === 'CERRADO' ||
    reclamo.estado === 'RECHAZADO';

  // Asignar operador interno y "tomar/poner en curso" no tienen endpoint en el
  // API → solo operan en build demo (store). En prod quedan deshabilitados.
  const handleAsignar = (operador: string) => {
    if (apiEnabled) return;
    const updated = asignarOperador(reclamo.id, operador, OPERADOR_ACTUAL);
    if (updated) {
      setReclamo(updated);
      toast({ title: 'Reclamo asignado', description: `Ahora lo lleva ${operador}.` });
    }
  };

  const handleTomar = () => {
    if (apiEnabled) return;
    const updated = cambiarEstado(reclamo.id, 'EN_CURSO', OPERADOR_ACTUAL);
    if (updated) {
      setReclamo(updated);
      toast({ title: 'Marcado en curso', description: 'El inquilino lo ve al instante.' });
    }
  };

  // Responder al inquilino → POST /reclamos/:id/responder en prod (la query se
  // invalida y trae el evento real); en demo escribe el store local.
  const enviarMensaje = async () => {
    const texto = mensaje.trim();
    if ((!texto && !adjuntoMsg) || enviandoMsg) return;
    if (apiEnabled) {
      setEnviandoMsg(true);
      try {
        let adjuntoUrl: string | undefined;
        if (adjuntoMsg) adjuntoUrl = (await subirArchivo(adjuntoMsg)).url;
        await responderApi(texto, adjuntoUrl);
        setMensaje('');
        setAdjuntoMsg(null);
        toast({ title: 'Mensaje enviado al inquilino' });
      } catch {
        toast({ title: 'No se pudo enviar el mensaje', variant: 'destructive' });
      } finally {
        setEnviandoMsg(false);
      }
      return;
    }
    // Demo: store local (sin subida real de adjunto).
    const updated = agregarMensajeInmo(reclamo.id, OPERADOR_ACTUAL, texto);
    if (updated) {
      setReclamo(updated);
      setMensaje('');
      setAdjuntoMsg(null);
      toast({ title: 'Mensaje enviado al inquilino' });
    }
  };

  const confirmarDialogo = async () => {
    if (!dialogo || confirmandoRef.current) return;
    // Validación ANTES de tomar el lock (si retornamos, no dejamos el ref sucio):
    // en prod, si se carga un costo hay que decir quién paga (el backend lo exige).
    if (dialogo === 'resolver' && apiEnabled) {
      const costoNum = Number(costoStr.replace(/\D/g, '')) || 0;
      if (costoNum > 0 && !pagador) {
        toast({
          title: 'Indicá quién paga el costo del trabajo',
          description: 'Elegí propietario, inquilino o depósito.',
          variant: 'destructive',
        });
        return;
      }
    }
    const reclamoId = reclamo.id;
    // El ref bloquea el 2do click ANTES de que React re-renderice (sin esto el
    // doble-click creaba dos eventos en el timeline). setDialogoCargando es solo
    // para el spinner del botón.
    confirmandoRef.current = true;
    setDialogoCargando(true);

    if (dialogo === 'resolver') {
      const resolucionTxt = resolucion.trim();
      if (apiEnabled) {
        // Ahora /resolver persiste costo + quién paga e impacta la plata:
        // propietario → rendición, inquilino → cargo, depósito → deducción.
        const costoNum = Number(costoStr.replace(/\D/g, '')) || 0;
        try {
          await resolverApi({
            resolucion: resolucionTxt,
            ...(costoNum > 0
              ? {
                  costoTrabajo: costoNum,
                  costoTrabajoNotas: costoNotas.trim() || undefined,
                  pagador: pagador ?? undefined,
                }
              : {}),
          });
          const m = formatMonto(costoNum, reclamo.moneda ?? 'ARS');
          const desc =
            costoNum <= 0 || !pagador
              ? 'El inquilino fue notificado.'
              : pagador === 'PROPIETARIO'
                ? `${m} se descuenta al propietario en su próxima rendición.`
                : pagador === 'INQUILINO'
                  ? `${m} cargado al inquilino.`
                  : `${m} descontado del depósito de garantía.`;
          toast({ title: 'Reclamo resuelto', description: desc });
        } catch {
          toast({ title: 'No se pudo resolver el reclamo', variant: 'destructive' });
        }
      } else {
        const costoNum = Number(costoStr.replace(/\D/g, '')) || 0;
        const costo = costoNum > 0 ? { monto: costoNum, notas: costoNotas.trim() || undefined } : null;
        const updated = cambiarEstado(reclamoId, 'RESUELTO', OPERADOR_ACTUAL, resolucionTxt, costo);
        if (updated) {
          setReclamo(updated);
          toast({
            title: 'Reclamo resuelto',
            description: !costo
              ? 'El inquilino fue notificado.'
              : pagador === 'INQUILINO'
                ? `Costo ${formatMonto(costoNum)} cargado al inquilino.`
                : pagador === 'DEPOSITO'
                  ? `Costo ${formatMonto(costoNum)} descontado del depósito de garantía.`
                  : `Costo ${formatMonto(costoNum)} asociado al propietario.`,
          });
        }
      }
    } else if (dialogo === 'rechazar') {
      const motivo = resolucion.trim();
      if (apiEnabled) {
        try {
          await rechazarApi(motivo);
          toast({ title: 'Reclamo rechazado' });
        } catch {
          toast({ title: 'No se pudo rechazar el reclamo', variant: 'destructive' });
        }
      } else {
        const updated = cambiarEstado(reclamoId, 'RECHAZADO', OPERADOR_ACTUAL, motivo);
        if (updated) {
          setReclamo(updated);
          toast({ title: 'Reclamo rechazado' });
        }
      }
    } else if (dialogo === 'cerrar') {
      // Cerrar definitivamente (CERRADO) no tiene endpoint → solo demo.
      if (!apiEnabled) {
        const updated = cambiarEstado(reclamoId, 'CERRADO', OPERADOR_ACTUAL);
        if (updated) {
          setReclamo(updated);
          toast({ title: 'Reclamo cerrado' });
        }
      }
    }

    setDialogoCargando(false);
    confirmandoRef.current = false;
    setDialogo(null);
    setResolucion('');
    setCostoStr('');
    setCostoNotas('');
    setPagador(null);
  };

  return (
    <>
      <Topbar titulo="Reclamo" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push('/reclamos')}
            className="rounded-full p-2 hover:bg-muted md:hidden"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Link
            href="/reclamos"
            className="hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al inbox
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Columna principal: detalle + timeline + composer */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-6">
                {/* Si el SLA está vencido (típico de emergencias sin
                    asignar) mostramos banner rojo arriba — antes el
                    detalle no transmitía urgencia y se veía igual que
                    cualquier reclamo. */}
                {(() => {
                  const sla = evaluarSla(reclamo);
                  if (sla.estado !== 'VENCIDO' && sla.estado !== 'PROXIMO_VENCIMIENTO') {
                    return null;
                  }
                  return (
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
                        sla.estado === 'VENCIDO'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200',
                      )}
                    >
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        Plazo de resolución · {ESTADO_SLA_LABEL[sla.estado]} — {sla.texto}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex items-start gap-3">
                  {Icon && (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-semibold">{reclamo.inquilino}</h1>
                      <Badge variant={urgenciaConfig[reclamo.urgencia].variant}>
                        {urgenciaConfig[reclamo.urgencia].label}
                      </Badge>
                      <Badge variant={estadoConfig[reclamo.estado].variant}>
                        {estadoConfig[reclamo.estado].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {/* Antes mostraba "9 may" sin contexto temporal —
                          tiempoRelativo da "hace 17 días" que comunica
                          urgencia al instante. */}
                      {categoriaLabel[reclamo.categoria]} · {reclamo.direccion} ·{' '}
                      {tiempoRelativo(reclamo.createdAt)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {tiempoEnPropiedad(reclamo.contratoDesde) && (
                        <span className="text-xs text-muted-foreground">
                          🏠 En la propiedad hace{' '}
                          <span className="font-medium text-foreground">
                            {tiempoEnPropiedad(reclamo.contratoDesde)}
                          </span>
                        </span>
                      )}
                      <Link
                        href={`/contratos/${reclamo.contratoId}`}
                        className="inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Ver contrato →
                      </Link>
                    </div>
                  </div>
                </div>
                <Separator />
                <p className="text-sm leading-relaxed">{reclamo.descripcion}</p>
                {reclamo.fotoUrl && (
                  <div className="rounded-md border bg-muted/30 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urlDeArchivo(reclamo.fotoUrl)}
                      alt="Foto del inquilino"
                      className="max-h-80 w-full rounded object-contain"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card role="log" aria-label="Historial del reclamo" aria-live="polite">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Historial
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {reclamo.eventos.length} evento{reclamo.eventos.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ReclamoTimeline eventos={reclamo.eventos} />
                <div ref={scrollEndRef} />
              </CardContent>
            </Card>

            {!cerrado && (
              <Card>
                <CardContent className="space-y-3 p-6">
                  <Label htmlFor="msg">Responder al inquilino</Label>
                  <div className="flex items-end gap-2">
                    <Input
                      id="msg"
                      placeholder="Ej: Te paso a visitar mañana entre 10 y 12."
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          enviarMensaje();
                        }
                      }}
                    />
                    <Button
                      onClick={enviarMensaje}
                      disabled={(!mensaje.trim() && !adjuntoMsg) || enviandoMsg}
                      size="icon"
                      aria-label="Enviar mensaje al inquilino"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {adjuntoMsg ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{adjuntoMsg.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAdjuntoMsg(null)}
                        disabled={enviandoMsg}
                        aria-label="Quitar adjunto"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    // El adjunto sólo se sube en prod (en demo no hay backend).
                    apiEnabled && (
                      <label className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                        <Paperclip className="h-3.5 w-3.5" />
                        Adjuntar foto o archivo
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={enviandoMsg}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setAdjuntoMsg(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    El inquilino lo recibe en la app y por WhatsApp.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna lateral: acciones */}
          <aside className="space-y-4">
            {/* Progreso del trabajo (link mágico del profesional) */}
            {reclamo.profesionalAsignadoId && (
              <ProgresoVisitaCard reclamoId={reclamo.id} />
            )}

            {!cerrado && (
              <GestionReclamo
                reclamo={reclamo}
                onUpdate={(r) => setReclamo(r)}
                asignarApi={asignarApi}
                clasificarApi={clasificarApi}
                visitaToken={visita?.token}
              />
            )}

            {!cerrado && (
              <Card>
                <CardContent className="space-y-4 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Operador y estado
                  </h3>

                  {/* Asignar operador interno y "tomar/poner en curso" no tienen
                      endpoint en el API → solo en build demo. */}
                  {!apiEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="asignado" className="text-xs">
                          Asignado a
                        </Label>
                        <Select
                          value={reclamo.asignadoA ?? ''}
                          onValueChange={(v) => v && handleAsignar(v)}
                        >
                          <SelectTrigger id="asignado">
                            <SelectValue placeholder="Elegí operador" />
                          </SelectTrigger>
                          <SelectContent>
                            {operadoresMock.map((op) => (
                              <SelectItem key={op} value={op}>
                                {op}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />
                    </>
                  )}

                  <div className="space-y-2">
                    {!apiEnabled && reclamo.estado === 'ABIERTO' && (
                      <Button className="w-full" onClick={handleTomar} disabled={!reclamo.asignadoA}>
                        <Clock className="h-4 w-4" />
                        Tomar y poner en curso
                      </Button>
                    )}
                    {!apiEnabled && reclamo.estado === 'ABIERTO' && !reclamo.asignadoA && (
                      <p className="text-[11px] text-muted-foreground">
                        Asigná un operador antes de tomarlo.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPagador(reclamo.pagador ?? null);
                        setDialogo('resolver');
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar como resuelto
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDialogo('rechazar')}
                    >
                      <ShieldX className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {reclamo.estado === 'RESUELTO' && reclamo.resolucion && (
              <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Resolución</p>
                  </div>
                  <p className="text-sm">{reclamo.resolucion}</p>
                  {reclamo.resueltoAt && (
                    <p className="text-xs text-muted-foreground">
                      {tiempoRelativo(reclamo.resueltoAt)} · {reclamo.asignadoA ?? '—'}
                    </p>
                  )}
                  {reclamo.costoTrabajo != null && Number(reclamo.costoTrabajo) > 0 && (
                    <p className="text-xs">
                      Costo del trabajo:{' '}
                      <strong>{formatMonto(Number(reclamo.costoTrabajo), reclamo.moneda ?? 'ARS')}</strong>
                      {reclamo.pagador && (
                        <>
                          {' · '}lo paga{' '}
                          {reclamo.pagador === 'INQUILINO'
                            ? 'el inquilino'
                            : reclamo.pagador === 'DEPOSITO'
                              ? 'el depósito de garantía'
                              : 'el propietario'}
                        </>
                      )}
                    </p>
                  )}
                  {/* "Cerrar definitivamente" (CERRADO) no tiene endpoint → demo. */}
                  {!apiEnabled && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setDialogo('cerrar')}
                    >
                      Cerrar definitivamente
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Inquilino
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{reclamo.inquilino}</span>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p>{reclamo.direccion}</p>
                </div>
                {/* Contacto real del inquilino: en prod viene del API
                    (contrato.inquilinoTitular); en demo lo resolvemos por
                    contratoId contra el mock. Antes los botones llevaban a un
                    número hardcoded para TODOS los reclamos. */}
                {(() => {
                  const contactoMock = apiEnabled
                    ? null
                    : contactosCobranzaMock.find((c) => c.contratoId === reclamo.contratoId);
                  const tel = apiEnabled
                    ? contactoApi?.telefono ?? null
                    : contactoMock?.titular.telefono ?? null;
                  const telLimpio = tel?.replace(/[^\d]/g, '');
                  const email = apiEnabled
                    ? contactoApi?.email ?? null
                    : contactoMock?.titular.email ?? null;
                  if (!tel && !email) {
                    return (
                      <p className="text-[11px] text-muted-foreground">
                        Sin datos de contacto cargados para este inquilino.
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {telLimpio && (
                        <>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`https://wa.me/${telLimpio}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`tel:${telLimpio}`}>
                              <Phone className="h-3.5 w-3.5" />
                              Llamar
                            </a>
                          </Button>
                        </>
                      )}
                      {email && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`mailto:${email}`}>
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {/* Dialogos */}
      <ConfirmDialog
        open={dialogo === 'resolver'}
        onOpenChange={(open) => {
          if (!open) {
            setDialogo(null);
            setResolucion('');
            setCostoStr('');
            setCostoNotas('');
            setPagador(null);
          }
        }}
        title="Marcar como resuelto"
        description={
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <p id="resolucion-hint" className="text-sm text-muted-foreground">
                Describí cómo se resolvió. El inquilino lo va a ver en su detalle.
              </p>
              <Textarea
                autoFocus
                rows={3}
                aria-label="Descripción de la resolución"
                aria-describedby="resolucion-hint"
                value={resolucion}
                onChange={(e) => setResolucion(e.target.value)}
                placeholder="Ej: Vino el plomero el martes, cambió el flexible y selló la canilla."
              />
              {resolucion.trim().length > 0 && resolucion.trim().length < 5 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Un poco más de detalle — mínimo 5 caracteres.
                </p>
              )}
            </div>
            <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Costo del trabajo · ¿Quién paga?
              </p>
              <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={costoStr ? Number(costoStr).toLocaleString('es-AR') : ''}
                    onChange={(e) => setCostoStr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="200.000"
                    aria-label="Costo del trabajo"
                    className="w-full rounded-md border bg-background px-3 py-1.5 pl-7 text-sm tabular-nums"
                  />
                </div>
                <input
                  type="text"
                  value={costoNotas}
                  onChange={(e) => setCostoNotas(e.target.value)}
                  placeholder="Concepto: cambio de flexible y silicona"
                  aria-label="Concepto del trabajo"
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PAGADORES.map((p) => {
                  const activo = pagador === p.v;
                  return (
                    <button
                      key={p.v}
                      type="button"
                      onClick={() => setPagador(activo ? null : p.v)}
                      aria-pressed={activo}
                      className={cn(
                        'rounded-md border px-2 py-2 text-left transition-colors',
                        activo
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border hover:bg-muted/40',
                      )}
                    >
                      <span className="block text-xs font-medium">{p.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{p.hint}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Opcional. Si cargás un costo, elegí quién lo paga: impacta la rendición del
                propietario, un cargo al inquilino, o el depósito de garantía.
              </p>
            </div>
          </div>
        }
        confirmLabel="Confirmar resolución"
        confirmDisabled={resolucion.trim().length < 5}
        loading={dialogoCargando}
        onConfirm={() => confirmarDialogo()}
      />

      <ConfirmDialog
        open={dialogo === 'rechazar'}
        onOpenChange={(open) => {
          if (!open) {
            setDialogo(null);
            setResolucion('');
          }
        }}
        title="Rechazar reclamo"
        description={
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Explicale al inquilino por qué este reclamo no procede.
            </p>
            <Textarea
              aria-label="Motivo del rechazo"
              autoFocus
              rows={3}
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              placeholder="Ej: El daño es por mal uso, queda a cargo del inquilino según cláusula 12."
            />
            {resolucion.trim().length > 0 && resolucion.trim().length < 5 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Un poco más de detalle — mínimo 5 caracteres.
              </p>
            )}
          </div>
        }
        confirmLabel="Rechazar"
        variant="destructive"
        confirmDisabled={resolucion.trim().length < 5}
        loading={dialogoCargando}
        onConfirm={() => confirmarDialogo()}
      />

      <ConfirmDialog
        open={dialogo === 'cerrar'}
        onOpenChange={(open) => !open && setDialogo(null)}
        title="¿Cerrar el reclamo?"
        description="Lo movemos al archivo. Si el inquilino reabre el problema tiene que crear uno nuevo."
        confirmLabel="Cerrar reclamo"
        variant="destructive"
        onConfirm={confirmarDialogo}
      />
    </>
  );
}

function DetalleSkeleton() {
  return (
    <>
      <Topbar titulo="Reclamo" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
