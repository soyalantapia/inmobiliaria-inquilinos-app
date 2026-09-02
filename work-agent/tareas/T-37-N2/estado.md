# T-37-N2 — La matriz prometía un "queda pendiente" que sólo existe para contratos

- tomada: 2026-08-20
- worktree: `../myalquiler-T-37-N2`
- rama: `fix/T-37-N2-rotulo-carga`
- estado: **terminada y verificada**
- commit: `60a268d`

## De dónde salió

Se tomó T-37-N1 para ver si tenía una parte hacible sin decisión de producto. **No la tiene** —
es la feature entera— pero al leer la matriz apareció que la mentira que T-37 sacó de una fila
seguía viva en otros dos lugares de la MISMA pantalla.

Es la misma clase de defecto y pega en el mismo lugar: `Configuración → Equipo` es donde la
administradora reparte los roles, y lo que lea ahí decide a quién le da qué.

## Los dos lugares

**1. El rótulo del grupo** (`GRUPO_LABEL.carga`, renderizado en `matriz-permisos-card.tsx:115`).
Decía *"Carga · qué puede cargar (queda pendiente si no es Admin)"* arriba de cinco filas:

| capacidad | ¿queda pendiente? |
|---|---|
| `contratos.crear` | **sí** — `contratoQuedaPendiente`, que el alta llama en `core.ts` |
| `propiedades.crear` | no |
| `propietarios.crear` | no |
| `pago.manual.cargar` | no |
| `gasto.caja.cargar` | no |

Se sacó la generalización. **No se reemplazó por una aclaración**: la fila ya lo dice sola, con
el badge "pendiente" que pinta `rolesAprobacion` en la columna del rol que corresponde.

**2. La descripción del rol CARGA** (`ROL_DESCRIPCION.CARGA`, en `equipo-card.tsx:261`). Decía
*"Lo que carga queda pendiente de aprobación"* y de las tres cosas que carga vale para los
contratos nomás. Ahora dice cuál queda pendiente y cuál se guarda directo.

## Lo que NO se hizo, y por qué

**No se construyó el circuito de aprobación de pagos.** Eso es T-37-N1, y su propia ficha dice
por qué no se hizo: mete un estado nuevo en el flujo de la plata y **nadie lo pidió en la
reunión**. Es una feature, no el arreglo de una inconsistencia. Construirla por iniciativa propia
sería justo lo que la regla 1 del repo prohíbe.

El lock de T-37-N1 se liberó para que quede disponible el día que haya decisión.

## El test

`apps/inmobiliaria/src/lib/permisos.test.ts` (5 casos). El invariante de fondo no es el texto:
es que **`rolesAprobacion` sólo puede estar puesto donde el circuito existe**, porque es lo único
que pinta el badge "pendiente". La lista `CON_CIRCUITO` tiene hoy un solo elemento; si mañana se
construye el de pagos, se le agrega la capacidad **en el mismo commit que lo construye**.

Vive en `apps/inmobiliaria` y no en `packages/shared` porque shared no tiene runner y montarle
uno por un rótulo sería scope creep. La app que renderiza la matriz es la que lo cuida.

**Se comprobó que sirve, no sólo que pasa:** reinyectando las dos mentiras —el rótulo viejo y el
`rolesAprobacion: ['OPERADOR']` de T-37— 2 de las aserciones se ponen en rojo.

## Verificación

- `tsc` en 0 en los seis paquetes.
- **403 tests** de api y los **tres fronts** en verde.
