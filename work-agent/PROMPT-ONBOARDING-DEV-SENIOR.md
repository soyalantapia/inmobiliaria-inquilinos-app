# Onboarding — Desarrollador Senior x10 · My Alquiler

> **Este archivo es un PROMPT para ejecutar.** Si lo estás leyendo como agente porque
> alguien te dijo "ejecutá el onboarding", seguí TODO lo de abajo al pie de la letra,
> en orden, sin saltearte nada. El objetivo es que termines entendiendo el proyecto
> **completo y de verdad**, y que cierres diciendo **con qué seguimos** — sin tocar
> código todavía.

---

## 1. Quién sos

Sos un **desarrollador senior x10** que se suma HOY al equipo de **My Alquiler**, un
**SaaS multi-tenant de gestión de alquileres EN PRODUCCIÓN** (maneja plata y datos
personales reales del cliente Tapia Propiedades). No venís a improvisar: venís a
**entender todo primero** y a trabajar **prolijo, en equipo, sin romper nada**.

Trabajás **con otros desarrolladores**. Eso significa: **siempre ramas**, nunca pushear
roto, nunca acciones irreversibles sin confirmar, y dejar todo más ordenado de como lo
encontraste.

## 2. Tu misión (en este onboarding)

1. **Recorrer y entender ABSOLUTAMENTE TODO** el proyecto: cada documento y cada archivo
   de código que importe (ver el recorrido obligatorio abajo).
2. **Verificar el estado real** contra el código (los docs pueden tener algo viejo — la
   fuente de verdad es el código + git + prod).
3. Producir una **síntesis de comprensión** (en tus palabras) que demuestre que
   entendiste la arquitectura, el modelo de plata, el multi-tenant, el auth y las reglas.
4. Cerrar con una **recomendación priorizada de "con qué seguimos"** y **preguntar** al
   owner qué querés que ataque primero. **No escribas código en este onboarding.**

## 3. Reglas innegociables (leé esto ANTES de tocar nada)

1. **NUNCA** `prisma migrate reset` contra prod. **NUNCA** una acción irreversible
   (deploy, migración de schema, borrado de datos, rotar `JWT_SECRET`) **sin confirmar
   en el chat**.
2. **No crear data de prueba en el tenant real** (Tapia Propiedades). Para probar contra
   prod, usá E2E con cleanup/restore (ver `docs/TESTING.md`).
3. **No correr los tests de `apps/api` contra una DB incierta** (pegan a una DB remota).
4. **Trabajá siempre en una rama** (`feat/…`, `fix/…`, `docs/…`). No pushees a `main`
   sin pasar el gate de verificación (`tsc` + `build`) y, si tocás un endpoint, E2E.
5. gh token **sin** workflow scope → no tocar `.github/workflows/`.
6. **Respetá las decisiones LOCKED del dueño** (ver `work-agent/05-DECISIONES.md`) — no
   las "des-arregles" creyendo que son bugs.

## 4. Recorrido obligatorio (leé en este orden, de verdad)

> Usá Read/Grep/Bash. Para los archivos **CRÍTICOS** (marcados 🔑) leé el archivo
> COMPLETO; para el resto podés escanear pero entendiendo qué hace cada cosa. Tomá
> notas mentales de: qué hace, cómo se conecta, qué reglas/decisiones encierra.

**Fase A — Contexto y mapa (el "qué/por qué")**
- 🔑 `PROJECT.MD` (documento maestro — contexto absoluto). Leelo entero.
- `README.md` (orientación, stack, tooling, cómo trabajar en equipo).

**Fase B — Handoff operativo (`work-agent/`)**
- 🔑 `work-agent/00-ESTADO.md` (dónde está el proyecto hoy).
- 🔑 `work-agent/01-ARQUITECTURA.md` (multi-tenant, money model, patrones, apiEnabled, auth, storage, cron).
- `work-agent/02-DEPLOY.md`, `03-AUDITORIAS.md`, `04-PENDIENTES.md`, `05-DECISIONES.md`, `06-ANALISIS-SENIOR.md`.
- `work-agent/PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md` (cómo se audita). `work-agent/historico/` (skim del índice — es contexto viejo, no fuente de verdad).

**Fase C — Referencias técnicas (`docs/`)**
- 🔑 `docs/DATA-MODEL.md` (ERD + comportamiento `onDelete` de las FK + multi-tenant + uniques).
- 🔑 `docs/API.md` (los 105 endpoints: auth, request, respuesta, errores, reglas).
- `docs/CONFIG.md` (env vars), `docs/RUNBOOK.md` (on-call), `docs/TESTING.md`, `docs/FRONTEND.md`, `docs/GLOSARIO.md`.
- `CONTRIBUTING.md` (convenciones + checklist de review), `SECURITY.md` (modelo de seguridad), `CHANGELOG.md` (historial).

**Fase D — Código real del backend (`apps/api/src` + `prisma`)** — recorré cada archivo:
- 🔑 `apps/api/prisma/schema.prisma` (72 modelos + 72 enums) — entendé los dominios:
  tenant/equipo, inmuebles/partes, contratos/inquilinos, **plata**, reclamos, consorcios.
- 🔑 `apps/api/src/auth/guards.ts` (los 4 guards) y `auth/pin.ts` (lockout).
- 🔑 `apps/api/src/lib/liquidaciones.ts` (devengo) y `apps/api/src/routes/plata.ts`
  (liquidaciones, pagos, rendiciones, caja) — **el corazón de la plata**.
- `apps/api/src/{index,app,env,db,cron}.ts` (bootstrap + error handler global + cron).
- `apps/api/src/routes/{auth,core,operacion,inquilino-mundo,anuncios,uploads,documentos,servicios-publicos,health}.ts`
  — leé **cada uno**, entendé qué expone y cómo scopea por tenant.
- `packages/shared/src/{permisos.ts,auth.ts}` (capacidades por rol + schemas de JWT).

**Fase E — Código real del frontend (`apps/inmobiliaria` + `apps/inquilino`)**
- 🔑 `apps/inmobiliaria/src/lib/api/client.ts` e `inquilino/src/lib/api/client.ts`
  (el patrón `apiEnabled` + `apiFetch` + `subirArchivo` + token).
- 2-3 hooks de cada app (ej. `lib/api/use-*.ts`) para ver la convención (branch demo vs
  API, `mapX`, fallback a localStorage). Mirá la estructura de pantallas (`src/app/…`).
- `packages/ui` (design system `@llave/ui`) — nivel de awareness, no a fondo.

**Fase F — Estado real (verificá, no asumas)**
```bash
git log --oneline -25            # qué se shipeó último
git status && git branch         # rama actual, working tree
curl -s https://api-production-262e.up.railway.app/health   # prod viva? {db:"up"}
```
Contrastá lo que viste en los docs con el código y el git. Si algo no coincide, **el
código y el git mandan** — anotalo.

## 5. Qué tenés que poder explicar al terminar (checklist de comprensión)

- **Multi-tenant**: por qué toda query filtra por `inmobiliariaId` y la "regla de oro".
- **Auth**: los 3 JWT (usuario/inquilino/co-inquilino), los guards, el PIN+lockout, por
  qué el email de usuario es global a nivel app.
- **Modelo de plata**: el circuito liquidación → pago (INFORMADO/CONCILIADO/RECHAZADO) →
  rendición → caja, y las **reglas LOCKED** (comisión sobre alquiler, PARCIAL≠PAGADO,
  PROPIETARIO_DIRECTO no es ingreso, gasto multi-dueño por partes, participaciones=100).
- **`apiEnabled`**: real vs demo, y las 2 clases de bug (mock en prod / éxito falso).
- **Patrones**: lock atómico (`updateMany` condicionado → 409), error handler global,
  mutaciones devuelven el objeto completo, idempotencia del cron.
- **Storage** (Volume + `/uploads` + tenant scoping) y **deploy** (Railway, `railway up`,
  push a main NO auto-deploya).

## 6. Cómo vas a trabajar (cuando arranques a codear, después de este onboarding)

- **Rama por unidad de trabajo** (`feat/…`/`fix/…`/`docs/…`). PR a `main`.
- **Commits** conventional en español (`feat(área): …` + por qué). Ver `CONTRIBUTING.md`.
- **Gate antes de deployar**: `tsc --noEmit` + `build` en los apps tocados; si tocaste
  un endpoint, **E2E mínimo contra prod con cleanup** (ver `docs/TESTING.md`).
- **Checklist de review** (multi-tenant, auth, plata, apiEnabled, validación) — `CONTRIBUTING.md`.
- **Actualizá la doc en el mismo PR** si el cambio es estructural (PROJECT.MD + `docs/`/`work-agent/`).
- **No rompés el modo demo** (`!apiEnabled` tiene que seguir andando).

## 7. Entregable de este onboarding (lo que devolvés al final)

1. **Síntesis de comprensión** (en tus palabras, ~1 pantalla): qué es el proyecto, la
   arquitectura, el modelo de plata, el multi-tenant/auth, el estado actual. Demostrá que
   entendiste citando archivos reales (no repitas los docs textual).
2. **Validación**: 2-3 cosas que verificaste contra el código/git y que confirman (o
   corrigen) lo que dicen los docs.
3. **"¿Con qué seguimos?"**: una **recomendación priorizada** (3-5 ítems) de lo próximo a
   trabajar, sacada de `work-agent/04-PENDIENTES.md` + lo que hayas detectado, con el
   **por qué** y el impacto/riesgo de cada uno. Marcá cuáles necesitan **decisión del
   owner** (billing, referidos, screening, etc.) y cuáles podés arrancar solo.
4. **La pregunta**: terminá preguntándole al owner **con cuál querés que arranque** (o si
   prefiere que corras una auditoría con `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md` primero).
   **No escribas código todavía** — esperá la decisión.

## 8. Disciplina (cómo NO trabajar)

- ❌ No asumas de los docs viejos (`work-agent/historico/`): pueden estar desactualizados.
- ❌ No empieces a codear "ya que estoy". Primero entender, después proponer, después (con OK) ejecutar.
- ❌ No toques prod ni el tenant real ni corras tests contra DB incierta.
- ✅ Sé escéptico, verificá contra el código, sé prolijo, y dejá todo trazable.

---

_Cuando termines el recorrido, entregá las 4 partes de la sección 7 y esperá la decisión
del owner. A partir de ahí, rama + plan + ejecución prolija._
