#!/usr/bin/env node
/**
 * Smoke del API en producción: health + login demo + 3 endpoints clave.
 * Uso: node scripts/smoke-prod.mjs https://<api>.up.railway.app
 */
const base = (process.argv[2] ?? 'http://localhost:3002').replace(/\/$/, '');
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

const json = async (path, init = {}) => {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
};

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
  if (r.status !== 404) throw new Error(`abierto: HTTP ${r.status}`);
});

let tokenAdmin = '';
await check('POST /auth/login (Roberto)', async () => {
  const r = await json('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'roberto@delsol.com', password: 'delsol123' }),
  });
  tokenAdmin = r.token;
});

await check('GET /contratos (panel, con estado de pago derivado)', async () => {
  const lista = await json('/contratos', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
  if (!Array.isArray(lista) || lista.length === 0) throw new Error('lista vacía');
  if (!lista[0].estadoPagoActual) throw new Error('sin estadoPagoActual derivado');
});

// SIN COBERTURA desde que se cerró el atajo de la demo: este smoke no tiene forma de conseguir
// un token de inquilino sin credenciales reales, y meterlas acá sería el mismo problema que ya
// tiene el login de Roberto de arriba. Se deja anotado en vez de borrado, para que se vea que
// falta y no que nunca importó.
console.log('· GET /mis-anuncios (inquilino) — sin cubrir: hace falta un token de inquilino real');

await check('GET /anuncios con conteos reales', async () => {
  const lista = await json('/anuncios', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
  if (!lista[0]?.conteos) throw new Error('sin conteos');
});

console.log(fallos === 0 ? '\n🎉 smoke OK' : `\n💥 ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
