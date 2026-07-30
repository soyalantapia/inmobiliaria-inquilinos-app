import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedBase } from '../prisma/seed.js';
import { devengarTodosLosTenants } from '../src/lib/liquidaciones.js';

/**
 * CAZABUG — el devengo global resucitaba contratos finalizados a mitad de corrida.
 *
 * `devengarTodosLosTenants` empieza con un `findMany({ estado: 'ACTIVO' })` y
 * DESPUÉS itera contrato por contrato contra la DB remota: con carteras grandes
 * ese loop dura minutos. Si en el medio alguien finaliza uno de los contratos del
 * snapshot, el cron le seguía creando liquidaciones — y como finalizar ya había
 * anulado las cuotas futuras impagas, el cron las volvía a crear: deuda fantasma
 * a nombre de un inquilino que se fue, que además pasa a VENCIDO y devenga mora.
 *
 * La carrera se provoca de forma DETERMINÍSTICA con una extensión de Prisma que
 * finaliza el contrato justo después de que el snapshot volvió y antes de que el
 * loop lo procese. `devengarTodosLosTenants` corre sin modificar: lo que se
 * ejercita es el cableado real, no una función pura.
 *
 * (Finalizar el contrato ANTES de llamar al devengo NO reproduce nada: el
 * findMany ya no lo traería y el test daría verde con el bug intacto.)
 */

let prisma: PrismaClient;
const CID = 'cnt_003';
let estadoOriginal: string;

/** Deja el contrato ACTIVO, vigente y sin cuotas futuras impagas (lo que ve el cron). */
async function prepararEscenario() {
  await prisma.contrato.update({
    where: { id: CID },
    data: {
      estado: 'ACTIVO',
      fechaInicio: new Date('2026-01-01T00:00:00Z'),
      fechaFin: new Date('2028-01-01T00:00:00Z'),
      devengarDesde: null,
    },
  });
  await prisma.liquidacion.deleteMany({ where: { contratoId: CID, pagos: { none: {} } } });
  return prisma.liquidacion.count({ where: { contratoId: CID } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  const c = await prisma.contrato.findUniqueOrThrow({ where: { id: CID }, select: { estado: true } });
  estadoOriginal = c.estado;
}, 420_000);

afterAll(async () => {
  await prisma.contrato.updateMany({ where: { id: CID }, data: { estado: estadoOriginal as never } });
  await prisma.$disconnect();
});

describe('devengo global vs contrato que se finaliza en el medio', () => {
  it('control: con el contrato ACTIVO de punta a punta, el devengo SÍ le crea cuotas', async () => {
    const antes = await prepararEscenario();
    const r = await devengarTodosLosTenants(prisma);
    expect(r.fallidos).toEqual([]);
    const despues = await prisma.liquidacion.count({ where: { contratoId: CID } });
    // Si esto no crece, el escenario no tenía nada para devengar y el test de
    // abajo sería verde por la razón equivocada.
    expect(despues).toBeGreaterThan(antes);
  });

  it('si se finaliza DESPUÉS del snapshot, no le nace ni una cuota más', async () => {
    const antes = await prepararEscenario();

    let finalizado = false;
    const conCarrera = prisma.$extends({
      query: {
        contrato: {
          async findMany({ args, query }) {
            const res = await query(args);
            // La carrera: el snapshot ya salió con el contrato ACTIVO y recién
            // ahora el operador lo finaliza desde el panel.
            if (!finalizado) {
              finalizado = true;
              await prisma.contrato.update({ where: { id: CID }, data: { estado: 'FINALIZADO' } });
            }
            return res;
          },
        },
      },
    }) as unknown as PrismaClient;

    await devengarTodosLosTenants(conCarrera);

    expect(finalizado).toBe(true); // la carrera se disparó de verdad
    const despues = await prisma.liquidacion.count({ where: { contratoId: CID } });
    expect(despues).toBe(antes);
  });
});
