# 🏗️ PROMPT — Backend completo de My Alquiler (100% funcional, front + back sincronizados)

> Pegá todo lo de abajo (desde "ROL") en una sesión de Claude Code parada en
> `~/dev/inmobiliaria-inquilinos-app`. Construye el backend entero, migra el
> frontend dominio por dominio, prueba todo y deja el producto operativo.

---

ROL: Sos el **Tech Lead full-stack de My Alquiler con CONTROL TOTAL**. El dueño te
delegó el 100% de las decisiones técnicas. Tu misión: convertir el producto —hoy
una demo impecable sobre `localStorage`— en un sistema **100% funcional y
operativo**, con backend real, frontend sincronizado, datos persistentes
multi-usuario y pruebas que lo demuestren. Trabajás por fases, commiteás por fase,
y verificás cada fase end-to-end antes de seguir. No preguntás por gustos
técnicos (ya están decididos acá); solo frenás ante acciones destructivas, gasto
de dinero no autorizado o bloqueos que requieran una acción humana.

## 1 · El producto (contexto)
My Alquiler = SaaS de gestión de alquileres (Argentina). Monorepo Turborepo+pnpm:
- 🏢 **apps/inmobiliaria** (:3001) — panel de la inmobiliaria. Persona: **Roberto
  Tapia**, dueño de "Inmobiliaria del Sol". Roles: ADMIN / OPERADOR / CARGA
  (ver `lib/permisos.ts`, `lib/rol-storage.ts`). Hoy auto-login mock.
- 🏠 **apps/inquilino** (:3000) — PWA mobile-first del inquilino. Persona:
  **Mariela Sosa** (contrato `cnt_001`, consorcio Gorriti 4521 `cnsr_001`).
  Hoy login OTP mock + bypass `?demo=1`.
- **packages/ui** (design system compartido), **packages/config**.

Tesis: consolidar el quilombo (Excel + WhatsApp + reclamos) en un lugar. El "wow"
es el screening de inquilinos y el certificado del inquilino.

## 2 · Estado técnico actual (lo que hay que reemplazar)
- **TODO el dato vive en `localStorage`**: ~26 stores en
  `apps/inmobiliaria/src/lib/*-storage.ts` y ~11 en `apps/inquilino/src/lib/`
  (anuncios, aprobaciones, caja, conciliación, consorcios, contratos-docs,
  pin-seguridad, profesionales, reclamos, rendiciones, renovaciones implícitas,
  servicios, co-inquilinos, acuses, certificado, piloto-reportes, etc.).
  **Esos archivos + `lib/types.ts` + `lib/mock-data.ts` SON la spec del schema**:
  leelos antes de modelar; los tipos TS existentes mapean 1:1 a tablas.
- **Hacks cross-app a eliminar** (funcionan solo same-origin): el inquilino lee
  `llave-inmo:anuncios:v1` directo del localStorage del inmo
  (`apps/inquilino/src/lib/anuncios-cross-app.ts`); el inmo "blendea" acuses
  simulados con el acuse real del inquilino (`contarAcuses` en
  `apps/inmobiliaria/src/lib/anuncios-storage.ts`); boletas/ratings cross-app
  ídem. **Todo eso lo reemplaza la API.**
- **Ambas apps son `output: 'export'`** (estático en GH Pages) → no hay server
  Next en runtime. Todo fetching es client-side. El backend es un servicio aparte.
- Existe **`REPORTE-PM-PRODUCTO.md`** (auditoría: 114 hallazgos). El backend
  cierra de raíz varios críticos: rendiciones reales (ficha propietario vs
  lista), loop caja→rendición (`marcarDescontado` hoy huérfano), acuses reales
  de anuncios, screening coherente, documentos reales. Tenelo abierto de
  referencia; los hallazgos puramente de UI no son tu scope.
- Deploy actual: push a `main` → GitHub Actions → GH Pages. ⚠️ **El token de gh
  NO tiene scope `workflow`**: cualquier cambio en `.github/workflows/` será
  rechazado al pushear. Si necesitás tocar workflows (ej. inyectar
  `NEXT_PUBLIC_API_URL` en el build), pedile al dueño que corra
  `gh auth refresh -s workflow` ANTES, o resolvelo sin tocar workflows
  (default en `next.config.mjs` / `.env.production`).
- Convenciones del repo: TypeScript estricto, tsc + lint limpios SIEMPRE antes de
  commitear, commits con trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## 3 · Stack — DECIDIDO (no re-debatir)
| Capa | Elección | Por qué |
|---|---|---|
| API | **apps/api: Fastify 5 + TypeScript** (puerto **3002**) | liviano, rápido de construir, mismo lenguaje que el front, encaja en el monorepo |
| ORM/DB | **Prisma + PostgreSQL en Railway** | migraciones versionadas, types generados, el dueño ya tiene proyecto Railway |
| Validación | **Zod** en `packages/shared` (schemas + tipos compartidos front/back) | una sola fuente de verdad de contratos de datos |
| Auth | **JWT Bearer** (`@fastify/jwt`) + bcrypt | sin cookies cross-site (GH Pages ↔ Railway), simple y robusto |
| Front data layer | **TanStack Query** + `apiClient` fino por dominio | async + cache + refetch; reemplaza los stores sync |
| Fallback demo | Si `NEXT_PUBLIC_API_URL` está vacío → los hooks usan los stores localStorage actuales | la demo de GH Pages sigue funcionando offline; migración sin riesgo |
| Deploy API | **Railway** (Dockerfile en `apps/api`, determinístico en monorepos) | mismo proyecto que la DB |
| Realtime | Polling de TanStack Query (`refetchInterval`/focus) | suficiente v1; websockets = v2 |
| Tests | **Vitest** + `app.inject()` de Fastify (integración) + e2e con Claude Preview | rápido y sin browser para la API |

**Multi-tenant liviano desde el día 1**: toda tabla lleva `inmobiliariaId`; el JWT
carga `{ userId, inmobiliariaId, rol }` (o `{ inquilinoId, contratoId }`). Tenant
seed: "Inmobiliaria del Sol".

## 4 · Railway — base de datos y deploy (acceso AUTORIZADO)
- **Proyecto del dueño:** `https://railway.com/project/b01a1ecb-2169-46ef-b6cf-71a2d6cca234?environmentId=857efc10-adc4-43a0-9058-355753fd1d7b`
- **Vía preferida — Railway CLI** (ya instalado y logueado como AlanTapia):
  `railway link -p b01a1ecb-2169-46ef-b6cf-71a2d6cca234` (elegí el environment
  `857efc10-…`), `railway add -d postgres` para crear la DB, y
  `railway variables` para leer `DATABASE_URL`. Para el deploy del API:
  `railway up` (o crear el service y conectarlo al repo).
- **Plan B — Chrome del dueño:** el dueño autorizó explícitamente usar su sesión
  de Chrome (claude-in-chrome MCP) **solo** para ese proyecto Railway (crear la
  DB / copiar credenciales / configurar el service) si la CLI fallara.
- **Secretos:** `DATABASE_URL`, `JWT_SECRET`, etc. van en `apps/api/.env` (local)
  y en Railway variables (prod). **JAMÁS commitear secretos**; agregá `.env*` al
  `.gitignore` del api. En el chat, mostrá las URLs de conexión SIEMPRE truncadas.
- Crear recursos dentro de ese proyecto está autorizado. Cualquier cosa que
  implique **plan pago / upgrade de Railway → confirmar con el dueño antes**.

## 5 · Modelo de datos (mapear desde los stores; esta lista es el esqueleto)
`Inmobiliaria` (tenant) · `Usuario` (rol ADMIN/OPERADOR/CARGA, passwordHash,
pinHash) · `Inquilino` (persona + user OTP) · `Propietario` (+CBU, comisión,
notas) · `Propiedad` (+documentos) · `Contrato` (estado, montos, moneda, índice
de ajuste, fechas, garantías; ver `ContratoListado`/`lib/types.ts`) ·
`Liquidacion`/`Pago` (estado PENDIENTE/PAGADO/PARCIAL/VENCIDO, informes de pago
del inquilino, conciliación) · `MovimientoCaja` (gasto por propiedad,
`descontadoEnRendicion`) · `Rendicion` (por propietario+período; **consume los
gastos de caja y los marca descontados** — cierra el loop huérfano) ·
`Aprobacion` (tipos NO-monetarios: CONTRATO_CARGADO, GASTO_CAJA_ELIMINACION,
DEVOLUCION_DEPOSITO, AJUSTE_FUERA_DE_INDICE; aprobar/rechazar exige PIN) ·
`Reclamo` (+timeline de eventos, urgencia, SLA por urgencia — `lib/sla-reclamos.ts`,
profesional asignado) · `Profesional` · `Anuncio` (+audiencia y `audienciaIds`) ·
`AnuncioAcuse` (**leídoAt/confirmadoAt POR usuario — el server calcula el
"Leído X/N · Confirmado Y/N" real**; borrar la simulación del front) ·
`CoInquilino` (DNI, teléfono, relación, permiso VER/PAGAR/COMPLETO) ·
`BoletaServicio` · `Consorcio` (+unidades funcionales) · `Renovacion`/decisión ·
`Screening` (informe persistido; servicio simulado server-side pero **coherente**:
el nombre/DNI del informe = el solicitado) · `Certificado` (cálculo server del
historial del inquilino) · `Notificacion` · `ReportePiloto` — implementando el
TODO de `lib/piloto-storage.ts`: **tracking absoluto server-side** (userId+rol+
tenant del JWT, URL completa, IP real —`x-forwarded-for` en Railway—, userAgent
parseado, sessionId, timestamp del server, versión/build). Definir retención en
el README y no exponer la IP en el front.
`AuditoriaEvento` (persistir lo que hoy hace `auditoria-storage.ts`).

Seeds = **portar los mocks actuales** (Mariela/cnt_001, los 6 contratos, Gorriti
4521, propietarios, reclamos, anuncios seed, etc.) para que la demo se vea
idéntica con datos reales. Script `pnpm --filter api seed` idempotente.

## 6 · Auth (diseño cerrado)
- **Inmobiliaria:** `POST /auth/login` email+password → JWT (15d). Seeds:
  `roberto@delsol.com` (ADMIN), `luciana@delsol.com` (OPERADOR),
  `camila@delsol.com` (CARGA), password dev `delsol123`, **PIN de aprobaciones
  `1234`** (bcrypt). El middleware de permisos reusa las capacidades de
  `lib/permisos.ts` (moverlas a `packages/shared`).
- **Inquilino:** `POST /auth/otp/request` (email) + `POST /auth/otp/verify` →
  JWT. En dev/demo el OTP es `000000` (y se loguea en consola del API). Si algún
  día hay `RESEND_API_KEY`, se manda por mail — opcional, no bloquea.
- **Demo:** `POST /auth/demo` (solo si `DEMO_MODE=true`) devuelve el JWT de
  Mariela → mantiene el flujo `?demo=1` del front intacto.
- Token en `Authorization: Bearer`; el front lo guarda en localStorage
  (`llave:auth:token`).

## 7 · Plan por fases (cada fase = schema + endpoints + tests + front migrado + e2e + commit)
**Definition of Done de CADA fase:** tsc+lint limpios en todo el monorepo · tests
de API verdes (`pnpm --filter api test`) · el front consume el endpoint vía
TanStack Query (con fallback localStorage si no hay API_URL) · verificado e2e en
Claude Preview (REGLA 0) · commit con mensaje `feat(api): …` · actualizar
`BACKEND-PROGRESS.md` (checklist vivo para retomar entre sesiones).

- **Fase 0 — Cimientos:** scaffolding `apps/api` (Fastify+Prisma+Zod+vitest,
  Dockerfile, `/health`), `packages/shared` (tipos+schemas), Railway link + crear
  Postgres + `DATABASE_URL` en `.env`, primera migración vacía, CORS
  (`http://localhost:3000`, `http://localhost:3001`, `https://soyalantapia.github.io`),
  `apiClient` + provider de TanStack Query en ambas apps (detrás del flag).
- **Fase 1 — Auth + tenancy:** modelos Inmobiliaria/Usuario/Inquilino, login,
  OTP, demo, PIN, permisos. Front: pantallas de login reales contra API
  (manteniendo el modo demo). Seeds de usuarios.
- **Fase 2 — Núcleo de datos:** propiedades, propietarios, contratos
  (+documentos reales con upload — guardar en DB como referencia y archivo en
  disco/S3-compatible de Railway si hace falta; v1 puede ser metadata+blob en
  Postgres si es chico), inquilinos. Migrar las listas y fichas del inmo.
- **Fase 3 — La plata:** liquidaciones/pagos + informar pago (inquilino) +
  validar/conciliar (inmo) + caja de gastos + **rendiciones que consumen gastos y
  los marcan descontados** + aprobaciones con PIN. Migrar /pagos, /caja,
  /aprobaciones, checkout y comprobantes del inquilino. (Acá mueren los críticos
  de plata del reporte PM.)
- **Fase 4 — Operación:** reclamos end-to-end (inquilino crea → inmo asigna
  profesional → timeline → resolver con validación), SLA server-side,
  profesionales, renovaciones, consorcios.
- **Fase 5 — Comunicación:** anuncios (audiencias resueltas server-side con
  conteo real de destinatarios) + **acuses reales** (leído al abrir, confirmado
  con "Enterado"; el inmo ve X/N real) + notificaciones. Borrar
  `anuncios-cross-app.ts`, el blend `contarAcuses` y `simularSobre`.
- **Fase 6 — El wow del inquilino:** servicios/boletas, co-inquilinos (invitación
  por email con token de aceptación — el "Simular que aceptó" muere), certificado
  calculado server (con datos seed que den nivel BUENO/EXCELENTE), screening
  server-side coherente, reportes piloto con tracking completo.
- **Fase 7 — Producción:** deploy del API a Railway (`railway up`), variables
  prod, `DEMO_MODE=true` en el tenant demo, smoke contra prod, build del front
  con `NEXT_PUBLIC_API_URL` apuntando a Railway (ver gotcha del workflow scope),
  **CONFIRMAR con el dueño antes del primer deploy a producción del front**,
  rate-limit + helmet/cors fino + backups Railway, `BACKEND.md` (cómo correr
  todo: dev, test, seed, deploy) y reporte final.

## 8 · Testing (no negociable)
- **Integración API:** Vitest + `app.inject()` por dominio (auth, permisos por
  rol, flujos completos: informar pago→validar, gasto→rendir→descontado,
  anuncio→acuse→conteo, aprobar-con-PIN-incorrecto falla). DB de test: misma
  Postgres con schema `test` (`?schema=test` en la URL) + truncate entre suites.
- **E2E con Claude Preview MCP** (launch.json: `llave-inquilino` :3000,
  `llave-inmobiliaria` :3001; el API corrélo con Bash en :3002):
  - **REGLA 0:** verificá identidad de cada app antes de medir (es My Alquiler,
    no Vulcano/Deenex/San Pedro). Pantalla en blanco sin errores = HMR corrupto →
    `preview_stop`+`start`.
  - `preview_click` no siempre dispara React → usá `.click()` nativo y setters
    nativos vía `preview_eval`; esperá `sleep(300-450ms)` antes de medir; los
    `<Select>` de Radix: un cambio por eval.
  - El e2e estrella (el que prueba que el back vive): **inmo crea anuncio →
    inquilino lo ve vía API → toca "Enterado" → el contador del inmo sube de
    verdad** (dos orígenes distintos, cero localStorage compartido).
- **Smoke de prod** (fase 7): script `scripts/smoke-prod.mjs` que pega a
  `/health` + login demo + 3 endpoints clave.

## 9 · Reglas de seguridad y límites
- Nunca commitear secretos; `.env` fuera de git; URLs de conexión truncadas en chat.
- No tocar `.github/workflows/` sin que el dueño corra `gh auth refresh -s workflow`.
- Confirmar con el dueño en el chat: primer deploy del API a prod, switch del
  front de GH Pages a la API, cualquier gasto/upgrade en Railway, y cualquier
  acción destructiva sobre la DB (drop/reset en prod).
- `prisma migrate reset` SOLO en dev/test, jamás contra la DB de prod.
- Commit por fase; push cuando la fase está verde. No mergear nada por tu cuenta
  fuera de `main` ya acordado.
- Si una sesión se corta: `BACKEND-PROGRESS.md` + `git log` son tu memoria;
  retomá desde ahí sin re-preguntar.

## 10 · Entregables finales
1. `apps/api` corriendo en Railway, DB Postgres poblada con seeds.
2. Ambas apps consumiendo la API (con fallback demo offline intacto).
3. Suite de tests verde + e2e verificado (incluido el loop real de acuses).
4. `BACKEND.md` (arquitectura, cómo correr, envs, deploy) +
   `BACKEND-PROGRESS.md` (checklist por fase) + reporte final en el chat con lo
   hecho, lo verificado y lo pendiente.
