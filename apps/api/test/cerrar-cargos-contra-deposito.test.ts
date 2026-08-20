/**
 * T-66 · Los cargos cobrados contra el depósito quedaban abiertos para siempre.
 *
 * Cuando el depósito se resuelve, la plata ya se retuvo: los `CargoContrato` con
 * `contraDeposito` dejan de estar pendientes. `POST /contratos/:id/deposito/resolver` los
 * cerraba; `POST /contratos/:id/finalizar` —que TAMBIÉN resuelve el depósito— no.
 *
 * Quedaban `saldadoAt: null` e **insaldables por los cuatro caminos**: invisibles en
 * `/depositos/en-custodia` (filtra RETENIDO), rechazados por `/cargos/:id/saldar`, excluidos de
 * saldar-deuda, y fuera del alcance de `deposito/resolver` (409 si el depósito ya no está
 * RETENIDO). Deuda fantasma sin forma de bajarla.
 *
 * El filtro del `updateMany` es la parte delicada y es lo que fija este test: cerrar de más
 * saldaría cargos que el inquilino todavía debe en efectivo.
 *
 * Test puro: el `tx` es un doble.
 */
import { describe, it, expect } from 'vitest';
import { cerrarCargosContraDeposito } from '../src/lib/deposito.js';

function txEspia(count = 2) {
  const visto: { args?: { where: Record<string, unknown>; data: Record<string, unknown> } } = {};
  const tx = {
    cargoContrato: {
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        visto.args = a;
        return { count };
      },
    },
  } as never;
  return { tx, visto };
}

const ARGS = { contratoId: 'cnt_1', inmobiliariaId: 'inm_1', usuarioId: 'usr_1' };

describe('T-66 — a qué cargos alcanza el cierre', () => {
  it('sólo los del depósito: un cargo normal al inquilino no se toca', async () => {
    const { tx, visto } = txEspia();
    await cerrarCargosContraDeposito(tx, ARGS);
    // Sin este filtro se saldaría deuda que el inquilino todavía tiene que pagar en efectivo.
    expect(visto.args?.where.contraDeposito).toBe(true);
  });

  it('sólo los que siguen abiertos: no repisa la fecha de uno ya saldado', async () => {
    const { tx, visto } = txEspia();
    await cerrarCargosContraDeposito(tx, ARGS);
    // Repisar `saldadoAt` movería la fecha de un cobro real y rompería la idempotencia:
    // finalizar y resolver pueden correr los dos sobre el mismo contrato.
    expect(visto.args?.where.saldadoAt).toBeNull();
  });

  it('scopeado por contrato Y por inmobiliaria', async () => {
    const { tx, visto } = txEspia();
    await cerrarCargosContraDeposito(tx, ARGS);
    expect(visto.args?.where.contratoId).toBe('cnt_1');
    expect(visto.args?.where.inmobiliariaId).toBe('inm_1');
  });

  it('deja constancia de quién lo cerró', async () => {
    const { tx, visto } = txEspia();
    await cerrarCargosContraDeposito(tx, ARGS);
    expect(visto.args?.data.saldadoPorId).toBe('usr_1');
    expect(visto.args?.data.saldadoAt).toBeInstanceOf(Date);
  });

  it('devuelve cuántos cerró', async () => {
    const { tx } = txEspia(3);
    await expect(cerrarCargosContraDeposito(tx, ARGS)).resolves.toBe(3);
  });

  it('es idempotente: la segunda pasada no encuentra nada', async () => {
    const { tx } = txEspia(0);
    await expect(cerrarCargosContraDeposito(tx, ARGS)).resolves.toBe(0);
  });
});
