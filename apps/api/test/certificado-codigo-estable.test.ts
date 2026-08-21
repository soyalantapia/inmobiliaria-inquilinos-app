/**
 * T-71 · El código del certificado tiene que ser ALEATORIO y a la vez ESTABLE.
 *
 * Son dos exigencias que tiran para lados opuestos y por eso el cambio no es de una línea:
 *  · Aleatorio, porque antes se derivaba de `DNI | contratoId | nombreInmobiliaria` y cualquiera
 *    lo reproducía.
 *  · Estable, porque se IMPRIME y se comparte: si cambiara en cada visita a /certificado, el
 *    papel que el inquilino le dio a una inmobiliaria dejaría de servir al día siguiente.
 *
 * Lo que las concilia: el código se genera UNA vez y después se conserva. El upsert pasó a ir
 * por `(inquilinoId, contratoId)` en vez de por `hash` —con un código aleatorio, buscar por hash
 * no encontraría nunca la fila previa y cada visita crearía una fila nueva, dejando la anterior
 * huérfana con PII adentro— y el handler LEE el código existente antes de inventar uno.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let prisma: PrismaClient;
let token = '';

const pedir = () => app.inject({ method: 'GET', url: '/certificado', headers: { authorization: `Bearer ${token}` } });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = (await app.inject({ method: 'POST', url: '/auth/demo' })).json().token;
});

afterAll(async () => {
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('T-71 — aleatorio pero estable', () => {
  it('el primer pedido devuelve un código con el formato impreso', async () => {
    const r = await pedir();
    expect(r.statusCode).toBe(200);
    expect(r.json().hash).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('pedirlo DE NUEVO devuelve el MISMO código', async () => {
    const a = (await pedir()).json().hash;
    const b = (await pedir()).json().hash;
    // Sin la lectura previa, cada visita generaría uno nuevo y el papel impreso moriría.
    expect(b).toBe(a);
  });

  it('y no se duplicó la fila: una persona tiene UN certificado por contrato', async () => {
    await pedir();
    await pedir();
    const cert = (await pedir()).json();
    const filas = await prisma.certificadoInquilino.findMany({ where: { hash: cert.hash } });
    expect(filas).toHaveLength(1);
    // La clave real es (inquilino, contrato): tampoco puede haber dos para el mismo par.
    const delPar = await prisma.certificadoInquilino.findMany({
      where: { inquilinoId: filas[0]!.inquilinoId, contratoId: filas[0]!.contratoId },
    });
    expect(delPar).toHaveLength(1);
  });

  it('la URL de verificación apunta al código GUARDADO, no a otro', async () => {
    const cert = (await pedir()).json();
    // Es el bug que aparecía al pasar a código aleatorio si se armaba la URL antes de leer:
    // la fila conservaba su código viejo y la URL apuntaba al recién inventado.
    expect(cert.urlVerificacion).toContain(cert.hash);
    const fila = await prisma.certificadoInquilino.findUniqueOrThrow({ where: { hash: cert.hash } });
    expect(fila.urlVerificacion).toContain(fila.hash);
  });

  it('el código NO se deriva del DNI: cambiarlo no lo cambia', async () => {
    const antes = (await pedir()).json().hash;
    const fila = await prisma.certificadoInquilino.findUniqueOrThrow({ where: { hash: antes } });
    const dniOriginal = (await prisma.inquilino.findUniqueOrThrow({ where: { id: fila.inquilinoId } })).dni;
    try {
      await prisma.inquilino.update({ where: { id: fila.inquilinoId }, data: { dni: '99999999' } });
      // Con la función vieja el código era hash(DNI|contrato|inmobiliaria): esto lo cambiaba.
      expect((await pedir()).json().hash).toBe(antes);
    } finally {
      await prisma.inquilino.update({ where: { id: fila.inquilinoId }, data: { dni: dniOriginal } });
    }
  });
});
