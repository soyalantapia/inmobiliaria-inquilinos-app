-- MovimientoCaja.propiedadId pasa a ser opcional.
--
-- POR QUÉ: cargar un gasto de caja obligaba a elegir una propiedad, y la inmobiliaria
-- tiene gastos que no son de ninguna (alquiler de la oficina, sueldos, un adelanto entre
-- cajas). Reportado en la prueba del 03/08: "sí o sí tengo que elegir una propiedad" y
-- "poder mover una caja igual sin que tenga que depender de una propiedad".
--
-- SEMÁNTICA: propiedadId NULL = movimiento PROPIO de la inmobiliaria.
--
-- CONSECUENCIA DE PLATA (deliberada, no un efecto colateral): POST /rendiciones filtra
-- los gastos por `propiedadId IN (propIdsConIngreso)`, así que un movimiento sin
-- propiedad no matchea y NUNCA se le descuenta a un propietario. Es lo correcto: es un
-- gasto de la inmobiliaria. Sí sigue entrando al cierre de caja del día.
--
-- SEGURA Y NO DESTRUCTIVA: sólo relaja un NOT NULL. Todas las filas existentes tienen
-- propiedadId y lo conservan; ninguna cambia de significado. Es reversible mientras no
-- se cargue ningún movimiento sin propiedad (para volver atrás habría que imputarlos
-- antes de re-poner el NOT NULL).

ALTER TABLE "movimientos_caja" ALTER COLUMN "propiedadId" DROP NOT NULL;
