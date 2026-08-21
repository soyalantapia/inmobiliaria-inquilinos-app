import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

/**
 * CAZABUG — la importación por CSV rechazaba como DUPLICADO cualquier email repetido, tanto
 * contra la cartera existente como entre filas del MISMO archivo. Eso era el espejo
 * aplicativo de un unique que YA SE SACÓ de la tabla `inquilinos` (migración
 * 20260723120000_multi_alquiler_email_persona): el alta manual soporta hace rato que un
 * mismo inquilino tenga varios alquileres (3 locales en La Rioja, 10 deptos de un
 * consorcio) — pero la importación masiva, que es EXACTAMENTE el momento en que una
 * inmobiliaria migra su cartera completa, seguía cortando el 2º alquiler del mismo
 * inquilino.
 *
 * Fix: el email repetido pasa de DUPLICADO a ADVERTENCIA informativa (en los dos puntos:
 * contra la cartera existente y dentro del archivo), y la creación de cada fila usa el
 * mismo find-or-create de Persona que el alta manual (lib/persona.ts) para agruparlas bajo
 * UNA sola identidad — si no, la 2da fila reventaría con P2002 a mitad de la importación.
 *
 * Este test fija el caso real: dos filas, mismo inquilino (mismo email Y mismo DNI), dos
 * propiedades distintas → tienen que terminar como DOS contratos y UNA sola Persona.
 */

let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;
const prisma = new PrismaClient();
const P = 'multialq_';
const DNI_CAMILA = '30999888';
const EMAIL_CAMILA = 'camila.inquilina@mail.com';

// Mismo inquilino (mismo email y DNI), dos locales distintos.
const FILAS = [
  ['MultiAlq Local 100', 'Camila', 'Ruiz', EMAIL_CAMILA, DNI_CAMILA, '500000', '2026-01-01'],
  ['MultiAlq Local 200', 'Camila', 'Ruiz', EMAIL_CAMILA, DNI_CAMILA, '600000', '2026-01-01'],
];
const MAPEO = {
  direccion: 0,
  inquilinoNombre: 1,
  inquilinoApellido: 2,
  inquilinoEmail: 3,
  inquilinoDni: 4,
  monto: 5,
  fechaInicio: 6,
};

async function limpiar() {
  const props = await prisma.propiedad.findMany({
    where: { inmobiliariaId, direccion: { startsWith: 'MultiAlq ' } },
    select: { id: true },
  });
  const ids = props.map((p) => p.id);
  if (ids.length > 0) {
    const cnts = await prisma.contrato.findMany({ where: { propiedadId: { in: ids } }, select: { id: true } });
    const cIds = cnts.map((c) => c.id);
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: cIds } } });
    await prisma.inquilino.deleteMany({ where: { contratoId: { in: cIds } } });
    await prisma.propiedad.updateMany({ where: { id: { in: ids } }, data: { contratoActualId: null } });
    // El historial va ANTES que el contrato: su FK es RESTRICT y desde que el alta escribe
    // un evento CREADO (T-29), todo contrato creado por la API tiene al menos una fila acá.
    // Se filtra por la relación para no repetir —ni desincronizar— el where de abajo.
    await prisma.eventoContrato.deleteMany({ where: { contrato: { id: { in: cIds } } } });
    await prisma.contrato.deleteMany({ where: { id: { in: cIds } } });
    await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { in: ids } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.importacionCartera.deleteMany({ where: { nombreArchivo: `${P}cartera.csv` } });
  await prisma.persona.deleteMany({ where: { inmobiliariaId, dni: DNI_CAMILA } });
  await prisma.propietario.deleteMany({
    where: { inmobiliariaId, nombre: 'Propietario a definir', participaciones: { none: {} } },
  });
}

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('Importación de cartera: multi-alquiler (mismo inquilino, varias propiedades)', () => {
  let impId = '';

  it('el preview de mapeo NO marca DUPLICADO la 2da fila del mismo inquilino (email repetido)', async () => {
    const imp = await prisma.importacionCartera.create({
      data: {
        inmobiliariaId,
        archivoUrl: '',
        nombreArchivo: `${P}cartera.csv`,
        columnas: ['direccion', 'nombre', 'apellido', 'email', 'dni', 'monto', 'inicio'],
        filas: FILAS,
        mapeoColumnas: MAPEO,
        totalFilas: FILAS.length,
        estado: 'SUBIDO',
        creadoPor: 'test',
      },
    });
    impId = imp.id;

    const r = await app.inject({
      method: 'PUT',
      url: `/importaciones-cartera/${impId}/mapeo`,
      headers: auth(),
      payload: { mapeo: MAPEO },
    });
    expect(r.statusCode).toBe(200);
    const filas = r.json().filas as { fila: number; estado: string; motivo: string | null }[];

    expect(filas[0]?.estado).toBe('OK');
    // EL BUG: esta fila daba DUPLICADO (email repetido) y quedaba afuera de la importación
    // justo cuando el inquilino necesita cargar su 2º alquiler.
    expect(filas[1]?.estado).not.toBe('DUPLICADO');
    expect(filas[1]?.estado).toBe('ADVERTENCIA');
    expect(filas[1]?.motivo ?? '').toMatch(/mismo inquilino/i);
  });

  it('confirmar crea LOS DOS contratos y los agrupa bajo UNA sola Persona', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/importaciones-cartera/${impId}/confirmar`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().errores).toEqual([]);
    expect(res.json().creadas).toBe(2);

    const props = await prisma.propiedad.findMany({
      where: { inmobiliariaId, direccion: { startsWith: 'MultiAlq ' } },
    });
    expect(props).toHaveLength(2);

    const contratos = await prisma.contrato.findMany({ where: { propiedadId: { in: props.map((p) => p.id) } } });
    expect(contratos).toHaveLength(2);

    // El punto central del fix: NO dos Personas huérfanas, sino UNA sola agrupando los dos
    // alquileres del mismo inquilino (lib/persona.ts, compartido con el alta manual).
    const personas = await prisma.persona.findMany({ where: { inmobiliariaId, dni: DNI_CAMILA } });
    expect(personas).toHaveLength(1);

    const inquilinos = await prisma.inquilino.findMany({ where: { contratoId: { in: contratos.map((c) => c.id) } } });
    expect(inquilinos).toHaveLength(2);
    expect(inquilinos.every((i) => i.personaId === personas[0]!.id)).toBe(true);
  });
});
