import { describe, expect, it } from 'vitest';
import { exigirDbDeTest, urlEsDeProduccion } from '../prisma/guard-db.js';

/**
 * Tests PUROS del guard que decide si una DATABASE_URL es de producción.
 *
 * Es el único freno entre `seedBase` —destructivo, y corre en el beforeAll de ~50 suites
 * de integración— y la base de un cliente real. Si este predicado se afloja, el modo de
 * falla es borrarle datos a producción, así que las dos propiedades que importan son:
 * que reconozca los hosts de prod, y que ante CUALQUIER duda diga que sí.
 */

const PROD_INTERNA = 'postgresql://u:p@postgres.railway.internal:5432/railway';
const PROXY_TEST = 'postgresql://u:p@thomas.proxy.rlwy.net:23651/railway';
const LOCAL = 'postgresql://llave:llave@localhost:5432/llave';

describe('urlEsDeProduccion', () => {
  it('reconoce el host interno de Railway como producción', () => {
    expect(urlEsDeProduccion(PROD_INTERNA)).toBe(true);
  });

  it('reconoce el nombre del servicio de la base de prod', () => {
    expect(urlEsDeProduccion('postgresql://u:p@myalquiler-db:5432/railway')).toBe(true);
  });

  it('acepta el proxy público, que es la instancia de test/dev', () => {
    expect(urlEsDeProduccion(PROXY_TEST)).toBe(false);
  });

  it('acepta una Postgres local', () => {
    expect(urlEsDeProduccion(LOCAL)).toBe(false);
    expect(urlEsDeProduccion('postgresql://u:p@127.0.0.1:5432/llave')).toBe(false);
    expect(urlEsDeProduccion('postgresql://u:p@host.docker.internal:5432/llave')).toBe(false);
  });

  // Las tres de abajo son el corazón del guard: FALLA CERRADO.
  it('sin URL dice que SÍ es prod (no se puede saber contra qué se escribe)', () => {
    expect(urlEsDeProduccion(undefined)).toBe(true);
    expect(urlEsDeProduccion(null)).toBe(true);
    expect(urlEsDeProduccion('')).toBe(true);
    expect(urlEsDeProduccion('   ')).toBe(true);
  });

  it('un host desconocido se trata como prod', () => {
    // Una base nueva que nadie documentó no es automáticamente segura.
    expect(urlEsDeProduccion('postgresql://u:p@db-nueva.example.com:5432/x')).toBe(true);
  });

  it('no se deja engañar por mayúsculas', () => {
    expect(urlEsDeProduccion('postgresql://u:p@POSTGRES.RAILWAY.INTERNAL:5432/railway')).toBe(true);
  });

  it('si la URL nombra prod, no alcanza con que también nombre el proxy', () => {
    // Orden de evaluación: prod gana. Un caso raro pero es el que no se puede errar.
    expect(urlEsDeProduccion('postgresql://u:p@postgres.railway.internal/railway?x=proxy.rlwy.net')).toBe(true);
  });
});

describe('exigirDbDeTest', () => {
  it('tira contra producción, y el mensaje dice quién y por qué', () => {
    expect(() => exigirDbDeTest('seedBase', PROD_INTERNA)).toThrowError(/seedBase/);
    expect(() => exigirDbDeTest('seedBase', PROD_INTERNA)).toThrowError(/DESTRUCTIVO/);
  });

  it('deja pasar la base de test', () => {
    expect(() => exigirDbDeTest('seedBase', PROXY_TEST)).not.toThrow();
    expect(() => exigirDbDeTest('seedBase', LOCAL)).not.toThrow();
  });
});
