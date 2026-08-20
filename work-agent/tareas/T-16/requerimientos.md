# T-16 · Avisarle al inquilino cuando le suben el alquiler — requerimientos

## El problema, en una frase

A un inquilino le suben el alquiler y no se entera: lo descubre cuando le llega la liquidación
del mes siguiente más cara.

## La cita

Reunión del 03/08. Camila ajusta un alquiler por IPC, a mano `[10:26]`. Alan, entrando como
inquilino `[10:39]`:
> *"No me avisó que me subiste, que hubo un aumento."*

Y `[10:45]`: *"Con ajuste manual necesitamos avisarle."* `[10:54]`: *"Eso hay que validarlo:
cómo funciona cuando se sube de forma manual el alquiler, avisar que hubo un aumento."*

**Por qué es 🔴 y no 🟡:** subirle el alquiler a alguien sin avisarle es un problema legal y de
confianza, no de UX.

## Estado actual verificado (19/08)

**No existe ningún aviso, por ningún canal.**

| Qué se revisó | Resultado |
|---|---|
| `apps/api/src/mailer.ts` | Exporta **seis** envíos: `enviarOtp`, `enviarOtpAdmin`, `enviarInvitacionInquilino`, `enviarBienvenidaInmobiliaria`, `enviarInvitacionEquipo`, `enviarAnuncioEmail`. **Ninguno es de ajuste** |
| `GET /mis-notificaciones` (`inquilino-mundo.ts:1093`) | El feed se **deriva on-read** de liquidaciones y pagos. No hay modelo de notificación guardada, y **no mira los ajustes** |
| `POST /contratos/:id/ajustar` (`core.ts:1642`) | Crea `AjusteAlquiler` ✓ y actualiza el contrato. **No avisa** |
| `PATCH /contratos/:id/monto` (`core.ts:2737`) | Actualiza el contrato, crea `EventoContrato` y re-devenga futuras. **NO crea `AjusteAlquiler`** y **no avisa** |

### El hallazgo que define el diseño

**Hay dos caminos de ajuste y sólo uno deja fila en `AjusteAlquiler`.** Si el aviso se deriva de
esa tabla —que es lo natural, porque tiene `montoAnterior`, `montoNuevo`, `periodoDesde` y
`motivo`—, el ajuste hecho por `PATCH /monto` **no avisaría nada**. Y no sabemos cuál de los dos
usó Camila.

Verificado que unificarlos es **seguro**: `vigenciasFuturas` (`lib/liquidaciones.ts`) filtra
`periodoDesde: { gt: periodo }`, o sea **estrictamente futuras**. Una fila con
`periodoDesde = período actual` —que es lo que corresponde a `PATCH /monto`, que re-devenga
desde el mes en curso— queda **excluida de `canonDelPeriodo` y no toca el devengo**.

## Comportamiento esperado

1. Los **dos** caminos de ajuste dejan fila en `AjusteAlquiler` (historial completo,
   independiente de por dónde entró el operador).
2. Los **dos** mandan un email al inquilino con: monto anterior, monto nuevo, desde qué período
   rige y el motivo si lo hay.
3. El ajuste aparece en `GET /mis-notificaciones`, así que se ve en la campana de la PWA.
4. El aviso **no puede hacer fallar el ajuste**: si el SMTP está caído, el ajuste se aplica igual.

## Alcance

**Entra:** la fila de ajuste en el segundo camino, el email en los dos, y la notificación en el
feed del inquilino.

**NO entra:**
- Notificar al inquilino de otros eventos (pago validado, reclamo resuelto): es **T-17**, y
  necesita la decisión de producto de quién recibe qué.
- Avisar por WhatsApp: **no existe integración** (`env.ts` no declara ninguna var `WHATSAPP_*`).
  El copy que lo promete es **T-18**.
- Tocar la alerta *"Próximo ajuste en N días"* del home: es otra cosa —anticipa un ajuste que
  todavía no pasó— y funciona.

## Criterios de aceptación

- **AC-1** · Tras `POST /contratos/:id/ajustar`, existe una fila `AjusteAlquiler` **y** el
  inquilino recibe un email con los dos montos y el período desde el que rige.
- **AC-2** · Tras `PATCH /contratos/:id/monto`, **también** existe la fila y **también** llega el
  email. (Antes este camino no dejaba fila.)
- **AC-3** · `GET /mis-notificaciones` incluye el ajuste reciente, con los montos y el período.
- **AC-4** · Con SMTP no configurado o caído, el ajuste **se aplica igual** y la respuesta es 200.
- **AC-5** · El email **no se manda** si el inquilino no tiene email cargado, y eso tampoco hace
  fallar el ajuste.
- **AC-6** · La fila nueva de `AjusteAlquiler` de `PATCH /monto` **no cambia el devengo**: las
  liquidaciones que genera el cron siguen dando lo mismo que antes del cambio.

## Impacto en plata / permisos / multi-tenant

- **Plata:** indirecto y **controlado**. Se agrega una fila a una tabla que el devengo lee
  (`vigenciasFuturas`), pero con un `periodoDesde` que ese filtro excluye por ser `gt`. AC-6 es
  el criterio que lo blinda.
- **Permisos:** ninguno nuevo. Los dos endpoints ya piden `contratos.crear` + guard de rol CARGA.
- **Multi-tenant:** la notificación se deriva dentro de `requireContratoAcceso`, que ya acota al
  contrato del inquilino.

## Qué NO se puede romper

- El devengo (ver AC-6). Es lo único delicado de esta tarea.
- `GET /contratos/:id/ajustes` sigue andando; ahora además muestra los ajustes que entraron por
  `PATCH /monto`, que antes faltaban.
- El feed del inquilino en modo demo.
- Un ajuste tiene que poder aplicarse aunque el mail falle (AC-4).
