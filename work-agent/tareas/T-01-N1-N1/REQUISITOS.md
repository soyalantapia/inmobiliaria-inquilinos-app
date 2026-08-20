# T-01-N1-N1 · Los 52 archivos de test que nunca corrieron

**Prioridad:** 🟠 · **Experto:** QA + OPS
**Origen:** T-01-N1. Al montar la compuerta quedó dicho que cubría 341 de 725 tests, y que los
que faltaban eran los que importan.

---

## El punto de partida, medido

De **94** archivos de test en `apps/api/test/`, la compuerta miraba **42**. Los otros **52**
necesitan una base viva y **no habían corrido nunca, en ningún lado**: la única base disponible
era una remota **compartida** que `seedBase` siembra destructivamente, así que correrlas le
pisaba los datos a quien estuviera probando.

No son los que sobran:

```
bugs-de-plata · core · auth · auth-fuerza-bruta · acceso-revalidado
aprobacion-periodos · conciliar-informado-huerfano · cuentas
rendicion-multiowner · rendicion-reclamo-multiduenio
deposito-aplica-deuda · deposito-cap-disponible
```

`rendicion-multiowner.test.ts` cubre reparto entre co-dueños, rendición incremental, anulación
que reabre el gasto y conservación del total — y menciona `descontadoEnRendicion` por nombre.
El 19/08 se arregló un bug de exactamente esa superficie (**T-01-N1-N6**) y se encontró leyendo
código, no corriendo ese archivo.

## Lo que se hizo

Un `service container` de Postgres en el job de CI. Efímero: nace vacío en cada corrida, se usa
y se tira. Eso disuelve el problema original —no hay nadie más del otro lado— sin tocar nada
compartido.

Verificado **de verdad**, contra una Postgres local en Docker antes de escribir el YAML:

1. **`postgres:16` pelado alcanza.** La nota original de esta tarea decía que hacía falta
   pgvector; **estaba equivocada**. Venía de `CLAUDE.md`, que describe una extensión que el
   proyecto nunca usó: el `datasource` no declara `extensions` y ninguna migración crea una.
2. **Las 57 migraciones aplican desde cero en ~25 s.** O sea CI pasa a ser el primer lugar donde
   se prueban de verdad — hoy la primera vez que corren es en el arranque del contenedor de
   producción (`db:deploy && node dist/index.js`), que es el peor lugar posible para descubrir
   que una está mal.
3. **El guard no hay que aflojarlo.** `exigirDbDeTest` (`prisma/guard-db.ts`) ya acepta
   `localhost`, que es donde queda un service container. Sigue fallando cerrado ante hosts
   desconocidos.
4. **La suite está sana:** contra una base limpia da **378 de 383**.

## Lo que apareció al correrlos: un bug real

`multi-alquiler.test.ts` afirmaba que dar de alta a **otra persona (distinto DNI) con el mismo
email** devuelve 409. Devolvía **200**, y falla igual corriéndolo solo contra una base limpia:
no era un resto de otra suite.

La causa, rastreada: `buscarOCrearPersona` (`lib/persona.ts`) devuelve la Persona existente
cuando el email coincide y el DNI no. **Es deliberado** y lo necesita la importación de cartera
—reventar con P2002 a mitad de 2000 filas deja la carga hecha a medias en la cuenta real del
cliente, y el preview ya marca el caso como advertencia—. Pero ese helper se compartió con el
alta manual, donde `POST /contratos` **ya prometía** ese 409 confiando en que saltara el unique
de `Persona`. Al no saltar nunca, el 409 quedó inalcanzable y el contrato pasaba a colgar en
silencio de **la persona equivocada**: dos humanos distintos bajo una sola identidad.

Es la misma línea que `normalizar-dni.ts` cuida cuando dice que no recorta un CUIT a su DNI
porque *"podría fusionar dos personas distintas"*.

**Arreglado en el alta manual, sin tocar el camino de importación:** un chequeo explícito
(`esOtraPersona`) que sólo afirma cuando hay DNI de los dos lados y difieren. Ante la duda no
bloquea — rechazar un alta legítima le rompe el día a quien está cargando.

## Lo que NO quedó resuelto, y por qué el job no bloquea todavía

Las **4 rojas** que quedan son de `core.test.ts` y **no son bugs del producto**: cuenta filas
del seed (*"devuelve los 8 del seed"*) y encuentra las que dejaron las 12 suites anteriores.
Corriendo ese archivo solo contra una base limpia da **7/7**.

Se intentaron dos salidas y las dos fallaron, con evidencia:

| intento | resultado |
|---|---|
| `prisma/limpiar-test-db.ts` como `setupFiles` (limpiar antes de cada archivo) | **empeoró: de 6 rojas a 39 archivos rotos.** Ese script está escrito para correr ENTRE corridas, con la base quieta; a mitad de suite choca con las FK RESTRICT del esquema y se lleva puestos los `afterAll`, que quedan sin `app` ni `prisma` |
| ordenar `include` para que las sensibles corran primero | **vitest no respeta ese orden**: pidió `core.test.ts` primero y corrió `plata.test.ts` |

Arreglar el aislamiento entre suites es una tarea propia — **T-01-N1-N1-N1**. Hasta entonces el
job corre con `continue-on-error: true`: se ve en cada push, pero no bloquea. Ponerlo en
`required` sabiendo que hay 4 rojas conocidas sería frenar todo por un problema de los tests, y
enseñarle a todo el mundo a ignorar el rojo.

**Cuando esa tarea cierre, se saca el `continue-on-error` y el job pasa a bloquear.** Eso es lo
que hay que hacer, y está anotado en el propio YAML.

## Cómo se verificó

- Postgres efímera en Docker, base nueva por experimento.
- 57 migraciones desde cero: **exit 0**, ~25 s.
- Suite completa: **378/383**, ~4 min.
- El bug de identidad: rojo antes, verde después, comprobado aislado en base limpia.
- 5 tests puros nuevos sobre `esOtraPersona`, que sí corren en el job que bloquea.
- `tsc` 0 y la compuerta existente en **408 verdes**.

## No verificado

**El YAML no corrió todavía en Actions.** Cada comando que ejecuta se probó en local contra la
misma versión de Postgres, pero que el runner de Ubuntu se comporte igual se confirma recién en
el primer push.
