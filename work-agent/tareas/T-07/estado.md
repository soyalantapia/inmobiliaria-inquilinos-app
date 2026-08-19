# T-07 · Completar el expediente del contrato — TERMINADA

- rama: feat/reunion-camila-0308
- commit: 04ea61e
- worktree: ninguno (chat único; se trabajó en la rama de integración)
- fase: 8 (cerrada)

## Qué quedó hecho
- GET /contratos/:id/eventos (tenant validado sobre el contrato) + autor resuelto a nombre.
- Pestaña Historial cableada, con estado de error distinto del empty state.
- Servicios de la propiedad en el Resumen del contrato (solo lectura).
- Link del inquilino a su ficha de Persona.
- Arreglado .claude/launch.json (invocaba pnpm sin PATH y filtraba por nombres inexistentes).

## Qué NO entró, a propósito
- Pestaña Comunicaciones: registrar comunicaciones es feature, depende de T-17. El copy
  mentiroso del diálogo es T-18.
- Ampliar TipoEventoContrato: que CREADO / PAGO_RECIBIDO / RECLAMO_CREADO no se escriban
  nunca es otro problema (ver tarea nueva T-29).

## Migraciones
Ninguna.

## Verificado
- tsc 0 en api, inmobiliaria, inquilino.
- Navegador, modo demo: Historial renderiza los eventos con autores, sin errores de consola.
- NO verificado en producción: requiere entrar al tenant real (prohibido por las reglas).
- Sin tests nuevos: no hay aritmética que justifique un test puro. El test que valdría es de
  integración (aislamiento por tenant) y necesita la DB de producción.

## Tarea nueva detectada
T-29 · Los eventos de contrato que nunca se escriben (ver 09-TAREAS).
