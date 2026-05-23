'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Lock, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import {
  cambiarPin,
  pinEstaBloqueado,
  resetearPin,
  tienePinConfigurado,
} from '@/lib/pin-seguridad-storage';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';

export function PinSeguridadCard() {
  const [hidratado, setHidratado] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [showCambiar, setShowCambiar] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const refrescar = () => {
    setConfigurado(tienePinConfigurado());
    setBloqueado(pinEstaBloqueado());
  };

  useEffect(() => {
    refrescar();
    setHidratado(true);
  }, []);

  const reset = () => {
    resetearPin();
    toast({ title: 'PIN reseteado', description: 'Configurá uno nuevo cuando confirmes la próxima acción.' });
    setShowResetConfirm(false);
    refrescar();
  };

  if (!hidratado) return null;

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
            <Button size="sm" onClick={() => setShowSetup(true)}>
              <KeyRound className="h-4 w-4" />
              Configurar PIN
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCambiar(true)}
              >
                <Lock className="h-4 w-4" />
                Cambiar PIN
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="h-4 w-4" />
                Resetear
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <PinPromptDialog
        abierto={showSetup}
        accion="Configurar PIN de seguridad"
        subaccion="Lo vamos a pedir cuando confirmes acciones sensibles."
        onClose={() => {
          setShowSetup(false);
          refrescar();
        }}
        onConfirmado={refrescar}
      />

      <CambiarPinDialog
        abierto={showCambiar}
        onClose={() => setShowCambiar(false)}
        onCambiado={refrescar}
      />

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

interface CambiarProps {
  abierto: boolean;
  onClose: () => void;
  onCambiado: () => void;
}

function CambiarPinDialog({ abierto, onClose, onCambiado }: CambiarProps) {
  const [pinAnterior, setPinAnterior] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setPinAnterior('');
    setPinNuevo('');
    setPinConfirm('');
    setError(null);
  }, [abierto]);

  const submit = () => {
    setError(null);
    if (pinNuevo !== pinConfirm) {
      setError('Los dos PINs nuevos no coinciden.');
      return;
    }
    const res = cambiarPin({ pinAnterior, pinNuevo });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ variant: 'success', title: 'PIN actualizado' });
    onCambiado();
    onClose();
  };

  return (
    <ConfirmDialog
      open={abierto}
      onOpenChange={(o) => !o && onClose()}
      title="Cambiar PIN"
      description={
        <div className="space-y-3 pt-2">
          <div className="space-y-2">
            <Label htmlFor="pin-ant">PIN actual</Label>
            <Input
              id="pin-ant"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pinAnterior}
              onChange={(e) =>
                setPinAnterior(e.target.value.replace(/\D/g, ''))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-new">PIN nuevo</Label>
            <Input
              id="pin-new"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pinNuevo}
              onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-rep">Repetí el nuevo</Label>
            <Input
              id="pin-rep"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      }
      confirmLabel="Cambiar PIN"
      onConfirm={submit}
    />
  );
}
