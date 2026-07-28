import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { archivoSigueEnUso } from '../src/routes/uploads.js';
import { seedBase } from '../prisma/seed.js';

// CAZABUG P1 — antes de borrar un archivo del Volume se chequea "¿sigue en uso?", pero ese
// chequeo lo escribía a mano CADA call site y ninguno estaba completo: los siete miraban
// entre 1 y 3 tablas de las 16 columnas de URL que existen. Un archivo referenciado por la
// foto de un reclamo, el PDF de un contrato, el comprobante de un movimiento de caja o el
// extracto de un resumen bancario daba "no está en uso" y se BORRABA DEL DISCO, dejando esa
// fila con una URL rota y a la inmobiliaria sin el respaldo. Irreversible.

let prisma: PrismaClient;
let tid = '';
const URL_RECLAMO = '/uploads/ZZ-cazabug/foto-reclamo.jpg';
const URL_CAJA = '/uploads/ZZ-cazabug/comprobante-caja.pdf';
const URL_LIBRE = '/uploads/ZZ-cazabug/nadie-me-referencia.jpg';
let reclamoId = '';
let movId = '';

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const inmo = await prisma.inmobiliaria.findFirstOrThrow({ where: { nombre: 'Inmobiliaria del Sol' } });
  tid = inmo.id;
  // Dos tablas que NINGÚN call site chequeaba.
  const rec = await prisma.reclamo.create({
    data: {
      inmobiliariaId: tid, contratoId: 'cnt_001', propiedadId: 'prp_001',
      categoria: 'PLOMERIA', urgencia: 'MEDIA', descripcion: 'Reclamo con foto (cazabug huérfanos)',
      fotoUrl: URL_RECLAMO,
    },
  });
  reclamoId = rec.id;
  const mov = await prisma.movimientoCaja.create({
    data: {
      inmobiliariaId: tid, propiedadId: 'prp_001', tipo: 'GASTO', categoria: 'OTRO', monto: 1000,
      descripcion: 'Gasto con comprobante (cazabug huérfanos)', fecha: new Date(),
      cargadoPor: 'test', comprobanteUrl: URL_CAJA,
    },
  });
  movId = mov.id;
});

afterAll(async () => {
  if (reclamoId) await prisma.reclamo.deleteMany({ where: { id: reclamoId } });
  if (movId) await prisma.movimientoCaja.deleteMany({ where: { id: movId } });
  await prisma.$disconnect();
});

describe('CAZABUG — el chequeo de archivo huérfano mira TODAS las tablas', () => {
  it('detecta un archivo usado como foto de un RECLAMO (tabla que nadie chequeaba)', async () => {
    // Con el bug: los callers sólo miraban inquilino/documento/pago → false → lo borraban.
    await expect(archivoSigueEnUso(URL_RECLAMO)).resolves.toBe(true);
  });

  it('detecta un archivo usado como comprobante de CAJA (idem)', async () => {
    await expect(archivoSigueEnUso(URL_CAJA)).resolves.toBe(true);
  });

  it('un archivo que nadie referencia SÍ da libre (no rompimos el borrado real)', async () => {
    await expect(archivoSigueEnUso(URL_LIBRE)).resolves.toBe(false);
  });

  it('una url vacía se considera en uso (ante la duda, no borrar)', async () => {
    await expect(archivoSigueEnUso('')).resolves.toBe(true);
  });

  it('deja de estar en uso cuando se borra la fila que lo referenciaba', async () => {
    await prisma.reclamo.delete({ where: { id: reclamoId } });
    reclamoId = '';
    await expect(archivoSigueEnUso(URL_RECLAMO)).resolves.toBe(false);
  });
});
