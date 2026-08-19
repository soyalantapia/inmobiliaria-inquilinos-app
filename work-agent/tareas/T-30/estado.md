# T-30 · El mail sale de un no-reply y el copy invita a responderlo — CERRADA
- fase: 8 — TERMINADA
- commit: 84b268b · rama feat/T-30-mail-responde · worktree ../myalquiler-T-30-mail
- base: b48ba58 (feat/reunion-camila-0308, con T-31 ya adentro)

## Qué se hizo
`replyTo` con el email de la inmobiliaria en los 4 mails que son comunicacion de ella hacia
una persona: aviso de ajuste, anuncios, bienvenida al inquilino, invitacion al equipo.
Los de la plataforma (los 2 OTP + bienvenida a la inmobiliaria) siguen SIN replyTo a proposito.

El copy depende de que la direccion exista y sea valida: sin ella no invita a responder.
Poner solo el header no alcanzaba — ese era el bug original.

`emailDeRespuesta()` valida y degrada a "sin replyTo", NUNCA a "sin mail": el envio es
best-effort y el caller se traga los errores, asi que una direccion basura habria dejado al
inquilino sin aviso del aumento y sin rastro.

De arrastre: el pie de shell() decia "si no pediste este codigo" en TODOS los mails. Ahora dice
si acepta respuesta o no; lo del codigo quedo solo en el OTP.

Panel: "Email administrador" en Configuracion ahora aclara que ahi caen las respuestas de los
inquilinos. Ese campo estreno un segundo trabajo por culpa de este cambio.

## NO hay migracion. NO hay dependencia nueva.

## Verificado
- tsc 0 en apps/api y apps/inmobiliaria.
- 21 tests verdes en los 3 archivos de mailer (16 nuevos en test/mailer-responder.test.ts).
- 107 tests verdes en el set puro completo (14 archivos).
- Mutacion: emailDeRespuesta siempre null -> caen 6; sin validar formato -> caen 3.
- Manual: se renderizo el HTML real de ajuste-con-respuesta / ajuste-sin-respuesta / otp y se
  verifico copy + header replyTo en cada uno.
- health.test.ts rojo ANTES de mi cambio tambien (ZodError por DATABASE_URL/JWT_SECRET
  ausentes). Confirmado con git stash.
- NO se probo en navegador la aclaracion del panel: el puerto 3001 lo tiene el dev server de
  otro chat y el script `dev` hardcodea `-p 3001`. Se verifico con tsc + lectura.

## Veredicto de Camila (fase 7)
"Ahora sirve. Le mando el aumento y si el inquilino me contesta, me llega. Antes le estaba
diciendo que me escriba a un buzon que no existe — eso es peor que no decirle nada.
Dos cosas: en el celular el mail sigue apareciendo como 'My Alquiler' y mis inquilinos no
saben que es eso; que diga Tapia. Y la app del inquilino me sigue prometiendo WhatsApp por
todos lados — eso ya lo dije."

## Tareas nuevas
- T-30-N1 · El remitente sigue diciendo "My Alquiler", no la inmobiliaria (BE+PROD, amarilla).
- T-30-N2 · enviarInvitacionEquipo no escapa el HTML (SEC+BE, amarilla).

## Riesgo de integracion detectado (no es tarea nueva)
feat/T-18-copy-honesto NO esta mergeada en feat/reunion-camila-0308: las ~9 promesas de
"Te avisamos por WhatsApp" de la PWA siguen vivas en la rama de integracion. Otro chat la tiene.
