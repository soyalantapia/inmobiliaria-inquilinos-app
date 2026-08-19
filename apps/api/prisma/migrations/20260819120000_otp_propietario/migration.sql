-- Portal del propietario (T-23): tabla de códigos OTP para su login.
--
-- POR QUÉ: el propietario no tiene contraseña ni cuenta de panel. Entra con su email y un
-- código de 6 dígitos, igual que el inquilino (`codigos_otp`) y que el admin
-- (`codigos_otp_usuario`). Este es el tercer gemelo, keyed a `propietarioId`.
--
-- POR QUÉ UNA TABLA Y NO UNA GENÉRICA CON UN CAMPO `tipo`: para conservar la FK real. Con
-- una tabla única, un código podría apuntar a un id de otra tabla y nada lo impediría; acá
-- eso no es representable. Es el mismo criterio con el que ya conviven las otras dos.
--
-- SEGURA Y NO DESTRUCTIVA: sólo CREATE TABLE + índices. No toca ninguna fila existente, no
-- cambia ninguna columna y no tiene efecto sobre el sistema hasta que se despliegue el
-- código que la usa. Es reversible con un DROP TABLE mientras no haya códigos vivos (y aun
-- con códigos vivos: el peor caso es que alguien tenga que pedir el código de nuevo).
--
-- ORDEN RESPECTO DEL DEPLOY: **primero la migración, después el código.** El código nuevo
-- lee y escribe esta tabla; si sale antes, el login del propietario tira 500. Al revés no
-- pasa nada: la tabla queda vacía sin que nadie la use.
--
-- SIN APLICAR. La corre el dueño.

-- CreateTable
CREATE TABLE "codigos_otp_propietario" (
    "id" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_otp_propietario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_otp_propietario_propietarioId_idx" ON "codigos_otp_propietario"("propietarioId");

-- AddForeignKey
ALTER TABLE "codigos_otp_propietario" ADD CONSTRAINT "codigos_otp_propietario_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
