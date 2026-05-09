// Validación CUIT/CUIL Argentina con dígito verificador.
// Algoritmo oficial AFIP: multiplicadores [5,4,3,2,7,6,5,4,3,2] sobre los
// primeros 10 dígitos, módulo 11, restar de 11. Si da 11 → 0; si da 10 →
// CUIT inválido. Comparar con el último dígito.

const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export function normalizarCuit(input: string): string {
  return input.replace(/\D/g, '');
}

export function formatearCuit(input: string): string {
  const d = normalizarCuit(input).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export interface ValidacionCuit {
  valido: boolean;
  motivo?: string;
}

export function validarCuit(input: string): ValidacionCuit {
  const d = normalizarCuit(input);
  if (d.length === 0) return { valido: false, motivo: 'Ingresá el CUIT' };
  if (d.length !== 11) return { valido: false, motivo: 'El CUIT tiene 11 dígitos' };

  const prefijo = d.slice(0, 2);
  const prefijosValidos = ['20', '23', '24', '27', '30', '33', '34'];
  if (!prefijosValidos.includes(prefijo)) {
    return { valido: false, motivo: `Prefijo ${prefijo} no es válido` };
  }

  let suma = 0;
  for (let i = 0; i < 10; i += 1) {
    const digito = Number(d[i]);
    const mult = MULTIPLICADORES[i];
    if (mult === undefined) continue;
    suma += digito * mult;
  }
  const resto = suma % 11;
  let verificadorEsperado: number;
  if (resto === 0) verificadorEsperado = 0;
  else if (resto === 1) return { valido: false, motivo: 'CUIT inválido' };
  else verificadorEsperado = 11 - resto;

  const verificadorIngresado = Number(d[10]);
  if (verificadorEsperado !== verificadorIngresado) {
    return { valido: false, motivo: 'Dígito verificador incorrecto' };
  }

  return { valido: true };
}
