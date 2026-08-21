-- El código del certificado dejaba de ser derivable, y eso obliga a cambiarle la clave.
--
-- ANTES: `hash` se calculaba con FNV-1a + djb2 sobre `DNI | contratoId | nombreInmobiliaria`,
-- sin sal ni secreto, y truncado a 12 caracteres. Determinístico: cualquiera con esos tres
-- datos —y el nombre de la inmobiliaria es público— reproducía el código de otra persona.
-- El `upsert` de `/certificado` se apoyaba en eso: buscaba `where: { hash }` y encontraba la
-- fila porque el hash siempre daba igual.
--
-- AHORA el código es aleatorio (60 bits), así que buscar por hash no encontraría nunca la fila
-- previa: cada visita a /certificado crearía una fila NUEVA y dejaría la anterior huérfana, con
-- PII adentro (nombre, DNI, email, teléfono, dirección, monto) y sin nada que la borre. Por eso
-- la clave del upsert pasa a ser (inquilinoId, contratoId), que es la relación real: una persona
-- tiene UN certificado por contrato.

-- 1) BORRADO DE LA TABLA — decisión consciente, autorizada por el dueño.
--
-- Hace falta porque el índice único de abajo no puede crearse si hay duplicados, y puede
-- haberlos: si una inmobiliaria se renombró, la semilla cambiaba y se creaba una segunda fila
-- para el mismo (inquilino, contrato). Un `CREATE UNIQUE INDEX` sobre duplicados FALLA, y acá
-- una migración que falla deja el contenedor sin arrancar: producción caída.
--
-- Es seguro perder estas filas, y se verificó una por una:
--   · NINGÚN endpoint LEE esta tabla. Las únicas dos referencias en toda la API son el `upsert`
--     de `/certificado` (inquilino-mundo.ts) y un `deleteMany` en cascada (plata.ts). No existe
--     todavía la página pública de verificación, así que ningún código impreso se puede
--     canjear en ninguna parte: no hay nada que se rompa por perderlos.
--   · La fila se REGENERA sola la próxima vez que el inquilino abre /certificado, con todos sus
--     datos recalculados en el momento (son snapshots derivados, no fuente de verdad).
--   · Nada apunta a esta tabla: sus tres FKs son SALIENTES (a inmobiliarias, inquilinos y
--     contratos). Ninguna otra tabla la referencia, así que el DELETE no cascadea a nada.
--
-- Y hay un motivo POSITIVO para borrar, no sólo la conveniencia del índice: los códigos viejos
-- son los débiles. Conservarlos dejaría a los certificados ya emitidos con un identificador
-- derivable para siempre, que es justo lo que este cambio viene a cerrar.
DELETE FROM "certificados_inquilino";

-- 2) La clave estable. Va DESPUÉS del borrado por lo dicho arriba.
CREATE UNIQUE INDEX "certificados_inquilino_inquilinoId_contratoId_key"
    ON "certificados_inquilino"("inquilinoId", "contratoId");
