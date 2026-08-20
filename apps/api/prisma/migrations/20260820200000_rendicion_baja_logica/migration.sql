-- Anular una rendición deja de destruirla.
--
-- Era la única operación del sistema que borraba un registro de plata, y encima el único que
-- un TERCERO ya había visto: al propietario se le desaparecía del portal la tarjeta "te
-- depositamos $X", el total del año le bajaba solo y la plata volvía a figurarle como sin
-- rendir, sin una línea que lo explicara. Si llamaba a preguntar, la inmobiliaria tampoco
-- tenía con qué contestarle: no quedaba ni la fila.
--
-- Se conserva la CABECERA y se siguen borrando las líneas de los tres ledgers. Es deliberado:
-- 20 lugares del código las leen para saber qué se rindió, y filtrar "y que no esté anulada"
-- en los 20 es garantizar que un día se olvide uno. Ese olvido corrompe plata en silencio.
--
-- ADITIVA: tres columnas nullable. Las rendiciones existentes quedan en NULL = no anuladas,
-- que es lo que son. Las que se anularon ANTES de esto ya no están y no se pueden recuperar.
ALTER TABLE "rendiciones" ADD COLUMN IF NOT EXISTS "anuladaAt" TIMESTAMP(3);
ALTER TABLE "rendiciones" ADD COLUMN IF NOT EXISTS "anuladaPorId" TEXT;
ALTER TABLE "rendiciones" ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT;

-- SIN ÍNDICE NUEVO, a propósito.
--
-- La primera versión de esta migración creaba un parcial
-- `("propietarioId","periodo") WHERE anuladaAt IS NULL`. Una revisión lo marcó y tenía razón:
-- ya existe `@@index([propietarioId, periodo])` sobre la tabla entera, y las rendiciones
-- anuladas van a ser una minoría chiquita. El parcial es un subconjunto del que ya está, no
-- lo puede usar ninguna query que el otro no sirva igual de bien, y agrega una escritura por
-- cada INSERT y UPDATE de la tabla a cambio de nada.
--
-- Si algún día las anuladas fueran muchas y el planner sufriera, se agrega con la medición al
-- lado. Hoy sería un índice puesto por las dudas.

DO $$ BEGIN
  ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_anuladaPorId_fkey"
    FOREIGN KEY ("anuladaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
