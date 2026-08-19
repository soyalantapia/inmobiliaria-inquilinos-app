# T-30 · Que el mail de la inmobiliaria se pueda responder

## 1. El problema, en una frase
El inquilino recibe un mail de su inmobiliaria que le dice "respondele", aprieta Responder,
y esa respuesta no le llega a nadie.

## 2. La cita
Camila (role play de T-16): *"¿Responderle a dónde? Si el mail sale de no-reply, me van a
contestar ahí y no me va a llegar nunca."*

## 3. Estado actual verificado (19/08, sobre b48ba58)
- `apps/api/src/mailer.ts:16` — `from = SMTP_FROM ?? 'My Alquiler <no-reply@myalquiler.app>'`.
  **Ningún envío setea `replyTo`.** Los 7 exports mandan sólo `from`.
- `apps/api/src/mailer.ts:613` — el aviso de ajuste cierra con *"Si algo no te cierra,
  respondele a {inmobiliariaNombre} antes del próximo vencimiento"* (html) y :654 (texto).
- `apps/api/src/mailer.ts:169` — el pie COMPARTIDO de `shell()` dice *"Si no pediste este
  código, podés ignorar este email"* en TODOS los mails, incluido el aviso de aumento y los
  anuncios, donde no hay ningún código.
- `Inmobiliaria.email` es `String` **requerido** (schema:624). Todo tenant tiene uno.
- Los callers de invitación ya traen `inmo.email` y lo muestran en el pie del mail.
  Los de ajuste (`core.ts:118`) y anuncios (`anuncios.ts:209`) seleccionan **sólo `nombre`**.
- La PWA SÍ muestra el teléfono de la inmobiliaria (`useMiContrato().inmobiliariaTelefono`,
  `contrato/page.tsx:485` con link `tel:`), así que derivar al teléfono no sería mentira.

## 4. Comportamiento esperado
Los mails que son **comunicación de la inmobiliaria a una persona** llevan `replyTo` con el
email de la inmobiliaria: aviso de ajuste, anuncios, invitación al inquilino, invitación al
equipo. Responder cae en la casilla de la inmobiliaria.

Los que son **de la plataforma** (OTP del inquilino, OTP del panel, bienvenida a la
inmobiliaria) NO llevan replyTo: no hay inmobiliaria a la que derivar.

El copy deja de invitar a responder cuando no hay a dónde: si el tenant no tiene email
cargado, el texto no dice "respondé".

## 5. Alcance
**Entra:** `replyTo` en los 4 mails de inmobiliaria; copy del aviso de ajuste (html + texto);
pie compartido de `shell()` diciendo la verdad sobre si el mail acepta respuesta; los selects
de Prisma que hoy no traen el email; tests puros.

**NO entra:** cambiar el `from` a la dirección de la inmobiliaria (rompe SPF/DKIM del dominio
que firma — es la razón por la que replyTo es el arreglo correcto y no un parche); montar una
casilla que reciba y reenvíe; el escapeo HTML faltante de `enviarInvitacionEquipo`; tocar el
OTP.

## 6. Criterios de aceptación
- AC-1: `enviarAvisoAjusteAlquiler` con `inmobiliariaEmail` seteado manda `replyTo` con esa
  dirección, y el cuerpo dice "Respondé este mail".
- AC-2: sin `inmobiliariaEmail` (o vacío / inválido) **no** manda `replyTo` y el cuerpo **no**
  contiene la palabra "respond".
- AC-3: lo mismo para anuncios, invitación de inquilino e invitación de equipo: replyTo cuando
  hay dirección, ausente cuando no.
- AC-4: OTP (inquilino y panel) y bienvenida a la inmobiliaria siguen SIN replyTo.
- AC-5: el pie de todo mail dice si acepta respuesta o no. Ningún mail sin código dice
  "si no pediste este código".
- AC-6: `avisarAjusteAlInquilino` (core.ts) y `enviarEmailsAnuncio` (anuncios.ts) traen el
  email de la inmobiliaria del select y se lo pasan al mailer.

## 7. Impacto en plata / permisos / multi-tenant
Plata: ninguno. Permisos: ninguno.
Multi-tenant: **sí, y es lo delicado.** El email que viaja en `replyTo` tiene que ser el de
la inmobiliaria DUEÑA de ese contrato/anuncio, nunca otro. Todos los selects ya filtran por
`inmobiliariaId`; el email sale de la misma fila, no de una variable de entorno ni de un
default global.

## 8. Qué NO se puede romper
- El OTP sigue saliendo por `enviarYa` (fuera de la cola) — T-31.
- La cola y su espaciado siguen intactos.
- Best-effort: ningún fallo de mail puede voltear un ajuste, un alta o un anuncio.
- Los tests de `mailer-cola` y `mailer-otp-no-espera` siguen verdes.
- Modo demo: el mailer es sólo backend, `apiEnabled` no lo toca.
