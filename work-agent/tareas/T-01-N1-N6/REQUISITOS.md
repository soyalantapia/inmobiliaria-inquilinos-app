# T-01-N1-N6 · Se puede borrar un gasto que a un co-dueño ya se le descontó

**Prioridad:** 🟠 plata
**Origen:** barrido adversarial de T-01-N1, marcado como deuda vieja (26/06) y sin registrar.
Revalidado hoy: sigue.

---

## El hallazgo

`DELETE /caja/movimientos/:id` (`plata.ts`) protege el borrado con un candado atómico:

```ts
const res = await prisma.movimientoCaja.deleteMany({
  where: { id, inmobiliariaId: u.inmobiliariaId, descontadoEnRendicion: false },
});
if (res.count === 0) return reply.code(409).send({ message: 'Ya fue descontado en una rendición…' });
```

El candado es `descontadoEnRendicion: false`. **Ese flag no significa "no se le descontó a
nadie".** Significa "todavía no se cubrió el 100%".

No hay que deducirlo: lo dice el propio código, 250 líneas más abajo, al explicar el cap del
multi-dueño (`plata.ts`, armado de la rendición):

> *"en multi-dueño el movimiento queda `descontadoEnRendicion=false` hasta que las partes cubren
> el 100%"*

## Qué pasa en concreto

Un departamento de **Silvana y su hermano, 50/50**. Gasto de caja de $100.000 imputado a esa
propiedad.

1. Se rinde a Silvana → se le descuentan **$50.000** y se escribe un `GastoRendido` con
   `refId` = el id del movimiento.
2. El movimiento sigue con `descontadoEnRendicion = false`, porque falta la mitad del hermano.
3. Alguien borra el gasto desde la caja. **El candado lo deja pasar**, porque mira el flag.

Resultado: a Silvana se le descontaron $50.000 por un gasto que ya no existe, y al hermano no se
le descuenta nunca. El movimiento no está para auditarlo, y la única huella queda en un
`GastoRendido` que apunta a un `refId` que no existe más.

Con un solo dueño no pasa: la primera rendición cubre el 100% y el flag se pone en `true`. Por
eso duró — es el caso multi-dueño, que es el minoritario.

## Lo que se hace

El candado pasa a preguntar lo que de verdad importa: **¿existe algún `GastoRendido` que apunte
a este movimiento?** Ese registro es el que dice que a alguien ya se le cobró, y existe desde la
primera parte rendida, no desde el 100%.

```ts
const yaRendidoAAlguien = await tx.gastoRendido.count({ where: { refId: id, tipo: 'CAJA' } });
if (yaRendidoAAlguien > 0) → 409
```

Va **dentro de una transacción** junto con el `deleteMany`, para no reabrir la carrera que el
comentario del código dice que ese `deleteMany` atómico vino a cerrar.

Se conserva el chequeo de `descontadoEnRendicion` en el `where` del delete: cuesta nada y cubre
el caso de una fila vieja marcada como cubierta cuyo `GastoRendido` no exista por lo que sea.

## Lo que NO se hace

- **No se toca la rendición.** El bug es del borrado, no del cálculo.
- **No se cambia `descontadoEnRendicion`.** Sigue significando lo que significa y sigue usándose
  para lo que sirve (filtrar los gastos pendientes al armar una rendición). Lo que estaba mal era
  usarlo como candado de borrado.
- **No se agrega ninguna dependencia.**

## Cómo se verifica

- **5 tests puros** sobre la decisión, extraída a `lib/borrar-gasto-caja.ts`. Uno de ellos fija
  la diferencia exacta entre el candado viejo y el nuevo: con una parte rendida, el viejo decía
  que sí y el nuevo dice que no.
- **Se ponen rojos al revertir:** sacando la línea del `GastoRendido`, 2 de 5 en rojo — los dos
  que describen el caso multi-dueño.
- `tsc` **0 en los cinco paquetes**, **395 tests verdes**.

> El camino real (endpoint contra la base) no se puede probar acá: es uno de los 52 archivos
> que hoy no corren, ver **T-01-N1-N1**. Lo que sí queda probado es la decisión.
