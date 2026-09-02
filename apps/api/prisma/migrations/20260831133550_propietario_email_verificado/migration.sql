-- T-23-N2-N1 · Cuándo se probó que el email del propietario es suyo.
--
-- Prisma genera además un DROP/ADD de `movimientos_caja_propiedadId_fkey`, y se saca a mano:
-- es DERIVA preexistente entre el schema —que no declara `onDelete`, y el default de Prisma
-- para una relación opcional es SetNull— y la base, que la creó RESTRICT en la migración
-- inicial. Arrastrarla acá cambiaría el borrado sin que nadie lo pida, y no es cosmético: la
-- rendición filtra los gastos por `propiedadId`, así que anularlo deja de descontárselo a su
-- propietario. La raíz se arregla en su propio PR, declarando el RESTRICT que la base ya tiene.
ALTER TABLE "propietarios" ADD COLUMN     "emailVerificadoAt" TIMESTAMP(3);
