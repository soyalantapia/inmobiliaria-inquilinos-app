'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
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
  const [filtroTipo, setFiltroTipo] = useState<TipoServicio | 'TODOS'>('TODOS');

  useEffect(() => {
    setBoletas(listarBoletasDe(contratoMock.id));
    setHidratado(true);
  }, []);

  // Cálculos derivados — todos en un memo bloque para que no se desperdiguen.
  const stats = useMemo(() => {
    const pagadas = boletas.filter((b) => b.estado === 'PAGADA');
    const sinPagar = boletas.filter((b) => b.estado !== 'PAGADA');
    const totalPagadoAnio = pagadas.reduce((acc, b) => acc + b.monto, 0);
    const periodoCorr = periodoActual();
    const totalEsteMes = boletas
      .filter((b) => b.periodo === periodoCorr)
      .reduce((acc, b) => acc + b.monto, 0);
    return { pagadas, sinPagar, totalPagadoAnio, totalEsteMes };
  }, [boletas]);

  // Próxima boleta a vencer entre las no pagadas — para el banner de alerta.
  const proximaAVencer = useMemo(() => {
    const futuras = stats.sinPagar
      .map((b) => ({
        b,
        dias: Math.ceil(
          (new Date(b.vencimiento).getTime() - Date.now()) / 86400000,
        ),
      }))
      .filter(({ dias }) => dias <= 7)
      .sort((a, b) => a.dias - b.dias);
    return futuras[0] ?? null;
  }, [stats.sinPagar]);

  // Tipos presentes en las boletas — para mostrar solo chips relevantes en
  // el filtro (no tiene sentido un chip "Cable" si nunca subiste una).
  const tiposPresentes = useMemo(() => {
    return Array.from(new Set(boletas.map((b) => b.tipo)));
  }, [boletas]);

  // Aplicar filtro de tipo.
  const filtrarPorTipo = (lista: BoletaServicio[]) =>
    filtroTipo === 'TODOS' ? lista : lista.filter((b) => b.tipo === filtroTipo);
  const sinPagarFiltrado = filtrarPorTipo(stats.sinPagar);
  const pagadasFiltrado = filtrarPorTipo(stats.pagadas);

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

        {/* Alerta de boleta próxima a vencer (≤ 7 días, no pagada).
            Va arriba de las stats para que el inquilino la vea apenas entra. */}
        {proximaAVencer && (
          <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10">
            <CardContent className="flex items-start gap-3 p-3 text-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  Tu boleta de {TIPO_LABEL[proximaAVencer.b.tipo]} vence{' '}
                  {proximaAVencer.dias < 0
                    ? `hace ${Math.abs(proximaAVencer.dias)} día${Math.abs(proximaAVencer.dias) === 1 ? '' : 's'}`
                    : proximaAVencer.dias === 0
                      ? 'hoy'
                      : `en ${proximaAVencer.dias} día${proximaAVencer.dias === 1 ? '' : 's'}`}
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  {formatMonto(proximaAVencer.b.monto)} ·{' '}
                  {formatFecha(proximaAVencer.b.vencimiento)} · cuando la
                  pagues marcala como paga.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats — 3 cards.
            "Este mes" = suma de boletas del periodo corriente (luz+gas+agua+...).
            "Este año" = solo pagadas. "Sin pagar" = boletas SUBIDA/EN_REVISION.
            En 320px una de las labels se envuelve a 2 líneas — usamos
            flex+justify-between para que los valores queden bottom-aligned y
            las cards mantengan misma altura visual. */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="h-full">
            <CardContent className="flex h-full flex-col justify-between gap-1 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Este mes
              </p>
              <p className="text-base font-semibold tabular-nums">
                {formatMonto(stats.totalEsteMes)}
              </p>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col justify-between gap-1 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Pagaste este año
              </p>
              <p className="text-base font-semibold tabular-nums">
                {formatMonto(stats.totalPagadoAnio)}
              </p>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col justify-between gap-1 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Sin pagar
              </p>
              <p
                className={`text-base font-semibold tabular-nums ${
                  stats.sinPagar.length > 0 ? 'text-amber-600' : ''
                }`}
              >
                {stats.sinPagar.length}
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

        {/* Filtros por tipo de servicio — solo si hay >5 boletas en total
            (para historiales chicos no agregan valor). */}
        {boletas.length > 5 && tiposPresentes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <FiltroChip
              activo={filtroTipo === 'TODOS'}
              onClick={() => setFiltroTipo('TODOS')}
            >
              Todos
            </FiltroChip>
            {tiposPresentes.map((t) => (
              <FiltroChip
                key={t}
                activo={filtroTipo === t}
                onClick={() => setFiltroTipo(t)}
              >
                {TIPO_LABEL[t]}
              </FiltroChip>
            ))}
          </div>
        )}

        {boletas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-9 w-9" />
              Todavía no subiste boletas. Tocá «Subir nueva boleta» cuando te
              llegue la primera.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Sin pagar — sección destacada arriba */}
            {sinPagarFiltrado.length > 0 && (
              <BoletasSection
                titulo="Sin pagar"
                contador={sinPagarFiltrado.length}
                accent
                boletas={sinPagarFiltrado}
                onMarcarPagada={marcarPagada}
                onEliminar={setEliminar}
              />
            )}

            {/* Pagadas — historial archivado */}
            {pagadasFiltrado.length > 0 && (
              <BoletasSection
                titulo="Pagadas"
                contador={pagadasFiltrado.length}
                boletas={pagadasFiltrado}
                onMarcarPagada={marcarPagada}
                onEliminar={setEliminar}
              />
            )}

            {/* Empty state cuando el filtro no matchea nada */}
            {sinPagarFiltrado.length === 0 && pagadasFiltrado.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No hay boletas de {TIPO_LABEL[filtroTipo as TipoServicio] ?? 'ese tipo'}.
                </CardContent>
              </Card>
            )}
          </>
        )}
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

// ============================================================
// BoletasSection — render de una sección de boletas (Sin pagar / Pagadas)
// ============================================================
function BoletasSection({
  titulo,
  contador,
  boletas,
  accent,
  onMarcarPagada,
  onEliminar,
}: {
  titulo: string;
  contador: number;
  boletas: BoletaServicio[];
  accent?: boolean;
  onMarcarPagada: (b: BoletaServicio) => void;
  onEliminar: (b: BoletaServicio) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h2>
        <span
          className={`text-xs ${accent ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}
        >
          ({contador})
        </span>
      </div>
      <Card>
        <ul className="divide-y">
          {boletas.map((b) => (
            <BoletaRow
              key={b.id}
              boleta={b}
              onMarcarPagada={onMarcarPagada}
              onEliminar={onEliminar}
            />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function BoletaRow({
  boleta: b,
  onMarcarPagada,
  onEliminar,
}: {
  boleta: BoletaServicio;
  onMarcarPagada: (b: BoletaServicio) => void;
  onEliminar: (b: BoletaServicio) => void;
}) {
  const Icon = ICONO_TIPO[b.tipo];
  const esImagen = b.tipoMime.startsWith('image/');
  const sinPagar = b.estado !== 'PAGADA';
  return (
    <li className="flex items-start gap-3 p-3 text-sm">
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
          <Badge variant={ESTADO_VARIANT[b.estado]} className="text-[10px]">
            {ESTADO_LABEL[b.estado]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatMonto(b.monto)} · vence {formatFecha(b.vencimiento)}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {b.nombreArchivo} · {formatTamanio(b.tamanioBytes)}
          {b.pagadoAt && <span> · Pagada {formatFecha(b.pagadoAt)}</span>}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {/* Copy más claro: "Ya pagué" en vez de "Pagué".
            Comunica que la acción es marcar como paga, no pagar acá. */}
        {sinPagar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarcarPagada(b)}
            title="Marcar como paga"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[10px]">Ya pagué</span>
          </Button>
        )}
        <div className="flex gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href={b.dataUrl} download={b.nombreArchivo} aria-label="Descargar">
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEliminar(b)}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function FiltroChip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        activo
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent'
      }`}
    >
      {children}
    </button>
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
