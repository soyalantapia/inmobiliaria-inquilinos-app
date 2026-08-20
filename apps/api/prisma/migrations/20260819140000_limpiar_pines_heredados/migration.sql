-- T-35 · Limpiar los PIN que nadie eligió.
--
-- Hasta ahora el alta de una inmobiliaria (scripts/onboarding-real.mjs) escribía
-- el `pinHash` de cada usuario extra copiando el del admin:
--
--     pinHash: bcrypt.hashSync(u.pin ?? A.pin, 10)
--
-- y el seed de desarrollo le ponía el mismo PIN a sus tres usuarios. O sea: hay
-- `pinHash` vivos que su dueño nunca eligió, y que en algunos casos son el PIN
-- de OTRA persona.
--
-- Hoy eso es inofensivo: `verificarPinUsuario` (apps/api/src/auth/pin.ts) siempre
-- aprueba, así que ningún `pinHash` autentica nada. Pero T-25 convierte el PIN en
-- la credencial para cambiar de usuario en una máquina compartida — que es
-- justamente lo que Camila pidió— y ahí un PIN heredado deja de ser inofensivo:
-- pasa a ser la llave para hacerse pasar por el admin.
--
-- Se borran TODOS, no sólo los sospechosos, porque no hay forma de distinguir
-- desde la base cuál lo eligió su dueño y cuál se heredó. No se pierde nada
-- (ninguno autenticó nunca) y es la única manera de garantizar que, de acá en
-- adelante, todo `pinHash` vivo lo escribió su dueño desde su propia sesión
-- (POST /auth/pin).
--
-- Los contadores de intentos/bloqueo se resetean junto con el hash: un bloqueo
-- por fallar un PIN que ya no existe no tiene sentido.
--
-- ORDEN IMPORTA: esto tiene que correr ANTES o JUNTO con la migración que
-- habilite T-25. Si T-25 entra primero, hay una ventana en la que los PIN
-- heredados autentican de verdad.

-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES DE BORRAR: dejar constancia de a quién afectaba.
--
-- POR QUÉ. La pregunta que abrió T-35 —¿hubo usuarios con la credencial del admin?— sólo se
-- puede responder mirando QUIÉN tenía `pinHash` y `passwordHash` seteados. El UPDATE de abajo
-- borra justamente eso, así que después del deploy la respuesta se pierde para siempre.
--
-- La alternativa era pedirle al dueño que corriera una consulta a mano ANTES de desplegar, y
-- confiar en que se acuerde. Esto lo hace solo y no se puede saltear.
--
-- QUÉ GUARDA Y QUÉ NO. Sólo los BOOLEANOS de si cada campo estaba seteado, más id/email/rol.
-- **No copia ningún hash**: mover un hash de contraseña a otra tabla sería crear una segunda
-- copia de una credencial para responder una pregunta forense, que es peor que la pregunta.
--
-- Y una aclaración que evita una conclusión falsa: comparar los `passwordHash` ENTRE SÍ no
-- prueba nada, porque bcrypt sala cada hash y dos personas con la misma contraseña tienen
-- hashes distintos. Para confirmar que alguien heredó la credencial del admin hay que probar la
-- contraseña del admin contra el hash del otro. Esta tabla dice a quién MIRAR, no da el veredicto.
CREATE TABLE IF NOT EXISTS "_t35_usuarios_con_credencial" (
    "usuarioId"      TEXT PRIMARY KEY,
    "inmobiliariaId" TEXT,
    "email"          TEXT,
    "rol"            TEXT,
    "teniaPin"       BOOLEAN NOT NULL,
    "teniaPassword"  BOOLEAN NOT NULL,
    "registradoAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "_t35_usuarios_con_credencial"
    ("usuarioId", "inmobiliariaId", "email", "rol", "teniaPin", "teniaPassword")
SELECT u."id", u."inmobiliariaId", u."email", u."rol"::text,
       (u."pinHash" IS NOT NULL), (u."passwordHash" IS NOT NULL)
FROM "usuarios" u
WHERE u."pinHash" IS NOT NULL
ON CONFLICT ("usuarioId") DO NOTHING;  -- idempotente: re-correr no duplica ni pisa

UPDATE "usuarios"
SET "pinHash"             = NULL,
    "pinIntentosFallidos" = 0,
    "pinBloqueadoHasta"   = NULL
WHERE "pinHash" IS NOT NULL;

-- Para leerla después del deploy:
--   SELECT * FROM "_t35_usuarios_con_credencial" ORDER BY "inmobiliariaId", "rol";
-- Si aparecen usuarios de roles DISTINTOS del mismo tenant con `teniaPassword = true`, ahí hay
-- que verificar a mano si comparten contraseña. Si la tabla queda vacía, no había nadie
-- afectado y se puede borrar con un DROP.
