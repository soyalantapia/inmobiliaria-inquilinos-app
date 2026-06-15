'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Droplets,
  Flame,
  KeyRound,
  Mail,
  MessageCircle,
  MoreVertical,
  Paintbrush,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Snowflake,
  Star,
  Trash2,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@llave/ui/dropdown-menu';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  AsignarProfesionalDialog,
  mensajeWhatsappGenerico,
} from '@/components/asignar-profesional-dialog';
import { HistorialProfesionalDialog } from '@/components/historial-profesional-dialog';
import {
  type CategoriaProfesional,
  type ProfesionalAdmin,
  profesionalCategoriaLabelAdmin,
} from '@/lib/mock-data';
import {
  actualizarProfesional,
  crearProfesional,
  eliminarProfesional,
  listarProfesionalesAdmin,
  toggleActivo,
} from '@/lib/profesionales-storage';
import { useProfesionales } from '@/lib/api/use-profesionales';
import { apiEnabled } from '@/lib/api/client';
import { listarReclamos } from '@/lib/reclamos-store';
import {
  type CalificacionRecibida,
  calificacionesPorProfesional,
  ratingPonderado,
} from '@/lib/ratings-cross-app';
import { formatFechaCorta } from '@/lib/format';

const iconoCategoria: Record<CategoriaProfesional, LucideIcon> = {
  PLOMERO: Droplets,
  ELECTRICISTA: Zap,
  GASISTA: Flame,
  CERRAJERO: KeyRound,
  PINTOR: Paintbrush,
  TECNICO_AC: Snowflake,
  FLETE: Truck,
};

type Filtro = 'TODOS' | CategoriaProfesional;

export default function ProfesionalesAdminPage() {
  // Lista real desde el API (GET /profesionales) o el store local en demo.
  const { profesionales, cargando, deApi } = useProfesionales();
  // En modo API todavía no hay POST/PATCH/DELETE de profesional: las altas,
  // ediciones y bajas se gatean a demo para no escribir mock en producción.
  const puedeMutar = !deApi;
  const [hidratado, setHidratado] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [soloActivos, setSoloActivos] = useState(true);
  const [abrirForm, setAbrirForm] = useState(false);
  const [editando, setEditando] = useState<ProfesionalAdmin | null>(null);
  const [eliminando, setEliminando] = useState<ProfesionalAdmin | null>(null);
  const [asignando, setAsignando] = useState<ProfesionalAdmin | null>(null);
  const [verHistorial, setVerHistorial] = useState<ProfesionalAdmin | null>(null);
  // En demo las altas/ediciones/bajas viven en localStorage; este contador
  // fuerza un re-render para reflejar el store tras cada mutación local.
  const [versionLocal, setVersionLocal] = useState(0);
  // Conteo de reclamos activos asignados a cada profesional (id → cant).
  const [reclamosActivosPorProf, setReclamosActivosPorProf] = useState<
    Record<string, number>
  >({});
  // Calificaciones nuevas recibidas del inquilino, agrupadas por profesional.
  const [califsPorProf, setCalifsPorProf] = useState<
    Record<string, CalificacionRecibida[]>
  >({});

  // En demo la lista canónica es el store local (mutable); en prod es la del
  // API. Reaccionamos a `versionLocal` para releer el store tras mutar.
  const lista = useMemo<ProfesionalAdmin[]>(
    () => (puedeMutar ? listarProfesionalesAdmin() : profesionales),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puedeMutar, profesionales, versionLocal],
  );

  useEffect(() => {
    refrescarReclamos();
    // Calificaciones cross-app (localStorage del lado inquilino): solo en demo.
    // En prod (apiEnabled) no leemos ese store; el rating sale del API.
    if (!apiEnabled) setCalifsPorProf(calificacionesPorProfesional());
    setHidratado(true);
  }, []);

  const refrescarReclamos = () => {
    const map: Record<string, number> = {};
    listarReclamos().forEach((r) => {
      if (
        r.profesionalAsignadoId &&
        (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO')
      ) {
        map[r.profesionalAsignadoId] = (map[r.profesionalAsignadoId] ?? 0) + 1;
      }
    });
    setReclamosActivosPorProf(map);
  };

  const filtrados = useMemo(() => {
    let l = lista;
    if (filtro !== 'TODOS') l = l.filter((p) => p.categoria === filtro);
    if (soloActivos) l = l.filter((p) => p.activo);
    return [...l].sort((a, b) => b.rating - a.rating);
  }, [lista, filtro, soloActivos]);

  // KPIs
  const total = lista.length;
  const activos = lista.filter((p) => p.activo).length;
  const verificados = lista.filter((p) => p.verificado).length;
  // Rating promedio: ponderado con las nuevas calificaciones recibidas del
  // inquilino para que refleje lo más actualizado de la operación.
  const promedioRating = useMemo(() => {
    if (lista.length === 0) return '—';
    const promedios = lista.map((p) => {
      const califs = califsPorProf[p.id] ?? [];
      return ratingPonderado(p.rating, p.cantTrabajos, califs).promedio || p.rating;
    });
    const valido = promedios.filter((x) => x > 0);
    if (valido.length === 0) return '—';
    return (valido.reduce((a, b) => a + b, 0) / valido.length).toFixed(1);
  }, [lista, califsPorProf]);

  const handleGuardar = (data: Omit<ProfesionalAdmin, 'id' | 'rating' | 'cantTrabajos' | 'ultimoTrabajo' | 'activo'>) => {
    if (!puedeMutar) return;
    if (editando) {
      actualizarProfesional(editando.id, data);
      toast({ title: 'Profesional actualizado' });
    } else {
      crearProfesional(data);
      toast({ title: 'Profesional agregado' });
    }
    setVersionLocal((v) => v + 1);
    setAbrirForm(false);
    setEditando(null);
  };

  const handleEliminar = () => {
    if (!puedeMutar || !eliminando) return;
    eliminarProfesional(eliminando.id);
    setVersionLocal((v) => v + 1);
    setEliminando(null);
    toast({ title: 'Eliminado' });
  };

  const handleToggle = (id: string) => {
    if (!puedeMutar) return;
    toggleActivo(id);
    setVersionLocal((v) => v + 1);
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu red
          </p>
          <h1 className="text-2xl font-semibold md:text-3xl">Profesionales</h1>
          <p className="text-sm text-muted-foreground">
            Plomeros, electricistas y técnicos que recomendás a tus inquilinos.
          </p>
        </div>
        <Button
          onClick={() => { setEditando(null); setAbrirForm(true); }}
          disabled={!puedeMutar}
          title={puedeMutar ? undefined : 'Próximamente'}
        >
          <Plus className="h-4 w-4" />
          Agregar profesional
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiSimple label="Total" value={total} />
        <KpiSimple label="Activos" value={activos} />
        <KpiSimple label="Verificados" value={verificados} />
        <KpiSimple label="Rating promedio" value={promedioRating} />
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['TODOS', ...(Object.keys(profesionalCategoriaLabelAdmin) as CategoriaProfesional[])] as Filtro[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filtro === c}
              onClick={() => setFiltro(c)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filtro === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              {c === 'TODOS' ? 'Todos' : profesionalCategoriaLabelAdmin[c]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          Sólo activos (visible para inquilinos)
        </label>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : hidratado && filtrados.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">
            {lista.length === 0
              ? 'Todavía no cargaste profesionales'
              : 'No hay profesionales con este filtro'}
          </p>
          {lista.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {puedeMutar
                ? 'Agregá plomeros, electricistas y técnicos para tus inquilinos.'
                : 'Cuando tu inmobiliaria cargue su red, vas a verla acá.'}
            </p>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => {
            const Icon = iconoCategoria[p.categoria];
            const tel = p.telefono.replace(/[^\d]/g, '');
            const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(mensajeWhatsappGenerico(p))}`;
            const telUrl = `tel:${p.telefono.replace(/\s/g, '')}`;
            const reclamosActivos = reclamosActivosPorProf[p.id] ?? 0;
            const califs = califsPorProf[p.id] ?? [];
            const rating = ratingPonderado(p.rating, p.cantTrabajos, califs);
            const ultimaCalif = califs[0];
            return (
              <Card
                key={p.id}
                className={cn(
                  'flex flex-col gap-3 p-4',
                  !p.activo && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerHistorial(p)}
                    className="flex-1 min-w-0 text-left transition-colors hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium leading-tight">{p.nombre}</p>
                      {p.verificado && (
                        <ShieldCheck
                          className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                          aria-label="Verificado por la inmobiliaria"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {profesionalCategoriaLabelAdmin[p.categoria]} · {p.zona}
                    </p>
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    {reclamosActivos > 0 ? (
                      <Badge
                        variant="warning"
                        className="shrink-0 gap-1 text-[10px]"
                      >
                        <Wrench className="h-3 w-3" />
                        {reclamosActivos} activo{reclamosActivos === 1 ? '' : 's'}
                      </Badge>
                    ) : (
                      <Badge
                        variant={p.activo ? 'success' : 'outline'}
                        className="shrink-0 text-[10px]"
                      >
                        {p.activo ? 'Activo' : 'Oculto'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium tabular-nums">
                      {rating.promedio > 0
                        ? rating.promedio.toFixed(1)
                        : '—'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {rating.totalCalificaciones} calif
                    {rating.totalCalificaciones === 1 ? '' : 's'}
                  </span>
                  {rating.nuevas > 0 && (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
                    >
                      +{rating.nuevas} nueva{rating.nuevas === 1 ? '' : 's'}
                    </Badge>
                  )}
                  {p.ultimoTrabajo && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate text-muted-foreground">
                        últ. {formatFechaCorta(p.ultimoTrabajo)}
                      </span>
                    </>
                  )}
                </div>

                {ultimaCalif && (
                  <div className="rounded-md border border-amber-200/60 bg-amber-50/40 p-2 text-xs dark:border-amber-900/30 dark:bg-amber-900/10">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-3 w-3',
                              i < ultimaCalif.estrellas
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-amber-200',
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {ultimaCalif.inquilino.split(' ')[0]} ·{' '}
                        {formatFechaCorta(ultimaCalif.enviadoAt)}
                      </span>
                    </div>
                    {ultimaCalif.comentario && (
                      <p className="mt-1 italic text-muted-foreground line-clamp-2">
                        “{ultimaCalif.comentario}”
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span>{p.telefono}</span>
                  </div>
                  {p.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{p.email}</span>
                    </div>
                  )}
                </div>

                {p.notas && (
                  <p className="rounded-md bg-muted/40 p-2 text-xs italic">
                    {p.notas}
                  </p>
                )}

                {/* Acciones primarias: lo que el inmo realmente hace todos los días. */}
                <div className="mt-auto grid grid-cols-[1fr_1fr_auto_auto] gap-1.5 border-t pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300"
                    asChild
                  >
                    <a href={waUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setAsignando(p)}
                    disabled={!p.activo}
                    className="gap-1.5"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Asignar
                  </Button>
                  <Button size="sm" variant="ghost" asChild aria-label="Llamar">
                    <a href={telUrl}>
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Más acciones"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setVerHistorial(p)}>
                        <Wrench className="mr-2 h-3.5 w-3.5" />
                        Ver historial
                      </DropdownMenuItem>
                      {puedeMutar ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditando(p);
                              setAbrirForm(true);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(p.id)}>
                            {p.activo ? 'Ocultar de inquilinos' : 'Mostrar a inquilinos'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setEliminando(p)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem disabled>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar (próximamente)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DialogForm
        open={abrirForm}
        onOpenChange={(v) => {
          setAbrirForm(v);
          if (!v) setEditando(null);
        }}
        editando={editando}
        onSubmit={handleGuardar}
      />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title={`¿Eliminar a ${eliminando?.nombre}?`}
        description="Los inquilinos dejarán de verlo. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleEliminar}
      />

      <AsignarProfesionalDialog
        profesional={asignando}
        open={!!asignando}
        onOpenChange={(v) => !v && setAsignando(null)}
        onAsignado={() => refrescarReclamos()}
      />

      <HistorialProfesionalDialog
        profesional={verHistorial}
        open={!!verHistorial}
        onOpenChange={(v) => !v && setVerHistorial(null)}
      />
    </div>
  );
}

function KpiSimple({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function DialogForm({
  open,
  onOpenChange,
  editando,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editando: ProfesionalAdmin | null;
  onSubmit: (data: Omit<ProfesionalAdmin, 'id' | 'rating' | 'cantTrabajos' | 'ultimoTrabajo' | 'activo'>) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<CategoriaProfesional>('PLOMERO');
  const [zona, setZona] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [verificado, setVerificado] = useState(false);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (editando) {
      setNombre(editando.nombre);
      setCategoria(editando.categoria);
      setZona(editando.zona);
      setTelefono(editando.telefono);
      setEmail(editando.email ?? '');
      setVerificado(editando.verificado);
      setNotas(editando.notas ?? '');
    } else {
      setNombre('');
      setCategoria('PLOMERO');
      setZona('');
      setTelefono('');
      setEmail('');
      setVerificado(false);
      setNotas('');
    }
  }, [editando, open]);

  const telefonoOk = telefono.replace(/[^\d]/g, '').length >= 8;
  const emailOk =
    email.trim().length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = () => {
    if (!nombre.trim() || !zona.trim()) {
      toast({ title: 'Faltan datos obligatorios', variant: 'destructive' });
      return;
    }
    if (!telefonoOk) {
      toast({
        title: 'WhatsApp obligatorio',
        description: 'Toda la comunicación con el profesional va por WhatsApp.',
        variant: 'destructive',
      });
      return;
    }
    if (!emailOk) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    onSubmit({
      nombre: nombre.trim(),
      categoria,
      zona: zona.trim(),
      telefono: telefono.trim(),
      email: email.trim() || null,
      verificado,
      notas: notas.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar profesional' : 'Agregar profesional'}</DialogTitle>
          <DialogDescription>
            Lo que cargues acá lo ven todos tus inquilinos en su red de profesionales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pf-nombre" className="text-xs" aria-required>
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pf-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pf-categoria" className="text-xs">Categoría</Label>
            <select
              id="pf-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaProfesional)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(profesionalCategoriaLabelAdmin) as CategoriaProfesional[]).map((c) => (
                <option key={c} value={c}>
                  {profesionalCategoriaLabelAdmin[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pf-zona" className="text-xs" aria-required>
              Zona <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pf-zona"
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              placeholder="Ej: Palermo, Recoleta"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="pf-tel" className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1">💬 WhatsApp</span>
                <span className="text-[10px] font-medium text-primary">obligatorio</span>
              </Label>
              <Input
                id="pf-tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 9 11 …"
                className={
                  telefono.length > 0 && !telefonoOk
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />
              {telefono.length > 0 && !telefonoOk && (
                <p className="text-[11px] text-destructive">
                  Mínimo 8 dígitos
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-email" className="flex items-center gap-1.5 text-xs">
                Email
                <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
              </Label>
              <Input
                id="pf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="—"
                className={
                  email.length > 0 && !emailOk
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />
              {email.length > 0 && !emailOk && (
                <p className="text-[11px] text-destructive">Email inválido</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pf-notas" className="text-xs">Notas internas</Label>
            <Textarea id="pf-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={verificado}
              onChange={(e) => setVerificado(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Verificado por la inmobiliaria
          </label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            {editando ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
