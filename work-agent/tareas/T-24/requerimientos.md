# T-24 · Cargar morosos históricos sin inventar contratos

## 1. El problema, en una frase

Camila no puede empezar a usar el sistema con su cartera real, porque los **50 inquilinos que
ya se fueron debiendo plata** no tienen dónde entrar.

## 2. Las citas

- `[50:04]` *"Yo ahora tengo 50 morosos. Cuando yo inicie, ¿puedo cargar un moroso que no tiene
  contrato y no tiene vigencia?"*
- `[51:06]` *"Tendría que empezar cargando los morosos para recién cargar el contrato vigente…
  [si tengo] cinco inquilinas en la misma propiedad… **ni en pedo, no lo hago**."*
- `[53:35]` *"No voy a cargar cinco veces un inquilino en una sola misma propiedad."*
- Alan `[53:05]`: *"¿Podría ser que en propiedades o en inquilinos puedas hacer una importación
  o cargar morosos atados a una propiedad nada más?"*
- Y un pedido lateral `[52:00]`: al cargar el DNI de alguien de hace seis años, su sistema le
  avisa *"ya estás registrado"*.

## 3. Estado actual — VERIFICADO

| Pieza | Qué cubre | Por qué NO alcanza |
|---|---|---|
| `periodosAnterioresPendientes` + `lib/estado-inicial-contrato.ts` | Un contrato **en curso** que arranca en el pasado: marca cada mes vencido como PAGADO / PARCIAL / ADEUDA y genera pagos sintéticos | Es para el inquilino **actual**. No sirve para alguien que ya se fue |
| `POST /contratos` | Alta normal | **Rechaza con 409 si la propiedad ya tiene contrato activo** (`core.ts:1005`) y **no acepta `estado`**: siempre crea ACTIVO. La propiedad de un moroso viejo hoy está alquilada a otro ⇒ el alta es imposible |
| `importaciones-cartera.ts` | Excel/CSV → propiedad + propietario + inquilino + contrato **ACTIVO** (`:471` fija `tipoContrato: 'ALQUILER'`) | No importa deuda de gente que se fue |
| `Persona` + `lib/persona.ts` | Identidad reutilizable por tenant, resolución DNI → email → crear | Existe y sirve, pero **no tiene deuda colgada** |

**Conclusión: no hay ningún camino hoy.** Es un hueco de modelo, no un bug.

## 4. La decisión de modelo (esto es lo que la tarea pedía resolver primero)

Se evaluaron dos opciones.

**Opción A — un modelo nuevo `DeudaHistorica`** (persona + propiedad + monto + moneda + concepto).
Fácil de cargar. **Se descarta**: queda desconectado de toda la maquinaria de deuda. No sumaría
a `deudaTotal`, no se podría saldar con `POST /contratos/:id/saldar-deuda`, no aparecería en la
cuenta corriente ni en los KPIs, y habría que cablear cada superficie a mano. Sería una segunda
verdad sobre la plata, que es justo lo que este sistema evita en todos lados
(`lib/saldos.ts` es "la FUENTE DE VERDAD de cuánto se pagó" precisamente para no tener dos).

**Opción B — un contrato histórico en estado FINALIZADO, que NO reclama la propiedad.** ✅
La deuda vive donde ya vive toda la deuda del sistema: en `Liquidacion`. Reusa **todo** lo que ya
existe y está testeado — saldos, mora, `saldar-deuda`, la ficha de la Persona, el semáforo al
reusar un inquilino, los KPIs.

**La objeción de Camila no es al modelo, es al trabajo.** Ella no dice "no quiero que haya cinco
contratos", dice *"no voy a cargar cinco veces un inquilino"*. Conceptualmente **sí fueron cinco
alquileres distintos**: cinco personas, cinco períodos, cinco deudas. Lo que hay que eliminar es
el esfuerzo, no la estructura — y eso se resuelve con **carga masiva**, que es exactamente lo que
Alan propuso.

## 5. Comportamiento esperado

Un endpoint nuevo, `POST /contratos/historico`, que en una transacción:

1. Resuelve o crea la `Persona` (DNI → email → crear, reusando `buscarOCrearPersona`).
2. Crea el `Inquilino` de ese contrato histórico.
3. Crea el `Contrato` en estado **FINALIZADO**, sobre una propiedad que **puede tener otro
   contrato activo**, y **sin tocar `contratoActualId`**.
4. Genera las `Liquidacion` de los períodos que se indiquen, con su estado
   (PAGADO / PARCIAL / ADEUDA), reusando `aplicarEstadoInicial`.

## 6. Alcance

**Entra:** el endpoint, la validación, los tests puros de la aritmética, y que la deuda quede
visible y saldable por los caminos que ya existen.

**NO entra —y se documenta como tarea siguiente:**
- **La UI y la importación masiva.** Es lo que Camila necesita para no cargar 50 a mano, pero sin
  el backend no hay nada que cablear. Va como **T-24-N1**.
- Depósito, mora configurable, garantes, documentos: un contrato histórico es un registro de
  deuda, no un contrato operativo.

## 7. Criterios de aceptación

- **AC-1** · Se puede crear un contrato histórico sobre una propiedad **que ya tiene contrato
  activo**, y la propiedad **no cambia** de `contratoActualId` ni de estado.
- **AC-2** · Nace en `FINALIZADO`: no aparece en la cartera activa, no devenga a futuro, no lo
  toca el cron.
- **AC-3** · Sus liquidaciones ADEUDA suman a la deuda de esa Persona y se ven en su ficha.
- **AC-4** · `POST /contratos/:id/saldar-deuda` la salda, sin ningún caso especial.
- **AC-5** · Si la Persona ya existe (mismo DNI), **se reusa** y no se duplica.
- **AC-6** · Multi-tenant: propiedad de otra inmobiliaria ⇒ 404.
- **AC-7** · Sólo ADMIN u OPERADOR (no CARGA, no LECTURA): está creando deuda.
- **AC-8** · `tsc` en 0.

## 8. Impacto en plata / permisos / multi-tenant

- **Plata: alto, y es el punto a cuidar.** Está creando deuda de la nada. Dos riesgos concretos:
  (a) que esa deuda se cuele en los KPIs de la **cartera vigente** y ensucie la morosidad real;
  (b) que un contrato histórico entre al circuito de **rendición** y le descuente al propietario
  algo que nunca se cobró. Lo segundo está cubierto: la rendición parte de pagos CONCILIADOS y
  un contrato con deuda ADEUDA no tiene ninguno. Lo primero hay que verificarlo.
- **Permisos:** capacidad nueva no; se exige `contratos.crear` + guard de rol explícito.
- **Multi-tenant:** propiedad y persona siempre scopeadas por `inmobiliariaId`.

## 9. Qué NO se puede romper

- El alta normal de contratos, incluido su 409 cuando la propiedad está ocupada.
- El devengo: el cron toma `estado: 'ACTIVO'`, así que un FINALIZADO no lo toca. **Verificarlo.**
- La rendición y el cierre de caja.
- Los KPIs de morosidad de la cartera vigente.
