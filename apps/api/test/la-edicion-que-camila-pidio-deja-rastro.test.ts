/**
 * T-11 · Las dos ediciones que Camila pidió por nombre no dejaban autor.
 *
 * EL CRITERIO DE ACEPTACIÓN tiene tres cláusulas: «La administradora corrige el teléfono de un
 * inquilino y cambia un garante en un contrato con pagos, sin rescindir nada, **y queda
 * registrado quién lo hizo**». Las dos primeras se cumplían desde hace semanas. La tercera no,
 * y fallaba justo en esas dos operaciones.
 *
 * EL CONTRASTE ES LO QUE DA VUELTA LA LECTURA. Toda edición de contrato que toca plata deja
 * rastro —monto, expensas, mora, modo de cobranza, baja, renovación, alta—. `PATCH
 * /contratos/:id/inquilino-contacto` y el CRUD de garantes eran los dos únicos caminos sin
 * ninguno. O sea que la respuesta que estaba en producción le daba a Camila edición SIN
 * historial, que es lo contrario de lo que fue a buscar: ella se queja de que la FALTA de
 * edición le ensucia el historial con rescisiones falsas.
 *
 * Y PESA POR DOS MOTIVOS CONCRETOS:
 *
 * 1. El email del inquilino no es un dato de contacto: es su CREDENCIAL —el OTP viaja ahí—.
 *    Reapuntarlo es reapuntar el acceso a la app. Existe `PROPIETARIO_CUENTA_CAMBIADA` por
 *    exactamente este motivo del otro lado del mostrador; faltaba el gemelo.
 * 2. `Garante` no tiene baja lógica: el DELETE es borrado duro. Sin evento, de una garantía
 *    borrada no quedaba NI quién la sacó NI qué decía la póliza. El propio `core.ts` lo tenía
 *    escrito —«desaparecida la garantía, no queda rastro de quién la sacó ni de qué decía
 *    antes»— como una limitación conocida.
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
let token = '';
let inmobiliariaId = '';
let adminId = '';
const prisma = new PrismaClient();
const auth = () => ({ authorization: `Bearer ${token}` });

/** El contrato del seed con pagos: es el escenario exacto del que habla la tarea. */
const CNT = 'cnt_001';

const eventos = (tipo: string) =>
  prisma.eventoAuditoria.findMany({
    where: { inmobiliariaId, tipo: tipo as never, entidadId: CNT },
    orderBy: { fecha: 'desc' },
  });

beforeAll(async () => {
  const base = await seedBase(prisma);
  inmobiliariaId = base.inmobiliariaId;
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const admin = await prisma.usuario.findFirstOrThrow({ where: { email: 'roberto@delsol.com' } });
  adminId = admin.id;
});

afterAll(async () => {
  await prisma.eventoAuditoria.deleteMany({ where: { entidadId: CNT, autorId: adminId } });
  await app.close();
  await prisma.$disconnect();
});

describe('el contacto del inquilino deja rastro', () => {
  it('el escenario es el de la tarea: un contrato CON pagos', async () => {
    const pagos = await prisma.pago.count({ where: { contratoId: CNT } });
    expect(pagos, 'sin pagos el test no prueba lo que dice probar').toBeGreaterThan(0);
  });

  it('🔴 corregir el teléfono queda registrado, con quién y con el valor anterior', async () => {
    const antes = await prisma.contrato.findFirstOrThrow({
      where: { id: CNT },
      select: { inquilinoTitular: { select: { telefono: true } } },
    });
    // Único por corrida: `seedBase` no repone el teléfono del inquilino, así que un valor
    // fijo era igual al que ya había en la segunda corrida —no cambiaba nada, y el endpoint
    // (con razón) no registraba—. El test se ponía verde o rojo según el orden, que es la
    // peor clase de control: uno que miente en las dos direcciones.
    const nuevo = `+54 9 11 4444 ${String(Date.now()).slice(-4)}`;

    const r = await app.inject({
      method: 'PATCH',
      url: `/contratos/${CNT}/inquilino-contacto`,
      headers: auth(),
      payload: { telefono: nuevo },
    });
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);

    // Con el bug: cero eventos. La edición pasaba y no quedaba nadie.
    const evs = await eventos('INQUILINO_CONTACTO_EDITADO');
    expect(evs).toHaveLength(1);
    expect(evs[0]!.autorId).toBe(adminId);
    expect(evs[0]!.rolAutor).toBe('ADMIN');
    // Sirve para reconstruir: dice de qué a qué, no sólo que "hubo un cambio".
    expect(evs[0]!.entidadDescripcion).toContain(nuevo);
    expect(evs[0]!.entidadDescripcion).toContain(antes.inquilinoTitular!.telefono ?? '—');
  });

  it('un PATCH que no cambia nada no ensucia el rastro', async () => {
    // Un rastro lleno de filas vacías es un rastro que nadie lee.
    const actual = await prisma.contrato.findFirstOrThrow({
      where: { id: CNT },
      select: { inquilinoTitular: { select: { telefono: true } } },
    });
    const cuantos = (await eventos('INQUILINO_CONTACTO_EDITADO')).length;
    const r = await app.inject({
      method: 'PATCH',
      url: `/contratos/${CNT}/inquilino-contacto`,
      headers: auth(),
      payload: { telefono: actual.inquilinoTitular!.telefono },
    });
    expect(r.statusCode).toBe(200);
    expect(await eventos('INQUILINO_CONTACTO_EDITADO')).toHaveLength(cuantos);
  });
});

describe('la garantía deja rastro, incluso cuando se borra', () => {
  const garante = {
    tipo: 'CAUCION' as const,
    nombreProveedor: 'Aseguradora QA',
    numeroPoliza: 'POL-9977',
    contactoTelefono: '+54 9 11 3333 2222',
  };

  it('🔴 agregar, editar y borrar quedan los tres registrados', async () => {
    const alta = await app.inject({
      method: 'POST',
      url: `/contratos/${CNT}/garantes`,
      headers: auth(),
      payload: garante,
    });
    expect(alta.statusCode, alta.body.slice(0, 200)).toBe(200);
    const creado = alta.json() as { id: string };

    expect(await eventos('GARANTIA_AGREGADA')).toHaveLength(1);

    const edicion = await app.inject({
      method: 'PUT',
      url: `/contratos/${CNT}/garantes/${creado.id}`,
      headers: auth(),
      payload: { ...garante, numeroPoliza: 'POL-0001' },
    });
    expect(edicion.statusCode, edicion.body.slice(0, 200)).toBe(200);

    const editados = await eventos('GARANTIA_EDITADA');
    expect(editados).toHaveLength(1);
    // Reescribirle el número de póliza al garante de un contrato en curso no lo nota nadie:
    // por eso el evento guarda las DOS versiones.
    expect(editados[0]!.entidadDescripcion).toContain('POL-0001');
    expect(editados[0]!.detalle).toContain('POL-9977');

    const baja = await app.inject({
      method: 'DELETE',
      url: `/contratos/${CNT}/garantes/${creado.id}`,
      headers: auth(),
    });
    expect(baja.statusCode).toBe(200);

    // La fila ya no existe: `Garante` no tiene `deletedAt`. Esto es lo único que queda.
    expect(await prisma.garante.findUnique({ where: { id: creado.id } })).toBeNull();
    const borrados = await eventos('GARANTIA_ELIMINADA');
    expect(borrados).toHaveLength(1);
    expect(borrados[0]!.autorId).toBe(adminId);
    // Lo que decía la póliza sobrevive sólo acá.
    expect(borrados[0]!.entidadDescripcion).toContain('POL-0001');
    expect(borrados[0]!.entidadDescripcion).toContain('Aseguradora QA');
  });
});
