/**
 * T-11 · Un rol CARGA no puede cambiar el email del inquilino, que es su acceso a la app.
 *
 * DE DÓNDE SALIÓ. Del relevamiento que pedía T-11 —"¿qué se puede editar hoy de un contrato que
 * ya tiene pagos, y quién puede?"—. Al ponerlo en una tabla apareció una asimetría: los cuatro
 * endpoints de edición vecinos (monto, expensas, modo de cobranza y mora) cortan a CARGA, y
 * `inquilino-contacto` no. Y ese es justo el que escribe la credencial.
 *
 * POR QUÉ IMPORTA. `contratos.crear` incluye a CARGA con `rolesAprobacion: ['CARGA']`: lo que ese
 * rol carga espera aprobación. Pero este endpoint no es un alta, escribe directo. Y el email del
 * inquilino no es un dato de contacto: **el OTP viaja ahí**. Un rol de "carga para aprobación"
 * podía reapuntar el acceso a la app de cualquier inquilino, sin aprobación y sin rastro.
 *
 * EL GEMELO YA ESTABA CERRADO DEL OTRO LADO. En `propietarios` se gatearon por rol el `email`
 * —la credencial del portal— y el `cbuAlias`, porque CARGA podía redirigir la plata. Acá faltaba
 * el espejo.
 *
 * Y EL DETALLE QUE LO EXPLICA: el docblock del endpoint seguía diciendo *"scope: solo teléfono
 * (el email no se toca acá)"* y *"sin auditoría: cambiar el teléfono no rerutea plata"*. Las dos
 * dejaron de ser ciertas cuando T-45 agregó el email — y la justificación que autorizaba a no
 * tener corte de rol se quedó escrita igual.
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
let tokenCarga = '';
let tokenAdmin = '';
let contratoId = '';
let inquilinoId = '';
let emailOriginal: string | null = null;
let telefonoOriginal: string | null = null;

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const contacto = (token: string, payload: Record<string, unknown>) =>
  app.inject({
    method: 'PATCH',
    url: `/contratos/${contratoId}/inquilino-contacto`,
    headers: auth(token),
    payload,
  });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  tokenAdmin = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  // `camila@delsol.com` es el usuario CARGA del seed.
  tokenCarga = await loginTest(app, 'camila@delsol.com', 'delsol123');

  // El titular cuelga del INQUILINO (`Inquilino.contratoId`), no al revés: el contrato lo expone
  // como back-relation. Se busca desde ese lado.
  const inq = await prisma.inquilino.findFirstOrThrow({
    where: { contratoId: { not: null } },
    orderBy: { id: 'asc' },
  });
  inquilinoId = inq.id;
  contratoId = inq.contratoId!;
  emailOriginal = inq.email;
  telefonoOriginal = inq.telefono;
});

afterAll(async () => {
  if (inquilinoId) {
    await prisma.inquilino
      .update({ where: { id: inquilinoId }, data: { email: emailOriginal, telefono: telefonoOriginal } })
      .catch(() => {});
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-11 — quién puede cambiar el contacto del inquilino', () => {
  it('el escenario se armó: hay un CARGA y un ADMIN', () => {
    expect(tokenCarga).not.toBe('');
    expect(tokenAdmin).not.toBe('');
    expect(inquilinoId).not.toBe('');
  });

  it('CARGA sí puede corregir el teléfono — es para lo que existe el endpoint', async () => {
    const r = await contacto(tokenCarga, { telefono: '+54 9 11 4000 1234' });
    expect(r.statusCode).toBe(200);
    expect((await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } })).telefono).toBe(
      '+54 9 11 4000 1234',
    );
  });

  it('🔴 CARGA NO puede cambiar el email: es el acceso del inquilino a la app', async () => {
    const antes = (await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } })).email;
    const r = await contacto(tokenCarga, { email: 'reapuntado.por.carga@example.com' });
    expect(r.statusCode).toBe(403);
    // Y no escribió nada: un 403 que igual persiste sería peor que no tener el guard.
    expect((await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } })).email).toBe(antes);
  });

  it('CARGA tampoco lo cuela mandando el email JUNTO con el teléfono', async () => {
    // El corte mira si el email VINO, no si vino solo. Sin eso, alcanzaba con adjuntarle un
    // teléfono para pasar por al lado del guard.
    const antes = (await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } })).email;
    const r = await contacto(tokenCarga, { telefono: '+54 9 11 4000 9999', email: 'colado@example.com' });
    expect(r.statusCode).toBe(403);
    expect((await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } })).email).toBe(antes);
  });

  it('ADMIN sí puede: el endpoint sigue sirviendo para lo que T-45 lo agregó', async () => {
    // El control positivo. Si el guard se pasara de rosca y bloqueara a todos, se rompería la
    // promesa del alta —"sin email podés cargar el contrato igual, se lo agregás después"— que es
    // exactamente la rescisión falsa de la que se queja Camila.
    const r = await contacto(tokenAdmin, { email: 'corregido.por.admin@example.com' });
    expect(r.statusCode).toBe(200);
    expect((await prisma.inquilino.findUniqueOrThrow({ where: { id: inquilinoId } })).email).toBe(
      'corregido.por.admin@example.com',
    );
  });
});
