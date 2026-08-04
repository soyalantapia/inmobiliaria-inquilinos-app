-- Deuda histórica cobrable — dos columnas ADITIVAS, ambas con default (ninguna fila
-- existente cambia de comportamiento).
--
-- ajustes_alquiler.origenAlta: marca las vigencias de canon materializadas por el ALTA
-- de un contrato en curso (vigenciasCanon). Sin la marca, el historial de ajustes y el
-- timeline las mostrarían como un ajuste aplicado hoy, que es falso: son la historia
-- del canon que el contrato ya traía en papel.
ALTER TABLE "ajustes_alquiler" ADD COLUMN "origenAlta" BOOLEAN NOT NULL DEFAULT false;

-- contratos.moraHistoricaCongelada: interruptor por contrato para la mora de los meses
-- viejos declarados en el alta. false (default) = la mora SIGUE CORRIENDO con el esquema
-- (no se persiste montoPunitorioManual). Los contratos ya cargados quedan en false, que
-- es el comportamiento que hay que ofrecer de acá en adelante; su montoPunitorioManual
-- ya escrito no se toca (sigue congelado, como se declaró en su momento).
ALTER TABLE "contratos" ADD COLUMN "moraHistoricaCongelada" BOOLEAN NOT NULL DEFAULT false;
