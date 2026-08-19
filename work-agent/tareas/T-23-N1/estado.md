# T-23-N1 · El aislamiento del portal no tiene test de integración

- **fase:** cerrada como BLOQUEADA. Lock liberado abajo.

## Por qué no se pudo hacer

El bloqueo no era el que el prompt decía. La regla 3 afirmaba que los tests de `apps/api`
"pegan a la Postgres de producción" citando `docs/TESTING.md:25` — y esa línea dice lo
contrario: es la instancia de **test/dev**, y prod es inalcanzable desde esta máquina.
Corregido en el prompt.

El bloqueo REAL es doble:
1. `seedBase` siembra destructivamente una Postgres remota **compartida** con los otros chats.
2. No existe `apps/api/.env`, así que `DATABASE_URL` no está seteada y esos tests ni arrancan.

## Qué hace falta para destrabarla

Una Postgres efímera local (Docker) con su propio `DATABASE_URL`. Es lo mismo que necesita
T-28, y hoy es lo que impide correr **cualquier** test de integración, no sólo éste.

LIBERADA: necesita una decisión de infraestructura del dueño.
