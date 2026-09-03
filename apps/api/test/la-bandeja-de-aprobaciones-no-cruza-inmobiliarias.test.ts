/**
 * `GET /aprobaciones` no tenía UN SOLO test, y hace un join polimórfico.
 *
 * QUÉ LO HACE DELICADO. `Aprobacion.entidadId` es polimórfico —«cnt_* / mov_* / pago según
 * tipo», dice el schema— y el handler lo usa para traer el contrato de las `CONTRATO_CARGADO`.
 * O sea que hay **dos** consultas que tienen que estar scopeadas por inmobiliaria, y ninguna
 * las cuidaba con un caso:
 *
 *   1. la de aprobaciones, que es la que de verdad puede filtrar datos de otro tenant;
 *   2. la de contratos, que es defensa en profundidad — hoy los ids ya vienen filtrados por (1),
 *      pero un `entidadId` que apunte al contrato de otra inmobiliaria (dato corrupto, o un bug
 *      en quien la crea) adjuntaría la ficha entera de ese contrato: dirección, inquilino con
 *      DNI y teléfono, montos, garantes.
 *
 * Ese segundo caso es el que hace que el filtro valga: es el único que lo pone en rojo si
 * alguien lo saca «porque los ids ya vienen filtrados».
 *
 * POR QUÉ NO EXISTÍA. El endpoint se escribió el 18/08 (`89132c93`) para resolver que la
 * administradora estaba aprobando a ciegas —«me sale aprobar o rechazar pero no puedo verlo»—.
 * Entró sin cobertura. Los tres archivos que nombran aprobaciones sólo ejercitan
 * `POST /aprobaciones/:id/aprobar|rechazar`.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

let app: FastifyInstance;
let tAdmin = '';
const prisma = new PrismaClient();
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const P = 'ZZ-apro-';
const OTRO_TENANT = `${P}inmo`;
let tenant = '';
let usuarioId = '';
let contratoPropio = '';
let contratoAjeno = '';

interface AprobacionApi {
  id: string;
  tipo: string;
  entidadId: string;
  contrato?: { id: string; propiedad?: { direccion: string } | null } | null;
}

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  const usuario = await prisma.usuario.findFirstOrThrow({
    where: { email: 'roberto@delsol.com' },
    select: { id: true, inmobiliariaId: true },
  });
  usuarioId = usuario.id;
  tenant = usuario.inmobiliariaId;
  contratoPropio = (await prisma.contrato.findFirstOrThrow({ where: { inmobiliariaId: tenant }, select: { id: true } })).id;

  await limpiar();
  // Una inmobiliaria de verdad con su propio contrato: sin eso, "no ve lo ajeno" se prueba
  // contra la nada.
  await prisma.inmobiliaria.create({
    data: {
      id: OTRO_TENANT,
      nombre: 'Inmobiliaria Ajena (aprobaciones)',
      cuit: '30-70000001-5',
      email: 'contacto@ajena-apro.invalid',
      telefono: '11 0000-0001',
      matricula: 'XX-0001',
      direccionCalle: 'Falsa',
      direccionAltura: '456',
      direccionCiudad: 'CABA',
      direccionProvincia: 'Buenos Aires',
      direccionCp: '1000',
      codigoReferido: `${P}ref`,
    },
  });
  const propAjena = await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId: OTRO_TENANT,
      direccion: 'Calle Secreta 1234',
      ciudad: 'Rosario',
      provincia: 'Santa Fe',
      tipo: 'DEPARTAMENTO',
      ambientes: 2,
      estado: 'DISPONIBLE',
    },
  });
  contratoAjeno = (
    await prisma.contrato.create({
      data: {
        id: `${P}cnt`,
        inmobiliariaId: OTRO_TENANT,
        propiedadId: propAjena.id,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2028-01-01'),
        diaPago: 10,
        monto: 999_999,
        moneda: 'ARS',
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        estado: 'BORRADOR',
      },
    })
  ).id;
});

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  await prisma.aprobacion.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.propiedad.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.inmobiliaria.deleteMany({ where: { id: { startsWith: P } } });
}

/** Una aprobación de tipo CONTRATO_CARGADO, apuntando a donde se le diga. */
async function crearAprobacion(id: string, inmobiliariaId: string, entidadId: string) {
  return prisma.aprobacion.create({
    data: {
      id,
      inmobiliariaId,
      tipo: 'CONTRATO_CARGADO',
      titulo: 'Contrato cargado',
      descripcion: 'de prueba',
      entidadId,
      cargadoPorId: usuarioId,
      rolAutor: 'CARGA',
      cargadoAt: new Date(),
    },
  });
}

const bandeja = async (): Promise<AprobacionApi[]> => {
  const r = await app.inject({ method: 'GET', url: '/aprobaciones', headers: auth(tAdmin) });
  expect(r.statusCode).toBe(200);
  return r.json() as AprobacionApi[];
};

describe('la bandeja de aprobaciones no cruza inmobiliarias', () => {
  it('🔴 una aprobación de OTRA inmobiliaria no aparece', async () => {
    await crearAprobacion(`${P}ajena`, OTRO_TENANT, contratoAjeno);
    const filas = await bandeja();
    expect(filas.some((a) => a.id === `${P}ajena`)).toBe(false);
  });

  it('CONTROL POSITIVO — la propia sí aparece, con su contrato adjunto', async () => {
    await crearAprobacion(`${P}propia`, tenant, contratoPropio);
    const filas = await bandeja();
    const mia = filas.find((a) => a.id === `${P}propia`);
    expect(mia, 'la aprobación del propio tenant tiene que estar').toBeTruthy();
    // Lo que el endpoint vino a resolver: que se pueda VER lo que se está por aprobar.
    expect(mia!.contrato?.id).toBe(contratoPropio);
  });

  it('🔴 y si el `entidadId` apunta a un contrato AJENO, no se adjunta su ficha', async () => {
    // Éste es el caso que compra el segundo filtro por tenant. Los ids ya vienen filtrados por
    // la consulta de aprobaciones, así que sin este caso alguien puede sacarlo "porque no hace
    // falta" — y ahí la bandeja pasa a servir dirección, inquilino con DNI y teléfono, montos y
    // garantes de un contrato de otra inmobiliaria.
    await crearAprobacion(`${P}cruzada`, tenant, contratoAjeno);
    const filas = await bandeja();
    const cruzada = filas.find((a) => a.id === `${P}cruzada`);
    expect(cruzada, 'la aprobación es del propio tenant: tiene que aparecer').toBeTruthy();
    expect(cruzada!.contrato ?? null).toBeNull();
    // Y sobre todo: la dirección del contrato ajeno no viaja en la respuesta.
    expect(JSON.stringify(filas)).not.toContain('Calle Secreta 1234');
  });
});
