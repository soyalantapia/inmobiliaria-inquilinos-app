# T-01-N1-N2 · La rendición le manda al dueño las palabras del inquilino

**Prioridad:** 🔴 fuga de datos
**Origen:** barrido de regresiones cruzadas lanzado durante T-01-N1.

---

## El hallazgo, verificado abriendo los archivos

### Cómo sale el texto

`apps/api/src/routes/plata.ts:1964-1965`, al armar los gastos de una rendición:

```ts
descripcion:
  rec.costoTrabajoNotas || `Reparación (${rec.categoria.toLowerCase()}): ${rec.descripcion.slice(0, 60)}`,
```

`rec.descripcion` es el texto libre que **escribió el inquilino** al reportar el problema.
Cuando el operador no cargó `costoTrabajoNotas` —que es el caso por defecto, porque el campo
es opcional— los primeros 60 caracteres de lo que puso el inquilino quedan guardados en
`GastoRendido.descripcion`.

Y de ahí salen al portal, sin recorte: `apps/api/src/routes/portal-propietario.ts:451`

```ts
gastos: {
  select: { fecha: true, tipo: true, descripcion: true, proveedor: true, monto: true },
```

También sale impreso: `apps/propietario/src/components/imprimir-rendicion.tsx`.

### Por qué esto es un descuido y no una decisión

Porque **el mismo archivo ya cerró esta misma puerta, 50 líneas más abajo**.
`portal-propietario.ts:505-511`, al traer los reclamos, dice textualmente:

> *"sin ese recorte, quien compra un departamento en marzo abre el portal y lee los reclamos
> de 2024 de un inquilino con el que no tuvo ninguna relación, **con la `descripcion` en texto
> libre que esa persona escribió**."*

Es exactamente el mismo dato, de la misma persona, a los mismos ojos. Se lo pensó, se lo
escribió, y se cerró una sola de las dos puertas.

El mismo bloque muestra el criterio ya establecido: `:440-445` decide **no** exponer `notas`
de la rendición porque el equipo las viene escribiendo hace meses dando por sentado que son
internas. La `descripcion` del inquilino es más sensible todavía: el inquilino ni siquiera
sabe que existe un portal del propietario.

### Y esta puerta es más ancha que la que se cerró

La query que junta esos reclamos (`plata.ts:1890-1897`) filtra por **propiedad**, no por
contrato, y **no tiene piso de fecha**:

```ts
propiedadId: { in: propIdsConIngreso },
resueltoAt: { lt: finPeriodo },
```

El comentario de `:1903-1904` ya lo reconoce al pasar. O sea: por esta vía entra el texto de
inquilinos de contratos anteriores, que es justo el caso que `:505` se preocupó por evitar.

---

## Lo que se hace

**1. Cortar el origen** — `plata.ts:1965`. El fallback deja de ser el texto del inquilino:

```ts
descripcion: rec.costoTrabajoNotas || `Reparación (${rec.categoria.toLowerCase()})`,
```

No se pierde nada a lo que el dueño tenga derecho. Le están cobrando un arreglo y sigue
viendo **qué** se arregló (la categoría) y **cuánto**. Lo que describe el trabajo es
`costoTrabajoNotas`, que es el campo que existe para eso. Lo que se saca es el relato del
inquilino sobre su propia casa.

**2. Limpiar lo ya escrito** — migración. `GastoRendido` es una tabla de historial: las filas
viejas ya tienen el texto adentro y arreglar el origen no las toca. Las filas contaminadas se
reconocen solas, porque las generó ese template: empiezan con `Reparación (algo): `. Las que
no matchean son notas que escribió el operador y **no se tocan**.

**3. No se sanea en el portal.** Se evaluó y se descartó: en una fila vieja no hay forma de
distinguir "notas del operador" de "texto del inquilino" —las dos son un string en la misma
columna—, así que recortar en el portal escondería también las notas legítimas. La migración
sí puede distinguirlas, por el prefijo.

## Lo que NO se hace

- **No se corre la migración.** Se escribe el `.sql`, lo aplica el dueño (T-01).
- **No se toca el piso de fecha de `plata.ts:1897`.** Ya se relevó en T-23-N3-N2 y la falta
  del `gte` es deliberada por el lado de la plata. Sacado el texto libre, lo que queda saliendo
  por ahí es categoría y monto, que es lo que el dueño tiene que ver.
- **No se agrega ninguna dependencia.**

## Cómo se verifica

- Test puro sobre el armado de la descripción: con `costoTrabajoNotas` gana esa; sin notas,
  sale la categoría **y nunca el texto del inquilino**.
- El test tiene que ponerse **rojo** si se revierte el fix. Si no se pone rojo, no prueba nada.
- `tsc` 0 en `apps/api`.
- La compuerta nueva (`test:sin-db`) en verde.
