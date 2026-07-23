'use client';

import * as React from 'react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

// Mini implementación inspirada en shadcn/ui sin extra deps. Una sola
// store global con suscripción simple. Suficiente para el MVP.

export interface ToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  duration?: number;
}

interface InternalToast extends ToastInput {
  id: string;
  open: boolean;
}

type Listener = (toasts: InternalToast[]) => void;

const TOAST_REMOVE_DELAY = 200; // ms para animar el cierre antes de borrar

const store = (() => {
  let toasts: InternalToast[] = [];
  const listeners = new Set<Listener>();

  const emit = () => listeners.forEach((l) => l(toasts));

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      listener(toasts);
      return () => {
        listeners.delete(listener);
      };
    },
    push(input: ToastInput) {
      const id = Math.random().toString(36).slice(2, 10);
      const t: InternalToast = { ...input, id, open: true };
      toasts = [t, ...toasts].slice(0, 4); // máximo 4 simultáneos
      emit();

      const duration = input.duration ?? 5500;
      setTimeout(() => store.dismiss(id), duration);

      return id;
    },
    dismiss(id: string) {
      toasts = toasts.map((t) => (t.id === id ? { ...t, open: false } : t));
      emit();
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        emit();
      }, TOAST_REMOVE_DELAY);
    },
  };
})();

export function toast(input: ToastInput): string {
  return store.push(input);
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<InternalToast[]>([]);
  React.useEffect(() => store.subscribe(setToasts), []);

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          open={t.open}
          variant={t.variant}
          onOpenChange={(open) => {
            if (!open) store.dismiss(t.id);
          }}
        >
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
