// Datos bancarios de la inmobiliaria que el inquilino usa para transferir.
// En backend real esto viene de Inmobiliaria. Por ahora es estático.

export interface DatosBancarios {
  banco: string;
  tipoCuenta: string;
  titular: string;
  cuit: string;
  cbu: string;
  alias: string;
}

export const datosBancariosMock: DatosBancarios = {
  banco: 'Banco Galicia',
  tipoCuenta: 'Cuenta corriente en pesos',
  titular: 'Inmobiliaria del Sol S.R.L.',
  cuit: '30-71234567-9',
  cbu: '0070099120000031234560',
  alias: 'inmosol.alquileres',
};
