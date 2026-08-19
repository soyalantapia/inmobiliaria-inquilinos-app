'use client';

import { useMemo, useState } from 'react';
import { Loader2, UserMinus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from '@llave/ui/use-toast';
import { ApiError, varianteError } from '@/lib/api/client';
import { useCargarDeudaHistorica } from '@/lib/api/use-ajustes';

/**
 * Cargar la deuda de un inquilino ANTERIOR que se fue debiendo.
 *
 * Nace del pedido de Camila: arranca con ~50 morosos históricos y el alta normal
 * no los admite (rechaza si la propiedad ya tiene contrato activo, y la propiedad
 * del moroso de hace tres años hoy está alquilada a otro). Por eso este diálogo
 * vive en la PROPIEDAD y no en "nuevo contrato": el operador está parado donde
 * pasó la deuda.
 *
 * Lo que se carga NO es un alquiler: es la ventana de meses adeudados. Si alquiló
 * dos años y se fue debiendo los últimos tres, se cargan esos tres.
 */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propiedadId: string;
  direccion: string;
}

/** Primer día del mes de un input type="month" ("2024-03" → "2024-03-01"). */
function inicioDeMes(periodo: string): string {
  return `${periodo}-01`;
}

/** Último día del mes de un input type="month" ("2024-05" → "2024-05-31"). */
function finDeMes(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m) return `${periodo}-28`;
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periodo}-${String(ultimo).padStart(2, '0')}`;
}

/** El mes anterior al actual, en formato "YYYY-MM". */
function mesPasado(): string {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function CargarDeudaHistoricaDialog({ open, onOpenChange, propiedadId, direccion }: Props) {
  const cargar = useCargarDeudaHistorica(propiedadId);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [expensas, setExpensas] = useState('');

  const tope = mesPasado();

  // Cuántos meses se van a generar, para que el operador lo vea ANTES de
  // confirmar: está creando deuda y el número tiene que ser el que espera.
  const meses = useMemo(() => {
    if (!desde || !hasta) return null;
    const [ya, ma] = desde.split('-').map(Number);
    const [yb, mb] = hasta.split('-').map(Number);
    if (!ya || !ma || !yb || !mb) return null;
    const n = (yb - ya) * 12 + (mb - ma) + 1;
    return n > 0 ? n : null;
  }, [desde, hasta]);

  const montoNum = Number(monto.replace(',', '.'));
  const expensasNum = expensas.trim() === '' ? null : Number(expensas.replace(',', '.'));
  const totalMes = montoNum > 0 ? montoNum + (expensasNum ?? 0) : null;

  const puedeGuardar =
    nombre.trim().length > 0 &&
    montoNum > 0 &&
    meses !== null &&
    desde <= tope &&
    hasta <= tope &&
    !cargar.isPending;

  function limpiar() {
    setNombre('');
    setApellido('');
    setDni('');
    setTelefono('');
    setDesde('');
    setHasta('');
    setMonto('');
    setMoneda('ARS');
    setExpensas('');
  }

  async function guardar() {
    if (!puedeGuardar) return;
    try {
      const r = await cargar.mutateAsync({
        propiedadId,
        inquilino: {
          nombre: nombre.trim(),
          ...(apellido.trim() ? { apellido: apellido.trim() } : {}),
          ...(dni.trim() ? { dni: dni.trim() } : {}),
          ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
        },
        monto: montoNum,
        moneda,
        ...(expensasNum && expensasNum > 0 ? { montoExpensas: expensasNum } : {}),
        fechaInicio: inicioDeMes(desde),
        fechaFin: finDeMes(hasta),
        // El día no cambia cuánto debe, sólo la fecha de vencimiento de cuotas ya
        // vencidas. 10 es el default del sistema y no se le pregunta al operador:
        // una pregunta más en una carga de 50 filas, sin consecuencia real.
        diaPago: 10,
      });
      toast({
        title: 'Deuda cargada',
        description: `${r.periodosAdeudados} período(s) adeudado(s) de ${nombre.trim()}. La propiedad no cambió de estado.`,
      });
      limpiar();
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: 'No se pudo cargar la deuda',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en unos segundos.',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Deuda de un inquilino anterior
          </DialogTitle>
          <DialogDescription>
            Para alguien que ya se fue de {direccion} y quedó debiendo. Queda registrado como
            contrato terminado: <strong>no ocupa la propiedad</strong> ni afecta al inquilino que
            vive ahí hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dh-nombre">Nombre *</Label>
              <Input id="dh-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-apellido">Apellido</Label>
              <Input id="dh-apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-dni">DNI</Label>
              <Input id="dh-dni" value={dni} onChange={(e) => setDni(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Con el DNI, si esta persona ya está en tu cartera se une a su ficha en vez de
                duplicarse.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-telefono">Teléfono</Label>
              <Input id="dh-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dh-desde">Debe desde *</Label>
              <Input
                id="dh-desde"
                type="month"
                max={tope}
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-hasta">Debe hasta *</Label>
              <Input
                id="dh-hasta"
                type="month"
                max={tope}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dh-monto">Alquiler por mes *</Label>
              <Input
                id="dh-monto"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-expensas">Expensas por mes</Label>
              <Input
                id="dh-expensas"
                inputMode="decimal"
                value={expensas}
                onChange={(e) => setExpensas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dh-moneda">Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as 'ARS' | 'USD')}>
                <SelectTrigger id="dh-moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">Pesos</SelectItem>
                  <SelectItem value="USD">Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lo que se va a crear, en criollo y antes de confirmar. */}
          {meses !== null && totalMes !== null && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              Se van a cargar <strong>{meses}</strong> mes(es) adeudado(s) de{' '}
              <strong>
                {moneda === 'USD' ? 'US$' : '$'}
                {totalMes.toLocaleString('es-AR')}
              </strong>{' '}
              cada uno.
            </div>
          )}
          {(desde > tope || hasta > tope) && (
            <p className="text-sm text-destructive">
              La deuda histórica es de meses ya terminados. Si el inquilino sigue viviendo ahí,
              cargalo como contrato normal.
            </p>
          )}
          {desde && hasta && meses === null && (
            <p className="text-sm text-destructive">
              El mes &quot;hasta&quot; tiene que ser igual o posterior al mes &quot;desde&quot;.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargar.isPending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            {cargar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cargar deuda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
