/**
 * `limpiarEstadoDeSesion` — el barrido que corre al cerrar sesión y al cambiar de usuario.
 *
 * POR QUÉ ESTO MERECE UN TEST. Es el mostrador compartido de Camila: una máquina, varias
 * personas. Si el barrido se saltea una clave, el que entra hereda datos del anterior — y ya
 * pasó una vez. El comentario que había en `cerrarSesion` lo cuenta: *"el siguiente que entraba
 * heredaba la razón social y el CUIT del anterior y los imprimía en sus PDF de cobranza"*. Se
 * arregló esa clave a mano y quedaron las otras 33.
 *
 * Los dos casos que importan son justamente los que un barrido ingenuo rompe: **borrar todas**
 * (no saltearse ninguna) y **no borrar el token**, que es de otro prefijo y lo maneja el caller.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { limpiarEstadoDeSesion } from './sesion-limpieza';

/** localStorage mínimo. `key(i)` es la parte que importa: el barrido itera por índice. */
function instalarStorageFalso(): Storage {
  let mapa = new Map<string, string>();
  const fake = {
    get length() {
      return mapa.size;
    },
    key: (i: number) => [...mapa.keys()][i] ?? null,
    getItem: (k: string) => mapa.get(k) ?? null,
    setItem: (k: string, v: string) => void mapa.set(k, v),
    removeItem: (k: string) => void mapa.delete(k),
    clear: () => void (mapa = new Map()),
  } as unknown as Storage;
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: fake },
    writable: true,
    configurable: true,
  });
  return fake;
}

describe('limpiarEstadoDeSesion', () => {
  let store: Storage;
  beforeEach(() => {
    store = instalarStorageFalso();
  });

  it('borra TODAS las claves del prefijo, no sólo la primera', () => {
    // El bug clásico de barrer un storage: mutarlo mientras se lo recorre por índice hace que se
    // saltee elementos. Con 34 claves —las que hay hoy— saltearse una es exactamente el modo de
    // fallo que este barrido vino a cerrar.
    for (let i = 0; i < 34; i++) store.setItem(`llave-inmo:clave-${i}`, 'x');
    expect(store.length).toBe(34);

    limpiarEstadoDeSesion();

    expect(store.length).toBe(0);
  });

  it('NO borra el token de sesión', () => {
    // `llave:auth:token` es otro prefijo (sin guion) a propósito: quién decide sobre el token es
    // el caller, porque el conmutador lo REEMPLAZA y el logout lo BORRA. Si el barrido se lo
    // llevara, conmutar de usuario tiraría al login en vez de cambiar de persona.
    store.setItem('llave:auth:token', 'jwt-vivo');
    store.setItem('llave-inmo:caja', 'algo');

    limpiarEstadoDeSesion();

    expect(store.getItem('llave:auth:token')).toBe('jwt-vivo');
    expect(store.getItem('llave-inmo:caja')).toBeNull();
  });

  it('no toca claves de otras apps que convivan en el mismo navegador', () => {
    // La PWA del inquilino y el portal del propietario se abren en el mismo browser. Barrer de
    // más desloguearía a otra app.
    store.setItem('llave-inquilino:pagos', 'de la PWA');
    store.setItem('otra-cosa', 'ajena');
    store.setItem('llave-inmo:rendiciones', 'propia');

    limpiarEstadoDeSesion();

    expect(store.getItem('llave-inquilino:pagos')).toBe('de la PWA');
    expect(store.getItem('otra-cosa')).toBe('ajena');
    expect(store.getItem('llave-inmo:rendiciones')).toBeNull();
  });

  it('con el storage vacío no explota', () => {
    expect(() => limpiarEstadoDeSesion()).not.toThrow();
  });

  it('si localStorage tira, no propaga el error', () => {
    // Modo privado o cuota llena. No poder limpiar no puede impedir que alguien cierre sesión o
    // cambie de usuario: el hard nav de después igual descarta la memoria, que es la otra mitad
    // del problema.
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          get length(): number {
            throw new Error('SecurityError');
          },
          key: () => null,
          removeItem: () => undefined,
        },
      },
      writable: true,
      configurable: true,
    });
    expect(() => limpiarEstadoDeSesion()).not.toThrow();
  });
});

describe('la sesión del PROPIETARIO también se va', () => {
  let store: Storage;
  beforeEach(() => {
    store = instalarStorageFalso();
  });

  it('cerrar sesión en el panel borra el token del dueño que quedó abierto', () => {
    // El portal se sirve como /propietario de este MISMO host, así que comparten
    // localStorage. En el mostrador de Camila: le muestra a un dueño su rendición, el dueño
    // entra con su OTP, ella cierra sesión — y sin este barrido el token del dueño sobrevive
    // SIETE DÍAS. El que use la máquina después abre /propietario y entra como él.
    store.setItem('myalquiler-propietario:token', 'jwt-del-duenio');
    store.setItem('myalquiler-propietario:sesion', '{"nombre":"Eduardo Castro"}');
    store.setItem('llave-inmo:caja', '{}');

    limpiarEstadoDeSesion();

    expect(store.getItem('myalquiler-propietario:token')).toBeNull();
    expect(store.getItem('myalquiler-propietario:sesion')).toBeNull();
    expect(store.getItem('llave-inmo:caja')).toBeNull();
  });

  it('el token del PANEL sigue siendo del caller: no se toca', () => {
    // No-regresión de la regla que ya estaba: el conmutador lo REEMPLAZA y el logout lo
    // BORRA, y quien decide es el caller. Si este barrido se lo llevara, el conmutador de
    // usuarios dejaría de funcionar.
    store.setItem('llave:auth:token', 'jwt-del-panel');
    store.setItem('myalquiler-propietario:token', 'jwt-del-duenio');

    limpiarEstadoDeSesion();

    expect(store.getItem('llave:auth:token')).toBe('jwt-del-panel');
    expect(store.getItem('myalquiler-propietario:token')).toBeNull();
  });
});
