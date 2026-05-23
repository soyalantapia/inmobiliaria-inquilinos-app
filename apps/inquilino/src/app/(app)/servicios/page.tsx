'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Cable,
  CheckCircle2,
  Download,
  Droplets,
  FileText,
  Flame,
  ImageIcon,
  Landmark,
  Plus,
  Receipt,
  Trash2,
  Upload,
  Wifi,
  Zap,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@llave/ui/dialog';
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
  type BoletaServicio,
  type EstadoBoleta,
  type TipoServicio,
  ESTADO_LABEL,
  TAMANIO_MAX,
  TIPO_LABEL,
  eliminarBoleta,
  formatPeriodo,
  formatTamanio,
  guardarBoleta,
  leerArchivoComoDataUrl,
  listarBoletasDe,
  marcarBoletaPagada,
} from '@/lib/boletas-servicios-storage';
import { contratoMock } from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';

const ICONO_TIPO: Record<TipoServicio, typeof Zap> = {
  LUZ: Zap,
  GAS: Flame,
  AGUA: Droplets,
  INTERNET: Wifi,
  ABL: Landmark,
  CABLE: Cable,
};

const ESTADO_VARIANT: Record<
  EstadoBoleta,
  'success' | 'outline' | 'warning'
> = {
  PAGADA: 'success',
  SUBIDA: 'outline',
  EN_REVISION: 'warning',
};

const TIPOS_DISPONIBLES: TipoServicio[] = [
  'LUZ',
  'GAS',
  'AGUA',
  'INTERNET',
  'ABL',
  'CABLE',
];

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ServiciosPage() {
  const [boletas, setBoletas] = useState<BoletaServicio[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [subirAbierto, setSubirAbierto] = useState(false);
  const [eliminar, setEliminar] = useState<BoletaServicio | null>(null);

  useEffect(() => {
    setBoletas(listarBoletasDe(contratoMock.id));
    setHidratado(true);
  }, []);

  const totalPagadasMes = useMemo(() => {
    return boletas
      .filter((b) => b.estado === 'PAGADA')
      .reduce((acc, b) => acc + b.monto, 0);
  }, [boletas]);

  const pendientes = boletas.filter((b) => b.estado !== 'PAGADA');

  const onGuardada = (b: BoletaServicio) => {
    guardarBoleta(b);
    setBoletas(listarBoletasDe(contratoMock.id));
    setSubirAbierto(false);
    toast({
      variant: 'success',
      title: 'Boleta subida',
      description: `${TIPO_LABEL[b.tipo]} · ${formatPeriodo(b.periodo)}`,
    });
  };

  const marcarPagada = (b: BoletaServicio) => {
    marcarBoletaPagada(b.contratoId, b.id);
    setBoletas(listarBoletasDe(contratoMock.id));
    toast({
      variant: 'success',
      title: 'Marcado como pagado',
      description: `${TIPO_LABEL[b.tipo]} · ${formatMonto(b.monto)}`,
    });
  };

  const confirmarEliminar = () => {
    if (!eliminar) return;
    eliminarBoleta(eliminar.contratoId, eliminar.id);
    setBoletas(listarBoletasDe(contratoMock.id));
    setEliminar(null);
    toast({ title: 'Boleta eliminada' });
  };

  if (!hidratado) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/30">
        <NavBar />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 pb-16 md:pb-0">
      <main className="flex-1 space-y-5 p-4 md:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Subí las boletas de luz, gas, agua e internet. La inmobiliaria las
            ve cuando se cargan y queda el historial archivado.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Pagadas este año
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {formatMonto(totalPagadasMes)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Pendientes
              </p>
              <p
                className={`text-xl font-semibold tabular-nums ${
                  pendientes.length > 0 ? 'text-amber-600' : ''
                }`}
              >
                {pendientes.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => setSubirAbierto(true)}
        >
          <Upload className="h-4 w-4" />
          Subir nueva boleta
        </Button>

        {/* Listado */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 pb-2">
              <Receipt className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide">
                Historial
              </p>
              <span className="text-xs text-muted-foreground">
                ({boletas.length})
              </span>
            </div>
            {boletas.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                Todavía no subiste boletas. Tocá «Subir nueva boleta» cuando
                te llegue la primera.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {boletas.map((b) => {
                  const Icon = ICONO_TIPO[b.tipo];
                  const esImagen = b.tipoMime.startsWith('image/');
                  return (
                    <li
                      key={b.id}
                      className="flex items-start gap-3 p-3 text-sm"
                    >
                      {esImagen ? (
                        <img
                          src={b.dataUrl}
                          alt={b.nombreArchivo}
                          className="h-12 w-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium">
                            {TIPO_LABEL[b.tipo]} · {formatPeriodo(b.periodo)}
                          </p>
                          <Badge
                            variant={ESTADO_VARIANT[b.estado]}
                            className="text-[10px]"
                          >
                            {ESTADO_LABEL[b.estado]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMonto(b.monto)} · vence {formatFecha(b.vencimiento)}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {b.nombreArchivo} · {formatTamanio(b.tamanioBytes)}
                          {b.pagadoAt && (
                            <span> · Pagada {formatFecha(b.pagadoAt)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {b.estado !== 'PAGADA' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => marcarPagada(b)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[10px]">Pagué</span>
                          </Button>
                        )}
                        <div className="flex gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={b.dataUrl}
                              download={b.nombreArchivo}
                              aria-label="Descargar"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEliminar(b)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
      <NavBar />

      <SubirBoletaDialog
        abierto={subirAbierto}
        onClose={() => setSubirAbierto(false)}
        onGuardar={onGuardada}
      />

      <ConfirmDialog
        open={!!eliminar}
        onOpenChange={(o) => !o && setEliminar(null)}
        title="¿Eliminar boleta?"
        description={
          eliminar
            ? `${TIPO_LABEL[eliminar.tipo]} · ${formatPeriodo(eliminar.periodo)} · ${formatMonto(
                eliminar.monto,
              )}`
            : ''
        }
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmarEliminar}
      />
    </div>
  );
}

interface DialogProps {
  abierto: boolean;
  onClose: () => void;
  onGuardar: (b: BoletaServicio) => void;
}

function SubirBoletaDialog({ abierto, onClose, onGuardar }: DialogProps) {
  const [tipo, setTipo] = useState<TipoServicio>('LUZ');
  const [periodo, setPeriodo] = useState(periodoActual());
  const [monto, setMonto] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setTipo('LUZ');
    setPeriodo(periodoActual());
    setMonto('');
    setVencimiento('');
    setArchivo(null);
  }, [abierto]);

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
    try {
      const dataUrl = await leerArchivoComoDataUrl(archivo);
      onGuardar({
        id: `bol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        contratoId: contratoMock.id,
        tipo,
        periodo,
        monto: parseInt(monto, 10),
        vencimiento: vencimiento || new Date().toISOString().slice(0, 10),
        estado: 'SUBIDA',
        nombreArchivo: archivo.name,
        tipoMime: archivo.type || 'application/octet-stream',
        tamanioBytes: archivo.size,
        dataUrl,
        subidoAt: new Date().toISOString(),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No pudimos leer el archivo',
        description: 'Intentá con otro o achicalo y volvé a probar.',
      });
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir boleta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de servicio</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoServicio)}>
              <SelectTrigger id="tipo">
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
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venc">Vencimiento</Label>
              <Input
                id="venc"
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto total (ARS)</Label>
            <Input
              id="monto"
              type="number"
              placeholder="Ej. 32400"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Archivo de la boleta</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit}>
              <Upload className="h-4 w-4" />
              Subir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
