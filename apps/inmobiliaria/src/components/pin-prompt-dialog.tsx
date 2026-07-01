'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@llave/ui/button';
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
  configurarPinInicial,
  pinEstaBloqueado,
  pinEstaDesbloqueado,
  tienePinConfigurado,
  validarPin,
} from '@/lib/pin-seguridad-storage';
import { useMe } from '@/lib/api/hooks';

interface PinPromptDialogProps {
  abierto: boolean;
  /** Texto que describe qué se va a confirmar. */
  accion: string;
  /** Subtexto: monto, entidad, contraparte. */
  subaccion?: string;
  onClose: () => void;
  /**
   * Validación del PIN:
   * - `'local'` (default): el PIN vive en localStorage (modo demo). El diálogo
   *   valida con `validarPin`/`tienePinConfigurado` y soporta el alta inicial.
   * - `'servidor'`: el PIN lo valida el server (modo API). El diálogo NO usa
   *   localStorage para decidir el modo ni para validar: solo recolecta el PIN
   *   y lo reenvía. `onConfirmado` debe devolver el mensaje de error si el
   *   server rechaza (el diálogo lo muestra y queda abierto para reintentar) o
   *   `void`/`null` si salió bien (cierra).
   */
  validacion?: 'local' | 'servidor';
  /** Se llama con el PIN tipeado. En modo `'servidor'` puede devolver un
   *  string de error (mantiene el diálogo abierto) o null/void (éxito). */
  onConfirmado: (pin: string) => void | string | null | Promise<void | string | null>;
}

export function PinPromptDialog({
  abierto,
  accion,
  subaccion,
  validacion = 'local',
  onClose,
  onConfirmado,
}: PinPromptDialogProps) {
  const servidor = validacion === 'servidor';
  const { me } = useMe();
  const [modo, setModo] = useState<'validar' | 'configurar'>('validar');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Corre una sola vez por apertura (evita disparar la acción dos veces si cambia
  // la identidad de onConfirmado entre renders).
  const autoRef = useRef(false);

  useEffect(() => {
    if (!abierto) return;
    setPin('');
    setPinConfirm('');
    setError(null);
    setEnviando(false);
    autoRef.current = false;
    // En modo servidor siempre validamos (el alta del PIN no es local).
    setModo(servidor || tienePinConfigurado() ? 'validar' : 'configurar');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [abierto, servidor]);

  useEffect(() => {
    // PIN sacado de Configuración: si el usuario NO tiene un PIN configurado, la
    // acción ya no lo requiere (el server lo permite). Auto-confirmamos sin mostrar
    // el input — el diálogo pasa a ser transparente para quien no usa PIN.
    if (!abierto || !servidor || autoRef.current) return;
    if (me?.tienePin === false) {
      autoRef.current = true;
      void Promise.resolve(onConfirmado('')).then((err) => {
        if (typeof err === 'string') {
          autoRef.current = false;
          setError(err);
        } else {
          onClose();
        }
      });
    }
  }, [abierto, servidor, me, onConfirmado, onClose]);

  useEffect(() => {
    if (!abierto || servidor) return;
    // Si el PIN ya está desbloqueado por otra acción reciente,
    // auto-confirmamos sin pedir input (no hay PIN tipeado: va vacío;
    // los flujos contra el API vuelven a pedirlo si el server lo exige).
    // En modo servidor NO aplica: el server pide el PIN real en cada acción.
    if (modo === 'validar' && pinEstaDesbloqueado()) {
      onConfirmado('');
      onClose();
    }
  }, [abierto, modo, onClose, onConfirmado, servidor]);

  const submit = async () => {
    setError(null);
    if (modo === 'configurar') {
      if (pin !== pinConfirm) {
        setError('Los dos PINs no coinciden.');
        return;
      }
      const res = configurarPinInicial({ pin });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({
        variant: 'success',
        title: 'PIN configurado',
        description: 'Lo vamos a pedir cada vez que confirmes una acción sensible.',
      });
      onConfirmado(pin);
      onClose();
      return;
    }
    // modo validar
    if (servidor) {
      // El server valida el PIN. onConfirmado devuelve el mensaje de error si
      // lo rechaza (queda abierto para reintentar) o null/void si salió ok.
      setEnviando(true);
      try {
        const err = await onConfirmado(pin);
        if (typeof err === 'string') {
          setError(err);
          setPin('');
          setTimeout(() => inputRef.current?.focus(), 50);
          return;
        }
        onClose();
      } finally {
        setEnviando(false);
      }
      return;
    }
    const res = validarPin(pin);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onConfirmado(pin);
    onClose();
  };

  const bloqueado = pinEstaBloqueado();

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {modo === 'configurar' ? 'Configurar PIN de seguridad' : 'Confirmá con tu PIN'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{accion}</p>
            {subaccion && (
              <p className="text-xs text-muted-foreground">{subaccion}</p>
            )}
          </div>

          {modo === 'configurar' ? (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                <p className="font-medium">Primera vez: armemos tu PIN</p>
                <p className="mt-0.5 text-amber-900/70 dark:text-amber-200/70">
                  Es de 4 a 6 dígitos. Te lo vamos a pedir antes de aprobar
                  pagos, rendir o devolver depósitos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin-nuevo">PIN nuevo</Label>
                <Input
                  ref={inputRef}
                  id="pin-nuevo"
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  autoComplete="new-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin-confirm">Repetí el PIN</Label>
                <Input
                  id="pin-confirm"
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  autoComplete="new-password"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                />
              </div>
            </>
          ) : bloqueado ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <ShieldAlert className="h-4 w-4" />
                PIN bloqueado por intentos fallidos
              </p>
              <p className="text-xs text-muted-foreground">
                Pedile al Admin que resetee el PIN en /configuracion → Equipo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (4-6 dígitos)</Label>
              <Input
                ref={inputRef}
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                autoComplete="off"
                aria-invalid={!!error}
                aria-describedby={error ? 'pin-error' : undefined}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </div>
          )}

          {error && (
            <p id="pin-error" role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {!bloqueado && (
              <Button
                onClick={submit}
                // disabled hasta que el PIN tenga el largo mínimo de 4.
                // Antes el botón estaba siempre activo y al apretarlo con un
                // PIN incompleto se mostraba "PIN incorrecto" como error,
                // sumando un intento fallido inutilmente (con bloqueo a los 5).
                disabled={
                  enviando ||
                  (modo === 'configurar'
                    ? pin.length < 4 || pin !== pinConfirm
                    : pin.length < 4)
                }
              >
                <Lock className="h-4 w-4" />
                {enviando
                  ? 'Verificando…'
                  : modo === 'configurar'
                    ? 'Crear PIN'
                    : 'Confirmar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper hook que abre el PIN dialog para una acción y ejecuta `accion()`
 * solo si se validó. Útil para botones tipo "Aprobar pago":
 *
 *   const pedirConfirmacion = usePinPrompt();
 *   <Button onClick={() => pedirConfirmacion({ accion: 'Aprobar pago', onConfirmado: () => aprobar() })}>...</Button>
 *
 * (Implementación simple sin contexto — cada componente que lo use
 * mantiene su propio estado de apertura.)
 */
export function PinEstadoBadge() {
  // Indicador visual compacto del estado del PIN — usado en /configuracion.
  const configurado = tienePinConfigurado();
  const desbloqueado = pinEstaDesbloqueado();
  const bloqueado = pinEstaBloqueado();
  if (!configurado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
        <ShieldAlert className="h-3 w-3" />
        PIN sin configurar
      </span>
    );
  }
  if (bloqueado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[10px] text-destructive">
        <ShieldAlert className="h-3 w-3" />
        PIN bloqueado
      </span>
    );
  }
  if (desbloqueado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" />
        PIN abierto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
      <Lock className="h-3 w-3" />
      PIN activo
    </span>
  );
}
