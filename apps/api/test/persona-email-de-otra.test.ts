import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * Mismo email, DNI DISTINTO: los dos call sites de `buscarOCrearPersona` (lib/persona.ts)
 * tienen que resolverlo AL REVÉS, y eso no lo fijaba ningún test de la importación.
 *
 * El alta manual corta con 409 (lo cubre multi-alquiler.test.ts): reusar la Persona ajena
 * dejaría el contrato de otra persona colgando de ella y, como el email ES la identidad de
 * login, el dueño del email entraría a ver un contrato que no es suyo. El operador está
 * mirando la pantalla y puede corregir el email en el acto.
 *
 * La importación de cartera NO corta: cortar marca la fila como procesada y la deja sin
 * reintento en el medio de una planilla de 2000 filas, así que reusa la Persona (el preview
 * ya lo avisa como "DNI distinto") y el operador reconcilia después.
 *
 * Sin este test, "unificar" el comportamiento de los dos call sites —que es lo que parece
 * más prolijo mirando lib/persona.ts sola— rompe una cartera real a mitad de camino y la
 * suite queda verde.
 */

let app: FastifyInstance;
let token: string;
let inmobiliariaId: string;
const prisma = new PrismaClient();
const P = 'EmailDeOtra ';
const EMAIL = 'compartido.email@mail.com';
const DNI_PRIMERO = '32444555';
const DNI_SEGUNDO = '32666777';

// Dos personas DISTINTAS (DNI distinto) peleando por el mismo email de login.
const FILAS = [
  [`${P}Local 100`, 'Primera', 'Persona', EMAIL, DNI_PRIMERO, '500000', '2026-01-01'],
  [`${P}Local 200`, 'Segunda', 'Persona', EMAIL, DNI_SEGUNDO, '600000', '2026-01-01'],
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

// La DB de test es compartida entre archivos: lo que este test crea se borra al terminar.
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
    await prisma.contrato.deleteMany({ where: { id: { in: cIds } } });
    await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { in: ids } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.importacionCartera.deleteMany({ where: { nombreArchivo: `${P}cartera.csv` } });
  await prisma.persona.deleteMany({ where: { inmobiliariaId, email: EMAIL } });
  await prisma.propietario.deleteMany({
    where: { inmobiliariaId, nombre: 'Propietario a definir', participaciones: { none: {} } },
  });
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

describe('mismo email con DNI distinto: la importación sigue, el alta manual corta', () => {
  it('la importación crea LAS DOS filas y no aborta la cartera', async () => {
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

    // El confirmar exige la importación ya mapeada (si no, 400).
    const mapeo = await app.inject({
      method: 'PUT',
      url: `/importaciones-cartera/${imp.id}/mapeo`,
      headers: auth(),
      payload: { mapeo: MAPEO },
    });
    expect(mapeo.statusCode, mapeo.body).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: `/importaciones-cartera/${imp.id}/confirmar`,
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().errores).toEqual([]);
    expect(res.json().creadas).toBe(2);

    // Quedan agrupadas bajo la Persona que llegó primero, con SU DNI intacto: el segundo no
    // lo pisa (son datos sin confirmar; los reconcilia el operador).
    const personas = await prisma.persona.findMany({ where: { inmobiliariaId, email: EMAIL } });
    expect(personas).toHaveLength(1);
    expect(personas[0]?.dni).toBe(DNI_PRIMERO);
  });

  it('el alta manual con ese mismo email y otro DNI → 409, y no deja el contrato colgando', async () => {
    const propRes = await app.inject({
      method: 'POST',
      url: '/propiedades',
      headers: auth(),
      payload: {
        direccion: `${P}Local 300`,
        ciudad: 'La Rioja',
        provincia: 'La Rioja',
        tipo: 'LOCAL',
        propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
      },
    });
    expect(propRes.statusCode).toBeLessThan(300);
    const propiedadId = propRes.json().id as string;

    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        propiedadId,
        inquilino: { nombre: 'Tercera', apellido: 'Persona', email: EMAIL, dni: '32888999' },
        monto: 300000,
        moneda: 'ARS',
        fechaInicio: '2026-07-01',
        fechaFin: '2027-07-01',
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 6,
      },
    });
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().message).toContain('otra persona');

    // El 409 sale de adentro de la transacción: nada quedó escrito a medias.
    expect(await prisma.contrato.count({ where: { propiedadId } })).toBe(0);
    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(prop.contratoActualId).toBeNull();
    expect(await prisma.persona.count({ where: { inmobiliariaId, dni: '32888999' } })).toBe(0);
  });
});
