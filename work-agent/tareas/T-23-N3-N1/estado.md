# T-23-N3-N1 · Que el propietario vea "desde que sos dueño"

- **fase:** 8 para la mitad no bloqueada · la otra mitad **sigue bloqueada**
- **commit:** `a5e2019` · rama `feat/T-23-N3-N1-historial-reparto`

## Qué se hizo, y por qué se partió en dos

La tarea tiene dos mitades y sólo una estaba bloqueada:

1. **Empezar a registrar los cambios de reparto** — no depende de ninguna decisión. **HECHO.**
2. **Usar ese dato para recortar lo que el portal le muestra al propietario** — depende de la
   respuesta de Camila. **SIGUE BLOQUEADA. No se tocó una línea del portal.**

**Por qué la 1 ahora y no cuando se destrabe la 2:** hoy no existe ningún rastro de cuándo
alguien pasó a ser dueño de una unidad. Cada día sin esto es **historial que se pierde y no se
puede reconstruir** — un cambio de dueño que ocurra antes de aplicar la migración queda sin
registro para siempre. Empezar a grabar no depende de la decisión pendiente; usar lo grabado, sí.

Por ahora la tabla **sólo se escribe: nadie la lee**. Cero cambios de comportamiento visible.

## Las tres decisiones de diseño

**No se usó `registrarEvento`.** La auditoría es best-effort declarada (`try/catch` que se traga
su propio error, y corre *después* del commit). De este dato va a colgar un recorte de
**privacidad** sobre datos de un tercero —los reclamos del inquilino con el texto que escribió, y
sus últimas 6 cuotas con la fecha real de pago— y eso no puede colgar de algo que puede no
escribirse. La fila se crea **dentro** de la misma transacción que el reparto.

**El estado anterior se lee dentro de la transacción y ANTES del `deleteMany`**: es la única
ventana en la que existe, y un `findMany` afuera podría leer una foto que otra request ya cambió.

**Sólo se registra lo que CAMBIÓ.** Si un dueño que siguió igual generara fila, su primer
registro pasaría a ser hoy — y el futuro recorte le escondería el historial de una unidad que
tiene desde siempre. El diff vive aparte (`lib/diff-participaciones.ts`) con 7 tests puros
verificados en rojo.

## Un bug que encontré al hacerlo

La FK con `RESTRICT` sobre `propiedadId` habría roto el borrado de propiedades: el `$transaction`
del `DELETE /propiedades/:id` no limpia esta tabla —ni debería, es append-only— así que borrar
una propiedad que alguna vez cambió de reparto habría tirado 500. Es el mismo bug que ya había
aparecido con la FK del OTP del propietario (T-23).

Se resolvió sin FK en `propiedadId` ni `propietarioId`, siguiendo el precedente que ya existe en
el repo (`AlquilerRendido.propiedadId`, "snapshot, sin FK") y el criterio del propio `autorId`:
**el rastro tiene que sobrevivir al borrado, no bloquearlo**. Con `CASCADE` habría muerto con la
propiedad, que es justo lo que no puede pasar.

## ⚠️ Necesita tu mano

**1. Aplicar `20260819200000_historial_reparto` — y cuanto antes.** No por riesgo, sino porque
cada día sin ella es historial perdido. Es `CREATE TABLE` puro: no toca una fila, no cambia
ningún comportamiento. Va **antes** del código (el PUT escribe ahí dentro de su transacción).

**2. La pregunta que sigue bloqueando la otra mitad**, textual para Camila:

> *"¿Hay hoy en la cartera departamentos que cambiaron de dueño mientras el inquilino seguía
> siendo el mismo?"*

Si dice que **no**, el recorte ampliado sale tal cual. Si dice que **sí**, hay que cargar a mano
la fecha de compra de esas unidades **antes** de soltarlo — porque con la regla "sin cambio
registrado = dueño de siempre", esas unidades le mostrarían al comprador el historial completo
del inquilino. Hoy eso está tapado por el recorte al contrato vigente; con el cambio se destapa.

Equivocarse ahí es filtrarle datos de un inquilino a alguien que no tiene derecho a verlos, así
que no lo hago sin la respuesta.

## Verificación

`tsc` 0 en `apps/api` después del merge; **310 tests puros en verde** (32 archivos), 7 nuevos
verificados en rojo.

**No probado en el navegador:** no hay superficie visible que probar — la tabla sólo se escribe.
El clasificador de seguridad de la sesión sigue bloqueando el preview de todos modos.
