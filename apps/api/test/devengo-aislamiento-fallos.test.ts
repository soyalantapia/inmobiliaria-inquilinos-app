/**
 * `devengarTodosLosTenants` — que un contrato roto NO deje sin facturar a los demás.
 *
 * POR QUÉ IMPORTA MÁS QUE CUALQUIER OTRO TEST DE ESTE REPO. Este barrido es GLOBAL: recorre
 * los contratos ACTIVO de **todas** las inmobiliarias y lo dispara el cron cada 6 horas. Ya
 * pasó una vez: un contrato con datos raros tiraba la función entera, los contratos siguientes
 * se quedaban sin devengar y —peor— el barrido de vencidos nunca corría, para todos los
 * clientes. Un dato malo de una inmobiliaria dejaba sin facturar a las otras.
 *
 * Lo único que lo evita hoy es el try/catch por contrato, y **ningún test lo ejercitaba**. Si
 * alguien lo "simplifica", el mes no se factura para nadie y se entera la clienta, no el CI.
 *
 * ES UN TEST PURO. No hay Postgres: se le pasa un cliente Prisma falso, de objetos planos, que
 * puede fallar exactamente donde queremos. La orquestación —el orden, el aislamiento, qué se
 * acumula y qué se reporta— es lógica, no base de datos, así que se puede fijar sin una.
 */
import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { devengarTodosLosTenants } from '../src/lib/liquidaciones.js';

interface OpcionesFake {
  /** Contratos que devuelve `contrato.findMany`. */
  contratos: { id: string; inmobiliariaId: string }[];
  /** Ids que hacen explotar el devengo de ESE contrato. */
  explotan?: string[];
  /** Si true, el barrido de vencidos falla. */
  vencidosExplota?: boolean;
}

/**
 * Cliente Prisma falso, mínimo: sólo lo que toca este camino.
 *
 * Devuelve además `creados`, para poder afirmar QUIÉNES llegaron a facturarse — que es la
 * mitad que importa: que no explote no alcanza, los otros contratos tienen que haberse
 * devengado de verdad.
 */
function prismaFalso(o: OpcionesFake) {
  const creados: string[] = [];
  const explotan = new Set(o.explotan ?? []);
  let vencidosCorrio = false;

  const contratoDeLaTx = { id: '' };

  const tx = {
    // `devengarSiSigueActivo` re-lee el estado con FOR UPDATE antes de devengar:
    // tx.$queryRaw`SELECT estado FROM contratos WHERE id = ${contrato.id} FOR UPDATE`.
    // Como es un template tag, el id llega como PRIMER VALOR interpolado — de ahí sabemos
    // qué contrato se está procesando. Y es el primer punto adentro de la transacción, así
    // que es el lugar natural para inyectar la falla.
    $queryRaw: async (_strings: TemplateStringsArray, contratoId: string) => {
      contratoDeLaTx.id = contratoId;
      if (explotan.has(contratoId)) {
        throw new Error(`datos rotos en ${contratoId}`);
      }
      return [{ estado: 'ACTIVO' }];
    },
    ajusteAlquiler: { findMany: async () => [] },
    renovacionContrato: { findMany: async () => [] },
    liquidacion: {
      createMany: async ({ data }: { data: unknown[] }) => {
        creados.push(contratoDeLaTx.id);
        return { count: data.length };
      },
      updateMany: async () => {
        vencidosCorrio = true;
        if (o.vencidosExplota) throw new Error('se cayó el barrido de vencidos');
        return { count: 7 };
      },
    },
  };

  const prisma = {
    contrato: {
      findMany: async () =>
        o.contratos.map((c) => ({
          ...c,
          monto: 500000,
          montoExpensas: 0,
          moneda: 'ARS',
          // Arranca hace unos meses para que haya algo que devengar.
          fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
          devengarDesde: null,
          tipoContrato: 'ESTANDAR',
          fechaFin: new Date('2027-05-01T00:00:00.000Z'),
          diaPago: 10,
        })),
    },
    liquidacion: tx.liquidacion,
    $transaction: async (fn: (t: typeof tx) => Promise<number>) => fn(tx),
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    creados,
    vencidosCorrio: () => vencidosCorrio,
  };
}

const TRES = [
  { id: 'c1', inmobiliariaId: 'inmo-A' },
  { id: 'c2', inmobiliariaId: 'inmo-B' },
  { id: 'c3', inmobiliariaId: 'inmo-A' },
];

describe('el devengo global aísla los fallos por contrato', () => {
  it('un contrato roto NO frena a los demás, ni siquiera de otra inmobiliaria', async () => {
    // EL CASO QUE YA PASÓ. c2 es de otra inmobiliaria que c1 y c3 a propósito: lo que se fija
    // acá es que el dato malo de un cliente no le cuesta la facturación a otro.
    const f = prismaFalso({ contratos: TRES, explotan: ['c2'] });
    const r = await devengarTodosLosTenants(f.prisma);

    expect(f.creados).toEqual(['c1', 'c3']);
    expect(r.contratosProcesados).toBe(3);
  });

  it('el contrato que falló se REPORTA, no se traga en silencio', async () => {
    // Un devengo que se comió errores calladito es indistinguible de uno que anduvo bien. Si
    // `fallidos` se vaciara, nadie se entera de que un contrato lleva meses sin facturar.
    const f = prismaFalso({ contratos: TRES, explotan: ['c2'] });
    const r = await devengarTodosLosTenants(f.prisma);

    expect(r.fallidos).toHaveLength(1);
    expect(r.fallidos[0]!.contratoId).toBe('c2');
    expect(r.fallidos[0]!.error).toContain('datos rotos');
  });

  it('el barrido de VENCIDOS corre igual aunque un contrato haya fallado', async () => {
    // Es la mitad que más dolió: marcar la mora no depende de haber devengado bien, y
    // saltearlo deja morosos invisibles para la cobranza de TODOS los tenants.
    const f = prismaFalso({ contratos: TRES, explotan: ['c1', 'c2', 'c3'] });
    const r = await devengarTodosLosTenants(f.prisma);

    expect(f.vencidosCorrio()).toBe(true);
    expect(r.liquidacionesVencidas).toBe(7);
    expect(r.fallidos).toHaveLength(3);
  });

  it('si se cae el barrido de vencidos, se reporta y no tumba el devengo', async () => {
    const f = prismaFalso({ contratos: TRES, vencidosExplota: true });
    const r = await devengarTodosLosTenants(f.prisma);

    // Los tres se devengaron igual.
    expect(f.creados).toEqual(['c1', 'c2', 'c3']);
    expect(r.liquidacionesVencidas).toBe(0);
    expect(r.fallidos.map((x) => x.contratoId)).toContain('(barrido de vencidos)');
  });

  it('sin contratos rotos no reporta fallidos', async () => {
    // El caso normal. Sirve de control: si `fallidos` trajera ruido siempre, los tests de
    // arriba pasarían por el motivo equivocado.
    const f = prismaFalso({ contratos: TRES });
    const r = await devengarTodosLosTenants(f.prisma);

    expect(r.fallidos).toEqual([]);
    expect(f.creados).toEqual(['c1', 'c2', 'c3']);
  });
});
