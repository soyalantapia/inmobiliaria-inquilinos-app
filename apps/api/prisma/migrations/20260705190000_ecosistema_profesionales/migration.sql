-- Ecosistema de profesionales: identidad global (ProfesionalRed) + link opt-in
-- desde el Profesional privado de cada inmobiliaria. Todo aditivo (nullable/default).

-- CreateTable: identidad global del profesional (sin inmobiliariaId)
CREATE TABLE "profesionales_red" (
    "id" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaProfesional" NOT NULL,
    "zona" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "garantizado" BOOLEAN NOT NULL DEFAULT false,
    "publicadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profesionales_red_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profesionales_red_telefono_key" ON "profesionales_red"("telefono");
CREATE INDEX "profesionales_red_categoria_idx" ON "profesionales_red"("categoria");

-- AlterTable: link opt-in del Profesional privado a la identidad global
ALTER TABLE "profesionales" ADD COLUMN "publico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profesionales" ADD COLUMN "profesionalRedId" TEXT;

CREATE INDEX "profesionales_profesionalRedId_idx" ON "profesionales"("profesionalRedId");

ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_profesionalRedId_fkey"
    FOREIGN KEY ("profesionalRedId") REFERENCES "profesionales_red"("id") ON DELETE SET NULL ON UPDATE CASCADE;
