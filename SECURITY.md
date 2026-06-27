# Seguridad — My Alquiler

Modelo de seguridad del sistema. My Alquiler maneja **plata y datos personales**
(propietarios, inquilinos, montos, CBUs, comprobantes), así que el aislamiento entre
inmobiliarias y la autenticación son críticos.

## Aislamiento multi-tenant (la garantía central)

**Toda fila pertenece a una inmobiliaria** (`inmobiliariaId`). La garantía: una
inmobiliaria **nunca** ve ni toca datos de otra.

- Los 3 tipos de JWT llevan `inmobiliariaId`; los guards lo extraen y **toda query lo
  filtra**.
- **Regla de oro**: nunca `findUnique/update/delete` por un id que viene del request
  sin filtrar también por `inmobiliariaId`. Usar `findFirst({ where:{ id, inmobiliariaId }})`
  y `updateMany/deleteMany` con `inmobiliariaId` en el WHERE. Si el id es de otro
  tenant → 404 (no se distingue "no existe" de "no es tuyo").
- Esto se audita explícitamente en cada campaña (dimensión "aislamiento multi-tenant").
  La auditoría 27/06 verificó los endpoints nuevos (uploads, documentos, servicios,
  PUT propiedades, co-inquilinos, cron) — todos tenant-scopeados.

## Autenticación

Auth **propia** (OTP + JWT, **no** Clerk). Los 3 tokens (HS256, firmados con `JWT_SECRET`):

| Token | Para | Emisión |
|---|---|---|
| `usuario` | panel inmobiliaria | `POST /auth/login` (email + password bcrypt) — JWT 15 días |
| `inquilino` | titular del contrato | OTP por email (`/auth/otp/request` + `/verify`) |
| `co-inquilino` | co-inquilino del contrato | link de invitación (un solo uso) → sesión propia |

- **Password**: hash **bcrypt** (nunca en claro). **PIN** (4 a 6 dígitos, acciones
  de plata; `pinNuevo` valida `/^\d{4,6}$/` en `auth.ts`): hash bcrypt + **lockout
  anti-fuerza-bruta** (5 intentos → 15 min) en `apps/api/src/auth/pin.ts`.
- **Email de usuario panel GLOBAL** (no por tenant) a propósito: el login busca el
  email globalmente, así dos tenants no comparten email. El alta de usuario valida
  unicidad global. (Decisión documentada — no scopear, rompería el login.)
- **Co-inquilino**: el link de aceptación es de **un solo uso** (lock atómico); el
  permiso (VER/PAGAR/COMPLETO) se **revalida contra la DB en cada request**
  (`requireContratoAcceso`), no se confía en el JWT de 15 días → bajar un permiso
  surte efecto al instante.
- **Backdoor demo (OTP `000000`)**: requiere **ambas** condiciones — `DEMO_MODE`
  activo **y** `NODE_ENV !== 'production'` (`auth.ts`). En prod (`DEMO_MODE=false`)
  no existe.

## Autorización (roles + capacidades)

Roles del panel: `ADMIN | OPERADOR | CARGA | LECTURA`. Capacidades por rol en
`packages/shared/src/permisos.ts`. Notas de seguridad:

- Lo que carga **CARGA** (`*.crear`) queda **pendiente de aprobación** de un ADMIN
  (`rolesAprobacion:['CARGA']`).
- Las acciones destructivas (DELETE propietario/propiedad, finalizar contrato) llevan
  un **guard de rol explícito** además de la capacidad, porque `*.crear` sola dejaría
  pasar a CARGA.
- Las acciones sensibles de plata (validar/rechazar/revertir pago, rendir, devolver
  depósito) exigen **PIN** además del rol.

## Archivos (file storage)

- Subida (`POST /uploads`): allowlist de tipos (jpeg/png/webp/gif/heic/pdf), límite
  10 MB, nombre aleatorio (`uuid`), guardado en `/data/uploads/<inmobiliariaId>/…`.
- Servido (`GET /uploads/:tenant/:name`): valida `tenant === inmobiliariaId` del token
  (403 cross-tenant) + anti path-traversal (basename exacto). Acepta `?token=` en query
  (un `<img>/<a>` no manda header) y lo valida igual.
- Al persistir una URL (comprobante/documento) se valida el **prefijo de tenant**
  (`urlEsDelTenant`) → no se guarda una URL externa ni de otra inmobiliaria.

## Endurecimiento HTTP

- `@fastify/helmet` (headers de seguridad), `@fastify/cors` (origins permitidos via
  `CORS_ORIGINS` — debe incluir los dominios de los fronts), `@fastify/rate-limit`.
- **Error handler global**: mapea errores conocidos (Zod→400, Prisma P2002/P2003→409,
  P2025→404, P2034→409) → no se filtran stacktraces ni detalles internos al cliente.
- Validación de **todo** body/query con **zod** antes de tocar la DB.

## Secretos y configuración

- Secretos **solo** en variables de entorno de Railway (`JWT_SECRET`, `DATABASE_URL`,
  SMTP, `CRON_SECRET`, etc.). **Nunca** commitear secretos. Ver [`docs/CONFIG.md`](./docs/CONFIG.md).
- `apps/api/.env` (local) apunta a una **DB de test**, no a prod. No commitearlo con valores reales.
- `JWT_SECRET` de prod ≠ test. Rotarlo invalida todas las sesiones (ver
  [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) → rotación de secretos).
- `POST /internal/cron/devengar` está **cerrado por defecto**: requiere
  `x-cron-secret == CRON_SECRET`; si la var no está, devuelve 401 siempre.

## Datos sensibles (PII)

- **Personales**: nombre, email, teléfono, DNI, CUIT de propietarios/inquilinos/co-inquilinos.
- **Financieros**: montos, CBU/alias (`CuentaCobranzaDirecta`), comprobantes de pago.
- Acceso siempre scopeado por tenant + rol. Los comprobantes solo se sirven a usuarios
  de la misma inmobiliaria.

## Reportar una vulnerabilidad

Es un proyecto privado. Si encontrás un problema de seguridad, **no abras un issue
público**: avisá directo al owner (Alan, `soyalantapia` en GitHub) con repro e impacto.
No publiques ni explotes datos del tenant real.

## Checklist de seguridad para un PR

- [ ] ¿Toda query nueva filtra por `inmobiliariaId`?
- [ ] ¿El endpoint tiene el guard de auth + la capacidad/permiso correctos?
- [ ] ¿Acción de plata sensible → exige PIN?
- [ ] ¿Body/query validados con zod?
- [ ] ¿No se filtran datos de otro tenant en includes/respuestas?
- [ ] ¿Ningún secreto hardcodeado / logueado?
