/**
 * T-23-N1 · Que el portal del propietario no se salga de su tenant.
 *
 * El portal es una superficie de LECTURA sobre datos financieros de terceros: un propietario
 * entra y ve su cartera, sus rendiciones y los reclamos de sus propiedades. El único hilo que
 * lo mantiene adentro de su inmobiliaria es que TODAS las queries filtren por el
 * `inmobiliariaId` que viene en su token. Si alguien saca uno de esos filtros en un refactor,
 * el propietario de un tenant empieza a ver plata de otro — y no hay nada que se ponga rojo.
 *
 * QUÉ ES ESTE TEST Y QUÉ NO ES. No es el test de integración que pide T-23-N1: ese necesita una
 * base de datos y hoy no hay ninguna que se pueda usar (la remota es compartida con otros
 * procesos y `seedBase` la reescribe; local no hay). Este es un guard ESTRUCTURAL: lee el
 * archivo de rutas y verifica que cada query del portal nombre el tenant del token. Es un
 * instrumento más débil —no prueba el comportamiento, prueba la forma— pero cubre exactamente
 * el modo de falla que la tarea nombra: "que alguien saque un inmobiliariaId de un where".
 *
 * Se corre sin base de datos y sin red.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTAS = join(AQUI, '..', 'src', 'routes', 'portal-propietario.ts');
const fuente = readFileSync(RUTAS, 'utf8');

/** Una llamada a Prisma encontrada en el archivo, con su handler y su objeto de opciones. */
interface Query {
  /** Ruta del handler donde vive, p.ej. "/portal/rendiciones". */
  ruta: string;
  /** `propietario.findMany`, `rendicion.findFirst`, … */
  llamada: string;
  /** El objeto de opciones completo, con las llaves balanceadas. */
  opciones: string;
  linea: number;
}

/**
 * Recorre el archivo y arma la lista de queries, atribuyendo cada una al último handler
 * declarado antes de ella.
 *
 * Es un parseo por texto a propósito: meter un parser de TypeScript para esto sería una
 * dependencia nueva, y el archivo tiene un estilo uniforme (`prisma.modelo.metodo({ … })`).
 * Si mañana ese estilo cambia, el test se cae — y eso es deseable: ver más abajo por qué.
 */
function extraerQueries(src: string): Query[] {
  const queries: Query[] = [];
  const reRuta = /app\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g;
  const rePrisma = /prisma\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|aggregate|groupBy|create|createMany|update|updateMany|delete|deleteMany|upsert)\(/g;

  // Dónde arranca cada handler, para atribuirle las queries que vienen después.
  const rutas: Array<{ indice: number; ruta: string }> = [];
  for (let m = reRuta.exec(src); m; m = reRuta.exec(src)) {
    rutas.push({ indice: m.index, ruta: m[1] });
  }

  for (let m = rePrisma.exec(src); m; m = rePrisma.exec(src)) {
    const inicio = m.index + m[0].length; // justo después del paréntesis
    const opciones = recortarBalanceado(src, inicio);
    const previa = [...rutas].reverse().find((r) => r.indice < m!.index);
    queries.push({
      ruta: previa?.ruta ?? '(fuera de un handler)',
      llamada: `${m[1]}.${m[2]}`,
      opciones,
      linea: src.slice(0, m.index).split('\n').length,
    });
  }
  return queries;
}

/** Devuelve el texto desde `desde` hasta el paréntesis que cierra la llamada. */
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

const queries = extraerQueries(fuente);
const delPortal = queries.filter((q) => q.ruta.startsWith('/portal/'));

describe('aislamiento del portal del propietario (T-23-N1)', () => {
  /**
   * Este test existe para que el guard no se vuelva un adorno.
   *
   * Si mañana alguien mueve las queries a un helper, o cambia el estilo de las llamadas, el
   * regex deja de matchear y TODOS los tests de abajo pasarían por vacuidad — un guard verde
   * que no guarda nada, que es peor que no tenerlo. Con este piso, ese refactor rompe la suite
   * y obliga a mirar.
   */
  it('encuentra las queries del portal (si esto falla, el guard dejó de mirar el código)', () => {
    expect(
      delPortal.length,
      'No se encontraron queries dentro de los handlers /portal/*. O se movieron a otro archivo, ' +
        'o cambió el estilo de las llamadas a Prisma. Actualizá este guard: NO lo borres.',
    ).toBeGreaterThanOrEqual(5);

    // Los 5 endpoints de lectura del portal tienen que seguir estando.
    const rutas = new Set(delPortal.map((q) => q.ruta));
    for (const esperada of ['/portal/mi-cartera', '/portal/propiedades', '/portal/rendiciones', '/portal/reclamos']) {
      expect(rutas, `El handler ${esperada} dejó de tener queries propias`).toContain(esperada);
    }
  });

  it('TODA query del portal filtra por el tenant que viene en el token', () => {
    const sinTenant = delPortal.filter((q) => !q.opciones.includes('p.inmobiliariaId'));
    expect(
      sinTenant.map((q) => `${q.ruta} → prisma.${q.llamada} (línea ${q.linea})`),
      'Una query del portal no nombra `p.inmobiliariaId`. El propietario de una inmobiliaria ' +
        'podría ver datos de otra. Si el filtro es transitivo (ids que salen de una query ya ' +
        'scopeada), igual dejá el `inmobiliariaId` explícito: es barato y es la diferencia ' +
        'entre una garantía y una cadena de razonamientos.',
    ).toEqual([]);
  });

  it('ninguna query del portal usa findUnique', () => {
    // `findUnique` sólo acepta campos únicos en el where, así que NO se le puede agregar el
    // `inmobiliariaId` como filtro extra: buscar por `id` solo y confiar en que sea del tenant
    // correcto es el bug multi-tenant clásico. `findFirst` sí acepta el filtro compuesto.
    const unicos = delPortal.filter((q) => q.llamada.includes('findUnique'));
    expect(
      unicos.map((q) => `${q.ruta} → prisma.${q.llamada} (línea ${q.linea})`),
      'Usá findFirst con { id, inmobiliariaId: p.inmobiliariaId } en vez de findUnique.',
    ).toEqual([]);
  });

  it('el portal no escribe: es una superficie de sólo lectura', () => {
    const ESCRITURAS = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
    const escrituras = delPortal.filter((q) => ESCRITURAS.some((e) => q.llamada.endsWith(`.${e}`)));
    expect(
      escrituras.map((q) => `${q.ruta} → prisma.${q.llamada} (línea ${q.linea})`),
      'Apareció una escritura en el portal del propietario. Hoy es de sólo lectura, y ese es ' +
        'el motivo por el que su superficie de riesgo es chica. Si hace falta escribir, ' +
        'revisá primero el modelo de permisos.',
    ).toEqual([]);
  });

  it('las rendiciones por id se buscan por id + propietario + tenant, los tres', () => {
    // Es el endpoint más sensible: devuelve el detalle de la plata de una rendición. Con sólo
    // `id` alcanzaría para leer la de cualquiera.
    const detalle = delPortal.filter((q) => q.ruta === '/portal/rendiciones/:id');
    expect(detalle.length).toBeGreaterThanOrEqual(1);
    for (const q of detalle) {
      expect(q.opciones, `prisma.${q.llamada} en ${q.ruta}`).toContain('p.propietarioId');
      expect(q.opciones, `prisma.${q.llamada} en ${q.ruta}`).toContain('p.inmobiliariaId');
    }
  });
});
