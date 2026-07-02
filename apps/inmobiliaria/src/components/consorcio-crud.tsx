'use client';

/**
 * CRUD de consorcios — Fase 1 (los dialogs de alta/edición). El tablero era de
 * solo-lectura en prod; acá el administrador da de alta el edificio, sus UFs
 * (con validación de coeficientes espejo del backend), los gastos del mes y
 * las asambleas. Prod-only: la demo nunca tuvo alta (era un stub) y las
 * mutaciones del hook tiran "Disponible solo con servidor" en !apiEnabled.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  useConsorcioMutaciones,
  type AsambleaInput,
  type MovimientoInput,
} from '@/lib/api/use-consorcios';
import {
  CATEGORIA_MOVIMIENTO_LABEL,
  type MovimientoConsorcio,
  type UnidadFuncional,
} from '@/lib/consorcios-storage';

function mensajeDe(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Intentá de nuevo.';
}

/* ============================================================
 * Sumar consorcio (lista)
 * ============================================================ */

export function SumarConsorcioDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { crearConsorcio } = useConsorcioMutaciones();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [expensa, setExpensa] = useState('');
  const [encargadoNombre, setEncargadoNombre] = useState('');
  const [encargadoSueldo, setEncargadoSueldo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre('');
      setDireccion('');
      setPeriodo(new Date().toISOString().slice(0, 7));
      setExpensa('');
      setEncargadoNombre('');
      setEncargadoSueldo('');
      setGuardando(false);
    }
  }, [open]);

  const puedeGuardar = nombre.trim().length >= 2 && direccion.trim().length >= 3 && !guardando;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const c = await crearConsorcio({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        periodoActual: periodo,
        ...(expensa ? { expensasPeriodoActual: Math.round(parseFloat(expensa)) } : {}),
        ...(encargadoNombre.trim()
          ? {
              encargado: {
                nombre: encargadoNombre.trim(),
                sueldo: encargadoSueldo ? Math.round(parseFloat(encargadoSueldo)) : 0,
              },
            }
          : {}),
      });
      toast({ variant: 'success', title: 'Consorcio creado', description: c.nombre });
      onOpenChange(false);
      router.push(`/consorcios/${c.id}`);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo crear', description: mensajeDe(err) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sumar consorcio</DialogTitle>
          <DialogDescription>
            El edificio bajo administración. Después cargás sus unidades funcionales.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cs-nombre">Nombre del consorcio</Label>
            <Input
              id="cs-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Consorcio Av. Santa Fe 4922"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-dir">Dirección</Label>
            <Input
              id="cs-dir"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Santa Fe 4922, CABA"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs-periodo">Período actual</Label>
              <Input
                id="cs-periodo"
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-expensa">Expensas del período (ARS)</Label>
              <Input
                id="cs-expensa"
                type="number"
                inputMode="decimal"
                min="0"
                value={expensa}
                onChange={(e) => setExpensa(e.target.value)}
                placeholder="Total a prorratear"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs-enc" className="flex items-center gap-1.5">
                Encargado
                <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
              </Label>
              <Input
                id="cs-enc"
                value={encargadoNombre}
                onChange={(e) => setEncargadoNombre(e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-sueldo">Sueldo (ARS)</Label>
              <Input
                id="cs-sueldo"
                type="number"
                inputMode="decimal"
                min="0"
                value={encargadoSueldo}
                onChange={(e) => setEncargadoSueldo(e.target.value)}
                disabled={!encargadoNombre.trim()}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeGuardar}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear consorcio
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Alta / edición de unidad funcional
 * ============================================================ */

export function UnidadDialog({
  consorcioId,
  unidad,
  coeficienteDisponible,
  open,
  onOpenChange,
}: {
  consorcioId: string;
  /** Si viene, es edición; si no, alta. */
  unidad?: UnidadFuncional | null;
  /** 100 − Σ coeficientes de las otras UFs (para el hint y la validación espejo). */
  coeficienteDisponible: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { crearUnidad, editarUnidad } = useConsorcioMutaciones(consorcioId);
  const [identificacion, setIdentificacion] = useState('');
  const [titular, setTitular] = useState('');
  const [telefono, setTelefono] = useState('');
  const [coeficiente, setCoeficiente] = useState('');
  const [usaFijo, setUsaFijo] = useState(false);
  const [cargoFijo, setCargoFijo] = useState('');
  const [saldoDeudor, setSaldoDeudor] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setIdentificacion(unidad?.identificacion ?? '');
      setTitular(unidad?.titular ?? '');
      setTelefono(unidad?.telefono ?? '');
      setCoeficiente(unidad ? String(unidad.coeficiente) : '');
      setUsaFijo(unidad?.cargoFijo !== undefined);
      setCargoFijo(unidad?.cargoFijo !== undefined ? String(unidad.cargoFijo) : '');
      setSaldoDeudor(unidad && unidad.saldoDeudor > 0 ? String(unidad.saldoDeudor) : '');
      setGuardando(false);
    }
  }, [open, unidad]);

  const coefNum = parseFloat(coeficiente);
  // Tolerancia espejo del backend (Float: 33.33×3 debe poder cerrar en 100).
  const coefOk = Number.isFinite(coefNum) && coefNum > 0 && coefNum <= coeficienteDisponible + 0.01;
  const puedeGuardar =
    identificacion.trim().length >= 1 &&
    titular.trim().length >= 2 &&
    coefOk &&
    (!usaFijo || (cargoFijo && parseFloat(cargoFijo) >= 0)) &&
    !guardando;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    const input = {
      identificacion: identificacion.trim(),
      titular: titular.trim(),
      telefono: telefono.trim() || undefined,
      coeficiente: coefNum,
      cargoFijo: usaFijo ? Math.round(parseFloat(cargoFijo)) : null,
      ...(saldoDeudor ? { saldoDeudor: Math.round(parseFloat(saldoDeudor)) } : {}),
    };
    try {
      if (unidad) {
        await editarUnidad(unidad.id, input);
        toast({ variant: 'success', title: 'Unidad actualizada', description: input.identificacion });
      } else {
        await crearUnidad(input);
        toast({ variant: 'success', title: 'Unidad agregada', description: input.identificacion });
      }
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: mensajeDe(err) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{unidad ? `Editar ${unidad.identificacion}` : 'Agregar unidad funcional'}</DialogTitle>
          <DialogDescription>
            Coeficiente disponible del edificio:{' '}
            <strong>{Math.max(0, Math.round(coeficienteDisponible * 100) / 100)}%</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="uf-id">Identificación</Label>
              <Input
                id="uf-id"
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                placeholder="1°A / PB Local"
                autoFocus={!unidad}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf-coef">Coeficiente (%)</Label>
              <Input
                id="uf-coef"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={coeficiente}
                onChange={(e) => setCoeficiente(e.target.value)}
                placeholder="8.33"
                className={coeficiente && !coefOk ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {coeficiente && !coefOk && (
                <p className="text-[11px] text-destructive">
                  Tiene que ser &gt; 0 y ≤ {Math.max(0, Math.round(coeficienteDisponible * 100) / 100)}%
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="uf-titular">Titular</Label>
              <Input
                id="uf-titular"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                placeholder="Nombre del propietario"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf-tel" className="flex items-center gap-1.5">
                WhatsApp
                <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
              </Label>
              <Input
                id="uf-tel"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 11 5555-5555"
              />
            </div>
          </div>
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usaFijo}
                onChange={(e) => setUsaFijo(e.target.checked)}
                className="h-4 w-4"
              />
              Paga un monto fijo (en vez del prorrateo por coeficiente)
            </label>
            {usaFijo && (
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                value={cargoFijo}
                onChange={(e) => setCargoFijo(e.target.value)}
                placeholder="Monto fijo mensual (ARS)"
                aria-label="Monto fijo mensual"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uf-saldo" className="flex items-center gap-1.5">
              Saldo deudor {unidad ? '' : 'inicial'}
              <span className="text-[10px] font-normal text-muted-foreground">
                opcional · deuda histórica al migrar el edificio
              </span>
            </Label>
            <Input
              id="uf-saldo"
              type="number"
              inputMode="decimal"
              min="0"
              value={saldoDeudor}
              onChange={(e) => setSaldoDeudor(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeGuardar}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : unidad ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {unidad ? 'Guardar cambios' : 'Agregar unidad'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Nuevo movimiento (gasto / cobranza del edificio)
 * ============================================================ */

const CATEGORIAS: MovimientoConsorcio['categoria'][] = [
  'COBRANZA',
  'SUELDO',
  'MANTENIMIENTO',
  'SERVICIO',
  'IMPUESTO',
  'OTRO',
];

export function NuevoMovimientoDialog({
  consorcioId,
  open,
  onOpenChange,
}: {
  consorcioId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { crearMovimiento } = useConsorcioMutaciones(consorcioId);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<MovimientoConsorcio['categoria']>('MANTENIMIENTO');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setFecha(new Date().toISOString().slice(0, 10));
      setConcepto('');
      setMonto('');
      setCategoria('MANTENIMIENTO');
      setGuardando(false);
    }
  }, [open]);

  const montoNum = Math.round(parseFloat(monto));
  const esIngreso = categoria === 'COBRANZA';
  const puedeGuardar =
    concepto.trim().length >= 2 && Number.isFinite(montoNum) && montoNum > 0 && !!fecha && !guardando;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const input: MovimientoInput = {
        fecha,
        concepto: concepto.trim(),
        // El SIGNO codifica la dirección: cobranza suma, el resto resta.
        monto: esIngreso ? montoNum : -montoNum,
        categoria,
      };
      await crearMovimiento(input);
      toast({ variant: 'success', title: 'Movimiento cargado', description: input.concepto });
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo cargar', description: mensajeDe(err) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar movimiento</DialogTitle>
          <DialogDescription>
            Cobranza (ingresa) o gasto del edificio (egresa) del período.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mv-fecha">Fecha</Label>
              <Input id="mv-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mv-cat">Categoría</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as MovimientoConsorcio['categoria'])}>
                <SelectTrigger id="mv-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_MOVIMIENTO_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-concepto">Concepto</Label>
            <Input
              id="mv-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={esIngreso ? 'Expensas 3°B · junio' : 'Reparación portero eléctrico'}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-monto">Monto (ARS)</Label>
            <Input
              id="mv-monto"
              type="number"
              inputMode="decimal"
              min="1"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="85000"
            />
            <p className="text-[11px] text-muted-foreground">
              {esIngreso ? 'Se registra como ingreso (+).' : 'Se registra como egreso (−).'}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeGuardar}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cargar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Nueva asamblea
 * ============================================================ */

export function NuevaAsambleaDialog({
  consorcioId,
  open,
  onOpenChange,
}: {
  consorcioId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { crearAsamblea } = useConsorcioMutaciones(consorcioId);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<AsambleaInput['tipo']>('ORDINARIA');
  const [asunto, setAsunto] = useState('');
  const [asistentes, setAsistentes] = useState('');
  const [acuerdo, setAcuerdo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setFecha(new Date().toISOString().slice(0, 10));
      setTipo('ORDINARIA');
      setAsunto('');
      setAsistentes('');
      setAcuerdo('');
      setGuardando(false);
    }
  }, [open]);

  const asistentesNum = parseInt(asistentes, 10);
  const puedeGuardar =
    asunto.trim().length >= 3 &&
    acuerdo.trim().length >= 3 &&
    Number.isFinite(asistentesNum) &&
    asistentesNum >= 0 &&
    !guardando;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await crearAsamblea({
        fecha,
        tipo,
        asunto: asunto.trim(),
        asistentes: asistentesNum,
        acuerdoPrincipal: acuerdo.trim(),
      });
      toast({ variant: 'success', title: 'Asamblea registrada', description: asunto.trim() });
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo registrar', description: mensajeDe(err) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar asamblea</DialogTitle>
          <DialogDescription>El acta queda en el registro del edificio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-fecha">Fecha</Label>
              <Input id="as-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as AsambleaInput['tipo'])}>
                <SelectTrigger id="as-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORDINARIA">Ordinaria</SelectItem>
                  <SelectItem value="EXTRAORDINARIA">Extraordinaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-asist">Asistentes</Label>
              <Input
                id="as-asist"
                type="number"
                inputMode="numeric"
                min="0"
                value={asistentes}
                onChange={(e) => setAsistentes(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-asunto">Asunto</Label>
            <Input
              id="as-asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Aprobación presupuesto pintura"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-acuerdo">Acuerdo principal</Label>
            <Textarea
              id="as-acuerdo"
              rows={3}
              value={acuerdo}
              onChange={(e) => setAcuerdo(e.target.value)}
              placeholder="Qué se decidió"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeGuardar}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Botón de borrar con confirmación (UF / movimiento / asamblea)
 * ============================================================ */

export function BotonEliminar({
  titulo,
  descripcion,
  onEliminar,
  ariaLabel,
}: {
  titulo: string;
  descripcion: string;
  onEliminar: () => Promise<void>;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={ariaLabel}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={titulo}
        description={descripcion}
        confirmLabel="Sí, eliminar"
        variant="destructive"
        onConfirm={async () => {
          try {
            await onEliminar();
            toast({ title: 'Eliminado', description: titulo });
          } catch (err) {
            toast({ variant: 'destructive', title: 'No se pudo eliminar', description: mensajeDe(err) });
          }
        }}
      />
    </>
  );
}
