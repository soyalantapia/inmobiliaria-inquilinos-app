/**
 * T-44-N2 · En `POST /rendiciones`, ninguna participación puede caer en "100% por defecto".
 *
 * QUÉ PROTEGE. El endpoint reparte cuatro cosas entre los dueños de una propiedad —alquileres,
 * gastos, el costo de los arreglos de reclamos y otros ingresos— y las cuatro empiezan igual:
 *
 *     const part = owner.participaciones.find((p) => p.propiedadId === X);
 *
 * Los cuatro tenían `part?.porcentaje ?? 100`. Si ese `find` no matchea, el `?? 100` le atribuye
 * el movimiento ENTERO a este dueño: le rinde el alquiler completo de una propiedad que tiene al
 * 40%, o le carga el 100% de un arreglo que paga entre tres. Sin error, sin log y sin rastro —el
 * cap cruzado de la rendición evita pagar de más, pero no dice nada sobre A QUIÉN.
 *
 * HOY NO SE ALCANZA, y por eso esto es un guard y no el arreglo de un bug vivo: todo el endpoint
 * se acota a `propIds`, que sale de `owner.participaciones`, y las otras tres colecciones se
 * filtran por `propIdsConIngreso`, que es un subconjunto de ese mismo set. El `find` siempre
 * matchea.
 *
 * POR QUÉ IGUAL IMPORTA. La premisa "el find siempre matchea" es de HOY y no está escrita en
 * ningún tipo: es una propiedad emergente de cómo se arman cuatro queries. El día que alguien
 * filtre las participaciones por una ventana de vigencia —que es literalmente lo que pide
 * T-23-N3— deja de valer, y lo que aparece no es una excepción sino una transferencia mal
 * dirigida. Que falle ruidoso mientras el cambio es un no-op verificable sale mucho más barato
 * que descubrirlo cuando a un propietario le falta un mes.
 *
 * POR QUÉ ES UN TEST DE FUENTE. El guard vive adentro del handler, y sacarlo a una función pura
 * para poder testearlo sería refactorizar el endpoint de la plata para complacer a un test. El
 * repo ya usa esta forma para invariantes que sostiene la estructura del código y no el runtime
 * (ver `evento-contrato-propaga.test.ts`). Los comentarios se sacan antes de mirar: este archivo
 * y el propio `plata.ts` mencionan `?? 100` en prosa a propósito, para explicar por qué ya no
 * está.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../src/routes/plata.ts', import.meta.url), 'utf8');
/** Sin comentarios de bloque ni de línea: se mira el código, no lo que se cuenta sobre él. */
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('T-44-N2 · el reparto nunca cae en 100% por defecto', () => {
  it('no queda ningún `?? 100` en el código de plata.ts', () => {
    expect(codigo).not.toMatch(/\?\?\s*100/);
  });

  it('las cuatro participaciones tienen su guard', () => {
    // Alquileres, gastos, gastos de reclamos y otros ingresos. Si mañana se reparte una quinta
    // cosa, este número queda corto y el test lo dice: agregar el reparto sin el guard es
    // justamente el descuido que esto vigila.
    const guards = codigo.match(/throw new ParticipacionAusente\(/g) ?? [];
    expect(guards).toHaveLength(4);
  });

  it('cada `participaciones.find` está seguido de su guard antes de usar el porcentaje', () => {
    // Se recorre cada uso real del find y se exige que el chequeo aparezca ANTES de leer
    // `.porcentaje`. Un guard puesto después no sirve: el reparto ya se calculó.
    const usos = [...codigo.matchAll(/owner\.participaciones\.find\(/g)];
    expect(usos.length).toBeGreaterThanOrEqual(4);
    for (const uso of usos) {
      const despues = codigo.slice(uso.index!, uso.index! + 400);
      expect(despues, `un find sin guard cerca del índice ${uso.index}`).toMatch(
        /if \(!part\) throw new ParticipacionAusente\(/,
      );
    }
  });

  it('el 409 existe y no nombra sólo a las liquidaciones', () => {
    // El guard lo tiran cuatro caminos distintos. Un mensaje que hable sólo de liquidaciones
    // manda al operador a mirar el lugar equivocado cuando lo disparó un gasto.
    expect(codigo).toMatch(/e instanceof ParticipacionAusente/);
    expect(codigo).toMatch(/codigo: 'PARTICIPACION_AUSENTE'/);
    expect(codigo).not.toMatch(/quedó una liquidación de una propiedad/);
  });

  it('el error lleva la propiedad, para que el 409 diga cuál revisar', () => {
    expect(codigo).toMatch(/class ParticipacionAusente extends Error \{\s*constructor\(readonly propiedadId: string\)/);
    expect(codigo).toMatch(/propiedadId: e\.propiedadId/);
  });
});
