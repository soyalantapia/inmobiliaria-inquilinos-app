/**
 * T-56 · La mora calculada con una fecha CIVIL perdía un día.
 *
 * `diaCivilAR` está escrito para INSTANTES. Si se le pasa una fecha civil pelada —las que manda
 * el panel como "YYYY-MM-DD", o las que arma el parser del extracto bancario— queda en
 * `D T00:00Z`, que en Argentina son **las 21:00 del día anterior**. Devuelve `D − 1` siempre: no
 * es un borde, es un corrimiento constante.
 *
 * Lo que costaba:
 *  - **Cobro manual:** el diálogo prefillea el saldo con la mora al instante (10 días) y el
 *    guard la recalculaba con 9 → rechazaba con 400 el mismo monto que él había propuesto. La
 *    cajera bajaba el monto, la cuota cerraba, y esa mora no volvía a aparecer nunca: `fechaPago`
 *    queda date-only y toda lectura posterior recalcula los mismos 9 días.
 *  - **Extracto bancario:** ahí el monto NO se puede editar, así que un crédito por exactamente
 *    lo que la app le mostró al inquilino quedaba imposible de conciliar.
 *  - **MONTO_FIJO por mes:** un día de menos en un múltiplo de 30 se lleva un MES entero de mora.
 *
 * La suite ya tenía `vencimiento-huso-horario.test.ts` y estaba en verde: cubre la semántica con
 * instantes, pero nunca ejercitaba un `asOf` sin hora — justo el agujero. Esto lo cubre.
 */
import { describe, it, expect } from 'vitest';
import { diaCivilAR, instanteEnDiaCivilAR } from '@llave/shared';

/** La fecha civil tal como la guarda el sistema: medianoche UTC. */
const civil = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('T-56 — instanteEnDiaCivilAR', () => {
  it('una fecha civil cae en SU día argentino, no en el anterior', () => {
    // Sin el inverso, diaCivilAR(20T00:00Z) devuelve el 19.
    expect(diaCivilAR(civil('2026-08-20')).toISOString()).toBe('2026-08-19T00:00:00.000Z');
    // Con el inverso, vuelve a ser el 20.
    expect(diaCivilAR(instanteEnDiaCivilAR(civil('2026-08-20'))).toISOString()).toBe(
      '2026-08-20T00:00:00.000Z',
    );
  });

  it('el instante cae al mediodía argentino: lejos de los dos bordes del día', () => {
    // 12:00 AR = 15:00 UTC. Nueve horas de margen para cada lado.
    expect(instanteEnDiaCivilAR(civil('2026-08-20')).toISOString()).toBe('2026-08-20T15:00:00.000Z');
  });

  it('vale para cualquier día, incluido el cambio de mes y de año', () => {
    for (const d of ['2026-01-01', '2026-02-28', '2026-03-01', '2026-08-31', '2026-12-31']) {
      expect(diaCivilAR(instanteEnDiaCivilAR(civil(d))).toISOString()).toBe(`${d}T00:00:00.000Z`);
    }
  });
});

// La cuenta de días de atraso, replicada tal como la hace `punitorios.ts` (que no la exporta).
const DIA_MS = 24 * 60 * 60 * 1000;
function diasAtraso(fechaVencimiento: Date, asOf: Date): number {
  const venc = new Date(fechaVencimiento);
  venc.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((diaCivilAR(asOf).getTime() - venc.getTime()) / DIA_MS));
}

describe('T-56 — los días de atraso que se le cobran al inquilino', () => {
  const VENCE = civil('2026-08-10');

  it('el cobro del 20 son 10 días, no 9', () => {
    // Lo que pasaba: la fecha civil pelada daba 9.
    expect(diasAtraso(VENCE, civil('2026-08-20'))).toBe(9);
    // Lo que corresponde, y lo que da un instante real de ese día.
    expect(diasAtraso(VENCE, instanteEnDiaCivilAR(civil('2026-08-20')))).toBe(10);
    expect(diasAtraso(VENCE, new Date('2026-08-20T14:00:00Z'))).toBe(10);
  });

  it('el día del vencimiento sigue sin contar', () => {
    expect(diasAtraso(VENCE, instanteEnDiaCivilAR(civil('2026-08-10')))).toBe(0);
    expect(diasAtraso(VENCE, instanteEnDiaCivilAR(civil('2026-08-11')))).toBe(1);
  });

  it('en MONTO_FIJO por mes, ese día valía un mes entero', () => {
    // ceil(dias / 30) es lo que hace el esquema por mes.
    const meses = (d: number) => Math.ceil(d / 30);
    const conBug = diasAtraso(civil('2026-07-10'), civil('2026-08-10'));
    const correcto = diasAtraso(civil('2026-07-10'), instanteEnDiaCivilAR(civil('2026-08-10')));
    expect(conBug).toBe(30);
    expect(correcto).toBe(31);
    // 30 días → 1 mes; 31 → 2. El día de menos se llevaba un mes completo de mora.
    expect(meses(conBug)).toBe(1);
    expect(meses(correcto)).toBe(2);
  });
});
