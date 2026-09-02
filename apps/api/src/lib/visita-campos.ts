/**
 * Los campos de `VisitaProfesional` que las pantallas realmente renderizan — SIN `token`.
 *
 * El `token` es el link mágico en crudo: se canjea sin bearer por un JWT de profesional que
 * cierra el reclamo, escribe `costoTrabajo` y puede crear un cargo contra el inquilino o
 * descontar del depósito. Sale sólo para quien puede crear y regenerar ese link.
 */
export const CAMPOS_VISITA_PANEL = {
  id: true,
  estado: true,
  fechaVisita: true,
  confirmadaAt: true,
  enCaminoAt: true,
  listoAt: true,
  notaFinal: true,
  montoCobrado: true,
  fotoAntes: true,
  fotoDespues: true,
  profesionalId: true,
  reclamoId: true,
} as const;

/** Lo que la PWA del inquilino renderiza de la visita. Un subconjunto, y nunca el token. */
export const CAMPOS_VISITA_INQUILINO = {
  id: true,
  estado: true,
  fechaVisita: true,
  notaFinal: true,
  fotoAntes: true,
  fotoDespues: true,
} as const;
