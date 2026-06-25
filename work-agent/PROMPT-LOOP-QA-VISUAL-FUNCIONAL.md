# PROMPT — Loop infinito de QA página-por-página (visual + funcional) hasta CERO errores

> **Cómo usarlo:** pegá TODO este archivo como primer mensaje en una sesión nueva de Claude Code, parado en el repo `inmobiliaria-inquilinos-app`. La sesión va a auto-iterar sola hasta que el sistema no encuentre más errores de ningún tipo, y recién ahí se detiene.

---

## 0) MISIÓN (no la pierdas de vista)

Sos el **QA principal** de "My Alquiler". Tu único objetivo es **recorrer la app página por página, encontrar y arreglar TODOS los bugs — visuales Y funcionales — y no parar hasta que una recorrida completa no encuentre absolutamente nada.**

Es un **loop infinito con condición de corte**:

```
mientras (la última pasada NO fue seca):
    para cada página del inventario (en tandas):
        auditá FUNCIONAL + auditá VISUAL
    verificá cada hallazgo de forma adversarial (refutá por default)
    arreglá los confirmados
    verificá (tsc + build + en vivo)
    commiteá la tanda
CORTE: cuando tengas 2 PASADAS COMPLETAS SECAS SEGUIDAS (0 confirmados cada una)
       → declarás el piso, escribís el informe final y TE DETENÉS.
```

No me preguntes "¿sigo?" entre iteraciones. Seguí solo. Solo frenás cuando llegás al corte (2 secas seguidas) o si encontrás algo que requiere una decisión de negocio que no podés inferir del código.

---

## 1) CONTEXTO DEL PROYECTO

- **Repo:** `soyalantapia/inmobiliaria-inquilinos-app` (monorepo pnpm/turbo). Es repo del dueño → mergear a `main` está permitido.
- **Apps:**
  - `apps/inmobiliaria` = **PANEL admin** (la inmobiliaria gestiona). Dev `:3001`. Next 14 App Router (params SÍNCRONO, no es Next 15).
  - `apps/inquilino` = **PWA del inquilino**. Dev `:3000`.
  - `apps/api` = backend Fastify + Prisma + Postgres (Railway). NO lo tocás salvo que un bug sea claramente de backend.
- **Codename interno:** `@llave/*`.
- **Real vs demo:** cada página ramifica en `apiEnabled` (= `NEXT_PUBLIC_API_URL` seteado). `apiEnabled=true` → API real (prod). `apiEnabled=false` → demo 100% sobre `localStorage` + mocks, **sin backend**, el dashboard entra sin login.
- **Money model (CRÍTICO para juzgar bugs de plata):**
  - Comisión y rendición de la inmobiliaria son **SOLO sobre el alquiler**, NUNCA sobre expensas ni punitorios (esos los cobra/paga el consorcio).
  - Un pago **PARCIAL nunca** marca la liquidación como PAGADO.
  - Los montos en pantalla **nunca** son negativos.
  - Las participaciones de co-propietarios **suman 100%**.
  - Modo **PROPIETARIO_DIRECTO**: el alquiler va directo del inquilino al dueño → **no es ingreso de la inmo**, no se cuenta en cobrado/porCobrar/mora ni se rinde.
  - Moneda: contratos pueden ser ARS o USD → `formatMonto(x, moneda)` debe respetar la moneda (default ARS).

---

## 2) SETUP DE SEGURIDAD DEMO (HACELO ANTES DE TOCAR NADA — es bloqueante)

El panel es ADMIN: tocar el modo prod podría crear contratos / validar pagos REALES. Por eso **toda la auditoría corre en DEMO forzado**:

```bash
# Forzar demo en ambas apps (NEXT_PUBLIC_API_URL vacío → apiEnabled=false):
printf 'NEXT_PUBLIC_API_URL=\n' > apps/inmobiliaria/.env.development.local
printf 'NEXT_PUBLIC_API_URL=\n' > apps/inquilino/.env.development.local
```

- Estos archivos están **gitignored** (no se commitean). Dejalos puestos mientras auditás.
- Verificá que el preview solo pega a `localhost` (network log) antes de interactuar con el panel.
- **Al terminar la campaña, recordale al dueño borrarlos** antes de dev contra el API real.

Servers de preview (tool `preview_*`): nombres **`llave-inmobiliaria`** (:3001) y **`llave-inquilino`** (:3000) — NO "inmobiliaria"/"inquilino".

---

## 3) INVENTARIO DE PÁGINAS (cubrí TODAS)

**PANEL (apps/inmobiliaria) — 24 rutas:**
`/login` · `/registro` · `/precios` · `/` (dashboard) · `/pagos` · `/propiedades` · `/propiedades/[id]` · `/propiedades/nueva` · `/propietarios` · `/propietarios/[id]` · `/contratos` · `/contratos/[id]` · `/contratos/nuevo` · `/reclamos` · `/reclamos/[id]` · `/renovaciones` · `/screening` · `/caja` · `/consorcios` · `/consorcios/[id]` · `/aprobaciones` · `/anuncios` · `/configuracion` (con tabs: empresa/cobranza/sociedades/equipo/pin/mercado/convenios/notificaciones/plan/auditoria) · `/profesionales` · `/admin/objetivos`

**INQUILINO (apps/inquilino) — 27 rutas:**
`/login` · `/` (home) · `/contrato` · `/contrato/renovacion` · `/pagos` · `/pago/[liqId]` · `/pago/[liqId]/checkout` · `/comprobantes` · `/reclamos` · `/reclamos/[id]` · `/reclamos/nuevo` · `/reclamos/r` · `/servicios` · `/servicios/subir` · `/profesionales` · `/certificado` · `/garantes` · `/co-inquilinos` · `/co-inquilinos/invitar` · `/cuenta` · `/cuenta/editar` · `/documentos` · `/calendario` · `/ayuda` · `/broker` · rutas públicas por token: `/garantes/[token]` · `/invitacion/[token]` · `/p/[token]` · `/verificar/[hash]`

Llevá una **matriz de cobertura**: por cada página, en qué pasada la auditaste (funcional y visual) y qué encontraste. Una pasada NO está completa hasta tocar todas.

---

## 4) EL CICLO DE CADA ITERACIÓN

Por cada pasada (tanda de páginas), hacés las DOS auditorías sobre cada página:

### 4.A — AUDITORÍA FUNCIONAL (vía workflow multi-agente)
Lanzá un **Workflow** (`pipeline` de finders → verificación adversarial), 1 lente por grupo de páginas o por dimensión, modelo **sonnet**, finders que devuelven `findings` con `file:line`, y por cada finding un verificador adversarial que **REFUTA por default**. Dimensiones funcionales a rotar pasada a pasada (usá lentes FRESCAS cada vez — las que no auditaste hace rato pegan en vetas vírgenes):
- crash / null-deref (`.map`/`.toLocaleString` sobre relación faltante → `?? []`)
- dinero (comisión/rendición solo-alquiler, parciales, negativos, redondeos, totales que no suman, doble-conteo, USD vs ARS, PROPIETARIO_DIRECTO)
- fechas / TZ (`new Date('YYYY-MM-DD')` y `toISOString().slice(0,10)` son UTC → usar `parseLocal`/`fechaHoyLocal` de `lib/format.ts`)
- máquinas de estado (transición ilegal, estado terminal revivible, contador que no matchea el estado, carreras doble-click)
- validación de formularios (campos sin validar, edge inputs 0/negativo/strings largos/email malo, guard de submit, doble-submit)
- consistencia cross-pantalla (el mismo número en dashboard vs /pagos vs detalle vs caja debe coincidir)
- data-shape / mappers (toda mutación que el cliente mapea debe devolver el objeto COMPLETO con relaciones)
- prod-path (código no-gateado por `apiEnabled` que asume datos de mock)
- cross-app inmo↔inquilino (storage compartido: un lado escribe una forma/campo que el otro no lee/valida; links generados con dominio/basePath correcto en dev/GH-Pages/Railway)
- PDF/documentos (contrato Word/PDF: nombres del LOCADOR reales, totales que sumen, fechas, escape HTML)
- empty-states (cero datos → división por cero/NaN/$NaN, `.reduce` sin valor inicial, `[0]` sin guard)

### 4.B — AUDITORÍA VISUAL (en vivo, con preview tools — los workflows NO ven píxeles)
Por cada página, con el server de preview corriendo:
1. **Overflow horizontal a 375px (mobile):** `preview_resize` a 375×812, navegá a la página, y corré este detector del culpable REAL (excluyendo lo clipeado por un ancestro `overflow-hidden`, que es falso positivo):
   ```js
   (() => { const vw=document.documentElement.clientWidth, docSW=document.documentElement.scrollWidth;
     function clipped(el){let p=el.parentElement;while(p){if(/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX))return true;p=p.parentElement;}return false;}
     const hits=[]; for(const el of document.querySelectorAll('body *')){const r=el.getBoundingClientRect(); if(r.right>vw+0.5&&r.width>0&&r.left<vw&&r.left>=-1&&!clipped(el)) hits.push({tag:el.tagName.toLowerCase(),cls:(el.className||'').toString().slice(0,70),right:Math.round(r.right),txt:(el.textContent||'').trim().slice(0,30)});}
     hits.sort((a,b)=>b.right-a.right); return {path:location.pathname,vw,docSW,overflow:docSW>vw,culpritsReales:hits.slice(0,6)}; })()
   ```
2. **Layout roto / solapamientos / texto cortado:** `preview_screenshot` a 375px y a ~1280px (desktop). Mirá: tablas que desbordan sin `overflow-x`, grids con anchos fijos, diálogos más anchos que el viewport, botones de acción fuera de alcance, texto truncado mal, contraste, dark mode (`preview_resize` no cambia tema; togglealo si la app lo soporta).
3. **Estructura / contenido:** `preview_snapshot` (texto, barato) para confirmar que la página renderiza lo que debe y no muestra `NaN`/`undefined`/`$NaN`/empty raro.
4. **Interacciones:** `preview_click`/`preview_fill` para abrir diálogos, tabs, flujos; después `preview_snapshot` para confirmar. (Tabs de Radix: `.click()` sintético a veces NO cambia el tab → dispará la secuencia `pointerdown,mousedown,pointerup,mouseup,click` con `dispatchEvent`, o usá `preview_click` con el id `#radix-...-trigger-<x>`.)
5. **Consola:** `preview_console_logs level=error` — cero errores de consola en cada página.

---

## 5) VERIFICAR → ARREGLAR → VERIFICAR → COMMIT

1. **Verificación adversarial de cada hallazgo** (la hace el workflow): refutá por default; un finding es real solo si hay prueba en código de que reproduce en demo (o defecto lógico claro de prod sin especular datos de backend). Tasa sana de rechazo ~40-60%.
2. **Arreglá** los confirmados. Código que lee como el de alrededor (mismo estilo, mismos helpers: `parseLocal`/`formatMonto`/`Math.max(0,...)`/`?? []`).
3. **Verificá:**
   - `cd apps/<app> && npx tsc --noEmit` (exit 0).
   - `npx next build` (Railway). Si auditás el export estático: `mv src/middleware.ts src/middleware.ts.bak && STATIC_EXPORT=1 npx next build; mv ...bak back` (el middleware importa `@clerk/nextjs/server` que rompe el export; `build-static.sh` ya lo renombra). **El export estático baja `next/font` (Inter) de Google → corré el build con red habilitada (`dangerouslyDisableSandbox`) o falla por red, NO por código.**
   - **En vivo** los demo-reproducibles (no pidas verificación manual al dueño — verificá vos con preview_eval/snapshot/screenshot y mostrá la prueba).
4. **Commit** por tanda, mensaje descriptivo (qué bug, qué fix, qué severidad). Pushear a la rama de trabajo. **Mergear a `main` y deployar** solo cuando el dueño lo pida (o si ya lo autorizó en la sesión).

---

## 6) CONDICIÓN DE CORTE (cuándo te detenés)

- Una **pasada seca** = recorriste TODAS las páginas pendientes de esa pasada (funcional + visual) y los confirmados = **0**.
- **Te detenés cuando tengas 2 pasadas secas SEGUIDAS** (el "piso práctico"). Software nunca tiene literal 0 bugs; 2 secas seguidas con lentes frescas + barrido visual completo es exhaustivo.
- Señales de que estás cerca del piso: la severidad cae a P3 sostenido, los hallazgos son edge cases prod-only o "incomplete-fixes" de tus propios fixes, las lentes frescas vuelven vacías.
- **Al cortar:** escribí un informe final (`work-agent/INFORME-QA-FINAL-<fecha>.md`) con: páginas cubiertas, total de fixes por severidad, qué quedó como diferido deliberado, y el estado de cada rama/deploy. Recordá borrar los `.env.development.local`. **Y AHÍ TERMINÁS** (no lances otra pasada).

---

## 7) REGLAS DURAS (qué ES y qué NO es un bug)

**ES bug (reportable):** defecto trazable a `file:line`, reproducible en demo (o defecto lógico claro de prod sin especular datos de backend), que un usuario común viviría — crash, plata mal, estado inconsistente, validación faltante, dato cruzado, link roto, overflow/layout roto, texto cortado, `NaN`/`$NaN` en pantalla, contraste ilegible.

**NO es bug (descartar):** nitpick / preferencia de redacción · feature "Próximamente" intencional · dead code (sin callers) · "en demo no persiste" (es esperado) · inconsistencia de MOCK sin defecto de código · algo que requiere corromper `localStorage` a mano (salvo lente explícita de resiliencia) · estado-error que solo aplica con backend prod caído · comentario stale · cosa que solo se reproduce vía llamada directa a la API saltando la UI.

---

## 8) NO RE-REPORTAR (ya arreglado / diferido por decisión)

Antes de empezar, leé `work-agent/` y los commits recientes de la rama para no re-encontrar lo ya arreglado. **Diferidos conocidos (NO reportar):**
- (a) KPIs financieros de `/pagos` quedan stale tras conciliar en demo (`useContratos` devuelve `contratosMock` congelado) — cambio de core-hook delicado.
- (b) Comisión sobre el total (incl. expensas) en `generarRendiciones`/`rendir-propietario` — arquitectónico (el mock está hand-authored consistente).
- (c) `posicionPorPropietario` en `cierre-caja.ts` es dead code (sin callers).
- (d) Contratos USD no son reproducibles en demo (el único, `cnt_006`, es BORRADOR y `filasMock` filtra ACTIVO) → los bugs de display USD son defectos lógicos de prod, válidos pero no demo-verificables.

---

## 9) TÉCNICAS / GOTCHAS APRENDIDOS (te ahorran horas)

- **Workflows = análisis estático (leen código).** Para lo VISUAL necesitás SÍ o SÍ las preview tools (píxeles renderizados). Corré las dos auditorías; no son intercambiables.
- **Sonnet + tandas chicas** para los workflows: opus rate-limitea con muchos finders simultáneos leyendo archivos grandes, y a veces el filtro de ciberseguridad bloquea la síntesis de listas de vulns. Síntesis en sonnet.
- **Falso positivo de overflow:** un elemento con `getBoundingClientRect().right > viewport` que está dentro de un ancestro `overflow-hidden` NO genera scroll (está clipeado). Usá el detector de la sección 4.B que excluye clipeados.
- **RSC payload falso positivo:** `document.body.textContent` incluye el flight data de `<script>` con `$undefined` → para chequear contenido visible usá `document.querySelector('main')?.innerText`.
- **`preview_eval` que navega** (`location.href=...`) tira "Inspected target navigated" — es esperado; navegá en un eval y leé en el SIGUIENTE. Esperá ~5-9s el primer compile de cada ruta en dev.
- **Preview headless: `document.hasFocus()===false`** → los fixes de manejo de foco (a11y) NO se validan en vivo; verificalos por código + build.
- **Patrón regresión:** después de varios fixes rápidos en varias superficies, corré UNA pasada de SOLO regresión (¿un guard/fix aplicado a N pantallas y olvidado en la N+1?). El patrón PROPIETARIO_DIRECTO, por ejemplo, hubo que aplicarlo en 5 lugares distintos.
- **Cada mutación demo que confía en `invalidateQueries`** de react-query NO re-renderiza si la query está `enabled:apiEnabled=false` → forzá re-render (`const [,r]=useState(0); r(n=>n+1)`) o leé sync de localStorage.
- **Build con red:** el static export baja Inter de fonts.googleapis.com; corré los builds con `dangerouslyDisableSandbox` para que no falle por red.

---

### Arranque (primer paso, ya)
1. Setup demo (sección 2).
2. Leé `work-agent/` + `git log --oneline -30` para el contexto de lo ya hecho.
3. Armá la matriz de cobertura con el inventario de la sección 3.
4. Empezá la pasada 1: primera tanda de páginas → funcional (workflow) + visual (preview) → verificar → arreglar → verificar → commit.
5. Seguí iterando solo hasta 2 pasadas secas seguidas. Ahí informe final + STOP.
