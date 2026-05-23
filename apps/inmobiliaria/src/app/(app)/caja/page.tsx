'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Calendar,
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
import { CajaPorPropietarioCard } from '@/components/caja-por-propietario-card';
import { CierreDiarioCard } from '@/components/cierre-diario-card';
import { Topbar } from '@/components/topbar';
import {
  type CategoriaGasto,
  type MovimientoCaja,
  cargarMovimiento,
  categoriaGastoLabel,
  eliminarMovimiento,
  listarMovimientosCaja,
} from '@/lib/caja-storage';
import { formatFecha, formatMonto } from '@/lib/format';
import { propiedadesMock } from '@/lib/mock-data';

export default function CajaPage() {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [abrirForm, setAbrirForm] = useState(false);
  const [eliminando, setEliminando] = useState<MovimientoCaja | null>(null);
  const [filtroProp, setFiltroProp] = useState<string>('TODAS');

  useEffect(() => {
    refrescar();
  }, []);

  const refrescar = () => setMovimientos(listarMovimientosCaja());

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

  const handleEliminar = () => {
    if (!eliminando) return;
    eliminarMovimiento(eliminando.id);
    refrescar();
    setEliminando(null);
    toast({ title: 'Movimiento eliminado' });
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

        <CierreDiarioCard />

        <CajaPorPropietarioCard />

        {/* KPIs */}
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

        {/* Filtro propiedad */}
        <div className="flex flex-wrap gap-2">
          <button
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
          {propiedadesMock.map((p) => (
            <button
              key={p.id}
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
                  propiedadesMock.find((p) => p.id === m.propiedadId)?.direccion ?? '—'
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
        onSubmit={(data) => {
          cargarMovimiento(data);
          refrescar();
          setAbrirForm(false);
          toast({
            title: 'Gasto cargado',
            description: `Se descontará en la próxima rendición.`,
          });
        }}
      />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title="¿Eliminar movimiento?"
        description={eliminando?.descripcion}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleEliminar}
      />
    </>
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
          {formatFecha(mov.fecha)}
          {mov.proveedor && ` · ${mov.proveedor}`} · cargó {mov.cargadoPor}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold tabular-nums text-red-600">
          −{formatMonto(mov.monto)}
        </p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}

function DialogCargarGasto({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: Omit<MovimientoCaja, 'id' | 'createdAt' | 'descontadoEnRendicion'>) => void;
}) {
  const [propiedadId, setPropiedadId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('PLOMERIA');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [proveedor, setProveedor] = useState('');

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

  const guardar = () => {
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
    const prop = propiedadesMock.find((p) => p.id === propiedadId);
    onSubmit({
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
            <Label className="text-xs">Propiedad</Label>
            <select
              value={propiedadId}
              onChange={(e) => setPropiedadId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Elegí una propiedad…</option>
              {propiedadesMock.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.direccion}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <select
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
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: cambio de termotanque"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Monto</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proveedor (opcional)</Label>
              <Input
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
          <Button className="flex-1" onClick={guardar}>
            <Plus className="h-4 w-4" />
            Cargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
