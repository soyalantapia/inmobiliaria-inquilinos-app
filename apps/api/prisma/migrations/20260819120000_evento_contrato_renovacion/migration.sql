-- TipoEventoContrato gana el valor RENOVACION.
--
-- POR QUÉ: la renovación de un contrato venía escribiendo su evento de historial como
-- `AJUSTE_APLICADO`, porque el enum no tenía un valor propio. En el timeline del contrato
-- una renovación y un simple ajuste de canon se veían iguales, y son cosas distintas: una
-- extiende el plazo del alquiler, la otra sólo cambia el monto.
--
-- SEGURA Y NO DESTRUCTIVA: sólo agrega un valor al enum. No toca ninguna fila. Los eventos
-- de renovación ya escritos siguen como AJUSTE_APLICADO — no se reescriben, porque el
-- título de esos eventos ya dice "Renovación: …" y reinterpretar historial viejo es peor
-- que dejarlo con su rótulo de época.
--
-- ORDEN DE DEPLOY: aplicar ANTES de subir el backend. Agregar un valor de enum es
-- compatible con el código viejo; al revés no: el código nuevo escribiría 'RENOVACION'
-- contra un enum que no lo tiene y fallaría al renovar un contrato.

ALTER TYPE "TipoEventoContrato" ADD VALUE IF NOT EXISTS 'RENOVACION';
