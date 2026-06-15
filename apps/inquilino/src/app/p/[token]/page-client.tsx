'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  KeyRound,
  MapPin,
  Sparkles,
  Trash2,
  Truck,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  confirmarVisita,
  guardarFoto,
  listarVisitasDe,
  marcarEnCamino,
  marcarListo,
  obtenerVisita,
  type VisitaProfesional,
} from '@/lib/visitas-profesional';
import { formatFecha } from '@/lib/format';
import { apiEnabled } from '@/lib/api/client';

/* ============================================================
 * Datos
 * Profesionales del seed — copia mínima de los datos del inmo para que
 * el link mágico no necesite leer el storage del inmo (que podría no
 * existir). En backend real serían datos validados contra el token.
 * ============================================================ */
const PROFESIONALES_SEED: Record<
  string,
  {
    id: string;
    nombre: string;
    categoria: string;
    telefono: string;
  }
> = {
  prof_001: { id: 'prof_001', nombre: 'Sergio Almeida', categoria: 'Plomero', telefono: '+54 9 11 4421 8830' },
  prof_002: { id: 'prof_002', nombre: 'Diego Ferrari', categoria: 'Electricista', telefono: '+54 9 11 6502 7714' },
  prof_003: { id: 'prof_003', nombre: 'Luciana Pérez', categoria: 'Gasista', telefono: '+54 9 11 5567 2118' },
  prof_004: { id: 'prof_004', nombre: 'Pablo Cerrajería 24hs', categoria: 'Cerrajero', telefono: '+54 9 11 3399 4422' },
  prof_005: { id: 'prof_005', nombre: 'Camila Torres', categoria: 'Pintor', telefono: '+54 9 11 4488 1107' },
  prof_006: { id: 'prof_006', nombre: 'Frío Pro AA', categoria: 'Técnico AC', telefono: '+54 9 11 6678 9921' },
  prof_007: { id: 'prof_007', nombre: 'Mudanzas Express', categoria: 'Flete', telefono: '+54 9 11 7766 4400' },
  demo: { id: 'prof_001', nombre: 'Sergio Almeida', categoria: 'Plomero', telefono: '+54 9 11 4421 8830' },
};

/* ============================================================
 * Tipo simplificado de reclamo (lo que necesita ver el profesional)
 * ============================================================ */
interface ReclamoProf {
  id: string;
  inquilino: string;
  direccion: string;
  categoria: string;
  descripcion: string;
  urgencia: string;
  createdAt: string;
  contratoId: string;
}

const URGENCIA_COLOR: Record<string, string> = {
  EMERGENCIA: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  ALTA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  MEDIA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  BAJA: 'bg-muted text-muted-foreground',
};

export default function PaginaProfesional({ token }: { token: string }) {
  // En producción no hay endpoint que resuelva el token de un profesional ni
  // sus trabajos asignados: esta vista vive del seed (nombres/teléfonos de
  // profesionales, teléfono de la inmobiliaria) y lee cross-app el storage del
  // inmo. Nada de eso existe en prod, así que mostramos un estado neutro en vez
  // de exponer datos mock. `apiEnabled` es una constante de módulo
  // (NEXT_PUBLIC_API_URL inlineado), seguro con static export. Gate ANTES del
  // componente con hooks para no romper rules-of-hooks.
  if (apiEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-3 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold">No disponible</p>
          <p className="text-sm text-muted-foreground">
            Esta vista para profesionales todavía no está disponible. Si
            esperabas un trabajo asignado, contactá directamente a la
            inmobiliaria que te envió el link.
          </p>
        </Card>
      </main>
    );
  }

  return <PaginaProfesionalDemo token={token} />;
}

function PaginaProfesionalDemo({ token }: { token: string }) {
  const prof = PROFESIONALES_SEED[token];
  const [reclamosAsignados, setReclamosAsignados] = useState<ReclamoProf[]>([]);
  const [visitas, setVisitas] = useState<VisitaProfesional[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setHidratado(true);
    if (!prof) return;
    refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prof?.id]);

  const refrescar = () => {
    if (!prof) return;
    setReclamosAsignados(leerReclamosAsignadosA(prof.id));
    setVisitas(listarVisitasDe(prof.id));
  };

  const visitaMap = useMemo(() => {
    const m: Record<string, VisitaProfesional> = {};
    for (const v of visitas) m[v.reclamoId] = v;
    return m;
  }, [visitas]);

  const abiertos = reclamosAsignados.filter(
    (r) => (visitaMap[r.id]?.estado ?? 'ASIGNADO') !== 'LISTO',
  );
  const cerrados = reclamosAsignados.filter(
    (r) => visitaMap[r.id]?.estado === 'LISTO',
  );

  if (!prof) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-3 p-6 text-center">
          <p className="text-base font-semibold">Link no válido</p>
          <p className="text-sm text-muted-foreground">
            Este enlace no corresponde a ningún profesional. Si pensás que es
            un error, pediselo a la inmobiliaria que te lo mandó.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto max-w-3xl space-y-3 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Inmobiliaria del Sol — trabajos asignados
              </p>
              <h1 className="text-lg font-semibold leading-tight">
                Hola {prof.nombre.split(' ')[0]} 👋
              </h1>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {prof.categoria}
            </Badge>
          </div>
          <Card className="space-y-1 border-primary/20 bg-primary/5 p-3 text-xs">
            <p className="font-medium">¿Cómo funciona este link?</p>
            <p className="text-muted-foreground">
              Acá ves los trabajos que te asignamos. Confirmá un día/hora para
              cada uno, marcá &quot;En camino&quot; cuando salgas y &quot;Listo&quot; cuando termines.
              El inquilino se entera en tiempo real.
            </p>
          </Card>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-6">
        {!hidratado ? (
          <Card className="h-40 animate-pulse bg-muted/40" />
        ) : reclamosAsignados.length === 0 ? (
          // Empty state con explicación de qué pasa cuando llegue un
          // trabajo. Antes era solo "Sin trabajos asignados" y Sergio
          // se quedaba dudando si tenía que cargar algo, si le iba a
          // llegar notificación, o si tenía que estar refrescando.
          <Card className="space-y-3 p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Sin trabajos asignados</p>
              <p className="text-xs text-muted-foreground">
                Cuando la inmobiliaria te asigne uno, va a aparecer acá.
              </p>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-left text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">¿Qué vas a ver?</p>
              <ul role="list" className="mt-1.5 space-y-1">
                <li>• Dirección de la propiedad y contacto del inquilino</li>
                <li>• Categoría del problema (plomería, electricidad, etc.)</li>
                <li>• Foto del reclamo si la cargó el inquilino</li>
                <li>• Botones para marcar &quot;En camino&quot; y &quot;Listo&quot;</li>
              </ul>
              <p className="mt-2">
                Te avisamos por WhatsApp cuando llegue un trabajo nuevo.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trabajos activos ({abiertos.length})
              </h2>
              {abiertos.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  Sin trabajos activos. ¡Mirá los completados abajo!
                </Card>
              ) : (
                <div className="space-y-3">
                  {abiertos.map((r) => (
                    <TrabajoCard
                      key={r.id}
                      reclamo={r}
                      visita={visitaMap[r.id] ?? null}
                      profId={prof.id}
                      onChange={refrescar}
                    />
                  ))}
                </div>
              )}
            </section>

            {cerrados.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Completados ({cerrados.length})
                </h2>
                <div className="space-y-2">
                  {cerrados.map((r) => (
                    <TrabajoCard
                      key={r.id}
                      reclamo={r}
                      visita={visitaMap[r.id] ?? null}
                      profId={prof.id}
                      onChange={refrescar}
                      colapsado
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="rounded-md border bg-background p-3 text-center text-xs text-muted-foreground">
          ¿Dudas? Llamá a la inmobiliaria al +54 11 4532-1100. Tu link es único
          y solo lo podés ver vos.
        </div>

        {/* Brand footer — identifica que el producto es My Alquiler
            sin restarle protagonismo a la inmobiliaria que es el
            cliente directo del profesional. Antes la página no tenía
            nada que dijera "My Alquiler" y si Sergio quería buscar
            info de la plataforma no sabía por dónde. */}
        <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-muted-foreground">
          <div className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-primary to-fuchsia-600 text-[8px] font-bold text-white">
            My
          </div>
          <span>Con tecnología de My Alquiler · vista para profesionales</span>
        </div>
      </main>
    </div>
  );
}

/* ============================================================
 * Lectura cross-app del storage del inmo para encontrar los reclamos
 * asignados a este profesional. Mismo origen → mismo localStorage.
 * ============================================================ */
function leerReclamosAsignadosA(profId: string): ReclamoProf[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('llave-inmo:reclamos:v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      reclamos: Array<{
        id: string;
        inquilino: string;
        direccion: string;
        categoria: string;
        descripcion: string;
        urgencia: string;
        createdAt: string;
        contratoId: string;
        estado: string;
        profesionalAsignadoId?: string;
      }>;
    };
    return parsed.reclamos
      .filter(
        (r) =>
          r.profesionalAsignadoId === profId &&
          (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO' || r.estado === 'RESUELTO'),
      )
      .map((r) => ({
        id: r.id,
        inquilino: r.inquilino,
        direccion: r.direccion,
        categoria: r.categoria,
        descripcion: r.descripcion,
        urgencia: r.urgencia,
        createdAt: r.createdAt,
        contratoId: r.contratoId,
      }));
  } catch {
    return [];
  }
}

/* ============================================================
 * Card de un trabajo individual con su workflow
 * ============================================================ */
function TrabajoCard({
  reclamo,
  visita,
  profId,
  onChange,
  colapsado,
}: {
  reclamo: ReclamoProf;
  visita: VisitaProfesional | null;
  profId: string;
  onChange: () => void;
  colapsado?: boolean;
}) {
  const estado = visita?.estado ?? 'ASIGNADO';
  const [fechaInput, setFechaInput] = useState(
    visita?.fechaVisita?.slice(0, 16) ?? defaultFecha(),
  );
  const [notaInput, setNotaInput] = useState(visita?.notaFinal ?? '');
  const [montoInput, setMontoInput] = useState(
    visita?.montoCobrado ? String(visita.montoCobrado) : '',
  );
  const [openCerrar, setOpenCerrar] = useState(false);

  const handleConfirmar = () => {
    if (!fechaInput) {
      toast({ title: 'Elegí día y hora', variant: 'destructive' });
      return;
    }
    confirmarVisita(reclamo.id, profId, new Date(fechaInput).toISOString());
    toast({
      variant: 'success',
      title: 'Visita confirmada',
      description: `Le avisamos a ${reclamo.inquilino.split(' ')[0]}.`,
    });
    onChange();
  };

  const handleEnCamino = () => {
    marcarEnCamino(reclamo.id, profId);
    toast({
      variant: 'success',
      title: 'Marcado "En camino"',
      description: 'El inquilino recibe la notificación.',
    });
    onChange();
  };

  const handleListo = () => {
    if (!notaInput.trim()) {
      toast({ title: 'Contale qué hiciste', variant: 'destructive' });
      return;
    }
    const monto = Number(montoInput.replace(/\D/g, '')) || null;
    marcarListo(reclamo.id, profId, notaInput.trim(), monto);
    toast({
      variant: 'success',
      title: 'Trabajo cerrado',
      description: 'La inmobiliaria lo va a revisar.',
    });
    setOpenCerrar(false);
    onChange();
  };

  return (
    <Card className={cn('space-y-3 p-4', colapsado && 'opacity-80')}>
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          {reclamo.urgencia === 'EMERGENCIA' ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Wrench className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{reclamo.direccion}</p>
            <Badge variant="outline" className="text-[10px]">
              {reclamo.categoria.toLowerCase()}
            </Badge>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                URGENCIA_COLOR[reclamo.urgencia] ?? URGENCIA_COLOR.BAJA,
              )}
            >
              {reclamo.urgencia.toLowerCase()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {reclamo.inquilino} · creado {formatFecha(reclamo.createdAt)}
          </p>
        </div>
        <Badge
          variant={
            estado === 'LISTO'
              ? 'success'
              : estado === 'EN_CAMINO'
                ? 'warning'
                : estado === 'CONFIRMADA'
                  ? 'default'
                  : 'outline'
          }
          className="shrink-0 text-[10px]"
        >
          {estado === 'ASIGNADO' && 'Asignado'}
          {estado === 'CONFIRMADA' && 'Confirmé visita'}
          {estado === 'EN_CAMINO' && 'En camino'}
          {estado === 'LISTO' && 'Listo'}
        </Badge>
      </div>

      <p className="rounded-md bg-muted/50 p-2 text-xs">{reclamo.descripcion}</p>

      {/* Workflow según estado */}
      {!colapsado && (
        <>
          {estado === 'ASIGNADO' && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <Label htmlFor="ptr-fecha" className="text-xs">¿Cuándo podés pasar?</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="ptr-fecha"
                  type="datetime-local"
                  value={fechaInput}
                  onChange={(e) => setFechaInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleConfirmar} className="gap-1.5">
                  <CalendarClock className="h-4 w-4" />
                  Confirmar visita
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Al confirmar, el inquilino recibe la fecha en su app.
              </p>
            </div>
          )}

          {estado === 'CONFIRMADA' && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs">
                  Confirmaste visita para{' '}
                  <strong>
                    {visita?.fechaVisita
                      ? new Date(visita.fechaVisita).toLocaleString('es-AR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </strong>
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleEnCamino} className="gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Salí — Estoy en camino
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpenCerrar(true)}>
                    Marcar listo
                  </Button>
                </div>
              </div>
              <FotoPicker
                label="Foto del problema (antes)"
                hint="Subí una foto del estado actual antes de empezar."
                dataUrl={visita?.fotoAntes ?? null}
                onChange={(url) => {
                  guardarFoto(reclamo.id, profId, 'antes', url);
                  onChange();
                }}
                onRemove={() => {
                  guardarFoto(reclamo.id, profId, 'antes', '');
                  onChange();
                }}
              />
            </div>
          )}

          {estado === 'EN_CAMINO' && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <Truck className="h-3.5 w-3.5" />
                  En camino — avisamos al inquilino que llegás en breve.
                </p>
                <Button size="sm" onClick={() => setOpenCerrar(true)} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar como listo
                </Button>
              </div>
              {visita?.fotoAntes && (
                <FotoPicker
                  label="Foto del problema (antes)"
                  hint="Cargada antes de empezar el trabajo."
                  dataUrl={visita.fotoAntes}
                  onChange={(url) => {
                    guardarFoto(reclamo.id, profId, 'antes', url);
                    onChange();
                  }}
                  onRemove={() => {
                    guardarFoto(reclamo.id, profId, 'antes', '');
                    onChange();
                  }}
                />
              )}
            </div>
          )}

          {openCerrar && estado !== 'LISTO' && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <div className="space-y-1">
                <Label htmlFor="ptr-nota" className="text-xs">¿Qué hiciste? (lo ve la inmo y el inquilino)</Label>
                <Textarea
                  id="ptr-nota"
                  value={notaInput}
                  onChange={(e) => setNotaInput(e.target.value)}
                  rows={2}
                  placeholder="Ej: cambié el flexible y sellé la cañería"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ptr-costo" className="text-xs">Costo del trabajo (opcional)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="ptr-costo"
                    value={montoInput}
                    onChange={(e) =>
                      setMontoInput(e.target.value.replace(/\D/g, '').slice(0, 12))
                    }
                    placeholder="25000"
                    className="pl-7"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <FotoPicker
                label="Foto del trabajo terminado (después)"
                hint="Mostrá el resultado para que el inquilino y la inmo lo vean."
                dataUrl={visita?.fotoDespues ?? null}
                onChange={(url) => {
                  guardarFoto(reclamo.id, profId, 'despues', url);
                  onChange();
                }}
                onRemove={() => {
                  guardarFoto(reclamo.id, profId, 'despues', '');
                  onChange();
                }}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpenCerrar(false)}>
                  Cancelar
                </Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={handleListo}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cerrar trabajo
                </Button>
              </div>
            </div>
          )}

          {estado === 'LISTO' && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/40 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <p className="flex items-center gap-1.5 font-medium text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Trabajo completado el {formatFecha(visita?.listoAt ?? '')}
              </p>
              {(visita?.fotoAntes || visita?.fotoDespues) && (
                <div className="grid grid-cols-2 gap-2">
                  {visita.fotoAntes && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Antes
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={visita.fotoAntes}
                        alt="Antes del trabajo"
                        className="aspect-square w-full rounded-md border object-cover"
                      />
                    </div>
                  )}
                  {visita.fotoDespues && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Después
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={visita.fotoDespues}
                        alt="Después del trabajo"
                        className="aspect-square w-full rounded-md border object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
              {visita?.notaFinal && (
                <p className="italic text-muted-foreground">
                  &ldquo;{visita.notaFinal}&rdquo;
                </p>
              )}
              {visita?.montoCobrado ? (
                <p className="text-muted-foreground">
                  Costo: $
                  {Math.round(visita.montoCobrado).toLocaleString('es-AR')}
                </p>
              ) : null}
            </div>
          )}
        </>
      )}

      {colapsado && visita?.notaFinal && (
        <p className="rounded-md bg-emerald-50/40 p-2 text-xs italic text-muted-foreground dark:bg-emerald-900/10">
          &ldquo;{visita.notaFinal}&rdquo;
        </p>
      )}
    </Card>
  );
}

/* ============================================================
 * Picker de foto con preview + remover
 * ============================================================ */
function FotoPicker({
  label,
  hint,
  dataUrl,
  onChange,
  onRemove,
}: {
  label: string;
  hint?: string;
  dataUrl: string | null;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
}) {
  const [cargando, setCargando] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ title: 'Tiene que ser una imagen', variant: 'destructive' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'Máximo 5 MB', variant: 'destructive' });
      return;
    }
    setCargando(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      setCargando(false);
    };
    reader.onerror = () => {
      toast({ title: 'No pudimos leer la imagen', variant: 'destructive' });
      setCargando(false);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          {label}
        </p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      {dataUrl ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-md border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={label}
              className="aspect-video w-full object-cover"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Sacar foto
          </Button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-background py-6 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30">
          <Camera className="h-4 w-4 text-primary" />
          <span>{cargando ? 'Cargando…' : 'Tomar / Subir foto'}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function defaultFecha(): string {
  const d = new Date();
  d.setHours(d.getHours() + 24); // mañana misma hora
  d.setMinutes(0);
  return d.toISOString().slice(0, 16);
}

function _unusedToShush(_: typeof CheckCircle2 | typeof MapPin | typeof Clock) {}
void _unusedToShush;
