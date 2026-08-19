'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cinco casillas para el PIN del mostrador.
 *
 * Cinco y no un campo libre porque es lo que Camila describió ("un usuario y contraseña que son
 * cinco dígitos") y porque en un mostrador se tipea de memoria, mirando al cliente y no a la
 * pantalla: las casillas dan el "ya van tres" sin tener que leer.
 *
 * Enmascarado (`type="password"`) por lo mismo que existe el feature: se tipea con público del
 * otro lado del vidrio.
 */
export function PinInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  'aria-label': ariaLabel = 'PIN de 5 dígitos',
}: {
  value: string;
  onChange: (v: string) => void;
  /** Se dispara al completar los 5. Evita que el operador tenga que buscar el botón. */
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [foco, setFoco] = useState(0);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setDigito = (i: number, d: string) => {
    const limpio = d.replace(/\D/g, '');
    if (!limpio) return;
    // Pegar los 5 de una (viene de un gestor de contraseñas o del teclado del celular).
    if (limpio.length > 1) {
      const v = limpio.slice(0, 5);
      onChange(v);
      const siguiente = Math.min(v.length, 4);
      refs.current[siguiente]?.focus();
      if (v.length === 5) onComplete?.(v);
      return;
    }
    const arr = value.padEnd(5, ' ').split('');
    arr[i] = limpio;
    const v = arr.join('').replace(/\s/g, '');
    onChange(v);
    if (i < 4) refs.current[i + 1]?.focus();
    if (v.length === 5) onComplete?.(v);
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      // Si la casilla está vacía, el backspace borra la ANTERIOR y se mueve. Sin esto hay que
      // apretar backspace dos veces por dígito y se siente roto.
      if (!value[i] && i > 0) {
        onChange(value.slice(0, i - 1));
        refs.current[i - 1]?.focus();
      } else {
        onChange(value.slice(0, i));
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 4) {
      refs.current[i + 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={ariaLabel}>
      {[0, 1, 2, 3, 4].map((i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={5}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => setDigito(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={() => setFoco(i)}
          aria-label={`Dígito ${i + 1} de 5`}
          className={`h-12 w-10 rounded-md border bg-background text-center text-lg font-semibold tabular-nums outline-none transition-colors disabled:opacity-50 ${
            foco === i ? 'border-primary ring-2 ring-primary/20' : ''
          }`}
        />
      ))}
    </div>
  );
}
