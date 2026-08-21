-- Registro de DUEÑO de cada archivo del Volume (riesgo 🟠 #9 de work-agent/07-ECOSISTEMA.md).
--
-- POR QUÉ. `GET /uploads/:tenant/:name` autoriza SÓLO por tenant. Cualquier inquilino,
-- co-inquilino o profesional con link mágico que conozca el nombre lee CUALQUIER archivo de esa
-- inmobiliaria: el comprobante del 3°B, el DNI del inquilino de otro contrato, el recibo de
-- sueldo de un garante ajeno, el extracto bancario que subió la administradora. Lo único que lo
-- tapa hoy es que el nombre es un `randomUUID()`. Eso es oscuridad, no autorización: la URL
-- viaja en el `<img src>`, queda en el historial del browser y se reenvía como cualquier link.
--
-- La causa raíz es que NO EXISTE ningún registro de quién subió qué: de los 85 modelos del
-- schema, ninguno lo guarda. Esta tabla es ese registro que faltaba.
--
-- ⚠️ NACE VACÍA Y ESTA MIGRACIÓN NO SIEMBRA UNA SOLA FILA. Es deliberado y es la decisión más
-- importante del cambio.
--
-- El reflejo obvio sería backfillear el dueño de los archivos que ya están en el Volume leyendo
-- las 16 columnas que referencian URLs. NO se hace, por dos razones:
--
--   1. Ninguna de esas columnas guarda un dueño: guardan un VÍNCULO (este archivo es el
--      comprobante de este pago). Derivar "dueño" de ahí es adivinar, y adivinar mal en un
--      backfill significa que el día del deploy un inquilino real deja de ver un documento que
--      hoy ve. Eso es peor que el agujero que se viene a cerrar.
--
--   2. No hace falta. El guard nuevo tiene una segunda vía que consulta ESAS MISMAS FILAS en
--      vivo, acotadas al contrato de quien pide. La información que un backfill congelaría, el
--      guard la lee fresca; un backfill sería, en el mejor caso, un cache, y en el peor, un
--      cache desincronizado.
--
-- SEGURA Y NO DESTRUCTIVA: sólo CREATE TYPE + CREATE TABLE + índices. No toca ninguna fila
-- existente, no altera ninguna columna, no borra nada — y por eso no puede hacer fallar el
-- arranque del contenedor, que es el riesgo real de una migración acá (el CMD del Dockerfile
-- corre `db:deploy` ANTES de levantar la app: si la migración falla, producción no arranca).
--
-- Y NO CAMBIA NINGÚN COMPORTAMIENTO POR SÍ SOLA. El guard que la usa arranca en modo
-- observación (`UPLOADS_AMBITO=log` por defecto): el día del deploy se sirve todo igual que hoy
-- y sólo se registra una línea cuando se HABRÍA denegado. Prender el bloqueo es después, es una
-- variable de entorno y es del dueño.

-- CreateEnum
CREATE TYPE "AutorArchivo" AS ENUM ('USUARIO', 'INQUILINO', 'CO_INQUILINO', 'PROFESIONAL', 'SISTEMA');

-- CreateTable
CREATE TABLE "archivos_subidos" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    -- La URL servida tal cual la devuelve POST /uploads: '/uploads/<tenant>/<uuid>.<ext>'. Es el
    -- mismo string exacto que guardan las 16 columnas de archivo, y por eso sirve de clave: el
    -- guard reconstruye la URL desde los params del GET y busca por acá.
    "url" TEXT NOT NULL,
    "subidoPorKind" "AutorArchivo" NOT NULL,
    -- El id del actor dentro de su kind. NULL sólo para SISTEMA.
    "subidoPorId" TEXT,
    "origen" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivos_subidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archivos_subidos_url_key" ON "archivos_subidos"("url");

-- CreateIndex
CREATE INDEX "archivos_subidos_inmobiliariaId_idx" ON "archivos_subidos"("inmobiliariaId");

-- CreateIndex
CREATE INDEX "archivos_subidos_subidoPorId_idx" ON "archivos_subidos"("subidoPorId");

-- AddForeignKey
ALTER TABLE "archivos_subidos" ADD CONSTRAINT "archivos_subidos_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
