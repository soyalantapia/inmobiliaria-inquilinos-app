import { z } from 'zod';
/**
 * Parseo de montos escritos por humanos (extracto de banco, planilla de cartera).
 * FUENTE ÚNICA: lo usan el matching bancario y la importación de cartera. Antes cada
 * uno tenía su propio normalizador y los dos estaban rotos de formas distintas.
 */
/**
 * Parsea un monto de extracto bancario respetando el formato ARGENTINO (punto = miles,
 * coma = decimales), sin romperse con el formato en-US.
 *
 * Antes era `Number(String(v).replace(/[^\d.-]/g, ''))`, que dejaba el punto de miles y
 * lo interpretaba como decimal: "150.000" entraba como **150** (mil veces menos) y
 * "250000,50" como 25000050 (cien veces más), porque la coma se borraba. Ese monto se
 * persiste en CreditoDetectado y de ahí pasa tal cual al Pago conciliado.
 *
 * Regla: el ÚLTIMO separador decide. Si lo siguen 1 o 2 dígitos es el decimal; si lo
 * siguen 3 es separador de miles (1.000). Sin separadores, todo es entero.
 */
export function parsearMonto(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const original = String(v ?? '').trim();
  if (!original) return NaN;
  // Contabilidad: (1.234,56) = negativo. También un '-' en cualquier posición.
  const negativo = /^\(.*\)$/.test(original) || original.includes('-');
  const limpio = original.replace(/[^\d.,]/g, '');
  if (!limpio) return NaN;

  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  const sep = Math.max(ultimaComa, ultimoPunto);
  if (sep >= 0) {
    const decimales = limpio.length - sep - 1;
    if (decimales === 1 || decimales === 2) {
      const entero = limpio.slice(0, sep).replace(/[.,]/g, '');
      const frac = limpio.slice(sep + 1);
      const n = Number(`${entero || '0'}.${frac}`);
      return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
    }
  }
  // Sin decimales reales: todos los separadores son de miles.
  const n = Number(limpio.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
}

/**
 * Los validadores de zod para TODA la plata que entra por HTTP.
 *
 * EL AGUJERO QUE CIERRAN. `z.number().nonnegative()` y `z.number().positive()` **aceptan
 * `Infinity`**: zod 3 sólo rechaza `NaN`, y `Infinity > 0` da true. Los 31 campos de plata y
 * mora del API estaban escritos así, sin `.int()` ni `.max()` que lo atajaran de rebote.
 *
 * No es el mismo daño en todos lados, y el peor no es el que parece:
 *
 *  - **Columnas `Decimal(14, 2)`** (las 48 del schema, sin una sola excepción): Postgres
 *    rechaza el valor y el request muere con un 500. Feo, pero se nota y no ensucia nada.
 *
 *  - **Columnas `Float`** —`Contrato.moraValor`, `Inmobiliaria.moraValorDefault`—: acá
 *    `double precision` **sí guarda `Infinity`**, así que el valor absurdo NO falla: queda
 *    persistido. Y `calcularMora` lo levanta sin red (`!esquema.valor` es false para
 *    Infinity, y `esquema.valor <= 0` también) y devuelve `base * (Infinity / 100) * dias`
 *    = **Infinity**. Esa mora entra en el `montoTotal` y el `saldo` de TODAS las cuotas de
 *    ese contrato: la PWA del inquilino, los comprobantes, la deuda del panel y las
 *    métricas del dashboard. Un solo PATCH lo deja así para siempre.
 *
 * EL TECHO NO ES ARBITRARIO: es la capacidad de la columna. Las 48 `Decimal` del schema son
 * `Decimal(14, 2)` —12 dígitos enteros y 2 decimales— así que 999.999.999.999,99 es
 * exactamente lo máximo que el sistema puede GUARDAR. Un monto por encima no es una decisión
 * de negocio: es un valor que la base no puede representar.
 *
 * LO QUE ESTO NO ES. No es un límite de razonabilidad. No frena que alguien cargue $9.000.000
 * donde iban $90.000 — para eso hace falta una decisión de producto sobre topes y aprobación
 * (ver T-63). Esto sólo garantiza que lo que entra se pueda guardar y no envenene una cuenta.
 */
export const MAX_MONTO = 999_999_999_999.99;

/** Plata que puede ser cero (saldos, montos opcionales, mora manual). */
export const dinero = () => z.number().finite().nonnegative().max(MAX_MONTO);

/** Plata que tiene que ser mayor a cero (un alquiler, un depósito, un cargo). */
export const dineroPositivo = () => z.number().finite().positive().max(MAX_MONTO);

/**
 * Plata que puede ser NEGATIVA: un movimiento de caja es ingreso o egreso según el signo.
 * Acota los dos extremos por la misma razón que `dinero()` acota uno.
 */
export const dineroConSigno = () => z.number().finite().min(-MAX_MONTO).max(MAX_MONTO);
