# T-11 · Qué se puede editar hoy de un contrato que ya tiene pagos, y quién

Relevamiento pedido por T-11 ("Que la administradora pueda editar un contrato que ya tiene
pagos"). Medido sobre `apps/api/src/routes/core.ts` y `plata.ts` en la rama de T-11.

**El hallazgo que da vuelta el ticket: el problema no es que los pagos bloqueen la edición.**
Ningún endpoint de edición se niega a trabajar porque el contrato tenga pagos — todos editan
igual y lo que hacen es *proteger las cuotas que ya tienen plata en juego*, dejándolas con su
monto histórico. El ticket describe un bloqueo que no existe.

Lo que sí existe es más chico y más concreto: **hay nueve datos del contrato que no tienen
ningún endpoint de edición**, ni con pagos ni sin pagos. Para corregir cualquiera de esos hay
que rehacer el contrato — que es literalmente la "rescisión falsa" de la que se queja Camila.

---

## 1. Lo que SÍ se puede editar después del alta

| Dato | Endpoint | Rol | Qué hace con las cuotas que ya tienen plata |
|---|---|---|---|
| Canon (`monto`) | `PATCH /contratos/:id/monto` · `POST /:id/ajustar` | ADMIN, OPERADOR | Sólo re-devenga las futuras `PENDIENTE` **sin pagos**; las pagadas/parciales quedan a su monto histórico |
| Canon + `fechaFin` + `diaPago` | `POST /contratos/:id/renovar` | ADMIN, OPERADOR | Ídem |
| Expensas + `tipoContrato` | `PATCH /contratos/:id/expensas` | ADMIN, OPERADOR | Deja con las expensas **viejas** a las cuotas con un pago informado, aunque después se rechace |
| Esquema de mora | `PUT /contratos/:id/mora` | ADMIN, OPERADOR | No toca cuotas; el punitorio se recalcula al leer |
| Modo de cobranza | `PATCH /contratos/:id/modo-cobranza` | ADMIN, OPERADOR | Bloquea si hay plata en vuelo; `updateMany` condicionado contra cambio concurrente |
| Estado + datos de baja | `POST /contratos/:id/finalizar` | ADMIN, OPERADOR | Anula la deuda fantasma futura; **conserva** las cuotas ya vencidas y los pagos en vuelo |
| Depósito | `POST /contratos/:id/deposito/resolver` | ADMIN, OPERADOR | Cierra los cargos que se cobraban contra él |
| Teléfono del inquilino | `PATCH /contratos/:id/inquilino-contacto` | ADMIN, OPERADOR, **CARGA** | — |
| Email del inquilino | `PATCH /contratos/:id/inquilino-contacto` | ADMIN, OPERADOR | — *(el corte a CARGA lo agrega este mismo PR)* |
| Garantes (alta/edición/baja) | `POST` · `PUT` · `DELETE /contratos/:id/garantes` | ADMIN, OPERADOR, **CARGA** | — |
| Co-inquilinos (alta) | `POST /contratos/:contratoId/co-inquilinos` | ADMIN, OPERADOR, **CARGA** | — |
| Co-inquilinos (baja) | `DELETE /contratos/:contratoId/co-inquilinos/:id` | ADMIN, OPERADOR | — |
| `devengarDesde` | sólo importación de cartera | — | No hay UI |

Los trece pasan por `contratos.crear` (`ADMIN | OPERADOR | CARGA`). Los que cortan a CARGA lo
hacen con un `if (u.rol === 'CARGA')` explícito adentro del handler, uno por uno — **no hay un
middleware que lo garantice**, y por eso `inquilino-contacto` se quedó afuera durante todo T-45.
Ver §3.

## 2. Lo que NO se puede editar por ningún camino

Escrito una sola vez, en el alta (`POST /contratos`, `core.ts:1538-1561`) y en los dos caminos
de importación. Ningún `contrato.update` de todo el repo los toca:

| Dato | Por qué duele |
|---|---|
| `propiedadId` | Cargaron el contrato contra la unidad equivocada del mismo edificio |
| `inquilinoTitular` | El titular se cargó mal, o cambió (cesión) |
| `fechaInicio` | Un día de diferencia corre todo el devengo |
| `moneda` | — |
| `indiceAjuste` | **El más probable de los nueve**: eligieron ICL donde iba IPC |
| `frecuenciaAjusteMeses` | Ídem: cuatrimestral donde iba semestral |
| `comisionInmobiliaria` | Cambia la plata de todas las rendiciones futuras |
| `sociedadId` | — |
| `penalidadRescisionMeses` / `mascotasPermitidas` | Menores, pero tampoco hay dónde |

`cbuAlias` y `titularCuenta` del **contrato** tampoco tienen endpoint (los del propietario sí).

## 3. La asimetría que se arregla en este PR

`PATCH /contratos/:id/inquilino-contacto` era el único de los cinco endpoints de edición que no
cortaba a CARGA — y desde T-45 escribe `Inquilino.email`, que es el **login** del inquilino (el
OTP viaja ahí). Un rol cuyo trabajo espera aprobación podía reapuntar el acceso a la app de
cualquier inquilino, sin aprobación y sin rastro. El gemelo del otro lado del mostrador ya
estaba cerrado: en `propietarios` el `email` y el `cbuAlias` están gateados por rol.

El docblock del endpoint seguía justificando la ausencia del corte con *"scope: solo teléfono"*
y *"cambiar el teléfono no rerutea plata"*. Las dos dejaron de ser ciertas cuando T-45 agregó el
email, y la justificación se quedó escrita igual. **Ese es el patrón**: el permiso no está mal
elegido, está desactualizado respecto de lo que el endpoint terminó haciendo.

## 4. Lo que sale de acá (tickets sugeridos, no hechos)

- **T-11-a · Editar índice y frecuencia de ajuste.** El caso más probable de los nueve. Necesita
  decidir qué pasa con los ajustes ya aplicados: ¿se recalculan hacia atrás o rige desde el
  próximo? **Es una decisión de producto, no técnica.**
- **T-11-b · Cambiar la propiedad de un contrato mal cargado.** Arrastra las liquidaciones, la
  rendición al propietario y el estado de las dos propiedades. Caro.
- **T-11-c · Corregir `fechaInicio`.** Sólo tiene sentido si todavía no se devengó nada; con
  cuotas emitidas es re-devengar el contrato entero.
- **T-11-d · Un test que exija el corte de rol en los cinco endpoints de edición.** Hoy cada uno
  lo repite a mano; el sexto que se agregue va a volver a olvidárselo, igual que este.
