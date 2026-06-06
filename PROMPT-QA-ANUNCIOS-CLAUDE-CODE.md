# 🤖 PROMPT — QA de Anuncios ejecutado por Claude Code (auto + reporte)

> Pegá TODO lo de abajo (desde "ROL") en una sesión de Claude Code. Claude maneja
> el navegador, recorre el protocolo manual de Anuncios paso a paso, verifica cada
> resultado **midiendo** (no adivinando) y te deja un **REPORTE-QA-ANUNCIOS-MANUAL.md**.

---

ROL: Sos un QA que ejecuta un test **end-to-end del feature Anuncios** de My
Alquiler, en las dos apps (inmobiliaria = emisor, inquilino = receptor). Recorrés
el protocolo de abajo **clickeando de verdad** y verificás cada paso leyendo el
DOM. No asumas que algo anda: **probalo y medilo**. Si no podés medir → **BLOQUEADO**
(no inventes OK). Al final escribís el reporte.

## Contexto
- Monorepo Next.js, dos apps:
  - 🏠 **Inquilino** — `:3000`, mobile-first. Demo: **Mariela Sosa** (contrato
    `cnt_001`, consorcio `cnsr_001` = Gorriti 4521). Entrar: `localhost:3000/login?demo=1`.
  - 🏢 **Inmobiliaria** — `:3001`, desktop+mobile. **Roberto Tapia**, auto-login.
    Anuncios en `/anuncios`.
- Herramienta: **Claude Preview MCP**. launch.json: `llave-inquilino` (:3000),
  `llave-inmobiliaria` (:3001).

## Setup
1. `preview_start` de ambas (`llave-inquilino`, `llave-inmobiliaria`). Esperá HTTP 200.
2. Inmobiliaria en desktop (1440×900); inquilino en mobile (preset `mobile` 375).

## ⚠️ Workarounds OBLIGATORIOS (descubiertos ejecutando esto; ignoralos y falla)
1. **Pantalla en blanco sin errores en consola = HMR corrupto** del dev server de
   larga duración. Solución: `preview_stop` + `preview_start` (server limpio) y
   reintentá. NO lo reportes como bug de código.
2. **`preview_click` no siempre dispara el onClick de React.** Interactuá vía
   `preview_eval` con DOM nativo:
   - Inputs: usar el setter nativo + `dispatchEvent(new Event('input',{bubbles:true}))`.
   - Botones/cards: `.click()` nativo.
3. **El `<Select>` de Radix es frágil vía eval.** Reglas: **un solo cambio de
   audiencia por eval**, y **leé el toast/alcance en el MISMO eval** justo después
   (los toasts se auto-dismissean en ~3s). No encadenes varios `#aud` con toasts en
   el medio (cuelga → timeout). Si querés varias audiencias, hacé un eval por cada una.
4. Esperá el re-render (`await sleep(300-450ms)`) antes de medir.
5. **Cross-origin (NO es bug):** en dev :3000 y :3001 son orígenes distintos, así
   que el "Enterado" del inquilino **no** cambia el "Leído X/N" del inmo. Ese conteo
   del inmo es **simulado determinístico** (en backend lo calcula el server). El
   acuse del inquilino (no-leídos/persistencia) **sí es real**.

## REGLAS
- **REGLA 0:** antes de medir, confirmá que cada app es **My Alquiler** (no
  Deenex/Palta/San Pedro). `grep` contaminación = 0.
- **REGLA 1:** medí (leé del DOM); no estimes. Overflow = `scrollWidth - clientWidth`.
- **REGLA 2:** verificá cada flag dos veces. El overflow ~5px del inmo es artefacto
  del scrollbar headless, no bug.

---

# PARTE 1 — INMOBILIARIA (`:3001/anuncios`). Abrí "+ Nuevo anuncio".

**1.1 Formulario** — Verificá en el diálogo: hay `#t` (Título) y `#cu` (Cuerpo);
el texto dice **"Por app y email"** y **NO** hay "Sumar también WhatsApp" ni chips
APP/WHATSAPP/EMAIL seleccionables; el botón dice **"Revisar y enviar"**.

**1.2 Audiencia + alcance** — Cambiá `#aud` (un eval por audiencia) y leé
"Llega a N…". Esperado: Todos los inquilinos=**6** · Inquilinos con pago vencido=**2**
· Inquilinos con pago pendiente=**1** · Todos los propietarios=**5** · Todos los
consorcios=**2**.

**1.3 Sub-selección** —
- Audiencia "Inquilinos de un consorcio" → aparece `#cons`; sin elegir = "Llega a 0";
  elegí "Consorcio Gorriti 4521" → **1**.
- Audiencia "Contratos específicos" → aparece buscador `input[placeholder^="Buscar"]`
  + 6 contratos. Buscá `cabildo`→solo **Juan Pérez**; `laura`→solo **Laura Giménez**;
  texto inexistente→**"Sin resultados"**; vacío→**6**; tildá 2 → "Llega a 2".

**1.4 Validaciones** (abrí diálogo fresco para cada una; leé el toast en el acto):
- Título/Cuerpo vacíos → "Revisar y enviar" → toast **"Faltan datos"**.
- Título+Cuerpo OK, audiencia "Inquilinos de un consorcio" sin consorcio → **"Elegí un consorcio"**.
- Título+Cuerpo OK, audiencia "Contratos específicos" sin tildar → **"Elegí al menos un contrato"**.

**1.5 Confirmar y crear** — Título "QA test", Cuerpo "prueba", audiencia "Todos los
inquilinos" → "Revisar y enviar" → ventana **"¿Enviar el anuncio?"** con "Vas a
avisar a **6 destinatarios** (todos los inquilinos) por app y email…" + botón
**"Enviar a 6"**. Confirmá → toast **"Anuncio enviado"** + tarjeta "QA test" en la lista.

**1.6 Métricas + filtro** — Arriba: 3 métricas. Pills **Todas/Normal/Importante/
Urgente** con contador; un solo activo a la vez; al filtrar cambia la lista; una
prioridad con 0 → **"No hay anuncios con prioridad X"**.

**1.7 Tarjeta** — Cada card: **barra de color a la izquierda** (no toda tintada);
badge de prioridad **solo si no es Normal**; pie **"audiencia · N destinatarios"**
+ autor·fecha; **sin chips de canal**; bloque **"Leído X/N · Confirmado Y/N"** +
barra de progreso + **"Recordar a los que faltan"**. (Los X/N son simulados — ver
workaround 5 — solo verificá que se muestran y varían entre cards.)

**1.8 Borrar** — Tachito de "QA test" → ventana que avisa **"se elimina para todos
sus destinatarios"** + "les desaparece de la app" → confirmar Eliminar → la card
desaparece. *(Esto limpia el anuncio de prueba — no dejes basura.)*

**1.9 Mobile 375** — Resize a 375: overflow del documento = **0**; el diálogo
"Nuevo anuncio" se abre **a pantalla completa** (`position:fixed`, left≈0);
hay bottom-nav.

---

# PARTE 2 — INQUILINO (`:3000`)

Primero, para test limpio: `preview_eval` → `localStorage.removeItem('llave:anuncios:acuses:v1')`
y navegá a `/login?demo=1`. Bajá a "Anuncios de la inmobiliaria".

**2.1 Feed + sin leer** — La sección existe; badge **"2 sin leer"**; aparecen
**"Corte de agua · Gorriti 4521"** (su consorcio) y **"Nuevo CBU"** (todos);
cada no-leído tiene **dot violeta** + título en **negrita**.

**2.2 Abrir = leído** — Click en una card → se expande el cuerpo completo, el dot
desaparece y el badge pasa a **"1 sin leer"**.

**2.3 Acuse "Enterado"** — Click en el botón **"Enterado"** de la card que sigue
no-leída → pasa a **"✓ Enterado" en verde**, el contador baja a **0 sin leer**, y
**no** se expande la card (no togglea).

**2.4 Persistencia** — Recargá (`/login?demo=1`) → sigue en **0 sin leer** con los
acuses verdes (se guardó en localStorage).

**2.5 Mobile 375** — overflow del documento = **0**; el botón "Enterado" se ve y es
clickeable; en el anuncio del CBU el **número completo** (0070100120000018273645)
se ve (no se trunca).

---

# REPORTE — escribí `REPORTE-QA-ANUNCIOS-MANUAL.md` con:
1. **REGLA 0**: identidad de ambas apps + contaminación 0. (Y si reiniciaste algún
   server por HMR, anotalo como operativo, no como bug.)
2. **Tabla de resultados** por paso (1.1–1.9 y 2.1–2.5): ✅ / ❌ / BLOQUEADO, con el
   **valor medido** al lado (ej. "Morosos = 2 ✅").
3. **Hallazgos reales** (con medición y causa raíz) y **falsos positivos** (REGLA 2).
4. **Veredicto**: ¿pasa el QA de Anuncios? (N/14 checks verdes).

## Reglas de seguridad
- No corras migraciones, no toques datos productivos, no hagas push/merge solo.
- Si encontrás un bug, proponé el fix en código pero **esperá confirmación** del
  dueño en el chat antes de aplicarlo.
- Limpiá lo que crees durante el test (borrá el anuncio "QA test").
