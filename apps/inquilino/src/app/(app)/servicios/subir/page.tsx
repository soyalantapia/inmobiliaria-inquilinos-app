'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, ImageIcon, Plus, Upload } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import {
  type TipoServicio,
  TAMANIO_MAX,
  TIPO_LABEL,
  formatPeriodo,
  formatTamanio,
  leerArchivoComoDataUrl,
} from '@/lib/boletas-servicios-storage';
import { useBoletas } from '@/lib/api/use-servicios';
import { apiEnabled } from '@/lib/api/client';

const TIPOS_DISPONIBLES: TipoServicio[] = ['LUZ', 'GAS', 'AGUA', 'INTERNET', 'ABL', 'CABLE'];

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Antes "Subir boleta" era un Dialog (modal). En mobile, con tipo + período +
// vencimiento + monto + archivo, el modal superaba el alto del viewport y se
// cortaba. Ahora es una página completa con scroll natural (back-header +
// main + NavBar, igual que las demás pantallas-formulario).
export default function SubirBoletaPage() {
  const router = useRouter();
  const { subirBoleta } = useBoletas();
  const [tipo, setTipo] = useState<TipoServicio>('LUZ');
  const [periodo, setPeriodo] = useState(periodoActual());
  const [monto, setMonto] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!archivo) {
      toast({
        variant: 'destructive',
        title: 'Falta el archivo',
        description: 'Cargá la foto o PDF de la boleta antes de continuar.',
      });
      return;
    }
    if (archivo.size > TAMANIO_MAX) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: `Probá con uno de hasta ${formatTamanio(TAMANIO_MAX)}.`,
      });
      return;
    }
    if (!monto || parseInt(monto, 10) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Falta el monto',
        description: 'Indicá cuánto da el total de la boleta.',
      });
      return;
    }
    setEnviando(true);
    try {
      // En demo necesitamos el dataUrl para previsualizar/descargar offline.
      // En prod el archivo no se sube todavía (no hay storage en el API) —
      // solo mandamos los metadatos, así que evitamos leer el archivo entero.
      const dataUrl = apiEnabled ? undefined : await leerArchivoComoDataUrl(archivo);
      await subirBoleta({
        servicio: tipo,
        periodo,
        monto: parseInt(monto, 10),
        vencimiento: vencimiento || undefined,
        nombreArchivo: archivo.name,
        tipoMime: archivo.type || 'application/octet-stream',
        tamanioBytes: archivo.size,
        dataUrl,
      });
      toast({
        variant: 'success',
        title: 'Boleta subida',
        description: `${TIPO_LABEL[tipo]} · ${formatPeriodo(periodo)}`,
      });
      router.push('/servicios');
    } catch {
      toast({
        variant: 'destructive',
        title: 'No pudimos subir la boleta',
        description: 'Revisá tu conexión e intentá de nuevo.',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/servicios" aria-label="Volver a Servicios">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Servicios</p>
          <h1 className="text-xl font-semibold md:text-2xl">Subir boleta</h1>
        </div>
      </header>

      <main className="flex-1 px-5 pb-44 md:px-8 md:pb-8">
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de servicio</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoServicio)}>
              <SelectTrigger id="tipo" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DISPONIBLES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="periodo">Período</Label>
              <Input
                id="periodo"
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venc">Vencimiento</Label>
              <Input
                id="venc"
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto total (ARS)</Label>
            <Input
              id="monto"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Ej. 32400"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-archivo">Archivo de la boleta</Label>
            <input
              id="svc-archivo"
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start"
              onClick={() => fileRef.current?.click()}
            >
              {archivo ? (
                <>
                  {archivo.type.startsWith('image/') ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span className="truncate text-xs">{archivo.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {formatTamanio(archivo.size)}
                  </span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Elegir foto o PDF
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Hasta {formatTamanio(TAMANIO_MAX)} · acepta JPG, PNG, PDF.
            </p>
          </div>

          <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t bg-background/95 px-5 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:pt-2 md:shadow-none md:backdrop-blur-none">
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link href="/servicios">Cancelar</Link>
            </Button>
            <Button type="submit" className="flex-1" disabled={enviando}>
              <Upload className="h-4 w-4" />
              {enviando ? 'Subiendo…' : 'Subir'}
            </Button>
          </div>
        </form>
      </main>

      <NavBar />
    </>
  );
}
