# T-31 — CERRADA

Throttle de mails + el fallo del aviso deja de ser silencioso.

## Qué se hizo

1. **Cola de envío** (`apps/api/src/mailer.ts`). `crearColaDeEnvio` serializa y espacia
   (`SMTP_GAP_MS`, default 400). Pasan por ahí los 5 envíos que salen de a muchos.
2. **Dos carriles.** El OTP va por `enviarYa`, derecho. Con una FIFO única, un anuncio a 200
   inquilinos dejaba el próximo login esperando el código ~80 s. Regresión que introdujo la
   propia cola; salió en el role play de Camila sobre la plataforma entera.
3. **`sin-email` viaja en la respuesta** del ajuste (`avisoInquilino`). El ajuste masivo lista
   en un panel persistente a quiénes no les llega el aviso. En el toast solo no alcanzaba: se
   borra a los segundos y esa lista es a quién tiene que llamar la inmo.
4. **Rebote de SMTP → `EventoContrato`.** Como el envío es asincrónico, el rebote llega después
   de responder: queda asentado en el historial del contrato.
5. **La renovación también avisa.** Tercer camino que cambia el canon; T-16 arregló dos y este
   quedó afuera. Lo destapó el sed al tocar los `return`.

## Verificación

- `test/mailer-cola.test.ts` (4) y `test/mailer-otp-no-espera.test.ts` (1): **verdes**.
- Mutación: sin serialización caen 2/4; con el OTP en la cola compartida cae el otro
  (636 ms contra un límite de 120). Los tests detectan lo que dicen detectar.
- `tsc --noEmit` limpio en `api` e `inmobiliaria`; `next lint` sin hallazgos nuevos.
- Los 4 tests rojos de la suite (`sonar-correlacion`, `backfill-mascotas`) son **preexistentes**:
  verificado con `git stash`. Los 52 archivos rojos son por `DATABASE_URL`/`JWT_SECRET`
  ausentes, no hay DB local.

## Deuda anotada

`COMUNICACION_ENVIADA` se usa para registrar un envío **fallido** — el título lo aclara. Agregar
`COMUNICACION_FALLIDA` al enum exige una migración, y hasta aplicarla en prod el insert
fallaría, lo comería el mismo catch, y el fallo volvería a ser invisible. Cuando se apliquen las
migraciones de T-01, conviene sumar el valor y cambiar la escritura.
