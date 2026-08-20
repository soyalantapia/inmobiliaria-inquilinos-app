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

UPDATE "usuarios"
SET "pinHash"             = NULL,
    "pinIntentosFallidos" = 0,
    "pinBloqueadoHasta"   = NULL
WHERE "pinHash" IS NOT NULL;
