/**
 * Ninguna ruta del API elige una fila con un id que mandó el usuario sin acotarla al token.
 *
 * DE DÓNDE SALE. Una auditoría de aislamiento sobre las 27 rutas (233 endpoints, 485 queries)
 * no encontró NI UNA fuga cruzada de tenant ni un acceso horizontal. Este test existe para que
 * ese resultado no caduque: una auditoría dice cómo estaba el código un martes, un test dice
 * cómo tiene que seguir estando. Ya existe el guard del portal del propietario
 * (`portal-aislamiento.test.ts`) y el de la PWA del inquilino (`inquilino-aislamiento.test.ts`);
 * éste es la regla mínima aplicada a TODAS las rutas.
 *
 * LA REGLA, y por qué es ésta y no "toda query nombra el tenant".
 *
 * El estilo del repo es buscar con el filtro puesto y después operar sobre lo encontrado:
 *
 *     const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId } });
 *     if (!co) return reply.code(404)…
 *     await prisma.coInquilino.update({ where: { id: co.id }, … });   // ya está acotado
 *
 * De las 485 queries, ~1 de cada 6 son esa segunda clase y son correctas. Una regla que las
 * marcara daría ~80 falsos positivos, y un test con 80 falsos positivos se borra o se ignora.
 *
 * El agujero de verdad es el otro: tomar un id DEL REQUEST y consultar sin acotar. Ahí el
 * usuario elige a qué fila apuntar. Entonces:
 *
 *     si una query usa algo que viene del request, tiene que nombrar también el token
 *
 * Medido contra el árbol al escribirse: 485 queries en las 27 rutas, 0 marcadas. Y muerde: si a
 * `POST /pagos/manual` (plata.ts) se le saca el `inmobiliariaId: u.inmobiliariaId` del where —el
 * error exacto que cometería un refactor— el test falla nombrando archivo, línea y ruta.
 *
 * SOBRE `IDENTIDADES_DEL_TOKEN`. Es una lista explícita de nombres de variable, no un patrón
 * abierto, y eso es a propósito: `body.data.email` también es un `algo.email`, y un patrón
 * abierto lo tomaría como si fuera del token — justo al revés de lo que hace falta. Si alguien
 * nombra distinto la variable del guard, este test la marca: falla hacia el lado seguro, y el
 * arreglo es agregar el nombre acá después de mirar que la query esté bien de verdad.
 *
 * Corre sin base de datos y sin red.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR_RUTAS = join(AQUI, '..', 'src', 'routes');

/** Nombres con los que los handlers reciben el resultado de un guard. Ver el docblock. */
const IDENTIDADES_DEL_TOKEN = ['u', 'inq', 'acceso', 'payload', 'sesion', 'prop', 'usuario', 'actual'];
/** Campos de ese objeto que ATAN una query: identidad probada, no dato de contacto. */
const CAMPOS_DEL_TOKEN = ['contratoId', 'inquilinoId', 'inmobiliariaId', 'propietarioId', 'userId', 'email'];

// `String.raw` y no un template común: dentro de un template literal, `\b` NO es el borde de
// palabra sino el carácter backspace, y la regex deja de matchear SIEMPRE. Con eso puesto este
// guard marcaba 10 queries que están perfectamente acotadas — o sea que fallaba hacia el lado
// ruidoso, que es el que hace que un test se borre. Lo agarró el autochequeo de abajo.
const ATADO_AL_TOKEN = new RegExp(
  String.raw`\b(?:${IDENTIDADES_DEL_TOKEN.join('|')})\.(?:${CAMPOS_DEL_TOKEN.join('|')})\b`,
);

/**
 * Algo que eligió quien mandó el request. `body.data.*Id` incluido: un id que viaja en el
 * cuerpo es tan elegible por un atacante como uno de la URL.
 */
const VIENE_DEL_REQUEST = /\brequest\.(?:params|body|query)\b|\bbody\.data\.\w*[Ii]d\b|\bparams\.\w*[Ii]d\b/;

interface Query {
  archivo: string;
  linea: number;
  handler: string;
  llamada: string;
  opciones: string;
}

/** Desde `desde` hasta el paréntesis que cierra la llamada. */
function recortarBalanceado(src: string, desde: number): string {
  let nivel = 1;
  for (let i = desde; i < src.length; i++) {
    const c = src[i];
    if (c === '(') nivel++;
    else if (c === ')') {
      nivel--;
      if (nivel === 0) return src.slice(desde, i);
    }
  }
  return src.slice(desde);
}

function queriesDe(archivo: string): Query[] {
  const src = readFileSync(join(DIR_RUTAS, archivo), 'utf8');

  const reRuta = /app\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g;
  const inicios: Array<{ ruta: string; desde: number }> = [];
  for (let m = reRuta.exec(src); m; m = reRuta.exec(src)) inicios.push({ ruta: m[1]!, desde: m.index });
  const handlers = inicios.map((h, i) => ({ ...h, hasta: inicios[i + 1]?.desde ?? src.length }));

  const re =
    /prisma\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|aggregate|groupBy|create|createMany|update|updateMany|delete|deleteMany|upsert)\(/g;
  const out: Query[] = [];
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const h = handlers.find((x) => m!.index >= x.desde && m!.index < x.hasta);
    out.push({
      archivo,
      linea: src.slice(0, m.index).split('\n').length,
      handler: h?.ruta ?? '(fuera de un handler)',
      llamada: `${m[1]}.${m[2]}`,
      opciones: recortarBalanceado(src, m.index + m[0].length),
    });
  }
  return out;
}

const archivos = readdirSync(DIR_RUTAS).filter((f) => f.endsWith('.ts'));
const todas = archivos.flatMap(queriesDe);

describe('aislamiento: ninguna ruta elige una fila con un id del request sin acotar', () => {
  it('las regex de este test hacen lo que dicen', () => {
    // Un guard cuyo instrumento está roto es peor que no tener guard: da verde sin mirar, o
    // grita sobre código correcto hasta que alguien lo borra. Se fija acá, con casos a mano.
    expect(ATADO_AL_TOKEN.test('{ id, inmobiliariaId: u.inmobiliariaId }')).toBe(true);
    expect(ATADO_AL_TOKEN.test('{ id, contratoId: inq.contratoId }')).toBe(true);
    expect(ATADO_AL_TOKEN.test('{ id: body.data.propietarioId, email: actual.email }')).toBe(true);
    expect(ATADO_AL_TOKEN.test('{ id: request.params.id }')).toBe(false);
    // `body.data.email` NO es del token: es un dato que mandó el usuario.
    expect(ATADO_AL_TOKEN.test('{ email: body.data.email }')).toBe(false);

    expect(VIENE_DEL_REQUEST.test('{ id: (request.params as X).id }')).toBe(true);
    expect(VIENE_DEL_REQUEST.test('{ id: body.data.liquidacionId }')).toBe(true);
    expect(VIENE_DEL_REQUEST.test('{ contratoId: inq.contratoId }')).toBe(false);
  });

  it('el parseo encontró las rutas y sus queries (si esto falla, el guard quedó ciego)', () => {
    // Sin esto, un refactor del estilo de las llamadas dejaría el test en verde sin haber
    // mirado nada: la peor forma de fallar para un guard.
    expect(archivos.length).toBeGreaterThan(20);
    expect(todas.length).toBeGreaterThan(400);
  });

  it('cero queries con id del request y sin filtro del token', () => {
    const sospechosas = todas
      .filter((q) => VIENE_DEL_REQUEST.test(q.opciones) && !ATADO_AL_TOKEN.test(q.opciones))
      .map((q) => `${q.archivo}:${q.linea}  ${q.handler}  ${q.llamada}`);

    expect(
      sospechosas,
      'Estas queries eligen la fila con algo que mandó el usuario y no la acotan al token:\n' +
        sospechosas.join('\n') +
        '\n\nO le falta el filtro del token al `where` (y entonces un usuario puede apuntar a la\n' +
        'fila de otro), o la variable del guard se llama distinto a las de IDENTIDADES_DEL_TOKEN.\n' +
        'Mirá cuál de las dos es ANTES de agregar el nombre a la lista.',
    ).toEqual([]);
  });
});
