'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  Lightbulb,
  Package,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { useConsorcioInventario } from '@/lib/api/use-consorcio-extra';
import {
  type CategoriaInventario,
  type ItemInventario,
  type MovimientoInventario,
  CATEGORIA_INVENTARIO_LABEL,
} from '@/lib/consorcio-inventario-storage';
import { formatFechaCorta, formatMonto } from '@/lib/format';

const USUARIO_ACTUAL = 'Roberto Tapia';

const ICONO_CATEGORIA: Record<CategoriaInventario, typeof Boxes> = {
  ILUMINACION: Lightbulb,
  PLOMERIA: Wrench,
  CERRAJERIA: Wrench,
  LIMPIEZA: Sparkles,
  ELECTRICIDAD: Boxes,
  OFICINA: Package,
  OTRO: Boxes,
};

interface Props {
  consorcioId: string;
}

export function ConsorcioInventarioTab({ consorcioId }: Props) {
  const {
    items,
    movimientos: movs,
    cargando,
    crearItem,
    moverStock: moverStockApi,
  } = useConsorcioInventario(consorcioId);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [moverAbierto, setMoverAbierto] = useState<{
    item: ItemInventario;
    tipo: 'ENTRADA' | 'SALIDA';
  } | null>(null);

  const bajoMinimo = useMemo(
    () => items.filter((i) => i.cantidadActual < i.minimoStock),
    [items],
  );
  const valorStock = useMemo(() => {
    return items.reduce(
      (acc, i) => acc + (i.costoUnitario ?? 0) * i.cantidadActual,
      0,
    );
  }, [items]);

  // Inventario y movimientos de stock persisten en el backend
  // (GET/POST /consorcios/:id/inventario…); en build demo van a localStorage.
  const puedeMutar = true;

  if (cargando) return null;

  const onItemCreado = async (data: Omit<ItemInventario, 'id' | 'actualizadoAt'>) => {
    try {
      await crearItem(data);
      setCrearAbierto(false);
      toast({
        variant: 'success',
        title: 'Item agregado',
        description: data.nombre,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo agregar',
        description: e instanceof Error ? e.message : 'Intentá de nuevo.',
      });
    }
  };

  const onMovimiento = async (
    item: ItemInventario,
    tipo: 'ENTRADA' | 'SALIDA',
    cantidad: number,
    motivo: string,
    ufDestino?: string,
  ) => {
    try {
      await moverStockApi({
        itemId: item.id,
        consorcioId,
        tipo,
        cantidad,
        motivo,
        ufDestino,
        cargadoPor: USUARIO_ACTUAL,
      });
      setMoverAbierto(null);
      toast({
        variant: 'success',
        title: tipo === 'ENTRADA' ? 'Stock agregado' : 'Stock descontado',
        description: `${item.nombre} · ${cantidad} ${item.unidad}`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar',
        description: e instanceof Error ? e.message : 'Intentá de nuevo.',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Boxes className="h-4 w-4" />
              <p className="text-xs">Items en stock</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {items.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <p className="text-xs">Valor estimado</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMonto(valorStock)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={
            bajoMinimo.length > 0
              ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10'
              : ''
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs">Stock bajo</p>
            </div>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                bajoMinimo.length > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground'
              }`}
            >
              {bajoMinimo.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {bajoMinimo.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
          <CardContent className="p-4 text-xs">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              Items con stock por debajo del mínimo
            </p>
            <ul role="list" className="mt-2 list-disc pl-4 text-amber-900/80 dark:text-amber-200/80">
              {bajoMinimo.map((i) => (
                <li key={i.id}>
                  <strong>{i.nombre}</strong> · queda {i.cantidadActual}{' '}
                  {i.unidad} (mínimo {i.minimoStock})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Stock actual</h3>
        <Button
          size="sm"
          onClick={() => setCrearAbierto(true)}
          disabled={!puedeMutar}
          title={puedeMutar ? undefined : 'Próximamente'}
        >
          <Plus className="h-4 w-4" />
          Agregar item
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-xs text-muted-foreground">
            Todavía no cargaste materiales en este consorcio.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((item) => {
              const Icon = ICONO_CATEGORIA[item.categoria];
              const bajo = item.cantidadActual < item.minimoStock;
              return (
                <div key={item.id} className="flex items-start gap-3 p-3">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${
                      bajo
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold">{item.nombre}</p>
                      <Badge
                        variant="outline"
                        className="text-[9px]"
                      >
                        {CATEGORIA_INVENTARIO_LABEL[item.categoria]}
                      </Badge>
                      {bajo && (
                        <Badge variant="warning" className="text-[9px]">
                          stock bajo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.cantidadActual} {item.unidad}{' '}
                      <span className="text-muted-foreground/70">
                        · mínimo {item.minimoStock}
                      </span>
                      {item.costoUnitario && (
                        <span>
                          {' '}
                          · {formatMonto(item.costoUnitario)} / {item.unidad}
                        </span>
                      )}
                    </p>
                    {item.notas && (
                      <p className="text-[10px] italic text-muted-foreground">
                        {item.notas}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setMoverAbierto({ item, tipo: 'ENTRADA' })
                      }
                      disabled={!puedeMutar}
                      title={puedeMutar ? undefined : 'Próximamente'}
                    >
                      <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setMoverAbierto({ item, tipo: 'SALIDA' })
                      }
                      disabled={!puedeMutar || item.cantidadActual === 0}
                      title={puedeMutar ? undefined : 'Próximamente'}
                    >
                      <ArrowDown className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {movs.length > 0 && (
        <details className="rounded-md border bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-medium">
            Últimos movimientos ({movs.length})
          </summary>
          <ul role="list" className="mt-2 space-y-1.5 text-xs">
            {movs.slice(0, 20).map((m) => {
              const item = items.find((i) => i.id === m.itemId);
              return (
                <li key={m.id} className="flex items-start gap-2">
                  {m.tipo === 'ENTRADA' ? (
                    <ArrowUp className="mt-0.5 h-3 w-3 text-emerald-600" />
                  ) : (
                    <ArrowDown className="mt-0.5 h-3 w-3 text-destructive" />
                  )}
                  <div className="flex-1">
                    <p>
                      <strong>{item?.nombre ?? 'Item'}</strong> ·{' '}
                      {m.tipo === 'ENTRADA' ? '+' : '-'}
                      {m.cantidad} {item?.unidad}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.motivo}
                      {m.ufDestino && ` · ${m.ufDestino}`} · {formatFechaCorta(m.fecha)} ·{' '}
                      {m.cargadoPor}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <CrearItemDialog
        abierto={crearAbierto}
        onClose={() => setCrearAbierto(false)}
        consorcioId={consorcioId}
        onGuardar={onItemCreado}
        puedeMutar={puedeMutar}
      />

      <MoverStockDialog
        abierto={!!moverAbierto}
        onClose={() => setMoverAbierto(null)}
        item={moverAbierto?.item ?? null}
        tipo={moverAbierto?.tipo ?? 'SALIDA'}
        onConfirmar={(item, cantidad, motivo, ufDestino) =>
          onMovimiento(item, moverAbierto?.tipo ?? 'SALIDA', cantidad, motivo, ufDestino)
        }
        puedeMutar={puedeMutar}
      />
    </div>
  );
}

interface CrearProps {
  abierto: boolean;
  onClose: () => void;
  consorcioId: string;
  onGuardar: (data: Omit<ItemInventario, 'id' | 'actualizadoAt'>) => void;
  puedeMutar: boolean;
}

function CrearItemDialog({ abierto, onClose, consorcioId, onGuardar, puedeMutar }: CrearProps) {
  const [categoria, setCategoria] = useState<CategoriaInventario>('ILUMINACION');
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('unidades');
  const [cantidad, setCantidad] = useState('');
  const [minimo, setMinimo] = useState('');
  const [costo, setCosto] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setCategoria('ILUMINACION');
    setNombre('');
    setUnidad('unidades');
    setCantidad('');
    setMinimo('');
    setCosto('');
    setNotas('');
  }, [abierto]);

  const submit = () => {
    if (!puedeMutar) return;
    if (!nombre.trim() || !cantidad) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Necesitamos nombre y cantidad.',
      });
      return;
    }
    onGuardar({
      consorcioId,
      categoria,
      nombre: nombre.trim(),
      unidad: unidad.trim() || 'unidades',
      cantidadActual: parseInt(cantidad, 10),
      minimoStock: minimo ? parseInt(minimo, 10) : 0,
      costoUnitario: costo ? parseInt(costo, 10) : undefined,
      notas: notas.trim() || undefined,
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar item al inventario</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat">Categoría</Label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as CategoriaInventario)}
            >
              <SelectTrigger id="cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORIA_INVENTARIO_LABEL) as CategoriaInventario[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIA_INVENTARIO_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nom">Nombre</Label>
            <Input
              id="nom"
              placeholder="Ej. Foco LED 9W cálido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="uni">Unidad</Label>
              <Input
                id="uni"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cant">Cantidad</Label>
              <Input
                id="cant"
                type="number"
                inputMode="numeric"
                min="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Mínimo</Label>
              <Input
                id="min"
                type="number"
                inputMode="numeric"
                min="0"
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="costo">Costo unitario (ARS)</Label>
            <Input
              id="costo"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Opcional"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="not">Notas</Label>
            <Textarea
              id="not"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={!puedeMutar}
              title={puedeMutar ? undefined : 'Próximamente'}
            >
              Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MoverProps {
  abierto: boolean;
  onClose: () => void;
  item: ItemInventario | null;
  tipo: 'ENTRADA' | 'SALIDA';
  onConfirmar: (
    item: ItemInventario,
    cantidad: number,
    motivo: string,
    ufDestino?: string,
  ) => void;
  puedeMutar: boolean;
}

function MoverStockDialog({ abierto, onClose, item, tipo, onConfirmar, puedeMutar }: MoverProps) {
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ufDestino, setUfDestino] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setCantidad('1');
    setMotivo('');
    setUfDestino('');
  }, [abierto]);

  const submit = () => {
    if (!puedeMutar) return;
    const cantNum = parseInt(cantidad, 10);
    if (!item || !Number.isFinite(cantNum) || cantNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidad inválida',
        description: 'Ingresá una cantidad mayor a 0.',
      });
      return;
    }
    if (!motivo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Falta motivo',
        description: 'Describí brevemente para qué se está moviendo.',
      });
      return;
    }
    onConfirmar(
      item,
      parseInt(cantidad, 10),
      motivo.trim(),
      ufDestino.trim() || undefined,
    );
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tipo === 'ENTRADA' ? 'Sumar stock' : 'Descontar stock'}
            {item && ` · ${item.nombre}`}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              Stock actual: <strong>{item.cantidadActual}</strong> {item.unidad}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cant">Cantidad ({item.unidad})</Label>
              <Input
                id="cant"
                type="number"
                inputMode="numeric"
                min="0"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mot">Motivo</Label>
              <Input
                id="mot"
                placeholder={
                  tipo === 'ENTRADA'
                    ? 'Compra mensual, reposición…'
                    : 'Reemplazo en pasillo, reparación…'
                }
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            {tipo === 'SALIDA' && (
              <div className="space-y-1.5">
                <Label htmlFor="uf">Lugar de uso (opcional)</Label>
                <Input
                  id="uf"
                  placeholder="Ej. 1°B, Cochera, Hall PB…"
                  value={ufDestino}
                  onChange={(e) => setUfDestino(e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={!puedeMutar}
                title={puedeMutar ? undefined : 'Próximamente'}
              >
                {tipo === 'ENTRADA' ? 'Sumar' : 'Descontar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
