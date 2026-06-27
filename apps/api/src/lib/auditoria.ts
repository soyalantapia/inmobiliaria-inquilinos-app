import type { TipoEventoAuditoria } from '@prisma/client';
import { prisma } from '../db.js';

export type EventoAuditoriaInput = {
  inmobiliariaId: string;
  tipo: TipoEventoAuditoria;
  /** Usuario del panel que ejecutó la acción (FK a Usuario). */
  autorId: string;
  /** Snapshot del rol al momento del evento. */
  rolAutor: string;
  /** Id polimórfico de la entidad afectada (pag_* / cnt_* / mov_* / rec_* / …). */
  entidadId: string;
  entidadDescripcion: string;
  detalle?: string;
};

/**
 * Registra un evento de auditoría (rastro de "quién hizo qué" sobre acciones
 * sensibles: plata, equipo, ciclo de vida del contrato). Útil para soporte,
 * disputas y debug — antes el modelo EventoAuditoria existía pero NADIE escribía.
 *
 * Es BEST-EFFORT: atrapa su propio error y nunca lo propaga, así un fallo del
 * rastro (p.ej. la DB justo cayó) jamás rompe la acción de negocio. Por eso se
 * llama DESPUÉS de que la acción ya commiteó, no dentro de su transacción.
 */
export async function registrarEvento(evento: EventoAuditoriaInput): Promise<void> {
  try {
    await prisma.eventoAuditoria.create({ data: evento });
  } catch (e) {
    console.error('[auditoria] no se pudo registrar el evento', evento.tipo, evento.entidadId, e);
  }
}
