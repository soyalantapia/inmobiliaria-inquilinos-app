'use client';

/**
 * Input de dinero: drop-in del `<Input>` para montos. Muestra el valor formateado
 * con separador de miles (1.250.000) y el símbolo de la moneda de la marca ($ / US$),
 * pero mantiene el state como un string de dígitos crudos ('1250000') para que el
 * submit siga haciendo `Number(monto)` sin cambios. Reemplaza los `<input type="number">`
 * sueltos, que no formateaban y no mostraban la moneda.
 *
 * Uso: `<MoneyInput value={monto} onChange={setMonto} />` (state string). La moneda sale
 * por defecto de la marca (`useMonedaMarca`); se puede overridear con `moneda` (ej: un
 * contrato en USD → `moneda={contrato.moneda}`). Montos ENTEROS (la app usa
 * `formatMonto` con 0 decimales); tipear se limita a dígitos.
 */
import * as React from 'react';
import { Input } from '@llave/ui/input';
import { cn } from '@llave/ui/cn';
import type { Moneda } from '@/lib/types';
import { useMonedaMarca } from '@/lib/api/use-moneda-marca';

type BaseInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
>;

export interface MoneyInputProps extends BaseInputProps {
  value: string | number | null | undefined;
  onChange: (raw: string) => void;
  /** Override de la moneda (por defecto, la de la marca). */
  moneda?: Moneda;
}

/** Formatea la parte entera con separador de miles es-AR. '' si no hay dígitos. */
function formatEntero(value: string | number | null | undefined): string {
  const intPart = (String(value ?? '').split(/[.,]/)[0] ?? '').replace(/\D/g, '');
  if (!intPart) return '';
  return Number(intPart).toLocaleString('es-AR');
}

export function MoneyInput({ value, onChange, moneda, className, ...props }: MoneyInputProps) {
  const monedaMarca = useMonedaMarca();
  const cur = moneda ?? monedaMarca;
  const simbolo = cur === 'USD' ? 'US$' : '$';

  // Wrapper `span` (no `div`) para poder embeberlo tanto en un `<div>` (form
  // normal, full-width) como dentro de un `<span className="flex">` (filas compactas
  // inline) sin anidar block-en-inline. `className` va al WRAPPER (sizing/layout);
  // el Input siempre es `w-full` adentro. Sin className → `block` = ancho completo;
  // para una fila angosta pasar `className="inline-block w-40"`.
  return (
    <span className={cn('relative block', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
        {simbolo}
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        value={formatEntero(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className={cn('w-full text-right tabular-nums', cur === 'USD' ? 'pl-12' : 'pl-9')}
      />
    </span>
  );
}
