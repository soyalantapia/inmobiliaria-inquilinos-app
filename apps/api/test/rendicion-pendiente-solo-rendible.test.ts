/**
 * T-52 · Qué universo mira "cobrado y sin rendir", según quién pregunta.
 *
 * EL PROBLEMA. `POST /rendiciones` sólo rinde contratos con `modoCobranza: 'INMOBILIARIA'`
 * (plata.ts:221 y :1929). En un contrato PROPIETARIO_DIRECTO el inquilino transfiere al CBU del
 * dueño, pero conciliar el pago NO mira el modo: esos cobros quedan CONCILIADOS y, como la
 * rendición los excluye, **nunca va a existir un `AlquilerRendido` que los baje**. El número no
 * llega a cero por ningún camino.
 *
 * Eso rompía dos cosas:
 *  - el guard de `PUT /propiedades/:id/participaciones` dejaba el reparto de dueños trabado en
 *    409 permanente, aconsejando "rendíselo a los dueños de hoy" — que el sistema no puede hacer;
 *  - el portal le mostraba al dueño como "todavía sin rendirte" plata que ya tiene en su cuenta.
 *
 * LO QUE NO HAY QUE ROMPER. El guard de `PATCH /contratos/:id/modo-cobranza` necesita ver
 * JUSTAMENTE esa plata: es lo único que impide que al pasar de directo a inmobiliaria el sistema
 * le transfiera al dueño algo que ya cobró. Por eso el filtro es opt-in y no incondicional.
 *
 * Test puro: el cliente de base es un doble que sólo captura el `where`.
 */
import { describe, it, expect } from 'vitest';
import {
  alquilerCobradoSinRendir,
  alquilerCobradoSinRendirDePropiedad,
} from '../src/lib/rendicion-pendiente.js';

/** Doble mínimo: devuelve cero liquidaciones (el helper corta ahí) y guarda el `where`. */
function dbEspia() {
  const visto: { where?: Record<string, unknown> } = {};
  const db = {
    liquidacion: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        visto.where = args.where;
        return [] as never[];
      },
    },
  } as never;
  return { db, visto };
}

/** El `contrato` del where, ya tipado para poder preguntarle por el modo. */
function contratoDelWhere(visto: { where?: Record<string, unknown> }) {
  return (visto.where?.contrato ?? {}) as {
    propiedadId?: string;
    inmobiliariaId?: string;
    modoCobranza?: string;
  };
}

describe('T-52 — por propiedad: el filtro de modo es opt-in', () => {
  it('con soloRendible mira SÓLO lo que la rendición puede rendir', async () => {
    const { db, visto } = dbEspia();
    await alquilerCobradoSinRendirDePropiedad('prp_1', db, 'inm_1', { soloRendible: true });

    const c = contratoDelWhere(visto);
    // Mismo universo que POST /rendiciones.
    expect(c.modoCobranza).toBe('INMOBILIARIA');
    expect(c.propiedadId).toBe('prp_1');
    expect(c.inmobiliariaId).toBe('inm_1');
  });

  it('sin la opción NO filtra por modo: sigue viendo la plata cobrada directo', async () => {
    const { db, visto } = dbEspia();
    await alquilerCobradoSinRendirDePropiedad('prp_1', db, 'inm_1');

    expect(contratoDelWhere(visto).modoCobranza).toBeUndefined();
  });

  it('el tenant sigue siendo opcional y explícito cuando se lo pasan', async () => {
    const { db, visto } = dbEspia();
    await alquilerCobradoSinRendirDePropiedad('prp_1', db);

    const c = contratoDelWhere(visto);
    expect(c.propiedadId).toBe('prp_1');
    expect(c.inmobiliariaId).toBeUndefined();
  });
});

describe('T-52 — por contrato: el guard de modo-cobranza no puede filtrar', () => {
  it('mira TODOS los cobros del contrato, sin importar el modo', async () => {
    const { db, visto } = dbEspia();
    await alquilerCobradoSinRendir('cnt_1', db);

    // Este es el que protege del doble pago al volver a cuenta recaudadora: si algún día
    // alguien le agrega `modoCobranza: 'INMOBILIARIA'`, ese guard deja de ver la plata que
    // tiene que bloquear y se abre un agujero de plata real.
    expect(visto.where).toEqual({ contratoId: 'cnt_1' });
  });
});
