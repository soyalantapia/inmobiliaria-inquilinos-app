/**
 * "Ingresos del mes" del consorcio dice el mes, y no inventa un cero.
 *
 * De la auditoría del 31/08. Dos defectos, uno en cada pantalla, con la misma causa de fondo:
 * un número que se muestra sin poder calcularlo.
 *
 *   · EN EL DETALLE, `balanceConsorcio` recorría TODOS los movimientos sin filtrar por período,
 *     bajo rótulos que dicen "Ingresos del mes", "Egresos del mes" y "Saldo del mes". Un
 *     edificio administrado hace tres años mostraba el acumulado histórico como si fuera el mes.
 *   · EN EL LISTADO, `GET /consorcios` **no manda los movimientos** —decisión declarada: "sólo
 *     viajan en el detalle"— y el mapper los normalizaba con `?? []`. El balance daba 0, y
 *     `formatMonto(0)` devuelve "$ 0", no un guion: **la lista decía $ 0 siempre**, para
 *     cualquier edificio, mientras el detalle del mismo edificio decía 2.840.000.
 */
import { describe, it, expect } from 'vitest';
import { balanceConsorcio, type Consorcio } from './consorcios-storage';

const mov = (fecha: string, monto: number) => ({
  id: `m-${fecha}-${monto}`,
  fecha,
  concepto: 'x',
  monto,
  categoria: 'COBRANZA' as const,
});

/** Lo mínimo que `balanceConsorcio` mira; el resto del Consorcio no interviene. */
const consorcio = (over: Partial<Consorcio>): Consorcio =>
  ({
    id: 'c1',
    nombre: 'Edificio',
    direccion: 'Calle 1',
    cantUf: 2,
    encargado: null,
    periodoActual: '2026-08',
    expensasPeriodoActual: 100,
    unidades: [],
    movimientos: [],
    asambleas: [],
    desde: '2022-01-01',
    ...over,
  }) as Consorcio;

describe('el balance del consorcio', () => {
  const conHistoria = consorcio({
    movimientos: [
      mov('2026-08-10', 500), // del mes
      mov('2026-08-15', -200), // del mes
      mov('2024-03-01', 9_000), // de hace dos años
      mov('2023-07-01', -4_000), // de hace tres
    ],
  });

  it('🔴 con período, cuenta SÓLO el mes — antes sumaba desde que se administra el edificio', () => {
    const b = balanceConsorcio(conHistoria, '2026-08');
    expect(b.ingresos).toBe(500);
    expect(b.egresos).toBe(200);
    expect(b.saldoMes).toBe(300);
  });

  it('el control que le da sentido: sin período sigue sumando todo', () => {
    // Es el comportamiento viejo, que se conserva para no romper a un llamador que todavía no
    // pase el período. Y muestra de un vistazo el tamaño del error: 9.500 contra 500.
    const b = balanceConsorcio(conHistoria);
    expect(b.ingresos).toBe(9_500);
    expect(b.egresos).toBe(4_200);
  });

  it('🔴 sin los movimientos, el balance NO está disponible: no es cero, es "no sé"', () => {
    // El listado no los recibe. Antes esto daba 0 y la pantalla lo mostraba como "$ 0".
    const b = balanceConsorcio(consorcio({ movimientos: [], movimientosCargados: false }), '2026-08');
    expect(b.disponible).toBe(false);
  });

  it('un edificio que SÍ tiene el dato y no tuvo movimientos da cero, y está disponible', () => {
    // La otra mitad de la distinción: acá el cero es un dato, y hay que mostrarlo como cero.
    const b = balanceConsorcio(consorcio({ movimientos: [], movimientosCargados: true }), '2026-08');
    expect(b.disponible).toBe(true);
    expect(b.ingresos).toBe(0);
  });

  it('sin el flag (dato viejo o store demo) se asume disponible: no se esconde lo que hay', () => {
    // Defensivo. El campo es opcional; ante su ausencia el error menos malo es mostrar el
    // número, no ocultarlo — el flag existe para tapar un caso conocido, no para dudar de todo.
    const b = balanceConsorcio(consorcio({ movimientos: [mov('2026-08-02', 10)] }), '2026-08');
    expect(b.disponible).toBe(true);
    expect(b.ingresos).toBe(10);
  });

  it('un movimiento del último día del mes anterior no se cuela', () => {
    // El filtro es por `YYYY-MM`, así que el borde importa: 31/07 no es agosto.
    const b = balanceConsorcio(consorcio({ movimientos: [mov('2026-07-31', 999)] }), '2026-08');
    expect(b.ingresos).toBe(0);
  });
});
