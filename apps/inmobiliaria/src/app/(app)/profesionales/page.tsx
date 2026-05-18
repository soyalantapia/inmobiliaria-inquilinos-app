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
import { listarReclamos } from '@/lib/reclamos-store';
import { formatFecha } from '@/lib/format';

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
  const [lista, setLista] = useState<ProfesionalAdmin[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [soloActivos, setSoloActivos] = useState(true);
  const [abrirForm, setAbrirForm] = useState(false);
  const [editando, setEditando] = useState<ProfesionalAdmin | null>(null);
  const [eliminando, setEliminando] = useState<ProfesionalAdmin | null>(null);
  const [asignando, setAsignando] = useState<ProfesionalAdmin | null>(null);
  // Conteo de reclamos activos asignados a cada profesional (id → cant).
  const [reclamosActivosPorProf, setReclamosActivosPorProf] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    setLista(listarProfesionalesAdmin());
    refrescarReclamos();
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
  const promedioRating =
    lista.length > 0
      ? (lista.reduce((acc, p) => acc + p.rating, 0) / lista.length).toFixed(1)
      : '—';

  const handleGuardar = (data: Omit<ProfesionalAdmin, 'id' | 'rating' | 'cantTrabajos' | 'ultimoTrabajo' | 'activo'>) => {
    if (editando) {
      actualizarProfesional(editando.id, data);
      toast({ title: 'Profesional actualizado' });
    } else {
      crearProfesional(data);
      toast({ title: 'Profesional agregado' });
    }
    setLista(listarProfesionalesAdmin());
    setAbrirForm(false);
    setEditando(null);
  };

  const handleEliminar = () => {
    if (!eliminando) return;
    eliminarProfesional(eliminando.id);
    setLista(listarProfesionalesAdmin());
    setEliminando(null);
    toast({ title: 'Eliminado' });
  };

  const handleToggle = (id: string) => {
    toggleActivo(id);
    setLista(listarProfesionalesAdmin());
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
        <Button onClick={() => { setEditando(null); setAbrirForm(true); }}>
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
      {hidratado && filtrados.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No hay profesionales con este filtro</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => {
            const Icon = iconoCategoria[p.categoria];
            const tel = p.telefono.replace(/[^\d]/g, '');
            const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(mensajeWhatsappGenerico(p))}`;
            const telUrl = `tel:${p.telefono.replace(/\s/g, '')}`;
            const reclamosActivos = reclamosActivosPorProf[p.id] ?? 0;
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
                  <div className="flex-1 min-w-0">
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
                  </div>
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

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium tabular-nums">
                      {p.rating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {p.cantTrabajos} trabajo{p.cantTrabajos === 1 ? '' : 's'}
                  </span>
                  {p.ultimoTrabajo && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate text-muted-foreground">
                        últ. {formatFecha(p.ultimoTrabajo)}
                      </span>
                    </>
                  )}
                </div>

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

  const handleSubmit = () => {
    if (!nombre.trim() || !zona.trim() || !telefono.trim()) {
      toast({ title: 'Faltan datos obligatorios', variant: 'destructive' });
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
            <Label className="text-xs">Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Categoría</Label>
            <select
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
            <Label className="text-xs">Zona</Label>
            <Input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej: Palermo, Recoleta" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9 11 …" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email (opcional)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas internas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
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
