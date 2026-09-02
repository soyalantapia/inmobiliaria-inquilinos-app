/**
 * El inquilino que pagó UNA PARTE y está vencido sí entra en la audiencia de morosos.
 *
 * DE DÓNDE SALIÓ. De la auditoría del 31/08 (`work-agent/AUDITORIA-2026-08-31.md`), clase
 * "dos verdades del mismo hecho": la regla de "esta cuota está vencida" vivía copiada en tres
 * archivos y las copias divergieron.
 *
 * QUÉ PASABA, Y POR QUÉ ERA PLATA. `anuncios.ts` derivaba el estado mirando el enum PERSISTIDO
 * (`l.estado === 'VENCIDO'`), con un comentario que decía *"Mismo derivado que GET /contratos"*.
 * Era falso. El barrido `marcarLiquidacionesVencidas` **no toca las PARCIAL a propósito**, así
 * que la cuota de quien pagó una parte nunca vira a VENCIDO.
 *
 * EL EFECTO EXACTO, que es MENOS de lo que decía el hallazgo —y los dos últimos casos de este
 * archivo lo dejan escrito—:
 *
 *   · con una cuota futura PENDIENTE en la lista (el caso normal: el devengo la genera por
 *     adelantado), el `?? liqs[0]` la tomaba y el parcial vencido caía en
 *     `INQUILINOS_PENDIENTES` —el recordatorio suave— en vez de en `INQUILINOS_MOROSOS`.
 *     Recibía un aviso: el que no correspondía;
 *   · SIN cuota futura —último mes del contrato, o la del mes siguiente ya paga— el estado
 *     derivado era `PARCIAL`, que no es ninguna de las dos: ahí sí se quedaba sin ningún aviso.
 *
 * Y por el mismo `?? liqs[0]`, un inquilino AL DÍA caía en `INQUILINOS_PENDIENTES`, porque el
 * estado que se reportaba era el de la cuota del mes que viene.
 *
 * Este archivo prueba la función pura. La regla ahora vive en `lib/estado-de-pago.ts`, importada
 * por `core.ts`, `anuncios.ts` y `aplicar-deposito.ts`.
 *
 * NO NECESITA BASE.
 */
import { describe, it, expect } from 'vitest';
import { liqQueDefineEstado, liqVencida } from '../src/lib/estado-de-pago.js';

const AHORA = new Date('2026-08-31T12:00:00.000Z');
const ayer = new Date('2026-08-05T00:00:00.000Z');
const enUnMes = new Date('2026-09-05T00:00:00.000Z');

/** La misma derivación que hace `anuncios.ts` para elegir la audiencia. */
function estadoDeAudiencia(
  liqs: Array<{ periodo: string; estado: string; fechaVencimiento: Date }>,
  now = AHORA,
): string {
  const l = liqQueDefineEstado(liqs, now);
  if (!l) return 'PENDIENTE';
  if (liqVencida(l, now)) return 'VENCIDO';
  return l.estado === 'PARCIAL' ? 'PENDIENTE' : l.estado;
}

describe('quién entra en cada audiencia de anuncios', () => {
  it('🔴 el que pagó una PARTE y venció es MOROSO, aunque su cuota siga diciendo PARCIAL', () => {
    // Éste es el caso. `marcarLiquidacionesVencidas` no toca las PARCIAL, así que el enum
    // persistido nunca dice VENCIDO por más que el vencimiento haya pasado hace tres semanas.
    const liqs = [
      { periodo: '2026-09', estado: 'PENDIENTE', fechaVencimiento: enUnMes },
      { periodo: '2026-08', estado: 'PARCIAL', fechaVencimiento: ayer },
    ];
    expect(estadoDeAudiencia(liqs)).toBe('VENCIDO');
  });

  it('🔴 y el que está AL DÍA no entra en "pendientes" por la cuota del mes que viene', () => {
    // El otro defecto del mismo renglón: `?? liqs[0]` tomaba la cuota futura, que el devengo
    // genera por adelantado, y la reportaba como el estado del contrato.
    const liqs = [
      { periodo: '2026-09', estado: 'PENDIENTE', fechaVencimiento: enUnMes },
      { periodo: '2026-08', estado: 'PAGADO', fechaVencimiento: ayer },
    ];
    expect(estadoDeAudiencia(liqs)).toBe('PAGADO');
  });

  it('el moroso de toda la vida sigue siendo moroso', () => {
    const liqs = [
      { periodo: '2026-09', estado: 'PENDIENTE', fechaVencimiento: enUnMes },
      { periodo: '2026-08', estado: 'VENCIDO', fechaVencimiento: ayer },
    ];
    expect(estadoDeAudiencia(liqs)).toBe('VENCIDO');
  });

  it('un PARCIAL que TODAVÍA no venció entra en el recordatorio, no en morosos', () => {
    // Decisión explícita: debe plata, así que le sirve el recordatorio; pero no está vencido,
    // así que no es moroso. Dejarlo afuera de las dos sería el mismo agujero corrido un mes.
    const liqs = [{ periodo: '2026-09', estado: 'PARCIAL', fechaVencimiento: enUnMes }];
    expect(estadoDeAudiencia(liqs)).toBe('PENDIENTE');
  });

  it('un contrato sin cuotas no rompe nada', () => {
    expect(estadoDeAudiencia([])).toBe('PENDIENTE');
  });

  it('el control que le da sentido: con la regla VIEJA le llegaba el aviso EQUIVOCADO', () => {
    // Se deja escrita la regla anterior para que el arreglo no parezca una preferencia de
    // estilo. Y para ser exacto con lo que pasaba, que es MENOS de lo que decía el hallazgo:
    // con una cuota futura PENDIENTE en la lista, el `?? liqs[0]` la tomaba y el parcial
    // vencido caía en INQUILINOS_PENDIENTES —el recordatorio suave— en vez de en MOROSOS.
    // Recibía un aviso, sí: el que no correspondía.
    const viejo = (liqs: Array<{ estado: string }>) =>
      (liqs.find((l) => l.estado === 'VENCIDO') ?? liqs[0])?.estado ?? 'PENDIENTE';
    const conFutura = [
      { periodo: '2026-09', estado: 'PENDIENTE', fechaVencimiento: enUnMes },
      { periodo: '2026-08', estado: 'PARCIAL', fechaVencimiento: ayer },
    ];
    expect(viejo(conFutura)).toBe('PENDIENTE');
    expect(estadoDeAudiencia(conFutura)).toBe('VENCIDO');
  });

  it('y SIN cuota futura, con la regla vieja no entraba en NINGUNA audiencia', () => {
    // Acá sí se quedaba sin ningún aviso: el estado derivado era 'PARCIAL', que no es
    // 'VENCIDO' (morosos) ni 'PENDIENTE' (recordatorio). Pasa en el último mes de un contrato,
    // o cuando la cuota del mes siguiente ya está paga.
    const viejo = (liqs: Array<{ estado: string }>) =>
      (liqs.find((l) => l.estado === 'VENCIDO') ?? liqs[0])?.estado ?? 'PENDIENTE';
    const sinFutura = [{ periodo: '2026-08', estado: 'PARCIAL', fechaVencimiento: ayer }];
    const estadoViejo = viejo(sinFutura);
    expect(estadoViejo).not.toBe('VENCIDO');
    expect(estadoViejo).not.toBe('PENDIENTE');
    expect(estadoDeAudiencia(sinFutura)).toBe('VENCIDO');
  });
});
