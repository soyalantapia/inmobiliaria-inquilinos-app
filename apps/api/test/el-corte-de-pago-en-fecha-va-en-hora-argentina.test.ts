/**
 * T-28 · El corte de "pagó en fecha" se decidía en UTC mientras el resto de la mora corta en
 * hora argentina.
 *
 * `pagadoAlVencimientoPorLiquidacion` (lib/saldos.ts) decide qué parte de una cuota entró EN
 * FECHA. Es la base sobre la que corre toda la mora: tiene 21 call sites —la PWA del inquilino,
 * el tope de `/pagos/informar`, `/pagos/manual`, la conciliación bancaria, `anular`,
 * `saldar-deuda`, la aplicación del depósito, `deudaTotal` del panel y el KPI de morosidad—.
 *
 * El corte era `fechaTransferencia > venc + 86.400.000 − 1`: el final del día **UTC**. Y el
 * vencimiento se guarda como medianoche UTC del día civil, así que ese día terminaba a las
 * 21:00 de Argentina. El inquilino todavía tenía tres horas de su día de pago y el corte ya lo
 * daba por tarde.
 *
 * ES EL MISMO ERROR QUE T-56 ARREGLÓ EN `diasAtraso`, en el archivo de al lado, con el
 * comentario escrito: «Normalizarlo con setUTCHours lo llevaba al día UTC, que desde las 21:00
 * hora argentina ya es el día siguiente: cobraba un día de mora mientras al inquilino todavía
 * le quedaban tres horas del día de pago. El corte va en hora local.» Se arregló ahí y quedó
 * vivo acá, en el corte gemelo.
 *
 * Y NO ES UN BORDE RARO: la PWA manda `new Date().toISOString()` —un instante, no una fecha
 * civil—, así que cualquier pago hecho entre las 21:00 y las 23:59 del día del vencimiento caía
 * afuera. El costo es el de T-57 reintroducido por la puerta de atrás: una cuota de $600.000
 * pagada en $599.000 a las 21:30 del día 10 dejaba de descontar, y a 30 días con 0,15% diario
 * la mora corría sobre los $600.000 completos: **$27.000 en vez de $45**. Seiscientas veces.
 *
 * CONTROL NEGATIVO (corrido a mano antes de commitear): volviendo el corte a
 * `> venc + 86_400_000 - 1`, fallan los dos casos de la ventana 21:00–23:59 y el de la plata.
 *
 * Test PURO: `pagadoAlVencimientoPorLiquidacion` acepta el cliente de base por parámetro, así
 * que el doble alcanza y no hace falta levantar nada.
 */
import { describe, it, expect } from 'vitest';
import { pagadoAlVencimientoPorLiquidacion } from '../src/lib/saldos.js';

/** Vence el 10/07/2026. Se guarda como medianoche UTC del día civil, como todo el schema. */
const VENC = '2026-07-10T00:00:00.000Z';
const LIQ = [{ id: 'liq_1', fechaVencimiento: VENC }];

/**
 * El día civil argentino 10/07 va de `2026-07-10T03:00Z` a `2026-07-11T02:59:59Z`.
 * Estos son los instantes que importan, escritos en las dos zonas para que se lean.
 */
const INSTANTES = {
  ellDiaAntes: '2026-07-09T15:00:00.000Z', //  12:00 AR del 9  — en fecha, obvio
  ellDiaALas12: '2026-07-10T15:00:00.000Z', // 12:00 AR del 10 — en fecha, obvio
  ellDiaALas2059: '2026-07-10T23:59:00.000Z', // 20:59 AR del 10 — en fecha (y ya pasaba antes)
  ellDiaALas2130: '2026-07-11T00:30:00.000Z', // 21:30 AR del 10 — EN FECHA (acá estaba el bug)
  ellDiaALas2359: '2026-07-11T02:59:00.000Z', // 23:59 AR del 10 — EN FECHA (el último instante)
  alDiaSiguiente: '2026-07-11T03:01:00.000Z', // 00:01 AR del 11 — TARDE, y tiene que seguir siéndolo
};

/** Cliente de base falso: devuelve los pagos que le pasás, sin tocar nada. */
const db = (pagos: { liquidacionId: string; monto: number; fechaTransferencia: string }[]) =>
  ({ pago: { findMany: async () => pagos } }) as never;

const enFecha = async (fechaTransferencia: string, monto = 599_000) => {
  const m = await pagadoAlVencimientoPorLiquidacion(
    LIQ,
    db([{ liquidacionId: 'liq_1', monto, fechaTransferencia }]),
  );
  return m.get('liq_1') ?? 0;
};

describe('el corte de "pagó en fecha" va en hora argentina', () => {
  it('un pago del día ANTERIOR cuenta', async () => {
    expect(await enFecha(INSTANTES.ellDiaAntes)).toBe(599_000);
  });

  it('al mediodía del día del vencimiento, también', async () => {
    expect(await enFecha(INSTANTES.ellDiaALas12)).toBe(599_000);
  });

  it('a las 20:59 de Argentina, también (esto ya andaba)', async () => {
    expect(await enFecha(INSTANTES.ellDiaALas2059)).toBe(599_000);
  });

  it('🔴 a las 21:30 de Argentina TAMBIÉN: sigue siendo el día del vencimiento', async () => {
    // Con el bug: 0. Ese instante es `2026-07-11T00:30Z`, o sea el día siguiente en UTC.
    expect(await enFecha(INSTANTES.ellDiaALas2130)).toBe(599_000);
  });

  it('🔴 y a las 23:59, el último instante del día civil argentino', async () => {
    expect(await enFecha(INSTANTES.ellDiaALas2359)).toBe(599_000);
  });

  it('a las 00:01 del día siguiente NO cuenta — el corte sigue cortando', async () => {
    // El control que prueba que el arreglo no abrió la puerta: un pago tardío sigue siendo tardío.
    expect(await enFecha(INSTANTES.alDiaSiguiente)).toBe(0);
  });

  it('suma los varios pagos en fecha de la misma cuota, y deja afuera los tardíos', async () => {
    const m = await pagadoAlVencimientoPorLiquidacion(
      LIQ,
      db([
        { liquidacionId: 'liq_1', monto: 300_000, fechaTransferencia: INSTANTES.ellDiaALas12 },
        { liquidacionId: 'liq_1', monto: 299_000, fechaTransferencia: INSTANTES.ellDiaALas2130 },
        { liquidacionId: 'liq_1', monto: 100_000, fechaTransferencia: INSTANTES.alDiaSiguiente },
      ]),
    );
    expect(m.get('liq_1')).toBe(599_000);
  });

  it('sin pagos en fecha, la cuota no aparece en el mapa', async () => {
    const m = await pagadoAlVencimientoPorLiquidacion(
      LIQ,
      db([{ liquidacionId: 'liq_1', monto: 100_000, fechaTransferencia: INSTANTES.alDiaSiguiente }]),
    );
    expect(m.has('liq_1')).toBe(false);
  });

  it('con la lista vacía ni consulta la base', async () => {
    let consultas = 0;
    const espia = { pago: { findMany: async () => { consultas++; return []; } } } as never;
    expect((await pagadoAlVencimientoPorLiquidacion([], espia)).size).toBe(0);
    expect(consultas).toBe(0);
  });
});

/**
 * LA PLATA, que es de lo que se trata. Se reproduce el número exacto del ticket T-57 —el que
 * el docblock de `baseMora` cita como el bug que ya se había arreglado— para dejar fijado que
 * este corte lo reintroducía por otro camino.
 */
describe('y por eso la mora no vuelve a correr sobre el total', () => {
  it('$599.000 pagados a las 21:30 del vencimiento dejan la mora en $45, no en $27.000', async () => {
    const { calcularMora } = await import('../src/lib/punitorios.js');
    const TOTAL = 600_000;
    const pagado = await enFecha(INSTANTES.ellDiaALas2130, 599_000);

    const treintaDiasDespues = new Date('2026-08-09T15:00:00.000Z');
    const mora = calcularMora(
      { total: TOTAL, pagadoAlVencimiento: pagado },
      { tipo: 'PORCENTAJE_DIARIO', valor: 0.15 },
      VENC,
      treintaDiasDespues,
      null,
    );

    // Sobre el saldo REAL: 1.000 × 0,15% × 30 = $45.
    // Con el bug la base era el total: 600.000 × 0,15% × 30 = $27.000 — el número textual que
    // el docblock de `baseMora` cita como el bug de T-57 que ya se había arreglado.
    expect(pagado).toBe(599_000);
    expect(mora).toBeCloseTo(45, 2);

    const conElBug = calcularMora(
      { total: TOTAL, pagadoAlVencimiento: 0 },
      { tipo: 'PORCENTAJE_DIARIO', valor: 0.15 },
      VENC,
      treintaDiasDespues,
      null,
    );
    expect(conElBug).toBeCloseTo(27_000, 2);
    expect(conElBug / mora).toBeCloseTo(600, 0); // 600.000 / 1.000: se le cobraba 600 veces de más
  });
});
