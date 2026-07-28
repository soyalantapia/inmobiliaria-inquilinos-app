import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  imputarCostoReclamo,
  ReclamoYaCobradoAlInquilino,
  ReclamoNoReimputable,
} from '../src/lib/imputar-reclamo.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Hermano del guard "ya rendido al propietario", por el otro lado del mostrador: el
 * INQUILINO ya pagó el cargo del reclamo.
 *
 * Ese cobro vive SOLO en `CargoContrato.saldadoAt` — no genera Pago ni movimiento de
 * caja — así que nada lo revierte ni lo acredita si el costo se reimputa. Al reabrir un
 * reclamo (el inquilino elige PERSISTE) y volver a cerrarlo, se podía:
 *   · pasarlo a PROPIETARIO  → el cargo cobrado sobrevive pero la rendición igual le
 *     descuenta el arreglo al dueño: se cobra dos veces.
 *   · pasarlo a DEPOSITO     → el upsert muta la MISMA fila ya cobrada poniéndole
 *     contraDeposito, y al egreso se le descuenta del depósito lo que ya pagó en efectivo.
 *   · dejarlo en INQUILINO con OTRO importe → el update pisa `monto` y el libro pasa a
 *     decir que se cobró una cifra distinta de la que de verdad se cobró.
 *
 * Lo que NO tiene que romper: reejecutar el cierre con exactamente los mismos datos
 * (el helper se llama en cada cierre y tiene que seguir siendo idempotente).
 */

let prisma: PrismaClient;
let tid = '';
let reclamoId = '';

async function limpiar() {
  if (reclamoId) {
    await prisma.cargoContrato.deleteMany({ where: { reclamoId } });
    await prisma.reclamo.deleteMany({ where: { id: reclamoId } });
  }
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Reparación (reimputar ya cobrado)',
      estado: 'RESUELTO', pagador: 'INQUILINO', costoTrabajo: 50_000,
    },
  });
  reclamoId = rec.id;
}, 420_000);

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

/** Deja el escenario base: cargo de 50.000 al inquilino, YA COBRADO. */
beforeEach(async () => {
  await prisma.cargoContrato.deleteMany({ where: { reclamoId } });
  await prisma.cargoContrato.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', reclamoId,
      tipo: 'REPARACION', concepto: 'Reparación', monto: 50_000, moneda: 'ARS',
      contraDeposito: false, saldadoAt: new Date('2026-07-01T12:00:00.000Z'),
    },
  });
});

const imputar = (pagador: 'INQUILINO' | 'DEPOSITO' | 'PROPIETARIO' | null, costo = 50_000) =>
  prisma.$transaction((tx) =>
    imputarCostoReclamo(tx, {
      inmobiliariaId: tid, reclamoId, contratoId: 'cnt_001',
      pagador, costo, moneda: 'ARS', concepto: 'Reparación', creadoPorId: null,
    }),
  );

describe('Reimputar un reclamo que el inquilino YA PAGÓ', () => {
  it('a PROPIETARIO → corta (si no, la rendición se lo cobra al dueño además de al inquilino)', async () => {
    await expect(imputar('PROPIETARIO')).rejects.toBeInstanceOf(ReclamoYaCobradoAlInquilino);
    const cargo = await prisma.cargoContrato.findFirstOrThrow({ where: { reclamoId } });
    expect(cargo.saldadoAt).not.toBeNull(); // la evidencia del cobro queda intacta
  });

  it('a DEPOSITO → corta (si no, se le descuenta del depósito lo que ya pagó en efectivo)', async () => {
    await expect(imputar('DEPOSITO')).rejects.toBeInstanceOf(ReclamoYaCobradoAlInquilino);
    const cargo = await prisma.cargoContrato.findFirstOrThrow({ where: { reclamoId } });
    // EL BUG: el upsert mutaba esta misma fila y `deduccionesDeposito` la empezaba a sumar.
    expect(cargo.contraDeposito).toBe(false);
  });

  it('mismo pagador con OTRO importe → corta (si no, el libro miente sobre cuánto se cobró)', async () => {
    await expect(imputar('INQUILINO', 30_000)).rejects.toBeInstanceOf(ReclamoYaCobradoAlInquilino);
    const cargo = await prisma.cargoContrato.findFirstOrThrow({ where: { reclamoId } });
    expect(Number(cargo.monto)).toBe(50_000); // sigue diciendo lo que REALMENTE se cobró
  });

  it('sin pagador (se borra el costo) → corta: la plata cobrada no se puede evaporar', async () => {
    await expect(imputar(null, 0)).rejects.toBeInstanceOf(ReclamoNoReimputable);
    expect(await prisma.cargoContrato.count({ where: { reclamoId } })).toBe(1);
  });

  it('re-cierre IDÉNTICO → no corta y no toca nada (el helper sigue siendo idempotente)', async () => {
    await expect(imputar('INQUILINO', 50_000)).resolves.toBeUndefined();
    const cargo = await prisma.cargoContrato.findFirstOrThrow({ where: { reclamoId } });
    expect(Number(cargo.monto)).toBe(50_000);
    expect(cargo.saldadoAt).not.toBeNull();
  });

  it('si el cargo NO está cobrado, reimputar sigue funcionando normal', async () => {
    await prisma.cargoContrato.updateMany({ where: { reclamoId }, data: { saldadoAt: null } });
    await expect(imputar('DEPOSITO')).resolves.toBeUndefined();
    const cargo = await prisma.cargoContrato.findFirstOrThrow({ where: { reclamoId } });
    expect(cargo.contraDeposito).toBe(true);
  });
});
