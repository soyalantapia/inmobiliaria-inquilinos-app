-- Una sola Aprobacion PENDIENTE por contrato.
-- Hasta ahora era inalcanzable porque el único create vivía dentro de POST /contratos,
-- atado a un contrato recién creado. El reenvío desde un contrato rechazado abre esa
-- puerta: dos reenvíos seguidos dejarían dos pendientes, y aprobar una no cerraría la
-- otra — la bandeja mostraría un fantasma que al aprobarse intentaría activar un
-- contrato ya activo.
-- Va como SQL crudo porque Prisma no expresa índices parciales en el schema.
CREATE UNIQUE INDEX "aprobaciones_una_pendiente_por_entidad"
  ON "aprobaciones" ("entidadId")
  WHERE "estado" = 'PENDIENTE';
