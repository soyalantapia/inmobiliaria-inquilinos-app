/**
 * Cada archivo de test corre en EXACTAMENTE UN job de CI. Ni en dos, ni en ninguno.
 *
 * `vitest.con-db.config.ts` prometía este test por su nombre exacto —"Hay un test que lo
 * verifica: `test/particion-de-suites.test.ts`"— y el archivo no existía. Mientras tanto el
 * criterio estaba escrito dos veces, una en cada config, y las copias habían divergido: la de
 * con-db buscaba `'seedBase'` pelado y la de sin-db `'seedBase('` sobre el código sin
 * comentarios. Con eso, `guard-db.test.ts` —que sólo NOMBRA `seedBase` dentro de un string—
 * caía en los dos grupos.
 *
 * QUÉ SE ESTÁ CUIDANDO ACÁ, QUE NO ES EL DOBLE. Correr dos veces cuesta minutos. El caso caro
 * es el CERO: un archivo que las dos copias mandan para el otro lado no corre en NINGÚN job, y
 * nadie se entera —la suite completa tarda demasiado como para que alguien la corra a mano—.
 * Los comentarios de `vitest.sin-db.config.ts` cuentan que eso ya pasó dos veces, y una de
 * ellas se llevó puesto `guard-db.test.ts`: el test que fija el predicado que decide si una
 * `DATABASE_URL` es de producción, o sea el único freno entre `seedBase` y la base de un
 * cliente real.
 *
 * Ahora el criterio es UNO (`test-particion.ts`) y las dos configs lo importan, así que la
 * partición es cierta por construcción. Este test la afirma igual: la próxima persona que
 * quiera un atajo va a volver a copiar la regla, y esto se pone rojo.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DIR_TESTS, TAMBIEN_NECESITAN_BASE, necesitaBase, soloCodigo } from '../test-particion.js';

const archivos = readdirSync(DIR_TESTS).filter((f) => f.endsWith('.test.ts'));

/**
 * La aguja que busca el clasificador, armada en dos pedazos A PROPÓSITO.
 *
 * Este archivo habla del clasificador, así que si escribiera la cadena entera y literal el
 * clasificador lo clasificaría a ÉL como "necesita base" —un falso positivo— y el test que
 * cuida la partición terminaría corriendo sólo en el job lento, fuera del bucle rápido que se
 * corre antes de cada push. Que es exactamente el tipo de descuido que este archivo persigue.
 *
 * Concatenar es más feo que escribirla, y es lo que hace que el test viva donde tiene que vivir.
 */
const LLAMADA_A_SEED = 'seedBase' + '(';
const CLIENTE_PROPIO = 'new PrismaClient' + '(';

describe('partición del suite en los dos jobs de CI', () => {
  it('hay archivos que clasificar (si no, este test no estaría midiendo nada)', () => {
    expect(archivos.length).toBeGreaterThan(50);
  });

  it('cada archivo cae en exactamente un grupo', () => {
    // La partición es un booleano, así que "en los dos" o "en ninguno" sólo puede pasar si
    // alguien vuelve a duplicar el criterio. El assert compara los dos grupos contra el total.
    const conBase = archivos.filter((f) => necesitaBase(f));
    const sinBase = archivos.filter((f) => !necesitaBase(f));
    expect(conBase.length + sinBase.length).toBe(archivos.length);
    expect(conBase.filter((f) => sinBase.includes(f))).toEqual([]);
  });

  it('los dos grupos tienen contenido: ninguna config quedó vacía', () => {
    // Un `necesitaBase` que devolviera siempre lo mismo pasaría el test de arriba y dejaría un
    // job corriendo cero tests, en verde.
    expect(archivos.filter((f) => necesitaBase(f)).length).toBeGreaterThan(10);
    expect(archivos.filter((f) => !necesitaBase(f)).length).toBeGreaterThan(10);
  });

  it('el que llama a seedBase necesita base; el que sólo lo nombra, no', () => {
    // Los dos lados de la regla que hizo divergir las copias.
    for (const f of archivos) {
      const codigo = soloCodigo(readFileSync(join(DIR_TESTS, f), 'utf8'));
      if (codigo.includes(LLAMADA_A_SEED)) {
        expect(necesitaBase(f), `${f} llama a seedBase y tiene que ir al job con base`).toBe(true);
      }
    }
    // `guard-db.test.ts` es el caso concreto: nombra `seedBase` dentro de un string y NO llama
    // a la función. Es puro, y es el que fija el freno entre seedBase y una base de producción.
    if (archivos.includes('guard-db.test.ts')) {
      expect(necesitaBase('guard-db.test.ts'), 'guard-db es PURO: tiene que correr en el job rápido').toBe(false);
    }
  });

  it('los nombrados a mano existen de verdad', () => {
    // Un archivo renombrado dejaba la excepción apuntando a la nada, y el que lo reemplazó se
    // clasificaba solo — que para `health.test.ts` significa irse al job sin base y fallar ahí.
    for (const f of TAMBIEN_NECESITAN_BASE) {
      expect(archivos, `${f} está en TAMBIEN_NECESITAN_BASE y no existe`).toContain(f);
    }
  });

  it('un archivo que se siembra solo también va al job con base', () => {
    for (const f of archivos) {
      const codigo = soloCodigo(readFileSync(join(DIR_TESTS, f), 'utf8'));
      if (codigo.includes(CLIENTE_PROPIO)) {
        expect(necesitaBase(f), `${f} abre su propio cliente y necesita base`).toBe(true);
      }
    }
  });
});
