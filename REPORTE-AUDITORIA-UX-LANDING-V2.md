# 🕵️ Auditoría UX — Landing `/presentacion/` · V2 (post-fixes)

> **Persona:** Marcela vuelve. Hace dos días vino la primera vez y se fue dudando (audit V1). Hoy llegó otro WhatsApp del colega: "che le dieron una manita, mirá ahora". Vuelve con la guardia baja, dispuesta a darle una segunda chance — pero también con la memoria de lo que le había molestado.

> **Configuración:**
> - PLATAFORMA: My Alquiler — landing `/presentacion/` después de aplicar los 14 quick wins QW-01 a QW-14 (commit `e5fb926`, run GH Pages `26593656117`)
> - URL: `https://soyalantapia.github.io/inmobiliaria-inquilinos-app/presentacion/`
> - Stack: HTML estático generado por Node (sin React) · CSS-in-HTML con design tokens · vanilla JS para drawer + scroll spy + reveals
> - Método: análisis estático + inspect del DOM live + screenshots desktop/mobile/drawer
> - Idioma: español rioplatense

---

## 1. Resumen ejecutivo

### ✅ Lo que mejoró (validación QW-01 a QW-14)

Las **14 fricciones del audit V1 fueron eliminadas**. Validación visual + DOM inspect:

| QW | Hallazgo V1 | Estado V2 |
|---|---|---|
| QW-01 | Footer vacío | ✅ 4 columnas (Producto/Apps/Contacto/Legales) + bottom bar |
| QW-02 | "30 días gratis" engañoso | ✅ "Recorrer panel demo" honesto |
| QW-03 | Typo "dla" | ✅ Corregido |
| QW-04 | 5 variantes del mismo CTA | ✅ 2 copys canónicos: "Recorrer panel demo" (CTA grande) + "Probar demo" (nav/sticky) |
| QW-05 | "Acceder al panel" | ✅ "Recorrer panel demo" en hero + CTA final |
| QW-06 | mailto: ventas | ✅ WhatsApp link con texto pre-llenado |
| QW-07 | 3 releases mismo día | ✅ Distintas: 2026-05-13, 2026-04-22, 2026-03-18 |
| QW-08 | FAQs sólo operativas | ✅ 5 nuevas del comprador AL PRINCIPIO (contrato, migración, baja, SLA, claves) — 13 total |
| QW-09 | 2 CTAs igualados en hero | ✅ 1 primario + link inquilino secundario `hero-inquilino-link` muted |
| QW-10 | "App propietario" navbar | ✅ "Probar demo →" |
| QW-11 | "Cambios" en nav | ✅ "Novedades" en navbar + drawer |
| QW-12 | "250 propiedades en versión inicial" | ✅ "Sin límite · Propiedades por equipo en cualquier plan" |
| QW-13 | Impacto promete testimoniales | ✅ "Lo que el producto te garantiza por diseño" + "No son testimonios — son consecuencias…" |
| QW-14 | Antes/Después redundante | ✅ Sección eliminada; flujo Problema → Cómo funciona |

### 🚨 Las 4 fricciones nuevas que más sangran (V2)

1. **`[V2-01]` Links legales son trampa.** Footer ahora tiene "Términos · Privacidad · Datos" — pero los 3 son `href="#"` que vuelven al top del hero. **Peor que no tenerlos**: prometés seriedad y la rompés al click. Marcela toca Términos, se le sube la página y piensa "está roto, ¿esto es real?".
2. **`[V2-02]` Contradicción onboarding visible para el lector atento.** Subtitle "Cómo funciona" jura `"Tu cartera puede operar el mismo día"`. FAQ nueva (QW-08) confiesa `"Si tenés más de 50 propiedades, la migración demora entre 2 y 5 días hábiles"`. Marcela tiene 80 → cae en la categoría que NO opera el mismo día. Mensajes que se desmienten en la misma página.
3. **`[V2-03]` Stat "Sin límite" desbalancea visualmente la franja de stats.** El CSS hace `clamp(26px, 6.5vw, 44px)` para todos los stats — "Sin límite" (8 chars) ocupa misma fuente que "10 min" (6 chars) y "24/7" (4 chars). Pero el gradient text + bold pega menos en texto que en números. La cuarta card se ve "menor", rompe la simetría de la fila.
4. **`[V2-04]` 4 hallazgos del audit V1 marcados Crítica/Alta NO se aplicaron** (porque tenían esfuerzo Medio/Alto y quedaron fuera de quick wins): `L-SOCIAL-01` (cero pruebas sociales), `L-DEMO-01` (sin video/screenshots reales), `L-PRICE-02` (tramos sin CTA "Empezar con [plan]"), `L-DEEP-LINK-01` (32 cards apuntan a demo sin contexto). Siguen siendo lo que más freno produce.

**Sensación general post-fixes:**
La landing **subió un escalón completo** en honestidad y trust signals. Marcela recorre y ya no se choca con copys engañosos, naming roto ni footer ausente — y le aparecen WhatsApp + onboarding + SLA + datos clarísimos en la FAQ. El cambio de Impacto a "lo que el producto te garantiza por diseño" es **muy potente** — admite que no hay testimonios sin mentir, y eso paradójicamente da más confianza que números inventados.
Lo que falta ahora es la pieza estructural que NO entra en quick wins: **pruebas sociales reales** (logos, testimonios, equipo) + **demo visible sin tocar** (video o screenshots). Sin eso, la decisión final sigue siendo acto de fe.

---

## 2. Diario del usuario (Marcela vuelve)

> "Le dieron una manita. Voy a darle 4 minutos."

**0:00 — Llegada.** Navbar limpio. "Cómo funciona · Funcionalidades · Integraciones · Precios · Preguntas · **Novedades**". Antes era "Cambios", ahora es "Novedades" — me suena más a release notes que a "changelog de dev". ✓

**0:15 — Hero.** "Tu cartera, tu equipo y tu inquilino en una sola plataforma". Veo UN solo botón grande: "🏢 Recorrer panel demo". Abajo, chiquito: "📱 Si sos inquilino, entrá acá →". **Ahora entiendo quién es el cliente**: yo, la inmobiliaria. El inquilino tiene su propio carril. Buenísimo. *(✓ QW-09)*

**0:30 — Toco "Recorrer panel demo".** El copy ahora coincide con lo que pasa — no me promete "acceso a mi cuenta", me promete recorrer una demo. Cuando llego al demo, no me siento engañada. *(✓ QW-02 + QW-05)*

**0:50 — Vuelvo. Sigo bajando.** Stats: "10 min · 1 toque · 24/7 · **Sin límite**". La cuarta dice "Sin límite · Propiedades por equipo en cualquier plan". Ya no es "250 versión inicial" — bien, ya no parece chico ni prematuro. Pero el texto "Sin límite" se ve **más chico** que los otros números… visualmente la fila queda desbalanceada. *(`V2-03`)*

**1:10 — "Los problemas reales del día a día".** 6 dolores. Sigue acertando. Y ya no me obliga a leer la sección "Antes/después" después — directo voy a "Implementación en tres etapas". El flujo se siente más limpio. *(✓ QW-14)*

**1:30 — "Implementación en tres etapas".** Subtitle dice "Sin migraciones extensas ni capacitaciones largas. **Tu cartera puede operar el mismo día.**" Me anoto eso — yo tengo 80 contratos. *(⚠ flag mental)*

**3:00 — Llego a FAQ.** Las primeras son nuevas: "¿Hay contrato mínimo o costo de implementación?" — **bingo, mi pregunta**. Respuesta: "No, sin permanencia, sin implementación, sin cargos extra". OK. Segunda: "¿Quién carga mis contratos al sistema cuando arranco?" — abro. **"Lo hacemos juntos… Si tenés más de 50 propiedades, la migración demora entre 2 y 5 días hábiles."**

**3:10 — Pausa.** Espera. Hace 1:30 me dijiste que mi cartera puede operar **el mismo día**. Ahora me decís que con más de 50 propiedades, **2 a 5 días**. Yo tengo 80. **¿Cuál de las dos cosas creés vos?** *(`V2-02`)*

**3:30 — FAQ "¿Qué pasa con mis datos si me doy de baja?"** "Export completo CSV/JSON. Conservamos 90 días cifrado por si volvés, después eliminamos." **Esto me tranquiliza muchísimo.** Es exactamente la pregunta que tenía. ✓

**3:50 — FAQ SLA.** "Soporte por WhatsApp, respuesta promedio <30min en horario hábil, sábados por la mañana para emergencias". Concreto. ✓

**4:10 — FAQ Seguridad de claves fiscales.** "Cifradas, no aparecen en logs ni respuestas de API. Datos bancarios sólo lectura. Historial inmutable." Eso es **exactamente** lo que necesitaba para confiar la clave fiscal de mis propietarios. ✓

**4:30 — Pricing.** 4 tramos. Yo voy a Pro $200k (80 propiedades). **Sigue sin haber un botón "Empezar con Pro".** Hay un único CTA abajo: "🏢 Recorrer panel demo" + "💬 Hablar por WhatsApp". El segundo me abre WhatsApp con texto pre-llenado "Hola, quiero conocer My Alquiler" — **muchísimo mejor que el mailto anterior**. Pero no asocia mi interés con el plan Pro. *(`L-PRICE-02` sigue pending)*

**5:00 — Novedades.** v4 mayo 13, v3 abril 22, v2 marzo 18. **Diferentes fechas, historia real, gana credibilidad**. ✓ *(QW-07)*

**5:20 — Impacto.** "Lo que el producto te garantiza por diseño." Y abajo: "No son testimonios — son consecuencias directas de cómo está construida la plataforma." 12hs · 0 · 100%. **Esto es muchísimo más honesto.** Admite que no son clientes hablando, son afirmaciones de producto. Paradójicamente me da MÁS confianza que el "Lo que reportan las inmobiliarias" anterior. ✓ *(QW-13 muy bien)*

**5:40 — CTA final.** "Conocé la plataforma en cinco minutos". 1 CTA grande + link inquilino chiquito. Coherente con hero. ✓

**6:00 — Footer.** ¡Ahora hay footer! 4 columnas: Producto · Apps · Contacto · Legales. WhatsApp visible. **Toco "Términos y condiciones"** porque quiero ver letra chica antes de avanzar… **la página se sube al hero**. ¿Qué? Toco "Política de privacidad"… **igual**. Toco "Política de datos"… **igual**. *(`V2-01`)*

**Veredicto en voz alta:** "Mejoró un montón. Ahora me siento hablando con un producto serio: WhatsApp directo, FAQs concretas sobre datos y SLA, copy honesto. Pero los legales no son legales — son anchors al top. Eso me asusta justo cuando estaba por confiar. Y la contradicción sobre el onboarding (mismo día / 2-5 días) me bajó un escalón. Voy a mandarles WhatsApp para preguntar **¿quién migra mis 80 contratos y cuánto tarda en serio?** Si me responden bien, contrato. Si no, sigo buscando."

---

## 3. Tabla priorizada — Matriz impacto × esfuerzo

| ID | Problema | Severidad | Esfuerzo | Quick win? |
|---|---|---|---|---|
| V2-01 | 3 links legales son trampa (href="#" vuelven al top) | Crítica | Bajo | ✅ |
| V2-02 | Contradicción "el mismo día" vs "2-5 días hábiles" en FAQ | Alta | Bajo | ✅ |
| V2-03 | Stat "Sin límite" desbalancea visualmente la franja | Media | Bajo | ✅ |
| V2-04 | Card "Apps" del footer sin íconos 🏢/📱 (resto del sitio sí) | Baja | Bajo | ✅ |
| V2-05 | CSS huérfano `.antes-despues` + `.compare-grid` (~80 líneas inertes) | Baja | Bajo | ✅ |
| V2-06 | `renderAntesDespues` + placeholders ANTES_DESPUES en build-landing.js huérfanos | Baja | Bajo | ✅ |
| V2-07 | Sección `antesDespues` del JSON sigue ahí (8 filas obsoletas) | Baja | Bajo | ✅ |
| V2-08 | Link "Si sos inquilino" hero muy muted — validar conversión | Baja | Bajo | (instrumentación) |
| V2-09 | "Onboarding personalizado" en Starter $50k podría no escalar | Media | Medio | (negocio, no UX) |
| L-SOCIAL-01 (de V1) | Cero pruebas sociales (logos, testimonios, casos) | Crítica | Alto | (estratégico) |
| L-DEMO-01 (de V1) | Sin video/screenshots reales del producto | Alta | Alto | (estratégico) |
| L-PRICE-02 (de V1) | Tramos sin botón "Empezar con [plan]" | Alta | Medio | (estratégico) |
| L-DEEP-LINK-01 (de V1) | 32 feature cards al demo sin contexto | Media | Medio | (estratégico) |

---

## 4. Hallazgos detallados

### [V2-01] [Trust/Legales] — Links legales son trampa (href="#" vuelven al top)
📍 **Ubicación:** Footer columna "Legales" → `out/presentacion/index.html` (líneas del footer) · datos en `landing-data.json:footer.columnas[3].links`
👀 **Qué vi:** Los 3 anchors `Términos y condiciones`, `Política de privacidad`, `Política de datos` apuntan a `href="#"`. Al hacer click, el navegador interpreta "ir al hash vacío" = "ir al top de la página". Marcela toca esperando ver Términos, se le scrolea la página entera al hero, y queda confundida ("¿no había nada? ¿es link roto?").
😖 **Por qué molesta:** **Peor que no tenerlos.** Cuando el footer estaba vacío, no había expectativa. Ahora prometemos 3 documentos legales pero entregamos un scroll-al-top — sensación clarísima de "fachada legal sin sustancia". Es exactamente el momento donde Marcela mira detalle de seriedad antes de mandar el WhatsApp.
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Tres opciones por orden de calidad:
- (a) **Mejor:** crear 3 páginas estáticas mínimas en `out/legales/terminos.html`, `out/legales/privacidad.html`, `out/legales/datos.html` con contenido placeholder pero serio ("Versión preliminar, contactar a hola@myalquiler.com.ar para acuerdo formal") y apuntar los links ahí.
- (b) **Intermedia:** hacer que los 3 links abran un modal con texto "📄 [Nombre del documento] · Esta sección está en preparación. Para acuerdos formales contactá a ventas@myalquiler.com.ar".
- (c) **Mínima honesta:** etiquetar los links como "Próximamente" con un disabled state (clase `.footer-link-soon` con `opacity: 0.5; pointer-events: none; cursor: not-allowed`).

---

### [V2-02] [Confianza/Coherencia] — Contradicción "el mismo día" vs "2-5 días hábiles"
📍 **Ubicación:**
- Promesa: `landing-data.json:comoFunciona.subtitulo` → "Sin migraciones extensas ni capacitaciones largas. Tu cartera puede operar el mismo día."
- Contradicción: `landing-data.json:faq.items[1].respuesta` → "Si tenés más de 50 propiedades, la migración demora entre 2 y 5 días hábiles."
👀 **Qué vi:** Marcela lee a las 1:30 que "puede operar el mismo día". A las 3:00, lee en la FAQ que con más de 50 propiedades son "2-5 días". Marcela tiene 80 → cae en la zona "2-5 días".
😖 **Por qué molesta:** Dos mensajes oficiales del sitio se desmienten entre sí en la misma página. La FAQ fue agregada en QW-08 con honestidad — bien — pero quedó **descoordinada** con la promesa anterior. Es exactamente el patrón "marketing alegre vs realidad operativa" que Marcela detecta por experiencia.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo (cambiar 1 frase)
✅ **Recomendación:** Reescribir el subtitle de "Cómo funciona" para que sea consistente con la FAQ:
**Antes:** `"Sin migraciones extensas ni capacitaciones largas. Tu cartera puede operar el mismo día."`
**Después:** `"Sin migraciones extensas ni capacitaciones largas. Carteras chicas operan el mismo día; las más grandes, en pocos días con ayuda del equipo."`

---

### [V2-03] [UI/Visual] — Stat "Sin límite" desbalancea la franja
📍 **Ubicación:** Stats section · `landing-data.json:stats[3]`
👀 **Qué vi:** Los 4 stats usan el mismo `font-size: clamp(26px, 6.5vw, 44px)` + `font-weight: 800` + gradient text. Los 3 primeros son cortos: "10 min" (6 chars), "1 toque" (7 chars), "24/7" (4 chars). El cuarto es "Sin límite" (10 chars). Visualmente el stat 4 ocupa más ancho pero el "número" ya no se siente "número" — se siente texto.
😖 **Por qué molesta:** La franja de stats funciona por **simetría visual** (4 cards iguales con números grandes). "Sin límite" rompe el patrón — el ojo lee 3 KPIs + 1 frase y pierde la consistencia.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar el valor a algo numérico que mantenga el patrón:
- Opción A: `"valor": "∞"` (símbolo infinito) + `"label": "Sin límite de propiedades en cualquier plan"`
- Opción B: `"valor": "100%"` + `"label": "De funcionalidades en todos los planes"` (porque el JSON ya dice "Todo incluido en cualquier plan")
- Opción C: `"valor": "4"` + `"label": "Niveles de permisos para tu equipo"` (vuelve a número real, alineado con el feature)

---

### [V2-04] [UI/Consistencia] — Footer "Apps" sin íconos 🏢/📱
📍 **Ubicación:** `landing-data.json:footer.columnas[1].links`
👀 **Qué vi:** En el resto del sitio (hero, navbar, drawer, CTA final, pricing) los botones de "Panel inmobiliario" llevan 🏢 y "App del inquilino" llevan 📱. En el footer, las dos labels van sin emoji. Marcela lo registra como "menos coherente" sin saber bien por qué.
😖 **Por qué molesta:** Sistema visual inconsistente — pequeño detalle de pulido que afecta la sensación de "está cuidado". No es bloqueante.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Agregar emojis en `landing-data.json:footer.columnas[1].links`:
```json
{ "label": "🏢 Panel inmobiliario", "href": "../inmobiliaria/" },
{ "label": "📱 App del inquilino", "href": "../inquilino/" }
```

---

### [V2-05] [Tidy/Código muerto] — CSS huérfano `.antes-despues` + `.compare-grid`
📍 **Ubicación:** `scripts/landing.template.html` líneas ~1940-2104 (CSS rules de las secciones eliminadas en QW-14)
👀 **Qué vi:** Las clases `.antes-despues`, `.compare-grid`, `.compare-col`, `.compare-head`, `.tag-rojo`, `.tag-violeta` siguen en el CSS del template aunque la sección HTML ya no existe.
😖 **Por qué molesta:** No molesta visualmente al usuario — sólo agrega ~80 líneas de CSS muerto al bundle. Higiene técnica.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Buscar y eliminar todas las reglas de `.antes-despues`, `.compare-grid`, `.compare-col`, `.compare-head`, `.tag-rojo`, `.tag-violeta` del template.

---

### [V2-06] [Tidy/Código muerto] — `renderAntesDespues` y placeholders huérfanos
📍 **Ubicación:** `scripts/build-landing.js`
👀 **Qué vi:** La función `renderAntesDespues` se sigue llamando en el mapping de placeholders. Genera HTML que no se inyecta (el placeholder `{{ANTES_DESPUES_*}}` ya no existe en el template). Silently consume CPU al build sin efecto.
😖 **Por qué molesta:** Higiene técnica. Si alguien después busca por qué se renderiza esa función, se confunde.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Eliminar:
- Función `renderAntesDespues` completa
- Líneas `ANTES_DESPUES_TITULO`, `ANTES_DESPUES_SUBTITULO`, `ANTES_DESPUES_COLS` del mapping `placeholders`

---

### [V2-07] [Tidy/Data] — Sección `antesDespues` del JSON huérfana
📍 **Ubicación:** `scripts/landing-data.json` → key `antesDespues` (titulo, subtitulo, 8 filas)
👀 **Qué vi:** El JSON sigue con la sección `antesDespues` aunque ya no se usa en el HTML generado.
😖 **Por qué molesta:** Higiene + alguien podría editarla pensando que tiene efecto.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Eliminar el bloque `antesDespues` del JSON. Si en el futuro se quiere reactivar la sección, se puede restaurar desde git.

---

### [V2-08] [Conversión/Instrumentación] — Link inquilino secundario validar conversión
📍 **Ubicación:** Hero + CTA final `class="hero-inquilino-link"`
👀 **Qué vi:** El link "📱 Si sos inquilino, entrá acá →" usa `color: rgb(107,107,128)` (muted) y `font-size: 13.5px`. Es **muy** secundario visualmente. Bien para no competir con el CTA primary — pero quizás un inquilino que aterriza por error no lo encuentra.
😖 **Por qué molesta:** Sin métricas reales no se sabe si pierde a inquilinos que aterrizaron por error en la landing de la inmobiliaria. Solo un dato de instrumentación lo confirmaría.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo (agregar evento de analytics) o Medio (rediseñar como chip más visible)
✅ **Recomendación:** Antes de cambiar visualmente, instrumentar el evento de click. Si después de 1-2 semanas el CTR es <0.5%, considerar promoverlo a un chip con borde como las badges del hero:
```html
<a class="hero-inquilino-link badge-chip">📱 Si sos inquilino, entrá acá →</a>
```

---

### [V2-09] [Negocio (no UX)] — "Onboarding personalizado" en Starter $50k podría no escalar
📍 **Ubicación:** `landing-data.json:precios.incluye` + nueva FAQ migración
👀 **Qué vi:** La lista "Todo incluido en cualquier plan" promete "Onboarding personalizado del equipo" y la FAQ confirma "Lo hacemos juntos". Aplica también al Starter $50k/mes (10 propiedades). Costo del onboarding humano vs LTV del Starter (un año = $600k, menos comisión) puede no cerrar.
😖 **Por qué molesta:** No molesta a Marcela — al contrario, le encanta. Pero a futuro la empresa puede no poder cumplir esta promesa si hay muchos Starter.
🔥 **Severidad:** Media (riesgo de negocio, no UX visible)
🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Calificar el onboarding por tramo:
- Starter: "Onboarding por video + guía paso a paso"
- Growth/Pro/Enterprise: "Onboarding personalizado con sesión 1:1"

---

### [V2-10] [Estratégico — pending de V1] — Cero pruebas sociales
📍 **Ubicación:** Toda la landing
👀 **Qué vi:** No hay logos de clientes, ni testimoniales con nombre, ni casos de éxito, ni sección "Quiénes somos" con equipo.
😖 **Por qué molesta:** Es el mayor freno de conversión B2B SaaS. Sin esto Marcela tiene que confiar 100% en la palabra del sitio. Identificado como `L-SOCIAL-01` (Crítica) en V1, no se aplicó por esfuerzo Alto.
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Alto (requiere conseguir testimoniales reales)
✅ **Recomendación:** Stay course con la estrategia escalonada del reporte V1:
- Mes 1-2: 1-2 testimoniales con nombre + foto + inmobiliaria + 1 frase
- Mes 3+: franja de logos
- Mientras tanto: sección "Quiénes somos" con foto del equipo + ubicación (esto sí es Quick Win esfuerzo Bajo si se tiene material)

---

### [V2-11] [Estratégico — pending de V1] — Sin demo visual del producto
📍 **Ubicación:** Hero (sólo mockup decorativo sintético)
👀 **Qué vi:** El mockup del hero es decorativo (4 cards de KPIs ficticios). No hay screenshot real, GIF, ni video del producto.
😖 **Por qué molesta:** Marcela debe tocar el botón demo y "descubrir" el producto. Fricción altísima. Identificado como `L-DEMO-01` (Alta) en V1.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Alto
✅ **Recomendación:** Mismo del V1: screenshot real del dashboard reemplazando el mockup decorativo + GIF 8-12s + video tour 60-90s.

---

### [V2-12] [Estratégico — pending de V1] — Pricing sin botón "Empezar con [plan]"
📍 **Ubicación:** Sección pricing — los 4 tramos no tienen CTA propio
👀 **Qué vi:** Las cards de Starter / Growth / Pro / Enterprise son visualmente claras pero no permiten elegir desde la card. El único CTA es genérico abajo.
😖 **Por qué molesta:** Pierde el momento de máxima intención de compra. Identificado como `L-PRICE-02` (Alta) en V1.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Medio (requiere flujo de selección — puede ser tan simple como pre-llenar WhatsApp con `?text=Hola%2C%20quiero%20el%20plan%20Pro%20%2880%20propiedades%29`)
✅ **Recomendación:** Agregar botón en cada tramo:
```
Starter/Growth/Pro: "Empezar con [plan] →" → WhatsApp pre-llenado con plan
Enterprise: "Hablar con ventas →" → WhatsApp con campos extra
```

---

### [V2-13] [Estratégico — pending de V1] — Cards feature deep-link al demo sin contexto
📍 **Ubicación:** 8 secciones × 4 features × link "Ver pagos pendientes" / "Probar la carga" → `../inmobiliaria/[ruta]`
👀 **Qué vi:** Marcela toca un link específico desde una card de feature, aterriza en una pantalla mock del demo sin saber por qué llegó ahí.
😖 **Por qué molesta:** Pierde el hilo de exploración. Identificado como `L-DEEP-LINK-01` (Media) en V1.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Mismo del V1: banner contextual al aterrizar desde landing, o reemplazar por screenshots embebidos.

---

## 5. Recomendaciones

### 🟢 Quick wins V2 (esta semana — ~3-4h total)

| # | Fix | Archivo | Tiempo |
|---|---|---|---|
| 1 | Resolver legales (3 páginas placeholder + cambiar href) | `out/legales/*.html` + JSON | 30min |
| 2 | Eliminar contradicción "el mismo día" / "2-5 días" en subtitle comoFunciona | `landing-data.json` | 2min |
| 3 | Reemplazar stat "Sin límite" por símbolo o número | `landing-data.json:stats[3]` | 2min |
| 4 | Agregar emojis 🏢/📱 en footer columna "Apps" | `landing-data.json:footer.columnas[1]` | 1min |
| 5 | Limpiar CSS huérfano `.antes-despues` + `.compare-grid` | `landing.template.html` | 15min |
| 6 | Limpiar `renderAntesDespues` + placeholders ANTES_DESPUES | `build-landing.js` | 5min |
| 7 | Eliminar bloque `antesDespues` del JSON | `landing-data.json` | 1min |
| 8 | Calificar onboarding por tramo (Starter video, resto 1:1) | `landing-data.json` | 5min |

**Total Quick wins V2:** ~1 hora real de trabajo + 30min para los legales reales. Resuelve **todos los hallazgos nuevos del audit V2** excepto los 4 estratégicos heredados de V1.

### 🔵 Mejoras estratégicas (próximas semanas — del V1, siguen pendientes)

1. **Pruebas sociales reales** (`L-SOCIAL-01` / `V2-10`): conseguir 2-3 testimoniales con nombre + foto + inmobiliaria, franja de logos, sección "Quiénes somos".
2. **Demo visible** (`L-DEMO-01` / `V2-11`): screenshot real del dashboard en el hero + GIF 8-12s + video tour 60-90s.
3. **CTA por tramo de pricing** (`L-PRICE-02` / `V2-12`): "Empezar con [plan]" en cada card, link a WhatsApp con plan pre-llenado.
4. **Contexto en deep-links** (`L-DEEP-LINK-01` / `V2-13`): banner "Llegaste desde la landing" al aterrizar en el demo.

### 🆕 Instrumentación recomendada

- Eventos de click en CTAs principales (hero, float, pricing, WhatsApp) para validar cuál convierte
- Evento en `hero-inquilino-link` (V2-08) para ver si vale la pena ampliarlo
- Scroll depth para saber dónde abandonan los visitantes

---

> **Cierre del audit V2:**
> La aplicación de los 14 quick wins **fue un salto cualitativo** — la sensación general pasó de "linda pero todavía no es real" a "honesta, concreta, le creo más". Las 5 nuevas FAQs del comprador (QW-08) son la pieza más fuerte: responder antes de que pregunten "contrato mínimo" / "qué pasa con mis datos" / "SLA" hace que Marcela baje la guardia.
> Lo que queda son **dos categorías**:
> - 8 quick wins nuevos (~3-4h total) que cierran cabos sueltos del propio refactor — sobre todo el footer legal y la contradicción del onboarding.
> - 4 mejoras estratégicas heredadas del V1 que requieren testimoniales reales, demo visual y un flow de pricing — material de 2-4 semanas.
>
> Con los 8 nuevos quick wins, la landing queda **production-ready para empezar a recibir tráfico de WhatsApp serio**. Con las 4 estratégicas, queda lista para correr ads.
