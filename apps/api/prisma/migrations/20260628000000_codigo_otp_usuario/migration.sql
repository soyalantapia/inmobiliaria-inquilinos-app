-- CreateTable
CREATE TABLE "codigos_otp_usuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_otp_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_otp_usuario_usuarioId_idx" ON "codigos_otp_usuario"("usuarioId");

-- AddForeignKey
ALTER TABLE "codigos_otp_usuario" ADD CONSTRAINT "codigos_otp_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
