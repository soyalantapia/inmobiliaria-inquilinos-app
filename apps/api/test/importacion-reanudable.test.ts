import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * La importación de cartera crea N contratos —cada uno en su propia transacción— dentro de
 * UNA sola request HTTP. Si el proceso muere a mitad (redeploy, timeout del proxy, el
 * navegador), quedan K contratos creados y la importación sigue en MAPEADO.
 *
 * El bug: al reintentar, la ÚNICA deduplicación era el email del inquilino. Las filas SIN
 * email se volvían a crear enteras — propiedad + inquilino + contrato + liquidaciones
 * duplicados en la cartera REAL del cliente, que es el peor momento para duplicar datos.
 *
 * Estos tests fijan que el reintento sea idempotente: continúa donde quedó y no duplica.
 */

let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;
const prisma = new PrismaClient();
const P = 'imp_'; // prefijo de fixtures

// Dos filas SIN email: son justamente las que la dedup por email no protegía.
const FILAS = [
  ['Reanudable 100', 'Sin Email Uno', '500000', '2026-01-01'],
  ['Reanudable 200', 'Sin Email Dos', '600000', '2026-01-01'],
];
const MAPEO = { direccion: 0, inquilinoNombre: 1, monto: 2, fechaInicio: 3 };

async function limpiar() {
  const props = await prisma.propiedad.findMany({
    where: { inmobiliariaId, direccion: { startsWith: 'Reanudable ' } },
    select: { id: true },
  });
  const ids = props.map((p) => p.id);
  if (ids.length > 0) {
    const cnts = await prisma.contrato.findMany({ where: { propiedadId: { in: ids } }, select: { id: true } });
    const cIds = cnts.map((c) => c.id);
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: cIds } } });
    await prisma.inquilino.deleteMany({ where: { contratoId: { in: cIds } } });
    await prisma.propiedad.updateMany({ where: { id: { in: ids } }, data: { contratoActualId: null } });
    await prisma.contrato.deleteMany({ where: { id: { in: cIds } } });
    await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { in: ids } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.importacionCartera.deleteMany({ where: { nombreArchivo: `${P}cartera.csv` } });
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

async function crearImportacion(estadoResultado: unknown = null): Promise<string> {
  const imp = await prisma.importacionCartera.create({
    data: {
      inmobiliariaId,
      archivoUrl: '',
      nombreArchivo: `${P}cartera.csv`,
      columnas: ['direccion', 'inquilino', 'monto', 'inicio'],
      filas: FILAS,
      mapeoColumnas: MAPEO,
      totalFilas: FILAS.length,
      estado: 'MAPEADO',
      creadoPor: 'test',
      ...(estadoResultado ? { resultado: estadoResultado as object } : {}),
    },
  });
  return imp.id;
}

const contarPropiedades = () =>
  prisma.propiedad.count({ where: { inmobiliariaId, direccion: { startsWith: 'Reanudable ' } } });

describe('Importación de cartera: el reintento no duplica', () => {
  it('una importación completa crea una propiedad por fila', async () => {
    const id = await crearImportacion();
    const res = await app.inject({ method: 'POST', url: `/importaciones-cartera/${id}/confirmar`, headers: auth(), payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json().creadas).toBe(2);
    expect(await contarPropiedades()).toBe(2);
  });

  it('reanudar una importación cortada NO vuelve a crear lo ya procesado', async () => {
    await limpiar();
    // Simula el corte: la fila 0 ya se creó y quedó anotada; el proceso murió antes de la 1.
    const id = await crearImportacion({ creadas: 1, errores: [], procesadas: [0] });
    const res = await app.inject({ method: 'POST', url: `/importaciones-cartera/${id}/confirmar`, headers: auth(), payload: {} });
    expect(res.statusCode).toBe(200);
    // Sólo crea la fila 1; el acumulado refleja las dos.
    expect(res.json().creadas).toBe(2);
    // EL BUG: sin el registro de filas procesadas, la fila 0 (SIN email, así que la dedup
    // por email no la frenaba) se creaba de nuevo → 3 propiedades para una cartera de 2.
    expect(await contarPropiedades()).toBe(1);
  });

  it('la importación queda CONFIRMADO y con las filas procesadas anotadas', async () => {
    const imp = await prisma.importacionCartera.findFirst({
      where: { nombreArchivo: `${P}cartera.csv` },
      orderBy: { createdAt: 'desc' },
    });
    expect(imp?.estado).toBe('CONFIRMADO');
    const r = imp?.resultado as { procesadas?: number[] } | null;
    expect(r?.procesadas).toEqual([0, 1]);
  });
});
