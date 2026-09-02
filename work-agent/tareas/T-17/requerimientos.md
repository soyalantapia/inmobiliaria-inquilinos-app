# T-17 · Notificar los reclamos por mail y en la plataforma

## 1. El problema, en una frase

Cuando un inquilino abre un reclamo, la inmobiliaria **no se entera** salvo que entre al panel a
mirar; y cuando la inmobiliaria resuelve o asigna un profesional, **el inquilino tampoco recibe
nada por fuera de la app**.

## 2. La cita que lo respalda

Alan, reunión del 03/08 `[47:36]`:
> *"Toca hacer las notificaciones, tiene que notificarle también los reclamos, tiene todo por
> email y por la plataforma, **por si no no está enterada**."*

## 3. Estado actual — VERIFICADO hoy contra el código

La tarea original decía "falta el mail y el lado del inquilino". **La mitad de eso ya está.**
Lo que encontré:

| Canal | Lado inmobiliaria | Lado inquilino |
|---|---|---|
| **En la plataforma** | ✅ La campana muestra "N reclamos sin resolver" (`notifications-bell.tsx`, commit `afbf08f`) | ✅ `GET /mis-notificaciones` ya emite tres avisos de reclamo: *"Te respondieron tu reclamo"*, *"Te asignaron a {profesional}"* y *"Calificá tu última reparación"* (`inquilino-mundo.ts`, sección 3 del feed) |
| **Por mail** | ❌ **nada** | ❌ **nada** |

`apps/api/src/mailer.ts` exporta **exactamente seis** envíos y ninguno es de reclamos:
`enviarOtp`, `enviarOtpAdmin`, `enviarInvitacionInquilino`, `enviarBienvenidaInmobiliaria`,
`enviarInvitacionEquipo`, `enviarAnuncioEmail`.

> **Conclusión: el alcance real de T-17 es sólo el mail.** La parte "en la plataforma" está
> cubierta en los dos lados. Esto achica la tarea de forma importante y hay que corregirlo en
> `09-TAREAS-REUNION-CAMILA.md`.

## 4. Comportamiento esperado

**A · La inmobiliaria se entera de un reclamo nuevo.**
Cuando un inquilino crea un reclamo (`POST /mis-reclamos`), se manda un mail al contacto de la
inmobiliaria con: quién lo abrió, la propiedad, la categoría, la urgencia y la descripción, más
un CTA al panel.

**B · El inquilino se entera de que su reclamo avanzó.**
Cuando la inmobiliaria **asigna un profesional** o **resuelve** el reclamo, se manda un mail al
inquilino titular con el estado nuevo y un CTA a la PWA.

En los dos casos: **el mail es best-effort y NUNCA rompe la operación.** Si el SMTP no está
configurado o falla, la acción principal (crear el reclamo, asignarlo, resolverlo) tiene que
completarse igual.

## 5. Alcance

**Entra:**
- Tres mails nuevos en `mailer.ts`, siguiendo el patrón de los existentes (HTML email-safe con
  tablas + estilos inline, preheader, versión texto plano).
- Los tres disparos, después de que la transacción commitea.
- Que la urgencia `EMERGENCIA` se note en el asunto.

**NO entra —y es deliberado:**
- **WhatsApp.** No existe integración (`env.ts` no declara ninguna `WHATSAPP_*`). Prometerlo
  sería repetir el problema de T-18.
- **Preferencias de notificación por usuario.** No hay modelo para eso; es una tarea aparte.
- **Digest / agrupación.** Un mail por evento. Si el volumen molesta, se revisa después con
  datos reales.
- **Notificar a co-inquilinos.** El feed in-app ya es a nivel contrato; el mail va al titular,
  que es quien tiene el email garantizado.
- **Reclamos rechazados.** No hay copy definido y es una conversación delicada: la maneja el
  operador a mano.

## 6. Criterios de aceptación

- **AC-1** · Un inquilino crea un reclamo → se envía un mail al contacto de la inmobiliaria con
  autor, propiedad, categoría, urgencia y descripción. El reclamo se crea igual si el mail falla.
- **AC-2** · Se asigna un profesional → el inquilino titular recibe un mail con el nombre del
  profesional. La asignación funciona igual si el mail falla.
- **AC-3** · Se resuelve un reclamo → el inquilino titular recibe un mail. La resolución
  funciona igual si el mail falla.
- **AC-4** · Con `mailerConfigured === false` (sin SMTP), los tres endpoints siguen devolviendo
  200 y **no** tiran.
- **AC-5** · Un reclamo con urgencia `EMERGENCIA` lleva esa marca en el asunto.
- **AC-6** · Si el inquilino no tiene email cargado, no se intenta el envío y no se rompe nada.
- **AC-7** · `tsc` en 0 en `apps/api`.

## 7. Impacto en plata / permisos / multi-tenant

- **Plata:** ninguno. No toca liquidaciones, pagos, rendiciones ni caja.
- **Permisos:** ninguno. No cambia capacidades; los mails salen de endpoints ya gateados.
- **Multi-tenant:** el destinatario sale **siempre** de la fila ya scopeada por
  `inmobiliariaId` que el handler cargó. **Nunca** de un id del request. Es el punto a cuidar:
  mandarle a la inmobiliaria equivocada el reclamo de otra sería una fuga de datos entre tenants.

## 8. Qué NO se puede romper

- Crear, asignar y resolver reclamos tiene que seguir funcionando **exactamente igual**, con y
  sin SMTP configurado.
- El feed in-app (`GET /mis-notificaciones`) no se toca.
- La campana del panel no se toca.
- El modo demo (`apiEnabled === false`) no se toca: esto es backend puro.
- Los seis mails que ya existen siguen andando.
