'use client';

import { Button, type ButtonProps } from '@llave/ui/button';
import { toast } from '@llave/ui/use-toast';

interface BotonProximamenteProps extends Omit<ButtonProps, 'onClick'> {
  /** Título del toast que aparece al tocar el botón. Por defecto "Próximamente". */
  toastTitle?: string;
  /** Mensaje secundario del toast. */
  toastMessage?: string;
  /** Contenido del botón (texto, íconos, etc.) */
  children: React.ReactNode;
}

/**
 * Wrapper de Button para usar en server components donde no podemos definir
 * onClick handlers directamente. Muestra un toast al tocar el botón.
 *
 * Útil para CTAs de acciones placeholder durante la demo (Editar, Conectar
 * ARCA, Exportar, etc.) que todavía no tienen flujo de backend conectado.
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
