/**
 * TERCERA AUDITORÍA · Los dos caminos que DAN poder sobre el equipo eran los únicos mudos.
 *
 * Hay tres verbos sobre el mismo recurso. `POST /usuarios` en su alta real escribe
 * `EQUIPO_INVITADO` y manda el mail de invitación. `DELETE /usuarios/:id` escribe
 * `EQUIPO_REMOVIDO`. Los que dan poder no escribían nada:
 *
 *  - la rama de REACTIVACIÓN del POST hacía el `update` con `activo: true` y el rol nuevo, y
 *    devolvía 200 antes de la auditoría y antes del mail;
 *  - `PUT /usuarios/:id` —el otro endpoint que escribe `Usuario.rol`— corría su transacción
 *    serializable y devolvía desde adentro, sin una sola llamada a `registrarEvento`.
 *
 * Y LA REACTIVACIÓN ES EL ÚNICO CAMINO DE REINCORPORACIÓN QUE EXISTE: la pantalla Equipo
 * filtra por `activo`, así que el usuario dado de baja desaparece y no hay botón de
 * «reactivar» en ninguna parte. Al admin no le queda otra que apretar «Sumar» y volver a
 * tipear el email — que es exactamente lo que caía en la rama muda.
 *
 * El escenario: alguien sale del equipo como CARGA (queda `EQUIPO_REMOVIDO (CARGA)` en la
 * auditoría) y tres semanas después vuelve como ADMIN. La última línea sobre esa persona sigue
 * siendo la baja como CARGA. Desde ahí concilia pagos, rinde a propietarios, devuelve
 * depósitos y aprueba contratos, y cuando aparezca una rendición rara no hay forma de
 * reconstruir desde cuándo podía hacerla ni quién se lo habilitó.
 *
 * `PATCH /propietarios/:id/activo` ya audita las DOS direcciones sobre un poder mucho menor.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando los dos `registrarEvento`
 * nuevos, fallan los tres casos que buscan el evento; el control positivo del rol viejo
 * también, porque la lista viene vacía.
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
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
let adminId = '';
let usuarioId = '';

const EMAIL = 'zz-tercera-auditoria-equipo@example.com';
const auth = () => ({ authorization: `Bearer ${token}` });

const eventosDe = (entidadId: string) =>
  prisma.eventoAuditoria.findMany({ where: { entidadId }, orderBy: { fecha: 'asc' } });

const sumar = (rol: 'CARGA' | 'ADMIN') =>
  app.inject({
    method: 'POST',
    url: '/usuarios',
    headers: auth(),
    payload: { nombre: 'Prueba', apellido: 'Auditoría', email: EMAIL, rol },
  });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const admin = await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' } });
  adminId = admin.id;
  inmobiliariaId = admin.inmobiliariaId;
  // Limpieza idempotente: una corrida previa pudo dejar el usuario y sus eventos.
  const previo = await prisma.usuario.findFirst({ where: { email: EMAIL } });
  if (previo) {
    await prisma.eventoAuditoria.deleteMany({ where: { entidadId: previo.id } });
    await prisma.usuario.delete({ where: { id: previo.id } });
  }
});

afterAll(async () => {
  if (usuarioId) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
    await prisma.eventoAuditoria.deleteMany({ where: { entidadId: usuarioId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('dar poder deja rastro', () => {
  it('el alta y la baja ya lo dejaban (el vecino que estaba bien)', async () => {
    const alta = await sumar('CARGA');
    expect(alta.statusCode).toBe(201);
    usuarioId = alta.json().id;
    const baja = await app.inject({ method: 'DELETE', url: `/usuarios/${usuarioId}`, headers: auth() });
    expect(baja.statusCode).toBe(200);
    const tipos = (await eventosDe(usuarioId)).map((e) => e.tipo);
    expect(tipos).toEqual(['EQUIPO_INVITADO', 'EQUIPO_REMOVIDO']);
  });

  it('reincorporarlo con MÁS poder deja rastro, y dice de dónde venía', async () => {
    // El camino real: no hay botón de "reactivar", así que el admin aprieta «Sumar» y
    // vuelve a tipear el mismo email. Cae en la rama de reactivación.
    const r = await sumar('ADMIN');
    expect(r.statusCode).toBe(200); // 200 y no 201: es la rama de reactivación
    expect(r.json().rol).toBe('ADMIN');
    const eventos = await eventosDe(usuarioId);
    const reinc = eventos.find((e) => e.tipo === 'EQUIPO_REINCORPORADO');
    // Con el bug: undefined. La última línea sobre esta persona seguía siendo la baja
    // como CARGA, mientras ya conciliaba pagos y devolvía depósitos.
    expect(reinc).toBeTruthy();
    expect(reinc?.autorId).toBe(adminId);
    expect(reinc?.entidadDescripcion).toContain('ADMIN');
    // El salto de poder tiene que leerse: sin el rol viejo, el rastro no dice que hubo uno.
    expect(reinc?.entidadDescripcion).toContain('antes era CARGA');
  });

  it('cambiarle el rol también', async () => {
    const r = await app.inject({
      method: 'PUT',
      url: `/usuarios/${usuarioId}`,
      headers: auth(),
      payload: { rol: 'LECTURA' },
    });
    expect(r.statusCode).toBe(200);
    const cambio = (await eventosDe(usuarioId)).find((e) => e.tipo === 'EQUIPO_ROL_CAMBIADO');
    expect(cambio).toBeTruthy(); // con el bug: undefined
    expect(cambio?.entidadDescripcion).toContain('ADMIN → LECTURA');
  });

  it('pero editar el nombre sin tocar el rol NO inventa un cambio de rol', async () => {
    const antes = (await eventosDe(usuarioId)).filter((e) => e.tipo === 'EQUIPO_ROL_CAMBIADO').length;
    const r = await app.inject({
      method: 'PUT',
      url: `/usuarios/${usuarioId}`,
      headers: auth(),
      payload: { nombre: 'Prueba Editada' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().nombre).toBe('Prueba Editada');
    const despues = (await eventosDe(usuarioId)).filter((e) => e.tipo === 'EQUIPO_ROL_CAMBIADO').length;
    // El rastro sirve si dice la verdad: un evento por cada guardado del formulario lo
    // vuelve ilegible, que es la otra forma de no dejar rastro.
    expect(despues).toBe(antes);
  });

  it('ni mandar el MISMO rol otra vez', async () => {
    const antes = (await eventosDe(usuarioId)).filter((e) => e.tipo === 'EQUIPO_ROL_CAMBIADO').length;
    await app.inject({ method: 'PUT', url: `/usuarios/${usuarioId}`, headers: auth(), payload: { rol: 'LECTURA' } });
    const despues = (await eventosDe(usuarioId)).filter((e) => e.tipo === 'EQUIPO_ROL_CAMBIADO').length;
    expect(despues).toBe(antes);
  });

  it('y el 409 de "tiene que quedar un Admin" sigue funcionando después del refactor', async () => {
    // El `return` salió de adentro de la transacción para poder auditar post-commit. Este
    // caso fija que el candado serializable no se rompió en el camino.
    const r = await app.inject({
      method: 'PUT',
      url: `/usuarios/${adminId}`,
      headers: auth(),
      payload: { rol: 'LECTURA' },
    });
    // El seed tiene UN solo ADMIN activo: degradarlo dejaría la inmobiliaria sin ninguno.
    expect(r.statusCode).toBe(409);
    expect(r.json().message).toContain('Admin');
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: adminId } });
    expect(admin.rol).toBe('ADMIN');
    // Y no se auditó un cambio que no ocurrió.
    expect((await eventosDe(adminId)).filter((e) => e.tipo === 'EQUIPO_ROL_CAMBIADO')).toEqual([]);
  });
});
