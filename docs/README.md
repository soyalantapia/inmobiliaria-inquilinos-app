# `docs/` — Referencias técnicas

Documentación de referencia de My Alquiler. Para el contexto general empezá por
[`../PROJECT.MD`](../PROJECT.MD) (documento maestro) y [`../README.md`](../README.md).

| Documento | Para qué |
|---|---|
| [`API.md`](./API.md) | **Referencia de los 105 endpoints** — auth, request, respuesta, errores y reglas de negocio, por archivo de routes. |
| [`DATA-MODEL.md`](./DATA-MODEL.md) | **Modelo de datos** — ERD (mermaid), comportamiento `onDelete` de las FK, scoping multi-tenant, unique/índices clave. |
| [`CONFIG.md`](./CONFIG.md) | **Variables de entorno** — tabla completa por app (API/panel/inquilino/test): requerida, default, dónde se setea, para qué. |
| [`RUNBOOK.md`](./RUNBOOK.md) | **Operaciones / on-call** — diagnóstico, incidentes comunes, rollback, acceso a la DB, rotación de secretos, backup. |
| [`TESTING.md`](./TESTING.md) | **Testing** — vitest + `app.inject` + `seedBase`, la DB de test, escribir tests, E2E-contra-prod. |
| [`FRONTEND.md`](./FRONTEND.md) | **Guía de front** — patrón `apiEnabled`, convenciones de hooks, subida de archivos, design system `@llave/ui`. |
| [`GLOSARIO.md`](./GLOSARIO.md) | **Glosario del dominio** — términos inmobiliarios (liquidación, rendición, comisión, etc.). |

Otros docs en la raíz: [`../CONTRIBUTING.md`](../CONTRIBUTING.md) (cómo contribuir),
[`../SECURITY.md`](../SECURITY.md) (modelo de seguridad), [`../CHANGELOG.md`](../CHANGELOG.md)
(historial). Handoff operativo en [`../work-agent/`](../work-agent/).
