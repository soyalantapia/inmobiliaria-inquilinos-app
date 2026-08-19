-- A qué casilla va cada tipo de aviso automático de la inmobiliaria (T-17-N1).
--
-- POR QUÉ: hasta ahora TODOS los avisos iban a `Inmobiliaria.email`, una sola casilla. Camila
-- administra 220 propiedades: "me va a llegar un mail por cada reclamo… y todos van a mi misma
-- casilla, no a la de la chica que los maneja. Habría que poder decir a quién le llega cada
-- cosa." Su bandeja se llena de avisos que ella no va a accionar, y la persona que sí tiene que
-- accionarlos no se entera.
--
-- SEMÁNTICA DEL FALLBACK: la AUSENCIA de fila significa "usá `Inmobiliaria.email`", que es el
-- comportamiento de siempre. Por eso la tabla nace vacía y no se siembra nada: hasta que alguien
-- configure una casilla, no cambia absolutamente nada. Y borrar la fila vuelve atrás.
--
-- SEGURA Y NO DESTRUCTIVA: sólo CREATE TYPE + CREATE TABLE + índices. No toca ninguna fila
-- existente, no modifica ninguna columna, y no tiene efecto hasta que se configure una casilla.
-- Reversible con DROP TABLE + DROP TYPE.
--
-- ORDEN RESPECTO DEL DEPLOY: **primero la migración, después el código.** El código nuevo
-- consulta esta tabla al resolver el destinatario; si sale antes, el aviso de reclamo nuevo
-- tiraría error (y como es best-effort, se perdería en silencio). Al revés no pasa nada: la
-- tabla queda vacía sin que nadie la use.
--
-- SIN APLICAR. La corre el dueño.

-- CreateEnum
CREATE TYPE "TipoAvisoInmo" AS ENUM ('RECLAMO_NUEVO');

-- CreateTable
CREATE TABLE "destinatarios_aviso" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "tipo" "TipoAvisoInmo" NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinatarios_aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destinatarios_aviso_inmobiliariaId_tipo_key" ON "destinatarios_aviso"("inmobiliariaId", "tipo");

-- AddForeignKey
ALTER TABLE "destinatarios_aviso" ADD CONSTRAINT "destinatarios_aviso_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
