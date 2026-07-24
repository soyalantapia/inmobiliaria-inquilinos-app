'use client';

/**
 * Alta de reclamo POR LA INMOBILIARIA (en nombre del inquilino). Camila: las quejas
 * llegan por WhatsApp/teléfono a la oficina, no por la app, y "la chica se olvida" de
 * cargarlas → vivían en un Excel paralelo. Este dialog las mete en la bandeja de
 * reclamos (POST /reclamos), dejando registrado por qué canal llegaron.
 */
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled, apiFetch, ApiError, subirArchivo, urlDeArchivo } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { useContratos } from '@/lib/api/hooks';

const CATEGORIAS = [
  { v: 'PLOMERIA', l: 'Plomería' },
  { v: 'ELECTRICIDAD', l: 'Electricidad' },
  { v: 'CERRADURA', l: 'Cerradura' },
  { v: 'CALEFACCION', l: 'Calefacción' },
  { v: 'OTRO', l: 'Otro' },
] as const;

const URGENCIAS = [
  { v: 'BAJA', l: 'Baja' },
  { v: 'MEDIA', l: 'Media' },
  { v: 'ALTA', l: 'Alta' },
  { v: 'EMERGENCIA', l: 'Emergencia' },
] as const;

const CANALES = [
  { v: 'WHATSAPP', l: 'WhatsApp' },
  { v: 'TELEFONO', l: 'Teléfono' },
  { v: 'PRESENCIAL', l: 'Presencial' },
  { v: 'EMAIL', l: 'Email' },
  { v: 'OTRO', l: 'Otro' },
] as const;

export function NuevoReclamoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { contratos, cargando } = useContratos();
  const activos = useMemo(() => contratos.filter((c) => c.estado === 'ACTIVO'), [contratos]);

  const [contratoId, setContratoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<string>('PLOMERIA');
  const [urgencia, setUrgencia] = useState<string>('MEDIA');
  const [canal, setCanal] = useState<string>('WHATSAPP');
  // La foto que el inquilino manda por WhatsApp: la empleada la adjunta acá para
  // que quede de respaldo y la vean el inquilino (en su app) y el profesional.
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const valido = !!contratoId && titulo.trim().length >= 3 && descripcion.trim().length >= 5;

  const reset = () => {
    setContratoId('');
    setTitulo('');
    setDescripcion('');
    setCategoria('PLOMERIA');
    setUrgencia('MEDIA');
    setCanal('WHATSAPP');
    setFotoUrl(null);
    setSubiendoFoto(false);
  };

  const cerrar = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    try {
      await ensureApiSession();
      await apiFetch('/reclamos', {
        method: 'POST',
        body: JSON.stringify({
          contratoId,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          categoria,
          urgencia,
          canal,
          ...(fotoUrl ? { fotoUrl } : {}),
        }),
      });
      await qc.invalidateQueries({ queryKey: ['reclamos'] });
      toast({
        variant: 'success',
        title: 'Reclamo cargado',
        description: 'Quedó en la bandeja, en Abiertos.',
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo cargar el reclamo',
        description: e instanceof ApiError ? e.message : 'Reintentá en un momento.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar un reclamo</DialogTitle>
          <DialogDescription>
            Para cuando el inquilino te lo pasa por WhatsApp o teléfono y lo cargás vos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec-contrato">
              Contrato / inquilino <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Select value={contratoId} onValueChange={setContratoId}>
              <SelectTrigger id="rec-contrato">
                <SelectValue placeholder={cargando ? 'Cargando contratos…' : 'Elegí el contrato'} />
              </SelectTrigger>
              <SelectContent>
                {activos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.inquilino} · {c.direccion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!cargando && activos.length === 0 && (
              <p className="text-xs text-muted-foreground">No tenés contratos activos para cargar un reclamo.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-categoria">Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger id="rec-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-urgencia">Urgencia</Label>
              <Select value={urgencia} onValueChange={setUrgencia}>
                <SelectTrigger id="rec-urgencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCIAS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-canal">Llegó por</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger id="rec-canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANALES.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-titulo">
              Título <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="rec-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Pérdida de agua en la cocina"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-descripcion">
              Descripción <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rec-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué pasó, desde cuándo, y cualquier dato que te haya pasado el inquilino."
              rows={4}
            />
          </div>

          {/* Foto (opcional): la que el inquilino te pasó por WhatsApp. Uploads solo
              en prod; la demo no tiene backend de archivos. */}
          {apiEnabled && (
            <div className="space-y-1.5">
              <Label htmlFor="rec-foto">Foto (opcional)</Label>
              {fotoUrl ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlDeArchivo(fotoUrl)}
                    alt="Foto del reclamo"
                    className="h-14 w-14 shrink-0 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    Foto adjunta — la va a ver el inquilino en su app.
                  </span>
                  <button
                    type="button"
                    onClick={() => setFotoUrl(null)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Quitar foto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span>{subiendoFoto ? 'Subiendo…' : 'Adjuntar la foto que te mandó el inquilino'}</span>
                  <input
                    id="rec-foto"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={subiendoFoto}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSubiendoFoto(true);
                      try {
                        const { url } = await subirArchivo(file);
                        setFotoUrl(url);
                      } catch (err) {
                        toast({
                          variant: 'destructive',
                          title: 'No se pudo subir la foto',
                          description: err instanceof ApiError ? err.message : 'Reintentá en un momento.',
                        });
                      } finally {
                        setSubiendoFoto(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => cerrar(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!valido || guardando || subiendoFoto}>
            {guardando ? 'Guardando…' : 'Cargar reclamo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
