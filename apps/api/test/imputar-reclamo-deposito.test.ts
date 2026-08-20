/**
 * T-65 · El guard de depósito vivía sólo en `/resolver`, y el link mágico lo esquivaba.
 *
 * EL CASO. Imputar el costo de un reclamo al DEPÓSITO exige que haya un depósito vivo. Si el
 * contrato no tiene, o si ya se devolvió / neteó / ejecutó, el `CargoContrato` con
 * `contraDeposito: true` **nace incobrable por los cuatro caminos**: no aparece en
 * `/depositos/en-custodia` (filtra RETENIDO), está excluido de `/mis-cargos`,
 * `/cargos/:id/saldar` lo rechaza y saldar-deuda lo ignora. Plata real que nadie puede cobrar.
 *
 * `POST /reclamos/:id/resolver` tenía el guard inline (operacion.ts:578-590).
 * `POST /visitas-publicas/listo` —el profesional por link mágico— NO, porque el guard nunca se
 * mudó al helper compartido.
 *
 * ES UNA REGRESIÓN DE PATRÓN, NO UN DESCUIDO. El commit `242db1b9` (26/07) se llama literal
 * "guard anti-doble-cobro en el helper compartido, **no sólo en /resolver**" y fijó la regla del
 * choke point. Ese MISMO día, `afb9efe9` agregó el guard de depósito inline en `/resolver`
 * únicamente. El de `yaRendido` se mudó; el de depósito quedó.
 *
 * Test puro: el `tx` es un doble que no toca ninguna base.
 */
import { describe, it, expect } from 'vitest';
import {
  imputarCostoReclamo,
  ReclamoDepositoNoDisponible,
  ReclamoNoReimputable,
} from '../src/lib/imputar-reclamo.js';

type Contrato = { depositoGarantia: number; estadoDeposito: string } | null;

/** Doble mínimo del cliente de Prisma: registra lo que se escribió y devuelve lo que se le fija. */
function txFalso(opts: { contrato?: Contrato; cargoPrevio?: unknown; rendido?: boolean } = {}) {
  const escrito: { upserts: unknown[]; borrados: unknown[] } = { upserts: [], borrados: [] };
  const tx = {
    cargoContrato: {
      findUnique: async () => opts.cargoPrevio ?? null,
      deleteMany: async (a: unknown) => { escrito.borrados.push(a); return { count: 0 }; },
      upsert: async (a: unknown) => { escrito.upserts.push(a); return {}; },
    },
    contrato: { findUnique: async () => opts.contrato ?? null },
    gastoRendido: { findFirst: async () => (opts.rendido ? { id: 'gr_1' } : null) },
  } as never;
  return { tx, escrito };
}

const args = (pagador: 'PROPIETARIO' | 'INQUILINO' | 'DEPOSITO' | null) => ({
  inmobiliariaId: 'inm_1',
  reclamoId: 'rec_1',
  contratoId: 'cnt_1',
  pagador,
  costo: 50_000,
  moneda: 'ARS' as const,
  concepto: 'Reparación (plomería): pérdida en la cocina',
  creadoPorId: null,
});

const VIVO = { depositoGarantia: 500_000, estadoDeposito: 'RETENIDO' };

describe('T-65 — imputar al depósito exige un depósito vivo', () => {
  it('sin depósito cargado, corta y no escribe ningún cargo', async () => {
    const { tx, escrito } = txFalso({ contrato: { depositoGarantia: 0, estadoDeposito: 'RETENIDO' } });
    await expect(imputarCostoReclamo(tx, args('DEPOSITO'))).rejects.toThrow(ReclamoDepositoNoDisponible);
    expect(escrito.upserts).toHaveLength(0); // con el bug: nacía un cargo incobrable
  });

  it('con el depósito ya resuelto, también corta', async () => {
    for (const estado of ['DEVUELTO', 'NETEADO', 'EJECUTADO']) {
      const { tx, escrito } = txFalso({ contrato: { depositoGarantia: 500_000, estadoDeposito: estado } });
      await expect(imputarCostoReclamo(tx, args('DEPOSITO'))).rejects.toThrow(ReclamoDepositoNoDisponible);
      expect(escrito.upserts).toHaveLength(0);
    }
  });

  it('el mensaje distingue "no tiene" de "ya se resolvió": el operador hace cosas distintas', async () => {
    const sin = txFalso({ contrato: { depositoGarantia: 0, estadoDeposito: 'RETENIDO' } });
    await expect(imputarCostoReclamo(sin.tx, args('DEPOSITO'))).rejects.toThrow(/no tiene depósito de garantía/);
    const resuelto = txFalso({ contrato: { depositoGarantia: 500_000, estadoDeposito: 'DEVUELTO' } });
    await expect(imputarCostoReclamo(resuelto.tx, args('DEPOSITO'))).rejects.toThrow(/ya fue resuelto/);
  });

  it('hereda de ReclamoNoReimputable, que es lo que los dos catch mapean a 409', async () => {
    const { tx } = txFalso({ contrato: { depositoGarantia: 0, estadoDeposito: 'RETENIDO' } });
    // Sin esta herencia, /listo y /resolver devolverían 500 en vez de 409.
    await expect(imputarCostoReclamo(tx, args('DEPOSITO'))).rejects.toBeInstanceOf(ReclamoNoReimputable);
  });

  it('con el depósito vivo imputa normal', async () => {
    const { tx, escrito } = txFalso({ contrato: VIVO });
    await imputarCostoReclamo(tx, args('DEPOSITO'));
    expect(escrito.upserts).toHaveLength(1);
  });
});

describe('T-65 — el guard no se mete donde no lo llaman', () => {
  it('INQUILINO no consulta el depósito, ni aunque no haya', async () => {
    const { tx, escrito } = txFalso({ contrato: null });
    await imputarCostoReclamo(tx, args('INQUILINO'));
    expect(escrito.upserts).toHaveLength(1);
  });

  it('PROPIETARIO sigue sin generar cargo (lo toma la rendición)', async () => {
    const { tx, escrito } = txFalso({ contrato: null });
    await imputarCostoReclamo(tx, args('PROPIETARIO'));
    expect(escrito.upserts).toHaveLength(0);
    expect(escrito.borrados).toHaveLength(1);
  });

  it('un re-cierre idéntico de un cargo YA COBRADO sigue pasando, aunque el depósito no esté vivo', async () => {
    // Es el orden lo que lo permite: el early-return de `saldadoAt` va ANTES del guard nuevo.
    // Si el guard fuera primero, resolver el depósito —que salda los cargos contraDeposito—
    // pasaría de 200 a 409.
    const { tx } = txFalso({
      contrato: { depositoGarantia: 500_000, estadoDeposito: 'EJECUTADO' },
      cargoPrevio: { monto: 50_000, contraDeposito: true, saldadoAt: new Date() },
    });
    await expect(imputarCostoReclamo(tx, args('DEPOSITO'))).resolves.toBeUndefined();
  });

  it('el corte por trabajo ya rendido sigue ganando sobre el upsert', async () => {
    const { tx, escrito } = txFalso({ contrato: VIVO, rendido: true });
    await expect(imputarCostoReclamo(tx, args('DEPOSITO'))).rejects.toThrow(ReclamoNoReimputable);
    expect(escrito.upserts).toHaveLength(0);
  });
});
