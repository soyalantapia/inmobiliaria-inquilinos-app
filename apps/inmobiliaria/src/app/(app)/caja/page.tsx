'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { Topbar } from '@/components/topbar';
import {
  type CategoriaGasto,
  type MovimientoCaja,
  categoriaGastoLabel,
  totalesPorMoneda,
} from '@/lib/caja-storage';
import { useCaja, usePropiedades } from '@/lib/api/hooks';
import { useCuentas } from '@/lib/api/use-cuentas';
import { useCierreCaja } from '@/lib/api/use-pagos';
import { apiEnabled, subirArchivo } from '@/lib/api/client';
import { formatFechaCorta, formatMonto, fechaHoyLocal } from '@/lib/format';
import type { Moneda } from '@/lib/types';
import { propiedadesMock } from '@/lib/mock-data';

/** Opción mínima de propiedad para el select/filtros de caja. */
/**
 * Un renglón por moneda. Con una sola (el 99% de los casos) se ve exactamente igual
 * que antes; con dos, el usuario ve "$ 120.000" y "US$ 800" en vez de un 120.800
 * inventado. Sin movimientos muestra el cero de la moneda local.
 */
function MontosPorMoneda({
  items,
  className,
}: {
  items: Array<{ moneda: Moneda; total: number }>;
  className?: string;
}) {
  if (items.length === 0) return <p className={className}>{formatMonto(0)}</p>;
  return (
    <div className={className}>
      {items.map((i) => (
        <p key={i.moneda}>{formatMonto(i.total, i.moneda)}</p>
      ))}
    </div>
  );
}

interface PropiedadOpcion {
  id: string;
  direccion: string;
  contratoActualId: string | null;
  /** Moneda del contrato vigente: la rendición sólo descuenta gastos de ESA moneda. */
  moneda: Moneda;
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
        moneda: p.contrato?.moneda ?? 'ARS',
      }))
    : propiedadesMock.map((p) => ({
        id: p.id,
        direccion: p.direccion,
        contratoActualId: p.contratoActualId,
        moneda: 'ARS' as Moneda,
      }));
  const [abrirForm, setAbrirForm] = useState(false);
  const [eliminando, setEliminando] = useState<MovimientoCaja | null>(null);
  const [filtroProp, setFiltroProp] = useState<string>('TODAS');

  const filtrados = useMemo(() => {
    if (filtroProp === 'TODAS') return movimientos;
    // Los movimientos que no son de ninguna unidad (gastos de oficina, movimientos
    // entre socios) necesitan su propio filtro: con los chips por propiedad quedaban
    // visibles sólo en "Todas", sin manera de aislarlos.
    if (filtroProp === 'SIN_PROPIEDAD') return movimientos.filter((m) => !m.propiedadId);
    return movimientos.filter((m) => m.propiedadId === filtroProp);
  }, [movimientos, filtroProp]);

  // KPIs derivados de `filtrados` (no de `movimientos`): al activar un chip de
  // propiedad la lista se acotaba pero los KPIs seguían mostrando el total global,
  // sin coincidir con las filas visibles. Con filtroProp='TODAS', filtrados===movimientos.
  // Los KPIs van agrupados POR MONEDA: sumar un gasto en dólares con uno en pesos
  // da un número sin significado, y el símbolo de la primera moneda lo disfraza de
  // total válido. Con una sola moneda (el caso normal) se ve una sola línea.
  const totalGastado = totalesPorMoneda(filtrados.filter((m) => m.tipo === 'GASTO'));
  // "Pendiente de descontar" son los que EFECTIVAMENTE se van a descontar. Un movimiento
  // sin propiedad no entra en ninguna rendición, así que su `descontadoEnRendicion` nunca
  // pasa a true: contarlo acá dejaba un pendiente que no bajaba jamás.
  const pendienteDescuento = totalesPorMoneda(
    filtrados.filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion && !!m.propiedadId),
  );
  // Ingresos extra de caja: antes no aparecían en ningún KPI (parecían perderse).
  // Ahora suman al neto de la rendición → mostramos lo pendiente a sumar.
  const pendienteSumar = totalesPorMoneda(
    filtrados.filter((m) => m.tipo === 'INGRESO_EXTRA' && !m.descontadoEnRendicion && !!m.propiedadId),
  );
  const cantidadMov = filtrados.length;

  // El PIN se eliminó de la plataforma (auth/pin.ts): el borrado se confirma con
  // un ConfirmDialog común (mantiene el "¿estás seguro?", saca el código muerto).
  const handleEliminar = async () => {
    if (!eliminando) return;
    const id = eliminando.id;
    setEliminando(null);
    try {
      await eliminarGasto(id, '');
      toast({ title: 'Movimiento eliminado' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'No se pudo eliminar', description: e instanceof Error ? e.message : 'Probá de nuevo.' });
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
              Todo lo que entra y sale de la caja. Lo que cargues con una propiedad se
              descuenta de la rendición a ese propietario; lo que cargues sin propiedad
              queda sólo en la caja.
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
            <MontosPorMoneda items={totalGastado} className="mt-1 text-2xl font-semibold tabular-nums" />
          </Card>
          <Card className="p-4 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <ArrowDown className="h-4 w-4" />
              <p className="text-xs font-medium">A descontar en próxima rendición</p>
            </div>
            <MontosPorMoneda
              items={pendienteDescuento}
              className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300"
            />
          </Card>
          {pendienteSumar.length > 0 && (
            <Card className="p-4 sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                <p className="text-xs font-medium">A sumar en próxima rendición</p>
              </div>
              <MontosPorMoneda
                items={pendienteSumar}
                className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
              />
            </Card>
          )}
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
          {/* Sólo aparece si hay alguno: un chip que siempre filtra a vacío es ruido. */}
          {movimientos.some((m) => !m.propiedadId) && (
            <button
              type="button"
              aria-pressed={filtroProp === 'SIN_PROPIEDAD'}
              onClick={() => setFiltroProp('SIN_PROPIEDAD')}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filtroProp === 'SIN_PROPIEDAD'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              Sin propiedad
            </button>
          )}
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
              Cargá un movimiento cada vez que entre o salga plata de la caja.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtrados.map((m) => (
              <MovimientoRow
                key={m.id}
                mov={m}
                propDireccion={
                  // Sin propiedad es un estado válido y hay que nombrarlo: un guión
                  // se lee como "falta el dato", no como "no corresponde a ninguna".
                  m.propiedadId
                    ? (opcionesProp.find((p) => p.id === m.propiedadId)?.direccion ?? '—')
                    : 'Sin propiedad'
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
              propiedadId: data.propiedadId || null,
              // Antes NO se reenviaba el tipo → una "Entrada (ingreso)" se
              // guardaba como GASTO/salida. Ahora respeta lo elegido.
              tipo: data.tipo,
              categoria: data.categoria,
              descripcion: data.descripcion,
              monto: data.monto,
              // La moneda NO se estaba reenviando: el diálogo tiene su selector y
              // arrastra la del contrato, pero acá se caía y el server la defaulteaba
              // a ARS. Un gasto en dólares se guardaba como pesos y —por el filtro por
              // moneda de la rendición— no se le descontaba nunca al propietario. El
              // aviso de "moneda distinta" del formulario advertía de un problema que
              // el propio formulario provocaba.
              moneda: data.moneda,
              fecha: data.fecha,
              proveedor: data.proveedor,
              comprobanteUrl: data.comprobante,
              cuentaId: data.cuentaId ?? null,
            });
            setAbrirForm(false);
            toast(
              data.tipo === 'INGRESO_EXTRA'
                // El texto tiene que decir la verdad de ESTE movimiento: sin propiedad
                // no hay rendición que lo toque, y prometerla sería mentir.
                ? {
                    title: 'Entrada registrada',
                    description: data.propiedadId
                      ? 'Se le va a sumar al propietario en la próxima rendición.'
                      : 'Queda en la caja. No entra en la rendición de ningún propietario.',
                  }
                : {
                    title: 'Gasto cargado',
                    description: data.propiedadId
                      ? 'Se le va a descontar al propietario en la próxima rendición.'
                      : 'Queda en la caja. No entra en la rendición de ningún propietario.',
                  },
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
        onOpenChange={(o) => !o && setEliminando(null)}
        title="¿Eliminar movimiento?"
        description={eliminando?.descripcion}
        confirmLabel="Eliminar movimiento"
        variant="destructive"
        onConfirm={() => void handleEliminar()}
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
          {/* "Pendiente" significa "todavía no se descontó/sumó en una rendición". En un
              movimiento SIN propiedad eso no va a pasar nunca —no le corresponde a ningún
              propietario— así que ese badge estaría prometiendo una rendición que no
              existe, y encima en amarillo, como si faltara hacer algo. Estos movimientos
              no están pendientes de nada: están cerrados. */}
          {!mov.propiedadId ? (
            <Badge variant="outline" className="text-[10px]">
              Solo caja
            </Badge>
          ) : !esIngreso ? (
            mov.descontadoEnRendicion ? (
              <Badge variant="success" className="text-[10px]">
                Descontado
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">
                Pendiente
              </Badge>
            )
          ) : mov.descontadoEnRendicion ? (
            <Badge variant="success" className="text-[10px]">
              Sumado en rendición
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
          {mov.cuentaNombre && ` · ${mov.cuentaNombre}`}
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
          {formatMonto(mov.monto, mov.moneda)}
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
  // Moneda del movimiento. Arranca en la del contrato de la propiedad elegida: la
  // rendición sólo descuenta los gastos de SU moneda, así que el default correcto
  // es el que hace que el gasto efectivamente se descuente.
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [proveedor, setProveedor] = useState('');
  // Comprobante/ticket del gasto (opcional): se sube a /uploads al elegirlo y
  // queda su URL para mandarla en el alta. El backend la persiste (validada por tenant).
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Cuenta de caja de dónde sale / a dónde entra la plata (Camila: "Gaspar retira
  // Mercado Pago, la otra bebé retiro"). Solo prod: las cuentas gatean cuentas.*.
  const [cuentaId, setCuentaId] = useState('');
  // `cargando` y `error` NO son detalles: mientras no sepamos qué cuentas hay, la
  // pantalla no puede afirmar que no hay ninguna. Si /cuentas falla y el server SÍ ve
  // una cuenta compatible, decir "se puede guardar igual" es mentir — el server
  // devuelve 400 pidiendo una cuenta que el selector no deja elegir.
  const { cuentas, cargando: cargandoCuentas, error: errorCuentas, refrescar: refrescarCuentas } = useCuentas();
  const esIngreso = tipo === 'INGRESO_EXTRA';

  // Solo ofrecemos cuentas activas y compatibles con la dirección del movimiento:
  // una entrada solo puede caer en una cuenta ENTRADA/AMBAS; una salida en SALIDA/AMBAS
  // (Camila: "solo lo puedes usar para salir a esa o para entrada a la que yo marco").
  const cuentasCompatibles = useMemo(
    () =>
      cuentas.filter(
        (c) =>
          c.activa &&
          (c.direccion === 'AMBAS' || c.direccion === (esIngreso ? 'ENTRADA' : 'SALIDA')),
      ),
    [cuentas, esIngreso],
  );
  // ¿Tiene cuentas cargadas, aunque ninguna sirva para ESTE movimiento? Distingue
  // "todavía no configuraste cuentas" de "ninguna de las tuyas acepta esta dirección":
  // son dos problemas distintos y se arreglan distinto.
  const hayCuentas = useMemo(() => cuentas.some((c) => c.activa), [cuentas]);

  useEffect(() => {
    if (open) {
      setTipo('GASTO');
      setPropiedadId('');
      setCategoria('PLOMERIA');
      setDescripcion('');
      setMonto('');
      setMoneda('ARS');
      setFecha(fechaHoyLocal());
      setProveedor('');
      setComprobanteUrl(null);
      setCuentaId('');
    }
  }, [open]);

  // UN SOLO efecto decide la cuenta, y va DESPUÉS del reset de arriba a propósito: los
  // efectos corren en orden de declaración, así que puesto antes el reset le pisaba la
  // preselección cada vez que se abría el diálogo. Por lo mismo reemplaza al viejo
  // efecto que limpiaba la cuenta al cambiar de dirección.
  //  - si la elegida sigue sirviendo, se respeta;
  //  - si hay una sola posible, se preselecciona (no tiene sentido hacerla elegir);
  //  - si hay varias, se limpia: elegir mal la cuenta es peor que el clic de más, y un
  //    default silencioso se acepta sin leerlo.
  useEffect(() => {
    setCuentaId((actual) => {
      if (actual && cuentasCompatibles.some((c) => c.id === actual)) return actual;
      const unica = cuentasCompatibles.length === 1 ? cuentasCompatibles[0] : undefined;
      return unica ? unica.id : '';
    });
  }, [cuentasCompatibles, open]);

  const propSel = opciones.find((p) => p.id === propiedadId) ?? null;
  // Al cambiar de propiedad seguimos la moneda de SU contrato. Volver a "Sin propiedad"
  // ahora vuelve a ARS: antes el efecto sólo pisaba la moneda `if (propSel)`, así que
  // elegir una propiedad en dólares y después sacarla dejaba el movimiento en USD sin
  // que nada lo dijera. Con la propiedad obligatoria ese camino no se podía recorrer;
  // ahora es normal.
  useEffect(() => {
    setMoneda(propSel ? propSel.moneda : 'ARS');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedadId]);
  // Un gasto en una moneda distinta a la del contrato NUNCA se va a descontar de la
  // rendición de ese propietario: mejor decirlo antes que dejarlo colgado en silencio.
  const monedaDistinta = !!propSel?.contratoActualId && moneda !== propSel.moneda;

  const guardar = async () => {
    if (guardando) return;
    // La propiedad ya NO es obligatoria: por la caja pasa plata que no es de ninguna
    // unidad. La cuenta sí lo es, siempre que exista alguna que pueda recibir el
    // movimiento (mismo criterio que aplica el server).
    if (!descripcion.trim() || !monto) {
      toast({
        title: 'Faltan datos',
        description: 'La descripción y el monto son obligatorios.',
        variant: 'destructive',
      });
      return;
    }
    if (cuentasCompatibles.length > 0 && !cuentaId) {
      toast({
        title: esIngreso ? 'Elegí a qué cuenta entra' : 'Elegí de qué cuenta sale',
        description: 'Sin la cuenta, los totales por cuenta no cierran contra el total de la caja.',
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
        moneda,
        fecha,
        proveedor: proveedor.trim() || null,
        comprobante: comprobanteUrl,
        cuentaId: cuentaId || null,
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
              ? 'Entrada: plata que entró a la caja (ej. un reintegro del propietario).'
              : 'Salida: plata que salió de la caja (ej. un adelanto a un proveedor).'}
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
          {/* La cuenta NUNCA se esconde. Antes este bloque entero estaba detrás de
              `cuentasCompatibles.length > 0`: si no había ninguna cuenta que aceptara la
              dirección del movimiento, el campo desaparecía sin decir una palabra. A
              "AyV alquileres y ventas" le pasaba SIEMPRE al cargar un gasto —su única
              cuenta es de solo entrada— así que el campo no existía y no había forma de
              enterarse por qué. Ahora se ve igual, deshabilitado, y dice qué falta. */}
          {apiEnabled && (
            <div className="space-y-1">
              {/* El asterisco sigue a `cuentasCompatibles`, NO a `hayCuentas`: esa es la
                  regla real que aplica el server. Atado a `hayCuentas`, a una inmobiliaria
                  con una sola cuenta de entrada le marcaba el campo como obligatorio
                  mientras se lo mostraba deshabilitado y le aceptaba el gasto sin cuenta. */}
              <Label htmlFor="caj-cuenta" className="text-xs" aria-required={cuentasCompatibles.length > 0}>
                Cuenta {esIngreso ? '(a dónde entra)' : '(de dónde sale)'}
                {cuentasCompatibles.length > 0 && <span className="text-destructive"> *</span>}
              </Label>
              <select
                id="caj-cuenta"
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                disabled={cuentasCompatibles.length === 0}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {cargandoCuentas
                    ? 'Buscando tus cuentas…'
                    : errorCuentas
                      ? 'No pudimos traer tus cuentas'
                      : cuentasCompatibles.length === 0
                        ? esIngreso
                          ? 'No tenés cuentas que acepten entradas'
                          : 'No tenés cuentas que acepten salidas'
                        : 'Elegí una cuenta…'}
                </option>
                {cuentasCompatibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {/* Tres mensajes distintos para tres estados distintos. El que faltaba es
                  el del medio: si el pedido falló NO sabemos si hay cuentas, así que no
                  podemos prometer que se puede guardar igual — el server sí las ve y
                  responde 400 pidiendo una cuenta que este selector no deja elegir. */}
              {errorCuentas ? (
                <p className="text-xs text-destructive">
                  No pudimos traer tus cuentas. Si tenés alguna cargada, el movimiento va a
                  ser rechazado hasta que se pueda elegir.{' '}
                  <button
                    type="button"
                    onClick={() => refrescarCuentas()}
                    className="font-medium underline underline-offset-2"
                  >
                    Reintentar
                  </button>
                </p>
              ) : (
                !cargandoCuentas &&
                cuentasCompatibles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {hayCuentas
                      ? `Ninguna de tus cuentas acepta ${esIngreso ? 'entradas' : 'salidas'}. `
                      : 'Todavía no cargaste ninguna cuenta. '}
                    <Link href="/cuentas" className="font-medium underline underline-offset-2">
                      {hayCuentas ? 'Revisá tus cuentas' : 'Creá una'}
                    </Link>{' '}
                    para saber siempre dónde está la plata. El movimiento se puede guardar
                    igual, pero va a quedar sin cuenta.
                  </p>
                )
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="caj-propiedad" className="text-xs">
              Propiedad <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <select
              id="caj-propiedad"
              value={propiedadId}
              onChange={(e) => setPropiedadId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {/* Opción válida, no un placeholder: elegirla es una decisión, no un olvido. */}
              <option value="">Sin propiedad (no se rinde a nadie)</option>
              {opciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.direccion}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {propiedadId
                ? esIngreso
                  ? 'Se le va a sumar al propietario en la próxima rendición.'
                  : 'Se le va a descontar al propietario en la próxima rendición.'
                : 'Queda sólo en la caja: no entra en la rendición de ningún propietario.'}
            </p>
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
              <div className="flex gap-1">
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as Moneda)}
                  aria-label="Moneda del movimiento"
                  className="h-9 rounded-md border border-input bg-background px-1.5 text-sm"
                >
                  <option value="ARS">$</option>
                  <option value="USD">US$</option>
                </select>
                <MoneyInput
                  id="caj-monto"
                  value={monto}
                  onChange={setMonto}
                  moneda={moneda}
                  placeholder="0"
                  required
                  className="flex-1"
                />
              </div>
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

          {monedaDistinta && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              El contrato de esta propiedad está en{' '}
              <strong>{propSel?.moneda === 'USD' ? 'dólares' : 'pesos'}</strong>, así que un
              movimiento en {moneda === 'USD' ? 'dólares' : 'pesos'} <strong>no</strong> se va a
              descontar de la rendición al propietario. Convertí el importe o cambiá la moneda.
            </p>
          )}

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
