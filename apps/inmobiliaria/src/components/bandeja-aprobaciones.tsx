'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSignature,
  Inbox,
  KeyRound,
  Landmark,
  Trash2,
  Undo,
  XCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import {
  type Aprobacion,
  type ContextoContrato,
  type TipoAprobacion,
  TIPO_APROBACION_LABEL,
} from '@/lib/aprobaciones-storage';
import { useAprobaciones } from '@/lib/api/hooks';
import { apiEnabled } from '@/lib/api/client';
import { formatFechaCorta, formatMonto } from '@/lib/format';

const ICONO_TIPO: Record<TipoAprobacion, typeof Inbox> = {
  CONTRATO_CARGADO: FileSignature,
  GASTO_CAJA_ELIMINACION: Trash2,
  DEVOLUCION_DEPOSITO: Undo,
  AJUSTE_FUERA_DE_INDICE: Landmark,
};

const USUARIO_ACTUAL = 'Roberto Tapia';

export function BandejaAprobaciones() {
  const { aprobaciones: items, cargando, aprobarApi, rechazarApi } = useAprobaciones();
  const [filtro, setFiltro] = useState<'pendientes' | 'historico'>('pendientes');
  const [aprobar_, setAprobar_] = useState<Aprobacion | null>(null);
  const [rechazar_, setRechazar_] = useState<Aprobacion | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [comentarioAprob, setComentarioAprob] = useState('');
  const [showPin, setShowPin] = useState(false);
  // useRef evita el problema de stale closure: ConfirmDialog llama
  // onOpenChange(false) DESPUÉS de onConfirm(), cuando showPin todavía
  // es false en el closure. Con el ref leemos el valor al momento de
  // la invocación, no al de la captura.
  const transitioningToPin = useRef(false);

  const filtrados = useMemo(() => {
    if (filtro === 'pendientes')
      return items.filter((i) => i.estado === 'PENDIENTE');
    return items.filter((i) => i.estado !== 'PENDIENTE');
  }, [items, filtro]);

  const pendientes = useMemo(
    () => items.filter((i) => i.estado === 'PENDIENTE').length,
    [items],
  );

  // Devuelve null si salió bien (el diálogo de PIN cierra) o el mensaje de
  // error si el server rechazó (PIN incorrecto, etc.): el diálogo lo muestra
  // inline y queda abierto para reintentar, sin romper el estado del ítem.
  const onPinConfirmado = async (pin: string): Promise<string | null> => {
    try {
      if (aprobar_) {
        const r = await aprobarApi(aprobar_.id, pin, comentarioAprob || undefined);
        toast({ variant: 'success', title: 'Aprobada', description: r.titulo });
        setAprobar_(null);
        setComentarioAprob('');
      } else if (rechazar_) {
        const r = await rechazarApi(rechazar_.id, pin, motivoRechazo.trim());
        toast({ variant: 'default', title: 'Rechazada', description: r.titulo });
        setRechazar_(null);
        setMotivoRechazo('');
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'No se pudo completar. Probá de nuevo.';
    }
  };

  // El rechazo también es acción sensible: valida motivo y pasa por el PIN.
  const ejecutarRechazo = () => {
    if (!rechazar_) return;
    // El motivo es obligatorio (lo recibe quien cargó) y el API exige mínimo 5
    // caracteres. Antes el front sólo chequeaba no-vacío → con 1-4 chars el 400 del
    // backend recién aparecía DESPUÉS de tipear el PIN. Validamos lo mismo acá.
    if (motivoRechazo.trim().length < 5) {
      toast({
        variant: 'destructive',
        title: 'Falta el motivo',
        description: 'Escribí por qué lo rechazás (mínimo 5 caracteres): se lo avisamos a quien lo cargó.',
      });
      return;
    }
    transitioningToPin.current = true;
    setShowPin(true);
  };

  if (cargando) return null;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
                {pendientes > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {pendientes}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">Bandeja de aprobaciones</p>
                <p className="text-xs text-muted-foreground">
                  {pendientes === 0
                    ? 'Sin pendientes. Buen trabajo.'
                    : `${pendientes} ítem${pendientes === 1 ? '' : 's'} esperando tu visto.`}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filtro === 'pendientes' ? 'default' : 'outline'}
                aria-pressed={filtro === 'pendientes'}
                onClick={() => setFiltro('pendientes')}
              >
                Pendientes
              </Button>
              <Button
                size="sm"
                variant={filtro === 'historico' ? 'default' : 'outline'}
                aria-pressed={filtro === 'historico'}
                onClick={() => setFiltro('historico')}
              >
                Histórico
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {filtro === 'pendientes'
              ? 'No tenés solicitudes pendientes de aprobar.'
              : 'No hay solicitudes en el histórico.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((a) => (
            <AprobacionCard
              key={a.id}
              aprobacion={a}
              disabled={!!aprobar_ || !!rechazar_}
              onAprobar={() => setAprobar_(a)}
              onRechazar={() => setRechazar_(a)}
            />
          ))}
        </div>
      )}

      {/* Dialog confirmación con comentario opcional.
          IMPORTANTE: ConfirmDialog.handleConfirm() llama onOpenChange(false)
          explícitamente después de onConfirm(). Guardamos la transición en un
          ref (no state) para evitar el stale closure: cuando onOpenChange
          se invoca, transitioningToPin.current ya es true y podemos bloquearlo. */}
      <ConfirmDialog
        open={!!aprobar_}
        onOpenChange={(o) => !o && !transitioningToPin.current && setAprobar_(null)}
        title={aprobar_ ? `¿Aprobar "${aprobar_.titulo}"?` : ''}
        description={
          aprobar_ ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Cargado por{' '}
                <strong className="text-foreground">{aprobar_.cargadoPor}</strong>{' '}
                el {formatFechaCorta(aprobar_.cargadoAt)}.
              </p>
              <div className="space-y-2">
                <Label htmlFor="apr-coment">Comentario (opcional)</Label>
                <Textarea
                  id="apr-coment"
                  rows={2}
                  placeholder="Notas internas o instrucciones de seguimiento."
                  value={comentarioAprob}
                  onChange={(e) => setComentarioAprob(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Al confirmar, la aprobación queda registrada con tu nombre.
              </div>
            </div>
          ) : null
        }
        confirmLabel="Confirmar aprobación"
        onConfirm={() => {
          transitioningToPin.current = true;
          setShowPin(true);
        }}
      />

      <PinPromptDialog
        abierto={showPin}
        accion={(aprobar_ ?? rechazar_)?.titulo ?? 'Aprobación'}
        subaccion={(() => {
          const item = aprobar_ ?? rechazar_;
          return item ? `${TIPO_APROBACION_LABEL[item.tipo]} · cargado por ${item.cargadoPor}` : undefined;
        })()}
        validacion={apiEnabled ? 'servidor' : 'local'}
        onClose={() => {
          transitioningToPin.current = false;
          setShowPin(false);
          // Limpiar el estado que abre los ConfirmDialog: si no, al cancelar el
          // PIN reaparece el diálogo de aprobar/rechazar.
          setAprobar_(null);
          setRechazar_(null);
        }}
        onConfirmado={(pin) => onPinConfirmado(pin)}
      />

      <ConfirmDialog
        open={!!rechazar_}
        onOpenChange={(o) => !o && !transitioningToPin.current && setRechazar_(null)}
        title={rechazar_ ? `¿Rechazar "${rechazar_.titulo}"?` : ''}
        description={
          rechazar_ ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Avisamos a {rechazar_.cargadoPor} con el motivo.
              </p>
              <div className="space-y-2">
                <Label htmlFor="rech-mot">Motivo del rechazo</Label>
                <Input
                  id="rech-mot"
                  placeholder="Ej: faltó adjuntar el comprobante"
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                />
              </div>
            </div>
          ) : null
        }
        confirmLabel="Rechazar solicitud"
        variant="destructive"
        onConfirm={ejecutarRechazo}
      />
    </div>
  );
}

interface CardProps {
  aprobacion: Aprobacion;
  disabled?: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
}

function AprobacionCard({ aprobacion, disabled = false, onAprobar, onRechazar }: CardProps) {
  const Icon = ICONO_TIPO[aprobacion.tipo];
  const pendiente = aprobacion.estado === 'PENDIENTE';
  const iniciales = aprobacion.cargadoPor
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <Card
      className={pendiente ? 'border-l-4 border-l-primary' : 'opacity-75'}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold">{aprobacion.titulo}</p>
              <Badge
                variant={
                  aprobacion.estado === 'APROBADA'
                    ? 'success'
                    : aprobacion.estado === 'RECHAZADA'
                      ? 'destructive'
                      : 'warning'
                }
                className="text-[9px]"
              >
                {aprobacion.estado.charAt(0) + aprobacion.estado.slice(1).toLowerCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {aprobacion.descripcion}
            </p>
            {aprobacion.monto && (
              <p className="text-sm font-semibold tabular-nums text-primary">
                {formatMonto(aprobacion.monto)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-muted text-[8px]">
              {iniciales}
            </AvatarFallback>
          </Avatar>
          <span>
            <strong className="text-foreground">{aprobacion.cargadoPor}</strong> ·{' '}
            {aprobacion.rolAutor}
          </span>
          <Clock className="h-3 w-3" />
          <span>{formatFechaCorta(aprobacion.cargadoAt)}</span>
        </div>

        {/* QUÉ se está aprobando. Sin esto, aprobar activaba el contrato, reclamaba
            la propiedad, devengaba las liquidaciones y aplicaba la deuda histórica
            declarada — todo a partir del título y una línea de descripción. */}
        {aprobacion.contexto && <ResumenContrato ctx={aprobacion.contexto} />}

        {aprobacion.notas && (
          <p className="rounded-md border bg-muted/40 p-2 text-xs italic text-muted-foreground">
            “{aprobacion.notas}”
          </p>
        )}

        {!pendiente && aprobacion.comentarioAprobador && (
          <p className="rounded-md border bg-muted/40 p-2 text-xs">
            <strong>{aprobacion.aprobadoPor}:</strong>{' '}
            {aprobacion.comentarioAprobador}
          </p>
        )}

        {pendiente && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={onAprobar} disabled={disabled}>
              <CheckCircle2 className="h-4 w-4" />
              Aprobar
            </Button>
            <Button size="sm" variant="outline" onClick={onRechazar} disabled={disabled}>
              <XCircle className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Un dato del resumen. Sin valor no se dibuja: mejor ausente que un "—" que se lee como cero. */
function Dato({ label, valor }: { label: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

/**
 * El contrato que se está por aprobar, resumido. La bandeja mostraba sólo el título
 * congelado al cargarlo; esto es el contrato REAL leído por el server en el momento
 * de abrir la bandeja, más el link para ir a verlo entero antes de decidir.
 */
function ResumenContrato({ ctx }: { ctx: ContextoContrato }) {
  const moneda = ctx.moneda === 'USD' ? 'USD' : 'ARS';
  const monto = Number(ctx.monto);
  const expensas = ctx.montoExpensas != null ? Number(ctx.montoExpensas) : null;
  const deposito = ctx.depositoGarantia != null ? Number(ctx.depositoGarantia) : null;
  // Un contrato que ya no está en BORRADOR no debería tener una aprobación pendiente:
  // si pasa, lo decimos en vez de dejar que se apriete Aprobar contra un 409 críptico.
  const yaResuelto = ctx.estadoContrato !== 'BORRADOR';

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold">{ctx.propiedad}</p>
        <Link
          href={`/contratos/${ctx.contratoId}`}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          Ver contrato completo
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <Dato label="Inquilino" valor={ctx.inquilino} />
        <Dato label="Alquiler" valor={Number.isFinite(monto) ? formatMonto(monto, moneda) : null} />
        <Dato
          label="Expensas"
          valor={expensas != null && Number.isFinite(expensas) ? formatMonto(expensas, moneda) : null}
        />
        <Dato label="Desde" valor={formatFechaCorta(ctx.fechaInicio)} />
        <Dato label="Hasta" valor={formatFechaCorta(ctx.fechaFin)} />
        <Dato label="Día de pago" valor={String(ctx.diaPago)} />
        <Dato
          label="Depósito"
          valor={deposito != null && Number.isFinite(deposito) ? formatMonto(deposito, moneda) : null}
        />
        <Dato
          label="Cobranza"
          valor={
            ctx.modoCobranza === 'PROPIETARIO_DIRECTO'
              ? `Directo a ${ctx.cobraDirectoA?.nombre ?? 'el propietario'}`
              : 'Cuenta recaudadora'
          }
        />
      </dl>

      {/* Cobranza directa sin cuenta cargada: aprobar deja al inquilino sin a dónde
          pagar. Se avisa acá, no después de que la plata no llegue. */}
      {ctx.modoCobranza === 'PROPIETARIO_DIRECTO' && ctx.cobraDirectoA?.tieneCuenta === false && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Cobra directo el propietario, pero no tiene cuenta cargada: el inquilino no va a
          tener a dónde transferir.
        </p>
      )}

      {/* Lo más caro de aprobar a ciegas: la deuda vieja declarada en el alta se
          cobra recién cuando se aprueba. */}
      {ctx.deudaDeclarada && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Declara <strong>{ctx.deudaDeclarada.periodos}</strong>{' '}
            {ctx.deudaDeclarada.periodos === 1 ? 'período anterior' : 'períodos anteriores'} (
            {ctx.deudaDeclarada.desde} a {ctx.deudaDeclarada.hasta}), de los cuales{' '}
            <strong>{ctx.deudaDeclarada.adeudan}</strong> quedan adeudados. Se le cobran al
            inquilino al aprobar.
          </span>
        </p>
      )}

      {ctx.deudaIlegible && (
        <p className="flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          El estado inicial declarado en el alta no se puede leer. Revisá el contrato antes
          de aprobar.
        </p>
      )}

      {yaResuelto && (
        <p className="flex items-start gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          El contrato ya está en estado {ctx.estadoContrato}. Refrescá la bandeja: puede
          haberlo resuelto otra persona.
        </p>
      )}
    </div>
  );
}
