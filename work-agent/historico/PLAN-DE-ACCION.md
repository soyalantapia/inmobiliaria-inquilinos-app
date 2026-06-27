# 🗺️ Plan de acción — My Alquiler

> Consolidado de todo lo auditado (17 reportes: UX landing/inmobiliaria/inquilino/
> público, design-review, QA preciso/exhaustivo, walkthrough Jorge). Es el **único
> lugar desde donde decidir** qué sigue. Cada ítem trae impacto, esfuerzo, riesgo
> y de qué depende. Lo que ya está hecho NO está acá.
>
> Fecha: 2026-06-03 · Estado repo: limpio, todo deployado (último `d5a67b0`).

---

## TL;DR — la foto

- El producto **pasa el QA técnico** (49 páginas, 0 overflow real, 0 bugs nuevos en el exhaustivo).
- Los golpes que quedan son **de confianza y de copy**, no de que "esté roto".
- Hay **1 crítico de UX abierto** (flujo del garante, P-04) que conviene no dejar pasar.
- Todo lo de abajo es front/UX **sin tocar backend** (tu indicación: no arrancar el back todavía).

---

## 🎯 Las decisiones, en 4 tracks

Podés elegir uno, varios, o el orden. Mi recomendación de orden está al final.

### Track A — Cerrar las fricciones de Jorge (el inquilino que paga) ⭐ recomendado
El recorrido emocional del inquilino real. Alto impacto en adopción, bajo riesgo, **cero material tuyo, cero backend**.

| ID | Qué | Impacto | Esfuerzo | Riesgo |
|----|-----|---------|----------|--------|
| **J2** | Desglose del monto en el **home** ("$480.000 + $24.882 intereses por atraso") en vez del "$596.882" rojo a secas | 🟠 Alto — es donde más cerca estuvo de abandonar | Bajo (el cálculo ya existe en checkout, traerlo al home) | Bajo |
| **J5** | Suavizar "Regularizar" → "Ponerte al día" / "Pagar lo atrasado" | 🟡 Medio — deja de sonar acusatorio | Muy bajo (copy) | Bajo |
| **J3** | El tour de 9 pasos deja de ser un **muro**: botón discreto en vez de taparle el home al entrar | 🟡 Medio | Bajo | Bajo |
| **J4** | Confirmar/alargar la sesión para que no pida OTP cada vez (paga 1×/mes) | 🟢 Bajo | Bajo | Bajo |

### Track B — Arreglar el flujo del garante (tiene un 🔴 abierto)
Detectado en el audit público y **nunca cerrado**. Un garante entra por su link y no entiende qué se espera de él.

| ID | Qué | Impacto | Esfuerzo | Riesgo |
|----|-----|---------|----------|--------|
| **P-04** | El garante no tiene **CTA claro** (Aceptar / Rechazar / Firmar). Aterriza y no sabe qué hacer | 🔴 **Crítico** | Medio | Bajo-Medio (define qué *puede* hacer un garante sin backend — puede ser "Confirmar mis datos" + contacto, sin firma legal real) |
| **P-08** | No se siente identificado: falta "Hola Diego · Sos garante del contrato de Mariela" | 🟠 Alto | Medio | Bajo |
| **P-06** | El monto $480k aparece arriba sin enmarcar como **cobertura del garante** | 🔵 Bajo | Bajo | Bajo |

### Track C — Pulido fino (inmobiliaria + inquilino)
Cosmético, rápido, descarga deuda menor de los audits. Bajo impacto individual, suma prolijidad.

| ID | Qué | Impacto | Esfuerzo | Riesgo |
|----|-----|---------|----------|--------|
| INM-1 | Badge de propietario sin pendientes → "Al día" (hoy dice "1 unidad", confunde estado con cantidad) | 🔵 Bajo | ~15min | Bajo |
| INM-2 | "—" ambiguo en propietario sin CBU/datos → texto claro ("Sin CBU cargado") | 🔵 Bajo | Bajo | Bajo |
| DRI-01 | Touch targets <44px en acciones secundarias de `/comprobantes`, `/servicios`, `/contrato` (menús ⋮, links de fila) | 🔵 Bajo | Medio (varias páginas) | Bajo |

### Track D — Landing rumbo a ads (lo que es código, sin material)
La parte de la landing que puedo avanzar **sin pedirte nada**. El resto (Track E) depende de vos.

| ID | Qué | Impacto | Esfuerzo | Riesgo |
|----|-----|---------|----------|--------|
| **L-DEEP-LINK-01** | Banner "Llegaste desde la landing" al aterrizar en el demo desde una feature-card (hoy caés sin contexto) | 🟡 Medio | Bajo | Bajo |
| INSTR-01 | Instrumentar clicks de los CTAs (hero, float, pricing, WhatsApp) + scroll depth, para saber qué convierte | 🟡 Medio (decisión informada futura) | Medio | Bajo |

---

## 🔒 Track E — Depende de vos (material o decisión), no lo puedo hacer solo

| ID | Qué | Qué necesito de vos |
|----|-----|---------------------|
| L-SOCIAL-01 | Testimoniales reales (nombre + foto + inmobiliaria), franja de logos | 2-3 testimonios reales. El *hook* en la landing ya está listo, solo falta el contenido |
| L-DEMO-01 | Demo visible: screenshot real del dashboard en el hero + GIF + video tour 60-90s | Material visual / grabación, o tu OK para que arme un screencast del demo |
| DR-02 | "De-slop" de marca: display font, íconos en vez de ~46 emojis, hero con producto real | Decisión de identidad de marca (es rediseño, no parche — necesita tu OK) |
| **Backend real** | Hoy todo es mock/localStorage (auth, OTP, persistencia, OCR/IA del comprobante). Es el salto a producto de verdad | Decisión de arquitectura + presupuesto. **Tu indicación vigente: no arrancar el back todavía** |

---

## 🧭 Mi recomendación de orden

1. **Track A** (Jorge) — máximo impacto en que un inquilino real adopte la app, riesgo casi nulo. Empieza por **J2**.
2. **Track B** (garante) — cierra el único 🔴 de UX que queda abierto.
3. **Track C + D** — barrido de prolijidad + el deep-link de la landing, todo en un pase.
4. **Track E** — cuando tengas el material / decidas marca / quieras hablar de backend.

> Regla que se mantiene: propongo y aplico fixes en código + los dejo deployados, pero **no corro migraciones, no toco datos productivos, ni arranco el backend** sin que lo confirmes acá.
