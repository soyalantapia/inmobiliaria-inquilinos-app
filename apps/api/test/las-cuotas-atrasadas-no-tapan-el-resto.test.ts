/**
 * Ocho renglones iguales que tapaban todo lo demás.
 *
 * `GET /mis-notificaciones` empujaba **un aviso por cuota vencida**, con severidad `critica`. El
 * feed ordena por severidad y **corta en 8**. O sea que un inquilino atrasado ocho meses veía
 * ocho veces la misma frase —«Tu alquiler está atrasado», sólo cambia el período— y **nada más**:
 * ni que le rechazaron un reclamo, ni que le asignaron un profesional, ni que le subieron el
 * alquiler.
 *
 * No es teórico: se midió con el inquilino de la demo y las 8 de 8 notificaciones eran la misma.
 * Y encima no le decía lo que de verdad necesita saber, que es **cuánto debe en total**.
 *
 * Ahora una sola cuota conserva su aviso —con el link directo a pagarla— y dos o más se juntan en
 * un renglón con el total y desde cuándo.
 *
 * EL TOTAL ES EL SALDO, no la suma de las cuotas: una cuota PARCIAL ya tiene plata puesta, y
 * decirle que debe el total sería cobrársela dos veces en el aviso.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginDemoTest } from './_login.js';

let app: FastifyInstance;
let tInquilino = '';
const prisma = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const PERIODO = '2099-'; // períodos futuros: no chocan con los del seed
let contratoId = '';

interface Notif {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  severidad: string;
}

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tInquilino = await loginDemoTest(app);
  const payload = JSON.parse(Buffer.from(tInquilino.split('.')[1]!, 'base64url').toString('utf8')) as {
    contratoId?: string;
  };
  expect(payload.contratoId).toBeTruthy();
  contratoId = payload.contratoId!;
}, 420_000);

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

/**
 * NO SE TOCA NINGUNA CUOTA DEL SEED.
 *
 * La primera versión de este archivo las marcaba PAGADO para hacer silencio y las restauraba al
 * final. Funcionaba, pero es exactamente la trampa que ya costó caro en este repo: una corrida
 * interrumpida deja el seed mutado y el rojo aparece dos archivos después, sin relación visible.
 *
 * En vez de eso se mide el DELTA: se lee el aviso agregado antes y después de crear las cuotas,
 * y se afirma sobre la diferencia. Sale igual de preciso y no le debe nada a nadie.
 */
async function limpiar(): Promise<void> {
  // Los pagos PRIMERO: `pagos_liquidacionId_fkey` es RESTRICT, así que borrar la cuota con un
  // pago colgando revienta — y el rojo aparece en la limpieza, no en el caso que lo dejó.
  const mias = await prisma.liquidacion.findMany({
    where: { contratoId, periodo: { startsWith: PERIODO } },
    select: { id: true },
  });
  if (!mias.length) return;
  const ids = mias.map((x) => x.id);
  await prisma.pago.deleteMany({ where: { liquidacionId: { in: ids } } });
  await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });
}

/** Cuántas cuotas atrasadas dice el feed, y por cuánta plata. */
async function atrasoActual(): Promise<{ cuotas: number; detalle: string }> {
  const critica = (await notificaciones()).find((n) => n.severidad === 'critica');
  if (!critica) return { cuotas: 0, detalle: '' };
  const m = critica.titulo.match(/Tenés (\d+) cuotas atrasadas/);
  return { cuotas: m ? Number(m[1]) : 1, detalle: critica.detalle };
}

/** Una cuota vencida del contrato del inquilino demo. */
async function cuotaVencida(mes: number, monto: number) {
  const periodo = `${PERIODO}${String(mes).padStart(2, '0')}`;
  return prisma.liquidacion.create({
    data: {
      inmobiliariaId: (await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId }, select: { inmobiliariaId: true } }))
        .inmobiliariaId,
      contratoId,
      periodo,
      montoAlquiler: monto,
      montoTotal: monto,
      // Vencida de verdad: una fecha pasada.
      fechaVencimiento: new Date(Date.now() - (40 - mes) * 86400000),
      estado: 'VENCIDO',
    },
  });
}

const notificaciones = async (): Promise<Notif[]> => {
  const r = await app.inject({ method: 'GET', url: '/mis-notificaciones', headers: auth(tInquilino) });
  expect(r.statusCode).toBe(200);
  return r.json() as Notif[];
};

describe('las cuotas atrasadas no tapan el resto del feed', () => {
  it('🔴 tres cuotas vencidas suman UN aviso, no tres renglones', async () => {
    const antes = await atrasoActual();
    await cuotaVencida(1, 100_000);
    await cuotaVencida(2, 100_000);
    await cuotaVencida(3, 100_000);
    const notifs = await notificaciones();
    // Con el bug: tres renglones más, todos `critica`, todos con el mismo título.
    expect(notifs.filter((n) => n.severidad === 'critica')).toHaveLength(1);
    const despues = await atrasoActual();
    expect(despues.cuotas).toBe(antes.cuotas + 3);
  });

  it('y dice CUÁNTO debe y desde cuándo, que es lo que el inquilino necesita', async () => {
    const antes = await atrasoActual();
    await cuotaVencida(1, 100_000);
    await cuotaVencida(2, 250_000);
    const despues = await atrasoActual();
    expect(despues.cuotas).toBe(antes.cuotas + 2);
    // El total incluye lo del seed, así que se afirma que CRECIÓ en lo que se agregó.
    const soloNumeros = (t: string) => Number(t.replace(/[^\d]/g, '') || 0);
    expect(soloNumeros(despues.detalle)).toBeGreaterThan(soloNumeros(antes.detalle));
    expect(despues.detalle).toMatch(/desde \d{4}-\d{2}/);
  });

  it('🔴 el total es el SALDO: lo ya pagado de una cuota parcial no se le vuelve a cobrar', async () => {
    const a = await cuotaVencida(1, 100_000);
    const conDeudaEntera = await atrasoActual();
    await prisma.pago.create({
      data: {
        inmobiliariaId: a.inmobiliariaId,
        liquidacionId: a.id,
        contratoId,
        periodo: a.periodo,
        tipo: 'PARCIAL',
        estado: 'CONCILIADO',
        monto: 60_000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date(),
        informadoAt: new Date(),
      },
    });
    const conPagoParcial = await atrasoActual();
    const soloNumeros = (t: string) => Number(t.replace(/[^\d]/g, '') || 0);
    // Con el bug —sumar `montoTotal` a secas— los dos números serían iguales: el pago parcial
    // no bajaría nada y al inquilino se le cobraría dos veces lo que ya puso.
    expect(soloNumeros(conPagoParcial.detalle)).toBeLessThan(soloNumeros(conDeudaEntera.detalle));
    await prisma.pago.deleteMany({ where: { liquidacionId: a.id } });
  });

  it('CONTROL POSITIVO — con UNA sola cuota atrasada el aviso conserva su link directo a pagarla', async () => {
    // El seed del inquilino demo ya trae cuotas vencidas, así que este caso se afirma sobre la
    // FORMA del aviso agregado: sigue siendo uno solo y sigue llevando a algún lado útil.
    const aviso = (await notificaciones()).find((n) => n.severidad === 'critica');
    expect(aviso, 'el inquilino demo tiene cuotas vencidas del seed').toBeTruthy();
    expect(aviso!.href === '/pagos' || aviso!.href.startsWith('/pago/')).toBe(true);
  });

  it('el aviso de atraso es UNO, pase lo que pase', async () => {
    // La afirmación que resume el arreglo: no importa cuántas deba, el feed no se llena de
    // renglones iguales. Ese era el defecto — 8 de 8 notificaciones eran la misma frase.
    for (let m = 1; m <= 6; m++) await cuotaVencida(m, 50_000);
    const criticas = (await notificaciones()).filter((n) => n.severidad === 'critica');
    expect(criticas).toHaveLength(1);
  });
});
