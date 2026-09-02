/**
 * TERCERA AUDITORÍA · Una garantía sin póliza se rotulaba «Vigente».
 *
 * El badge del expediente de la propiedad se renderizaba con `{g.vigenciaHasta && …}` y se
 * rotulaba con un ternario de TRES ramas: VENCIDA, POR_VENCER, y todo lo demás → «Vigente».
 * Pero `estadoPoliza` tiene CUATRO valores: `propiedad-seguros.ts` sólo lo calcula
 * `if (esPoliza && vigenciaHasta)`, así que para una garantía PROPIETARIA o SUELDO queda
 * `null` — y el null caía en el `else`.
 *
 * La asimetría interna delataba el descuido: `estadoPolizaColor` ya trataba el null distinto
 * de 'VIGENTE' (gris vs. verde). El color modelaba cuatro estados; el texto, tres.
 *
 * LA RAÍZ NO ERA EL RÓTULO. El schema declara la invariante —«Montos/vigencia son de una
 * PÓLIZA (caución/digital): opcionales para un garante persona (propietaria/sueldo), que NO
 * TIENE cobertura ni vencimiento»— y el body del endpoint aceptaba los tres campos para los
 * cuatro tipos, sin un solo `refine`. Mientras eso siga así, cualquier import, seed o cliente
 * de API produce el mismo rótulo mentiroso sin pasar por el formulario, y cualquier pantalla
 * nueva que lea el campo hereda la mentira.
 *
 * El caso real es un RESIDUO: se carga una CAUCION con vigencia, se corrige el tipo a
 * PROPIETARIA, y el formulario esconde los campos de póliza sin limpiarlos.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): sacando los `esPolizaTipo(...)` de
 * `garanteData`, los dos primeros casos fallan y la garantía persona vuelve a guardarse con
 * vigencia y cobertura.
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
let contratoId = '';
let inmobiliariaId = '';
let propiedadId = '';

const auth = () => ({ authorization: `Bearer ${token}` });
const VIGENCIA = '2026-03-01';

const crear = (tipo: 'PROPIETARIA' | 'CAUCION' | 'SUELDO' | 'DIGITAL') =>
  app.inject({
    method: 'POST',
    url: `/contratos/${contratoId}/garantes`,
    headers: auth(),
    payload: {
      tipo,
      nombreProveedor: `Garante ${tipo} (tercera auditoría)`,
      contactoTelefono: '11 5555 5555',
      // El residuo: los tres campos de póliza viajan siempre, como los manda el formulario
      // cuando el operador cambió el tipo después de completarlos.
      numeroPoliza: 'POL-9999',
      montoCobertura: 1_000_000,
      vigenciaHasta: VIGENCIA,
    },
  });

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  token = await loginTest(app, 'roberto@delsol.com', 'delsol123');
  const prop = await prisma.propiedad.findFirstOrThrow({ select: { id: true, inmobiliariaId: true } });
  propiedadId = prop.id;
  inmobiliariaId = prop.inmobiliariaId;
  // Contrato PROPIO en BORRADOR: es el estado en el que se cargan los garantes.
  const c = await prisma.contrato.create({
    data: {
      inmobiliariaId,
      propiedadId,
      monto: 300_000,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2027-12-31'),
      diaPago: 10,
      indiceAjuste: 'ICL',
      frecuenciaAjusteMeses: 6,
      estado: 'BORRADOR',
    },
  });
  contratoId = c.id;
});

afterAll(async () => {
  if (contratoId) {
    // Sin `.catch(() => {})`: una FK que bloquea el borrado tiene que gritar acá.
    await prisma.garante.deleteMany({ where: { contratoId } });
    await prisma.contrato.deleteMany({ where: { id: contratoId } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

describe('una garantía persona no tiene póliza', () => {
  it('un garante PROPIETARIA se guarda SIN vigencia ni cobertura, aunque se manden', async () => {
    const r = await crear('PROPIETARIA');
    expect(r.statusCode).toBe(200);
    const g = await prisma.garante.findFirstOrThrow({ where: { contratoId, tipo: 'PROPIETARIA' } });
    // Con el bug: vigenciaHasta 2026-03-01 y una fila que después se rotula «Vigente».
    expect(g.vigenciaHasta).toBeNull();
    expect(g.montoCobertura).toBeNull();
    expect(g.numeroPoliza).toBeNull();
  });

  it('y un garante SUELDO tampoco', async () => {
    const r = await crear('SUELDO');
    expect(r.statusCode).toBe(200);
    const g = await prisma.garante.findFirstOrThrow({ where: { contratoId, tipo: 'SUELDO' } });
    expect(g.vigenciaHasta).toBeNull();
  });

  it('CONTROL POSITIVO — una CAUCIÓN sí conserva su póliza', async () => {
    const r = await crear('CAUCION');
    expect(r.statusCode).toBe(200);
    const g = await prisma.garante.findFirstOrThrow({ where: { contratoId, tipo: 'CAUCION' } });
    expect(g.vigenciaHasta).not.toBeNull();
    expect(g.numeroPoliza).toBe('POL-9999');
    expect(Number(g.montoCobertura)).toBe(1_000_000);
  });

  it('y editar una caución a PROPIETARIA le saca la póliza que ya tenía', async () => {
    // El residuo real, por el camino real: la fila EXISTE con vigencia y se corrige el tipo.
    const g = await prisma.garante.findFirstOrThrow({ where: { contratoId, tipo: 'CAUCION' } });
    const r = await app.inject({
      method: 'PUT',
      url: `/contratos/${contratoId}/garantes/${g.id}`,
      headers: auth(),
      payload: {
        tipo: 'PROPIETARIA',
        nombreProveedor: 'Corregido a persona',
        contactoTelefono: '11 5555 5555',
        vigenciaHasta: VIGENCIA,
      },
    });
    expect(r.statusCode).toBe(200);
    const despues = await prisma.garante.findUniqueOrThrow({ where: { id: g.id } });
    // Con el bug: la fila quedaba PROPIETARIA CON vigencia — el estado exacto que el
    // expediente rotulaba «Vigente · vence 01/03/2026».
    expect(despues.vigenciaHasta).toBeNull();
    expect(despues.numeroPoliza).toBeNull();
  });

  it('el expediente no puede rotular lo que no tiene estado', async () => {
    // `estadoPoliza` es null salvo póliza CON vigencia; el badge ahora se gatea por ese campo
    // y no por `vigenciaHasta`. Sin filas mentirosas en la base, no hay null que rotular.
    const r = await app.inject({ method: 'GET', url: `/propiedades/${propiedadId}/seguros`, headers: auth() });
    expect(r.statusCode).toBe(200);
    // Acotado a las garantías de MI contrato: esta base la comparten 140 archivos y un
    // aserto global acá se rompería por lo que deje otro, no por este defecto.
    const conVigenciaSinEstado = (
      r.json().garantias as { contratoId: string; estadoPoliza: string | null; vigenciaHasta: string | null }[]
    ).filter((g) => g.contratoId === contratoId && g.vigenciaHasta && !g.estadoPoliza);
    expect(conVigenciaSinEstado).toEqual([]);
  });
});
