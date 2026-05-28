// Datos bancarios de la inmobiliaria que el inquilino usa para transferir.
// En backend real esto viene de Inmobiliaria. Por ahora es estático.

export interface ProximoCambioBancario {
  /** ISO date YYYY-MM-DD desde cuando son válidos los datos nuevos. */
  fechaDesde: string;
  /** CBU nuevo a usar a partir de fechaDesde. */
  cbu: string;
  /** Alias nuevo a usar a partir de fechaDesde. */
  alias: string;
  /** Texto corto explicando por qué cambia (e.g. "Cambio de banco"). */
  motivo?: string;
}

export interface DatosBancarios {
  banco: string;
  tipoCuenta: string;
  titular: string;
  cuit: string;
  cbu: string;
  alias: string;
  /**
   * Si la inmo anunció un cambio de CBU/alias para una fecha futura,
   * lo dejamos acá para que el checkout pueda mostrar un banner amber
   * con la fecha de vigencia y los datos nuevos. El user se enteraba
   * solo por el feed del home — confuso si transfería en el borde.
   */
  proximoCambio?: ProximoCambioBancario;
}

export const datosBancariosMock: DatosBancarios = {
  banco: 'Banco Galicia',
  tipoCuenta: 'Cuenta corriente en pesos',
  titular: 'Inmobiliaria del Sol S.R.L.',
  cuit: '30-71234567-9',
  cbu: '0070099120000031234560',
  alias: 'inmosol.alquileres',
  proximoCambio: {
    // Sincronizado con el anuncio "Nuevo CBU vigente desde 01/06" del
    // feed de inmobiliaria (anuncios-cross-app.ts:97).
    fechaDesde: '2026-06-01',
    cbu: '0070100120000018273645',
    alias: 'delsol.cobranzas',
    motivo: 'Cambio de cuenta de cobranzas',
  },
};

/**
 * Si hay un cambio bancario agendado en el futuro (>= hoy), lo devuelve.
 * El checkout lo usa para mostrar el banner "OJO: A partir de X usá estos".
 */
export function proximoCambioVigente(
  d: DatosBancarios,
  hoy: Date = new Date(),
): ProximoCambioBancario | null {
  if (!d.proximoCambio) return null;
  const fechaDesde = new Date(d.proximoCambio.fechaDesde + 'T00:00:00');
  return fechaDesde > hoy ? d.proximoCambio : null;
}
