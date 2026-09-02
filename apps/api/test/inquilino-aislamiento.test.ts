/**
 * Que la PWA del inquilino no se salga de SU alquiler.
 *
 * POR QUÉ. `routes/inquilino-mundo.ts` es la superficie que usan personas reales todos los
 * días, y es más grande que el portal del propietario (1.184 líneas contra 846). Lo único que
 * mantiene a cada inquilino adentro de su contrato es que las queries se aten a lo que viene
 * en su token: `inq.contratoId`, `inq.inquilinoId`, `inq.inmobiliariaId`. Si alguien saca uno
 * de esos filtros en un refactor, un inquilino empieza a ver —o a tocar— el alquiler de otro,
 * y no hay nada que se ponga rojo. Ya existe este guard para el portal del propietario
 * (`portal-aislamiento.test.ts`, T-23-N1); esta superficie no lo tenía.
 *
 * LA REGLA NO ES "toda query nombra el token", y esa diferencia es el punto.
 *
 * Relevando el archivo, de 38 queries hay 8 que no nombran el token y **todas son correctas**:
 * usan una variable que salió de una búsqueda anterior que SÍ estaba atada. Es el patrón
 * normal —buscar con el filtro del token, después operar sobre lo encontrado—:
 *
 *     const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId } });
 *     if (!co) return reply.code(404)…
 *     await prisma.coInquilino.update({ where: { id: co.id }, … });   // ← ya está acotado
 *
 * Exigirle el token a ESA segunda query sería ruido, y un test ruidoso se termina ignorando.
 *
 * Lo que sí es un agujero es tomar un id **del request** y consultar sin acotar: ahí el
 * inquilino elige a qué fila apuntar. Esa es la regla que se verifica:
 *
 *     si una query usa algo que viene del request, TIENE que nombrar también el token.
 *
 * Se corre sin base de datos y sin red.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTAS = join(AQUI, '..', 'src', 'routes', 'inquilino-mundo.ts');
const fuente = readFileSync(RUTAS, 'utf8');

interface Query {
  handler: string;
  llamada: string;
  opciones: string;
  linea: number;
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

/** El cuerpo de cada handler, para poder preguntar si es del inquilino. */
function extraerHandlers(src: string): Array<{ ruta: string; desde: number; hasta: number }> {
  const re = /app\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g;
  const inicios: Array<{ ruta: string; desde: number }> = [];
  for (let m = re.exec(src); m; m = re.exec(src)) inicios.push({ ruta: m[1]!, desde: m.index });
  return inicios.map((h, i) => ({
    ...h,
    hasta: inicios[i + 1]?.desde ?? src.length,
  }));
}

function extraerQueries(src: string): Query[] {
  const handlers = extraerHandlers(src);
  const re =
    /prisma\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|aggregate|groupBy|create|createMany|update|updateMany|delete|deleteMany|upsert)\(/g;
  const queries: Query[] = [];
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const h = handlers.find((x) => m!.index >= x.desde && m!.index < x.hasta);
    queries.push({
      handler: h?.ruta ?? '(fuera de un handler)',
      llamada: `${m[1]}.${m[2]}`,
      opciones: recortarBalanceado(src, m.index + m[0].length),
      linea: src.slice(0, m.index).split('\n').length,
    });
  }
  return queries;
}

const handlers = extraerHandlers(fuente);
const cuerpoDe = (ruta: string) => {
  const h = handlers.find((x) => x.ruta === ruta);
  return h ? fuente.slice(h.desde, h.hasta) : '';
};

/** Handlers que autentican como INQUILINO (los que este guard cubre). */
const esDelInquilino = (ruta: string) => /requireInquilino|requireContratoAcceso/.test(cuerpoDe(ruta));

/** Algo que sale del token verificado. */
const ATADO_AL_TOKEN = /\b(?:inq|acceso|payload|sesion)\.(?:contratoId|inquilinoId|inmobiliariaId)\b/;

/**
 * Algo que eligió el usuario en la request. `body.data` incluido: un id que viaja en el
 * cuerpo es tan elegible por el atacante como uno de la URL.
 */
const VIENE_DEL_REQUEST = /\brequest\.(?:params|body|query)\b|\bbody\.data\.\w*[Ii]d\b|\bparams\.\w*[Ii]d\b/;

const queries = extraerQueries(fuente);
const delInquilino = queries.filter((q) => esDelInquilino(q.handler));

describe('aislamiento de la PWA del inquilino', () => {
  it('el parseo encuentra queries y handlers (si esto falla, el guard quedó ciego)', () => {
    // Sin esto, un refactor que cambie el estilo de las llamadas dejaría el test en verde
    // sin haber mirado nada — que es la peor forma de fallar para un guard.
    expect(queries.length).toBeGreaterThan(25);
    expect(delInquilino.length).toBeGreaterThan(15);
  });

  it('ninguna query usa un id del request sin acotar por el token', () => {
    const sospechosas = delInquilino
      .filter((q) => VIENE_DEL_REQUEST.test(q.opciones) && !ATADO_AL_TOKEN.test(q.opciones))
      .map((q) => `${q.handler} (línea ${q.linea}) · ${q.llamada}`);

    expect(
      sospechosas,
      'Estas queries eligen la fila con algo que mandó el usuario y no la acotan al token:\n' +
        sospechosas.join('\n') +
        '\n\nUn inquilino puede apuntar a la fila de otro. Agregá el filtro del token al `where`\n' +
        '(`contratoId: inq.contratoId`, `inquilinoId: inq.inquilinoId`, …), o buscá primero con\n' +
        'el filtro puesto y después operá sobre lo encontrado.',
    ).toEqual([]);
  });

  it('todo handler del inquilino ata al menos una query a su token', () => {
    // El caso que la regla de arriba no ve: un handler que lee TODO sin filtrar y sin usar
    // nada del request — no hay id que apuntar, pero devuelve datos de todos.
    const sinAtar = [...new Set(delInquilino.map((q) => q.handler))].filter(
      (ruta) => !delInquilino.some((q) => q.handler === ruta && ATADO_AL_TOKEN.test(q.opciones)),
    );
    expect(
      sinAtar,
      `Estos handlers del inquilino no atan NINGUNA query a su token: ${sinAtar.join(', ')}`,
    ).toEqual([]);
  });
});
