// Resolvedores que cruzan propiedades con contratos / propietarios /
// reclamos. En backend real esto es un join; acá lo hacemos en cliente
// porque todo vive en mocks. Cuando exista la API, estos helpers se
// reemplazan por queries del servidor.

import { contratosMock, propietariosMock, reclamosMock } from './mock-data';
import type {
  ContratoListado,
  EstadoPropiedad,
  Propiedad,
  Propietario,
  Reclamo,
  TipoPropiedad,
} from './types';

export interface PropiedadEnriquecida {
  propiedad: Propiedad;
  contrato: ContratoListado | null;
  propietarios: Propietario[];
  reclamos: Reclamo[];
  reclamosAbiertos: number;
}

export function enriquecerPropiedad(propiedad: Propiedad): PropiedadEnriquecida {
  const contrato = propiedad.contratoActualId
    ? (contratosMock.find((c) => c.id === propiedad.contratoActualId) ?? null)
    : null;
  const propietarios = propietariosMock.filter((o) =>
    propiedad.propietariosIds.includes(o.id),
  );
  const reclamos = propiedad.contratoActualId
    ? reclamosMock.filter((r) => r.contratoId === propiedad.contratoActualId)
    : [];
  const reclamosAbiertos = reclamos.filter(
    (r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO',
  ).length;
  return { propiedad, contrato, propietarios, reclamos, reclamosAbiertos };
}

export const tipoPropiedadLabel: Record<TipoPropiedad, string> = {
  DEPARTAMENTO: 'Departamento',
  CASA: 'Casa',
  LOCAL: 'Local',
  GALPON: 'Galpón',
};

export const estadoPropiedadConfig: Record<
  EstadoPropiedad,
  { label: string; variant: 'success' | 'warning' | 'secondary' }
> = {
  ALQUILADA: { label: 'Alquilada', variant: 'success' },
  DISPONIBLE: { label: 'Disponible', variant: 'warning' },
  EN_EDICION: { label: 'En edición', variant: 'secondary' },
};
