'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /**
     * `page` (default): en MOBILE el modal se abre a pantalla completa
     * (page-like) y scrollea — pensado para formularios, así nunca se corta
     * ni quedan los botones fuera de alcance. En sm+ vuelve a ser modal
     * centrado.
     * `compact`: diálogo centrado con margen en todos los tamaños — para
     * confirmaciones cortas, donde la pantalla completa quedaría vacía.
     */
    variant?: 'page' | 'compact';
  }
>(({ className, children, variant = 'page', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        variant === 'page'
          ? 'fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-background p-6 shadow-lg duration-200 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:grid sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border'
          : 'fixed left-[50%] top-[50%] z-50 grid max-h-[85vh] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg duration-200',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// DialogDescription envuelve a Radix' Description con `asChild` para
// renderizar un <div> en vez del <p> por defecto. Eso permite pasar
// children con bloques (otros <p>, <div>, formularios) sin disparar
// warnings "<div> cannot be a descendant of <p>" — los teníamos en los
// dialogs de Invitar, Marcar como resuelto, etc. Radix sigue gestionando
// el `aria-describedby` correctamente porque se hace por id, no por tag.
export const DialogDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Description asChild>
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </div>
  </DialogPrimitive.Description>
));
DialogDescription.displayName = 'DialogDescription';
