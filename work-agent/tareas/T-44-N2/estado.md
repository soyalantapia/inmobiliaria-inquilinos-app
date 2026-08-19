# T-44-N2 — Los otros tres `?? 100` de la rendición

- tomada: 2026-08-19
- worktree: `../myalquiler-T-44-N2`
- rama: `fix/T-44-N2-participacion` (base: `feat/propietario-detalle-rendicion`)
- estado: **terminada y verificada**
- commit: `647d892`

## Lo que se verificó antes de tocar nada

La pregunta que decidía la tarea era si esos tres `?? 100` son **bugs vivos** o **minas
latentes**, porque el arreglo es el mismo pero el reporte no. Se siguió la cadena entera:

| Paso | Dónde | Qué acota |
|---|---|---|
| `propIds` | `plata.ts:1893` | `owner.participaciones.map(p => p.propiedadId)` |
| `liqsCobradas` | `:1894` | `contrato.propiedadId IN propIds` |
| `propIdsConIngreso` | `:2029` | distinct de `liqsCobradas` ⇒ **subconjunto** de `propIds` |
| `gastosPend`, `reclamosProp`, `ingresosPend` | `:2033`, `:2134`, `:2238` | `propiedadId IN propIdsConIngreso` |

Todo el endpoint vive dentro de las propiedades del dueño, así que **el `find` siempre matchea y
ninguno de los tres es un bug vivo**. Se dice explícito para no vender el arreglo como más de lo
que es.

Lo que sí se cierra es la mina. Esa premisa es de HOY, no está escrita en ningún tipo, y es una
propiedad emergente de cómo se arman cuatro queries distintas. El día que las participaciones se
filtren por ventana de vigencia —literalmente lo que pide T-23-N3— deja de valer, y lo que
aparece no es una excepción: es una transferencia mal dirigida, sin error y sin rastro.

## Qué se cambió

1. **Los tres sitios** (gastos `:2100`, gastos de reclamos `:2208`, otros ingresos `:2303`) tiran
   `ParticipacionAusente` como ya hacía el de alquileres. Quedan cuatro guards y cero `?? 100`.
2. **El mensaje del 409.** Decía *"quedó una liquidación de una propiedad…"*. Ahora el guard lo
   pueden tirar cuatro caminos, y nombrar sólo uno mandaba al operador a mirar el lugar
   equivocado cuando lo disparaba un gasto. Dice "movimientos".
3. **En el bucle de reclamos** se agregó `if (!rec.propiedadId) return []` además del `.filter`
   de la query: el `.filter` no le da a TS la certeza, y el guard necesita un id de verdad para
   poder decir CUÁL propiedad revisar.

## El test, y por qué es de fuente

El guard vive adentro del handler. Sacarlo a una función pura para poder testearlo sería
refactorizar el endpoint de la plata para complacer a un test, así que se usó la forma que el
repo ya tiene para invariantes sostenidos por la estructura del código
(`evento-contrato-propaga.test.ts`). Verifica cuatro cosas: que no quede ningún `?? 100`, que
haya exactamente cuatro guards, que cada `participaciones.find` tenga el suyo **antes** de leer
el porcentaje, y que el 409 no vuelva a nombrar sólo a las liquidaciones.

**Se comprobó que sirve, no sólo que pasa.** Reintroduciendo el `?? 100` en un solo sitio, 3 de
sus 5 aserciones se ponen en rojo. Un guard que no falla cuando tiene que fallar es peor que no
tenerlo, porque da tranquilidad falsa.

## Verificación

- `tsc` en 0 en los seis paquetes.
- **390/390** tests sin base (eran 385 antes: +5 del guard nuevo).

## Lo que NO se hizo

No se testeó el guard end-to-end (una rendición real que lo dispare): eso necesita base, y las
suites con base no se corren desde acá. El test de fuente cubre que el guard exista y esté bien
puesto; que el 409 llegue bien al panel queda para cuando se corran las suites con DB.
