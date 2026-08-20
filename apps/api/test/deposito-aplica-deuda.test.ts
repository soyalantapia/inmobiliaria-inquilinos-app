import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P1 (rescatado de la rama varada fix/camila-hunt) — al retener el depósito
// (NETEAR/EJECUTAR) el sistema marcaba el estado, cobraba la penalidad… y NO tocaba una sola
// liquidación. No se creaba ningún Pago: la garantía del inquilino se consumía y la deuda
// quedaba intacta, sumando punitorios. Encima el panel mostraba "Saldo a cobrar al
// inquilino" con el depósito ya restado — un neto que el backend nunca ejecutaba.

let app: FastifyInstance;
let prisma: PrismaClient;
let tADMIN = '';
let tid = '';
const CID = 'cnt_004';
const LIQ_VIEJA = 'ZZ-cazabug-dep-vieja';
const LIQ_NUEVA = 'ZZ-cazabug-dep-nueva';
const LIQ_FUTURA = 'ZZ-cazabug-dep-futura';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar() {
  const ids = [LIQ_VIEJA, LIQ_NUEVA, LIQ_FUTURA];
  await prisma.pago.deleteMany({ where: { liquidacionId: { in: ids } } });
  await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });

  // Y las liquidaciones que el DEVENGO le fue agregando a cnt_004, que este test no creó.
  //
  // El test afirma una cuenta exacta: "la deuda exigible es 40.000 + 30.000 = 70.000". Eso
  // sólo es cierto si el contrato no tiene nada más exigible, y en la base compartida sí
  // tiene: el devengo corre solo, en proceso, cada 6 horas (`CRON_DEVENGO`), así que
  // cualquier API apuntada a esta base le va agregando períodos a los contratos del seed.
  // Con dos de más, `depositoAplicadoADeuda` dio 100.000 (el depósito entero) en vez de
  // 70.000, y el rojo se lee como "se rompió el cálculo del depósito".
  //
  // ⚠️ SE EXCLUYE EL SEED (`liq_*`) A PROPÓSITO. Una versión anterior de esta limpieza
  // borraba TODA otra liquidación de cnt_004, y ahí adentro estaban `liq_004` y su pago
  // `pag_liq004`, que son del seed y que usan otros cinco archivos de test
  // (deposito-cap-disponible, operacion, pago-tipo-parcial, plata, rescindir-contrato).
  // `seedBase` los reponía por upsert en la corrida siguiente, así que el daño era
  // intermitente — que es la peor forma de romper algo. Y no hacía falta: `liq_004` está
  // PAGADO, o sea que no suma deuda exigible y nunca fue el problema.
  const otras = await prisma.liquidacion.findMany({
    where: { contratoId: CID, id: { notIn: ids }, NOT: { id: { startsWith: 'liq_' } } },
    select: { id: true },
  });
  if (otras.length) {
    const otrosIds = otras.map((l) => l.id);
    await prisma.pago.deleteMany({ where: { liquidacionId: { in: otrosIds } } });
    await prisma.alquilerRendido.deleteMany({ where: { liquidacionId: { in: otrosIds } } });
    await prisma.liquidacion.deleteMany({ where: { id: { in: otrosIds } } });
  }
}

const crearLiq = (id: string, periodo: string, venc: string, estado: 'VENCIDO' | 'PENDIENTE', monto: number) =>
  prisma.liquidacion.create({
    data: {
      id, inmobiliariaId: tid, contratoId: CID, periodo,
      montoAlquiler: monto, montoExpensas: null, montoTotal: monto,
      fechaVencimiento: new Date(venc), estado, moneda: 'ARS',
    },
  });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  await limpiar();
  // Contrato terminado con depósito RETENIDO de $100.000 y sin deducciones.
  await prisma.cargoContrato.deleteMany({ where: { contratoId: CID, contraDeposito: true } });
  await prisma.contrato.updateMany({
    where: { id: CID },
    data: {
      estado: 'FINALIZADO', estadoDeposito: 'RETENIDO', depositoGarantia: 100000,
      depositoDevueltoMonto: null, depositoDevueltoAt: null,
      // Sin mora, para que el test compare montos exactos y no dependa del día que corra.
      moraTipo: 'SIN_MORA', moraValor: null, tasaPunitorioDiaria: null,
    },
  });
  // Deuda exigible: $40.000 (vieja) + $30.000 (nueva) = $70.000. Más una futura que NO
  // debe tocarse: el ex-inquilino no ocupó ese mes.
  await crearLiq(LIQ_VIEJA, '2024-01', '2024-01-05', 'VENCIDO', 40000);
  await crearLiq(LIQ_NUEVA, '2024-02', '2024-02-05', 'VENCIDO', 30000);
  await crearLiq(LIQ_FUTURA, '2099-06', '2099-06-05', 'PENDIENTE', 50000);

  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tADMIN = login.json().token;
});

afterAll(async () => {
  await limpiar();
  await prisma.contrato.updateMany({
    where: { id: CID },
    data: { estado: 'ACTIVO', estadoDeposito: 'RETENIDO', depositoGarantia: null, depositoDevueltoMonto: null, depositoDevueltoAt: null },
  });
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('CAZABUG — retener el depósito CANCELA deuda de verdad', () => {
  it('EJECUTAR (retener todo) imputa los $100.000 contra la deuda exigible', async () => {
    const r = await app.inject({
      method: 'POST', url: `/contratos/${CID}/deposito/resolver`, headers: auth(tADMIN),
      payload: { decision: 'EJECUTAR', montoDevuelto: 0, motivo: 'Deuda impaga (cazabug)' },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    // Con el bug: aplicado 0 — no se creaba ningún pago.
    expect(body.depositoAplicadoADeuda).toBe(70000); // toda la deuda exigible
    expect(body.depositoSobrante).toBe(30000); // lo que sobró sigue siendo del inquilino
    expect(body.cuotasSaldadas).toBe(2);
  });

  it('las dos cuotas exigibles quedaron PAGADAS con un pago trazable', async () => {
    for (const id of [LIQ_VIEJA, LIQ_NUEVA]) {
      const l = await prisma.liquidacion.findUniqueOrThrow({ where: { id } });
      expect(l.estado, `${id} debía quedar PAGADO`).toBe('PAGADO');
      const pagos = await prisma.pago.findMany({ where: { liquidacionId: id, estado: 'CONCILIADO' } });
      expect(pagos.length).toBe(1);
      expect(pagos[0]!.condonado).toBe(false); // es plata real del inquilino, no una condonación
      expect(pagos[0]!.observacion ?? '').toMatch(/depósito/i);
    }
  });

  it('la cuota FUTURA no se toca: el ex-inquilino no ocupó ese mes', async () => {
    const futura = await prisma.liquidacion.findUniqueOrThrow({ where: { id: LIQ_FUTURA } });
    expect(futura.estado).toBe('PENDIENTE');
    expect(await prisma.pago.count({ where: { liquidacionId: LIQ_FUTURA } })).toBe(0);
  });
});
