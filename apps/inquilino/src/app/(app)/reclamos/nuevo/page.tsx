'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Trash2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { inquilinoActual } from '@/lib/mock-data';
import { crearReclamo } from '@/lib/reclamos-storage';
import type { Categoria, Urgencia } from '@/lib/types';

const MAX_FOTO_MB = 4;

const categorias: Array<{ value: Categoria; label: string; emoji: string }> = [
  { value: 'PLOMERIA', label: 'Plomería', emoji: '🚰' },
  { value: 'ELECTRICIDAD', label: 'Electricidad', emoji: '💡' },
  { value: 'CERRADURA', label: 'Cerradura', emoji: '🔑' },
  { value: 'CALEFACCION', label: 'Calefacción / aire', emoji: '🔥' },
  { value: 'OTRO', label: 'Otro', emoji: '🛠️' },
];

const urgencias: Array<{ value: Urgencia; label: string; descripcion: string }> = [
  { value: 'BAJA', label: 'Puede esperar', descripcion: 'No urge, podés resolverlo cuando puedas' },
  { value: 'MEDIA', label: 'Esta semana', descripcion: 'Me molesta pero no es grave' },
  { value: 'ALTA', label: 'Urgente', descripcion: 'Necesito una solución hoy o mañana' },
  { value: 'EMERGENCIA', label: 'Emergencia', descripcion: 'Hay riesgo o no puedo vivir así' },
];

export default function NuevoReclamoPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [urgencia, setUrgencia] = useState<Urgencia | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleFoto = (file: File) => {
    setErrorFoto(null);
    if (!file.type.startsWith('image/')) {
      setErrorFoto('Solo aceptamos imágenes (JPG o PNG).');
      return;
    }
    const mb = file.size / 1024 / 1024;
    if (mb > MAX_FOTO_MB) {
      setErrorFoto(`Pesa ${mb.toFixed(1)} MB. Máximo ${MAX_FOTO_MB} MB.`);
      return;
    }
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const limpiarFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    setErrorFoto(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const enviar = async () => {
    if (!categoria || !urgencia || descripcion.trim().length < 10) return;
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 400));
    const nuevo = crearReclamo({
      inquilino: inquilinoActual.nombre,
      contratoId: inquilinoActual.contratoId,
      direccion: inquilinoActual.direccion,
      categoria,
      descripcion: descripcion.trim(),
      urgencia,
      fotoDataUrl: fotoPreview,
    });
    setEnviando(false);
    toast({
      title: 'Reclamo enviado',
      description: 'La inmobiliaria ya lo tiene. Te avisamos cuando lo tomen.',
    });
    router.push(`/reclamos/${nuevo.id}`);
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <Link href="/reclamos" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Nuevo reclamo</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        <div className="space-y-2">
          <Label>¿De qué se trata?</Label>
          <div className="grid grid-cols-2 gap-2">
            {categorias.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategoria(c.value)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                  categoria === c.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Contanos un poco</Label>
          <Textarea
            id="desc"
            placeholder="Ej: Pierde la canilla del baño desde anoche."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {descripcion.length < 10
              ? `Mínimo 10 caracteres (te faltan ${10 - descripcion.length})`
              : 'Listo'}
          </p>
        </div>

        {fotoPreview ? (
          <Card className="space-y-2 border-dashed p-3">
            <img
              src={fotoPreview}
              alt="Foto del reclamo"
              className="max-h-72 w-full rounded-md object-contain"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{fotoFile?.name}</span>
              <Button size="sm" variant="ghost" onClick={limpiarFoto}>
                <Trash2 className="h-3.5 w-3.5" />
                Cambiar
              </Button>
            </div>
          </Card>
        ) : (
          <label
            htmlFor="foto"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40"
          >
            <Camera className="h-5 w-5 text-primary" />
            <div>
              <p>Subí una foto (opcional)</p>
              <p className="text-xs">JPG o PNG · hasta {MAX_FOTO_MB} MB</p>
            </div>
            <input
              ref={fileRef}
              id="foto"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFoto(f);
              }}
            />
          </label>
        )}
        {errorFoto && <p className="text-xs text-destructive">{errorFoto}</p>}

        <div className="space-y-2">
          <Label>Urgencia</Label>
          <Select value={urgencia} onValueChange={(v) => setUrgencia(v as Urgencia)}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí cuán urgente es" />
            </SelectTrigger>
            <SelectContent>
              {urgencias.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.label}</span>
                    <span className="text-xs text-muted-foreground">{u.descripcion}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="xl"
          className="w-full"
          disabled={!categoria || !urgencia || descripcion.trim().length < 10 || enviando}
          onClick={enviar}
        >
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </Button>
      </main>
      <NavBar />
    </>
  );
}
