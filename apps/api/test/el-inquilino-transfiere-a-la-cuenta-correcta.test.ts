/**
 * C3 · Los datos para transferir, que Camila pidió y nadie puede demostrar que funcionan.
 *
 * «me gustaría que los datos para transferir… sería bueno que digan los datos directamente»
 * (Camila, 03/08 `[11:31]`). Está implementado —`GET /mi-contrato` arma `datosCobranza` y el
 * checkout lo renderiza con botón de copiar— pero el pedido nunca llegó a ser una ficha, así que
 * **no tiene criterio de aceptación ni un solo caso**. Si mañana alguien rompe ese camino, ningún
 * control lo agarra.
 *
 * Y no es un camino cualquiera: es a qué cuenta bancaria le transfiere el inquilino. La única
 * cobertura que existía es de otra tarea (`baja-contrato.test.ts`: un contrato no ACTIVO no
 * expone CBU). Lo que decide el destino de la plata no estaba medido.
 *
 * EL CASO QUE MÁS DUELE ES EL SEGUNDO. En `PROPIETARIO_DIRECTO`, si la cuenta del dueño no está
 * cargada, la respuesta tiene que ser **null** —la PWA dice «pedile los datos a la
 * inmobiliaria»—. Antes caía en silencio a la cuenta de la INMOBILIARIA, y el inquilino
 * transfería el alquiler a la cuenta equivocada: plata del dueño varada en el banco de la inmo,
 * sin circuito de rendición que la saque de ahí (los `PROPIETARIO_DIRECTO` están excluidos).
 *
 * Todo se monta sobre datos PROPIOS. No se toca el contrato de la demo: cambiarle el
 * `modoCobranza` y restaurarlo funciona hasta que una corrida se interrumpe, y entonces el
 * inquilino demo queda con la cobranza dada vuelta para todos los archivos que vienen después.
 *
 * NECESITA BASE: lo corre el job `integracion` de la CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
const prisma = new PrismaClient();

const P = 'ZZ-cbu-';
let inmobiliariaId = '';
let contratoId = '';
let propietarioId = '';
let token = '';

interface MiContrato {
  datosCobranza: {
    modo: 'PROPIETARIO_DIRECTO' | 'INMOBILIARIA';
    titular: string;
    cuit: string;
    banco: string | null;
    cbu: string;
    alias: string;
  } | null;
}

beforeAll(async () => {
  const p = new PrismaClient();
  await seedBase(p);
  await p.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  inmobiliariaId = (
    await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' }, select: { inmobiliariaId: true } })
  ).inmobiliariaId;
  await limpiar();

  propietarioId = (
    await prisma.propietario.create({
      data: {
        id: `${P}duenio`,
        inmobiliariaId,
        nombre: 'Dueño',
        apellido: 'Cobra Directo',
        cuit: '20-40000002-1',
        telefono: '11 0000-0003',
        email: 'zz.cbu.duenio@example.invalid',
      },
    })
  ).id;
  const propiedad = await prisma.propiedad.create({
    data: {
      id: `${P}prop`,
      inmobiliariaId,
      direccion: `${P}Calle del CBU 100`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      estado: 'ALQUILADA',
    },
  });
  await prisma.participacionPropietario.create({
    data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId, porcentaje: 100 },
  });
  contratoId = (
    await prisma.contrato.create({
      data: {
        id: `${P}cnt`,
        inmobiliariaId,
        propiedadId: propiedad.id,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2028-01-01'),
        diaPago: 10,
        monto: 250_000,
        moneda: 'ARS',
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        estado: 'ACTIVO',
        modoCobranza: 'INMOBILIARIA',
      },
    })
  ).id;
  const inquilino = await prisma.inquilino.create({
    data: {
      id: `${P}inq`,
      inmobiliariaId,
      contratoId,
      nombre: 'Inquilino',
      apellido: 'Del CBU',
      email: 'zz.cbu.inquilino@example.invalid',
    },
  });
  token = app.jwt.sign(
    { kind: 'inquilino', inquilinoId: inquilino.id, inmobiliariaId, contratoId },
    { expiresIn: '1d' },
  );
}, 420_000);

afterAll(async () => {
  await limpiar();
  await app.close();
  await prisma.$disconnect();
});

async function limpiar(): Promise<void> {
  await prisma.inquilino.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.contrato.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { startsWith: P } } });
  await prisma.propiedad.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.cuentaCobranzaDirecta.deleteMany({ where: { propietarioId: { startsWith: P } } });
  await prisma.propietario.deleteMany({ where: { id: { startsWith: P } } });
}

const miContrato = async (): Promise<MiContrato> => {
  const r = await app.inject({
    method: 'GET',
    url: '/mi-contrato',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
  return r.json() as MiContrato;
};

const cobranza = (modo: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO') =>
  prisma.contrato.update({
    where: { id: contratoId },
    data: {
      modoCobranza: modo,
      cobraDirectoPropietarioId: modo === 'PROPIETARIO_DIRECTO' ? propietarioId : null,
    },
  });

describe('el inquilino ve los datos para transferir, y son los de la cuenta correcta', () => {
  it('CONTROL POSITIVO — con cobranza de la INMOBILIARIA vienen los datos de la inmobiliaria', async () => {
    await cobranza('INMOBILIARIA');
    const { datosCobranza } = await miContrato();
    expect(datosCobranza, 'el seed tiene que traer una sociedad principal con cuenta cargada').toBeTruthy();
    expect(datosCobranza!.modo).toBe('INMOBILIARIA');
    // Lo que Camila pidió, textual: que digan los datos. Un CBU vacío es lo mismo que no tenerlos.
    expect(datosCobranza!.cbu.length).toBeGreaterThan(0);
    expect(datosCobranza!.titular.length).toBeGreaterThan(0);
  });

  it('🔴 con PROPIETARIO_DIRECTO y la cuenta del dueño cargada, vienen los datos DEL DUEÑO', async () => {
    await prisma.cuentaCobranzaDirecta.create({
      data: {
        propietarioId,
        inmobiliariaId,
        banco: 'Banco del Dueño',
        titular: 'Dueño Cobra Directo',
        cbu: '0000000000000000000001',
        alias: 'duenio.cobra.directo',
        cuit: '20-40000002-1',
      },
    });
    await cobranza('PROPIETARIO_DIRECTO');
    const { datosCobranza } = await miContrato();
    expect(datosCobranza).toBeTruthy();
    expect(datosCobranza!.modo).toBe('PROPIETARIO_DIRECTO');
    // Si acá saliera la cuenta de la inmobiliaria, el inquilino le transfiere el alquiler a
    // quien no lo tiene que cobrar. Se afirma el CBU exacto, no sólo el `modo`: el modo puede
    // decir una cosa y los números ser otros.
    expect(datosCobranza!.cbu).toBe('0000000000000000000001');
    expect(datosCobranza!.titular).toBe('Dueño Cobra Directo');
  });

  it('🔴 y SIN la cuenta del dueño no cae a la de la inmobiliaria: devuelve null', async () => {
    // El bug que el comentario del handler documenta. La PWA con `null` dice «pedile los datos a
    // la inmobiliaria», que es incómodo y correcto. Con el fallback silencioso, la plata del
    // dueño quedaba varada en el banco de la inmo, y sin circuito de rendición que la saque:
    // los contratos PROPIETARIO_DIRECTO están excluidos de la rendición.
    await prisma.cuentaCobranzaDirecta.deleteMany({ where: { propietarioId } });
    await cobranza('PROPIETARIO_DIRECTO');
    const { datosCobranza } = await miContrato();
    expect(datosCobranza).toBeNull();
  });

  it('🔴 una cuenta a medias tampoco se sirve: sin titular no hay a quién transferirle', async () => {
    // Un CBU sin titular es peor que nada: el inquilino copia el número y transfiere a ciegas,
    // y si se equivocó de contrato no tiene con qué darse cuenta.
    await cobranza('INMOBILIARIA');
    const sociedad = await prisma.sociedad.findFirstOrThrow({
      where: { inmobiliariaId, esPrincipal: true, activa: true },
      select: { id: true, cuentaCobranza: true },
    });
    const original = sociedad.cuentaCobranza;
    await prisma.sociedad.update({
      where: { id: sociedad.id },
      data: { cuentaCobranza: { banco: 'Banco Sin Titular', cbu: '0000000000000000000009' } },
    });
    try {
      expect((await miContrato()).datosCobranza).toBeNull();
    } finally {
      // Se restaura SIEMPRE: esta fila es del seed y la comparten los archivos que corren
      // después. Un `finally` y no una línea al final del caso, porque si el expect falla la
      // línea de abajo no corre y el rojo aparece dos archivos más adelante.
      await prisma.sociedad.update({ where: { id: sociedad.id }, data: { cuentaCobranza: original ?? undefined } });
    }
  });
});
