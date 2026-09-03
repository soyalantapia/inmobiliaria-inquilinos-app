/**
 * Mi Cuenta ofrecía dos pantallas vacías como si anduvieran.
 *
 * El tour de onboarding tenía este defecto y se cerró en #154 (`el-tour-no-promete-pantallas-vacias`).
 * **Mi Cuenta es la pantalla de al lado y quedó afuera de esa pasada**: lista `/calendario` y
 * `/profesionales` como dos filas normales, con chevron y todo, y la descripción de la segunda
 * llega a prometer técnicos «verificados». Las dos son carteles de «Disponible pronto».
 *
 * Y pesa más acá que en el tour: el tour se ve una vez y se saltea; **Mi Cuenta es el menú
 * permanente**, adonde el inquilino vuelve a buscar lo que no encontró.
 *
 * LA DECISIÓN ES DISTINTA A LA DEL TOUR, a propósito. Allá el slide se saca —una pantalla entera
 * dedicada a algo que no existe es relleno—. Acá la fila SE QUEDA, con un badge «Pronto»: la
 * capacidad está en camino, la pantalla de destino ya explica en qué estado está, y esconder el
 * menú no le ahorra nada a nadie. Lo que no puede pasar es que se lea como algo que funciona.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GATEADAS, soloCodigo } from './pantallas-gateadas';

const CUENTA = fileURLToPath(new URL('../app/(app)/cuenta/page.tsx', import.meta.url));

/**
 * Sólo la rama de PRODUCCIÓN. En el build demo esas pantallas muestran su versión mock y andan
 * de verdad, así que ahí el badge sería mentira al revés.
 */
function ramaDeProduccion(): string {
  const src = soloCodigo(readFileSync(CUENTA, 'utf8'));
  const desde = src.indexOf('function CuentaReal');
  const hasta = src.indexOf('function CuentaDemo');
  expect(desde, 'no se encontró `function CuentaReal` en /cuenta').toBeGreaterThan(-1);
  expect(hasta, 'no se encontró `function CuentaDemo` en /cuenta').toBeGreaterThan(desde);
  return src.slice(desde, hasta);
}

describe('Mi Cuenta avisa cuando una fila lleva a un cartel', () => {
  it('CONTROL DEL CONTROL — hay rutas-cartel y Mi Cuenta ofrece alguna', () => {
    // Si algún día no queda ninguna, o Mi Cuenta deja de ofrecerlas, este archivo no mide nada y
    // se quedaría verde para siempre. Que avise en vez de callarse.
    expect(GATEADAS.length).toBeGreaterThan(0);
    const ofrecidas = GATEADAS.filter((r) => ramaDeProduccion().includes(`href="${r}"`));
    expect(
      ofrecidas.length,
      'Mi Cuenta ya no ofrece ninguna ruta-cartel: revisá si este test sigue teniendo sentido',
    ).toBeGreaterThan(0);
  });

  it('🔴 cada fila que lleva a un cartel está marcada con `pronto`', () => {
    const real = ramaDeProduccion();
    const sinMarcar = GATEADAS.filter((ruta) => {
      const i = real.indexOf(`href="${ruta}"`);
      if (i === -1) return false;
      return !/\bpronto\b/.test(real.slice(i, i + 120));
    });
    // Con el bug: ['/calendario', '/profesionales'] — dos filas que se leen como capacidades que
    // andan, y una de ellas prometiendo técnicos «verificados».
    expect(sinMarcar, `Mi Cuenta ofrece ${sinMarcar.join(', ')} sin decir que todavía no andan`).toEqual([]);
  });

  it('el badge NO se agrega en la rama demo, donde esas pantallas sí funcionan', () => {
    const src = soloCodigo(readFileSync(CUENTA, 'utf8'));
    const demo = src.slice(src.indexOf('function CuentaDemo'));
    expect(demo.length, 'no se encontró `function CuentaDemo`').toBeGreaterThan(500);
    for (const ruta of GATEADAS) {
      const i = demo.indexOf(`href="${ruta}"`);
      if (i === -1) continue;
      expect(demo.slice(i, i + 120), `la fila demo de ${ruta} no debería decir «Pronto»`).not.toMatch(/\bpronto\b/);
    }
  });
});
