'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
  /**
   * Cuando `true`, el botón de confirmar queda deshabilitado. Usalo
   * para que el dialog quede abierto mientras la validación inline no
   * pase — evita que el usuario pierda lo que escribió por un click
   * prematuro.
   */
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  confirmDisabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    if (confirmDisabled) return;
    await onConfirm();
    if (!loading) onOpenChange(false);
  };

  return (
    // Mientras `loading`, bloqueamos el cierre por ESC / click afuera: si no,
    // el dialog se cerraba en medio de la operación y el usuario quedaba sin
    // saber si su acción (crear contrato, rendir, eliminar…) terminó.
    <Dialog open={open} onOpenChange={(o) => { if (!o && loading) return; onOpenChange(o); }}>
      <DialogContent variant="compact" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {variant === 'destructive' && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <div className="space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// re-export para que el helper de footer esté disponible si alguien lo necesita
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex justify-end gap-2 ${className ?? ''}`} {...props} />
  );
}
