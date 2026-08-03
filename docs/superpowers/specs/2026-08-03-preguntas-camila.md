# Preguntas para Camila — 03/08/2026

Consolidado de tres fuentes: el re-análisis de la reunión del 23/07 (23 de 33 causas
bloqueadas esperando respuesta suya), las decisiones abiertas del rediseño del alta de
contrato, y la verificación de lo que quedó en producción.

**Regla de oro: no mandarle las 24 juntas.** El bloque 1 son seis preguntas y destraba
más que las otras dieciocho sumadas. Lo demás se pregunta cuando llegue su turno.

---

## Contexto: qué NO hace falta preguntarle

Los 19 ítems de la causa más grande (c1) estaban esperando un **merge**, no una respuesta.
Los PRs #21 a #28 se mergearon el 30/07 y #32 hoy. Eso ya está en su pantalla. La única
pregunta que sobrevive de ahí es de refinamiento, no de bloqueo (ver bloque 3).

Lo mismo con la aprobación de contratos: **el flag ya está prendido para AyV desde el
30/07**. No hay que preguntarle si lo quiere. Hay que avisarle que ya lo tiene y pedirle
que lo pruebe.

---

## Bloque 1 — Las seis que urgen (mandar ahora)

### 1. La cartera en curso: un click o mes por mes
> Cuando cargás un contrato que **ya venía andando** hace meses, ¿qué preferís: empezar a
> cobrar desde este mes y lo viejo lo arreglás por afuera, o necesitás declarar mes por mes
> lo que quedó debiendo para que quede registrado?

**Por qué urge:** es lo que se está construyendo esta semana. Decide si ese paso del alta
es un botón o una pantalla larga. `devengarDesde` ya existe en el modelo y la importación
masiva ya lo usa, pero el alta manual todavía no lo ofrece.

### 2. Dónde perdió los datos exactamente
> Cuando cargaste el contrato y tuviste que empezar todo de nuevo, ¿te acordás si venías
> hace un rato largo con la pantalla abierta, o pasó justo al apretar el botón de dar
> de alta?

**Por qué urge:** estamos por construir el borrador con guardado automático sobre una
hipótesis. Verificamos el código: el error del alta **no borra nada**, deja todo cargado
con un cartel rojo. Lo que sí borra todo es que venza la sesión o que se refresque la
pestaña. El borrador resuelve las dos, pero conviene confirmar cuál era antes de dar el
problema por cerrado.

### 3. Documentación: qué bloquea y qué solo avisa
> ¿Cuál es la lista exacta de papeles que pedís sí o sí para un contrato en La Rioja?
> Y de esos, ¿cuáles tendrían que **impedir** activar el contrato, y cuáles alcanza con
> que te avisen que faltan?
>
> Puntual: el contrato firmado escaneado, ¿lo exigimos siempre? Lo pregunto porque la
> cartera vieja no está digitalizada y si lo hacemos obligatorio no vas a poder cargar
> nada de lo histórico.

**Destraba:** la Fase 2 completa del rediseño del alta.

### 4. Servicios por propiedad
> ¿Qué servicios querés que queden registrados en cada propiedad (luz, gas, agua,
> expensas, municipal)? ¿Y el número de cuenta o NIS real es obligatorio, o alcanza con
> tildar que la propiedad tiene ese servicio?
>
> La tasa municipal, ¿la tratamos como un servicio más o va aparte?

**Destraba:** el paso de servicios de la Fase 3.

### 5. Rescisión anticipada
> La cláusula de salida anticipada, ¿es el 10% sobre los meses que quedan o un mes de
> alquiler fijo? ¿Y eso se define contrato por contrato al cargarlo, o es la misma regla
> para toda la inmobiliaria?

**Destraba:** el paso de salida de la Fase 3 y el aviso de los 60 días.

### 6. InfoExperto
> ¿Nos pasás el contacto de InfoExperto y cuántas consultas hacés por mes con esos
> $38.000? Necesito el volumen real para ver si conviene integrarlo adentro de MyAlquiler
> o si te sale más barato como está.

**Destraba:** 15 ítems del feedback. Es la causa abierta más grande que queda.

---

## Bloque 2 — Verificación (preguntar en la misma charla, son cortas)

### 7. El contrato que no te dejaba editar
> ¿Qué contrato exacto quisiste editar y qué le querías cambiar: la cuenta recaudadora o
> el modo de cobranza? Necesito ese caso puntual porque a vos te bloquea y a mí no, y sin
> el caso no lo puedo reproducir.

### 8. Directo a propietario
> ¿Con qué contrato o propietario probaste "directo a propietario" y qué decía exactamente
> el mensaje que te tiró?

### 9. El reclamo que cargó tu inquilino
> ¿Te apareció en el panel y nadie te avisó, o directamente no lo viste en la lista?

Son tres preguntas de reproducción. Sin el caso concreto se arregla a ciegas.

---

## Bloque 3 — Refinamiento (cuando toque cada tema)

| # | Pregunta | Qué define |
|---|---|---|
| 10 | Para gastos y compensaciones entre socios, ¿alcanza una cuenta "Socios" o necesitás saber a qué socio corresponde cada movimiento? | Si PR #28 (ya en prod) cierra el caso o falta una etiqueta |
| 11 | ¿Necesitás aprobar el contrato entero antes de que se active, o solo el monto y la cuenta recaudadora? | El alcance del flujo de aprobación que ya está prendido |
| 12 | ¿Alcanza con que avise "faltan firmas" o necesitás que diga cuál falta (titular, garante, inmobiliaria)? | El detalle del control de firmas |
| 13 | El listado de morosos: ¿desde cuántos meses de deuda entra alguien, hasta qué antigüedad querés ver ex inquilinos, y qué columnas necesita el PDF? | Si el PDF sale usable de una |
| 14 | ¿Bloqueamos todos los reclamos del moroso o dejan pasar los de urgencia (gas, agua, luz)? ¿Desde cuántos meses? | Riesgo real: bloquear una fuga de gas por deuda |
| 15 | ¿Cómo se compone la deuda que le mostrás al inquilino (alquiler, expensas, punitorio) y qué porcentaje por día de atraso aplicás? | El cálculo del punitorio |
| 16 | El aviso masivo de deuda, ¿por WhatsApp, mail o los dos? ¿Qué texto usás hoy para cada tramo? | El canal y el copy |
| 17 | El aviso de vencimiento a 60 días: si el inquilino no decide, ¿le bloqueamos el último pago o solo te avisamos a vos? | Qué pasa con el silencio |
| 18 | ¿Qué ve el propietario en su portal: solo liquidaciones y estadísticas, o también si el inquilino pagó y los reclamos abiertos? | Privacidad del inquilino frente al dueño |
| 19 | De los contratos que migramos, ¿tenés la fecha del próximo ajuste o la derivamos de la fecha de inicio más la periodicidad? | Si el ajuste sale bien de la migración |
| 20 | ¿Qué querés ver del historial de una propiedad: contratos anteriores, reclamos, o también los gastos de mantenimiento? | El alcance de la ficha |
| 21 | Cuando decís "pulir la carga de gastos a terceros", ¿qué te hace perder tiempo: cargarlos uno por uno, no poder repetir los del mes anterior, o no poder adjuntar el comprobante? | Dónde está el dolor real |
| 22 | ¿Qué necesitás ver de un profesional para llamarlo (rubro, zona, precio, quién lo recomendó)? ¿Dejarías que otras inmobiliarias vean tus proveedores? | La agenda de proveedores |
| 23 | ¿Compartirías el comportamiento de pago de tus inquilinos con otras inmobiliarias a cambio de ver el de ellas? ¿Con nombre o anonimizado? | Si el scoring compartido es viable |
| 24 | ¿Nos habilitás crear un contrato y un inquilino de prueba adentro de tu cuenta, o preferís una cuenta aparte? | Si podemos probar altas sin ensuciarle los datos |
| 25 | ¿Cada cuánto y por dónde querés que te muestre lo que voy haciendo: video corto semanal, llamada quincenal, o un link a un ambiente de prueba? | La cadencia de la relación |
| 26 | Un contrato a medio cargar, ¿tiene que ser privado tuyo o lo tendría que poder retomar cualquiera del equipo? | Si el borrador es por usuario o compartido |
| 27 | Si alguien carga un DNI que ya existe en otro contrato, ¿lo dejamos pasar avisando o lo bloqueamos? | La regla de duplicados |

---

## Lo que hay que **contarle**, no preguntarle

1. **La aprobación de contratos ya está prendida en su cuenta** desde el 30/07. Los
   contratos que cargue su empleada quedan pendientes hasta que ella los apruebe, y la
   bandeja está adentro de Pagos.
2. Los ocho arreglos que reportó en la reunión ya están en producción desde el 30/07.
3. El mismo inquilino con varios contratos ya funciona, y desde hoy la planilla de
   importación también lo acepta.
