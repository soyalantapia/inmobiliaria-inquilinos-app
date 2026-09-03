/**
 * T-23-N4 · Dos puertas que se quedaron con una foto vieja.
 *
 * Todos los guards de `auth/guards.ts` revalidan contra la tabla en cada request, y el archivo
 * explica por qué: el token dura **15 días** (`TOKEN_TTL`), así que dar de baja a un empleado o
 * bajarle el rol no tiene efecto si se confía en lo que el JWT dice. Dos lugares se quedaron
 * afuera de esa regla, cada uno a su manera:
 *
 *  1. **`POST /reportes`** era el único handler del repo que usaba `requireAuth` PELADO. Y lo
 *     que guardaba era peor que el acceso: `rol` e `inmobiliariaId` salían del token, o sea que
 *     la fila quedaba firmada con el rol viejo —`GET /reportes` lo muestra tal cual— y alguien
 *     movido de inmobiliaria escribía en el tenant anterior.
 *
 *  2. **`uploads.ts`** tenía su propia COPIA de la regla de vigencia del link mágico, con dos de
 *     las tres reglas: le faltaba el **tope duro de 60 días** (`VIDA_MAX_LINK_MS`). Un link de
 *     una visita que nadie marcó LISTO, sobre un reclamo que quedó abierto, servía para siempre.
 *     Y `GET /uploads/:t/:n` acepta el token por query: alcanza con pegar la URL en el navegador.
 *
 * Las dos ahora pasan por la MISMA implementación (`revalidarPayload` y `linkDeVisitaVencido`).
 * Que este archivo cubra las dos mitades juntas no es capricho: son el mismo defecto —una copia
 * de la regla que se desincronizó— y el propio `uploads.ts` ya lo tenía escrito como advertencia
 * antes de volver a caer.
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
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const P = 'ZZ-vigencia-';
const DIA = 24 * 60 * 60 * 1000;
let tid = '';
let tokenBaja = '';
let usuarioBajaId = '';

const reportar = (token: string, titulo: string) =>
  app.inject({
    method: 'POST',
    url: '/reportes',
    headers: auth(token),
    payload: { tipo: 'IDEA', titulo, url: '/qa' },
  });

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await prisma.usuario.findFirstOrThrow({
    where: { email: 'roberto@delsol.com' },
    select: { id: true, inmobiliariaId: true, passwordHash: true },
  });
  tid = admin.inmobiliariaId;

  await limpiar();
  // Un usuario propio del test: dar de baja a uno del seed le rompe la corrida a los demás
  // archivos, que comparten esta base y corren después.
  const u = await prisma.usuario.create({
    data: {
      id: `${P}user`,
      inmobiliariaId: tid,
      email: 'zz-vigencia-baja@qa.invalid',
      nombre: 'Baja',
      apellido: 'De Prueba',
      // Le copiamos el hash del admin para poder loguearlo con la misma contraseña.
      passwordHash: admin.passwordHash,
      rol: 'ADMIN',
      activo: true,
    },
  });
  usuarioBajaId = u.id;
  tokenBaja = await loginTest(app, 'zz-vigencia-baja@qa.invalid', 'delsol123');
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  await prisma.reportePiloto.deleteMany({ where: { titulo: { startsWith: P } } });
  await prisma.reportePiloto.deleteMany({ where: { usuarioId: { startsWith: P } } });
  await prisma.coInquilino.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.usuario.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.visitaProfesional.deleteMany({ where: { token: { startsWith: P } } });
  await prisma.reclamo.deleteMany({ where: { descripcion: { startsWith: P } } });
}

describe('un token de 15 días no es una llave permanente', () => {
  describe('POST /reportes revalida contra la tabla, no contra el token', () => {
    it('CONTROL POSITIVO — un usuario vigente reporta y se guarda', async () => {
      const r = await reportar(tokenBaja, `${P}vigente`);
      expect(r.statusCode, r.body.slice(0, 200)).toBe(201);
    });

    it('🔴 un empleado dado de baja deja de poder escribir', async () => {
      // `DELETE /usuarios/:id` deja `activo: false`: la fila y el token siguen vivos.
      await prisma.usuario.update({ where: { id: usuarioBajaId }, data: { activo: false } });
      const r = await reportar(tokenBaja, `${P}dado-de-baja`);
      // Con el bug: 201, y la fila queda en la base firmada por alguien que ya no trabaja acá.
      expect(r.statusCode).toBe(401);
      await prisma.usuario.update({ where: { id: usuarioBajaId }, data: { activo: true } });
    });

    it('🔴 el `rol` que se guarda es el de la TABLA, no el que trae el token', async () => {
      // Éste es el peor de los dos: no es sólo acceso, es un dato falso que después alguien lee.
      // El token se emitió con rol ADMIN; le bajamos el rol y reportamos con el MISMO token.
      await prisma.usuario.update({ where: { id: usuarioBajaId }, data: { rol: 'LECTURA' } });
      const r = await reportar(tokenBaja, `${P}rol-bajado`);
      expect(r.statusCode, r.body.slice(0, 200)).toBe(201);
      const fila = await prisma.reportePiloto.findFirstOrThrow({ where: { titulo: `${P}rol-bajado` } });
      // Con el bug: 'ADMIN', el rol congelado en el JWT. `GET /reportes` lo muestra tal cual, así
      // que quien lee la bandeja del piloto cree que el reporte lo firmó un administrador.
      expect(fila.rol).toBe('LECTURA');
      await prisma.usuario.update({ where: { id: usuarioBajaId }, data: { rol: 'ADMIN' } });
    });

    it('🔴 un co-inquilino con el acceso revocado tampoco entra', async () => {
      // Revocar BORRA la fila (`core.ts:474` e `inquilino-mundo.ts:751`), así que el
      // co-inquilino es propio del test: borrar uno del seed le rompe la corrida a los archivos
      // que vienen después sobre esta misma base.
      const co = await prisma.coInquilino.create({
        data: {
          id: `${P}co`,
          inmobiliariaId: tid,
          contratoId: 'cnt_001',
          nombre: 'Co De Prueba',
          email: `${P}co@qa.invalid`,
          relacion: 'Pareja',
          permiso: 'PAGAR',
          estado: 'ACEPTADO',
          aceptadoAt: new Date(),
        },
      });
      const token = app.jwt.sign(
        {
          kind: 'co-inquilino',
          coInquilinoId: co.id,
          inmobiliariaId: co.inmobiliariaId,
          contratoId: co.contratoId,
          permiso: co.permiso,
        },
        { expiresIn: '15d' },
      );
      expect((await reportar(token, `${P}co-vigente`)).statusCode).toBe(201);

      await prisma.coInquilino.delete({ where: { id: co.id } });
      const r = await reportar(token, `${P}co-revocado`);
      expect(r.statusCode).toBe(401);
    });
  });

  describe('GET /uploads aplica la misma vigencia del link mágico que el resto', () => {
    /**
     * Se mide contra `GET /uploads/:t/:n` con un nombre de archivo que no existe: si el guard
     * deja pasar, el handler llega al disco y contesta **404**; si corta, **401**. O sea que el
     * discriminador no depende de que haya un archivo real en el Volume.
     */
    async function visitaConReclamoDeHace(dias: number) {
      const prof = await prisma.profesional.findFirstOrThrow({ where: { inmobiliariaId: tid } });
      const rec = await prisma.reclamo.create({
        data: {
          inmobiliariaId: tid,
          contratoId: 'cnt_001',
          propiedadId: 'prp_001',
          categoria: 'PLOMERIA',
          urgencia: 'MEDIA',
          descripcion: `${P}visita de ${dias} días`,
          // EN_CURSO: ni cerrado ni rechazado, así que las reglas (a) y (b) no lo tapan. Lo
          // único que puede cortarlo es el tope duro, que es justo lo que faltaba.
          estado: 'EN_CURSO',
          createdAt: new Date(Date.now() - dias * DIA),
        },
      });
      const v = await prisma.visitaProfesional.create({
        data: {
          inmobiliariaId: tid,
          reclamoId: rec.id,
          profesionalId: prof.id,
          token: `${P}${rec.id}`,
          estado: 'ASIGNADO', // nunca se marcó LISTO
        },
      });
      return app.jwt.sign(
        { kind: 'profesional', visitaId: v.id, inmobiliariaId: tid, profesionalId: prof.id },
        { expiresIn: '3d' },
      );
    }

    const bajar = (token: string) =>
      app.inject({ method: 'GET', url: `/uploads/${tid}/no-existe.jpg?token=${token}` });

    it('CONTROL POSITIVO — una visita abierta y reciente sigue sirviendo archivos', async () => {
      const r = await bajar(await visitaConReclamoDeHace(1));
      expect(r.statusCode, 'el guard tiene que dejar pasar y morir en el disco').toBe(404);
    });

    it('🔴 pasados los 60 días el link deja de abrir, aunque la visita nunca se cerrara', async () => {
      const r = await bajar(await visitaConReclamoDeHace(70));
      // Con el bug: 404, o sea que el guard dejaba pasar. El nombre del archivo es lo único que
      // lo tapaba — y viaja en el `<img src>` y se reenvía como cualquier link.
      expect(r.statusCode).toBe(401);
    });
  });
});
