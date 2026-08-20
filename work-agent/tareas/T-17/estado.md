# T-17 — Notificar los reclamos por mail y en la plataforma

- tomada: 2026-08-19
- worktree: `../myalquiler-T-17`
- rama: `feat/T-17-notificaciones-reclamos` (base: `feat/reunion-camila-0308`, **no** `main`)
- commit: `119ff3f`
- fase: **8 — terminada**

## Qué quedó hecho

Tres mails nuevos y su cableado:

| Evento | Destinatario | Endpoint |
|---|---|---|
| El inquilino abre un reclamo | La inmobiliaria | `POST /mis-reclamos` (`operacion.ts`) |
| Se asigna un profesional | El inquilino titular | `POST /reclamos/:id/asignar` |
| Se resuelve el reclamo | El inquilino titular | `POST /reclamos/:id/resolver` |

Archivos: `apps/api/src/mailer.ts` (+3 exports), `apps/api/src/lib/avisos-reclamo.ts` (nuevo),
`apps/api/src/routes/operacion.ts` (3 disparos), `apps/api/test/avisos-reclamo.test.ts` (nuevo).

## El alcance era la mitad de lo que decía la tarea

Al verificar, **la parte "en la plataforma" ya estaba en los dos lados**: la campana del panel
cuenta los reclamos sin resolver (commit `afbf08f`) y `GET /mis-notificaciones` ya emite
*"Te respondieron tu reclamo"*, *"Te asignaron a X"* y *"Calificá tu última reparación"*.
**Faltaba sólo el mail.** Corregido en `09-TAREAS-REUNION-CAMILA.md`.

## Qué NO quedó hecho, y por qué

- **WhatsApp**: no existe la integración (`env.ts` no declara ninguna `WHATSAPP_*`).
- **Preferencias de notificación por usuario**: no hay modelo. Tarea aparte.
- **Digest / agrupación**: un mail por evento. Si molesta el volumen, se revisa con datos reales.
- **Aviso a co-inquilinos**: el mail va al titular, que es quien tiene email garantizado.
- **Reclamos rechazados**: conversación delicada, sin copy definido. La maneja el operador.
- **Fase 5 (prueba en navegador)**: **no aplica**. Es backend sin superficie visual, y sin SMTP
  configurado no hay nada observable. Levantar el API contra la base de producción para probar
  el envío real violaría la regla 4. Lo que garantiza el comportamiento es el test puro.

## Verificación

- `tsc --noEmit` en `apps/api`: **0**.
- Test puro `avisos-reclamo.test.ts`: **5/5**. Y **verificado en rojo**: quitando el
  `if (!t) return false;` de `enviarReclamoNuevoInmo`, el test falla — o sea que prueba algo.
- No se corrió ningún test que toque la base.

## Veredicto de la Fase 7 — como Camila

> "Esto sí me sirve. Lo del mail cuando entra un reclamo es lo que yo venía pidiendo: yo no
> puedo estar todo el día mirando la pantalla, y si a alguien se le rompe un caño un viernes a
> la noche me tengo que enterar. Que diga EMERGENCIA en el asunto está bien pensado, porque yo
> los mails los miro del celular y con eso sé si abrirlo o no.
>
> Lo que no me cierra: **me va a llegar un mail por cada reclamo**. Yo tengo 220 propiedades. Si
> un mes se me juntan quince, son quince mails míos más los que ya recibo. Y todos van a mi
> misma casilla, la de la inmobiliaria, no a la de la chica que los maneja. Habría que poder
> decir a quién le llega cada cosa.
>
> Y otra: el mail me lleva al panel, bien. Pero cuando entro, sigo sin poder **tomar** el
> reclamo ni ponerlo en curso — eso no anda, ya lo dije. Entonces me entero más rápido de algo
> que después no puedo mover. Me sirve igual, pero es media solución.
>
> Del lado del inquilino está bien que le avise cuando le mando al plomero. Lo de que pueda
> reabrirlo si sigue el problema me gusta, porque hoy me llaman por teléfono para eso."

**Traducción a acciones** (van como tareas nuevas, no las hice porque no son de T-17):

1. **Destinatario configurable por tipo de aviso.** Hoy todo va a `Inmobiliaria.email`. Con 220
   propiedades, la administradora no quiere todos los mails operativos en su casilla.
2. **El estado `EN_CURSO` sigue siendo inalcanzable** — "tomar / poner en curso" no tiene
   endpoint (ya está documentado en `07-ECOSISTEMA.md §3.4`). Este mail lo vuelve más visible:
   ahora se entera antes de algo que sigue sin poder gestionar.

## Lo que necesita tu mano

- **Nada de migraciones ni deploy** en esta tarea: es código puro, sin schema.
- **Sí hace falta que SMTP esté configurado en producción** (`SMTP_HOST`, `SMTP_USER`,
  `SMTP_PASS`) para que esto haga algo. Si no lo está, los avisos devuelven `false` en silencio
  y el sistema sigue funcionando igual — pero Camila no se entera de nada. **Conviene
  verificarlo antes de decirle que está listo.**
- La rama sale de `feat/reunion-camila-0308`, no de `main`. Al mergear, respetar ese orden.
