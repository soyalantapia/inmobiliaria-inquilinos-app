/**
 * T-46-N3 · La demo del portal y la del panel tienen que contar la MISMA historia.
 *
 * EL PROBLEMA. `apps/propietario/src/lib/demo-data.ts` y
 * `apps/inmobiliaria/src/lib/mock-data.ts` describen los mismos alquileres: Silvana Morales y sus
 * tres unidades. Los montos están **copiados a mano**, porque son dos apps que no comparten
 * paquete. Si alguien cambia el alquiler de Gorriti en el panel, la demo del portal sigue
 * contando otra historia y nadie se entera — y eso se ve en el sitio público, donde la gracia es
 * justamente ver el mismo alquiler desde los tres lados.
 *
 * POR QUÉ UN TEST Y NO UN PAQUETE COMPARTIDO. Unificar los mocks en un paquete es más costo que
 * beneficio: hay que crear el paquete, cablearlo en dos apps y arrastrar sus tipos, para datos
 * que sólo existen en el build demo. El riesgo real no es tener dos copias: es que **diverjan en
 * silencio**. Un test no elimina la duplicación, elimina el silencio, que es lo que hace daño.
 *
 * DÓNDE VIVE. Acá, en el portal, y no en el panel ni en la API: lo que este test protege es
 * que la demo del PORTAL no contradiga la del panel. Nació en `apps/api/test/` porque era el
 * único paquete con runner; al cerrarse T-32 y montarse el runner de los fronts, se mudó a su
 * lugar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PORTAL = readFileSync(join(RAIZ, 'apps', 'propietario', 'src', 'lib', 'demo-data.ts'), 'utf8');
const PANEL = readFileSync(join(RAIZ, 'apps', 'inmobiliaria', 'src', 'lib', 'mock-data.ts'), 'utf8');

/**
 * Alquiler mensual por dirección, leído del texto del archivo.
 *
 * Se toma la PRIMera aparición de `monto:` después de cada `direccion:`, que en los dos archivos
 * es el canon del contrato. Las apariciones siguientes son los períodos y las rendiciones, que no
 * son lo que se compara acá.
 */
function montosPorDireccion(fuente: string): Map<string, number> {
  const out = new Map<string, number>();
  const re = /direccion:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente))) {
    const direccion = m[1];
    if (out.has(direccion)) continue;
    const resto = fuente.slice(m.index, m.index + 600);
    const monto = /monto:\s*(\d+)/.exec(resto);
    if (monto) out.set(direccion, Number(monto[1]));
  }
  return out;
}

describe('T-46-N3 · la demo del portal no puede contradecir a la del panel', () => {
  it('los alquileres de las unidades compartidas coinciden en las dos apps', () => {
    const portal = montosPorDireccion(PORTAL);
    const panel = montosPorDireccion(PANEL);

    // Sólo las direcciones que aparecen en LAS DOS. Cada app tiene datos propios (el panel tiene
    // contratos que este propietario no posee) y eso no es una inconsistencia.
    const compartidas = [...portal.keys()].filter((d) => panel.has(d));

    // Si esto da 0, el test dejó de proteger algo: o se renombraron las direcciones en una de
    // las dos, o el formato del archivo cambió y el parseo quedó ciego.
    expect(
      compartidas.length,
      'No hay ninguna dirección en común entre las dos demos. O se renombraron, o este test dejó ' +
        'de leer bien los archivos — en cualquier caso ya no está protegiendo nada.',
    ).toBeGreaterThan(0);

    const desincronizadas = compartidas
      .filter((d) => portal.get(d) !== panel.get(d))
      .map((d) => `  ${d} → portal ${portal.get(d)} vs panel ${panel.get(d)}`);

    expect(
      desincronizadas,
      desincronizadas.length === 0
        ? ''
        : 'La demo del portal del propietario y la del panel cuentan historias distintas del ' +
          'mismo alquiler:\n' +
          desincronizadas.join('\n') +
          '\nSon dos copias a mano (apps/propietario/src/lib/demo-data.ts y ' +
          'apps/inmobiliaria/src/lib/mock-data.ts). Actualizá la que quedó vieja.',
    ).toEqual([]);
  });
});
