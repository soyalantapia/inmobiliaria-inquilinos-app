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

/**
 * Texto tipeado o PEGADO → dígitos crudos, respetando el formato argentino.
 *
 * Antes esto era `value.replace(/\D/g, '')` a secas, y con eso pegar un monto
 * desde una planilla multiplicaba por 100 **en silencio**: `150.000,00` daba
 * 15000000 y `150,50` daba 15050. Los separadores de miles se limpiaban bien,
 * pero los decimales se pegaban a la parte entera.
 *
 * La regla es la misma que usa `parsearMonto` en el backend (lib/monto.ts), que
 * es la fuente de verdad de montos del sistema: **el último separador decide**.
 * Si viene seguido de 1 o 2 dígitos es un decimal; si viene seguido de 3, es
 * separador de miles.
 *
 *   "150.000"     → 150000   (miles)
 *   "1.250.000"   → 1250000  (miles)
 *   "150.000,00"  → 150000   (decimal, se descarta)
 *   "150,50"      → 150      (decimal, se descarta)
 *
 * Los decimales se DESCARTAN, no se redondean: este input es de montos enteros
 * por contrato (la app formatea con 0 decimales) y truncar es lo que menos
 * sorprende. Lo que no puede pasar es que 150,50 entre como 15050.
 */
function soloDigitos(texto: string): string {
  const conDecimal = /^(.*)[.,](\d{1,2})$/.exec(texto);
  const enteroTexto = conDecimal ? conDecimal[1]! : texto;
  return enteroTexto.replace(/\D/g, '');
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
        onChange={(e) => onChange(soloDigitos(e.target.value))}
        className={cn('w-full text-right tabular-nums', cur === 'USD' ? 'pl-12' : 'pl-9')}
      />
    </span>
  );
}
