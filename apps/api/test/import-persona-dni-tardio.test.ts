import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

/**
 * CAZABUG (review de fix/import-multi-alquiler, Important 1) — `buscarOCrearPersona`
 * (lib/persona.ts) hacía, en la rama de DNI, un `create()` que incluía el email SIN
 * chequear el unique de email (`@@unique([inmobiliariaId, email])`, además del de DNI).
 *
 * Escenario real migrando cartera: la fila 1 trae email SIN dni → crea
 * Persona{dni:null, email:E}. La fila 2 del MISMO inquilino trae email + DNI → el upsert
 * por dni no la encuentra (nadie tiene ese dni todavía) → intentaba create{dni, email:E} →
 * P2002 contra el unique de email, porque la fila 1 ya se lo había quedado. La fila se
 * perdía con el motivo genérico "Email o dato único ya existente" Y quedaba marcada como
 * procesada, así que el reintento no la recuperaba.
 *
 * Fix: antes de crear, si el DNI no matchea ninguna Persona pero el email SÍ está tomado
 * por otra, se reusa esa Persona y se le completa el DNI (si no lo tenía) en vez de
 * intentar un create() ciego.
 *
 * Este test fija el caso: dos filas, mismo email, la 1ra SIN DNI y la 2da CON DNI → las
 * DOS tienen que entrar, agrupadas bajo UNA sola Persona (con el DNI ya completado), sin
 * que la 2da reviente con P2002.
 */

let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;
const prisma = new PrismaClient();
const P = 'DniTardio ';
const EMAIL_MARTINA = 'martina.inquilina@mail.com';
const DNI_MARTINA = '31222333';

// Mismo inquilino (mismo email): la fila 1 no trae DNI, la fila 2 sí.
const FILAS = [
  [`${P}Local 100`, 'Martina', 'Diaz', EMAIL_MARTINA, '', '500000', '2026-01-01'],
  [`${P}Local 200`, 'Martina', 'Diaz', EMAIL_MARTINA, DNI_MARTINA, '600000', '2026-01-01'],
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
    where: { inmobiliariaId, direccion: { startsWith: P } },
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
  await prisma.persona.deleteMany({ where: { inmobiliariaId, email: EMAIL_MARTINA } });
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

describe('Importación de cartera: el DNI llega en una fila posterior a la del email', () => {
  let impId = '';

  it('el preview no rechaza ninguna de las dos filas', async () => {
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

    expect(filas[0]?.estado).not.toBe('ERROR');
    expect(filas[0]?.estado).not.toBe('DUPLICADO');
    expect(filas[1]?.estado).not.toBe('ERROR');
    expect(filas[1]?.estado).not.toBe('DUPLICADO');
  });

  it('confirmar crea LOS DOS contratos sin P2002 y los agrupa bajo UNA Persona con el DNI completado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/importaciones-cartera/${impId}/confirmar`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    // EL BUG: la 2da fila reventaba con P2002 ("Email o dato único ya existente") y quedaba
    // marcada como procesada sin haberse creado.
    expect(res.json().errores).toEqual([]);
    expect(res.json().creadas).toBe(2);

    const props = await prisma.propiedad.findMany({
      where: { inmobiliariaId, direccion: { startsWith: P } },
    });
    expect(props).toHaveLength(2);

    const contratos = await prisma.contrato.findMany({ where: { propiedadId: { in: props.map((p) => p.id) } } });
    expect(contratos).toHaveLength(2);

    // El punto central del fix: UNA sola Persona para el email, con el DNI que trajo la 2da
    // fila (no dos Personas — una huérfana sin DNI y otra que nunca llegó a crearse por el
    // P2002).
    const personas = await prisma.persona.findMany({ where: { inmobiliariaId, email: EMAIL_MARTINA } });
    expect(personas).toHaveLength(1);
    expect(personas[0]?.dni).toBe(DNI_MARTINA);

    const inquilinos = await prisma.inquilino.findMany({ where: { contratoId: { in: contratos.map((c) => c.id) } } });
    expect(inquilinos).toHaveLength(2);
    expect(inquilinos.every((i) => i.personaId === personas[0]!.id)).toBe(true);
  });
});
