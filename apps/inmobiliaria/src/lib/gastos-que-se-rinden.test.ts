/**
 * El alquiler de la oficina se le restaba a lo que hay que rendirle a los propietarios.
 *
 * El KPI «A rendir a propietarios» del tablero restaba TODOS los gastos con
 * `descontadoEnRendicion: false`. Un gasto **sin propiedad** —oficina, sueldos, un adelanto
 * entre cajas— nunca se le descuenta a ningún propietario: lo dice el schema, y por eso su flag
 * **nunca pasa a true**. No es un pendiente; es un gasto de la inmobiliaria.
 *
 * Así que el tablero se lo restaba todos los meses, para siempre, y el error CRECE: cada mes de
 * oficina y cada sueldo se suma al descuento y no sale nunca. El número que la administradora
 * mira para saber cuánto debe rendir es cada vez más chico que la deuda real.
 *
 * Salió de revisar los PRs de julio: estaba enterrado en #37, que como conjunto ya no se puede
 * rebasar.
 */
import { describe, it, expect } from 'vitest';
import { gastosPendientesDeRendir, seLeDescuentaAlPropietario } from './gastos-que-se-rinden';

const gasto = (monto: number, propiedadId: string | null, descontado = false) => ({
  tipo: 'GASTO',
  propiedadId,
  descontadoEnRendicion: descontado,
  monto,
});

describe('qué gastos se le descuentan a un propietario', () => {
  it('🔴 el gasto SIN propiedad no se le resta a nadie, por más pendiente que figure', () => {
    // El alquiler de la oficina. La rendición filtra por `propiedadId IN propIdsConIngreso`,
    // así que nunca lo toma y su flag se queda en false para siempre.
    expect(seLeDescuentaAlPropietario(gasto(300_000, null))).toBe(false);
  });

  it('🔴 y por eso no infla el descuento mes a mes', () => {
    // Tres meses de oficina + un gasto real de una propiedad. Con el bug: 940.000.
    const movs = [
      gasto(300_000, null),
      gasto(300_000, null),
      gasto(300_000, null),
      gasto(40_000, 'prp_001'),
    ];
    expect(gastosPendientesDeRendir(movs)).toBe(40_000);
  });

  it('CONTROL POSITIVO — el gasto de una propiedad, sin rendir, sí se descuenta', () => {
    expect(seLeDescuentaAlPropietario(gasto(40_000, 'prp_001'))).toBe(true);
    expect(gastosPendientesDeRendir([gasto(40_000, 'prp_001')])).toBe(40_000);
  });

  it('CONTROL POSITIVO — el que YA se rindió no se cuenta dos veces', () => {
    expect(seLeDescuentaAlPropietario(gasto(40_000, 'prp_001', true))).toBe(false);
    expect(gastosPendientesDeRendir([gasto(40_000, 'prp_001', true)])).toBe(0);
  });

  it('un INGRESO_EXTRA no es un gasto', () => {
    // Entra plata, no sale: restarlo daría vuelta el signo.
    expect(
      seLeDescuentaAlPropietario({
        tipo: 'INGRESO_EXTRA',
        propiedadId: 'prp_001',
        descontadoEnRendicion: false,
        monto: 50_000,
      }),
    ).toBe(false);
  });

  it('sin movimientos, cero', () => {
    expect(gastosPendientesDeRendir([])).toBe(0);
  });
});
