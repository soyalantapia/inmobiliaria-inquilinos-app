-- Los dos caminos que DAN poder sobre el equipo eran los únicos mudos.
--
-- `POST /usuarios` en su alta real escribe EQUIPO_INVITADO y `DELETE /usuarios/:id` escribe
-- EQUIPO_REMOVIDO. Pero la rama de REACTIVACIÓN del POST —el único camino de reincorporación
-- que existe en el producto, porque la pantalla Equipo filtra por `activo` y no hay botón de
-- "reactivar"— devolvía 200 sin auditar y sin mandar mail. Y `PUT /usuarios/:id`, el otro
-- endpoint que escribe `Usuario.rol`, tampoco dejaba nada.
--
-- No se reusa EQUIPO_INVITADO: por esos caminos no sale ninguna invitación, y el rastro tiene
-- que decir lo que pasó. `PATCH /propietarios/:id/activo` ya audita las DOS direcciones sobre
-- un poder mucho menor.
--
-- IF NOT EXISTS porque el deploy puede reintentar; ADD VALUE es aditivo y no reescribe filas.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'EQUIPO_REINCORPORADO';
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'EQUIPO_ROL_CAMBIADO';
