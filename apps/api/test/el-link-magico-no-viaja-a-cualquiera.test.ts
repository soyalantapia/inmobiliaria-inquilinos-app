/**
 * CUARTA AUDITORÍA · El link mágico del profesional viajaba pegado al detalle del reclamo.
 *
 * `VisitaProfesional.token` es el link mágico EN CRUDO. Se canjea **sin bearer** en
 * `GET /visitas-publicas/:token` por un JWT `kind: 'profesional'` de tres días, que puede:
 * confirmar la visita, ponerla en camino, repuntar las fotos, y —lo que importa— cerrarla con
 * `POST /listo`, que marca el reclamo RESUELTO, escribe `costoTrabajo` con el monto que le
 * declaren, le acredita el trabajo al profesional y corre `imputarCostoReclamo`: según cómo
 * esté clasificado el reclamo, eso **crea un `CargoContrato` contra el inquilino o descuenta
 * del depósito**.
 *
 * Crear o regenerar ese link exige `profesional.asignar` (ADMIN y OPERADOR). Pero el token
 * viajaba en el `include` de `GET /reclamos/:id` (operacion.ts), gateado con `reclamos.ver`,
 * que **incluye a LECTURA**. El rol de consulta —el de contadores y auditoría, el que NO puede
 * asignar un profesional— se llevaba igual la llave que emite sesiones de profesional.
 *
 * QUE ERA SENSIBLE YA SE SABÍA: el propio `GET /visitas-publicas/:token` arma su respuesta
 * campo por campo y **omite** el token.
 *
 * ⚠️ ME CORRIJO SOBRE EL ALCANCE. La auditoría reportó un segundo escape, hacia el INQUILINO,
 * por el `visita: true` de `inquilino-mundo.ts`. **No existe**: ese include vive dentro de
 * `GET /mis-notificaciones`, que usa `r.visita.estado` para decidir el texto del aviso y NO
 * serializa la visita en la respuesta. Y `GET /mis-reclamos` no incluye la visita en absoluto;
 * la PWA lee el progreso de storage local, y sólo en demo (`apiEnabled ? null : obtenerVisita`).
 * El `select` de ese include igual se acota —es gratis y saca el token de una consulta que no
 * lo necesita— pero va como endurecimiento, no como agujero cerrado.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): volviendo el `include` de
 * `operacion.ts` a `visita: true`, cae el caso de LECTURA con el token entero adentro.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest, loginDemoTest } from './_login.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let tAdmin = '';
let tLectura = '';
let tInquilino = '';
let inmobiliariaId = '';

const P = 'lnk_';
const TOKEN = `${P}token-secreto-de-la-visita`;
const EMAIL_LECTURA = 'zz-lectura-link@example.com';
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/** El contrato del inquilino demo, para que su JWT alcance el reclamo. */
const CONTRATO_DEMO = 'cnt_001';
let reclamoId = '';

async function limpiar() {
  await prisma.visitaProfesional.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.reclamoEvento.deleteMany({ where: { reclamoId: { startsWith: P } } });
  await prisma.reclamo.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profesional.deleteMany({ where: { id: { startsWith: P } } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  tInquilino = await loginDemoTest(app);

  // Un usuario LECTURA. El seed no trae ninguno, y es justo el rol del hallazgo.
  await prisma.usuario.deleteMany({ where: { email: EMAIL_LECTURA } });
  await prisma.usuario.create({
    data: {
      inmobiliariaId,
      nombre: 'Solo',
      apellido: 'Lectura',
      email: EMAIL_LECTURA,
      rol: 'LECTURA',
      activo: true,
      passwordHash: bcrypt.hashSync('lectura123', 8),
    },
  });
  tLectura = await loginTest(app, EMAIL_LECTURA, 'lectura123');

  const prof = await prisma.profesional.create({
    data: {
      id: `${P}prof`,
      inmobiliariaId,
      nombre: 'Plomero DePrueba',
      categoria: 'PLOMERO',
      zona: 'CABA',
      telefono: '11 4444 4444',
    },
  });
  const rec = await prisma.reclamo.create({
    data: {
      id: `${P}rec`,
      inmobiliariaId,
      contratoId: CONTRATO_DEMO,
      propiedadId: 'prp_001',
      categoria: 'PLOMERIA',
      urgencia: 'MEDIA',
      descripcion: 'Pérdida en la cocina (cuarta auditoría)',
      estado: 'EN_CURSO',
      profesionalId: prof.id,
    },
  });
  reclamoId = rec.id;
  await prisma.visitaProfesional.create({
    data: {
      id: `${P}visita`,
      inmobiliariaId,
      reclamoId: rec.id,
      profesionalId: prof.id,
      token: TOKEN,
      estado: 'CONFIRMADA',
      confirmadaAt: new Date(),
    },
  });
}, 420_000);

afterAll(async () => {
  // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
  await limpiar();
  await prisma.usuario.deleteMany({ where: { email: EMAIL_LECTURA } });
  if (app) await app.close();
  await prisma.$disconnect();
});

const detallePanel = (t: string) =>
  app.inject({ method: 'GET', url: `/reclamos/${reclamoId}`, headers: auth(t) });

describe('el token de la visita no viaja a quien no puede crearlo', () => {
  it('el escenario se armó: hay visita con token', async () => {
    const v = await prisma.visitaProfesional.findUniqueOrThrow({ where: { id: `${P}visita` } });
    expect(v.token).toBe(TOKEN);
  });

  it('🔴 un rol LECTURA ve el reclamo… y NO el token', async () => {
    const r = await detallePanel(tLectura);
    expect(r.statusCode).toBe(200);
    const j = r.json();
    // Ve la visita —el progreso del trabajo es información legítima de consulta—
    expect(j.visita).toBeTruthy();
    expect(j.visita.estado).toBe('CONFIRMADA');
    // …pero no la llave. Con el bug: el token entero.
    expect(j.visita.token).toBeUndefined();
    expect(JSON.stringify(j)).not.toContain(TOKEN);
  });

  it('y por ninguna puerta del inquilino sale el token', async () => {
    // La auditoría reportó un escape acá y NO existe: `/mis-reclamos` no incluye la visita, y
    // el `visita: true` de `/mis-notificaciones` se usa para decidir el texto del aviso, no se
    // serializa. Este caso lo fija igual: si mañana alguien agrega la visita a la respuesta
    // del inquilino, el token no puede venir con ella.
    for (const url of ['/mis-reclamos', '/mis-notificaciones']) {
      const r = await app.inject({ method: 'GET', url, headers: auth(tInquilino) });
      expect(r.statusCode, url).toBe(200);
      expect(r.body, url).not.toContain(TOKEN);
    }
  });

  it('CONTROL POSITIVO — un ADMIN sí lo recibe: es quien copia y regenera el link', async () => {
    const r = await detallePanel(tAdmin);
    expect(r.statusCode).toBe(200);
    // Sin esto, el arreglo podría ser "no devolver el token nunca" y romper el panel.
    expect(r.json().visita.token).toBe(TOKEN);
  });

  it('y el token sigue sirviendo para lo que es: entrar por el link', async () => {
    // El control que prueba que no se rompió el circuito del profesional.
    const r = await app.inject({ method: 'GET', url: `/visitas-publicas/${TOKEN}` });
    expect(r.statusCode).toBe(200);
    // Y la respuesta pública NO se lo devuelve: ya lo tiene, y repetirlo es superficie de más.
    expect(r.json().token).toBeUndefined();
  });
});
