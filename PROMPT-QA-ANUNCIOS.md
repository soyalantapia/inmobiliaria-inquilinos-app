# 🧪 PROMPT — QA del feature ANUNCIOS (inmobiliaria + inquilino)

> Copiá y pegá todo lo de abajo (desde "ROL") como prompt en una sesión nueva
> para testear de punta a punta el sistema de Anuncios en las dos apps.

---

ROL: Sos un QA exigente. Vas a testear **únicamente el feature de Anuncios** de
My Alquiler, en sus dos lados: la **inmobiliaria** (emisor) y el **inquilino**
(receptor). No asumas que algo anda: **probalo y medilo**. Si no podés medir algo,
marcá **BLOQUEADO** (no inventes un OK).

## Contexto
- Monorepo Next.js. Dos apps:
  - **Inquilino** — `:3000`, mobile-first. Persona demo: **Mariela Sosa**
    (contrato `cnt_001`, consorcio `cnsr_001` = Gorriti 4521). Entrar con
    `localhost:3000/login?demo=1`.
  - **Inmobiliaria** — `:3001`, desktop + mobile. Persona: **Roberto Tapia /
    Inmobiliaria del Sol**. Auto-login. Anuncios en `/anuncios`.
- Herramienta: **Claude Preview MCP** (`preview_start`/`resize`/`eval`/`screenshot`).
  Nombres en launch.json: `llave-inquilino` (:3000), `llave-inmobiliaria` (:3001).

## Setup
1. Levantá ambas apps con `preview_start`. Esperá a que compilen (HTTP 200).
2. Si una pantalla queda **en blanco sin errores en consola**, es HMR corrupto:
   `preview_stop` + `preview_start` (server limpio) y reintentá.

## Las 3 REGLAS (obligatorias)
- **REGLA 0 — Identidad.** Antes de medir, confirmá que cada app es **My Alquiler**
  (no Deenex / Palta / San Pedro / otra). Si el preview cayó a otra app, frená y
  re-levantá. `grep` de contaminación debe dar 0.
- **REGLA 1 — Medí, no estimes.** Overflow = `scrollWidth - clientWidth` por DOM.
  Conteos = leelos del DOM, no los supongas. Sin medición → BLOQUEADO.
- **REGLA 2 — Verificá cada flag dos veces.** El overflow de ~5px a 375px en el
  inmo es **artefacto del scrollbar headless** (no es bug real). Distinguí artefacto
  de overflow real (¿lo sufren todos los elementos o solo el contenedor de toasts?).

## Notas técnicas
- `preview_click` a veces no dispara el `onClick`/submit de React. Workaround:
  `.click()` nativo vía `eval`, o `form.requestSubmit()`. Esperá el re-render
  **antes** de medir el DOM.
- **Cross-origin (importante):** en dev las apps están en orígenes distintos
  (:3000 vs :3001), así que el acuse "Enterado" del inquilino **no** viaja al inmo.
  Por eso el **"Leído X/N · Confirmado Y/N" del inmo es simulado determinístico**
  (en backend lo calcula el server). NO esperes que marcar "Enterado" en el
  inquilino cambie el contador del inmo en dev. En prod (mismo origin) sí linkearía.
- El inquilino lee los anuncios cross-app; en dev cae a seeds (Corte de agua del
  consorcio + Nuevo CBU).

---

# A) Lado INMOBILIARIA (emisor) — `:3001/anuncios`

## A1. Crear anuncio — formulario
Abrí "Nuevo anuncio" y verificá:
- [ ] Campos: **Título** y **Cuerpo** (ambos `*` obligatorios), **Prioridad**
  (Normal/Importante/Urgente), **Audiencia**.
- [ ] **Canales:** dice **"Por app y email"** fijo (no se eligen). **NO** debe haber
  toggle de WhatsApp ni chips APP/WHATSAPP/EMAIL seleccionables.
- [ ] Botón dice **"Revisar y enviar"** (no "Enviar anuncio" directo).

## A2. Audiencias + alcance en vivo (conteo REAL del dato)
Cambiá la audiencia y leé la línea **"Llega a N destinatarios · {audiencia}"**.
Valores esperados:
- [ ] Todos los inquilinos → **6**
- [ ] Inquilinos con pago vencido (morosos) → **2**
- [ ] Inquilinos con pago pendiente → **1**
- [ ] Todos los propietarios → **5**
- [ ] Todos los consorcios → **2**

## A3. Sub-selección
- [ ] **"Inquilinos de un consorcio"** → aparece **selector de consorcio**; sin
  elegir = "Llega a 0"; eligiendo **"Consorcio Gorriti 4521"** → **1** (Mariela).
- [ ] **"Contratos específicos"** → aparece **lista multi-select** (6 contratos
  activos) + **buscador**. Probá el buscador:
  - `"cabildo"` → solo **Juan Pérez** (match por dirección)
  - `"laura"` → solo **Laura Giménez** (match por nombre)
  - texto inexistente → **"Sin resultados"**; vacío → vuelven los 6
  - seleccionar 2 → "Llega a **2**".

## A4. Validaciones (deben bloquear con toast destructivo)
- [ ] Sin título o sin cuerpo → "Faltan datos".
- [ ] "Inquilinos de un consorcio" sin elegir consorcio → "Elegí un consorcio".
- [ ] "Contratos específicos" sin seleccionar → "Elegí al menos un contrato".
- [ ] Audiencia con 0 destinatarios → "Sin destinatarios".

## A5. Confirmación antes de enviar
- [ ] "Revisar y enviar" abre un **ConfirmDialog** con el alcance:
  "Vas a avisar a **N destinatarios** ({audiencia}) por app y email. Esto no se
  puede deshacer." + botón **"Enviar a N"**.
- [ ] Confirmar crea el anuncio (toast de éxito) y aparece en la lista.

## A6. Lista, métricas y filtro
- [ ] Métricas arriba: Anuncios enviados / Destinatarios totales / Última semana.
- [ ] **Filtro por prioridad** (pills): **Todas · Normal · Importante · Urgente**,
  cada uno con **contador**. Un solo activo a la vez (violeta sólido). Filtra la
  lista; prioridad con 0 → **"No hay anuncios con prioridad X"**.

## A7. Card de anuncio
- [ ] **Barra de color a la izquierda** por prioridad (ámbar=Importante,
  rojo=Urgente, gris=Normal). La card NO está toda tintada.
- [ ] Badge de prioridad **solo si no es Normal**.
- [ ] Título completo (envuelve, no se corta), cuerpo a **2 líneas**.
- [ ] Pie: **audiencia · N destinatarios** + autor·fecha. **Sin** chips de canal.

## A8. Acuse del lado inmo (loop)
- [ ] Cada card muestra **"Leído X/N · Confirmado Y/N"** + **barra de progreso**.
- [ ] Los números son **creíbles y varían** entre cards (no todos iguales).
- [ ] **"Recordar a los N que faltan"** (solo si leído < total) → toast de reenvío.

## A9. Borrar (avisa que afecta a todos)
- [ ] El tacho abre ConfirmDialog: **"Se elimina … para todos sus destinatarios
  (N). También les desaparece de la app y no se puede deshacer."** + botón rojo.
- [ ] (No borres los seeds salvo que después los recrees.)

## A10. Responsive inmo
- [ ] A **375px**: diálogo "Nuevo anuncio" **full-screen**, lista sin overflow real
  (REGLA 2), bottom-nav presente, la lista de contratos del multi-select scrollea
  internamente.

---

# B) Lado INQUILINO (receptor) — `:3000` (home, sesión demo)

## B1. Feed "Anuncios de la inmobiliaria"
- [ ] En el home aparece la sección con los anuncios que **le aplican a Mariela**
  (TODOS_INQUILINOS + los de su consorcio cnsr_001 + los de su contrato). NO debe
  ver anuncios dirigidos a otros consorcios/contratos.
- [ ] Header con badge **"N sin leer"**.

## B2. No-leídos
- [ ] Cada anuncio **no leído** tiene **dot violeta** + **título en negrita**.
- [ ] Abrir/expandir un anuncio (click) lo marca **leído**: el dot desaparece, el
  título deja de estar en negrita y el contador **"N sin leer" baja en 1**.

## B3. Acuse "Enterado"
- [ ] Cada card tiene botón **"Enterado"**.
- [ ] Tocarlo (sin necesidad de expandir) lo marca **confirmado**: pasa a
  **"✓ Enterado" en verde** e implica leído (el contador baja).
- [ ] El click en "Enterado" **no** togglea el expandir (stopPropagation).

## B4. Persistencia
- [ ] Marcá un anuncio como Enterado y **recargá** la página: debe seguir
  confirmado (el acuse se guarda en localStorage). El "N sin leer" se mantiene.

## B5. Contenido
- [ ] El cuerpo colapsado muestra preview (2 líneas) y expandido muestra todo
  (ej. el CBU completo del anuncio "Nuevo CBU" no se corta al expandir).

## B6. Responsive inquilino
- [ ] A **375px**: sin overflow horizontal, las cards entran, botón "Enterado"
  accesible, bottom-nav OK.

---

# C) Reporte esperado
Entregá un **REPORTE-QA-ANUNCIOS.md** con:
1. **REGLA 0**: identidad de ambas apps (My Alquiler, contaminación 0).
2. Tabla por sección (A1–A10, B1–B6): ✅ / 🟠 (con medición) / ❌ / BLOQUEADO.
3. **Hallazgos reales** (con medición y causa raíz) y **falsos positivos
   descartados** (REGLA 2).
4. Si encontrás bugs: proponé el fix en código, pero **no mergees solo** (lo
   confirma el dueño en el chat). No corras migraciones ni toques datos productivos.
5. Veredicto final: ¿pasa el QA de Anuncios?
