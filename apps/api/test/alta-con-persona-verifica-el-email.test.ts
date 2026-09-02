/**
 * El alta que REUSA una Persona no puede quedarse con el email de otra persona de la cartera.
 *
 * DE DÓNDE SALIÓ. De la auditoría del 31/08 (`work-agent/AUDITORIA-2026-08-31.md`), clase
 * "justificación caducada": un comentario que autoriza la ausencia de una validación citando
 * un guard que ya no existe.
 *
 * LA ASIMETRÍA, QUE ES EL DEFECTO. `POST /contratos` tiene dos ramas:
 *
 *   · SIN `personaId` → `buscarOCrearPersona` + `esOtraPersona` → 409 si ese email es de otro DNI.
 *   · CON `personaId` → un `findFirstOrThrow` de SOLO LECTURA sobre Persona. Nunca la escribe,
 *     así que no ejerce el `@@unique([inmobiliariaId, email])` y no corría ningún chequeo.
 *
 * Y el comentario decía *"(El guard de email de arriba sigue aplicando…)"* doce líneas después
 * de otro comentario que explica que ese guard SE SACÓ con el multi-alquiler. El archivo se
 * contradecía a sí mismo en diez líneas.
 *
 * QUÉ HABILITABA. El operador elige del autocomplete la Persona de Juan y en el campo email
 * tipea el de Mariela —otra inquilina de la misma cartera—. Queda un `Inquilino` con el email
 * de Mariela colgado del contrato de Juan; como el acceso a la PWA es por OTP al mail, la
 * casilla de Mariela entra al contrato de Juan y ve monto, deuda y documentos.
 *
 * LO QUE NO ES: que `/auth/otp/*` busque por email sin scope de tenant. Eso es deliberado y está
 * documentado —"una persona, un login, varios alquileres"—, y la propiedad de seguridad se
 * sostiene igual porque el OTP prueba control de la casilla.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { loginTest } from './_login.js';

const P = 'acpe-';
const EMAIL_MARIELA = 'acpe.mariela@example.com';
const EMAIL_JUAN = 'acpe.juan@example.com';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';
let inmobiliariaId = '';
let personaJuan = '';

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function limpiar(): Promise<void> {
  const props = [`${P}prop1`, `${P}prop2`, `${P}prop3`];
  const ids = (
    await prisma.contrato.findMany({ where: { propiedadId: { in: props } }, select: { id: true } })
  ).map((c) => c.id);
  if (ids.length) {
    await prisma.liquidacion.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.eventoContrato.deleteMany({ where: { contratoId: { in: ids } } });
    await prisma.inquilino.updateMany({ where: { contratoId: { in: ids } }, data: { contratoId: null } });
  }
  await prisma.propiedad.updateMany({ where: { id: { in: props } }, data: { contratoActualId: null } });
  if (ids.length) await prisma.contrato.deleteMany({ where: { id: { in: ids } } });
  const EMAILS = [EMAIL_JUAN, EMAIL_MARIELA, 'acpe.libre@example.com'];
  await prisma.inquilino.deleteMany({ where: { email: { in: EMAILS } } });
  // Y también los que apuntan a estas Personas SIN email propio: el caso "reusando a Juan sin
  // email" deja un Inquilino con `email: null` y `personaId` de Juan, y esa FK bloquea el
  // borrado de la Persona. Borrarlos por email no alcanzaba, y el error salía en la corrida
  // SIGUIENTE, en el `beforeAll`, sin nombrar la causa.
  const personas = await prisma.persona.findMany({ where: { email: { in: EMAILS } }, select: { id: true } });
  if (personas.length) {
    await prisma.inquilino.deleteMany({ where: { personaId: { in: personas.map((x) => x.id) } } });
  }
  await prisma.persona.deleteMany({ where: { email: { in: EMAILS } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: props } } });
}

/** El alta, tal cual la manda el panel. */
const alta = (propiedadId: string, email: string, extra: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: '/contratos',
    headers: auth(token),
    payload: {
      propiedadId,
      inquilino: { nombre: 'Juan', apellido: 'Perez', email, telefono: '+54 9 11 8000 0000', dni: '20111222' },
      monto: 300_000,
      moneda: 'ARS',
      fechaInicio: '2026-06-01',
      fechaFin: '2028-05-31',
      diaPago: 5,
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
      ...extra,
    },
  });

beforeAll(async () => {
  prisma = new PrismaClient();
  inmobiliariaId = (await seedBase(prisma)).inmobiliariaId;
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');

  for (const id of [`${P}prop1`, `${P}prop2`, `${P}prop3`]) {
    await prisma.propiedad.create({
      data: { id, inmobiliariaId, direccion: `Titular ${id}`, ciudad: 'CABA', provincia: 'Buenos Aires', tipo: 'DEPARTAMENTO' },
    });
  }
  // Mariela YA está en la cartera con su email. Es la persona a la que hay que proteger.
  await prisma.persona.create({
    data: { inmobiliariaId, nombre: 'Mariela', apellido: 'Sosa', dni: '27999888', email: EMAIL_MARIELA },
  });
  // Y Juan también, para poder reusarlo desde el autocomplete.
  const juan = await prisma.persona.create({
    data: { inmobiliariaId, nombre: 'Juan', apellido: 'Perez', dni: '20111222', email: EMAIL_JUAN },
  });
  personaJuan = juan.id;
});

afterAll(async () => {
  await limpiar();
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('un alta que reusa una Persona no se queda con el email de otra', () => {
  it('el escenario se armó: Mariela y Juan están en la cartera', async () => {
    expect(personaJuan).not.toBe('');
    expect(await prisma.persona.count({ where: { email: EMAIL_MARIELA } })).toBe(1);
  });

  it('🔴 reusando a Juan, NO se puede poner el email de Mariela', async () => {
    const r = await alta(`${P}prop1`, EMAIL_MARIELA, { personaId: personaJuan });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { message: string }).message).toContain('ya lo usa otra persona');
    // Y no lo creó igual: si el 409 llegara después de escribir, el daño ya estaría hecho.
    expect(await prisma.contrato.count({ where: { propiedadId: `${P}prop1` } })).toBe(0);
    expect(await prisma.inquilino.count({ where: { email: EMAIL_MARIELA } })).toBe(0);
  });

  it('🔴 y SIN personaId tampoco, aunque el DNI del alta matchee con Juan', async () => {
    // ESTE CASO ES EL QUE ENSEÑÓ ALGO. Se escribió como "control de simetría" creyendo que la
    // otra rama ya cortaba, y salió en VERDE cuando tenía que dar 409: la rama sin `personaId`
    // tenía el MISMO agujero por otro motivo. `buscarOCrearPersona` busca por DNI PRIMERO, así
    // que con un DNI que matchea devuelve a Juan y `esOtraPersona` compara DNI contra DNI —da
    // false y pasa—. El 409 de adentro de la transacción sólo atrapaba el caso sin DNI propio.
    //
    // Por eso el arreglo terminó siendo UN chequeo antes de la bifurcación, y no un parche en
    // la rama que la auditoría había señalado.
    const r = await alta(`${P}prop1`, EMAIL_MARIELA);
    expect(r.statusCode).toBe(409);
    expect((r.json() as { message: string }).message).toContain('ya lo usa otra persona');
  });

  it('reusando a Juan CON SU PROPIO email sí se puede: el alta normal no se rompe', async () => {
    // El control positivo, y el que le da sentido al guard: reusar una Persona es una función
    // del producto (multi-alquiler), no algo a bloquear.
    const r = await alta(`${P}prop1`, EMAIL_JUAN, { personaId: personaJuan });
    expect(r.statusCode, r.body.slice(0, 250)).toBe(200);
    expect(await prisma.contrato.count({ where: { propiedadId: `${P}prop1` } })).toBe(1);
  });

  it('y un alta normal con un email libre tampoco se toca', async () => {
    // El otro control positivo: sin reuso y con un email que no es de nadie, el alta pasa.
    const r = await alta(`${P}prop3`, 'acpe.libre@example.com');
    expect(r.statusCode, r.body.slice(0, 250)).toBe(200);
  });

  it('y reusando a Juan SIN email tampoco molesta', async () => {
    // El wizard promete "sin email podés cargar el contrato igual". El guard sólo mira si el
    // email VINO y es de otro; sin email no hay nada que proteger.
    const r = await alta(`${P}prop2`, '', { personaId: personaJuan });
    expect(r.statusCode, r.body.slice(0, 250)).toBe(200);
  });
});
