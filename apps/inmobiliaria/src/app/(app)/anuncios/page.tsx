'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Building2,
  Check,
  Mail,
  Megaphone,
  Plus,
  Search,
  Send,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Topbar } from '@/components/topbar';
import {
  type Anuncio,
  type AudienciaAnuncio,
  type CanalAnuncio,
  type PrioridadAnuncio,
  AUDIENCIA_LABEL,
  PRIORIDAD_LABEL,
  consorciosAlcanzables,
  contarDestinatarios,
  crearAnuncio,
  eliminarAnuncio,
  inquilinosAlcanzables,
  listarAnuncios,
} from '@/lib/anuncios-storage';
import { formatFechaCorta } from '@/lib/format';

const USUARIO_ACTUAL = 'Roberto Tapia';

// Acento por prioridad: solo la barra izquierda. La card queda neutra y legible
// (antes el color tintaba todo el fondo y el texto).
const PRIORIDAD_ACCENT: Record<PrioridadAnuncio, string> = {
  NORMAL: 'border-l-border',
  IMPORTANTE: 'border-l-amber-400',
  URGENTE: 'border-l-destructive',
};

type FiltroPrioridad = PrioridadAnuncio | 'TODAS';

const FILTROS_PRIORIDAD: { value: FiltroPrioridad; label: string }[] = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'IMPORTANTE', label: 'Importante' },
  { value: 'URGENTE', label: 'Urgente' },
];

export default function AnunciosPage() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [anuncioAEliminar, setAnuncioAEliminar] = useState<Anuncio | null>(null);
  const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>('TODAS');

  useEffect(() => {
    setAnuncios(listarAnuncios());
    setHidratado(true);
  }, []);

  const stats = useMemo(() => {
    const totalDestinatarios = anuncios.reduce(
      (acc, a) => acc + a.destinatariosCount,
      0,
    );
    const ultimaSemana = anuncios.filter(
      (a) => Date.now() - Date.parse(a.enviadoAt) < 7 * 86400_000,
    ).length;
    return { total: anuncios.length, totalDestinatarios, ultimaSemana };
  }, [anuncios]);

  const conteoPorPrioridad = useMemo(() => {
    const c: Record<PrioridadAnuncio, number> = {
      NORMAL: 0,
      IMPORTANTE: 0,
      URGENTE: 0,
    };
    anuncios.forEach((a) => {
      c[a.prioridad] += 1;
    });
    return c;
  }, [anuncios]);

  const anunciosFiltrados =
    filtroPrioridad === 'TODAS'
      ? anuncios
      : anuncios.filter((a) => a.prioridad === filtroPrioridad);

  const handleCrear = (data: Omit<Anuncio, 'id' | 'enviadoAt'>) => {
    crearAnuncio(data);
    setAnuncios(listarAnuncios());
    setCrearAbierto(false);
    toast({
      variant: 'success',
      title: 'Anuncio enviado',
      description: `${data.titulo} · ${data.destinatariosCount} destinatario${data.destinatariosCount === 1 ? '' : 's'}`,
    });
  };

  const ejecutarEliminar = (a: Anuncio) => {
    eliminarAnuncio(a.id);
    setAnuncios(listarAnuncios());
    setAnuncioAEliminar(null);
    toast({ title: 'Anuncio eliminado' });
  };

  if (!hidratado) return null;

  return (
    <>
      <Topbar titulo="Anuncios" />
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Antes había un h1 "Anuncios" inline que duplicaba al h1
              del Topbar (dos H1 con el mismo texto en la misma página
              = anti-patrón de accesibilidad). Lo sacamos: dejamos solo
              la descripción para no perder el contexto del propósito. */}
          <div>
            <p className="text-sm text-muted-foreground">
              Comunicaciones masivas a inquilinos, propietarios y consorcios.
            </p>
          </div>
          <Button onClick={() => setCrearAbierto(true)}>
            <Plus className="h-4 w-4" />
            Nuevo anuncio
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Megaphone className="h-4 w-4" />
                <p className="text-xs">Anuncios enviados</p>
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {stats.total}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <p className="text-xs">Destinatarios totales</p>
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {stats.totalDestinatarios}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bell className="h-4 w-4" />
                <p className="text-xs">Última semana</p>
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {stats.ultimaSemana}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro por la prioridad con la que se lanzó el anuncio. */}
        {anuncios.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS_PRIORIDAD.map((f) => {
              const activo = filtroPrioridad === f.value;
              const count =
                f.value === 'TODAS'
                  ? anuncios.length
                  : conteoPorPrioridad[f.value];
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setFiltroPrioridad(f.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    activo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  {f.label}
                  <span
                    className={`tabular-nums ${activo ? 'opacity-90' : 'text-muted-foreground'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {anuncios.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 font-medium text-foreground">
                Todavía no mandaste anuncios
              </p>
              <p>
                Usá los anuncios para corte de agua, cambio de CBU, asambleas o
                recordatorios masivos.
              </p>
            </CardContent>
          </Card>
        ) : anunciosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No hay anuncios con prioridad{' '}
              {PRIORIDAD_LABEL[filtroPrioridad as PrioridadAnuncio].toLowerCase()}.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {anunciosFiltrados.map((a) => (
              <AnuncioCard
                key={a.id}
                anuncio={a}
                onEliminar={() => setAnuncioAEliminar(a)}
              />
            ))}
          </div>
        )}
      </main>

      <CrearAnuncioDialog
        abierto={crearAbierto}
        onClose={() => setCrearAbierto(false)}
        onGuardar={handleCrear}
      />
      {/* Confirmación antes de eliminar — antes el Trash2 borraba al instante.
          Un clic accidental no se podía deshacer y el operador tenía que
          volver a redactar el anuncio completo. */}
      <ConfirmDialog
        open={anuncioAEliminar !== null}
        onOpenChange={(o) => !o && setAnuncioAEliminar(null)}
        title="¿Eliminar este anuncio?"
        description={
          anuncioAEliminar
            ? `"${anuncioAEliminar.titulo}" se va a borrar permanentemente. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => { if (anuncioAEliminar) ejecutarEliminar(anuncioAEliminar); }}
      />
    </>
  );
}

function AnuncioCard({
  anuncio,
  onEliminar,
}: {
  anuncio: Anuncio;
  onEliminar: () => void;
}) {
  const esNormal = anuncio.prioridad === 'NORMAL';
  return (
    <Card
      className={`border-l-4 transition-colors hover:bg-muted/30 ${PRIORIDAD_ACCENT[anuncio.prioridad]}`}
    >
      <CardContent className="space-y-2.5 p-4">
        {/* Encabezado: título + prioridad (solo si no es Normal) + eliminar */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-semibold">{anuncio.titulo}</h3>
              {!esNormal && (
                <Badge
                  variant={anuncio.prioridad === 'URGENTE' ? 'destructive' : 'warning'}
                  className="shrink-0 text-[10px]"
                >
                  {PRIORIDAD_LABEL[anuncio.prioridad]}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            onClick={onEliminar}
            aria-label={`Eliminar anuncio "${anuncio.titulo}"`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Cuerpo (recortado a 2 líneas para escanear la lista) */}
        <p className="line-clamp-2 text-sm text-muted-foreground">{anuncio.cuerpo}</p>

        {/* Pie: a quién llegó · canales · quién lo envió y cuándo */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>{AUDIENCIA_LABEL[anuncio.audiencia]}</span>
            <span className="font-medium text-foreground">
              · {anuncio.destinatariosCount} destinatario
              {anuncio.destinatariosCount === 1 ? '' : 's'}
            </span>
          </span>
          <span className="ml-auto whitespace-nowrap">
            {anuncio.enviadoPor} · {formatFechaCorta(anuncio.enviadoAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface DialogProps {
  abierto: boolean;
  onClose: () => void;
  onGuardar: (data: Omit<Anuncio, 'id' | 'enviadoAt'>) => void;
}

function CrearAnuncioDialog({ abierto, onClose, onGuardar }: DialogProps) {
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadAnuncio>('NORMAL');
  const [audiencia, setAudiencia] = useState<AudienciaAnuncio>('TODOS_INQUILINOS');
  const [consorcioSel, setConsorcioSel] = useState('');
  const [contratosSel, setContratosSel] = useState<string[]>([]);
  const [buscarContrato, setBuscarContrato] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTitulo('');
    setCuerpo('');
    setPrioridad('NORMAL');
    setAudiencia('TODOS_INQUILINOS');
    setConsorcioSel('');
    setContratosSel([]);
    setBuscarContrato('');
    setConfirmando(false);
  }, [abierto]);

  const consorcios = consorciosAlcanzables();
  const contratos = inquilinosAlcanzables();
  const qContrato = buscarContrato.trim().toLowerCase();
  const contratosFiltrados = qContrato
    ? contratos.filter(
        (c) =>
          c.inquilino.toLowerCase().includes(qContrato) ||
          c.direccion.toLowerCase().includes(qContrato),
      )
    : contratos;

  // Todo anuncio se envía siempre por app y email.
  const canales: CanalAnuncio[] = ['APP', 'EMAIL'];
  // Sub-selección que aplica según la audiencia elegida.
  const audienciaIds =
    audiencia === 'INQUILINOS_CONSORCIO'
      ? consorcioSel
        ? [consorcioSel]
        : []
      : audiencia === 'CONTRATOS_ESPECIFICOS'
        ? contratosSel
        : [];
  const destinatarios = contarDestinatarios(audiencia, audienciaIds);

  const revisar = () => {
    if (!titulo.trim() || !cuerpo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Cargá título y cuerpo del anuncio.',
      });
      return;
    }
    if (audiencia === 'INQUILINOS_CONSORCIO' && !consorcioSel) {
      toast({ variant: 'destructive', title: 'Elegí un consorcio' });
      return;
    }
    if (audiencia === 'CONTRATOS_ESPECIFICOS' && contratosSel.length === 0) {
      toast({ variant: 'destructive', title: 'Elegí al menos un contrato' });
      return;
    }
    if (destinatarios === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin destinatarios',
        description: 'Esta audiencia no alcanza a nadie por ahora.',
      });
      return;
    }
    // Comunicación masiva sin "deshacer": confirmamos alcance antes de enviar.
    setConfirmando(true);
  };

  const enviar = () => {
    onGuardar({
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      prioridad,
      audiencia,
      audienciaIds,
      canales,
      enviadoPor: USUARIO_ACTUAL,
      destinatariosCount: destinatarios,
    });
  };

  return (
    <>
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo anuncio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="t" aria-required>
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="t"
              placeholder="Ej. Corte de agua jueves 30/05"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu" aria-required>
              Cuerpo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cu"
              rows={4}
              placeholder="Detalle del anuncio…"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prio">Prioridad</Label>
              <Select
                value={prioridad}
                onValueChange={(v) => setPrioridad(v as PrioridadAnuncio)}
              >
                <SelectTrigger id="prio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="IMPORTANTE">Importante</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aud">Audiencia</Label>
              <Select
                value={audiencia}
                onValueChange={(v) => {
                  setAudiencia(v as AudienciaAnuncio);
                  setConsorcioSel('');
                  setContratosSel([]);
                  setBuscarContrato('');
                }}
              >
                <SelectTrigger id="aud">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUDIENCIA_LABEL) as AudienciaAnuncio[]).map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCIA_LABEL[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Sub-selección: completa los presets que piden elegir cuál/cuáles. */}
          {audiencia === 'INQUILINOS_CONSORCIO' && (
            <div className="space-y-1.5">
              <Label htmlFor="cons">Consorcio</Label>
              <Select value={consorcioSel} onValueChange={setConsorcioSel}>
                <SelectTrigger id="cons">
                  <SelectValue placeholder="Elegí un consorcio…" />
                </SelectTrigger>
                <SelectContent>
                  {consorcios.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {audiencia === 'CONTRATOS_ESPECIFICOS' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Contratos</Label>
                <span className="text-xs text-muted-foreground">
                  {contratosSel.length} seleccionado
                  {contratosSel.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscarContrato}
                  onChange={(e) => setBuscarContrato(e.target.value)}
                  placeholder="Buscar por inquilino o dirección…"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border p-1">
                {contratosFiltrados.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    Sin resultados
                  </p>
                )}
                {contratosFiltrados.map((c) => {
                  const sel = contratosSel.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={sel}
                      onClick={() =>
                        setContratosSel((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((x) => x !== c.id)
                            : [...prev, c.id],
                        )
                      }
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                        sel ? 'bg-primary/10' : 'hover:bg-muted/40'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          sel
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input'
                        }`}
                      >
                        {sel && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {c.inquilino}
                        <span className="text-muted-foreground"> · {c.direccion}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Alcance en vivo: a cuántos llega según la audiencia elegida. */}
          <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Llega a{' '}
              <strong className="text-foreground tabular-nums">{destinatarios}</strong>{' '}
              destinatarios · {AUDIENCIA_LABEL[audiencia]}
            </span>
          </div>

          {/* Todo anuncio se envía siempre por app y email. */}
          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Cómo se envía</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <Smartphone className="h-4 w-4 shrink-0 text-primary" />
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                Por <strong className="text-foreground">app</strong> y{' '}
                <strong className="text-foreground">email</strong>
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={revisar}>
              <Send className="h-4 w-4" />
              Revisar y enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title="¿Enviar el anuncio?"
        description={`Vas a avisar a ${destinatarios} destinatarios (${AUDIENCIA_LABEL[audiencia].toLowerCase()}) por app y email. Esto no se puede deshacer.`}
        confirmLabel={`Enviar a ${destinatarios}`}
        onConfirm={enviar}
      />
    </>
  );
}
