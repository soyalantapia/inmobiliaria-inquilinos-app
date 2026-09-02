import { describe, it, expect } from 'vitest';
import { generarLiquidaciones, contratosMock } from './mock-data';

/**
 * TRIPWIRE — la rama que hoy falta y todavía no duele.
 *
 * `efectivoEnMano()` (en `cierre-caja.ts`) suma `montoAlquiler` ENTERO y sólo para las
 * liquidaciones `PAGADO`. No capea ni prorratea: es la regla de plata aplicada por OMISIÓN, así
 * que el guard de `@llave/shared/prorrateo` —que busca el esqueleto `Math.min(...) * (.../...)`—
 * no la ve.
 *
 * Hoy eso NO es un bug, y la razón es esta: la única fuente de esas liquidaciones es
 * `generarLiquidaciones`, que emite `PAGADO | PENDIENTE | VENCIDO` y nunca `PARCIAL`. Sin
 * PARCIAL no hay pago partido que dropear, y la rama faltante es inalcanzable.
 *
 * Toda la seguridad del cierre de caja demo descansa entonces en una propiedad del GENERADOR,
 * no del consumidor. Eso es exactamente lo que hay que fijar con un test: el día que alguien
 * enriquezca el demo con un pago parcial —algo razonable y deseable de hacer—, `efectivoEnMano`
 * empieza a contar ese mes como 0 alquiler cobrado EN SILENCIO. Este test es lo que hace que ese
 * día se entere por un rojo y no por un número raro en pantalla.
 */
describe('cierre de caja demo — la premisa que lo sostiene', () => {
  it('generarLiquidaciones nunca emite PARCIAL (si cambia, arreglar efectivoEnMano)', () => {
    const estados = new Set<string>();
    for (const c of contratosMock) {
      for (const liq of generarLiquidaciones(c.id, c.monto, c.montoExpensas ?? 0)) {
        estados.add(liq.estado);
      }
    }

    expect(
      [...estados].sort(),
      'el demo ahora genera liquidaciones PARCIAL. `efectivoEnMano()` en cierre-caja.ts sólo ' +
        'mira PAGADO y suma montoAlquiler entero: ese mes va a reportar 0 de alquiler cobrado ' +
        'para el parcial, en vez de la porción prorrateada. Usar porcionAlquilerCobrada() de ' +
        '@llave/shared/prorrateo antes de sumar',
    ).not.toContain('PARCIAL');
  });
});
