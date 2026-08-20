import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { porcionAlquilerCobrada } from '@llave/shared/prorrateo';

/**
 * CAZABUG — la regla de plata que estaba escrita cuatro veces, y una había derivado.
 *
 * De lo cobrado, la porción de ALQUILER sale de capear al total de la cuota (para dejar la mora
 * afuera) y prorratear por `alquiler / total`. De ahí salen la comisión y la rendición.
 *
 * Estaba copiada en cuatro lugares: `lib/cierre-caja`, `lib/rendicion-pendiente`, la rendición
 * de `routes/plata` y el KPI del panel. El documento de invariantes las daba por coincidentes,
 * "verificado leyendo" — y la que había derivado era justo la que esa lectura no miraba: el
 * panel prorrateaba contra un total que YA traía la mora sumada, y le mostraba a la inmobiliaria
 * menos alquiler cobrado del que la rendición realmente pagaba (45,45 donde se pagaban 50).
 *
 * Ahora hay una sola implementación en `@llave/shared/prorrateo`. Esto es lo que impide que
 * aparezca una quinta: una regla de plata copiada no se sostiene con disciplina, y la prueba es
 * que ya no se sostuvo.
 */
describe('porcionAlquilerCobrada — la regla, una sola vez', () => {
  it('el cap deja la mora afuera: pagar de más no aumenta lo que se rinde', () => {
    // 100 de alquiler y 40 de mora, pagados enteros. Al dueño le corresponden 100, no 140.
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 100, cobrado: 140 })).toBe(100);
  });

  it('el prorrateo deja las expensas afuera, sin restarlas aparte', () => {
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 200, cobrado: 200 })).toBe(100);
  });

  it('un pago parcial se reparte proporcionalmente', () => {
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 200, cobrado: 50 })).toBe(25);
  });

  it('base 0 devuelve 0 y no NaN — un SOLO_EXPENSAS sin expensas cargadas', () => {
    // El NaN es peor que el error: se serializa como null, la pantalla se ve vacía en vez de
    // fallar, y un `NaN > 0.01` da false, así que un guard deja pasar lo que debía frenar.
    expect(porcionAlquilerCobrada({ alquiler: 0, base: 0, cobrado: 500 })).toBe(0);
    expect(Number.isNaN(porcionAlquilerCobrada({ alquiler: 0, base: 0, cobrado: 500 }))).toBe(false);
  });

  it('cobrado negativo no genera crédito a favor de nadie', () => {
    expect(porcionAlquilerCobrada({ alquiler: 100, base: 100, cobrado: -30 })).toBe(0);
  });
});

describe('nadie vuelve a copiar la regla', () => {
  // LO QUE ESTE GUARD **NO** VE, dicho acá para que nadie le tenga más fe de la que merece.
  //
  // Busca el ESQUELETO de la fórmula. Una copia que calcule la misma magnitud SIN parecerse
  // —sin `Math.min`, sin división, aplicando la regla por omisión— se le escapa entera.
  //
  // Los dos candidatos más obvios se revisaron (T-01-N1-N15) y NINGUNO es un defecto vivo.
  // Se anotan con la evidencia para que el próximo no los persiga de nuevo:
  //
  //   · `inmobiliaria/src/lib/dashboard-helpers.ts` comisiona sobre `cobrado` derecho, con un
  //     0.08 fijo. Es DELIBERADO y está documentado en `lib/api/hooks.ts:1557`: el demo
  //     mantiene la tasa fija por paridad byte-for-byte, y el camino con API espeja al demo.
  //   · `inmobiliaria/src/lib/cierre-caja.ts` suma `montoAlquiler` entero y sólo para las
  //     PAGADO, sin rama PARCIAL. Esa rama es INALCANZABLE: esas liquidaciones salen sólo de
  //     `generarLiquidaciones`, que emite PAGADO | PENDIENTE | VENCIDO y nunca PARCIAL, y sus
  //     cinco callers la usan cruda, sin overlay que le cambie el estado.
  //
  // O sea: el punto ciego del guard es real, pero hoy no esconde nada. Si alguna vez
  // `generarLiquidaciones` aprende a emitir PARCIAL, el segundo se vuelve un bug de verdad.
  it('no hay otra implementación fuera de @llave/shared', () => {
    // El patrón: un `Math.min(...)` multiplicado por una división en la misma expresión, en un
    // archivo que habla de alquiler. Es el esqueleto de la fórmula, y matchea aunque cambien
    // los nombres de las variables — que es exactamente lo que pasó con las cuatro copias.
    const raiz = join(import.meta.dirname, '..', '..', '..');
    const paquetes = ['apps/api/src', 'apps/inmobiliaria/src', 'apps/inquilino/src', 'apps/propietario/src'];
    const sospechosos: string[] = [];

    const recorrer = (dir: string): void => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) {
          if (entrada === 'node_modules' || entrada === '.next') continue;
          recorrer(ruta);
          continue;
        }
        if (!/\.tsx?$/.test(entrada) || /\.test\.tsx?$/.test(entrada)) continue;
        readFileSync(ruta, 'utf8')
          .split('\n')
          .forEach((linea, i) => {
            const esFormula = /Math\.min\([^)]*\)\s*\*\s*\(/.test(linea) && /\//.test(linea);
            if (!esFormula) return;
            if (!/alquiler|alq\b/i.test(linea)) return;
            sospechosos.push(`${ruta.slice(raiz.length + 1).replace(/\\/g, '/')}:${i + 1}`);
          });
      }
    };

    for (const p of paquetes) {
      try {
        recorrer(join(raiz, p));
      } catch {
        // El paquete puede no existir en un checkout parcial; no es motivo para fallar.
      }
    }

    expect(
      sospechosos,
      'reimplementan el prorrateo en vez de usar porcionAlquilerCobrada() de ' +
        '@llave/shared/prorrateo. Una regla de plata copiada deriva: ya pasó una vez y le mostró ' +
        'a la inmobiliaria menos alquiler cobrado del que la rendición pagaba',
    ).toEqual([]);
  });
});
