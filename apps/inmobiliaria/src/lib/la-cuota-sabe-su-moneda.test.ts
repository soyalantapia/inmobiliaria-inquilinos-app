/**
 * TERCERA AUDITORÍA · La pestaña Pagos del contrato leía dólares como pesos.
 *
 * `formatMonto(monto, moneda = 'ARS')` tiene default. Ese default es cómodo y es la trampa:
 * un sitio que se olvida la moneda no falla, no avisa, y pinta un `$` sobre un monto en
 * dólares. En `contratos/[id]/page-client.tsx` había ONCE llamadas que le pasaban `c.moneda`
 * y NUEVE que no — todas juntas en la pestaña Pagos, que se dibuja con dos componentes que
 * reciben la liquidación y no el contrato. Un alquiler de US$ 1.200 se leía "$ 1.200": mil
 * veces por debajo de la deuda real, y es la cifra que la operadora dicta por teléfono.
 *
 * La raíz no estaba en los componentes: `Liquidacion.moneda` existe en la base y el server la
 * devuelve, pero el tipo escrito a mano de la respuesta NO la declaraba y el mapper la tiraba.
 * Los componentes no tenían de dónde sacarla ni equivocándose.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando `moneda` del objeto que
 * arma `generarLiquidaciones`, el primer caso deja de compilar; devolviéndolo fijo en 'ARS',
 * falla. Y volviendo cualquiera de las llamadas de los dos archivos a un solo argumento,
 * falla el guard de abajo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatTotalPorMoneda } from './format';
import { generarLiquidaciones } from './mock-data';

describe('la cuota sabe en qué moneda es', () => {
  it('generarLiquidaciones propaga la moneda que le pasan', () => {
    const liqs = generarLiquidaciones('cnt_x', 1200, 0, 'USD');
    expect(liqs.length).toBeGreaterThan(0);
    expect(liqs.every((l) => l.moneda === 'USD')).toBe(true);
  });

  it('y cae a pesos sólo cuando nadie la pasa (caja y scoring, que suman en pesos)', () => {
    expect(generarLiquidaciones('cnt_x', 300000, 0).every((l) => l.moneda === 'ARS')).toBe(true);
  });
});

/**
 * El badge "Deuda total" del panel de morosos sumaba `m.contrato.monto` de todos y lo pintaba
 * con `$`. Hoy en pantalla los dos morosos del demo son en pesos, así que se ve igual que
 * antes — que es justo lo buscado. Lo que cambia es el día que uno sea en dólares, y eso se
 * prueba acá y no en el navegador.
 */
describe('la deuda total de morosos no inventa plata', () => {
  it('con dos monedas desglosa en vez de sumar', () => {
    const morosos = [
      { contrato: { monto: 990000, moneda: 'ARS' as const } },
      { contrato: { monto: 800, moneda: 'USD' as const } },
    ];
    const texto = formatTotalPorMoneda(morosos.map((m) => ({ monto: m.contrato.monto, moneda: m.contrato.moneda })));
    expect(texto).toContain('990.000');
    expect(texto).toContain('800');
    // Con el bug: "$ 990.800" — un número que no existe.
    expect(texto).not.toContain('990.800');
  });

  it('con una sola moneda se ve exactamente igual que antes', () => {
    const texto = formatTotalPorMoneda([
      { monto: 600000, moneda: 'ARS' as const },
      { monto: 390000, moneda: 'ARS' as const },
    ]);
    expect(texto).toBe('$ 990.000');
  });
});

/**
 * GUARD DE REGRESIÓN, acotado a lo que este arreglo tocó.
 *
 * No es repo-wide a propósito: quedan otros diez archivos que mezclan las dos formas de
 * llamar a `formatMonto` (el tablero, la pestaña de pagos general, la ficha del propietario,
 * el negociador de renovación…) y cada uno necesita que alguien mire si su monto puede ser
 * USD. Meterlos en una lista blanca sería declarar "revisado" algo que no lo está. Este guard
 * sólo impide que ESTOS archivos vuelvan atrás.
 *
 * Los `formatMonto(0)` de `caja/page.tsx` y `propietarios/page.tsx` sí son deliberados y están
 * comentados en su archivo: es el cero de la lista vacía, en la moneda local. Por eso este
 * guard no los mira.
 */
const SIN_MONEDA = /formatMonto\([^,()]*(\([^()]*\))?[^,()]*\)/g;

const ARCHIVOS = [
  '../app/(app)/contratos/[id]/page-client.tsx',
  '../components/morosos-panel.tsx',
  '../components/resolver-deposito-dialog.tsx',
];

describe('los archivos de este arreglo no vuelven a olvidarse la moneda', () => {
  for (const rel of ARCHIVOS) {
    it(`${rel} llama a formatMonto siempre con moneda`, () => {
      const ruta = fileURLToPath(new URL(rel, import.meta.url));
      const src = readFileSync(ruta, 'utf8');
      const olvidos = (src.match(SIN_MONEDA) ?? []).filter((m) => !m.includes(', '));
      expect(olvidos).toEqual([]);
    });
  }
});
