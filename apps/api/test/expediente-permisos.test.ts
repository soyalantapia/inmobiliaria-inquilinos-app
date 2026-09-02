import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P2 — los 8 endpoints del expediente de propiedad/contrato usaban
// `requireUsuario(request, reply)` SIN capacidad: alcanzaba con estar logueado. Un rol
// CARGA —que la matriz deja fuera de pagos.ver, caja.ver y reclamos.ver— leía la deuda de
// los inquilinos, los gastos de caja, las comisiones ganadas y los reclamos. Ahora cada uno
// pide la capacidad que la matriz ya declaraba.

let app: FastifyInstance;
let prisma: PrismaClient;
let tCARGA = '';
let tLECTURA = '';
let usuarioLecturaId = '';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const RUTAS_PLATA = [
  '/propiedades/prp_001/ganancias',
  '/propiedades/prp_001/salud-pago',
  '/propiedades/prp_001/gastos',
];

async function login(email: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'delsol123' } });
  return r.json().token as string;
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  // El seed no trae un LECTURA: lo creamos para probar el lado positivo del guard.
  const camila = await prisma.usuario.findFirstOrThrow({ where: { email: 'camila@delsol.com' } });
  const lectura = await prisma.usuario.upsert({
    where: { inmobiliariaId_email: { inmobiliariaId: inmo.id, email: 'zz-cazabug-lectura@delsol.com' } },
    update: { activo: true, rol: 'LECTURA' },
    create: {
      email: 'zz-cazabug-lectura@delsol.com', nombre: 'Zz', apellido: 'Lectura', rol: 'LECTURA',
      inmobiliariaId: inmo.id, passwordHash: camila.passwordHash, pinHash: camila.pinHash, activo: true,
    },
  });
  usuarioLecturaId = lectura.id;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tCARGA = await login('camila@delsol.com');
  tLECTURA = await login('zz-cazabug-lectura@delsol.com');
});

afterAll(async () => {
  if (usuarioLecturaId) await prisma.usuario.deleteMany({ where: { id: usuarioLecturaId } });
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — el expediente de propiedad pide capacidad', () => {
  it('un CARGA NO puede leer plata de la propiedad (403)', async () => {
    for (const url of RUTAS_PLATA) {
      const r = await app.inject({ method: 'GET', url, headers: auth(tCARGA) });
      expect(r.statusCode, `${url} con CARGA`).toBe(403); // antes: 200
    }
  });

  it('un LECTURA SÍ puede (la matriz le da pagos.ver y caja.ver)', async () => {
    for (const url of RUTAS_PLATA) {
      const r = await app.inject({ method: 'GET', url, headers: auth(tLECTURA) });
      expect(r.statusCode, `${url} con LECTURA`).toBe(200);
    }
  });

  it('la respuesta de ganancias trae el desglose por moneda (forma, no plata)', async () => {
    // ACÁ HABÍA UN TEST QUE NO PODÍA FALLAR, y se cambió por dos motivos, no uno:
    //
    //   · corría sobre `prp_001`, que en el seed tiene UN solo contrato y en ARS: el escenario
    //     de mezcla nunca se ejercitaba;
    //   · y la aserción se comparaba contra sí misma. `body.moneda` y `body.total` salen los dos
    //     de `totales[0]`, así que `principal` era siempre `totales[0]` y comparar uno con otro
    //     era una tautología de la FORMA de la respuesta. Encima iba dentro de un `if
    //     (principal)`, así que ante un `undefined` se salteaba en vez de fallar.
    //
    // Se midió: inyectando la regresión —que el total vuelva a sumar las monedas— el test viejo
    // pasaba en VERDE y el nuevo se pone rojo.
    //
    // La cobertura de verdad vive en `ganancias-no-mezclan-monedas.test.ts`, con un fixture
    // propio de dos contratos ACTIVOS en monedas distintas. Acá queda sólo lo que este archivo
    // sí es: un test de PERMISOS, verificando que LECTURA recibe la respuesta con su forma.
    const r = await app.inject({ method: 'GET', url: '/propiedades/prp_001/ganancias', headers: auth(tLECTURA) });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(Array.isArray(body.totalesPorMoneda)).toBe(true);
    expect(body.total).toHaveProperty('ganado');
    expect(body.total).toHaveProperty('proyeccion');
  });
});
