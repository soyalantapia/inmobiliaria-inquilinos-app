'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Paperclip,
  Percent,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
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
import { MoneyInput } from '@/components/money-input';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { Topbar } from '@/components/topbar';
import {
  type CategoriaGasto,
  type MovimientoCaja,
  categoriaGastoLabel,
} from '@/lib/caja-storage';
import { useCaja, usePropiedades } from '@/lib/api/hooks';
import { useCierreCaja } from '@/lib/api/use-pagos';
import { apiEnabled, subirArchivo } from '@/lib/api/client';
import { formatFechaCorta, formatMonto, fechaHoyLocal } from '@/lib/format';
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

  // KPIs derivados de `filtrados` (no de `movimientos`): al activar un chip de
  // propiedad la lista se acotaba pero los KPIs seguían mostrando el total global,
  // sin coincidir con las filas visibles. Con filtroProp='TODAS', filtrados===movimientos.
  const totalGastado = filtrados
    .filter((m) => m.tipo === 'GASTO')
    .reduce((acc, m) => acc + m.monto, 0);
  const pendienteDescuento = filtrados
    .filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion)
    .reduce((acc, m) => acc + m.monto, 0);
  const cantidadMov = filtrados.length;

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
              // Antes NO se reenviaba el tipo → una "Entrada (ingreso)" se
              // guardaba como GASTO/salida. Ahora respeta lo elegido.
              tipo: data.tipo,
              categoria: data.categoria,
              descripcion: data.descripcion,
              monto: data.monto,
              fecha: data.fecha,
              proveedor: data.proveedor,
              comprobanteUrl: data.comprobante,
            });
            setAbrirForm(false);
            toast(
              data.tipo === 'INGRESO_EXTRA'
                ? { title: 'Entrada registrada', description: 'Queda como ingreso en la caja de la propiedad.' }
                : { title: 'Gasto cargado', description: 'Se descontará en la próxima rendición.' },
            );
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
          // Limpiar `eliminando` también: si no, ConfirmDialog (open={!!eliminando})
          // reaparece al cancelar el PIN.
          setEliminando(null);
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
  const hoy = fechaHoyLocal();
  const [fecha, setFecha] = useState(hoy);
  const [abierto, setAbierto] = useState(false);
  const { cierre, cargando } = useCierreCaja(fecha);
  const esHoy = fecha === hoy;

  const compartir = () => {
    if (!cierre || cierre.cantidad === 0) return;
    const cuando = esHoy ? 'de hoy' : `del ${fecha}`;
    // Con varias monedas el total plano no significa nada: exportamos el desglose.
    const lineasMonto = cierre.multiMoneda
      ? cierre.porMoneda
          .map((m) => `${m.moneda} — Cobrado: ${formatMonto(m.cobrado, m.moneda as 'ARS' | 'USD')} · Comisión: ${formatMonto(m.comision, m.moneda as 'ARS' | 'USD')}`)
          .join('\n')
      : `Cobrado: ${formatMonto(cierre.cobrado)}\n` + `Comisión (honorarios): ${formatMonto(cierre.comision)}`;
    const msg =
      `*Cierre de caja ${cuando}*\n` +
      `${lineasMonto}\n` +
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
            {/* Cobros en varias monedas: sumar ARS+USD en un total no tiene sentido,
                así que mostramos el desglose por moneda (el backend lo separa). */}
            {cierre.multiMoneda && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Cobros en varias monedas — desglose
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {cierre.porMoneda.map((m) => (
                    <div key={m.moneda} className="rounded-md bg-background/60 p-2 text-sm">
                      <p className="font-semibold">{m.moneda}</p>
                      <p className="tabular-nums text-emerald-700 dark:text-emerald-300">
                        Cobrado {formatMonto(m.cobrado, m.moneda as 'ARS' | 'USD')}
                      </p>
                      <p className="tabular-nums text-muted-foreground">
                        Comisión {formatMonto(m.comision, m.moneda as 'ARS' | 'USD')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Cobrado
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {cierre.multiMoneda ? 'ver desglose' : formatMonto(cierre.cobrado)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Percent className="h-3 w-3" /> Comisión
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {cierre.multiMoneda ? 'ver desglose' : formatMonto(cierre.comision)}
                </p>
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
  const esIngreso = mov.tipo === 'INGRESO_EXTRA';
  return (
    <Card className="flex flex-wrap items-start gap-3 p-4">
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
          esIngreso
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        }`}
      >
        {esIngreso ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{mov.descripcion}</p>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              esIngreso
                ? 'border-emerald-300 text-emerald-700 dark:border-emerald-900/40 dark:text-emerald-300'
                : 'border-red-300 text-red-700 dark:border-red-900/40 dark:text-red-300'
            }`}
          >
            {esIngreso ? 'Entrada' : 'Salida'}
          </Badge>
          {!esIngreso && (
            <Badge variant="outline" className="text-[10px]">
              {categoriaGastoLabel[mov.categoria]}
            </Badge>
          )}
          {!esIngreso &&
            (mov.descontadoEnRendicion ? (
              <Badge variant="success" className="text-[10px]">
                Descontado
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">
                Pendiente
              </Badge>
            ))}
        </div>
        <p className="truncate text-xs text-muted-foreground">{propDireccion}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatFechaCorta(mov.fecha)}
          {mov.proveedor && ` · ${mov.proveedor}`} · cargó {mov.cargadoPor}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p
          className={`text-base font-semibold tabular-nums ${
            esIngreso ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {esIngreso ? '+' : '−'}
          {formatMonto(mov.monto)}
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
  const [tipo, setTipo] = useState<'GASTO' | 'INGRESO_EXTRA'>('GASTO');
  const [propiedadId, setPropiedadId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('PLOMERIA');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [proveedor, setProveedor] = useState('');
  // Comprobante/ticket del gasto (opcional): se sube a /uploads al elegirlo y
  // queda su URL para mandarla en el alta. El backend la persiste (validada por tenant).
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const esIngreso = tipo === 'INGRESO_EXTRA';

  useEffect(() => {
    if (open) {
      setTipo('GASTO');
      setPropiedadId('');
      setCategoria('PLOMERIA');
      setDescripcion('');
      setMonto('');
      setFecha(fechaHoyLocal());
      setProveedor('');
      setComprobanteUrl(null);
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
    // El server exige descripción de al menos 3 caracteres; validamos igual acá
    // para no comerse un 400 críptico después de completar todo.
    if (descripcion.trim().length < 3) {
      toast({
        title: 'Descripción muy corta',
        description: 'Contá en pocas palabras de qué es el movimiento (mínimo 3 caracteres).',
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
        tipo,
        categoria,
        descripcion: descripcion.trim(),
        monto: montoNum,
        fecha,
        proveedor: proveedor.trim() || null,
        comprobante: comprobanteUrl,
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
          <DialogTitle>Cargar movimiento a caja</DialogTitle>
          <DialogDescription>
            {esIngreso
              ? 'Entrada: plata que ingresó por una propiedad (ej. un reintegro del propietario).'
              : 'Salida: plata que adelantaste por una propiedad. Se descuenta de la próxima rendición al propietario.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('GASTO')}
              aria-pressed={!esIngreso}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                !esIngreso
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300'
                  : 'hover:bg-muted/40'
              }`}
            >
              ↓ Salida (gasto)
            </button>
            <button
              type="button"
              onClick={() => setTipo('INGRESO_EXTRA')}
              aria-pressed={esIngreso}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                esIngreso
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300'
                  : 'hover:bg-muted/40'
              }`}
            >
              ↑ Entrada (ingreso)
            </button>
          </div>
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
              <MoneyInput
                id="caj-monto"
                value={monto}
                onChange={setMonto}
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

          {/* Comprobante/ticket del gasto (opcional): foto o PDF. Se sube a
              /uploads al elegirlo; el backend persiste comprobanteUrl (validada
              por tenant) para el respaldo de la rendición. Solo en prod: la demo
              no tiene backend de uploads. */}
          {apiEnabled && (
          <div className="space-y-1">
            <Label htmlFor="caj-comprobante" className="text-xs">Comprobante (opcional)</Label>
            {comprobanteUrl ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">Comprobante adjunto</span>
                <button
                  type="button"
                  onClick={() => setComprobanteUrl(null)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Quitar comprobante"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span>{subiendoComprobante ? 'Subiendo…' : 'Adjuntar foto o PDF del ticket'}</span>
                <input
                  id="caj-comprobante"
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  disabled={subiendoComprobante}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSubiendoComprobante(true);
                    try {
                      const { url } = await subirArchivo(file);
                      setComprobanteUrl(url);
                    } catch {
                      toast({ title: 'No se pudo subir el comprobante', variant: 'destructive' });
                    } finally {
                      setSubiendoComprobante(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            )}
          </div>
          )}
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
