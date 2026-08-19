-- Historial de cambios de reparto de una propiedad (T-23-N3-N1, mitad no bloqueada).
--
-- POR QUÉ: hoy no existe ningún rastro de cuándo alguien pasó a ser dueño de una unidad.
-- `participaciones_propietario` guarda sólo la foto de HOY, sin desde/hasta. Sin ese dato el
-- portal del propietario no puede recortar lo que muestra a "desde que sos dueño", y un
-- comprador ve el historial completo del inquilino anterior — sus reclamos con el texto que
-- escribió, y las últimas 6 cuotas con la fecha real en que pagó.
--
-- POR QUÉ NO SE USÓ `eventos_auditoria`: ese log es best-effort declarado (try/catch que se
-- traga su propio error, y corre DESPUÉS del commit). Un recorte que protege datos de un
-- tercero no puede colgar de algo que puede no escribirse. Esta tabla se escribe DENTRO de la
-- misma transacción que el reparto: si no se registra el cambio, el reparto tampoco cambia.
--
-- SEMÁNTICA DE LOS NULOS:
--   "porcentajeAnterior" NULL = ENTRÓ  (no tenía participación antes)
--   "porcentajeNuevo"    NULL = SALIÓ  (dejó de tener participación)
--
-- ⚠️ TABLA VACÍA = "toda participación existente se considera vigente desde siempre". El pasado
-- no tiene dato y NO se inventa: sólo se registra de acá en adelante. Por eso esta migración no
-- siembra una sola fila.
--
-- SEGURA Y NO DESTRUCTIVA: sólo CREATE TABLE + índices. No toca ninguna fila existente, no
-- altera ninguna columna, y **no cambia ningún comportamiento visible**: por ahora sólo se
-- escribe, nadie la lee todavía.
--
-- ORDEN RESPECTO DEL DEPLOY: **primero la migración, después el código.** El PUT de reparto
-- escribe acá dentro de su transacción; si el código sale antes, cambiar un reparto fallaría
-- entero. Al revés no pasa nada: la tabla queda vacía sin que nadie la use.
--
-- ⚠️ CUANTO ANTES SE APLIQUE, MEJOR. Cada día sin esto es historial que se pierde y no se puede
-- reconstruir: un cambio de dueño que ocurra antes de aplicarla queda sin registro para siempre.
--
-- SIN APLICAR. La corre el dueño.

-- CreateTable
CREATE TABLE "cambios_participacion" (
    "id" TEXT NOT NULL,
    "inmobiliariaId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "porcentajeAnterior" DOUBLE PRECISION,
    "porcentajeNuevo" DOUBLE PRECISION,
    "aplicadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" TEXT,

    CONSTRAINT "cambios_participacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambios_participacion_inmobiliariaId_idx" ON "cambios_participacion"("inmobiliariaId");

-- CreateIndex
-- El índice que va a usar el recorte de privacidad: "desde cuándo esta persona es dueña de
-- esta propiedad" se responde con el primer registro de ese par, ordenado por fecha.
CREATE INDEX "cambios_participacion_propiedadId_propietarioId_aplicadoAt_idx" ON "cambios_participacion"("propiedadId", "propietarioId", "aplicadoAt");

-- AddForeignKey
-- SÓLO el tenant lleva FK. `propiedadId` y `propietarioId` van sin ella, igual que `autorId` y
-- que `alquileres_rendidos.propiedadId`: el rastro tiene que SOBREVIVIR al borrado de la
-- propiedad o del propietario, no bloquearlo. Con RESTRICT, borrar una propiedad que alguna vez
-- cambió de reparto tiraría 500 (el DELETE no limpia esta tabla, ni debería); con CASCADE, el
-- historial moriría con ella — que es justo lo que no puede perderse.
ALTER TABLE "cambios_participacion" ADD CONSTRAINT "cambios_participacion_inmobiliariaId_fkey" FOREIGN KEY ("inmobiliariaId") REFERENCES "inmobiliarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
