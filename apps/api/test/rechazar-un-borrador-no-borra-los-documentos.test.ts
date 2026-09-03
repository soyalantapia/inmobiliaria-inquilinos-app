/**
 * T-01-N1-N13 · Rechazar un contrato borraba el DNI y los recibos de una persona real.
 *
 * `POST /aprobaciones/:id/rechazar` tenía cinco `deleteMany` que se llevaban puestos `CodigoOtp`,
 * `AnuncioAcuse`, **`Documento`**, **`CertificadoInquilino`** y el `Inquilino`. Los dos del medio
 * son datos reales: el DNI, el recibo de sueldo y el extracto que la persona subió, y el
 * certificado que el sistema le calculó a partir de sus pagos.
 *
 * LA JUSTIFICACIÓN ERA CIERTA Y DEJÓ DE SERLO. Decía, textual, que sin borrar «su email queda
 * tomado (`@@unique [inmobiliariaId,email]`) y bloquea para siempre volver a cargar un contrato
 * con ese inquilino». Ese `@@unique` **se sacó**, y el schema hoy declara lo contrario con su
 * motivo: un mismo inquilino puede tener varios contratos en la misma inmobiliaria (3 locales,
 * 10 deptos de un consorcio) y todos comparten su email de login; la unicidad vive en `Persona`.
 *
 * O sea que se estaban destruyendo documentos de una persona para sostener una restricción
 * retirada — y el comentario que lo explicaba era lo único que hacía que el borrado pareciera
 * necesario. Ése es el patrón que este archivo cuida: **una razón escrita envejece peor que el
 * código, porque nadie la re-mide.**
 *
 * Ahora se DESENGANCHA (`contratoId: null`) en vez de borrar. Los tres casos de abajo son las
 * tres cosas que el borrado conseguía y que el desenganche tiene que seguir consiguiendo.
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
const prisma = new PrismaClient();

const P = 'ZZ-rechazo-doc';
const EMAIL = 'zz-rechazo-doc@qa.invalid';
let tAdmin = '';
let tOperador = '';
let inmobiliariaId = '';

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  // El alta la hace el OPERADOR: un ADMIN no genera aprobación (se aprueba a sí mismo), así que
  // con su token no habría nada que rechazar. El rechazo sí lo firma el ADMIN.
  tOperador = await loginTest(app, 'luciana@delsol.com', 'delsol123');
  inmobiliariaId = (
    await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' }, select: { inmobiliariaId: true } })
  ).inmobiliariaId;
  await limpiar();
}, 420_000);

afterAll(async () => {
  await limpiar();
  await prisma.inmobiliaria.update({
    where: { id: inmobiliariaId },
    data: { contratosRequierenAprobacion: false },
  });
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${tAdmin}` });
const authOperador = () => ({ authorization: `Bearer ${tOperador}` });

async function limpiar(): Promise<void> {
  const contratos = (
    await prisma.contrato.findMany({ where: { propiedad: { direccion: { startsWith: P } } }, select: { id: true } })
  ).map((c) => c.id);
  const inqs = (await prisma.inquilino.findMany({ where: { email: EMAIL }, select: { id: true } })).map((i) => i.id);
  if (inqs.length) {
    await prisma.documento.deleteMany({ where: { inquilinoId: { in: inqs } } });
    await prisma.certificadoInquilino.deleteMany({ where: { inquilinoId: { in: inqs } } });
    await prisma.codigoOtp.deleteMany({ where: { inquilinoId: { in: inqs } } });
    await prisma.inquilino.deleteMany({ where: { id: { in: inqs } } });
  }
  if (contratos.length) {
    // El orden importa y no es adivinable: las FK son RESTRICT, así que un hijo colgando hace
    // reventar la limpieza y el rojo aparece en el `beforeAll` del archivo siguiente, sin
    // relación visible con lo que lo dejó. Pasó acá con `liquidaciones_contratoId_fkey`.
    await prisma.pago.deleteMany({ where: { contratoId: { in: contratos } } });
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: contratos } } });
    await prisma.cargoContrato.deleteMany({ where: { contratoId: { in: contratos } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: contratos } } });
    await prisma.aprobacion.deleteMany({ where: { entidadId: { in: contratos } } });
    await prisma.contrato.deleteMany({ where: { id: { in: contratos } } });
  }
  await prisma.participacionPropietario.deleteMany({ where: { propiedad: { direccion: { startsWith: P } } } });
  await prisma.propiedad.deleteMany({ where: { direccion: { startsWith: P } } });
}

/**
 * Un borrador pendiente de aprobación, con su inquilino y un documento subido — que es el estado
 * real en el que llega un rechazo: la ficha ya se cargó entera y la persona ya mandó su DNI.
 */
async function borradorConDocumento(sufijo: string) {
  await prisma.inmobiliaria.update({
    where: { id: inmobiliariaId },
    data: { contratosRequierenAprobacion: true },
  });
  const propietario = await prisma.propietario.findFirstOrThrow({ where: { inmobiliariaId } });
  const propiedad = await prisma.propiedad.create({
    data: {
      inmobiliariaId,
      direccion: `${P} ${sufijo}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'DISPONIBLE',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId: propietario.id, porcentaje: 100 },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/contratos',
    headers: authOperador(),
    payload: {
      propiedadId: propiedad.id,
      inquilino: { nombre: 'Rechazado', apellido: 'De Prueba', email: EMAIL },
      monto: 100_000,
      fechaInicio: '2026-01-01',
      fechaFin: '2028-01-01',
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 12,
    },
  });
  expect(res.statusCode, res.body.slice(0, 200)).toBeLessThan(300);
  const contratoId = res.json().id as string;

  const inq = await prisma.inquilino.findFirstOrThrow({ where: { contratoId }, select: { id: true } });
  // El DNI que la persona subió. Es exactamente lo que se estaba borrando.
  const doc = await prisma.documento.create({
    data: {
      inmobiliariaId,
      inquilinoId: inq.id,
      categoria: 'IDENTIDAD',
      nombre: `${P} dni.jpg`,
      tipoMime: 'image/jpeg',
      tamanioBytes: 12_345,
      archivoUrl: `/uploads/${inmobiliariaId}/zz-rechazo-doc.jpg`,
    },
  });
  const aprobacionId = (await prisma.aprobacion.findFirstOrThrow({ where: { entidadId: contratoId } })).id;
  return { contratoId, inquilinoId: inq.id, documentoId: doc.id, aprobacionId };
}

const rechazar = (aprobacionId: string) =>
  app.inject({
    method: 'POST',
    url: `/aprobaciones/${aprobacionId}/rechazar`,
    headers: auth(),
    payload: { comentario: 'La fecha de fin está mal cargada.' },
  });

describe('rechazar un borrador no borra los documentos del inquilino', () => {
  it('🔴 el DNI que subió la persona sigue estando', async () => {
    const { documentoId, inquilinoId, aprobacionId } = await borradorConDocumento('doc');
    const r = await rechazar(aprobacionId);
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
    // Con el bug: el `deleteMany` de Documento se lo llevaba, y el archivo quedaba huérfano en
    // el Volume sin ninguna fila que lo nombrara.
    expect(await prisma.documento.findUnique({ where: { id: documentoId } })).not.toBeNull();
    expect(await prisma.inquilino.findUnique({ where: { id: inquilinoId } })).not.toBeNull();
  });

  it('CONTROL POSITIVO — el contrato igual queda sin titular, que es lo que el borrado conseguía', async () => {
    const { contratoId, inquilinoId, aprobacionId } = await borradorConDocumento('titular');
    expect(await rechazar(aprobacionId)).toMatchObject({ statusCode: 200 });
    // `Inquilino.contratoId` es el lado `@unique` del 1:1: ponerlo en null libera el contrato
    // igual que borrar la fila, y los mappers ya esperan `inquilinoTitular` en null.
    const inq = await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } });
    expect(inq.contratoId).toBeNull();
    expect(await prisma.inquilino.count({ where: { contratoId } })).toBe(0);
  });

  it('🔴 y no le aparece un alquiler fantasma cuando entra por OTP', async () => {
    // Ésta es la razón por la que desenganchar alcanza: `alquileresDeEmail` filtra por
    // `contratoId: { not: null }`. Sin ese filtro, la persona vería en «Mis alquileres» un
    // contrato que le rechazaron, y podría elegirlo.
    const { aprobacionId } = await borradorConDocumento('fantasma');
    expect(await rechazar(aprobacionId)).toMatchObject({ statusCode: 200 });
    const r = await app.inject({ method: 'POST', url: '/auth/otp/solicitar', payload: { email: EMAIL } });
    // El endpoint no distingue "no existe" de "existe": lo que se mide es la lista, abajo.
    expect([200, 204, 404]).toContain(r.statusCode);
    const visibles = await prisma.inquilino.count({ where: { email: EMAIL, contratoId: { not: null } } });
    expect(visibles, 'ningún alquiler rechazado puede quedar visible en el selector').toBe(0);
  });

  it('un rechazo sobre un inquilino que ya pidió OTP no revienta la transacción', async () => {
    // El comentario viejo describía este riesgo con el borrado: si el inquilino abrió la PWA y
    // pidió un código, el `deleteMany` podía tirar P2003 → rollback → la aprobación volvía a
    // PENDIENTE y no se podía rechazar NUNCA MÁS. Un `updateMany` no borra nada, así que no
    // puede chocar contra ninguna FK.
    const { inquilinoId, aprobacionId } = await borradorConDocumento('otp');
    await prisma.codigoOtp.create({
      data: { inquilinoId, codeHash: 'no-importa', expiresAt: new Date(Date.now() + 600_000) },
    });
    expect(await rechazar(aprobacionId)).toMatchObject({ statusCode: 200 });
    const apr = await prisma.aprobacion.findUniqueOrThrow({ where: { id: aprobacionId } });
    expect(apr.estado, 'la aprobación tiene que quedar decidida, no volver a PENDIENTE').not.toBe('PENDIENTE');
  });
});
