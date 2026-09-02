-- Saber si un propietario entró alguna vez al portal.
--
-- Hoy no hay con qué contestarlo: el único rastro es `codigos_otp_propietario.usedAt`, que es
-- ambiguo —se escribe tanto al consumir un código como al invalidar los anteriores—. Sin esto
-- no sabemos si el portal se usa, la inmobiliaria no puede ver en la ficha si a ese dueño le
-- llegó el acceso, y si alguien pregunta quién entró y cuándo, no hay respuesta.
--
-- ADITIVA: columna nullable, sin default. Las filas existentes quedan en NULL, que es
-- exactamente lo que significa: no sabemos que hayan entrado.
ALTER TABLE "propietarios" ADD COLUMN IF NOT EXISTS "ultimoAccesoAt" TIMESTAMP(3);
