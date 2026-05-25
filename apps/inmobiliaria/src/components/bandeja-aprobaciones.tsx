'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileSignature,
  Inbox,
  KeyRound,
  Landmark,
  Trash2,
  Undo,
  Wallet,
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
  type TipoAprobacion,
  TIPO_APROBACION_LABEL,
  aprobar,
  listarAprobaciones,
  rechazar,
} from '@/lib/aprobaciones-storage';
import { formatFecha, formatFechaCorta, formatMonto } from '@/lib/format';

const ICONO_TIPO: Record<TipoAprobacion, typeof Inbox> = {
  CONTRATO_CARGADO: FileSignature,
  PAGO_MANUAL: Wallet,
  GASTO_CAJA_ELIMINACION: Trash2,
  DEVOLUCION_DEPOSITO: Undo,
  AJUSTE_FUERA_DE_INDICE: Landmark,
};

const USUARIO_ACTUAL = 'Roberto Tapia';

export function BandejaAprobaciones() {
  const [items, setItems] = useState<Aprobacion[]>([]);
  const [hidratado, setHidratado] = useState(false);
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

  useEffect(() => {
    setItems(listarAprobaciones());
    setHidratado(true);
  }, []);

  const filtrados = useMemo(() => {
    if (filtro === 'pendientes')
      return items.filter((i) => i.estado === 'PENDIENTE');
    return items.filter((i) => i.estado !== 'PENDIENTE');
  }, [items, filtro]);

  const pendientes = useMemo(
    () => items.filter((i) => i.estado === 'PENDIENTE').length,
    [items],
  );

  const onPinConfirmado = () => {
    if (!aprobar_) return;
    const actualizada = aprobar(aprobar_.id, USUARIO_ACTUAL, comentarioAprob || undefined);
    if (actualizada) {
      setItems(listarAprobaciones());
      toast({
        variant: 'success',
        title: 'Aprobada',
        description: actualizada.titulo,
      });
    }
    setAprobar_(null);
    setComentarioAprob('');
  };

  const ejecutarRechazo = () => {
    if (!rechazar_ || !motivoRechazo.trim()) return;
    const actualizada = rechazar(rechazar_.id, USUARIO_ACTUAL, motivoRechazo.trim());
    if (actualizada) {
      setItems(listarAprobaciones());
      toast({
        variant: 'default',
        title: 'Rechazada',
        description: actualizada.titulo,
      });
    }
    setRechazar_(null);
    setMotivoRechazo('');
  };

  if (!hidratado) return null;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
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
                onClick={() => setFiltro('pendientes')}
              >
                Pendientes
              </Button>
              <Button
                size="sm"
                variant={filtro === 'historico' ? 'default' : 'outline'}
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
                Al confirmar te pedimos el PIN del usuario.
              </div>
            </div>
          ) : null
        }
        confirmLabel="Confirmar y pedir PIN"
        onConfirm={() => {
          transitioningToPin.current = true;
          setShowPin(true);
        }}
      />

      <PinPromptDialog
        abierto={showPin}
        accion={aprobar_ ? aprobar_.titulo : 'Aprobación'}
        subaccion={
          aprobar_
            ? `${TIPO_APROBACION_LABEL[aprobar_.tipo]} · cargado por ${aprobar_.cargadoPor}`
            : undefined
        }
        onClose={() => {
          transitioningToPin.current = false;
          setShowPin(false);
        }}
        onConfirmado={onPinConfirmado}
      />

      <ConfirmDialog
        open={!!rechazar_}
        onOpenChange={(o) => !o && setRechazar_(null)}
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
        confirmLabel="Rechazar"
        variant="destructive"
        onConfirm={ejecutarRechazo}
      />
    </div>
  );
}

interface CardProps {
  aprobacion: Aprobacion;
  onAprobar: () => void;
  onRechazar: () => void;
}

function AprobacionCard({ aprobacion, onAprobar, onRechazar }: CardProps) {
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
                {aprobacion.estado}
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
            <Button size="sm" onClick={onAprobar}>
              <CheckCircle2 className="h-4 w-4" />
              Aprobar
            </Button>
            <Button size="sm" variant="outline" onClick={onRechazar}>
              <XCircle className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
