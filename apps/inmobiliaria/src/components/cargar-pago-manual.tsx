'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, Plus } from 'lucide-react';
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
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { contratosMock } from '@/lib/mock-data';
import { conciliarPago } from '@/lib/conciliacion-storage';
import { formatMonto, formatPeriodo, fechaHoyLocal } from '@/lib/format';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { apiEnabled, apiFetch } from '@/lib/api/client';
import { useContratos, useLiquidaciones } from '@/lib/api/hooks';

// Dialog para que la administradora cargue manualmente un pago que recibió
// (efectivo, transferencia que vino fuera de la app, cheque). Se concilia
// automáticamente porque la admin lo está confirmando.

type MetodoManual = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'MERCADOPAGO';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}

/**
 * Dispatcher: en producción (apiEnabled) el cobro se registra contra el API
 * real (POST /pagos/manual, nace CONCILIADO). En el build demo (!apiEnabled)
 * se mantiene el flujo localStorage de siempre, intacto.
 */
export function CargarPagoManualDialog(props: Props) {
  if (apiEnabled) return <CargarPagoManualApi {...props} />;
  return <CargarPagoManualDemo {...props} />;
}

// Labels de estado de liquidación para el select (sin PAGADO: las pagas no se
// ofrecen — no hay nada que cobrar).
const estadoLiqLabel: Record<string, string> = {
  PENDIENTE: 'pendiente',
  VENCIDO: 'vencida',
  PARCIAL: 'parcial',
};

/**
 * Variante API: era el ÚNICO agujero para registrar en prod un cobro que no
 * pasó por la app — efectivo en la oficina, o el dueño de un contrato de
 * cobranza directa confirmó que cobró (sin esto esos contratos quedaban
 * VENCIDO acumulando mora para siempre). Elegís contrato real → liquidación
 * abierta (con su saldo) → POST /pagos/manual con PIN (mismo régimen que
 * validar: lo exige el server si el usuario tiene PIN configurado).
 */
function CargarPagoManualApi({ open, onOpenChange, onDone }: Props) {
  const qc = useQueryClient();
  const { contratos } = useContratos();
  const { liquidaciones, cargando: cargandoLiqs } = useLiquidaciones();
  const [contratoId, setContratoId] = useState('');
  const [liquidacionId, setLiquidacionId] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoManual>('EFECTIVO');
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [nota, setNota] = useState('');
  const [showPin, setShowPin] = useState(false);
  // Acción pendiente que ejecuta el PIN: null si salió bien o el message del
  // server (PIN inválido, monto supera saldo, liq ya paga) para reintentar.
  const pendingAction = useRef<((pin: string) => Promise<string | null>) | null>(null);

  useEffect(() => {
    if (open) {
      setContratoId('');
      setLiquidacionId('');
      setMonto('');
      setMetodo('EFECTIVO');
      setFecha(fechaHoyLocal());
      setNota('');
      setShowPin(false);
      pendingAction.current = null;
    }
  }, [open]);

  // NO se excluye PROPIETARIO_DIRECTO: este flujo es justamente el camino para
  // registrar "el dueño confirmó que cobró" (la exclusión de caja/KPIs se
  // mantiene aguas abajo — esa plata sigue sin ser ingreso de la inmo).
  const activos = useMemo(
    () => contratos.filter((c) => c.estado === 'ACTIVO'),
    [contratos],
  );
  const contratoSel = activos.find((c) => c.id === contratoId);
  const esDirecto = contratoSel?.modoCobranza === 'PROPIETARIO_DIRECTO';

  // Liquidaciones ABIERTAS del contrato elegido (todo lo no-PAGADO se puede
  // cobrar), la más vieja primero: la deuda se salda en orden.
  const liqsAbiertas = useMemo(
    () =>
      liquidaciones
        .filter((l) => l.contratoId === contratoId && l.estado !== 'PAGADO')
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [liquidaciones, contratoId],
  );
  const liqSel = liqsAbiertas.find((l) => l.id === liquidacionId);

  const guardar = () => {
    if (!contratoSel) {
      toast({ title: 'Elegí un contrato', variant: 'destructive' });
      return;
    }
    if (!liqSel) {
      toast({ title: 'Elegí el período a cobrar', variant: 'destructive' });
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast({ title: 'El monto tiene que ser positivo', variant: 'destructive' });
      return;
    }
    // El campo date se puede vaciar a mano → el server rechazaría con un 400
    // críptico; mejor frenar acá con un mensaje claro.
    if (!fecha || fecha.length !== 10) {
      toast({ title: 'Elegí la fecha de cobro', variant: 'destructive' });
      return;
    }
    const liqId = liqSel.id;
    const notaTrim = nota.trim();
    pendingAction.current = async (pin) => {
      try {
        await apiFetch('/pagos/manual', {
          method: 'POST',
          body: JSON.stringify({
            liquidacionId: liqId,
            monto: montoNum,
            metodo,
            fecha,
            ...(notaTrim ? { nota: notaTrim } : {}),
            pin,
          }),
        });
        // El cobro nace CONCILIADO y mueve la liquidación (PARCIAL/PAGADO):
        // refrescamos bandejas de pagos, cartera, liquidaciones, el detalle
        // del contrato y la caja (cierre del día incluye lo conciliado).
        void qc.invalidateQueries({ queryKey: ['pagos'] });
        void qc.invalidateQueries({ queryKey: ['contratos'] });
        void qc.invalidateQueries({ queryKey: ['contrato'] });
        void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
        void qc.invalidateQueries({ queryKey: ['caja'] });
        toast({
          title: `Pago de ${contratoSel.inquilino} registrado`,
          description: `${formatMonto(montoNum, contratoSel.moneda)} · ${metodo.toLowerCase()} · ${formatPeriodo(liqSel.periodo)}`,
        });
        onOpenChange(false);
        onDone?.();
        return null;
      } catch (e) {
        // El message del server (400/404/409/PIN) se muestra en el diálogo de
        // PIN, que queda abierto para corregir y reintentar.
        return e instanceof Error ? e.message : 'No se pudo registrar el cobro. Probá de nuevo.';
      }
    };
    setShowPin(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              Para cuando recibís el pago en efectivo, por transferencia directa, cheque o
              cualquier vía que no pasó por la app del inquilino.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cpm-contrato" className="text-xs" aria-required>
                Contrato <span className="text-destructive">*</span>
              </Label>
              <select
                id="cpm-contrato"
                value={contratoId}
                onChange={(e) => {
                  setContratoId(e.target.value);
                  // Cambió el contrato → la liq y el monto sugerido ya no aplican.
                  setLiquidacionId('');
                  setMonto('');
                }}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Elegí un contrato…</option>
                {activos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.inquilino} · {c.direccion}
                    {c.modoCobranza === 'PROPIETARIO_DIRECTO' ? ' · cobranza directa' : ''}
                  </option>
                ))}
              </select>
              {esDirecto && (
                <p className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                  Cobranza directa — registrás que el dueño confirmó que cobró. Esa
                  plata no entra a tu caja.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="cpm-liq" className="text-xs" aria-required>
                Período a cobrar <span className="text-destructive">*</span>
              </Label>
              <select
                id="cpm-liq"
                value={liquidacionId}
                onChange={(e) => {
                  const id = e.target.value;
                  setLiquidacionId(id);
                  // Sugerimos el SALDO de la liquidación al elegirla (editable /
                  // borrable — un cobro parcial se carga borrando y reescribiendo).
                  const l = liqsAbiertas.find((x) => x.id === id);
                  setMonto(l && l.saldo > 0 ? String(l.saldo) : '');
                }}
                required
                disabled={!contratoId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {!contratoId
                    ? 'Primero elegí el contrato…'
                    : cargandoLiqs
                      ? 'Cargando liquidaciones…'
                      : liqsAbiertas.length === 0
                        ? 'Este contrato no tiene períodos abiertos'
                        : 'Elegí el período…'}
                </option>
                {liqsAbiertas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {formatPeriodo(l.periodo)} · {estadoLiqLabel[l.estado] ?? l.estado.toLowerCase()} · saldo{' '}
                    {formatMonto(l.saldo, contratoSel?.moneda)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cpm-monto" className="text-xs" aria-required>
                  Monto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cpm-monto"
                  type="number"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0"
                  required
                />
                {liqSel && (
                  <p className="text-[10px] text-muted-foreground">
                    Saldo pendiente: {formatMonto(liqSel.saldo, contratoSel?.moneda)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="cpm-metodo" className="text-xs">Método</Label>
                <select
                  id="cpm-metodo"
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value as MetodoManual)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="MERCADOPAGO">Mercado Pago</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="cpm-fecha" className="text-xs">Fecha de cobro</Label>
              <Input id="cpm-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cpm-nota" className="text-xs">Nota (opcional)</Label>
              <Textarea
                id="cpm-nota"
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej: vino al estudio el viernes, pagó en efectivo."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={guardar} disabled={showPin}>
              <Banknote className="h-4 w-4" />
              Registrar cobro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PinPromptDialog
        abierto={showPin}
        accion="Confirmar cobro manual"
        subaccion={
          contratoSel
            ? `${contratoSel.inquilino} · ${formatMonto(Number(monto) || 0, contratoSel.moneda)}`
            : undefined
        }
        validacion="servidor"
        onClose={() => setShowPin(false)}
        onConfirmado={async (pin) => {
          const run = pendingAction.current;
          if (!run) return null;
          const err = await run(pin);
          if (err) return err; // mantiene el diálogo abierto para reintentar
          pendingAction.current = null;
          return null;
        }}
      />
    </>
  );
}

function CargarPagoManualDemo({ open, onOpenChange, onDone }: Props) {
  const [contratoId, setContratoId] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoManual>('EFECTIVO');
  const [fecha, setFecha] = useState(fechaHoyLocal());
  const [nota, setNota] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (open) {
      setContratoId('');
      setMonto('');
      setMetodo('EFECTIVO');
      setFecha(fechaHoyLocal());
      setNota('');
      setShowPin(false);
    }
  }, [open]);

  const contratoSel = contratosMock.find((c) => c.id === contratoId);

  // El monto del contrato se sugiere UNA sola vez, al elegir el contrato (en el
  // onChange del select). Antes un useEffect con dep [contratoSel, monto] lo
  // reinyectaba cada vez que el campo quedaba vacío → era imposible borrarlo
  // para cargar un pago parcial. Ahora el operador puede borrar y reescribir.

  // Validar y pedir PIN. Conciliar un pago es una acción que el modelo de
  // permisos marca con requierePin (permisos.ts: pago.conciliar) — el resto de
  // los flujos de conciliación pasan por PinPromptDialog. Antes esta ruta
  // llamaba conciliarPago() directo, bypasseando el 2º factor.
  const guardar = () => {
    if (!contratoSel) {
      toast({ title: 'Elegí un contrato', variant: 'destructive' });
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast({ title: 'El monto tiene que ser positivo', variant: 'destructive' });
      return;
    }
    // El campo date se puede vaciar a mano → sin esto el pagoId saldría malformado
    // (pag_manual_cnt_X_) y el registro quedaría sin fecha.
    if (!fecha || fecha.length !== 10) {
      toast({ title: 'Elegí la fecha de cobro', variant: 'destructive' });
      return;
    }
    setShowPin(true);
  };

  // Se ejecuta sólo tras confirmar el PIN. Genera un id sintético y marca el
  // pago como CONCILIADO (no nace de una liquidación → liqId null).
  const confirmarConPin = () => {
    if (!contratoSel) return;
    const montoNum = Number(monto);
    // Sufijo único: dos cobros del mismo contrato en la misma fecha (ej. dos
    // pagos parciales el mismo día) generaban el MISMO id y el segundo pisaba al
    // primero sin aviso. Date.now() los mantiene distintos.
    const pagoId = `pag_manual_${contratoSel.id}_${fecha}_${Date.now()}`;
    conciliarPago(pagoId, 'Roberto Tapia', {
      observacion: `Pago manual · ${metodo} · ${formatMonto(montoNum, contratoSel.moneda)}${nota ? ` · ${nota}` : ''}`,
    });
    toast({
      title: `Pago de ${contratoSel.inquilino} cargado`,
      description: `${formatMonto(montoNum, contratoSel.moneda)} · ${metodo.toLowerCase()}`,
    });
    setShowPin(false);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargar pago manual</DialogTitle>
          <DialogDescription>
            Para cuando recibís el pago en efectivo, por transferencia directa, cheque o
            cualquier vía que no pasó por la app del inquilino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cpm-contrato" className="text-xs" aria-required>
              Contrato <span className="text-destructive">*</span>
            </Label>
            <select
              id="cpm-contrato"
              value={contratoId}
              onChange={(e) => {
                const id = e.target.value;
                setContratoId(id);
                // Sugerimos el monto del contrato al elegirlo (editable/borrable).
                const c = contratosMock.find((x) => x.id === id);
                setMonto(c ? String(c.monto) : '');
              }}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Elegí un contrato…</option>
              {contratosMock
                .filter((c) => c.estado === 'ACTIVO' && c.modoCobranza !== 'PROPIETARIO_DIRECTO')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.inquilino} · {c.direccion}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cpm-monto" className="text-xs" aria-required>
                Monto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cpm-monto"
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                required
              />
              {contratoSel && (
                <p className="text-[10px] text-muted-foreground">
                  Sugerido: {formatMonto(contratoSel.monto, contratoSel.moneda)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cpm-metodo" className="text-xs">Método</Label>
              <select
                id="cpm-metodo"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoManual)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
                <option value="MERCADOPAGO">Mercado Pago</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cpm-fecha" className="text-xs">Fecha de cobro</Label>
            <Input id="cpm-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cpm-nota" className="text-xs">Nota (opcional)</Label>
            <Textarea
              id="cpm-nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: vino al estudio el viernes, pagó en efectivo."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar}>
            <Banknote className="h-4 w-4" />
            Registrar cobro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <PinPromptDialog
      abierto={showPin}
      accion="Confirmar cobro manual"
      subaccion={contratoSel ? `${contratoSel.inquilino} · ${formatMonto(Number(monto) || 0, contratoSel.moneda)}` : undefined}
      onClose={() => setShowPin(false)}
      onConfirmado={() => confirmarConPin()}
    />
    </>
  );
}

/** Botón compacto para abrir el dialog. Reusable desde cualquier pantalla. */
export function CargarPagoManualButton({
  variant = 'default',
}: {
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Cargar pago
      </Button>
      <CargarPagoManualDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
