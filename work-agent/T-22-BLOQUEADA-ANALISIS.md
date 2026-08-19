# T-22 · BLOQUEADA — el consorcio no sabe a quién avisarle

> **No es una tarea de implementación: falta una decisión de modelo.** Este documento explica
> qué se encontró y cuáles son las dos salidas, para que el owner elija.

## Lo que pedía la tarea

Camila `[57:35]`: *"Los consorcios que te salen, mandale mensaje por email… y subirle la expensa
a alguien."*

Dos cosas: **cargar la expensa del período** y **avisarle a las unidades**.

## Lo que ya está hecho

**Cargar la expensa del período: existe.** `Consorcio` tiene `periodoActual` y
`expensasPeriodoActual` (`schema.prisma`), y `PUT /consorcios/:id` (`operacion.ts:1286`) los
acepta y los persiste. No hay nada que construir de este lado.

## Por qué la otra mitad está bloqueada

**A las unidades no se les puede mandar un mail, porque el sistema no tiene su mail.**

`UnidadFuncional` (`schema.prisma`) guarda:

```prisma
identificacion  String   // '1°A', 'PB Comercial'
titular         String   // un NOMBRE suelto, texto libre
telefono        String
coeficiente     Float
estado          EstadoUF
saldoDeudor     Decimal
```

**No tiene email.** Y `enviarAnuncioEmail` (`mailer.ts`) recibe `email` como dato obligatorio.

Pero el problema de fondo es más grande que un campo faltante:

### El consorcio es una isla: hay DOS representaciones de la misma unidad

`Consorcio` tiene **las dos** relaciones, y no se hablan entre sí:

```prisma
model Consorcio {
  unidades     UnidadFuncional[]   // el padrón del edificio
  propiedades  Propiedad[]         // los inmuebles que administra la inmobiliaria
}
```

- **`Propiedad`** es la que tiene `Contrato` → `Inquilino` → **email**. Por ahí viaja todo lo que
  ya funciona: liquidaciones, pagos, reclamos, anuncios.
- **`UnidadFuncional`** es un padrón paralelo, con el titular como texto libre, y **sin ninguna
  FK ni join con `Propiedad`**. Verificado con grep sobre `apps/api/src`: **cero** lugares que
  las relacionen.

O sea: el 1°A del edificio puede existir **dos veces** en la base —como `Propiedad` y como
`UnidadFuncional`— sin que el sistema sepa que son la misma puerta.

**Esto explica algo que Camila ya había dicho** `[29:21]`: *"tengo dos edificios donde tengo
cinco departamentos nada más propios, lo demás sólo cobro [expensas]"*. Esos "cinco propios" son
`Propiedad` con contrato; el resto son unidades de las que sólo administra expensas. Hoy los dos
grupos viven en tablas distintas que no se conocen.

## Las dos salidas

### Opción A — agregarle `email` a `UnidadFuncional`

- **Costo:** bajo. Un campo, una migración aditiva, y cablear el envío.
- **Qué resuelve:** exactamente lo que pidió, y nada más.
- **Qué deja abierto:** las dos representaciones siguen desconectadas. La unidad que además es
  una `Propiedad` con inquilino va a tener el mail cargado **dos veces**, en dos tablas, y van a
  divergir. Y el inquilino va a recibir el aviso de expensas por un canal distinto del que usa
  para todo lo demás, sin que le aparezca en su app.

### Opción B — vincular `UnidadFuncional` con `Propiedad`

- **Costo:** medio. Una FK opcional `propiedadId` en `UnidadFuncional`, más la UI para asociarlas,
  más decidir qué pasa con las que no tienen par.
- **Qué resuelve:** el consorcio deja de ser una isla. Para las unidades con propiedad asociada,
  el aviso sale por el canal que **ya existe y ya funciona** (`Anuncio` + `enviarAnuncioEmail` +
  el feed `GET /mis-anuncios` que el inquilino ya ve en su app). Y destraba el caso mixto de
  Camila sin inventar un segundo circuito.
- **Qué deja abierto:** las unidades sin propiedad asociada (las que la inmobiliaria no
  administra como alquiler) siguen necesitando el campo `email` de la opción A.

### Lo que recomendaría

**B, y A como complemento para las unidades sueltas.** Razón: el sistema ya tiene un canal de
comunicación que funciona, con feed en la app del inquilino y mail. Construir un segundo canal
sólo para expensas duplica el trabajo y le da al inquilino dos lugares donde mirar — que es
justo lo que Camila dice que hace que la gente no pague.

**Pero es una decisión del owner**, porque cambia el modelo de datos y tiene costo.

## Qué NO se hizo, y por qué

Ningún cambio de código. Implementar la opción A sin decidir es la clase de atajo que después
cuesta caro: quedaría un segundo canal de comunicación, paralelo al que ya existe, sobre un
padrón que no se habla con el resto del sistema.

## Nota sobre el lock

**El lock de T-22 queda tomado a propósito**, aunque la tarea no se completó. Liberarlo haría
que otro chat la agarre y choque contra exactamente la misma pared. Se libera cuando el owner
decida entre A y B.
