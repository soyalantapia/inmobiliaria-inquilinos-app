-- El default TOTAL de pagos.tipo tapaba la decisión: cuatro de los seis caminos
-- que crean pagos no lo pasaban y un cobro parcial quedaba etiquetado como
-- completo. Sacar el default hace que el cliente de Prisma lo exija (el
-- compilador marca cualquier camino que se lo saltee). No toca ninguna fila.
ALTER TABLE "pagos" ALTER COLUMN "tipo" DROP DEFAULT;
