import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { imputarCostoReclamo, ReclamoYaRendido } from '../src/lib/imputar-reclamo.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P1 — imputarCostoReclamo es el choke point de los DOS caminos que cierran un
// reclamo: el panel (/reclamos/:id/resolver) y el profesional por link mágico
// (/visitas-publicas/listo). /resolver tenía un guard anti-doble-cobro inline; /listo NO.
// Si el costo YA se le descontó al propietario en una rendición (GastoRendido TRABAJO) y
// se reclasifica el pagador a INQUILINO/DEPOSITO, /listo creaba un CargoContrato =
// cobrar el mismo arreglo DOS VECES (dos libros sin dedup). Fix: el guard vive en el
// helper (atómico, dentro de la tx) → ambos caminos cortan con ReclamoYaRendido → 409.

let prisma: PrismaClient;
let tid = '';
let reclamoId = '';
let rendicionId = '';

async function limpiar() {
  if (reclamoId) {
    await prisma.gastoRendido.deleteMany({ where: { refId: `reclamo:${reclamoId}` } });
    await prisma.cargoContrato.deleteMany({ where: { reclamoId } });
  }
  if (rendicionId) await prisma.rendicion.deleteMany({ where: { id: rendicionId } });
  if (reclamoId) await prisma.reclamo.deleteMany({ where: { id: reclamoId } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Reparación (cazabug doble-cobro)',
      estado: 'RESUELTO', pagador: 'INQUILINO', costoTrabajo: 1000,
    },
  });
  reclamoId = rec.id;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

const imputarInquilino = () =>
  prisma.$transaction((tx) =>
    imputarCostoReclamo(tx, {
      inmobiliariaId: tid, reclamoId, contratoId: 'cnt_001',
      pagador: 'INQUILINO', costo: 1000, moneda: 'ARS', concepto: 'Reparación', creadoPorId: null,
    }),
  );

describe('CAZABUG — imputar reclamo ya rendido al propietario corta el doble-cobro', () => {
  it('SIN rendición previa: imputa el cargo al inquilino (no corta)', async () => {
    await expect(imputarInquilino()).resolves.toBeUndefined();
    const cargo = await prisma.cargoContrato.findFirst({ where: { reclamoId } });
    expect(cargo).not.toBeNull();
    expect(Number(cargo!.monto)).toBe(1000);
    // limpiamos el cargo para el próximo caso
    await prisma.cargoContrato.deleteMany({ where: { reclamoId } });
  });

  it('CON el trabajo ya descontado al propietario (GastoRendido TRABAJO): lanza ReclamoYaRendido y NO crea cargo', async () => {
    const rend = await prisma.rendicion.create({
      data: {
        inmobiliariaId: tid, propietarioId: 'own_001', periodo: '2099-04',
        montoBruto: 1000, comisionPct: 0, comisionMonto: 0, montoNeto: 1000, metodo: 'TRANSFERENCIA',
      },
    });
    rendicionId = rend.id;
    await prisma.gastoRendido.create({
      data: {
        inmobiliariaId: tid, rendicionId: rend.id, refId: `reclamo:${reclamoId}`, tipo: 'TRABAJO',
        fecha: new Date('2099-04-15'), descripcion: 'Reparación descontada al dueño',
        monto: 1000, montoTotal: 1000, participacion: 100, propiedadId: 'prp_001', direccion: '—',
      },
    });

    await expect(imputarInquilino()).rejects.toBeInstanceOf(ReclamoYaRendido);
    const cargo = await prisma.cargoContrato.findFirst({ where: { reclamoId } });
    expect(cargo).toBeNull(); // con el bug: se creaba el cargo = doble-cobro
  });
});
