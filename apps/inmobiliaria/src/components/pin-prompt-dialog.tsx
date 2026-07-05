'use client';

import { useEffect, useRef } from 'react';
import { toast } from '@llave/ui/use-toast';

interface PinPromptDialogProps {
  abierto: boolean;
  /** Texto que describe qué se va a confirmar (ya no se muestra: sin prompt de PIN). */
  accion?: string;
  subaccion?: string;
  onClose: () => void;
  /** 'local' | 'servidor' — ignorado: el PIN se eliminó de la plataforma. */
  validacion?: 'local' | 'servidor';
  /** Se ejecuta directamente al "abrir" (PIN vacío; el server lo ignora). Puede
   *  devolver un string de error, que mostramos por toast. */
  onConfirmado: (pin: string) => void | string | null | Promise<void | string | null>;
}

/**
 * PIN ELIMINADO de la plataforma: ninguna acción pide PIN. Este componente conserva su
 * API (para no tocar los ~9 lugares que lo usan) pero ya NO muestra ningún prompt: al
 * "abrirse" ejecuta la acción directamente con PIN vacío (el backend lo ignora) y cierra.
 * Si la acción devuelve un error de negocio, lo mostramos por toast.
 */
export function PinPromptDialog({ abierto, onClose, onConfirmado }: PinPromptDialogProps) {
  const enCurso = useRef(false);

  useEffect(() => {
    if (!abierto) {
      enCurso.current = false;
      return;
    }
    if (enCurso.current) return;
    enCurso.current = true;
    void Promise.resolve(onConfirmado('')).then((err) => {
      if (typeof err === 'string' && err) {
        toast({ variant: 'destructive', title: 'No se pudo completar la acción', description: err });
      }
      onClose();
    });
  }, [abierto, onConfirmado, onClose]);

  return null;
}

/** El PIN se eliminó de la plataforma → sin estado que mostrar. */
export function PinEstadoBadge() {
  return null;
}
