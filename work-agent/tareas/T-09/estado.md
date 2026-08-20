# T-09 · Qué campos bloquean el alta del inquilino — TERMINADA
- rama: feat/reunion-camila-0308 · commit: b3e9efa · fase: 8

## La respuesta a la pregunta de Camila
SÍ pueden continuar, y ya podían el 03/08.
- Backend: el zod sólo exige `nombre` (min 2); apellido/email/telefono/dni son .optional()
- Front: pasoInquilinoValido = nombre>=2 && emailInquilinoOk (que es true con email vacío)
- `git log -S` confirma que esa línea no cambió desde el 15/06/2026
No había nada que mover a opcional: ya lo era todo. La UI además ya decía "sólo el nombre
es obligatorio".

## Lo que sí faltaba (y es el cambio que entró)
Sin email el inquilino NO PUEDE ENTRAR a la app (login = OTP por email,
/auth/otp/request busca por Inquilino.email). El copy lo vendía como que "ayuda a
invitarlo". Ahora hay un aviso ámbar bajo el campo que lo dice con todas las letras.
AVISA, NO BLOQUEA: cargar la cartera con lo que hay es legítimo y es lo que Camila
necesita para migrar.

## No verificado
Navegador: en demo /contratos/nuevo muestra el wizard MOCK; el real está detrás de
apiEnabled y llegar al paso 2 exige un API con propiedades (= tenant real, prohibido).

## Limitación que afecta a TODOS los chats
Cualquier tarea que toque una pantalla que sólo existe con apiEnabled=true NO es
verificable en navegador con las reglas actuales. Hoy: el wizard real de alta, el
validador de resumen bancario, la bandeja de pagos por validar. Habilitar esa
verificación pide un entorno de staging con su propia DB — no está.
