'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Percent,
  Plus,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
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
import { toast } from '@llave/ui/use-toast';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { Topbar } from '@/components/topbar';
import {
  type CategoriaGasto,
  type MovimientoCaja,
  categoriaGastoLabel,
} from '@/lib/caja-storage';
import { useCaja, usePropiedades } from '@/lib/api/hooks';
import { useCierreCaja } from '@/lib/api/use-pagos';
import { apiEnabled } from '@/lib/api/client';
import { formatFechaCorta, formatMonto } from '@/lib/format';
import { propiedadesMock } from '@/lib/mock-data';

/** Opción mínima de propiedad para el select/filtros de caja. */
interface PropiedadOpcion {
  id: string;
  direccion: string;
  contratoActualId: string | null;
}

export default function CajaPage() {
  const { movimientos, crearGasto, eliminarGasto, refrescar } = useCaja();
  // En prod las propiedades salen del API real (usePropiedades): así el select
  // y los chips usan ids/direcciones/contratoActualId reales y el alta de gasto
  // NO postea un propiedadId mock (FK rota). En demo seguimos con el mock.
  const { propiedades } = usePropiedades();
  const opcionesProp: PropiedadOpcion[] = apiEnabled
    ? propiedades.map((p) => ({
        id: p.propiedad.id,
        direccion: p.propiedad.direccion,
        contratoActualId: p.propiedad.contratoActualId,
      }))
    : propiedadesMock.map((p) => ({
        id: p.id,
        direccion: p.direccion,
        contratoActualId: p.contratoActualId,
      }));
  const [abrirForm, setAbrirForm] = useState(false);
  const [eliminando, setEliminando] = useState<MovimientoCaja | null>(null);
  const [filtroProp, setFiltroProp] = useState<string>('TODAS');
  const [showPin, setShowPin] = useState(false);
  const transitioningToPin = useRef(false);

  const filtrados = useMemo(() => {
    if (filtroProp === 'TODAS') return movimientos;
    return movimientos.filter((m) => m.propiedadId === filtroProp);
  }, [movimientos, filtroProp]);

  // KPIs
  const totalGastado = movimientos
    .filter((m) => m.tipo === 'GASTO')
    .reduce((acc, m) => acc + m.monto, 0);
  const pendienteDescuento = movimientos
    .filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion)
    .reduce((acc, m) => acc + m.monto, 0);
  const cantidadMov = movimientos.length;

  // Devuelve null si salió bien o el mensaje de error si el server rechazó
  // (PIN incorrecto, gasto ya rendido 409, etc.): en modo servidor el diálogo
  // de PIN lo muestra inline y queda abierto para reintentar.
  const handleEliminar = async (pin: string): Promise<string | null> => {
    if (!eliminando) return null;
    try {
      await eliminarGasto(eliminando.id, pin);
      setEliminando(null);
      toast({ title: 'Movimiento eliminado' });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'No se pudo eliminar.';
    }
  };

  return (
    <>
      <Topbar titulo="Caja" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operación
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">Caja de gastos</h1>
            <p className="text-sm text-muted-foreground">
              Gastos que pagaste por una propiedad y se descuentan de la rendición al
              propietario.
            </p>
          </div>
          <Button onClick={() => setAbrirForm(true)}>
            <Plus className="h-4 w-4" />
            Cargar gasto
          </Button>
        </div>

        {/* KPIs — solo lo del gasto a descontar (el cierre diario y la caja
            por propietario se sacaron: se pisaban con Pagos/Rendiciones y
            mareaban con tarjetas en $0). */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <p className="text-xs">Movimientos</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{cantidadMov}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              <p className="text-xs">Gastado total</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMonto(totalGastado)}
            </p>
          </Card>
          <Card className="p-4 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <ArrowDown className="h-4 w-4" />
              <p className="text-xs font-medium">A descontar en próxima rendición</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {formatMonto(pendienteDescuento)}
            </p>
          </Card>
        </div>

        {/* Cierre de caja del día (cobrado + comisión) — solo prod (data real) */}
        {apiEnabled && <CierreCajaDelDia />}

        {/* Filtro propiedad */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={filtroProp === 'TODAS'}
            onClick={() => setFiltroProp('TODAS')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              filtroProp === 'TODAS'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted/40',
            )}
          >
            Todas las propiedades
          </button>
          {opcionesProp.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={filtroProp === p.id}
              onClick={() => setFiltroProp(p.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filtroProp === p.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              {p.direccion.split(',')[0]}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtrados.length === 0 ? (
          <Card className="p-8 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">Sin movimientos</p>
            <p className="text-xs text-muted-foreground">
              Cargá un gasto cuando le pagues a un proveedor por una propiedad.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtrados.map((m) => (
              <MovimientoRow
                key={m.id}
                mov={m}
                propDireccion={
                  opcionesProp.find((p) => p.id === m.propiedadId)?.direccion ?? '—'
                }
                onDelete={() => setEliminando(m)}
              />
            ))}
          </div>
        )}
      </main>

      <DialogCargarGasto
        open={abrirForm}
        onOpenChange={setAbrirForm}
        opciones={opcionesProp}
        onSubmit={async (data) => {
          // Esperamos el alta: si el server rechaza, NO cerramos ni mostramos
          // éxito (antes el `void` se tragaba el error y el toast mentía).
          try {
            await crearGasto({
              propiedadId: data.propiedadId,
              categoria: data.categoria,
              descripcion: data.descripcion,
              monto: data.monto,
              fecha: data.fecha,
              proveedor: data.proveedor,
            });
            setAbrirForm(false);
            toast({
              title: 'Gasto cargado',
              description: `Se descontará en la próxima rendición.`,
            });
          } catch (e) {
            toast({
              variant: 'destructive',
              title: 'No se pudo cargar el gasto',
              description: e instanceof Error ? e.message : 'Probá de nuevo.',
            });
          }
        }}
      />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && !transitioningToPin.current && setEliminando(null)}
        title="¿Eliminar movimiento?"
        description={eliminando?.descripcion}
        confirmLabel="Eliminar · pedir PIN"
        variant="destructive"
        onConfirm={() => {
          transitioningToPin.current = true;
          setShowPin(true);
        }}
      />

      <PinPromptDialog
        abierto={showPin}
        accion="Eliminar gasto de caja"
        subaccion={eliminando?.descripcion}
        validacion={apiEnabled ? 'servidor' : 'local'}
        onClose={() => {
          transitioningToPin.current = false;
          setShowPin(false);
        }}
        onConfirmado={(pin) => handleEliminar(pin)}
      />
    </>
  );
}

/**
 * Cierre de caja del día: lo cobrado (pagos conciliados) + la comisión de la
 * inmobiliaria, desde el API real. Solo en prod (en demo no hay backend de
 * cobranzas; antes había una versión mock que mostraba $0 y se sacó).
 */
function CierreCajaDelDia() {
  // "Hoy" en hora de Argentina (UTC-3), igual que el backend.
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [abierto, setAbierto] = useState(false);
  const { cierre, cargando } = useCierreCaja(fecha);
  const esHoy = fecha === hoy;

  const compartir = () => {
    if (!cierre || cierre.cantidad === 0) return;
    const cuando = esHoy ? 'de hoy' : `del ${fecha}`;
    const msg =
      `*Cierre de caja ${cuando}*\n` +
      `Cobrado: ${formatMonto(cierre.cobrado)}\n` +
      `Comisión (honorarios): ${formatMonto(cierre.comision)}\n` +
      `${cierre.cantidad} cobro${cierre.cantidad === 1 ? '' : 's'} conciliado${cierre.cantidad === 1 ? '' : 's'}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold">Cierre de caja del día</h2>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => setFecha(e.target.value || hoy)}
            className="h-8 w-[150px]"
            aria-label="Fecha del cierre de caja"
          />
        </div>
      </div>
      <CardContent className="p-4">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !cierre || cierre.cantidad === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cobranzas conciliadas {esHoy ? 'hoy' : 'ese día'}. Aparecen acá cuando validás
            un pago que informó el inquilino.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Cobrado
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatMonto(cierre.cobrado)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Percent className="h-3 w-3" /> Comisión
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatMonto(cierre.comision)}</p>
                <p className="text-[10px] text-muted-foreground">tus honorarios sobre el alquiler</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cobros
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{cierre.cantidad}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAbierto((v) => !v)}>
                {abierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {abierto ? 'Ocultar detalle' : 'Ver detalle'}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={compartir}>
                <MessageCircle className="h-3.5 w-3.5" />
                Compartir por WhatsApp
              </Button>
            </div>

            {abierto && (
              <div className="mt-3 space-y-2">
                {cierre.pagos.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.inquilino}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.direccion} · {p.periodo} · {p.metodo.toLowerCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatMonto(p.monto)}
                      </p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        comisión {formatMonto(p.comision)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MovimientoRow({
  mov,
  propDireccion,
  onDelete,
}: {
  mov: MovimientoCaja;
  propDireccion: string;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-start gap-3 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        <TrendingDown className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{mov.descripcion}</p>
          <Badge variant="outline" className="text-[10px]">
            {categoriaGastoLabel[mov.categoria]}
          </Badge>
          {mov.descontadoEnRendicion ? (
            <Badge variant="success" className="text-[10px]">
              Descontado
            </Badge>
          ) : (
            <Badge variant="warning" className="text-[10px]">
              Pendiente
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{propDireccion}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatFechaCorta(mov.fecha)}
          {mov.proveedor && ` · ${mov.proveedor}`} · cargó {mov.cargadoPor}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold tabular-nums text-red-600">
          −{formatMonto(mov.monto)}
        </p>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onDelete}
          aria-label="Eliminar movimiento de caja"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

function DialogCargarGasto({
  open,
  onOpenChange,
  opciones,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opciones: PropiedadOpcion[];
  onSubmit: (data: Omit<MovimientoCaja, 'id' | 'createdAt' | 'descontadoEnRendicion'>) => void | Promise<void>;
}) {
  const [propiedadId, setPropiedadId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('PLOMERIA');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [proveedor, setProveedor] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setPropiedadId('');
      setCategoria('PLOMERIA');
      setDescripcion('');
      setMonto('');
      setFecha(new Date().toISOString().slice(0, 10));
      setProveedor('');
    }
  }, [open]);

  const guardar = async () => {
    if (guardando) return;
    if (!propiedadId || !descripcion.trim() || !monto) {
      toast({
        title: 'Faltan datos',
        description: 'Propiedad, descripción y monto son obligatorios.',
        variant: 'destructive',
      });
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast({ title: 'El monto tiene que ser positivo', variant: 'destructive' });
      return;
    }
    const prop = opciones.find((p) => p.id === propiedadId);
    setGuardando(true);
    try {
      await onSubmit({
        propiedadId,
        contratoId: prop?.contratoActualId ?? null,
        tipo: 'GASTO',
        categoria,
        descripcion: descripcion.trim(),
        monto: montoNum,
        fecha,
        proveedor: proveedor.trim() || null,
        comprobante: null,
        cargadoPor: 'Roberto Tapia',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar gasto a caja</DialogTitle>
          <DialogDescription>
            Plata que adelantaste por una propiedad. Se descuenta de la próxima rendición
            al propietario.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="caj-propiedad" className="text-xs" aria-required>
              Propiedad <span className="text-destructive">*</span>
            </Label>
            <select
              id="caj-propiedad"
              value={propiedadId}
              onChange={(e) => setPropiedadId(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Elegí una propiedad…</option>
              {opciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.direccion}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="caj-categoria" className="text-xs">Categoría</Label>
              <select
                id="caj-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(categoriaGastoLabel) as CategoriaGasto[]).map((c) => (
                  <option key={c} value={c}>
                    {categoriaGastoLabel[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="caj-fecha" className="text-xs">Fecha</Label>
              <Input id="caj-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="caj-descripcion" className="text-xs" aria-required>
              Descripción <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caj-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: cambio de termotanque"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="caj-monto" className="text-xs" aria-required>
                Monto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="caj-monto"
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caj-proveedor" className="text-xs">Proveedor (opcional)</Label>
              <Input
                id="caj-proveedor"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej: Sergio Almeida"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar} disabled={guardando}>
            <Plus className="h-4 w-4" />
            {guardando ? 'Cargando…' : 'Cargar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
