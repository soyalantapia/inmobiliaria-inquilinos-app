# Plan estratégico SEO + AI-SEO — My Alquiler
### Objetivo: ser la herramienta #1 de gestión de alquileres en Argentina (Google + motores de IA)

> Redactado como experto en posicionamiento (SEO tradicional + AI-SEO / GEO). Horizonte realista: **6-18 meses** para dominancia; primeros resultados de fundación en semanas. El nicho AR está desatendido → alcanzable.

---

## 0. Diagnóstico (estado real, auditado 08/07/2026)

**La fundación está rota — hay que arreglarla ANTES de cualquier táctica:**
- `myalquiler.com` = **página parkeada en inglés en otro host** (no conectada al producto). Cero SEO, marca dañada.
- La landing (excelente) vive en `admin.myalquiler.com/inicio` — subdominio `admin.` (señal débil) + el panel es `noindex`.
- **Sin** robots.txt, sitemap.xml, llms.txt, pricing.md, ni schema JSON-LD.
- **1 sola página** de contenido → topical authority = 0.

**Consecuencia:** no sos findable ni citable. No es falta de "trucos" — es falta de **sitio indexable + contenido**.

**Ventaja:** competidores AR (Barreeo, mialquiler.ar, etc.) con contenido pobre y sin AI-SEO → hueco enorme.

---

## FASE 0 — Fundación (semanas 1-2, BLOQUEANTE) 🔴

Sin esto, nada del resto rankea. Es infra + higiene técnica.

1. **Dominio canónico.** `myalquiler.com` pasa a ser el **sitio de marketing real** (raíz limpia = la landing + todo el contenido). El producto queda en `admin.` (panel) y `app.` (inquilino). Requiere: DNS (apuntar myalquiler.com → el servicio de marketing) + Railway custom domain. **Un solo dominio de marca para SEO** (evitar dispersar autoridad entre admin/app/root).
2. **Indexabilidad.** `robots.txt` real que:
   - **Permite** Googlebot, Google-Extended (AI Overviews/Gemini), GPTBot + ChatGPT-User, PerplexityBot, ClaudeBot + anthropic-ai, Bingbot.
   - **Bloquea** rutas de app (`/contratos`, `/pagos`, `/panel`, `/login`, etc.) que ya son noindex.
   - **Nunca** bloquea el marketing. Bloquear solo CCBot (training-only) si se quiere.
   - Quitar `noindex` de las páginas de marketing.
3. **`metadataBase` → `https://myalquiler.com`** (hoy apunta a admin) + canonical correcto en cada página + OG.
4. **`sitemap.xml`** dinámico (Next: `app/sitemap.ts`) con todas las páginas de marketing.
5. **Schema JSON-LD base:** `Organization` + `SoftwareApplication`/`Product` en la home; `FAQPage` en las FAQ; `BreadcrumbList` en las páginas internas. (Usar la skill `schema`.)
6. **Machine-readable para agentes de IA:** `/llms.txt` (qué es My Alquiler, para quién, links clave) + `/pricing.md` (planes parseables — cuando haya precio real). Los agentes que "compran" software filtran lo que no pueden leer.

**Entregable Fase 0:** myalquiler.com sirviendo la landing en raíz, indexable, con robots/sitemap/schema/llms. Verificar en Google Search Console (alta del dominio + envío de sitemap).

---

## FASE 1 — Motor de contenido (semanas 3-12): acá se gana el #1 🟣

El #1 se construye con **topical authority**: cubrir TODO el universo de queries del rubro, no una landing. Priorizar los formatos que más se citan (comparación 33%, guías 15%, research 12%). Cada página con estructura extractable (ver Fase 3).

**Universo de queries a cubrir (fan-out de Google + prompts de IA):**
- Categoría: "software gestión de alquileres", "sistema administración inmobiliaria argentina", "programa para administrar alquileres", "software para inmobiliarias".
- Problema: "cómo cobrar alquileres sin perseguir", "cómo hacer la rendición a propietarios", "cómo administrar propiedades en alquiler".
- Legal/técnico: "ajuste ICL alquiler cómo se calcula", "punitorios/mora de alquiler", "ley de alquileres 2026 inmobiliarias", "garantía de alquiler".
- Comparativas: "[competidor] alternativa/opiniones", "mejor software de alquileres argentina".
- IA-específicas: "cuál es el mejor software de gestión de alquileres en Argentina", "app para que el inquilino pague el alquiler".

**Qué construir (orden de impacto):**
1. **Páginas de comparación** (mayor % de citas + alta intención): `My Alquiler vs Barreeo`, `vs mialquiler.ar`, `vs Excel/planilla`, `vs [otros AR]`, y `Alternativas a [competidor]`. Tablas comparativas honestas (nuestros 3 diferenciadores: plata en vivo, app del inquilino, red de profesionales). Usar la skill `competitors`.
2. **Herramientas gratis (engineering as marketing)** — rankean, captan leads y se citan: **calculadora de ajuste ICL/ICP**, **calculadora de mora/punitorios**, **generador de recibo de alquiler**, **modelo de contrato de alquiler**. Cada una = página indexable + CTA a registro. Usar la skill `free-tools`.
3. **Guías definitivas** (blog/recursos): "Cómo hacer la rendición a propietarios paso a paso", "Cómo aplicar el ajuste ICL a un contrato", "Cómo administrar un consorcio/PH", "Guía de cobranza de alquileres para inmobiliarias". Cada guía cubre su fan-out de sub-preguntas. Usar `content-strategy` + `copywriting`.
4. **Glosario / definiciones** (imán de "qué es X" en IA): rendición, ICL, expensas, punitorios, depósito en custodia, comisión, etc. — definition blocks de 40-60 palabras.
5. **Programmatic SEO** por ciudad y caso de uso: "gestión de alquileres en Córdoba / Rosario / CABA / Mendoza / …" + "software para administrar [PH / locales comerciales / …]". Usar la skill `programmatic-seo` (con cuidado: valor real por página, no thin content).
6. **Research propio** (a los 3-6 meses, cuando haya volumen de datos real): "El estado de la cobranza de alquileres en Argentina 2026" con data agregada y anonimizada de la plataforma → **datos originales = imán de citas + backlinks de medios**. (Regla del dueño: solo datos reales y verificables, nunca inventados.)

---

## FASE 2 — Autoridad y presencia (continuo): dónde mira la IA 🌐

Los modelos citan **más las fuentes de terceros (6.5x) que tu propio dominio**. Hay que estar donde miran.

- **Backlinks de alta autoridad + relevancia local:** activar los convenios **CPI Córdoba / CUCICBA / Edifica** para conseguir menciones/links desde los sitios de los colegios y cámaras. Es tu activo más fuerte y hoy no genera un solo link.
- **Comunidades:** participación auténtica (no spam) en Reddit AR, grupos de Facebook de inmobiliarias/martilleros, foros del rubro. Responder con profundidad donde se pregunta "qué sistema usan".
- **Directorios / review sites:** listar en Capterra / GetApp / SoftwareAdvice (tienen presencia LATAM) + directorios de software AR. Perfil completo + pedir reseñas **reales** a los clientes de la beta.
- **YouTube:** tutoriales ("cómo hacer la rendición", "cómo cobrar sin perseguir") — Google AI Overviews cita YouTube con frecuencia.
- **Prensa del rubro:** notas/guest posts en medios inmobiliarios AR (Reporte Inmobiliario, etc.).
- **Google Business Profile:** alta y optimización ("hecho en Córdoba") — Google lo prioriza para AI Search local.

---

## FASE 3 — AI-SEO transversal (aplica a TODA página) 🤖

Estructura extractable + señales de autoridad (Princeton GEO: citar fuentes +40%, stats +37%, quotes +30%):
- **Answer block de 40-60 palabras** al inicio de cada sección (respuesta directa, autocontenida).
- **FAQ con `FAQPage` schema** en cada página relevante.
- **Tablas comparativas** para queries "X vs Y" (ganan a la prosa).
- **Stats con fuente y fecha** (usar datos reales de la plataforma cuando haya volumen; nunca inventar).
- **E-E-A-T:** autor con nombre + credenciales, "Última actualización: fecha" visible, tono experto, sourcing transparente.
- **HTML semántico + accesibilidad** (los agentes leen el accessibility tree): `<main>/<article>/<nav>`, jerarquía de headings, `alt`, render sin JS pesado. (La landing ya arrancó bien acá — el fix del Reveal 08/07 evita secciones invisibles.)
- **NO:** keyword stuffing (-10%), contenido "para IA" separado (riesgo de spam policy de Google), gatear el contenido bueno.

---

## Medición (KPIs)

| Métrica | Cómo | Meta |
|---|---|---|
| Citation rate en ChatGPT / Perplexity / AI Overviews | Check manual mensual de 20 queries clave (o Otterly/Peec al escalar) | Aparecer en top queries de categoría |
| Share of AI voice vs competidores | Mismo check | Superar a Barreeo/mialquiler.ar |
| Tráfico orgánico + páginas indexadas | Google Search Console (post Fase 0) | Crecimiento MoM |
| Registros desde orgánico | Analytics (PostHog ya está) → evento signup con source | Canal de adquisición #1 a 12m |
| Backlinks / dominios referentes | Ahrefs/Semrush | Colegios + directorios + medios |

---

## Priorización y secuencia

1. **Fase 0 (fundación)** — bloqueante, semanas 1-2. Sin esto nada rankea. Decisión pendiente del owner: **DNS de myalquiler.com** + **precio real** (para /pricing.md y las páginas).
2. **Quick wins de contenido** — comparativas + calculadora ICL (alta intención, rápido de citar).
3. **Guías + glosario + programmatic** — construir topical authority.
4. **Autoridad/presencia** (backlinks colegios, directorios, comunidades) — continuo desde el día 1.
5. **Research propio** — a los 3-6 meses, cuando haya datos.

## Reglas del dueño (LOCKED)
- **Cero métricas/reseñas fabricadas.** Datos reales y verificables, participación auténtica. Un número inflado o una reseña trucha destruye la confianza (y a la larga, el SEO).

## Ejecución
El agente `.claude/agents/landing` puede ejecutar Fase 0 (robots/sitemap/schema/llms + dominio) y las páginas de contenido, apoyándose en las skills `schema`, `competitors`, `free-tools`, `content-strategy`, `programmatic-seo`, `copywriting`, `seo-audit`.
