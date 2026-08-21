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

/**
 * Doble que SÍ devuelve una liquidación, para que la cuenta siga hasta los groupBy y se pueda
 * mirar el `where` de los PAGOS.
 *
 * Hace falta porque el espía de arriba corta antes: `findMany` devuelve `[]` y el helper sale
 * ahí mismo. O sea que fijaba el where del `liquidacion.findMany` y nada más — y el filtro de
 * la plata migrada vive en el otro, el de `pago.groupBy`. Estaba sin cubrir.
 */
function dbEspiaConPagos() {
  const visto: { wherePagos?: Record<string, unknown> } = {};
  const db = {
    liquidacion: {
      findMany: async () => [{ id: 'liq_1', periodo: '2026-07', montoAlquiler: 100, montoTotal: 100, moneda: 'ARS' }],
    },
    pago: {
      groupBy: async (args: { where: Record<string, unknown> }) => {
        visto.wherePagos = args.where;
        return [] as never[];
      },
    },
    alquilerRendido: { groupBy: async () => [] as never[] },
    rendicion: { findMany: async () => [] as never[] },
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

describe('la plata MIGRADA DE CARTERA queda afuera SIEMPRE, no sólo con soloRendible', () => {
  // Estaba adentro del opt-in, pegada a la exclusión por `modoCobranza`, y son ortogonales:
  //
  //  · La de modo es opt-in a propósito: el guard de PATCH /modo-cobranza tiene que VER la
  //    plata cobrada directo, porque es lo único que impide transferírsela de nuevo al dueño.
  //  · La de migración no: POST /rendiciones la filtra en los DOS modos, así que no hay ningún
  //    camino que pueda rendirla. Que el guard la viera no protegía de nada, y dejaba a todo
  //    contrato importado "en curso" —que registra hasta 120 períodos pasados como pagados—
  //    con un pendiente que nunca bajaba a cero: no se le podía cambiar el modo NUNCA MÁS.

  it('con soloRendible: el groupBy de pagos la excluye', async () => {
    const { db, visto } = dbEspiaConPagos();
    await alquilerCobradoSinRendirDePropiedad('prp_1', db, 'inm_1', { soloRendible: true });
    expect(visto.wherePagos?.migradoDeCartera).toBe(false);
  });

  it('EL BUG: SIN soloRendible también, que es el caso del guard de modo-cobranza', async () => {
    const { db, visto } = dbEspiaConPagos();
    await alquilerCobradoSinRendirDePropiedad('prp_1', db, 'inm_1');
    expect(visto.wherePagos?.migradoDeCartera).toBe(false);
  });

  it('y por contrato, que es el camino exacto del guard', async () => {
    const { db, visto } = dbEspiaConPagos();
    await alquilerCobradoSinRendir('cnt_1', db);
    expect(visto.wherePagos?.migradoDeCartera).toBe(false);
    // Sin filtrar por modo: esa parte del guard NO cambia.
    expect(visto.wherePagos?.condonado).toBe(false);
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
