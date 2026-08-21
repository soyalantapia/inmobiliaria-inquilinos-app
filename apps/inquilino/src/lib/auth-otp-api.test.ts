/**
 * T-67 · El login del inquilino caía al OTP de localStorage cuando el API no contestaba.
 *
 * EL AGUJERO. `solicitarCodigoUnificado` y `verificarCodigoUnificado` arrancan con
 * `if (!apiEnabled) return <flujo local>`. O sea que el build demo sale por ahí, y **todo lo
 * que viene después es código de PRODUCCIÓN por construcción** — incluido el `catch` que
 * volvía a caer al flujo local cuando `fetch` rechazaba.
 *
 * El disparador no es "estar offline" (sin red la página ni carga: el service worker es
 * network-first sobre un cache que nunca se llena). Es que la página cargue bien y la llamada
 * falle: corte de 3G a mitad del flujo, DNS, CORS, un adblocker que bloquea el dominio de
 * Railway, un portal cautivo que devuelve HTML donde debería ir JSON.
 *
 * QUÉ PASABA. Se generaba un código local, se lo mostraba **en pantalla** en un banner "Demo",
 * y se le armaba al inquilino un perfil inventado. Y la mitad fea: `desdeLocal` escribe la
 * sesión pero NO toca `llave:auth:token`, mientras que el camino del API sí llama a
 * `cerrarSesion()` cuando cambia el email. En un dispositivo compartido, la persona B entraba
 * con SU email por el fallback, el JWT de A sobrevivía, y como todos los hooks leen el token y
 * no la sesión, B veía el contrato, el saldo y los pagos REALES de A con su nombre en el
 * header. Hay un botón que lleva justo ahí: `mis-alquileres` manda a `/login?force=1` cuando
 * se le vence el persona-token.
 *
 * Un arreglo previo (`0b042656`, 01/07) sacó el `codigo: '000000'` del camino feliz. Cerró la
 * puerta y dejó la ventana.
 *
 * Mismo invariante que ya protege el portal del propietario en `demo-data.test.ts`: **la demo
 * no se prende sola cuando falta el servidor.**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CODIGO_KEY = 'llave-inquilino:auth:codigo:v1';
const SESION_KEY = 'llave-inquilino:auth:sesion:v1';
const TOKEN_KEY = 'llave:auth:token';

/** localStorage de mentira, para poder afirmar qué se escribió y qué no. */
function localStorageFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
    clear: () => datos.clear(),
    key: (i: number) => [...datos.keys()][i] ?? null,
    get length() { return datos.size; },
    _datos: datos,
  };
}

/** Carga el módulo con el API CONFIGURADO (o sea: en modo producción). */
async function cargarEnModoProduccion(store: ReturnType<typeof localStorageFalso>) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.myalquiler.test');
  vi.stubGlobal('window', { localStorage: store });
  vi.stubGlobal('localStorage', store);
  const mod = await import('./auth-otp-api');
  const client = await import('./api/client');
  return { mod, apiEnabled: client.apiEnabled };
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('T-67 — con el API caído, el login NO se cae a la demo', () => {
  it('el escenario es de producción: apiEnabled tiene que ser true', async () => {
    const { apiEnabled } = await cargarEnModoProduccion(localStorageFalso());
    // Si esto fuera false, el test estaría probando el build demo y no probaría nada.
    expect(apiEnabled).toBe(true);
  });

  it('pedir el código con fetch rechazando devuelve error honesto, no un código local', async () => {
    const store = localStorageFalso();
    const { mod } = await cargarEnModoProduccion(store);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const r = await mod.solicitarCodigoUnificado('mariela@ejemplo.test');

    expect(r.ok).toBe(false);
    // Y sobre todo: no se generó ningún código en el dispositivo.
    expect(store.getItem(CODIGO_KEY)).toBeNull();
    // Con el bug devolvía { ok: true, codigo: '123456' } y el banner lo mostraba en pantalla.
    expect((r as { codigo?: string }).codigo).toBeUndefined();
  });

  // Los dos de abajo hacen el flujo COMPLETO —pedir y después verificar—, que es el camino
  // real del bug. Verificar en aislamiento no prueba nada: sin un código guardado el flujo
  // local falla igual, así que el test pasaría con el bug puesto. El código local sólo existe
  // si el PRIMER paso también cayó al fallback.
  async function flujoCompletoConApiCaido(store: ReturnType<typeof localStorageFalso>, email: string) {
    const { mod } = await cargarEnModoProduccion(store);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const pedido = await mod.solicitarCodigoUnificado(email);
    // Con el bug, acá quedó un código en localStorage y `pedido.codigo` lo trae.
    const codigo = (pedido as { codigo?: string }).codigo ?? leerCodigoDe(store) ?? '123456';
    const verificado = await mod.verificarCodigoUnificado(email, codigo);
    return { pedido, verificado };
  }

  /** El código que el fallback local dejó guardado, si dejó alguno. */
  function leerCodigoDe(store: ReturnType<typeof localStorageFalso>): string | null {
    const raw = store.getItem(CODIGO_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { codigo?: string }).codigo ?? null;
    } catch {
      return null;
    }
  }

  it('el flujo entero con el API caído no crea ninguna sesión', async () => {
    const store = localStorageFalso();
    const { verificado } = await flujoCompletoConApiCaido(store, 'mariela@ejemplo.test');

    expect(verificado.ok).toBe(false);
    // Con el bug: ok true, tipo 'entrar', y una sesión con un perfil inventado.
    expect(store.getItem(SESION_KEY)).toBeNull();
  });

  it('LO IMPORTANTE: no deja entrar sobre el JWT de otra persona', async () => {
    // Dispositivo compartido: A dejó su token vivo. B intenta entrar y el API no contesta.
    const store = localStorageFalso({ [TOKEN_KEY]: 'jwt-de-la-persona-A' });
    const { verificado } = await flujoCompletoConApiCaido(store, 'persona-b@ejemplo.test');

    expect(verificado.ok).toBe(false);
    // Con el bug: se escribía la sesión de B y el token de A quedaba intacto —el camino del
    // API llama a cerrarSesion() cuando cambia el email, el local no—. Como todos los hooks
    // leen el token y no la sesión, B veía el contrato, el saldo y los pagos REALES de A.
    expect(store.getItem(SESION_KEY)).toBeNull();
    expect(store.getItem(TOKEN_KEY)).toBe('jwt-de-la-persona-A');
  });

  it('un error DEL SERVIDOR sigue informándose distinto de uno de conexión', async () => {
    const store = localStorageFalso();
    const { mod } = await cargarEnModoProduccion(store);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ message: 'Esperá un momento antes de pedir otro código' }),
      text: async () => '{}',
      headers: { get: () => 'application/json' },
    }));

    const r = await mod.solicitarCodigoUnificado('mariela@ejemplo.test');
    expect(r.ok).toBe(false);
    expect(store.getItem(CODIGO_KEY)).toBeNull();
  });
});
