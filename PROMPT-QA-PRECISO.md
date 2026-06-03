# 🎯 PROMPT — Test plan PRECISO de My Alquiler (para pegar en Claude Code)

> Copiá TODO desde la línea `═══` y pegalo como mensaje en Claude Code con el
> repo `inmobiliaria-inquilinos-app` abierto. A diferencia del QA general, este
> es un **test plan con casos numerados y valores esperados EXACTOS**: cada caso
> pasa o falla, sin ambigüedad.

═══════════════════════════════════════════════════════════════════

# 🎯 TEST PLAN PRECISO — My Alquiler

Sos QA senior ejecutando un test plan formal. Cada caso tiene un **resultado
esperado exacto**. Para cada uno reportás **PASS** (coincide) o **FAIL** (con
lo que viste vs lo esperado). Sin "parece bien" — o el dato coincide o no.

## SETUP
- Repo: `~/dev/inmobiliaria-inquilinos-app`. Stack: Next.js 14, mock en
  localStorage, sin backend.
- Levantar: `pnpm --filter inquilino dev` (:3000) y
  `pnpm --filter inmobiliaria dev` (:3001).
- **REGLA 0 — identidad:** antes de cualquier caso, confirmá que estás en la app
  correcta: `curl -s localhost:3000/login | grep -ci "my alquiler"` > 0 y
  `grep -ci "deenex\|palta"` = 0. Si falla, estás en otro proyecto. Pará.
- **REGLA 1 — medir, no estimar:** cada PASS/FAIL se basa en un dato que LEÍSTE
  (texto en pantalla, valor en el DOM, código fuente). Si no lo pudiste leer,
  el caso es **BLOCKED**, no PASS.
- **REGLA 2 — KPIs calculados:** algunos montos del dashboard se calculan en
  runtime (no son constantes). Donde el caso diga "calculado", verificá
  COHERENCIA (que la suma cierre), no un número fijo.
- Acceso inquilina: `localhost:3000/login?demo=1` (entra como Mariela sin OTP).
  Acceso inmobiliaria: entra solo (mock). Viewport inquilino: mobile 390px.

---

## SUITE A — App Inquilino (Mariela Sosa)

Entrá con `?demo=1`. Datos canónicos del contrato de Mariela (fuente:
`apps/inquilino/src/lib/mock-data.ts`):

| # | Caso | Resultado esperado EXACTO |
|---|---|---|
| A1 | Login con `?demo=1` | Redirige a `/` (home), NO queda en `/login`. Saludo a "Mariela". |
| A2 | Dirección del contrato (home + /contrato) | **"Gorriti 4521, 3°B"** |
| A3 | Inmobiliaria que administra | **"Inmobiliaria del Sol"** |
| A4 | Alquiler mensual actual | **$480.000** (`montoActual: 480000`) |
| A5 | Índice de ajuste del contrato | **ICL** |
| A6 | Próximo ajuste | **2026-06-01** (1 de junio 2026) |
| A7 | Período del contrato | inicio **2025-09-01**, fin **2028-08-31** |
| A8 | Garantía del contrato (sección garante) | proveedor **"Cobertura SUMA"**. El título debe decir **"Garantía del contrato"** (NO "Tu garantía"). |
| A9 | CBU para pagar (checkout de pago) | titular **"Inmobiliaria del Sol S.R.L."**, banco **Banco Galicia**, alias **inmosol.alquileres** o **delsol.cobranzas** |
| A10 | OTP — código incorrecto ×5 | al 5° intento bloquea: "Demasiados intentos. Pedí un código nuevo." |
| A11 | OTP — código expirado (>5min) | "El código expiró. Pedí uno nuevo." |
| A12 | `/verificar/16NJ-PTVB-KF8B` | carga el certificado, **NO redirige a login** (es público). |
| A13 | Reclamo nuevo (`/reclamos/nuevo`) | urgencia en grid 2×2, permite foto + descripción, se envía. |
| A14 | Sin scroll horizontal a 390px | `document.documentElement.scrollWidth == clientWidth` en todas las pantallas. |

---

## SUITE B — Panel Inmobiliaria (Roberto Tapia)

Fuente: `apps/inmobiliaria/src/lib/mock-data.ts` + `configuracion/page.tsx`.

| # | Caso | Resultado esperado EXACTO |
|---|---|---|
| B1 | Saludo en el dashboard | "Roberto" |
| B2 | Cantidad de propietarios | **5** (Eduardo Castro, Silvana Morales, Federico López Vega, Patricia Iglesias, Martín Bravo) |
| B3 | Eduardo Castro — a rendir / comisión | a rendir **$526.240**, comisión **8%** |
| B4 | Silvana Morales — a rendir / comisión | a rendir **$1.246.200**, comisión **7%** |
| B5 | Federico López Vega | muestra **"Falta CBU para transferir"**, comisión 8% |
| B6 | Propietario sin pendientes (Martín Bravo) | badge **"Al día"** (NO "1 unidad") |
| B7 | Equipo (Configuración → Equipo) | exactamente **5 miembros**: Roberto Tapia (Admin), Luciana Vidal (Operador), Sergio Almeida (Operador), **Martín Herrera** (Solo lectura — NO "Contador externo"), Camila Acosta (Carga limitada) |
| B8 | Rol de Camila — coherencia | dice **"Carga limitada"** TANTO en Equipo como en el badge de Auditoría (no "Carga" en uno y "Carga limitada" en otro) |
| B9 | Auditoría → acción de Camila (rol Carga) | Camila NO debe figurar haciendo "Pago manual cargado" (su rol no lo permite). Solo alta de contratos/propiedades. |
| B10 | Anuncios — autor del anuncio del CBU | **"Luciana Vidal"** (NO "Eugenia Rinaldi" — ese nombre no existe en el equipo). |
| B11 | Consorcios — cantidad | **2** (Gorriti 4521 con 12 UF, Cabildo 2890 con **4 UF**) |
| B12 | Consorcio Cabildo — coherencia UF | el badge "X UF" coincide con la cantidad de unidades reales del array (debe ser **4**, no 24). |
| B13 | Ruta de propiedad real | `/propiedades/prp_001` → 200 (NO `prop_001`, que da 404). |
| B14 | Contrato con chat IA | `/contratos/cnt_008` tiene la conversación con IA funcionando. |
| B15 | Aprobar un pago | mueve el pago a resueltos + aparece en el historial de Auditoría. |
| B16 | Selector de sociedad (topbar) | dice **"Todas las sociedades"** (NO "Todas (3)"). |

---

## SUITE C — Flujos públicos (sin login)

| # | Caso | Esperado |
|---|---|---|
| C1 | `/inquilino/garantes/demo` | 200, bloque "Sos garante de este contrato", CTAs WhatsApp + Llamar. NO redirige a login. |
| C2 | `/inquilino/p/demo` | 200, empty state "¿Qué vas a ver?". NO redirige a login. |
| C3 | `/inquilino/verificar/16NJ-PTVB-KF8B` | 200, muestra certificado. NO redirige a login. **CRÍTICO si redirige.** |
| C4 | Hash de certificado estable | en 2 builds consecutivos, el hash pre-renderizado en `out/inquilino/verificar/` es **el mismo** (`16NJ-PTVB-KF8B`). Si cambia entre builds → FAIL (regresión de BUG-01). |

---

## SUITE D — Landing + Legales

| # | Caso | Esperado |
|---|---|---|
| D1 | `/presentacion/` carga | 200, hero "Tu cartera, tu equipo y tu inquilino en una sola plataforma". |
| D2 | Pricing — 4 planes con CTA | Starter/Growth/Pro/Enterprise, cada uno con botón "Empezar con [plan]" (Enterprise: "Hablar con ventas"). |
| D3 | Footer no vacío | 4 columnas (Producto/Apps/Contacto/Legales), NO `<p></p>`. |
| D4 | Legales | `/legales/` da 200, tiene Términos + Privacidad + Datos. |
| D5 | Changelog — fechas distintas | las 3 versiones NO tienen todas la misma fecha. |
| D6 | "Carga limitada" en landing | la FAQ/feature de permisos dice "Carga limitada" (coherente con la app). |

---

## SUITE E — Build & deploy

| # | Caso | Esperado |
|---|---|---|
| E1 | `tsc --noEmit` ambas apps | EXIT 0, sin errores de tipo. |
| E2 | `next lint` ambas apps | sin warnings ni errores. |
| E3 | `bash scripts/build-static.sh` (con dev apagado) | termina en "✅ Listo", genera `out/{inmobiliaria,inquilino,presentacion,legales}/`. |
| E4 | Producción — 6 rutas | las 6 URLs de prod (las 4 superficies + garantes/demo + verificar/16NJ-PTVB-KF8B) dan 200. |

---

## ENTREGABLE
1. Tabla de resultados: cada caso con **PASS / FAIL / BLOCKED** + 1 línea de
   evidencia (qué leíste). Total: X PASS, Y FAIL, Z BLOCKED de NN casos.
2. Para cada **FAIL**: severidad + archivo:línea de la causa + fix propuesto.
   Si es bajo riesgo (dato mock, copy, CSS, lógica clara), arreglalo: fix →
   `tsc` verde → commit atómico → push. Si requiere decisión de marca/backend,
   marcalo "deferido".
3. Si un caso "FAIL" resulta ser tu error (ID inventado, app equivocada),
   NO lo cuentes como FAIL: anotalo aparte como "falso positivo descartado".
4. Cierre: `git status` limpio, 0 sin pushear, y `REPORTE-QA-PRECISO.md` con
   todo lo anterior.

Empezá por REGLA 0 (identidad), después Suite A. Reportá cada caso a medida que
lo verificás, no al final.

═══════════════════════════════════════════════════════════════════
