'use client';

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
  Undo2,
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
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { Topbar } from '@/components/topbar';
import { CuentasPanel } from '@/components/cuentas-panel';
import {
  type CategoriaGasto,
  type MovimientoCaja,
  categoriaGastoLabel,
  totalesPorMoneda,
} from '@/lib/caja-storage';
import { useCaja, useMe, usePropiedades } from '@/lib/api/hooks';
import { useCuentas } from '@/lib/api/use-cuentas';
import { type CierreCajaItem, useAnularPago, useCierreCaja } from '@/lib/api/use-pagos';
import { rolTienePermiso } from '@/lib/permisos';
import { normalizarRol } from '@/lib/rol-storage';
import { apiEnabled, subirArchivo } from '@/lib/api/client';
import { formatFechaCorta, formatMonto, formatTotalPorMoneda, fechaHoyLocal } from '@/lib/format';
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
  // El tab se lee de la URL para que `/caja?tab=cuentas` sea linkeable (el ítem del menú
  // apunta ahí). Mismo patrón que /pagos.
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams?.get('tab') === 'cuentas' ? 'cuentas' : 'movimientos');

  const filtrados = useMemo(() => {
    if (filtroProp === 'TODAS') return movimientos;
    return movimientos.filter((m) => m.propiedadId === filtroProp);
  }, [movimientos, filtroProp]);

  // KPIs derivados de `filtrados` (no de `movimientos`): al activar un chip de
  // propiedad la lista se acotaba pero los KPIs seguían mostrando el total global,
  // sin coincidir con las filas visibles. Con filtroProp='TODAS', filtrados===movimientos.
  // Los KPIs van agrupados POR MONEDA: sumar un gasto en dólares con uno en pesos
  // da un número sin significado, y el símbolo de la primera moneda lo disfraza de
  // total válido. Con una sola moneda (el caso normal) se ve una sola línea.
  const totalGastado = totalesPorMoneda(filtrados.filter((m) => m.tipo === 'GASTO'));
  const pendienteDescuento = totalesPorMoneda(
    filtrados.filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion),
  );
  // Ingresos extra de caja: antes no aparecían en ningún KPI (parecían perderse).
  // Ahora suman al neto de la rendición → mostramos lo pendiente a sumar.
  const pendienteSumar = totalesPorMoneda(
    filtrados.filter((m) => m.tipo === 'INGRESO_EXTRA' && !m.descontadoEnRendicion),
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
      <main className="flex-1 p-4 md:p-6">
        {/* PESTAÑAS. Camila (03/08) fue a caja buscando las cuentas y no las encontró:
            "abajo de caja no aparece ahí en caja, pero sí aparece cuentas". Eran dos
            pantallas hermanas sin un solo link entre ellas. "Cuentas" es una subdivisión de
            la caja, no un par: por eso se integra en vez de enlazarse. Mismo patrón que
            /pagos (Tabs + tab leído de la URL), que ya resolvió este mismo problema. */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
          </TabsList>
          <TabsContent value="cuentas" className="mt-0">
            <CuentasPanel />
          </TabsContent>
          <TabsContent value="movimientos" className="mt-0 space-y-6">
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
                  // Distinguimos "sin propiedad a propósito" (gasto de la inmobiliaria)
                  // de "no la encontramos", que antes se veían igual con un guión.
                  !m.propiedadId
                    ? 'De la inmobiliaria'
                    : (opcionesProp.find((p) => p.id === m.propiedadId)?.direccion ?? '—')
                }
                onDelete={() => setEliminando(m)}
              />
            ))}
          </div>
        )}
          </TabsContent>
        </Tabs>
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
              // MISMO bug que el `tipo` de acá arriba, con otro campo: el form tiene
              // selector $ / US$ y lo emitía, pero este payload se arma campo por campo y
              // se lo comía, así que el zod del back caía al default ARS y todo movimiento
              // se guardaba en pesos. Es opcional en el tipo, por eso tsc no lo marcaba.
              moneda: data.moneda,
              fecha: data.fecha,
              proveedor: data.proveedor,
              comprobanteUrl: data.comprobante,
              cuentaId: data.cuentaId ?? null,
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
  // Con UNA sola moneda el total plano es correcto, pero se formateaba siempre como
  // pesos: un día cuyo único cobro fue en dólares mostraba "$ 1.200" arriba y "US$ 1.200"
  // en la fila. El desglose `porMoneda` ya sabe cuál es.
  const monedaUnica = (cierre?.porMoneda[0]?.moneda ?? 'ARS') as Moneda;

  // T-12 — Camila buscó acá cómo deshacer un cobro mal cargado: llegó al detalle y la fila
  // no tenía acción. `POST /pagos/:id/anular` ya existía, pero sólo se alcanzaba desde la
  // bandeja de conciliados, que no es donde ella estaba mirando.
  const { me } = useMe();
  const { anular, disponible: anularDisponible } = useAnularPago();
  // `pago.revertir` es ADMIN. Si no puede, no mostramos el botón: prometerlo para que el
  // server conteste 403 es peor que no ofrecerlo.
  const puedeAnular =
    anularDisponible && rolTienePermiso(normalizarRol(me?.rol, 'LECTURA'), 'pago.revertir');
  const [anulando, setAnulando] = useState<CierreCajaItem | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const confirmarAnular = async () => {
    if (!anulando || motivo.trim().length < 5) return;
    setEnviando(true);
    try {
      await anular(anulando.id, motivo.trim());
      toast({
        title: 'Cobro deshecho',
        description: `El pago de ${anulando.inquilino} volvió a quedar pendiente.`,
      });
      setAnulando(null);
      setMotivo('');
    } catch (e) {
      // El server tiene motivos concretos para negarse (el período ya se le rindió al
      // propietario, el pago ya no está conciliado). Mostramos SU mensaje: es la respuesta
      // a "¿por qué no puedo?", y un texto genérico la borraría.
      toast({
        variant: 'destructive',
        title: 'No se pudo deshacer',
        description: e instanceof Error ? e.message : 'Probá de nuevo en un momento.',
      });
    } finally {
      setEnviando(false);
    }
  };

  const compartir = () => {
    if (!cierre || cierre.cantidad === 0) return;
    const cuando = esHoy ? 'de hoy' : `del ${fecha}`;
    // Con varias monedas el total plano no significa nada: exportamos el desglose.
    const lineasMonto = cierre.multiMoneda
      ? cierre.porMoneda
          .map((m) => `${m.moneda} — Cobrado: ${formatMonto(m.cobrado, m.moneda as 'ARS' | 'USD')} · Comisión: ${formatMonto(m.comision, m.moneda as 'ARS' | 'USD')}`)
          .join('\n')
      : `Cobrado: ${formatMonto(cierre.cobrado, monedaUnica)}\n` +
        `Comisión (honorarios): ${formatMonto(cierre.comision, monedaUnica)}`;
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
                  {cierre.multiMoneda ? 'ver desglose' : formatMonto(cierre.cobrado, monedaUnica)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Percent className="h-3 w-3" /> Comisión
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {cierre.multiMoneda ? 'ver desglose' : formatMonto(cierre.comision, monedaUnica)}
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
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        {/* Con la moneda del ítem: el cierre ya separa ARS de USD más
                            arriba, y esta fila los mostraba todos como pesos. */}
                        <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatMonto(p.monto, p.moneda as Moneda)}
                        </p>
                        <p className="text-[10px] tabular-nums text-muted-foreground">
                          comisión {formatMonto(p.comision, p.moneda as Moneda)}
                        </p>
                      </div>
                      {puedeAnular && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setAnulando(p);
                            setMotivo('');
                          }}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Deshacer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Deshacer un cobro: el server exige un motivo de 5+ caracteres y lo deja en la
          auditoría del pago, así que lo pedimos acá en vez de comerse un 400. */}
      <Dialog
        open={anulando !== null}
        onOpenChange={(v) => {
          if (!v && !enviando) {
            setAnulando(null);
            setMotivo('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deshacer el cobro de {anulando?.inquilino}</DialogTitle>
            <DialogDescription>
              {anulando
                ? `${formatMonto(anulando.monto, anulando.moneda as Moneda)} · ${anulando.periodo}. La cuota vuelve a quedar pendiente y el cobro sale del cierre del día.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-anular">¿Por qué se deshace?</Label>
            <Textarea
              id="motivo-anular"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se cargó en el contrato equivocado"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Queda registrado en el historial del pago. Mínimo 5 caracteres.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={enviando}
              onClick={() => {
                setAnulando(null);
                setMotivo('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={enviando || motivo.trim().length < 5}
              onClick={confirmarAnular}
            >
              {enviando ? 'Deshaciendo…' : 'Deshacer cobro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
          {esIngreso &&
            (mov.descontadoEnRendicion ? (
              <Badge variant="success" className="text-[10px]">
                Sumado en rendición
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
  const { cuentas } = useCuentas();
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

  const propSel = opciones.find((p) => p.id === propiedadId) ?? null;
  // Al cambiar de propiedad seguimos la moneda de SU contrato. Si el usuario ya la
  // tocó a mano no la pisamos: el efecto depende sólo de propiedadId.
  useEffect(() => {
    if (propSel) setMoneda(propSel.moneda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedadId]);
  // Un gasto en una moneda distinta a la del contrato NUNCA se va a descontar de la
  // rendición de ese propietario: mejor decirlo antes que dejarlo colgado en silencio.
  const monedaDistinta = !!propSel?.contratoActualId && moneda !== propSel.moneda;
  // Si cambia la dirección (entrada/salida), la cuenta elegida puede dejar de ser
  // válida: la limpiamos para no mandar una cuenta incompatible (el server la rechaza).
  useEffect(() => {
    setCuentaId('');
  }, [tipo]);

  const guardar = async () => {
    if (guardando) return;
    // La propiedad NO es obligatoria: sin propiedad el movimiento es de la propia
    // inmobiliaria (oficina, sueldos, entre cajas) y no se le rinde a ningún dueño.
    // Antes era obligatoria y no había forma de cargar esos gastos ("sí o sí tengo que
    // elegir una propiedad", 03/08).
    if (!descripcion.trim() || !monto) {
      toast({
        title: 'Faltan datos',
        description: 'La descripción y el monto son obligatorios.',
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
        propiedadId: propiedadId || null,
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
          {apiEnabled && cuentasCompatibles.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="caj-cuenta" className="text-xs">
                Cuenta {esIngreso ? '(a dónde entra)' : '(de dónde sale)'}
              </Label>
              <select
                id="caj-cuenta"
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sin cuenta asignada</option>
                {cuentasCompatibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {/* El saldo de la cuenta elegida, acá mismo. Camila pidió "cargar un gasto en
                  una cuenta y ver el saldo de esa cuenta": antes el saldo vivía SÓLO en
                  /cuentas, así que había que cargar el gasto y después irse a otra pantalla
                  a ver cómo quedó. */}
              {(() => {
                const sel = cuentasCompatibles.find((c) => c.id === cuentaId);
                if (!sel) return null;
                if (sel.porMoneda.length === 0) {
                  return <p className="text-[11px] text-muted-foreground">Sin movimientos todavía.</p>;
                }
                return (
                  <p className="text-[11px] text-muted-foreground">
                    Saldo actual:{' '}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatTotalPorMoneda(sel.porMoneda.map((p) => ({ monto: p.saldo, moneda: p.moneda })))}
                    </span>
                  </p>
                );
              })()}
            </div>
          )}
          {/* SIN cuentas cargadas el select entero desaparecía, sin una palabra. Es el
              estado inicial de CUALQUIER inmobiliaria, y es la explicación más probable del
              "no aparece nada de cuentas" de Camila el 03/08: no es que estuviera escondido,
              es que no había ninguna cuenta y la pantalla se quedó callada. */}
          {apiEnabled && cuentasCompatibles.length === 0 && (
            <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs">
              <p className="font-medium">
                Todavía no tenés cuentas {esIngreso ? 'de entrada' : 'de salida'} cargadas
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Podés cargar el movimiento igual: queda sin cuenta asignada. Si querés llevar el
                saldo por cuenta (Mercado Pago, efectivo, banco), creá una en la pestaña Cuentas.
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="caj-propiedad" className="text-xs">
              Propiedad <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <select
              id="caj-propiedad"
              value={propiedadId}
              onChange={(e) => setPropiedadId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {/* Sin propiedad = gasto de la inmobiliaria. Se dice explícito para que no
                  parezca un campo que quedó sin completar. */}
              <option value="">Sin propiedad — gasto de la inmobiliaria</option>
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
