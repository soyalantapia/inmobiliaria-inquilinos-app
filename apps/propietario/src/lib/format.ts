/** Formatos compartidos por las cuatro pestañas del portal. */

/**
 * Plata.
 *
 * Los centavos se muestran SÓLO si existen. Con `maximumFractionDigits: 0` fijo, cada renglón
 * del desglose se redondeaba por separado y la suma en pantalla no daba el total de abajo: el
 * dueño veía tres números que no cierran con el cuarto y no tenía cómo saber cuál estaba mal.
 * Un entero limpio se sigue viendo limpio.
 */
export const money = (n: number, moneda: 'ARS' | 'USD' = 'ARS'): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);

/**
 * Fecha legible. Distingue dos formas de dato porque JS las parsea distinto:
 *
 *  - `"2026-08-05"` (date-only) → JS lo lee como medianoche **UTC**. Al mostrarlo en hora
 *    local argentina (UTC−3) cae el día ANTERIOR: el portal decía "vence el 4" para un
 *    vencimiento del 5, y "pagó el 10" para un pago del 11. Se arma con el constructor de
 *    tres argumentos, que es local, y la fecha que mandó el server es la que se lee.
 *  - `"2026-08-10T13:20:00.000Z"` (timestamp) → tiene hora de verdad, así que el corrimiento
 *    al huso local es correcto y se deja pasar tal cual.
 *
 * Importa cuáles son cuáles: `portal-propietario.ts` manda date-only en `vence`, `pagoAt`,
 * `desde`, `hasta` y las fechas de gastos e ingresos (todas salen de `.slice(0, 10)`), y
 * timestamp completo en `rendidoAt` y `creadoAt`.
 */
export const fecha = (iso: string): string => {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(iso);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const periodoLargo = (p: string): string => {
  const [y, m] = p.split('-');
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${meses[Number(m) - 1] ?? p} ${y}`;
};

/**
 * CUIT con guiones: `20351234567` → `20-35123456-7`.
 *
 * La API lo guarda sin separadores, y la pestaña Perfil lo mostraba así, crudo. El mismo dato,
 * del mismo propietario, en el panel de la inmobiliaria se ve con guiones (`formatearCuit` de
 * `apps/inmobiliaria/src/lib/cuit.ts`): el dueño que compara las dos pantallas ve dos cosas
 * distintas donde hay una sola.
 *
 * Es sólo presentación: NO valida el dígito verificador ni normaliza nada. Eso vive del lado
 * del panel, que es quien carga el dato; acá el portal es de sólo lectura y lo único que puede
 * hacer mal es mostrarlo peor de lo que está. Si viene con una cantidad rara de dígitos se
 * devuelve tal cual, sin inventarle una forma que no tiene.
 */
export const cuit = (valor: string): string => {
  const d = valor.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : valor;
};
