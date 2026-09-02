# T-01-N1-N3 · La caja mezcla monedas en tres lugares

**Prioridad:** 🔴 plata
**Origen:** barrido de regresiones de T-01-N1. El barrido reportó uno; verificándolo
aparecieron los otros dos, y el que no había reportado es el peor.

---

## El contexto que hace que esto importe ahora

`MovimientoCaja.moneda` existe con `@default(ARS)` y el comentario del schema dice:

> *"Default ARS: es la única moneda que la UI de caja permite cargar hoy, así que las filas
> existentes quedan correctas."*

Eso **ya no es cierto**: `POST /caja/movimientos` (`plata.ts:1554`) escribe
`moneda: body.data.moneda`. Un movimiento en dólares es creable hoy. Los consumidores que
asumían "todo es ARS" pasaron de correctos a incorrectos sin que nadie los tocara.

`cuentas.ts` ya se adaptó, y su comentario dice el resto:

> *"el resto del sistema es riguroso con esto —el cierre de caja expone `porMoneda` y la
> rendición directamente rechaza con 409 si hay varias monedas—; esto era el outlier."*

Se arregló ese outlier y quedaron estos tres.

---

## Los tres, verificados abriendo los archivos

### 1. 🔴 El peor, y el que el barrido NO vio — `plata.ts:846`

`POST /cargos/:id/saldar` registra el cobro en caja:

```ts
await tx.movimientoCaja.create({
  data: { ..., monto: cargo.monto, fecha: new Date(), ... },   // ← sin moneda
});
```

`CargoContrato` **tiene** `moneda` (`schema.prisma`), y `cargo` viene de un `findFirst` sin
`select`, o sea el dato está ahí, cargado, sin usar.

Como la columna es `@default(ARS)`, **omitirla no falla**: escribe ARS igual. Un cargo de
US$800 queda registrado en caja como $800 — el monto correcto en la unidad equivocada.

Es el peor de los tres porque **escribe un dato mal, permanentemente**. Los otros dos muestran
mal algo que en la base está bien; este corrompe la fila, y una vez escrita ya no dice de
dónde vino: no hay forma de saber después cuáles estaban mal.

### 2. 🟠 `metricas.ts` — el groupBy de caja no filtra por moneda

```ts
prisma.movimientoCaja.groupBy({
  by: ['tipo'],
  where: { inmobiliariaId, fecha: { gte: desde, lt: hasta } },   // ← sin moneda
```

Todo el resto del endpoint sí filtra (`financieroPorPeriodo` lleva `moneda: 'ARS'`) y la
respuesta se rotula `moneda: 'ARS'`. O sea el endpoint promete pesos y la caja le mete
dólares adentro.

### 3. 🟡 `metricas.ts` — el aviso de "hay otras monedas" mira los contratos, no la caja

```ts
prisma.contrato.count({ where: { ..., estado: 'ACTIVO', moneda: { not: 'ARS' } } })
```

Cuenta **contratos**. Una inmobiliaria con todo en pesos y un gasto suelto en dólares no ve
ningún aviso. Y con el filtro del punto 2 puesto, ese gasto ahora queda **fuera** del neto:
excluir en silencio es tan engañoso como sumar mal. Por eso los dos van juntos — arreglar el 2
sin el 3 cambia un número mal por un número incompleto.

---

## Lo que se hizo

1. `plata.ts:846` → `moneda: cargo.moneda`.
2. `metricas.ts` → `moneda: 'ARS'` en el where del groupBy.
3. `metricas.ts` → un segundo contador de `MovimientoCaja` en otra moneda; el aviso se prende
   con cualquiera de los dos.
4. `estadisticas/page.tsx` → el cartel decía *"Tenés contratos activos en otra moneda"* y ahora
   también salta por un movimiento de caja. Se cambió a *"contratos o movimientos de caja"*,
   porque si no el cartel aparece y el usuario no encuentra el contrato que lo causó.

## Lo que NO se hizo

- **No se migran las filas ya escritas mal** por el punto 1. No se puede: una fila que dice
  ARS y debía decir USD es indistinguible de una correcta. Se puede *encontrar* cruzando con
  `CargoContrato.moneda`, y esa consulta queda escrita en `diagnostico-caja-moneda.sql` para
  que la corra el dueño y decida — no la aplico yo a ciegas.
- **No se agregó ninguna dependencia.**

## Cómo se verificó

- `tsc` 0 en `apps/api` y en `apps/inmobiliaria`.
- 4 tests nuevos; **los tres que cubren un fix se ponen rojos** al revertir cada uno por
  separado (se probó uno por uno: revertir los tres juntos no prueba que cada test ataje *lo
  suyo*).
- Compuerta completa: **350 tests en verde**.
- Los tests leen el source en vez de ejecutarlo, y está dicho en el archivo: probar esto de
  verdad necesita una base viva, que es justo lo que hoy no corre (T-01-N1-N1).

## No verificado

**No se probó en el navegador.** El cambio de texto del cartel de `/estadisticas` no se vio
renderizado.
