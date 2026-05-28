'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  FileText,
  ReceiptText,
  RotateCcw,
  Sparkles,
  XCircle,
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
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  contratosMock,
  pagosInformadosMock,
  propiedadesMock,
  propietariosMock,
  type PagoInformado,
} from '@/lib/mock-data';
import { formatFechaCorta, formatMonto, formatPeriodo } from '@/lib/format';
import {
  conciliarPago,
  estadoDePago,
  rechazarPago,
  revertirAccion,
} from '@/lib/conciliacion-storage';
import { registrarEvento } from '@/lib/auditoria-storage';
import {
  extraerComprobante,
  puedeConciliarAutomatico,
  type ExtraccionIA,
} from '@/lib/extraccion-ia';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';

// Sección "Por validar" en /pagos del admin. Muestra los comprobantes que
// los inquilinos subieron y todavía no fueron conciliados. Cuando el admin
// confirma o rechaza, se persiste en localStorage y el pago se saca de la
// lista visible.

const metodoLabel: Record<PagoInformado['metodo'], string> = {
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'Mercado Pago',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
};

interface PagosPorValidarProps {
  /** Se dispara cuando el conteo de pendientes cambia (post-acción del admin).
   *  Permite al padre actualizar contadores externos sin re-leer storage. */
  onChange?: (pendientesRestantes: number) => void;
}

export function PagosPorValidar({ onChange }: PagosPorValidarProps = {}) {
  const [acciones, setAcciones] = useState<Record<string, 'CONCILIADO' | 'RECHAZADO'>>({});
  const [hidratado, setHidratado] = useState(false);
  const [verComprobante, setVerComprobante] = useState<PagoInformado | null>(null);
  const [rechazando, setRechazando] = useState<PagoInformado | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinAccion, setPinAccion] = useState('');
  const [pinSubaccion, setPinSubaccion] = useState<string | undefined>(undefined);
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    setHidratado(true);
    refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refrescar = () => {
    const map: Record<string, 'CONCILIADO' | 'RECHAZADO'> = {};
    pagosInformadosMock.forEach((p) => {
      const e = estadoDePago(p.id);
      if (e !== 'INFORMADO') map[p.id] = e;
    });
    setAcciones(map);
    const pendientesRestantes = pagosInformadosMock.length - Object.keys(map).length;
    onChange?.(pendientesRestantes);
  };

  const pendientes = useMemo(
    () => pagosInformadosMock.filter((p) => !acciones[p.id]),
    [acciones],
  );

  const handleConciliar = (pago: PagoInformado) => {
    conciliarPago(pago.id, 'Roberto Tapia', { liqId: pago.liquidacionId });
    registrarEvento({
      tipo: 'PAGO_CONCILIADO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: pago.id,
      entidadDescripcion: `Pago de ${pago.inquilino} · ${formatPeriodo(pago.periodo)}`,
      detalle: `${formatMonto(pago.monto)} · ${pago.metodo.toLowerCase()}`,
    });

    // Resolver propietario del contrato (por modoCobranza directo o por
    // propietariosIds de la propiedad asociada).
    const contrato = contratosMock.find((c) => c.id === pago.contratoId);
    const propiedad = propiedadesMock.find((p) => p.contratoActualId === pago.contratoId);
    const propietarioId =
      contrato?.cobraDirectoPropietarioId ?? propiedad?.propietariosIds[0] ?? null;
    const propietario = propietarioId
      ? propietariosMock.find((p) => p.id === propietarioId)
      : null;

    // Si el contrato es modo DIRECTO, registrar la confirmación del propietario
    // (en el flujo real el propietario confirma desde su lado; acá lo simulamos
    // automáticamente cuando el admin aprueba).
    if (contrato?.modoCobranza === 'PROPIETARIO_DIRECTO' && propietario) {
      registrarEvento({
        tipo: 'PROPIETARIO_CONFIRMO_RECIBO',
        autor: `${propietario.nombre} ${propietario.apellido}`,
        rolAutor: 'PROPIETARIO',
        entidadId: pago.id,
        entidadDescripcion: `Pago de ${pago.inquilino} · ${formatPeriodo(pago.periodo)}`,
        detalle: 'Confirmó que recibió el depósito en su cuenta',
      });
    }

    // Si el propietario tiene ARCA conectada, emitir factura automática
    if (propietario?.afip?.conectado) {
      const tipoComp = (propietario.afip.tipoComprobante ?? 'FACTURA_C').replace('_', ' ');
      const numero = `${propietario.afip.puntoVenta ?? '0001'}-${String(
        Math.floor(Math.random() * 99999),
      ).padStart(8, '0')}`;
      registrarEvento({
        tipo: 'FACTURA_ARCA_EMITIDA',
        autor: 'Sistema (ARCA)',
        rolAutor: 'SISTEMA',
        entidadId: pago.id,
        entidadDescripcion: `${tipoComp} N° ${numero} · ${propietario.nombre} ${propietario.apellido}`,
        detalle: `Enviada por WhatsApp y mail a ${pago.inquilino} · ${formatMonto(pago.monto)}`,
      });
      toast({
        title: '✅ Pago conciliado + factura ARCA emitida',
        description: `${tipoComp} N° ${numero} enviada a ${pago.inquilino} por WhatsApp y mail.`,
      });
    } else {
      const esParcial = pago.tipo === 'PARCIAL';
      const saldoRest = esParcial
        ? Math.max(0, (pago.montoLiqTotal ?? 0) - pago.monto)
        : 0;
      toast({
        title: esParcial
          ? `Parcial de ${pago.inquilino} confirmado`
          : `Pago de ${pago.inquilino} confirmado`,
        description: esParcial
          ? `${formatMonto(pago.monto)} acreditado · saldo restante ${formatMonto(saldoRest)}`
          : propietario
            ? `${formatMonto(pago.monto)} · sin facturación ARCA (propietario sin conectar)`
            : `${formatMonto(pago.monto)} · ${formatPeriodo(pago.periodo)}`,
      });
    }

    refrescar();
  };

  const handleRechazar = (pago: PagoInformado, motivo: string) => {
    rechazarPago(pago.id, 'Roberto Tapia', motivo, { liqId: pago.liquidacionId });
    registrarEvento({
      tipo: 'PAGO_RECHAZADO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: pago.id,
      entidadDescripcion: `Pago de ${pago.inquilino} · ${formatPeriodo(pago.periodo)}`,
      detalle: motivo,
    });
    refrescar();
    toast({
      title: 'Pago rechazado',
      description: `Le avisamos a ${pago.inquilino} por WhatsApp y en la app con tu nota.`,
    });
  };

  /** Revierte un pago previamente conciliado o rechazado. Vuelve al estado
   *  INFORMADO para que el admin pueda volver a decidir. */
  const handleRevertir = (pago: PagoInformado) => {
    const prev = revertirAccion(pago.id);
    if (!prev) return;
    registrarEvento({
      tipo: 'PAGO_REVERTIDO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: pago.id,
      entidadDescripcion: `Pago de ${pago.inquilino} · ${formatPeriodo(pago.periodo)}`,
      detalle: `Revertido el ${prev.estado === 'CONCILIADO' ? 'OK' : 'rechazo'} dado por ${prev.decidiSPor}`,
    });
    refrescar();
    toast({
      title: 'Acción revertida',
      description: `El pago vuelve a estado "Por validar".`,
    });
  };

  const triggerConciliar = (pago: PagoInformado) => {
    setPinAccion('Conciliar pago');
    setPinSubaccion(`${pago.inquilino} · ${formatMonto(pago.monto)}`);
    pendingAction.current = () => handleConciliar(pago);
    setShowPin(true);
  };

  const triggerRevertir = (pago: PagoInformado) => {
    setPinAccion('Revertir conciliación');
    setPinSubaccion(`${pago.inquilino} · ${formatPeriodo(pago.periodo)}`);
    pendingAction.current = () => handleRevertir(pago);
    setShowPin(true);
  };

  // Lista de pagos ya conciliados/rechazados (resueltos) para mostrar
  // abajo y poder revertir si hubo error.
  const resueltos = useMemo(
    () => pagosInformadosMock.filter((p) => acciones[p.id]),
    [acciones],
  );

  if (!hidratado) return null;
  if (pendientes.length === 0 && resueltos.length === 0) return null;

  return (
    <>
      {pendientes.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-base font-semibold">Pagos por validar</h2>
              </div>
              <Badge variant="warning" className="shrink-0">
                {pendientes.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Tus inquilinos informaron estos pagos. Verificá el comprobante y confirmá o
              rechazá.
            </p>

            <div className="space-y-3">
              {pendientes.map((p) => (
                <PagoRow
                  key={p.id}
                  pago={p}
                  onConciliar={() => triggerConciliar(p)}
                  onRechazar={() => setRechazando(p)}
                  onVerComprobante={() => setVerComprobante(p)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagos ya resueltos (conciliados o rechazados) — se pueden revertir */}
      {resueltos.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Resueltos recientes</h3>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {resueltos.length}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Si te equivocaste, podés revertir la decisión — vuelve a aparecer como
              &quot;Por validar&quot;.
            </p>
            <div className="divide-y rounded-md border">
              {resueltos.map((p) => (
                <ResueltoRow
                  key={p.id}
                  pago={p}
                  estado={acciones[p.id]!}
                  onRevertir={() => triggerRevertir(p)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal comprobante */}
      <Dialog open={!!verComprobante} onOpenChange={(v) => !v && setVerComprobante(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comprobante de {verComprobante?.inquilino}</DialogTitle>
            <DialogDescription>
              {verComprobante &&
                `${formatPeriodo(verComprobante.periodo)} · ${formatMonto(verComprobante.monto)} · ${metodoLabel[verComprobante.metodo]}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid h-48 place-items-center rounded-md border bg-muted text-center text-xs text-muted-foreground">
              <div className="space-y-1">
                <FileText className="mx-auto h-10 w-10" />
                <p>Vista del comprobante (PDF/imagen)</p>
                <p>En producción se carga acá el archivo real.</p>
              </div>
            </div>
            {verComprobante && (
              <ExtraccionIABlock
                extraccion={extraerComprobante(verComprobante.id, verComprobante.monto, {
                  fechaEsperada: verComprobante.fechaTransferencia,
                  nombreInquilinoHint: verComprobante.inquilino,
                })}
                montoEsperado={verComprobante.monto}
                fechaDeclarada={verComprobante.fechaTransferencia}
              />
            )}
            {verComprobante?.notaInquilino && (
              <div className="rounded-md bg-muted/50 p-3 text-xs">
                <p className="font-medium">Nota del inquilino:</p>
                <p className="text-muted-foreground">{verComprobante.notaInquilino}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (!verComprobante) return;
                  setRechazando(verComprobante);
                  setVerComprobante(null);
                }}
              >
                <XCircle className="h-4 w-4" />
                Rechazar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!verComprobante) return;
                  const pago = verComprobante;
                  setVerComprobante(null);
                  triggerConciliar(pago);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal rechazo con motivo */}
      <Dialog
        open={!!rechazando}
        onOpenChange={(v) => {
          if (!v) {
            setRechazando(null);
            setMotivoRechazo('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar el pago de {rechazando?.inquilino}</DialogTitle>
            <DialogDescription>
              Le va a llegar la notificación con tu motivo. Probá ser claro para que
              corrija rápido.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Ej: el comprobante no se ve, mandá la imagen de nuevo."
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRechazando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (!rechazando) return;
                if (!motivoRechazo.trim()) {
                  toast({ title: 'Tenés que escribir el motivo', variant: 'destructive' });
                  return;
                }
                const pagoCapturado = rechazando;
                const motivoCapturado = motivoRechazo.trim();
                setRechazando(null);
                setMotivoRechazo('');
                setPinAccion('Rechazar pago');
                setPinSubaccion(`${pagoCapturado.inquilino} · "${motivoCapturado}"`);
                pendingAction.current = () => handleRechazar(pagoCapturado, motivoCapturado);
                setShowPin(true);
              }}
            >
              Rechazar pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PinPromptDialog
        abierto={showPin}
        accion={pinAccion}
        subaccion={pinSubaccion}
        onClose={() => setShowPin(false)}
        onConfirmado={() => {
          pendingAction.current?.();
          pendingAction.current = null;
        }}
      />
    </>
  );
}

function PagoRow({
  pago,
  onConciliar,
  onRechazar,
  onVerComprobante,
}: {
  pago: PagoInformado;
  onConciliar: () => void;
  onRechazar: () => void;
  onVerComprobante: () => void;
}) {
  const contrato = contratosMock.find((c) => c.id === pago.contratoId);
  const propiedad = propiedadesMock.find((p) => p.contratoActualId === pago.contratoId);
  const propietarioId =
    contrato?.cobraDirectoPropietarioId ?? propiedad?.propietariosIds[0] ?? null;
  const propietario = propietarioId
    ? propietariosMock.find((p) => p.id === propietarioId)
    : null;
  const modoDirecto = contrato?.modoCobranza === 'PROPIETARIO_DIRECTO';
  const afipOn = !!propietario?.afip?.conectado;
  const esParcial = pago.tipo === 'PARCIAL' && pago.montoLiqTotal !== undefined;
  const saldoRestanteLiq = esParcial
    ? Math.max(0, (pago.montoLiqTotal ?? 0) - pago.monto)
    : 0;

  // Lectura por IA del comprobante. En la demo se genera determinístico
  // a partir del pago.id; en backend real esto vendría persistido junto
  // al PagoInformado (campo `extraccionIA`).
  const extraccion: ExtraccionIA = extraerComprobante(pago.id, pago.monto, {
    fechaEsperada: pago.fechaTransferencia,
    nombreInquilinoHint: pago.inquilino,
  });
  const autoOk = puedeConciliarAutomatico(extraccion);

  return (
    <Card className="space-y-3 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Banknote className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{pago.inquilino}</p>
            <p className="truncate text-xs text-muted-foreground">{pago.direccion}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {esParcial && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300"
                >
                  Parcial
                </Badge>
              )}
              {modoDirecto && (
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  title="El inquilino transfirió directo a la cuenta del propietario. La inmobiliaria sólo audita el pago."
                >
                  Cobranza directa al propietario · {propietario?.nombre ?? '—'}
                </Badge>
              )}
              {afipOn && (
                <Badge variant="secondary" className="text-[10px]">
                  ARCA conectada
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums">
            {formatMonto(pago.monto)}
          </p>
          {esParcial && (
            <p className="text-[10px] text-muted-foreground">
              de {formatMonto(pago.montoLiqTotal ?? 0)} · saldo{' '}
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {formatMonto(saldoRestanteLiq)}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs">
        <Field label="Período" value={formatPeriodo(pago.periodo)} />
        <Field label="Método" value={metodoLabel[pago.metodo]} />
        <Field label="Fecha declarada" value={formatFechaCorta(pago.fechaTransferencia)} />
        <Field
          label="Informado"
          value={`${formatFechaCorta(pago.informadoAt)} ${new Date(pago.informadoAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
        />
      </div>

      <ExtraccionIABlock
        extraccion={extraccion}
        montoEsperado={pago.monto}
        fechaDeclarada={pago.fechaTransferencia}
      />

      {pago.notaInquilino && (
        <p className="rounded-md bg-muted/30 p-2 text-xs italic text-muted-foreground">
          “{pago.notaInquilino}”
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onVerComprobante}>
          <ExternalLink className="h-3.5 w-3.5" />
          Ver comprobante
        </Button>
        <Button size="sm" variant="outline" onClick={onRechazar}>
          <XCircle className="h-3.5 w-3.5" />
          Rechazar
        </Button>
        <Button
          size="sm"
          onClick={onConciliar}
          className={`ml-auto ${autoOk ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          title={
            autoOk
              ? 'IA validó todo — conciliamos y emitimos comprobante de una.'
              : afipOn
                ? 'El propietario tiene ARCA conectada — al confirmar, emitimos factura automática y se la mandamos al inquilino.'
                : 'Confirmamos el pago. La factura/recibo la emite el propietario por su cuenta (no tiene ARCA conectada).'
          }
        >
          {autoOk ? <Sparkles className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {autoOk
            ? 'Conciliar automático'
            : afipOn
              ? 'Confirmar + facturar ARCA'
              : 'Confirmar pago'}
        </Button>
      </div>
    </Card>
  );
}

/**
 * Panel "Lectura por IA" del comprobante. Muestra los campos detectados
 * y badges verde/rojo de match contra lo esperado.
 *
 * Si confianza alta + todos los matches en verde → se muestra una
 * banda verde "Listo para conciliar automático". Si hay algún
 * mismatch → banda amarilla "Revisar manualmente".
 */
function ExtraccionIABlock({
  extraccion,
  montoEsperado,
  fechaDeclarada,
}: {
  extraccion: ExtraccionIA;
  montoEsperado: number;
  /** Fecha que el inquilino dijo al informar el pago — la usamos para
   * mostrar la divergencia cuando la IA leyó otra cosa del comprobante. */
  fechaDeclarada: string;
}) {
  const auto = puedeConciliarAutomatico(extraccion);
  return (
    <div
      className={`space-y-2 rounded-md border p-3 ${
        auto
          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10'
          : 'border-amber-300 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10'
      }`}
    >
      <div className="flex items-center gap-2">
        <Sparkles
          className={`h-3.5 w-3.5 ${
            auto ? 'text-emerald-600' : 'text-amber-600'
          }`}
        />
        <p
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            auto ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {auto
            ? 'Lectura por IA · Todo OK, listo para conciliar'
            : `Lectura por IA · ${extraccion.confianza === 'baja' ? 'Revisar manualmente' : 'Revisá los datos'}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] md:grid-cols-3">
        <FieldIA
          label="Monto"
          valor={formatMonto(extraccion.monto)}
          match={extraccion.matchMonto}
          hint={!extraccion.matchMonto ? `Esperado ${formatMonto(montoEsperado)}` : undefined}
        />
        <FieldIA
          label="Fecha en comprobante"
          valor={formatFechaCorta(extraccion.fechaTransferencia)}
          match={extraccion.matchFecha}
          hint={
            !extraccion.matchFecha
              ? `El inquilino declaró ${formatFechaCorta(fechaDeclarada)}`
              : undefined
          }
        />
        <FieldIA label="N° operación" valor={extraccion.nroOperacion} />
        <FieldIA label="Banco origen" valor={extraccion.bancoOrigen} />
        <FieldIA label="Titular" valor={extraccion.titularOrigen} />
        <FieldIA label="CUIT" valor={extraccion.cuitOrigen} />
      </div>
    </div>
  );
}

function FieldIA({
  label,
  valor,
  match,
  hint,
}: {
  label: string;
  valor: string;
  match?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {match !== undefined && (
          <span
            className={
              match
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }
            aria-label={match ? 'Match OK' : 'Diferencia detectada'}
          >
            {match ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          </span>
        )}
      </div>
      <p className="truncate font-medium tabular-nums">{valor}</p>
      {hint && (
        <p className="text-[9px] text-amber-700 dark:text-amber-300">{hint}</p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('min-w-0')}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}

function ResueltoRow({
  pago,
  estado,
  onRevertir,
}: {
  pago: PagoInformado;
  estado: 'CONCILIADO' | 'RECHAZADO';
  onRevertir: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-md',
          estado === 'CONCILIADO'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        )}
      >
        {estado === 'CONCILIADO' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{pago.inquilino}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatPeriodo(pago.periodo)} · {formatMonto(pago.monto)} ·{' '}
          {estado === 'CONCILIADO' ? 'Confirmado' : 'Rechazado'}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onRevertir}>
        <RotateCcw className="h-3.5 w-3.5" />
        Revertir
      </Button>
    </div>
  );
}
