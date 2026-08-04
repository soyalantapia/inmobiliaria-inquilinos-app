-- Quién del STAFF registró un cobro manual.
--
-- Antes el cobro manual escribía `decididoPorId = el usuario que lo cargaba` en el
-- mismo instante en que lo dejaba CONCILIADO: cargar y autorizar eran la MISMA
-- acción, de la misma persona, sin rastro de que hubieran sido dos decisiones.
-- Con esta columna el que carga y el que autoriza quedan separados, y un cobro
-- pendiente sabe de quién es.
--
-- Aditiva y nullable: las filas viejas quedan en NULL (no sabemos, y no lo
-- inventamos). Los pagos informados por el inquilino nunca la tienen.
ALTER TABLE "pagos" ADD COLUMN "registradoPorId" TEXT;

CREATE INDEX "pagos_registradoPorId_idx" ON "pagos"("registradoPorId");

ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registradoPorId_fkey"
  FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
