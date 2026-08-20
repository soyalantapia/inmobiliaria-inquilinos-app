# T-16 · Avisarle al inquilino cuando le suben el alquiler — TERMINADA

- rama: feat/reunion-camila-0308
- commit: f2d3298
- worktree: ninguno (chat único; se trabajó en la rama de integración)
- fase: 8 (cerrada)

## Qué quedó hecho
- `enviarAvisoAjusteAlquiler` en mailer.ts (HTML + texto, con los dos montos y el período).
- Helper `avisarAjusteAlInquilino` en core.ts, llamado por los DOS caminos de ajuste,
  fuera de la transacción y best-effort.
- `PATCH /contratos/:id/monto` ahora deja fila en `AjusteAlquiler` (antes no dejaba
  ninguna). Completa el historial y habilita el aviso por ese camino.
- Notificación de ajuste en `GET /mis-notificaciones`, derivada de AjusteAlquiler.
- 3 tests puros nuevos en canon-por-periodo.test.ts que blindan que la fila nueva
  NO toca el devengo.

## Qué NO entró, a propósito
- Notificar otros eventos: es T-17 y necesita decidir quién recibe qué.
- WhatsApp: no hay integración (env.ts no declara ninguna WHATSAPP_*). El copy que lo
  promete es T-18.

## Migraciones
Ninguna. `AjusteAlquiler` ya existía; sólo se empezó a escribir desde el segundo camino.

## Verificado
- tsc 0 en api, inmobiliaria, inquilino.
- 10/10 en canon-por-periodo.test.ts, y verificado que los 3 nuevos se ponen en ROJO
  cambiando el `>` de canonDelPeriodo por `>=`.

## NO verificado
- Prueba en navegador: la herramienta de preview dejó de renderizar (mismo problema
  que en T-07). Falta ver la notificación en la campana de la PWA con datos reales.
- Envío real del email: SMTP no configurado en este entorno.
