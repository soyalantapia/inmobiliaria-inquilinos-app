# T-44-N1 — Volvió a haber trabajo terminado que no llega a la rama que se deploya

- tomada: 2026-08-19
- worktree: `../myalquiler-T-44-N1`
- rama: `fix/T-44-N1-consolidar` (base: `feat/propietario-detalle-rendicion`)
- estado: **consolidación terminada y verificada**
- commits de resolución: `eec9270`, `1a4dbb1` (picker), `012b374`

## Por qué existe esta tarea si T-44 estaba ✅

T-44 consolidó las dos líneas que había el 19/08 y lo verificó de verdad. No estuvo mal: lo que
pasa es que **el problema no es un evento, es un goteo**. Mientras T-44 se mergeaba, otros chats
seguían terminando tareas en sus propios worktrees, y en cuestión de horas volvió a haber diez
ramas con trabajo afuera.

Lo grave no es el número. Es que **cinco tareas figuraban ✅ en el índice y su código no estaba
en la rama que se deployaría**:

| Tarea | Decía en el índice | Commit que faltaba |
|---|---|---|
| T-36 · TOCTOU al cambiar modo de cobranza | ✅ RESUELTO | `eaa196d` |
| T-40 · La pantalla ofrecía lo que el server no permite | ✅ RESUELTO | `182a068` ("T-40 había quedado a medias") |
| T-23-N3 · Participaciones sin vigencia | ✅ HECHA | `c4981dc` |
| T-23-N1 · Aislamiento del portal sin test | ✅ CUBIERTA | `7a724ae` |
| T-21-N3-N3 · La landing vende IA que no existe | ✅ HECHA | `9b93f54` |

A eso se sumaba **T-25 entera** (conmutador de usuarios + bloqueo por inactividad: 17 archivos,
~1.300 líneas, con migración) y dos commits de docs.

Un ✅ que no está en la rama de deploy es peor que un pendiente: nadie lo vuelve a mirar.

## Qué se consolidó

Nueve commits distintos, de diez ramas. Cuatro conflictos, y **ninguno fue cosmético** — los
cuatro escondían una decisión real:

**1. `rendicion-pendiente.ts` — los dos lados extrajeron la misma función pura.**
La integración le había agregado `TxOrClient` (el guard de modo-cobranza revalida DENTRO de la
transacción, si no decide con una foto vieja); T-23-N3 le había agregado
`alquilerCobradoSinRendirDePropiedad`, que es su razón de ser —el reparto de dueños cuelga de la
PROPIEDAD, no del contrato—. Quedaron las dos sobre un lector único parametrizado por `where` y
`db`. Se conservaron los tipos `unknown`: los montos llegan como `Decimal`, y con `number` cada
lector tendría que convertir antes; alcanzaba con que uno se olvidara para hacer la cuenta sobre
un objeto Decimal sin avisar.

**2. `plata.ts` — el conflicto era casi todo Prettier.**
La integración le había pasado el formateador (1093/704, casi todo reformateo). Se tomó esa
versión y se le aplicaron a mano los tres cambios semánticos de T-23-N3: el `?? 100` que se
volvía un reparto del 100% en silencio, la clase que lleva la propiedad, y el 409 que dice cuál
reparto revisar.

**3. `picker.html` — dos cambios que no se contradecían.**
T-21-N3-N3 agregaba el aviso de que los datos son inventados; T-46 había sumado la cuarta puerta.
Quedaron los dos.

**4. El mensaje de "solo expensas" — acá casi entra una regresión.**
La rama entrante decía *"cambiar el importe de las expensas todavía no se puede desde el panel —
avisale al equipo de My Alquiler"*. Era verdad cuando se escribió y **ya no lo es**: se verificó
que `PATCH /contratos/:id/expensas` existe (`core.ts:3649`) y el botón también
(`cambiar-expensas-button.tsx`). Tomarla habría mandado al operador a pedir por mail algo que ya
puede hacer solo.

**5. El recibo prematuro en la PWA — misma corrección, dos versiones.**
En prod son equivalentes (`saldo` ES `det.faltaPagar` cuando hay API). En demo ganó la entrante:
`pendienteValidacion` descarta el INFORMADO zombie —el que la inmobiliaria ya confirmó o rechazó
y sigue en el store local—, y "hay algún pago INFORMADO" lo contaba igual.

## Lo que se miró y no se tocó

- **`POST /rendiciones` tiene CUATRO `?? 100`**, no uno: alquileres, gastos, gastos de reclamos y
  otros ingresos. T-23-N3 arreglaba sólo el de alquileres y **es el único que se tocó acá**. El
  mismo razonamiento aplica a los otros tres (un `find` que no matchea le atribuye el 100% a este
  dueño), pero extenderlo cambia el comportamiento de rutas que su autor no testeó, y un merge no
  es el lugar. Queda como **T-44-N2**.
- **La auth que trajo T-25 se revisó a propósito**, porque una feature de sesión entrando por
  merge sin que nadie la mire en esta rama es justo lo que no hay que dejar pasar. Está bien
  hecha: exige sesión previa, acota por tenant (404 para otra inmobiliaria, sin confirmar
  existencia), pide el PIN **del destino**, audita rechazo y éxito con autor, y el lockout resuelve
  la carrera del incremento atómico —su propio comentario calcula que con read-then-write romper
  5 dígitos bajaba de ~208 días a ~9—. No se le cambió nada.

## Verificación

- **`tsc` en 0** en los seis paquetes.
- **385/385 tests** sin base, 39 archivos (eran 360/37 antes de consolidar: +25 tests que estaban
  escritos y no corría nadie).
- Dos veces `tsc` agarró algo que el merge automático había dejado pasar: el cliente de Prisma
  viejo tras los enums nuevos de T-25, y un `codigo` duplicado en el mismo objeto literal.

## Migraciones

**Esta tarea no escribió ninguna**, pero al consolidar entraron migraciones que antes no estaban
en la rama —entre ellas `20260819180000_conmutador_usuarios`, que agrega cuatro valores a
`TipoEventoAuditoria`—. **Suben la cuenta de T-01.**

Importa por un antecedente concreto: sin aplicar, un valor de enum que la base no conoce hace
fallar la escritura, y eso ya pasó con `RENOVACION`. El código de T-25 escribe
`SESION_CONMUTADA`, `CONMUTACION_RECHAZADA`, `PIN_DESBLOQUEADO` y `PIN_ELIMINADO`: **si se
deploya el código sin la migración, el conmutador rompe al auditar**. Van juntos o no van.

## Tareas nuevas detectadas

- **T-44-N2** · Los otros tres `?? 100` de `POST /rendiciones` (gastos, gastos de reclamos, otros
  ingresos). 🟡
- **T-44-N3** · Esto va a volver a pasar. No hay nada que avise cuándo una rama con trabajo
  terminado se queda afuera: se descubre cuando alguien mira. Un chequeo en CI que liste las ramas
  con commits fuera de la de integración cuesta poco y convierte un goteo invisible en un aviso. 🟡
