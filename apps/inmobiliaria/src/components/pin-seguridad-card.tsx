'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Lock, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import {
  cambiarPin,
  configurarPinInicial,
  pinEstaBloqueado,
  resetearPin,
  tienePinConfigurado,
} from '@/lib/pin-seguridad-storage';
import { apiEnabled, ApiError } from '@/lib/api/client';
import { setPinSeguridad, useMe } from '@/lib/api/hooks';

/**
 * Tarjeta de PIN de seguridad. En modo API persiste el PIN en la DB
 * (usuario.pinHash) vía `POST /auth/pin` — antes solo lo guardaba en
 * localStorage y el backend nunca lo recibía, así que una cuenta nueva no podía
 * validar pagos / rendir / aprobar (verificarPin → 403). En demo (sin API)
 * sigue con localStorage intacto.
 */
export function PinSeguridadCard() {
  const qc = useQueryClient();
  const { me, cargando } = useMe();
  const [hidratado, setHidratado] = useState(false);
  const [localConfigurado, setLocalConfigurado] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [dialog, setDialog] = useState<null | 'configurar' | 'cambiar'>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const refrescarLocal = () => {
    setLocalConfigurado(tienePinConfigurado());
    setBloqueado(pinEstaBloqueado());
  };

  useEffect(() => {
    refrescarLocal();
    setHidratado(true);
  }, []);

  // En modo API la fuente de verdad es el backend (me.tienePin); en demo, localStorage.
  const configurado = apiEnabled ? !!me?.tienePin : localConfigurado;

  const onDone = () => {
    setDialog(null);
    if (apiEnabled) void qc.invalidateQueries({ queryKey: ['me'] });
    else refrescarLocal();
  };

  const reset = () => {
    resetearPin();
    toast({ title: 'PIN reseteado', description: 'Configurá uno nuevo cuando confirmes la próxima acción.' });
    setShowResetConfirm(false);
    refrescarLocal();
  };

  if (!hidratado || (apiEnabled && cargando)) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${
              bloqueado
                ? 'bg-destructive/10 text-destructive'
                : configurado
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            {bloqueado ? (
              <ShieldAlert className="h-5 w-5" />
            ) : configurado ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <KeyRound className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">PIN de seguridad</p>
            <p className="text-xs text-muted-foreground">
              {bloqueado
                ? 'PIN bloqueado por intentos fallidos. Resetealo y volvé a configurarlo.'
                : configurado
                  ? 'Te lo pedimos antes de aprobar pagos, rendir o devolver depósitos.'
                  : 'Configurá un PIN de 4-6 dígitos para confirmar acciones sensibles.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!configurado ? (
            <Button size="sm" onClick={() => setDialog('configurar')}>
              <KeyRound className="h-4 w-4" />
              Configurar PIN
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog('cambiar')}>
                <Lock className="h-4 w-4" />
                Cambiar PIN
              </Button>
              {/* En demo el reset es local; en API el "olvidé el PIN" es un flujo
                  de recuperación aparte (no self-serve), así que no lo mostramos. */}
              {!apiEnabled && (
                <Button size="sm" variant="outline" onClick={() => setShowResetConfirm(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Resetear
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>

      <PinDialog modo={dialog} onClose={() => setDialog(null)} onDone={onDone} />

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="¿Resetear el PIN?"
        description="Vas a poder configurar uno nuevo cuando confirmes la próxima acción sensible. Esto NO desbloquea el sistema — sigue pidiendo confirmación."
        confirmLabel="Resetear"
        variant="destructive"
        onConfirm={reset}
      />
    </Card>
  );
}

interface PinDialogProps {
  modo: null | 'configurar' | 'cambiar';
  onClose: () => void;
  onDone: () => void;
}

/**
 * Diálogo único de configurar/cambiar PIN. Usa el primitivo `Dialog` (no
 * `ConfirmDialog`) para quedarse abierto y mostrar el error si el server
 * rechaza (PIN actual incorrecto). En modo API pega a `POST /auth/pin`; en demo
 * usa el storage local.
 */
function PinDialog({ modo, onClose, onDone }: PinDialogProps) {
  const abierto = modo !== null;
  const esConfigurar = modo === 'configurar';
  const [pinAnterior, setPinAnterior] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setPinAnterior('');
    setPinNuevo('');
    setPinConfirm('');
    setError(null);
    setEnviando(false);
  }, [abierto, modo]);

  const submit = async () => {
    setError(null);
    if (!/^\d{4,6}$/.test(pinNuevo)) {
      setError('El PIN nuevo debe tener entre 4 y 6 dígitos.');
      return;
    }
    if (pinNuevo !== pinConfirm) {
      setError('Los dos PINs nuevos no coinciden.');
      return;
    }
    if (!esConfigurar && pinAnterior.length < 4) {
      setError('Ingresá tu PIN actual.');
      return;
    }

    if (apiEnabled) {
      setEnviando(true);
      try {
        await setPinSeguridad({ pinNuevo, pinActual: esConfigurar ? undefined : pinAnterior });
        toast({ variant: 'success', title: esConfigurar ? 'PIN configurado' : 'PIN actualizado' });
        onDone();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudo guardar el PIN. Probá de nuevo.');
      } finally {
        setEnviando(false);
      }
      return;
    }

    // Demo / localStorage
    const res = esConfigurar
      ? configurarPinInicial({ pin: pinNuevo })
      : cambiarPin({ pinAnterior, pinNuevo });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ variant: 'success', title: esConfigurar ? 'PIN configurado' : 'PIN actualizado' });
    onDone();
  };

  const disabled =
    enviando || pinNuevo.length < 4 || pinNuevo !== pinConfirm || (!esConfigurar && pinAnterior.length < 4);

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {esConfigurar ? 'Configurar PIN de seguridad' : 'Cambiar PIN'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {esConfigurar && (
            <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
              Es de 4 a 6 dígitos. Te lo vamos a pedir antes de aprobar pagos, rendir o devolver depósitos.
            </div>
          )}

          {!esConfigurar && (
            <div className="space-y-2">
              <Label htmlFor="pin-ant">PIN actual</Label>
              <Input
                id="pin-ant"
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                autoComplete="off"
                value={pinAnterior}
                onChange={(e) => setPinAnterior(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pin-new">PIN nuevo</Label>
            <Input
              id="pin-new"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              autoComplete="new-password"
              value={pinNuevo}
              onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin-rep">Repetí el PIN nuevo</Label>
            <Input
              id="pin-rep"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              autoComplete="new-password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !disabled) void submit();
              }}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={disabled}>
              <Lock className="h-4 w-4" />
              {enviando ? 'Guardando…' : esConfigurar ? 'Crear PIN' : 'Cambiar PIN'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
