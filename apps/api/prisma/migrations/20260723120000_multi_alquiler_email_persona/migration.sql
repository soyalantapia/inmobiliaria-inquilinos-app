-- Multi-alquiler: el email deja de ser único a nivel Inquilino (fila-por-contrato) y
-- pasa a serlo a nivel Persona (la identidad de login). Desbloquea que un mismo
-- inquilino tenga VARIOS contratos en la misma inmobiliaria (3 locales, consorcio de
-- 10 deptos): antes el 2º contrato con el mismo email daba "ya está en tu cartera".
-- El login OTP ya soporta múltiples inquilinos por email (findMany → elegir alquiler).
--
-- NOTA de deploy: el índice único de personas.email falla si hay DOS personas con el
-- mismo email no-null en una inmobiliaria. Es improbable (Persona se agrupa por DNI y
-- el email viene del inquilino), pero conviene verificarlo antes de deployar.
DROP INDEX "inquilinos_inmobiliariaId_email_key";
CREATE UNIQUE INDEX "personas_inmobiliariaId_email_key" ON "personas"("inmobiliariaId", "email");
