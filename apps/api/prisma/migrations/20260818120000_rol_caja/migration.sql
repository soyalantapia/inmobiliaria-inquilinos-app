-- Rol CAJA: puesto de mostrador que confirma/rechaza pagos y mueve la caja.
--
-- POR QUÉ: hasta ahora `pago.conciliar` y `pago.rechazar` las tenía OPERADOR, o sea que
-- cualquiera del día a día podía dar plata por cobrada. La administradora lo marcó como
-- error en la prueba del 03/08: "hay uno solo que se tiene que llamar caja y tiene que
-- ser el usuario del cajero, nada más. Y yo como administradora. Los demás, nadie puede
-- autorizar un pago." La matriz vive en packages/shared/src/permisos.ts; acá sólo se
-- agrega el valor al enum de Postgres.
--
-- SEGURA Y NO DESTRUCTIVA: sólo agrega un valor al enum. No toca ninguna fila, no
-- reasigna roles y no borra nada. Los usuarios existentes conservan su rol tal cual.
-- El cambio de comportamiento para los OPERADOR que hoy conciliaban pagos es de
-- APLICACIÓN (la matriz de capacidades), no de datos: después de deployar hay que
-- pasar a CAJA a quien atienda el mostrador, desde Configuración → Equipo.
--
-- ADVERTENCIA DE ORDEN DE DEPLOY: aplicar esta migración ANTES de subir el backend es
-- lo correcto (agregar el valor es compatible con el código viejo). Al revés —código
-- nuevo contra enum viejo— un alta con rol CAJA fallaría con un error de enum inválido.

ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'CAJA';
