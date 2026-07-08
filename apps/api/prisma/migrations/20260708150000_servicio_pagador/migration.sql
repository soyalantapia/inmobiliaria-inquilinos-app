-- Quién paga cada servicio público: el inquilino (default), la inmobiliaria, el
-- propietario o expensas. Si no lo paga el inquilino, su app lo muestra informativo.
CREATE TYPE "PagadorServicio" AS ENUM ('INQUILINO', 'INMOBILIARIA', 'PROPIETARIO', 'EXPENSAS');
ALTER TABLE "servicios_publicos" ADD COLUMN "pagador" "PagadorServicio" NOT NULL DEFAULT 'INQUILINO';
