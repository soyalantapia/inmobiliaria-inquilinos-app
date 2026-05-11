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
  Phone,
  Send,
  ShieldX,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Separator } from '@llave/ui/separator';
import { Skeleton } from '@llave/ui/skeleton';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';
import { ReclamoTimeline } from '@/components/reclamo-timeline';
import { operadoresMock } from '@/lib/mock-data';
import {
  categoriaIcono,
  categoriaLabel,
  estadoConfig,
  tiempoRelativo,
  urgenciaConfig,
} from '@/lib/reclamos-config';
import {
  agregarMensajeInmo,
  asignarOperador,
  cambiarEstado,
  obtenerReclamo,
} from '@/lib/reclamos-store';
import { mockUser } from '@/lib/auth';
import type { Reclamo } from '@/lib/types';

const OPERADOR_ACTUAL = mockUser.user.fullName; // Roberto Tapia en mock

export default function DetalleReclamoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [reclamo, setReclamo] = useState<Reclamo | null | undefined>(undefined);
  const [mensaje, setMensaje] = useState('');
  const [resolucion, setResolucion] = useState('');
  const [dialogo, setDialogo] = useState<'resolver' | 'rechazar' | 'cerrar' | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params?.id) setReclamo(obtenerReclamo(params.id));
  }, [params?.id]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reclamo?.eventos.length]);

  const Icon = useMemo(() => (reclamo ? categoriaIcono[reclamo.categoria] : null), [reclamo]);

  if (reclamo === undefined) return <DetalleSkeleton />;

  if (reclamo === null) {
    return (
      <>
        <Topbar titulo="Reclamo" />
        <main className="flex-1 p-6">
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

  const handleAsignar = (operador: string) => {
    const updated = asignarOperador(reclamo.id, operador, OPERADOR_ACTUAL);
    if (updated) {
      setReclamo(updated);
      toast({ title: 'Reclamo asignado', description: `Ahora lo lleva ${operador}.` });
    }
  };

  const handleTomar = () => {
    const updated = cambiarEstado(reclamo.id, 'EN_CURSO', OPERADOR_ACTUAL);
    if (updated) {
      setReclamo(updated);
      toast({ title: 'Marcado en curso', description: 'El inquilino lo ve al instante.' });
    }
  };

  const enviarMensaje = () => {
    const texto = mensaje.trim();
    if (!texto) return;
    const updated = agregarMensajeInmo(reclamo.id, OPERADOR_ACTUAL, texto);
    if (updated) {
      setReclamo(updated);
      setMensaje('');
      toast({ title: 'Mensaje enviado al inquilino' });
    }
  };

  const confirmarDialogo = () => {
    if (!dialogo) return;
    if (dialogo === 'resolver') {
      const updated = cambiarEstado(reclamo.id, 'RESUELTO', OPERADOR_ACTUAL, resolucion.trim());
      if (updated) {
        setReclamo(updated);
        toast({ title: 'Reclamo resuelto', description: 'El inquilino fue notificado.' });
      }
    } else if (dialogo === 'rechazar') {
      const updated = cambiarEstado(reclamo.id, 'RECHAZADO', OPERADOR_ACTUAL, resolucion.trim());
      if (updated) {
        setReclamo(updated);
        toast({ title: 'Reclamo rechazado' });
      }
    } else if (dialogo === 'cerrar') {
      const updated = cambiarEstado(reclamo.id, 'CERRADO', OPERADOR_ACTUAL);
      if (updated) {
        setReclamo(updated);
        toast({ title: 'Reclamo cerrado' });
      }
    }
    setDialogo(null);
    setResolucion('');
  };

  return (
    <>
      <Topbar titulo="Reclamo" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-start gap-3">
          <button
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Columna principal: detalle + timeline + composer */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-6">
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
                      {categoriaLabel[reclamo.categoria]} · {reclamo.direccion} ·{' '}
                      {tiempoRelativo(reclamo.createdAt)}
                    </p>
                    <Link
                      href={`/contratos/${reclamo.contratoId}`}
                      className="inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Ver contrato →
                    </Link>
                  </div>
                </div>
                <Separator />
                <p className="text-sm leading-relaxed">{reclamo.descripcion}</p>
                {reclamo.fotoUrl && (
                  <div className="rounded-md border bg-muted/30 p-2">
                    <img
                      src={reclamo.fotoUrl}
                      alt="Foto del inquilino"
                      className="max-h-80 w-full rounded object-contain"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
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
                    <Button onClick={enviarMensaje} disabled={!mensaje.trim()} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    El inquilino lo recibe en la app y por WhatsApp (Sprint 3).
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna lateral: acciones */}
          <aside className="space-y-4">
            {!cerrado && (
              <Card>
                <CardContent className="space-y-4 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Gestión
                  </h3>

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

                  <div className="space-y-2">
                    {reclamo.estado === 'ABIERTO' && (
                      <Button className="w-full" onClick={handleTomar} disabled={!reclamo.asignadoA}>
                        <Clock className="h-4 w-4" />
                        Tomar y poner en curso
                      </Button>
                    )}
                    {reclamo.estado === 'ABIERTO' && !reclamo.asignadoA && (
                      <p className="text-[11px] text-muted-foreground">
                        Asigná un operador antes de tomarlo.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setDialogo('resolver')}
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setDialogo('cerrar')}
                  >
                    Cerrar definitivamente
                  </Button>
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
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href="https://wa.me/541145678900">
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Button>
                </div>
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
          }
        }}
        title="Marcar como resuelto"
        description={
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Describí cómo se resolvió. El inquilino lo va a ver en su detalle.
            </p>
            <Textarea
              autoFocus
              rows={4}
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              placeholder="Ej: Vino el plomero el martes, cambió el flexible y selló la canilla."
            />
          </div>
        }
        confirmLabel="Confirmar resolución"
        onConfirm={() => {
          if (resolucion.trim().length < 5) {
            toast({
              title: 'Necesitamos un poco más de detalle',
              description: 'Mínimo 5 caracteres.',
              variant: 'destructive',
            });
            return;
          }
          confirmarDialogo();
        }}
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
              autoFocus
              rows={3}
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              placeholder="Ej: El daño es por mal uso, queda a cargo del inquilino según cláusula 12."
            />
          </div>
        }
        confirmLabel="Rechazar"
        variant="destructive"
        onConfirm={() => {
          if (resolucion.trim().length < 5) {
            toast({
              title: 'Necesitamos motivo',
              description: 'Mínimo 5 caracteres.',
              variant: 'destructive',
            });
            return;
          }
          confirmarDialogo();
        }}
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
