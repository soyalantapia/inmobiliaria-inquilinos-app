// Cálculo de la participación efectiva de cada propietario en una propiedad.
// Si la propiedad tiene `participaciones` explícitas las usamos, sino
// repartimos en partes iguales entre los propietariosIds.

import type { ParticipacionPropietario, Propiedad } from './types';

export function participacionesDe(propiedad: Propiedad): ParticipacionPropietario[] {
  if (propiedad.participaciones && propiedad.participaciones.length > 0) {
    return propiedad.participaciones;
  }
  if (propiedad.propietariosIds.length === 0) return [];
  const igualitario = Math.round((100 / propiedad.propietariosIds.length) * 100) / 100;
  return propiedad.propietariosIds.map((id) => ({
    propietarioId: id,
    porcentaje: igualitario,
  }));
}

/** Calcula la suma total y devuelve si está balanceado (100%). */
export function validarParticipaciones(
  participaciones: ParticipacionPropietario[],
): { suma: number; balanceado: boolean } {
  const suma = participaciones.reduce((acc, p) => acc + p.porcentaje, 0);
  // Toleramos +/- 0.5 por redondeos
  return { suma, balanceado: Math.abs(suma - 100) < 0.5 };
}

/** Lo que recibe el propietario X de un monto bruto de una propiedad. */
export function montoQueLeToca(
  propiedad: Propiedad,
  propietarioId: string,
  montoBruto: number,
): number {
  const parts = participacionesDe(propiedad);
  const mia = parts.find((p) => p.propietarioId === propietarioId);
  if (!mia) return 0;
  return Math.round(montoBruto * (mia.porcentaje / 100));
}
