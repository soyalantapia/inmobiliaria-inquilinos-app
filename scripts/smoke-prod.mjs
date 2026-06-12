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

let tokenDemo = '';
await check('POST /auth/demo (sesión Mariela)', async () => {
  const r = await json('/auth/demo', { method: 'POST' });
  if (!r.token) throw new Error('sin token');
  tokenDemo = r.token;
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

await check('GET /mis-anuncios (inquilino)', async () => {
  const lista = await json('/mis-anuncios', { headers: { Authorization: `Bearer ${tokenDemo}` } });
  if (!Array.isArray(lista)) throw new Error('respuesta inválida');
});

await check('GET /anuncios con conteos reales', async () => {
  const lista = await json('/anuncios', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
  if (!lista[0]?.conteos) throw new Error('sin conteos');
});

console.log(fallos === 0 ? '\n🎉 smoke OK' : `\n💥 ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
