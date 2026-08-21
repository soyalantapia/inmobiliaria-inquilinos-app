/**
 * T-63-N1 · `POST /reclamos/:id/reabrir` — que un typo del profesional se pueda corregir.
 *
 * EL PROBLEMA. El profesional cierra el reclamo por link mágico declarando `montoCobrado`
 * (`POST /visitas-publicas/listo`), y eso se imputa como plata real: cargo al inquilino, gasto
 * al propietario o descuento del depósito. Si tipeó mal, no había forma de arreglarlo — con el
 * reclamo ya cerrado `/clasificar` y `/resolver` devuelven 409, y el único camino de reapertura
 * era que el INQUILINO marcara "PERSISTE", que es otro flujo (el problema sigue), no una
 * corrección. El typo quedaba como asiento permanente.
 *
 * Es la mitad de T-63 que NO depende de la decisión pendiente sobre quién puede declarar cuánto:
 * decida lo que se decida, un error tiene que poder corregirse.
 *
 * LO QUE ESTOS TESTS FIJAN. Que reabrir habilite la corrección de punta a punta, que sea una
 * acción con permiso y con rastro, y —lo más importante— que **no saltee los cortes de plata**:
 * si el costo ya se le rindió al propietario o el inquilino ya lo pagó, reabrir no alcanza para
 * pisarlo.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let tokenAdmin: string;
const prismaTest = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const PREFIJO = 'QA reabrir';
let contrato: { id: string; inmobiliariaId: string; propiedadId: string };

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const c = await prismaTest.contrato.findFirstOrThrow({
    where: { id: 'cnt_001' },
    select: { id: true, inmobiliariaId: true, propiedadId: true },
  });
  contrato = c;
});

beforeEach(limpiarResiduo);
afterAll(async () => {
  await limpiarResiduo();
  await app.close();
  await prismaTest.$disconnect();
});

/** Limpia ANTES de cada caso: un test en rojo no llega a su limpieza y envenena a los que siguen. */
async function limpiarResiduo(): Promise<void> {
  const reclamos = await prismaTest.reclamo.findMany({
    where: { descripcion: { startsWith: PREFIJO } },
    select: { id: true },
  });
  const ids = reclamos.map((r) => r.id);
  if (ids.length) {
    await prismaTest.reclamoEvento.deleteMany({ where: { reclamoId: { in: ids } } });
    await prismaTest.cargoContrato.deleteMany({ where: { reclamoId: { in: ids } } });
    await prismaTest.reclamo.deleteMany({ where: { id: { in: ids } } });
  }
}

/** Un reclamo ya resuelto con costo imputado, que es el estado del que hay que poder salir. */
async function reclamoResuelto(costo: number, pagador: 'PROPIETARIO' | 'INQUILINO' = 'INQUILINO') {
  const r = await prismaTest.reclamo.create({
    data: {
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      propiedadId: contrato.propiedadId,
      categoria: 'PLOMERIA',
      urgencia: 'MEDIA',
      descripcion: `${PREFIJO} — canilla`,
      estado: 'EN_CURSO',
    },
  });
  const res = await app.inject({
    method: 'POST',
    url: `/reclamos/${r.id}/resolver`,
    headers: auth(tokenAdmin),
    payload: { resolucion: 'Se cambió la canilla', costoTrabajo: costo, pagador },
  });
  expect(res.statusCode).toBe(200);
  return r;
}

describe('T-63-N1 · reabrir un reclamo cerrado', () => {
  it('sin reabrir, corregir el monto es imposible: 409', async () => {
    // EL BUG. Es el estado en el que queda un reclamo cerrado por el profesional con un monto
    // mal tipeado: el operador no tiene ninguna puerta.
    const r = await reclamoResuelto(180000);
    const res = await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/resolver`,
      headers: auth(tokenAdmin),
      payload: { resolucion: 'Corrijo el monto', costoTrabajo: 18000, pagador: 'INQUILINO' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('reabrir → corregir el monto → vuelve a cerrar, y el cargo queda por el monto bueno', async () => {
    // El camino completo, que es el criterio de aceptación: un cero de más se puede arreglar.
    const r = await reclamoResuelto(180000);
    const cargoAntes = await prismaTest.cargoContrato.findFirstOrThrow({ where: { reclamoId: r.id } });
    expect(Number(cargoAntes.monto)).toBe(180000);

    const reabrir = await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/reabrir`,
      headers: auth(tokenAdmin),
      payload: { motivo: 'El profesional cargó un cero de más' },
    });
    expect(reabrir.statusCode).toBe(200);
    expect(reabrir.json().estado).toBe('EN_CURSO');

    const corregir = await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/resolver`,
      headers: auth(tokenAdmin),
      payload: { resolucion: 'Monto corregido', costoTrabajo: 18000, pagador: 'INQUILINO' },
    });
    expect(corregir.statusCode).toBe(200);

    // UN solo cargo, por el monto corregido. Si alguna vez se "arregla" creando otro en vez de
    // pisar el que había, esto lo agarra: serían dos cobros por un mismo arreglo.
    const cargos = await prismaTest.cargoContrato.findMany({ where: { reclamoId: r.id } });
    expect(cargos).toHaveLength(1);
    expect(Number(cargos[0]!.monto)).toBe(18000);
  });

  it('reabrir NO borra resueltoAt, porque el SLA lo usa de ancla', async () => {
    // Sutil y caro: `evaluarSla` detecta "reabierto" por estado activo + resueltoAt no nulo, y
    // reinicia el reloj desde ahí. Si se limpiara, un reclamo viejo reaparecería como VENCIDO
    // apenas se reabre y le mentiría a la bandeja del día.
    const r = await reclamoResuelto(5000);
    await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/reabrir`,
      headers: auth(tokenAdmin),
      payload: { motivo: 'Reviso el importe con el plomero' },
    });
    const despues = await prismaTest.reclamo.findUniqueOrThrow({ where: { id: r.id } });
    expect(despues.estado).toBe('EN_CURSO');
    expect(despues.resueltoAt).not.toBeNull();
  });

  it('deja rastro de quién lo reabrió y por qué', async () => {
    const r = await reclamoResuelto(5000);
    await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/reabrir`,
      headers: auth(tokenAdmin),
      payload: { motivo: 'Monto mal declarado por el profesional' },
    });
    const eventos = await prismaTest.reclamoEvento.findMany({ where: { reclamoId: r.id, tipo: 'EN_CURSO' } });
    const reapertura = eventos.find((e) => e.contenido?.includes('Reabierto para corregir'));
    expect(reapertura, 'no quedó el evento de reapertura').toBeTruthy();
    expect(reapertura!.contenido).toContain('Monto mal declarado');
    expect(reapertura!.autor).toBeTruthy();
  });

  it('reabrir uno que NO está cerrado da 409, no lo pisa', async () => {
    const r = await prismaTest.reclamo.create({
      data: {
        inmobiliariaId: contrato.inmobiliariaId,
        contratoId: contrato.id,
        propiedadId: contrato.propiedadId,
          categoria: 'PLOMERIA',
        urgencia: 'MEDIA',
        descripcion: `${PREFIJO} — abierto`,
        estado: 'EN_CURSO',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/reabrir`,
      headers: auth(tokenAdmin),
      payload: { motivo: 'No debería poder' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('exige motivo: no se reabre un cierre sin decir por qué', async () => {
    const r = await reclamoResuelto(5000);
    const res = await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/reabrir`,
      headers: auth(tokenAdmin),
      payload: { motivo: 'x' },
    });
    expect(res.statusCode).toBe(400);
    // Y no lo movió.
    const despues = await prismaTest.reclamo.findUniqueOrThrow({ where: { id: r.id } });
    expect(despues.estado).toBe('RESUELTO');
  });

  it('NO saltea el corte de plata: si el inquilino ya pagó, corregir sigue frenando', async () => {
    // EL BORDE QUE IMPORTA. Reabrir habilita la puerta, no la caja fuerte: el helper de
    // imputación sigue siendo el único que decide, y frena si esa plata ya se movió. Sin esto,
    // reabrir sería una forma elegante de pisar un cobro ya hecho.
    const r = await reclamoResuelto(180000);
    const cargo = await prismaTest.cargoContrato.findFirstOrThrow({ where: { reclamoId: r.id } });
    await prismaTest.cargoContrato.update({ where: { id: cargo.id }, data: { saldadoAt: new Date() } });

    await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/reabrir`,
      headers: auth(tokenAdmin),
      payload: { motivo: 'Intento corregir algo ya cobrado' },
    });
    const corregir = await app.inject({
      method: 'POST',
      url: `/reclamos/${r.id}/resolver`,
      headers: auth(tokenAdmin),
      payload: { resolucion: 'Bajo el monto', costoTrabajo: 1000, pagador: 'INQUILINO' },
    });
    expect(corregir.statusCode).toBe(409);
    // Y el cargo cobrado quedó intacto.
    const despues = await prismaTest.cargoContrato.findUniqueOrThrow({ where: { id: cargo.id } });
    expect(Number(despues.monto)).toBe(180000);
    expect(despues.saldadoAt).not.toBeNull();
  });
});
