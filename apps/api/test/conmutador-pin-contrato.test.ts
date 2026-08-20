/**
 * T-25 · El contrato del conmutador, leído del fuente.
 *
 * Estos tests NO tocan la base: leen `pin-conmutador.ts` y `auth.ts` y verifican propiedades
 * estructurales. Es deliberado, y por dos razones:
 *
 *  1. Los tests que necesitan Postgres no se pueden correr desde una máquina sin `.env`, y esta
 *     es la parte del feature donde un error sale más caro.
 *  2. Dos de las tres garantías de acá **no se pueden observar** con un test de comportamiento
 *     razonable: que ningún 401 salga por un PIN mal, y que el contador se incremente de forma
 *     atómica, sólo se ven mirando cómo está escrito.
 *
 * Si alguno falla, no lo edites para que pase: lo que cambió es una garantía de seguridad.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CONMUTADOR = readFileSync(join(AQUI, '..', 'src', 'auth', 'pin-conmutador.ts'), 'utf8');
const PIN_VIEJO = readFileSync(join(AQUI, '..', 'src', 'auth', 'pin.ts'), 'utf8');
const AUTH = readFileSync(join(AQUI, '..', 'src', 'routes', 'auth.ts'), 'utf8');

describe('T-25 · el lockout tiene que ser atómico', () => {
  it('el contador de fallos se incrementa con { increment: 1 }, no leyendo y sumando', () => {
    expect(CONMUTADOR).toMatch(/pinIntentosFallidos:\s*\{\s*increment:\s*1\s*\}/);
  });

  it('la decisión de bloquear usa el valor DEVUELTO por el update', () => {
    // Con un read-then-write, N intentos concurrentes leen todos el mismo contador, escriben
    // todos 1, y `pinBloqueadoHasta` nunca se puebla: el techo real deja de ser el lockout y
    // pasa a ser el rate limit por IP. Romper 5 dígitos baja de ~208 días a ~9, y sin que se
    // dispare una sola alarma que el ADMIN pueda ver.
    expect(CONMUTADOR).toMatch(/const\s+r\s*=\s*await\s+prisma\.usuario\.update/);
    expect(CONMUTADOR).toMatch(/r\.pinIntentosFallidos\s*>=/);
  });

  it('no corre bcrypt si ya está bloqueado', () => {
    // bcryptjs es JS puro y bloquea el event loop ~60-100 ms. Gastarlo en un intento que ya se
    // va a rechazar convierte el lockout en un amplificador de DoS.
    const cortaPorBloqueo = CONMUTADOR.indexOf('pinBloqueadoHasta > ahora');
    const primerCompare = CONMUTADOR.indexOf('bcrypt.compareSync');
    expect(cortaPorBloqueo).toBeGreaterThan(-1);
    expect(primerCompare).toBeGreaterThan(cortaPorBloqueo);
  });
});

describe('T-25 · el PIN nunca puede devolver 401', () => {
  it('ResultadoPin sólo admite 403, 423 y 409', () => {
    // `manejarSesionVencida` del panel dispara ante CUALQUIER 401 con token: borra la sesión y
    // manda a /login. Un 401 por PIN incorrecto desloguearía al operador por equivocarse —
    // exactamente lo contrario de lo que el conmutador viene a resolver.
    const codes = [...CONMUTADOR.matchAll(/code:\s*(\d{3})/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    expect([...new Set(codes)].sort()).toEqual(['403', '409', '423']);
    expect(CONMUTADOR).not.toMatch(/code:\s*401/);
  });
});

describe('T-25 · no se resucita el PIN de las acciones de plata', () => {
  it('verificarPinUsuario sigue aprobando siempre', () => {
    // Seis endpoints de plata la llaman (plata ×2, operacion ×2, core ×2). Si volviera a
    // verificar, todos empezarían a exigir un PIN que casi nadie tiene cargado. La decisión del
    // dueño es que NINGUNA acción de plata pide PIN; el conmutador es la única excepción y por
    // eso vive en su propio archivo.
    expect(PIN_VIEJO).toMatch(/return\s*\{\s*ok:\s*true\s*\}/);
  });

  it('el conmutador NO importa nada del archivo viejo', () => {
    expect(CONMUTADOR).not.toMatch(/from\s+['"]\.\/pin\.js['"]/);
  });
});

describe('T-25 · el PIN no es un login desde cero', () => {
  it('conmutar exige sesión antes que PIN', () => {
    const i = AUTH.indexOf("'/auth/usuario/conmutar'");
    expect(i).toBeGreaterThan(-1);
    const handler = AUTH.slice(i, i + 1200);
    const pideSesion = handler.indexOf('requireUsuario');
    const leeBody = handler.indexOf('safeParse');
    expect(pideSesion).toBeGreaterThan(-1);
    // requireUsuario ANTES de siquiera mirar el body: sin sesión no hay nada que adivinar.
    expect(pideSesion).toBeLessThan(leeBody);
  });

  it('un ADMIN puede borrar el PIN de otro, pero NUNCA setearlo', () => {
    // Un ADMIN que pudiera escribir el PIN ajeno podría convertirse en la cajera sin dejar un
    // rastro distinguible de un cambio legítimo.
    expect(AUTH).toMatch(/app\.delete\('\/auth\/usuario\/:id\/pin'/);
    expect(AUTH).not.toMatch(/app\.(post|put)\('\/auth\/usuario\/:id\/pin'\s*,/);
  });

  it('/auth/pin quedó con rate limit propio', () => {
    const i = AUTH.indexOf("app.post('/auth/pin'");
    expect(i).toBeGreaterThan(-1);
    expect(AUTH.slice(i, i + 160)).toMatch(/rateLimit/);
  });
});

describe('T-25 · el bloqueo de pantalla', () => {
  it('comparte el lockout del conmutador, no trae uno propio', () => {
    // Si tuviera su propio contador, probar PINes contra la pantalla bloqueada sería un canal
    // sin límite paralelo al del conmutador. Es el mismo ataque: mismo contador.
    const i = AUTH.indexOf("'/auth/pantalla/desbloquear'");
    expect(i).toBeGreaterThan(-1);
    expect(AUTH.slice(i, i + 900)).toMatch(/verificarPinConmutador/);
  });

  it('tampoco devuelve 401 por un PIN mal', () => {
    const i = AUTH.indexOf("'/auth/pantalla/desbloquear'");
    const handler = AUTH.slice(i, i + 900);
    // Reenvía el `r` del verificador, que sólo produce 403/423/409.
    expect(handler).toMatch(/reply\.code\(r\.code\)/);
    expect(handler).not.toMatch(/code\(401\)/);
  });

  it('tiene rate limit propio', () => {
    const i = AUTH.indexOf("'/auth/pantalla/desbloquear'");
    expect(AUTH.slice(i, i + 200)).toMatch(/rateLimit/);
  });
});
