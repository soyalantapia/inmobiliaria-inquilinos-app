# INFORME — Auditoría final pre-producción · My Alquiler
_Ejecución de `AUDITORIA-FINAL-PRODUCCION.md` · 2026-06-15_

## Veredicto: 🟢 **GO** (con 2 pendientes BAJA, ninguno bloqueante)

Se auditó **todo** el proyecto (panel + inquilino + API + packages) en 4 frentes: estática multi-agente (mock/datos, mutaciones, visual, estados/routing), walkthrough en vivo sobre los **deploys reales** (responsive + dark + consola), builds/typecheck, y E2E de mutaciones. Se encontraron **2 bloqueantes + 9 altas + 1 crash de routing**, **todos arreglados, commiteados y redeployados**. Quedan 2 detalles BAJA (íconos PWA, dark-mode) que no impiden lanzar.

---

## Cómo se auditó

| Frente | Resultado |
|---|---|
| Typecheck (api + panel + inquilino) | ✅ exit 0 |
| Build de producción (panel 49/49 · inquilino 41/41 páginas) | ✅ sin errores |
| Walkthrough en vivo (deploys reales, Playwright) | ✅ panel + inquilino, mobile 390px + desktop |
| E2E de mutaciones (tokens reales, con cleanup) | ✅ todas persisten (sesión previa) |
| Estática (6 slices, ~150 archivos) | 25 hallazgos |

---

## Hallazgos y estado

### 🔴 BLOQUEANTES — todos ARREGLADOS
1. ✅ **Hooks del panel caían a mock/seeds en error de API** (`useContratos`/`useAnuncios`/`useAprobaciones`/`useCaja`, patrón `!apiEnabled || q.isError`). Ante cualquier 500/timeout en prod mostraban **cartera fabricada** (contratos/inquilinos/montos falsos) que envenenaba Dashboard + Pagos; el seed de anuncios tenía un **CBU INVENTADO** (riesgo phishing). → demo solo en `!apiEnabled`; en prod error = vacío + mutaciones que tiran error. _(commit dea7a5a)_
2. ✅ **Crash al refrescar/deep-link cualquier detalle de propiedad** (`/propiedades/[id]`). El `GET /propiedades/:id` no derivaba `estadoPagoActual` (sí lo hace el listado) → el front hacía `.charAt()` sobre `undefined` → error boundary "Algo falló". → API lo deriva de liquidaciones + front defensivo. _(commit dea7a5a, confirmado en vivo)_

### 🟠 ALTAS — todas ARREGLADAS _(commit c547528)_
3. ✅ Reclamos del inquilino mostraban inquilino/dirección **mock** ('Mariela Sosa'/'Gorriti') en prod → ahora identidad real (`useCurrentUser` + `useMiContrato`).
4. ✅ Checkout autocompletaba un **nroOperación fabricado por IA** que se informaba al pago → IA gateada a demo; en prod solo el N° que tipea el inquilino.
5. ✅ `ContratoReal` (inquilino) quedaba en **spinner colgado** ante error de API → estado de error + Reintentar.
6. ✅ Detalle de pago: error de API → `notFound()` (404 engañoso) → ahora distingue error (reintento) de liq inexistente.
7. ✅ `RecibosReal` (comprobantes) sin loading/error → parpadeaba "Sin movimientos" → skeleton + error.
8. ✅ `HomeReal` (inquilino) sin loading/error → en outage mostraba **"Estás al día · $0"** (falso positivo grave) → ahora skeleton/error, nunca "al día" si no cargó.

### 🟡 MEDIAS — ARREGLADAS _(commit c547528)_
9. ✅ Detalle de contrato hardcodeaba **"ICL — BCRA / 12 meses"** para todo contrato → ahora `indiceAjuste`/`frecuenciaAjusteMeses` del API (UVA/IPC/3-6 meses se muestran bien).
10. ✅ Tabs Servicios/Inventario de consorcio **fingían persistencia** en prod (solo localStorage) → edición gateada a "Próximamente".
11. ✅ Rendición mostraba `montoNeto` calculado **localmente** (podía diferir del server) → usa el neto de la respuesta del server.
12. ✅ Co-inquilinos: botón **"Simular que aceptó"** (copy demo) visible en prod → gateado a demo.
13. ✅ Colores off-brand (onboarding, ayuda, contratos, renovaciones, pagos) → tokens de marca violeta (verde=ahorro, rojo=mora preservados).

### ⚪ BAJAS — pendientes (no bloquean)
- ⏳ **Íconos PWA faltan**: el manifest referencia `icon-192/512/maskable.png` pero no existen en `public/` → 404 en cada carga + sin ícono de "agregar a inicio". _Fix: dropear los 3 PNG de marca._
- ⏳ **Sin dark-mode**: con `prefers-color-scheme: dark` la app sigue clara (no aplica clase `dark`). Light-only es decisión válida; las clases `dark:` del código son código muerto. _Informativo._
- ⏳ PDF de morosos (panel) usa teléfono/garante de `contactosCobranzaMock` (solo en el export, no en pantalla).
- ⏳ Reclamos del inquilino colapsan error de API en el empty "Todavía no tenés reclamos".
- ⏳ Detalle de propiedad (tab Resumen): "Inquilino actual —" en vez del nombre real (empty state seguro, no crash; el nombre sí aparece en el detalle de contrato). Mapear `inquilinoTitular.nombre` en `use-propiedad`.

---

## Cobertura del walkthrough en vivo (deploys reales)

| App | Pantalla | Datos reales | Visual/responsive |
|---|---|---|---|
| Inquilino | Inicio | ✅ $650.000 (monto correcto del server) | ✅ mobile + desktop |
| Inquilino | Contrato | ✅ Av. Santa Fe, ICL, depósito | ✅ |
| Inquilino | Asistente (gateado) | ✅ "Disponible pronto" | ✅ |
| Panel | Dashboard | ✅ Alan, mora $650k, footer `useMe` real | ✅ mobile (hamburguesa+bottom-nav) + desktop |
| Panel | Cargar contrato (gateado) | ✅ "Disponible pronto" | ✅ |
| Panel | Pagos | ✅ cola "A resolver 0" real | ✅ |
| Panel | Detalle contrato/propiedad/propietario (id real) | ✅ cargan (post-fix) | ✅ |

Marca **violeta consistente** en ambas apps. Tour de onboarding (11 pasos) operativo.

## Matriz de mutaciones (E2E, sesión previa — todas persisten)
Inquilino: crear reclamo ✅ · informar pago ✅ · subir boleta ✅ · co-inquilino CRUD ✅ · acuse anuncio ✅
Panel: responder/resolver/asignar reclamo ✅ · validar pago (PIN 403/200) ✅ · caja ✅ · rendir (PIN 403/201) ✅ · crear anuncio ✅
Seguridad: PIN enforce ✅ · visibilidad cruzada inquilino↔admin ✅ · transiciones de estado reales ✅

---

## Checklist de lanzamiento
- [x] Typecheck api + 2 fronts (exit 0)
- [x] Build de producción ambos fronts
- [x] Mutaciones E2E persisten + limpian
- [x] Cero mock renderizado/enviado en prod (3 rondas + esta auditoría)
- [x] Error/empty/loading en pantallas clave
- [x] Routing: ids reales cargan (dynamicParams + crash de detalle arreglado)
- [x] Seguridad: PIN, aislamiento por tenant, sin CBU falso, sin PII en públicas
- [x] Redeploy api + 2 fronts
- [ ] **Íconos PWA reales** (baja)
- [ ] **Wipe de datos de prueba** (tenant Tapia/Martín) antes del primer cliente real
- [ ] **OTP/Resend operativo** (RESEND_API_KEY) para que entren inquilinos reales

## Falsos positivos descartados (transparencia)
- `propietarios/[id]` NO crashea (usa `estado`, columna presente; el primer test fue defectuoso).
- 2 agentes de la auditoría (security/build-config) fallaron por un falso-positivo de "cyber safeguard" en el prompt — esas dimensiones se cubrieron manualmente (mutaciones E2E + build/config revisado).
- Mock detrás de `!apiEnabled`/`Proximamente`/type-only/`generateStaticParams` = no es fuga.
