# T-23-N4-N1 · Revocación del token de inquilino y de `persona`

- tomada: 2026-08-20T13:40Z (lock huérfano de 19h, sin ningún archivo de estado)
- worktree: ../myalquiler-T-23-N4-N1
- rama: `fix/T-23-N4-N1-revocacion`
- base: `origin/main` (0f76fc9)
- fase: TERMINADA

## El resultado primero: la ficha estaba vieja, los tres agujeros ya estaban tapados

Verifiqué los tres puntos de la tarea contra el código, uno por uno. **Los tres ya están
resueltos**, por trabajo de otros chats que no actualizó la ficha:

| Lo que decía la ficha | Estado real (verificado 20/08) |
|---|---|
| `requireInquilino` devuelve el payload crudo del JWT, sin una sola query | **Falso hoy.** Llama a `inquilinoRevocado`, que consulta la base. Y la decisión está separada en `motivoRevocacionInquilino`, pura y testeable |
| La rama `inquilino` de `requireContratoAcceso` pasa derecho con permiso COMPLETO | **Falso hoy.** Llama al mismo `inquilinoRevocado`. El comentario dice textual: *"cuando la revalidación vivía en una sola, la otra quedaba abierta"* |
| `requirePersona` no consulta nada | **Falso hoy.** Revalida el email contra `Inquilino` — y el comentario explica por qué contra `Inquilino` y no contra `Persona`, que fue un bug real |

Queda el cuarto punto, el del desfasaje: el docstring de `exigirContratoActivo` se atribuye
gatear *"abrir reclamo"* y `operacion.ts` no lo llama nunca. **También es un falso positivo:**
`POST /mis-reclamos` sí controla el estado, sólo que **inline** —`if (contrato.estado !==
'ACTIVO')`, mismo 409 y mismo mensaje que el helper— y encima distingue el 404 cuando el
contrato no existe, cosa que el helper colapsa. Un grep de `exigirContratoActivo` lo daba por
faltante. No hay refactor que hacer.

**No inventé trabajo para justificar la tarea.** Lo que sí salió del barrido es otra cosa, y es
más útil.

## Lo que sí encontré: la superficie no se puede auditar a mano

El gate se aplica **endpoint por endpoint**, sin middleware. Eso es deliberado —la lectura no
se gatea a propósito— pero significa que **nada impide que un endpoint nuevo nazca sin control**.

Se barrió la misma superficie tres veces, de forma independiente:

| Método | Endpoints encontrados |
|---|---|
| A mano, mirando los 4 archivos "obvios" | 12 — se comió **3 archivos enteros** |
| Agentes en paralelo, un archivo cada uno | 12 — se comió **2 archivos** |
| Parseando de verdad (llaves + backticks) | **17** |

Los que se escapaban no eran raros, eran **invisibles a un grep**:

1. **`anuncios.ts` registra sus handlers en un loop**, con la ruta en template literal:
   ``app.post(`/anuncios/:id/${accion}`)``. Un regex de comillas simples no los ve.
2. **`uploads.ts` usa un guard local propio** (`requireAuthOProfesional`), no los estándar.
3. **`POST /reportes` usa `requireAuth` pelado**, que acepta tokens de inquilino.

Y mi primer parser tenía su propio bug: cortaba el cuerpo del handler "hasta el próximo
`app.`", lo que le hacía atribuir el `requireInquilino` del handler siguiente. Daba dos falsos
positivos (`DELETE /anuncios/:id` y `POST /screening`, los dos de `requireUsuario`). Se arregló
contando llaves.

## El entregable

**`apps/api/test/inquilino-escrituras-declaradas.test.ts`** — un registro de decisiones
ejecutable. Parsea `src/routes/*.ts` y exige que **toda** escritura alcanzable por un inquilino
esté declarada en `GATEADOS` o en `EXENTOS` (con el motivo escrito). Un endpoint nuevo falla el
test nombrándolo, hasta que alguien decide de qué lado está.

**El test no decide la política: obliga a declararla.** Es el instrumento correcto para una
regla que se aplica endpoint por endpoint en vez de en un middleware.

Estado hoy: **17 escrituras — 8 gateadas, 9 exentas**, cada una con su motivo. Ninguna de las
9 exentas es un hueco: 6 son acciones sobre algo ya existente o datos de la persona que
sobreviven al contrato, y 3 no tocan la relación contractual.

Además de la tabla, el test se protege a sí mismo: falla si el parser encuentra menos de 17
(un parser roto dejaría todo lo demás en verde por vacuidad), si una declarada como gateada no
controla nada, si un motivo es una línea vacía de compromiso, y si la tabla acumula rutas
muertas por un rename.

**Verificación por mutación: 3 de 3.** Agregué un endpoint nuevo del inquilino sin declarar,
le saqué el gate a uno declarado, y renombré una ruta: el test se puso en rojo en los tres casos.

## Migraciones

Ninguna. **Y ningún cambio de comportamiento en producción**: es test + documentación.

## Tests

- `test/inquilino-escrituras-declaradas.test.ts` — 5 nuevos, mutación 3/3.
- Suite puro: **48 archivos / 443 tests** en verde. `tsc` en 0 en los 5 paquetes.

## Tareas nuevas detectadas

- **T-23-N4-N1-N1** (SEC + OPS, 🟡): `POST /uploads` no tiene cuota por usuario. Ver ficha.
