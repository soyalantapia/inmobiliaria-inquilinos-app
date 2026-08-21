import { describe, it, expect } from 'vitest';
import { porcionAlquilerCobrada } from './alquiler-cobrado';

/**
 * CAZABUG — el panel mostraba menos alquiler cobrado del que la rendición iba a pagar.
 *
 * El KPI prorrateaba contra `l.montoTotal`, que llega decorado por `conSaldo` con la mora al
 * día. El server prorratea contra la base de la fila, sin mora. Mientras no hubo atrasos los
 * dos denominadores coincidieron y nadie lo vio.
 *
 * `formulaDelServer` NO importa el código de producción, y eso es deliberado: es la fórmula
 * escrita de nuevo, a mano, para que el test sea diferencial. Si el panel y esta expresión dan
 * distinto, uno de los dos se movió.
 *
 * Antes este comentario decía que "replica lo que hace `plata.ts`". Ya no es cierto: desde
 * T-01-N1-N14 la regla vive una sola vez en `@llave/shared/prorrateo` y `plata.ts` pasó a ser
 * un consumidor más. La referencia es el helper compartido; esto es la segunda opinión.
 */
function formulaDelServer(alquiler: number, expensas: number, cobrado: number): number {
  const total = alquiler + expensas; // `liq.montoTotal` de la fila: la mora nunca se persiste
  if (total <= 0) return 0;
  return Math.min(cobrado, total) * (alquiler / total);
}

describe('porcionAlquilerCobrada — da lo mismo que la rendición del server', () => {
  const casos = [
    { que: 'pago total, sin mora', alquiler: 100, expensas: 0, mora: 0, cobrado: 100 },
    { que: 'pago PARCIAL sobre una liq en mora', alquiler: 100, expensas: 0, mora: 10, cobrado: 50 },
    { que: 'con expensas y mora', alquiler: 100, expensas: 50, mora: 15, cobrado: 150 },
    { que: 'pagó también la mora', alquiler: 100, expensas: 0, mora: 20, cobrado: 120 },
    { que: 'no pagó nada', alquiler: 100, expensas: 30, mora: 5, cobrado: 0 },
  ];

  for (const c of casos) {
    it(`${c.que}: el panel coincide con el server`, () => {
      // Así llega la liquidación al panel: montoTotal YA trae la mora sumada.
      const montoTotalDecorado = c.alquiler + c.expensas + c.mora;

      const delPanel = porcionAlquilerCobrada({
        alquiler: c.alquiler,
        base: montoTotalDecorado - c.mora,
        cobrado: c.cobrado,
      });

      expect(delPanel).toBeCloseTo(formulaDelServer(c.alquiler, c.expensas, c.cobrado), 6);
    });
  }

  it('LA REGRESIÓN, con número: pasarle la base CON mora da distinto', () => {
    // Es exactamente lo que hacía el KPI. Se deja fijado para que se vea el tamaño del error.
    const conMora = porcionAlquilerCobrada({ alquiler: 100, base: 150 + 15, cobrado: 150 });
    const sinMora = porcionAlquilerCobrada({ alquiler: 100, base: 150, cobrado: 150 });

    expect(sinMora).toBeCloseTo(100, 6);
    expect(conMora).toBeCloseTo(90.909, 3);
    expect(conMora).toBeLessThan(sinMora);
  });

  it('la mora nunca entra: cobrar de más no aumenta lo que se rinde', () => {
    // 100 de alquiler + 40 de mora pagados enteros. Al dueño le van 100, no 140.
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 100, cobrado: 140 })).toBe(100);
  });

  it('las expensas quedan afuera por la proporción, no por un resta aparte', () => {
    // Alquiler 100 + expensas 100, pagado todo → la mitad es alquiler.
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 200, cobrado: 200 })).toBe(100);
  });

  it('base 0 o negativa no rompe ni devuelve NaN', () => {
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 0, cobrado: 50 })).toBe(0);
    expect(porcionAlquilerCobrada({ alquiler: 100, base: -5, cobrado: 50 })).toBe(0);
  });

  it('cobrado negativo no genera un crédito al propietario', () => {
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 100, cobrado: -30 })).toBe(0);
  });
});
