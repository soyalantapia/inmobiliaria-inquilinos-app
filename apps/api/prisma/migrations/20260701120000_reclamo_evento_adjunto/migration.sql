-- AlterTable: adjunto opcional en los eventos del reclamo (chat con adjuntos).
ALTER TABLE "reclamo_eventos" ADD COLUMN "adjuntoUrl" TEXT;
