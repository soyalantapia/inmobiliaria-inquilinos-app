# Dos campos que se guardan y no hacen nada — y las dos decisiones que faltan

Los últimos dos hallazgos de la auditoría del 31/08 que no se pueden cerrar sin una decisión de
producto. **Los textos que afirmaban lo contrario ya están corregidos** (van en este mismo PR):
el usuario deja de leer una promesa falsa hoy, sin esperar la decisión.

---

## 1. 🔴 La comisión que cargás por contrato se imprime en el contrato firmado y no la cobra ninguna rendición

**Dónde.** Se escribe en `apps/api/src/routes/core.ts` (alta de contrato). El único lector real es
`apps/inmobiliaria/src/lib/contrato-generator.ts`.

**Qué pasa.** `Contrato.comisionInmobiliaria` **no lo lee ningún cálculo de plata**. La rendición,
el cierre de caja y la ganancia por contrato descuentan **`Propietario.comisionPct`** (default 8%).

El campo sí tiene un consumidor, y es el peor posible: **el generador lo estampa en la Cláusula
Sexta — Honorarios de intermediación del Word que firman las partes.**

**El escenario.** En el alta se pacta 3%. El contrato que se firma dice *"el LOCATARIO abonará …
el equivalente al **3%** mensual del canon"*. Toda rendición posterior descuenta el 8% del
propietario, y ese 8 queda congelado en `Rendicion.comisionPct`, visible en el portal del dueño.
**El papel firmado y la plata efectivamente tomada no coinciden.**

**Agravante:** no existe ningún PATCH/PUT para este campo, así que si se cargó mal en el alta,
desde el panel no se corrige nunca.

**Por qué existe.** Son dos comisiones conceptualmente distintas —honorarios contra el LOCATARIO
vs. descuento contra el PROPIETARIO— que quedaron con el mismo rótulo y sin cablear entre sí.

### La decisión

| Opción | Costo | Qué implica |
|---|---|---|
| **A. Honrar la tasa por contrato en la rendición** | **grande** | La rendición es por propietario+período y agrega **varios contratos** en un solo `montoBruto`. Habría que comisionar por liquidación y repensar el `comisionPct` congelado de `Rendicion`. |
| **B. Sacar el campo del alta** | chico | Se pierde la cláusula personalizada en el Word: todos los contratos saldrían con la comisión del propietario. |
| **C. Dejarlo, rotulado como lo que es** | ya hecho | Es lo que hace este PR: el copy ahora dice que se imprime en el contrato y que **lo que se descuenta es la del propietario**. |

**Mi lectura:** C ya frena el daño. Entre A y B, la pregunta real es si las inmobiliarias pactan
honorarios **distintos por contrato** o si el 8% del propietario alcanza. Si es lo segundo, B; y
si es lo primero, A es un proyecto, no un arreglo.

---

## 2. 🟡 El preaviso de rescisión se guarda, no lo lee nadie, y el código decía que sí

**Dónde.** `apps/api/src/routes/operacion.ts` (`PUT /mi-inmobiliaria/rescision`) — sin ningún lector.

**Qué pasa.** `Inmobiliaria.preavisoRescisionMesesDefault` se escribe y sólo se relee en
`GET /mi-inmobiliaria/reglas` para **repintar el mismo input**. Cero consumidores.

Su gemelo de la misma tarjeta, `penalidadRescisionMesesDefault`, **sí** se consume: `core.ts` lo
usa como penalidad sugerida al finalizar, y eso termina emitido como `CargoContrato`.

**El escenario.** El admin entra a `/mi-inmobiliaria`, pone preaviso 3 y penalidad 2, aprieta
Guardar, ve el toast de éxito. La penalidad cambia de verdad el diálogo de finalizar contrato. El
preaviso queda escrito en una columna que nadie consulta: ninguna pantalla lo muestra, ninguna
alerta lo usa, ningún cálculo de fecha lo lee. **Como el compañero de tarjeta funciona, el admin
queda convencido de que configuró la política de preaviso.**

**Los dos textos que lo sostenían, ya corregidos:**

- el comentario del server decía *"La heredan los contratos sin valor propio (core.ts la lee al
  finalizar)"* — cierto para la penalidad, falso para el preaviso;
- el copy del panel decía *"podés pisarlo contrato por contrato"* — **imposible**: `Contrato` sólo
  tiene `penalidadRescisionMeses`, no hay columna de preaviso.

*(Nada que ver con el preaviso de **egreso** —`Renovacion.fechaEgreso`—, que sí funciona.)*

### La decisión

| Opción | Costo | Qué implica |
|---|---|---|
| **A. Darle un consumidor real** | mediano | Lo natural: una alerta *"a este contrato le vence el plazo de preaviso en X días"*. Requiere definir desde cuándo se cuenta y dónde se muestra. |
| **B. Sacar el campo** | chico | Una columna menos y una tarjeta más honesta. |
| **C. Dejarlo informativo** | ya hecho | Este PR: el copy dice que hoy queda sólo como referencia y no dispara nada. |

**Mi lectura:** la pregunta para Camila es si el preaviso es algo que ella **quiere que el sistema
le avise** o un dato que anota para saberlo. Si es lo primero, A. Si es lo segundo, C alcanza y no
hay nada más que hacer.

---

## Lo que sí se hizo sin esperar

Las tres afirmaciones falsas —el copy de la comisión, el copy del preaviso y el comentario del
server— quedan corregidas. **Es la parte que no depende de ninguna decisión:** un texto que
promete algo que el código no hace es peor que la ausencia de la función, porque nadie va a ir a
verificarlo.

---

## 3. Y cuatro campos más del mismo bloque, sin lector

Salieron de la segunda auditoría, en la misma tarjeta **"Contacto y presencia"** de
`/mi-inmobiliaria` de la que salió el WhatsApp. Verificados uno por uno: los cuatro aparecen
**sólo** en su propio formulario, su propio zod, y el `GET /empresa` que repinta ese formulario.

| Campo | Qué podría hacer | Cuesta |
|---|---|---|
| `horariosAtencion` | Mostrarle al inquilino cuándo atienden, al lado del botón de WhatsApp. Es el más plausible de los cuatro: hoy el inquilino escribe un domingo a las 23 y no sabe que nadie va a leerlo hasta el lunes. | chico |
| `sitioWeb` | Un link en el pie del portal del propietario o en los mails salientes. | chico |
| `instagram` / `facebook` | Ídem, o nada. | chico |

*(Ojo al grepear: `sitioWeb` también existe en **Cupon**, y ése **sí** se usa —`convenios-browser`
lo renderiza como link—. Son dos campos distintos con el mismo nombre.)*

**La diferencia con el WhatsApp, y por eso éstos no se arreglaron:** el WhatsApp tenía un
comportamiento **equivocado** —abría un chat que no existe—, y eso se arregla sin preguntar. Estos
cuatro simplemente no hacen nada. Darles un consumidor es agregar una función, y eso es una
decisión.

**La pregunta concreta:** ¿la tarjeta "Contacto y presencia" es la ficha pública de la
inmobiliaria —y entonces esos datos tienen que llegar al inquilino y al propietario— o es una
libreta interna? Si es lo segundo, alcanza con rotularla así y no hay nada más que hacer.
