-- Las condonaciones de los 16 días en que la marca no existía.
--
-- El botón "Condonar" salió el 05/07/2026 (b3325e91) y crea un Pago CONCILIADO por el saldo
-- entero de la cuota: cancela la deuda del inquilino sin que haya entrado un peso. La columna
-- `condonado`, que es lo único que distingue eso de un cobro real, se agregó el 21/07
-- (20260721220000_pago_condonado) ADITIVA, con DEFAULT false y SIN backfill.
--
-- O sea que toda condonación hecha entre el 05 y el 21 de julio quedó, para el sistema, igual
-- que plata que entró. Y las dos superficies que la marca vino a proteger la siguen contando:
--
--   · el cierre de caja la suma como ingreso del día, con comisión;
--   · `POST /rendiciones` se la RINDE AL PROPIETARIO — le transfiere plata que nunca se cobró.
--
-- El `observacion` es la firma exacta y única de ese camino: lo escribe sólo `saldar-deuda` con
-- `condonar: true` (plata.ts), textual desde el 05/07 y sin cambios. Los otros dos endpoints
-- donde una persona puede escribir `observacion` libre —`/pagos/:id/rechazar` y `/pagos/:id/anular`—
-- dejan el pago en RECHAZADO o ANULADO, nunca en CONCILIADO, así que no pueden colarse acá.
--
-- El corte por fecha es cinturón y tirantes: desde que la columna existe, esas filas ya nacen en
-- `true`, así que sin el corte igual no las tocaría. Con el corte, un `observacion` tipeado a mano
-- con ese texto exacto en el futuro tampoco se marca por accidente.
UPDATE "pagos"
   SET "condonado" = true
 WHERE "condonado" = false
   AND "estado" = 'CONCILIADO'
   AND "observacion" = 'Condonación de deuda (ex-inquilino)'
   AND "decididoAt" < TIMESTAMP '2026-07-22 00:00:00';
