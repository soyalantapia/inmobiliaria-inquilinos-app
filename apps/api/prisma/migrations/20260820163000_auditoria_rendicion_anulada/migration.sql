-- Anular una rendición no dejaba ningún rastro.
--
-- `POST /rendiciones/:id/anular` borra la fila y sus tres ledgers, y —a diferencia de rendir,
-- que registra PROPIETARIO_RENDIDO— no escribía ningún evento. Es el único registro de plata
-- que el sistema destruye, y el único que un tercero (el propietario, en su portal) ya vio:
-- se le desaparece un depósito de la pantalla sin explicación, y del lado de la inmobiliaria
-- no hay a quién preguntarle porque no quedó ni la fila ni el evento.
--
-- ADITIVA: agrega un valor al enum. No cambia ninguna fila existente.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'PROPIETARIO_RENDICION_ANULADA';
