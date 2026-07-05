-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "dni" TEXT,
    "email" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "telefono" TEXT,
    "cuit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "inquilinos" ADD COLUMN     "personaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "personas_inmobiliariaId_dni_key" ON "personas"("inmobiliariaId", "dni");

-- CreateIndex
CREATE INDEX "personas_inmobiliariaId_idx" ON "personas"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "inquilinos_personaId_idx" ON "inquilinos"("personaId");

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
