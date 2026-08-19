# T-18 — Sacar el copy que promete lo que el sistema no hace

- tomada: 2026-08-19
- worktree: `../myalquiler-T-18`
- rama: `feat/T-18-copy-honesto` (base: `feat/reunion-camila-0308`)
- commit: `09792bd`
- fase: **8 — terminada**

## Qué quedó hecho

**Ocho promesas de WhatsApp corregidas.** La tarea listaba tres; el barrido encontró cinco más:

| Dónde | Decía |
|---|---|
| `checkout/page-client.tsx` (toast) | "te avisamos por WhatsApp" |
| `checkout/page-client.tsx` (estado de espera) | "te avisamos por WhatsApp" |
| `pagos-por-validar.tsx` (al rechazar) | "Le avisamos a X con tu nota" |
| `ayuda/page.tsx` (FAQ) | "Te avisamos por WhatsApp cuando esté confirmado" |
| `reclamos/page.tsx` | "Te avisamos por WhatsApp cuando lo tomen" |
| `reclamos/[id]/page-client.tsx` (x2) | "Te avisamos por WhatsApp…" |
| `onboarding.tsx` (calendario) | "Te avisamos por WhatsApp antes" |
| `p/[token]/page-client.tsx` (profesional) | "Te avisamos por WhatsApp cuando llegue un trabajo" |

El reemplazo es **"te avisamos acá en la app"**, que es verdad y verificable:
`GET /mis-notificaciones` ya emite "Tu comprobante fue confirmado/rechazado", "Te respondieron
tu reclamo" y "Te asignaron a X". Dos excepciones decididas caso por caso: al **profesional del
link mágico** no se le puede avisar por ningún lado (no tiene cuenta ni app) → la promesa se
**saca**; y el bullet del **calendario** del onboarding vendía un aviso previo inexistente para
una pantalla que además es `<Proximamente/>` en prod.

**El registro de comunicaciones ahora es real.** El diálogo "Nuevo mensaje" prometía
*"Queda registrado en el historial del contrato"* y no registraba nada. Nuevo
`POST /contratos/:id/comunicaciones` que crea un `EventoContrato` tipo `COMUNICACION_ENVIADA`;
el diálogo lo llama después de abrir el canal, best-effort, y el toast dice la verdad en cada caso.

## Qué NO se tocó, a propósito

- **Los botones `wa.me`** con texto pre-armado: son honestos, los manda la persona.
- **El copy dentro de `PagosPorValidarDemo`** ("enviada por WhatsApp y mail"): vive detrás de
  `!apiEnabled`, no lo ve nadie en producción. Verificado que la línea 143 sí está en el
  componente de prod y las 575/579 no.
- **`configuracion-pais.tsx:183`** ("avisamos por mail cuando esté listo"): es una lista de
  espera de país, no una promesa operativa, y el mail sí existe como canal. Queda anotado abajo.

## Verificación

- `tsc --noEmit` en **api, inmobiliaria e inquilino**: los tres en **0**.
- Barrido final: no queda ninguna promesa de aviso por WhatsApp viva en producción.
- **Fase 5 (navegador) no se corrió.** Son cambios de texto y un endpoint nuevo; probar el
  registro end-to-end necesita el API contra una base, y la única disponible es producción
  (regla 4). El riesgo es bajo y `tsc` cubre el cableado del nuevo prop.

## Veredicto de la Fase 7 — como Camila

> "Esto está bien y es de las cosas que más me molestaban sin saber decirlo. Yo mandaba el
> mensaje por WhatsApp y después el inquilino me decía 'no me llegó nada' — claro, porque el
> sistema le había dicho a él que le íbamos a avisar, y nunca le avisó nadie. Ahora al menos no
> promete.
>
> Lo del historial sí me sirve de verdad. Yo necesito poder decir 'el 12 te mandé esto' y que
> esté anotado. Antes le sacaba captura al WhatsApp.
>
> Ahora, ojo: **queda anotado que mandé un mensaje, pero no queda el mensaje**. Digo, si yo
> escribí tres párrafos explicándole el aumento, ¿eso se guarda? Porque si guarda sólo el asunto
> no me sirve para discutir después."

**Punto válido y verificado**: el `cuerpo` **sí** se guarda, en `EventoContrato.detalle`. Lo que
falta es que el front lo **muestre** — la pestaña Historial que construyó T-07 hay que revisar si
renderiza `detalle` o sólo `titulo`. Queda como **T-18-N1**.

## Tareas nuevas detectadas

- **T-18-N1 · Que el historial muestre el cuerpo del mensaje, no sólo el asunto.**
  `EventoContrato.detalle` ya guarda el texto completo; verificar si la pestaña Historial lo
  renderiza. Sin eso, el registro no sirve para el caso de uso real (respaldar una discusión).
  *Experto:* FE-P. *Prioridad:* 🟠.
- **T-18-N2 · Revisar el copy de espera de país** (`configuracion-pais.tsx:183`): promete un
  mail de aviso cuando el país esté disponible, y no hay lista de espera detrás.
  *Experto:* PROD. *Prioridad:* 🟢.

## Lo que necesita tu mano

- **Ninguna migración.** `EventoContrato` ya existía; sólo se agregó un endpoint.
- **Depende de T-07**: el read-path `GET /contratos/:id/eventos` lo construyó ese chat. Al
  mergear, T-07 va antes que T-18. Las dos salen de `feat/reunion-camila-0308`, así que el orden
  natural funciona.
- Cuando merges **T-17** (los mails de reclamo), el copy "te avisamos acá en la app" **sigue
  siendo correcto** — pasa a ser conservador, porque además va a salir mail. Si querés, ahí se
  puede mejorar a "te avisamos por mail y en la app", pero no es necesario.
