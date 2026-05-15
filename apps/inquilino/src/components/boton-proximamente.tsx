'use client';

import { Button, type ButtonProps } from '@llave/ui/button';
import { toast } from '@llave/ui/use-toast';

interface BotonProximamenteProps extends Omit<ButtonProps, 'onClick'> {
  toastTitle?: string;
  toastMessage?: string;
  children: React.ReactNode;
}

/**
 * Wrapper de Button para usar en server components donde no se pueden pasar
 * event handlers como props. Muestra un toast al tocar el botón.
 */
export function BotonProximamente({
  toastTitle = 'Próximamente',
  toastMessage = 'Esta acción estará disponible en breve.',
  children,
  ...buttonProps
}: BotonProximamenteProps) {
  return (
    <Button
      {...buttonProps}
      onClick={() => {
        toast({ title: toastTitle, description: toastMessage });
      }}
    >
      {children}
    </Button>
  );
}
