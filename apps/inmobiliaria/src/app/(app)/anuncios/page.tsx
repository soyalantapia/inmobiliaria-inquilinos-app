'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Building2,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
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
import { Topbar } from '@/components/topbar';
import {
  type Anuncio,
  type AudienciaAnuncio,
  type CanalAnuncio,
  type PrioridadAnuncio,
  AUDIENCIA_LABEL,
  PRIORIDAD_COLOR,
  PRIORIDAD_LABEL,
  crearAnuncio,
  eliminarAnuncio,
  listarAnuncios,
} from '@/lib/anuncios-storage';
import { formatFechaCorta } from '@/lib/format';

const USUARIO_ACTUAL = 'Roberto Tapia';

const CANAL_ICONO: Record<CanalAnuncio, typeof Smartphone> = {
  APP: Smartphone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
};

export default function AnunciosPage() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);

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

  const handleEliminar = (a: Anuncio) => {
    eliminarAnuncio(a.id);
    setAnuncios(listarAnuncios());
    toast({ title: 'Anuncio eliminado' });
  };

  if (!hidratado) return null;

  return (
    <>
      <Topbar titulo="Anuncios" />
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Anuncios</h1>
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
        ) : (
          <div className="space-y-3">
            {anuncios.map((a) => (
              <AnuncioCard
                key={a.id}
                anuncio={a}
                onEliminar={() => handleEliminar(a)}
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
  return (
    <Card className={`border-l-4 ${PRIORIDAD_COLOR[anuncio.prioridad]}`}>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold">{anuncio.titulo}</p>
              <Badge
                variant={
                  anuncio.prioridad === 'URGENTE'
                    ? 'destructive'
                    : anuncio.prioridad === 'IMPORTANTE'
                      ? 'warning'
                      : 'outline'
                }
                className="text-[9px]"
              >
                {PRIORIDAD_LABEL[anuncio.prioridad]}
              </Badge>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {anuncio.cuerpo}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEliminar}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {AUDIENCIA_LABEL[anuncio.audiencia]} · {anuncio.destinatariosCount}{' '}
          destinatarios
          <span>·</span>
          {anuncio.canales.map((c) => {
            const Icon = CANAL_ICONO[c];
            return (
              <span
                key={c}
                className="inline-flex items-center gap-0.5 rounded-full border bg-background px-1.5 py-0.5"
              >
                <Icon className="h-2.5 w-2.5" />
                {c}
              </span>
            );
          })}
          <span>·</span>
          <span>
            Enviado por {anuncio.enviadoPor} · {formatFechaCorta(anuncio.enviadoAt)}
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
  const [canales, setCanales] = useState<CanalAnuncio[]>(['APP']);

  useEffect(() => {
    if (!abierto) return;
    setTitulo('');
    setCuerpo('');
    setPrioridad('NORMAL');
    setAudiencia('TODOS_INQUILINOS');
    setCanales(['APP']);
  }, [abierto]);

  const toggleCanal = (canal: CanalAnuncio) => {
    setCanales((prev) =>
      prev.includes(canal) ? prev.filter((c) => c !== canal) : [...prev, canal],
    );
  };

  const submit = () => {
    if (!titulo.trim() || !cuerpo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Cargá título y cuerpo del anuncio.',
      });
      return;
    }
    if (canales.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Elegí al menos un canal',
      });
      return;
    }
    const counts: Record<AudienciaAnuncio, number> = {
      TODOS_INQUILINOS: 6,
      TODOS_PROPIETARIOS: 5,
      TODOS_CONSORCIOS: 3,
      INQUILINOS_CONSORCIO: 12,
      CONTRATOS_ESPECIFICOS: 1,
    };
    onGuardar({
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      prioridad,
      audiencia,
      canales,
      enviadoPor: USUARIO_ACTUAL,
      destinatariosCount: counts[audiencia],
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo anuncio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="t">Título</Label>
            <Input
              id="t"
              placeholder="Ej. Corte de agua jueves 30/05"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu">Cuerpo</Label>
            <Textarea
              id="cu"
              rows={4}
              placeholder="Detalle del anuncio…"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
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
                onValueChange={(v) => setAudiencia(v as AudienciaAnuncio)}
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
          <div className="space-y-2">
            <Label>Canales</Label>
            <div className="flex flex-wrap gap-2">
              {(['APP', 'WHATSAPP', 'EMAIL'] as CanalAnuncio[]).map((c) => {
                const Icon = CANAL_ICONO[c];
                const activo = canales.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCanal(c)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      activo
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit}>
              <Send className="h-4 w-4" />
              Enviar anuncio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
