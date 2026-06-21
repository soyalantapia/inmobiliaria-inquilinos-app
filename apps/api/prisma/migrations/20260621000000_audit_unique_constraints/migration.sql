-- Auditoría profunda v3 — constraints únicos para cerrar carreras concurrentes.
-- Prod verificado SIN duplicados antes de aplicar (co_inquilinos y pagos en 0 filas).

-- #10: una sola invitación de co-inquilino por (contrato, email). La revocación
-- BORRA la fila, así que re-invitar tras revocar no choca. Cierra la carrera de
-- doble-invitación concurrente (el segundo create da P2002 -> 409).
CREATE UNIQUE INDEX "co_inquilinos_contratoId_email_key" ON "co_inquilinos"("contratoId", "email");

-- #7: un solo pago INFORMADO (pendiente de validación) por liquidación. Índice
-- PARCIAL (solo estado='INFORMADO') para permitir múltiples RECHAZADO/CONCILIADO
-- legítimos. Prisma no expresa índices parciales en el schema -> SQL crudo acá.
-- Cierra la carrera de doble-informe concurrente (el doble-tap secuencial ya lo
-- guarda el handler con un findFirst).
CREATE UNIQUE INDEX "pagos_liquidacionId_informado_key" ON "pagos"("liquidacionId") WHERE "estado" = 'INFORMADO';
