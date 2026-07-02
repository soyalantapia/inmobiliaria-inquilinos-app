-- Unicidad de identificación de UF por consorcio (backstop de la validación de la
-- app; corta la carrera de doble alta). Prod tiene 0 unidades → sin riesgo de
-- duplicados preexistentes.
CREATE UNIQUE INDEX "unidades_funcionales_consorcioId_identificacion_key"
  ON "unidades_funcionales"("consorcioId", "identificacion");
