# PROMPT — Auditoría final pre-producción · My Alquiler

> **Objetivo:** revisar **absolutamente todo** el proyecto y ejercitar **todos los flujos** para detectar **cualquier** problema antes de lanzar a producción: mock que se cuela, bugs de funcionalidad, problemas visuales/colores/diseño, estados rotos, fugas de datos, errores de seguridad. Salida = un informe accionable + un veredicto **GO / NO-GO** con checklist.
>
> Pegá este prompt completo en una sesión limpia. Es autocontenido.

---

## 0. Contexto del proyecto (leé esto antes de tocar nada)

**My Alquiler** — SaaS para inmobiliarias + sus inquilinos. Monorepo pnpm/turbo `@llave/*`.
- **Ruta real:** `~/dev/inmobiliaria-inquilinos-app` (NO `~/Desktop` — iCloud rompe esbuild). Symlink en Desktop.
- **3 deployables (Railway, proyecto `b01a1ecb`):**
  - `apps/api` — Fastify + Prisma + Postgres. Service `myalquiler-back` → `https://api-production-262e.up.railway.app`. DB service `Postgres-_cRj`.
  - `apps/inmobiliaria` — **panel admin**, Next 14. Service `myalquiler-front` → `https://myalquiler-front-production.up.railway.app`. Dev port **3001**.
  - `apps/inquilino` — **PWA inquilino**, Next 14. Service `myalquiler-inquilino` → `https://myalquiler-inquilino-production.up.railway.app`. Dev port **3000**.
- **Packages compartidos:** `@llave/ui`, `@llave/shared`, `@llave/config` (en `packages/`).

### El patrón arquitectónico CLAVE — entenderlo es el 80% de la auditoría
Cada front corre en **dos modos**:
- **PRODUCCIÓN** (`apiEnabled = true`, viene de `NEXT_PUBLIC_API_URL` seteado, de `@/lib/api/client`): los datos vienen del **API real**.
- **DEMO** (build `STATIC_EXPORT=1` → GitHub Pages, `apiEnabled = false`): mock/localStorage. La demo NO debe romperse.

Casi todas las pantallas ramifican: `if (apiEnabled) <ramaReal/> else <ramaDemo/>`, o un hook que devuelve API si `apiEnabled` y mock si no. **El trabajo de esta auditoría es encontrar cualquier cosa que en `apiEnabled=true` muestre mock, mande mock al API, o se rompa.**

### Credenciales / acceso para testear
- **Admin panel:** `alannaimtapia@gmail.com` (password en Railway / gestor de claves — NO está en el repo).
- **Inquilino:** login por OTP (Resend). Para testear sin OTP, **mintear un JWT** con `JWT_SECRET` (de `railway variables --service myalquiler-back`): payload `{ kind:'inquilino', inquilinoId, inmobiliariaId, contratoId, iat, exp }`, HMAC-SHA256. Los ids salen de la DB (`prisma.inquilino.findFirst({where:{email:'myalquiler@xnod.tech'}})`).
- **Tenant de prueba:** inmobiliaria *Tapia Propiedades*, inquilino *Martín Gómez* (`myalquiler@xnod.tech`), propietario *Alan Tapia*, contrato *Av. Santa Fe 4922, 5°A*. **Es un tenant de prueba** → se le puede escribir, pero **limpiá lo que crees** (cleanup vía Prisma) para dejarlo prístino.
- DB: `DATABASE_PUBLIC_URL` de `railway variables --service Postgres-_cRj`. Prisma client en `apps/api/node_modules`. bcrypt = `bcryptjs`.

---

## 1. El RUBRO anti-falsos-positivos (aplicalo en TODA la auditoría)

Una **FUGA / problema de producción** = algo que afecta al usuario con `apiEnabled=true`. **SÍ cuenta:**
- Un valor hardcodeado/mock que **se renderiza** en la rama real.
- Un campo mock/hardcodeado/id-mock que se **manda al API** en una mutación.
- Un cálculo **fabricado** que se muestra como dato real (montos, scoring, historiales, fechas).
- Una pantalla que **se rompe / 404 / queda en blanco** en el path real.

**NO cuenta (no lo reportes, o marcalo NO_LEAK con razón):**
- Comentarios, nombres de variables, queryKeys, `console.log`.
- Placeholders de inputs (`placeholder="..."`).
- Imports de mock **solo para tipos** (`import type {...}`), o para `generateStaticParams`.
- Código detrás de `if (apiEnabled) return <Proximamente/>`, `{!apiEnabled && ...}`, ramas `!deApi` / `HomeDemo` / `RecibosDemo` / `ContratoDemo`.
- Params hardcodeados pasados a funciones de **store local** que solo corren en demo (ej. `conciliarPago(id,'Roberto Tapia')` — en prod la mutación va al API con el usuario del JWT).

**Las fugas peligrosas son las SUTILES** (no las agarra un grep ingenuo):
1. **Flags que se auto-siembran** con default `true`/un valor (ej. "Cliente piloto", badge de convenio) → aparecen para todos en prod.
2. **Cálculos con constantes hardcodeadas** en vez del dato del API (ej. tasa punitoria/comisión hardcodeada → montos incorrectos mostrados/cobrados; el monto debe salir de la liquidación del server).
3. **Fallbacks de error** que muestran seeds con datos sensibles falsos (ej. un CBU inventado en un anuncio → riesgo phishing). En prod, `q.isError` debe dar vacío, NUNCA seeds.
4. **Mutaciones que mandan ids/campos mock al API** (ej. un `<select>` poblado de `propiedadesMock` → POSTea un `propiedadId` que no existe → FK rota / dato huérfano).
5. **Datos fabricados** (emails inventados con `emailDeNombre`, scoring determinístico, rendiciones/calendarios falsos) mostrados como reales.
6. **Routing:** `dynamicParams = false` + `generateStaticParams` sobre ids mock → en el build server (prod) un **id real da 404**. Debe ser condicional (`process.env.STATIC_EXPORT !== '1'`).
7. **Lecturas cross-app** de localStorage de la otra app sin gatear.

**Verificá cada hallazgo adversarialmente** antes de reportarlo (¿realmente renderiza/se manda en `apiEnabled=true`?). Preferí pocos hallazgos confirmados a muchos dudosos.

---

## 2. Inventario COMPLETO de flujos a ejercitar

Recorré **cada pantalla** de ambas apps logueado, con datos reales del API. Por cada una: ¿muestra dato real o "Disponible pronto"? ¿algún mock? ¿los botones/forms funcionan? ¿estados de carga/vacío/error? ¿se ve bien (layout, colores, responsive, dark)?

### PANEL (admin)
`login → Inicio/Dashboard` · `Propiedades` (lista · detalle `[id]` · alta) · `Propietarios` (lista · detalle `[id]` · **rendir**) · `Contratos` (lista · detalle `[id]` · alta) · `Pagos` (cobrar · **validar/rechazar comprobantes** con PIN · conciliar por resumen) · `Caja` (cargar gasto) · `Reclamos` (lista · detalle `[id]` · **asignar/resolver/rechazar/responder**) · `Profesionales` (lista · asignar) · `Renovaciones` · `Consorcios` (lista · detalle `[id]`) · `Anuncios` (**crear**, ver acuses) · `Aprobaciones` (aprobar/rechazar con PIN) · `Screening` · `Configuración` · `Admin/Objetivos` · chrome (sidebar, topbar, badges, avatar, logout).

### INQUILINO (PWA)
`login (OTP)` · `Inicio` (banner de pago, atajos, anuncios) · `Pagos/Comprobantes` (recibos) · `Contrato` (timeline, ajustes, depósito) · `Reclamos` (lista · **crear** · detalle `[id]`) · `Servicios/Boletas` (ver · **subir boleta**) · `Co-inquilinos` (ver · **invitar** · permisos · borrar) · `Certificado` (+ imprimible) · `Pago/Checkout` `[liqId]` (**informar pago**, datos de transferencia) · `Asistente/Broker` · `Documentos` · `Garantes` · `Cuenta` (+ editar) · `Ayuda` · `Calendario` · chrome (nav-bar, greeting, user-menu, WhatsApp FAB, campana, install prompt) · **páginas públicas:** `verificar/[hash]`, `p/[token]`, `garantes/[token]`.

---

## 3. Dimensiones a auditar (en cada pantalla y a nivel global)

1. **Mock / integridad de datos** (rubro §1): cero mock renderizado o enviado en prod; montos correctos (del server); nada fabricado mostrado como real.
2. **Funcionalidad end-to-end:** cada acción/form/botón funciona contra el API real y **persiste** (verificá con un GET posterior). **Las mutaciones son el mayor riesgo** — para cada `apiFetch` POST/PATCH/PUT/DELETE, **comparar el body que manda el front contra el schema zod del handler** (`apps/api/src/routes/*.ts`). Ejercitar el ciclo cruzado (inquilino crea → admin ve → admin resuelve). Las acciones con PIN: 403 con PIN incorrecto, 200/201 con el correcto. **Limpiar lo creado.**
3. **Visual / diseño:** consistencia de marca y colores (inquilino = violeta), tipografía, espaciado, jerarquía, alineación, overflow/truncado, *AI-slop* (gradientes genéricos, emojis de relleno, copy robótico), micro-interacciones. **Responsive** (mobile ~380px y desktop) y **dark mode** en cada pantalla. Que no haya layouts rotos, textos cortados, ni elementos pisados.
4. **Estados:** **loading** (skeletons, no spinners colgados), **empty** (mensaje real "todavía no hay X", no ejemplos mock), **error** (API caída → mensaje claro, nunca caer a mock ni pantalla en blanco). Probar los tres en pantallas clave.
5. **Routing:** ids reales cargan (no 404 — revisar `dynamicParams`), deep-links, navegación, back, 404 page.
6. **Seguridad:** aislamiento por tenant (un token no ve datos de otra inmobiliaria), PIN en acciones de plata, sin PII de demo en páginas públicas, **ningún dato bancario falso** (CBU/CUIT) que un usuario podría usar para transferir.
7. **PWA / performance:** service worker, install prompt, offline básico; tamaño de bundle, tiempo de carga, sin errores de consola/red en prod.
8. **Build / deploy:** `pnpm --filter <app> build` pasa en ambos fronts (lint + SSG); typecheck `tsc --noEmit` limpio en api + ambos fronts; el build demo (`STATIC_EXPORT=1`) sigue funcionando.

---

## 4. Metodología de verificación (cómo hacerlo bien)

- **Auditoría estática (inversa por fuente):** listá cada `*-mock`, `*-storage`, `mock-data`, `*-cross-app`, `cupones`, `piloto-storage` de cada app; grepeá sus consumidores; por cada uno decidí si renderiza/manda en el path `apiEnabled` sin gatear. Más barrido de literales: emails, `tel:`/`mailto:`/`wa.me`, CUIT/CBU/alias, montos/%/fechas/años hardcodeados en JSX, nombres de persona. Revisá también `packages/`, `layout.tsx`, `error.tsx`, `not-found.tsx`.
- **Walkthrough en navegador contra el API real:** levantá el dev server con `NEXT_PUBLIC_API_URL` apuntando a prod (o usá los deploys). **CUIDADO:** en `localhost:3000/3001` puede haber **service workers de OTROS proyectos** cacheados (romi-alan, etc.) y **conflictos de puerto** — limpiá SW + caches (`navigator.serviceWorker.getRegistrations().unregister()` + `caches.delete`) y verificá el `document.title` antes de auditar. Para el inquilino, **inyectá el token minteado en `localStorage`** para saltar el OTP. Sacá screenshots: los problemas visuales (footers, chrome) no los agarra un grep.
- **Test E2E de mutaciones:** replicá los requests exactos del front (mismo endpoint + body) con los tokens reales; confirmá persistencia con GET; **no asumas el status code** (la API devuelve 201 además de 200 — chequeá persistencia, no el número). Cleanup vía Prisma (delete de lo creado, revertir liquidación, restaurar PIN). Manejá cascadas (rendición → `GastoRendido` + `MovimientoCaja.rendicionId`; reclamo → `ReclamoEvento`/`ConfirmacionReclamo`/`RatingReclamo`).
- **Bundle grep en prod:** descargá los chunks deployados y grepeá tokens demo (Roberto, Mariela, Gorriti, "Inmobiliaria del Sol", 541145…, 30-71234567-9, inmosol). Distinguí lo que solo *se shippea* (fallback demo) de lo que se *renderiza*.
- **Multi-agente:** si usás workflows, fan-out por slice (panel-componentes, panel-páginas, inquilino-componentes, inquilino-páginas, api-mutaciones, visual/responsive) con el rubro §1; cuidado con rate limits (throttle si lanzás muchos a la vez); **verificá adversarialmente** cada hallazgo.

---

## 5. Salida esperada

Un informe `INFORME-AUDITORIA-FINAL.md` con:

1. **Resumen ejecutivo** + veredicto **GO / NO-GO**.
2. **Hallazgos por severidad**, cada uno con `archivo:línea`, **evidencia** (qué se ve/manda en prod y por qué), **fuente de dato real esperada**, y **fix recomendado**:
   - 🔴 **BLOQUEANTE** — no lanzar (dato financiero incorrecto/falso, FK rota, 404 de flujo, PII expuesta, mutación que no persiste, build roto).
   - 🟠 **ALTA** — arreglar antes de usuarios reales.
   - 🟡 **MEDIA** — arreglar pronto.
   - ⚪ **BAJA** — pulido.
3. **Tabla de cobertura:** cada pantalla del §2 × (mock ✓/✗ · funcional ✓/✗ · visual ✓/✗ · estados ✓/✗).
4. **Matriz de mutaciones:** cada write × (body front = schema API ✓/✗ · persiste ✓/✗ · PIN/permiso ✓/✗ · limpiada ✓/✗).
5. **Checklist de lanzamiento:** typecheck, builds, deploys, wipe de datos de prueba, OTP/Resend operativo, dominios/CORS, variables de entorno, aislamiento por tenant.
6. **Falsos positivos descartados** (transparencia: qué parecía fuga y por qué no lo es).

**No reportar sin verificar. No declarar GO si hay algún 🔴. Si algo no se pudo probar, decilo explícitamente (no lo des por bueno).**
