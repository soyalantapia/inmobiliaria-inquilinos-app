#!/usr/bin/env node
/**
 * Smoke del API: lo que se puede afirmar sin credenciales, más lo que se puede afirmar con ellas.
 *
 * Uso:
 *   node scripts/smoke-prod.mjs https://<api>.up.railway.app
 *   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke-prod.mjs https://<api>.up.railway.app
 *
 * POR QUÉ LAS CREDENCIALES VAN POR ENV Y NO ACÁ. Este script tenía hardcodeado el usuario del
 * seed (`roberto@delsol.com`), que existe en local y NO existe en producción — ahí vive el tenant
 * real. Resultado: corrido contra prod, que es para lo que se llama, daba SIEMPRE 3 fallos de 5.
 * Y un smoke que falla siempre es un smoke que nadie mira: el día que se rompa algo de verdad,
 * los ✗ nuevos van a estar mezclados con los ✗ de siempre.
 *
 * Ahora la falta de credenciales no es un fallo, es cobertura que no se tiene, y se dice así —
 * igual que ya hacía la línea del inquilino. Un 401 con credenciales dadas SÍ es un fallo: ahí
 * alguien puso un usuario y no entró.
 */
const base = (process.argv[2] ?? 'http://localhost:3002').replace(/\/$/, '');
const esLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(base);

/**
 * En LOCAL cae al usuario del seed, que es público y está en `prisma/seed.ts`. Contra cualquier
 * otro destino hay que pasarlas por env: nunca una credencial real en el repo.
 */
const EMAIL = process.env.SMOKE_EMAIL ?? (esLocal ? 'roberto@delsol.com' : '');
const PASSWORD = process.env.SMOKE_PASSWORD ?? (esLocal ? 'delsol123' : '');

let fallos = 0;

async function check(nombre, fn) {
  try {
    await fn();
    console.log(`✓ ${nombre}`);
  } catch (e) {
    fallos++;
    console.error(`✗ ${nombre} — ${e.message}`);
  }
}

/** Lo que no se puede verificar. No suma fallo — pero se imprime, para que se vea el hueco. */
function sinCubrir(nombre, porque) {
  console.log(`· ${nombre} — sin cubrir: ${porque}`);
}

const json = async (path, init = {}) => {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
};

// ===== Lo que se afirma SIN credenciales. Es lo único que corre siempre, y es lo que más
// importa: que la API esté viva contra su base, y que el atajo de la demo siga cerrado. =====

await check('GET /health (db up)', async () => {
  const h = await json('/health');
  if (h.db !== 'up') throw new Error(`db=${h.db}`);
});

// Se AFIRMA QUE ESTÁ CERRADO, no que funcione. Este endpoint emite una sesión de un inquilino
// real sin ninguna prueba de identidad; en producción tiene que devolver 404 siempre (T-68: dos
// candados, DEMO_MODE y NODE_ENV). Antes este smoke verificaba lo contrario —que devolviera un
// token—, que es dar por bueno el agujero: si alguna vez fallaba, el arreglo "obvio" era prender
// DEMO_MODE en producción.
await check('POST /auth/demo CERRADO en prod (404)', async () => {
  const r = await fetch(`${base}/auth/demo`, { method: 'POST' });
  if (r.status === 404) return;
  // "ABIERTO" ES UNA ACUSACIÓN, Y HAY QUE MERECERLA.
  //
  // Esto decía `abierto: HTTP ${status}` ante cualquier cosa que no fuera 404, así que durante
  // la ventana de reinicio de CUALQUIER deploy el smoke gritaba que el atajo que emite sesiones
  // de un inquilino real sin prueba de identidad estaba abierto en producción. Es lo más grave
  // que este script puede decir, y lo decía por un 502 de treinta segundos.
  //
  // Un 5xx no es "abierto": es "no contesta". La única respuesta que prueba que el atajo está
  // vivo es un 2xx.
  if (r.status >= 500) throw new Error(`la API no contestó (HTTP ${r.status}) — ¿deploy en curso? No prueba nada sobre el atajo`);
  if (r.status < 300) throw new Error(`ABIERTO: devolvió HTTP ${r.status}. Este endpoint emite una sesión sin prueba de identidad`);
  throw new Error(`respuesta inesperada: HTTP ${r.status} (se esperaba 404)`);
});

// ===== Lo que necesita un usuario del panel. =====

let tokenAdmin = '';
if (!EMAIL || !PASSWORD) {
  sinCubrir(
    'los 2 checks del panel',
    'sin SMOKE_EMAIL / SMOKE_PASSWORD. Pasalos por env para cubrir /contratos y /anuncios',
  );
} else {
  await check(`POST /auth/login (${EMAIL})`, async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    // El 401 se distingue del resto A PROPÓSITO: con credenciales dadas es un fallo de verdad
    // —alguien puso un usuario y no entró—, mientras que un 500 o un timeout es la API rota. Los
    // dos suman fallo, pero el mensaje tiene que decir cuál de los dos pasó.
    if (r.status === 401) throw new Error('credenciales rechazadas (401): ¿ese usuario existe en este destino?');
    if (!r.ok) throw new Error(`/auth/login → HTTP ${r.status}`);
    tokenAdmin = (await r.json()).token;
    if (!tokenAdmin) throw new Error('login OK pero sin token en la respuesta');
  });
}

if (!tokenAdmin) {
  sinCubrir('GET /contratos y GET /anuncios', 'no hay token de panel');
} else {
  await check('GET /contratos (panel, con estado de pago derivado)', async () => {
    const lista = await json('/contratos', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    if (!Array.isArray(lista) || lista.length === 0) throw new Error('lista vacía');
    if (!lista[0].estadoPagoActual) throw new Error('sin estadoPagoActual derivado');
  });

  await check('GET /anuncios con conteos reales', async () => {
    const lista = await json('/anuncios', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    if (!lista[0]?.conteos) throw new Error('sin conteos');
  });
}

// SIN COBERTURA desde que se cerró el atajo de la demo: este smoke no tiene forma de conseguir
// un token de inquilino sin credenciales reales. Se deja anotado en vez de borrado, para que se
// vea que falta y no que nunca importó.
sinCubrir('GET /mis-anuncios (inquilino)', 'hace falta un token de inquilino real');

console.log(fallos === 0 ? '\n🎉 smoke OK' : `\n💥 ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
