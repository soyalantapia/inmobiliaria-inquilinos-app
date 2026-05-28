# 🕵️ REPORTE DE AUDITORÍA UX — My Alquiler · Flujos Públicos

> **Auditor:** múltiples personas externas (no usuarios de la plataforma):
> - **Diego Fernández**, 45, contador. Garante del alquiler de su sobrino.
> - **Sergio Almeida**, 38, plomero. Profesional de confianza de la inmobiliaria.
> - **Otra inmobiliaria**, evaluando alquilar a un nuevo inquilino — verificando su certificado.
>
> **Producto:** rutas PÚBLICAS de `apps/inquilino` que **no requieren login**:
> - `/garantes/[token]` — link al garante
> - `/p/[token]` — link al profesional
> - `/verificar/[hash]` — verificación pública de certificado de inquilino
>
> **Versión auditada:** main `5189bc7` (28/05/2026) — deploy live.
> **Método:** navegación real en `http://localhost:3000` a 375px (mobile preset).
> **Alcance:** primera impresión de **gente externa** que recibe un link por WhatsApp/email. Si la app les rompe la confianza, abandonan.
> **Aclaración:** auditorías previas en `REPORTE-AUDITORIA-UX.md` (admin/Roberto) y `REPORTE-AUDITORIA-UX-INQUILINO.md` (Mariela).

---

## 1. Resumen ejecutivo

**Las 3 fricciones que más sangran:**

1. 🔴 **`/verificar/[hash]` redirige a /login** — la ruta pública para que OTRAS INMOS verifiquen el certificado de un inquilino está bloqueada por el `AuthProvider` (`RUTAS_PUBLICAS = ['/login', '/garantes', '/p']` — falta `/verificar`). Si una inmo recibe el link de Mariela para evaluarla, **termina en login**. Caso de uso enterrado.
2. 🔴 **Diego garante no sabe qué tiene que hacer** — abre el link, ve los datos del contrato, pero no le dice si tiene que ACEPTAR, FIRMAR o si es sólo informativo. Le falta el "para qué".
3. 🟠 **Diego garante recibe info que no le corresponde** — el bloque "TU GARANTÍA · cobertura SUMA · podés darla de baja" se le muestra como si fuera dueño de la cobertura. La cobertura es contratada por la inmo, no por el garante.

**Sensación general:**
> *"Estos flujos públicos son la CARA EXTERNA de My Alquiler. Si Diego abre el link y siente que 'no entiende qué quieren', o si la inmo nueva ve un /login y abandona la verificación, el producto pierde confianza con gente que ni siquiera era usuaria todavía. La base está (los links existen, la info se renderiza), pero faltan los 3 toques que convierten 'link informativo' en 'experiencia profesional'."*

---

## 2. Diario del usuario (narrativa)

### Diego (garante) recibe el link por WhatsApp

> *"Mi sobrino me manda el link. Lo abro."*

Veo arriba: 🛡️ "Vista compartida · sólo lectura · Estado del contrato · Compartido por Mariela Sosa · link vigente hasta 27/05/2031". **OK, entiendo que es algo que Mariela me compartió y que no puedo modificar nada.** Buen comienzo.

Bajo y veo todos los datos del contrato: dirección Gorriti 4521 3°B, inmobiliaria del Sol, Activo, alquiler $480.000, "Te quedan 2 años y 3 meses". *Espera, **¿"te quedan"?** Yo no soy Mariela, yo soy el garante.* El copy me confunde.

Sigo: DATOS DEL CONTRATO con período "01/09/2025 → 31/08/2028" — formato técnico, hubiera preferido "1 sep 2025 → 31 ago 2028" o "Hasta 31 ago 2028". Más abajo TU GARANTÍA con info de la cobertura SUMA, póliza, monto $14.4M. *Esperá, ¿esta es MI garantía? Yo no contraté SUMA, yo soy el garante personal del contrato.* Luego dice "Si necesitás dar de baja la garantía o cambiarla, contactá directamente con la inmobiliaria". Doble confusión: yo no contraté nada, ¿por qué me dicen que la puedo dar de baja?

CTA al pie "¿Dudas sobre el contrato?" + botón "Contactar inmobiliaria". ¿Cómo los contacto? ¿WhatsApp? ¿llamar? ¿email? No me dice.

**Lo más importante: la página NO me dice QUÉ TENGO QUE HACER.** Yo abrí el link porque mi sobrino dijo "necesito que seas garante". ¿Tengo que aceptar acá? ¿Tengo que ir a la inmobiliaria a firmar? ¿Es sólo informativo? **Le mando WhatsApp a mi sobrino: "loco, vi el link, ¿pero qué hago ahora?".**

---

### Sergio (plomero) recibe link de la inmo

> *"Roberto me dijo que me iba a mandar un link para que vea los reclamos asignados."*

Abro el link. Veo:
- "Hola Sergio 👋"
- "Sin trabajos asignados · Cuando la inmobiliaria te asigne un trabajo, va a aparecer acá."
- "¿Dudas? Llamá a la inmobiliaria al +54 11 4532-1100. Tu link es único y solo lo podés ver vos."

**OK, entendí que esta es mi vista personal.** Pero no veo ningún logo "My Alquiler" ni explicación de qué es esta plataforma. Si fuera la primera vez, no sabría que My Alquiler es un producto. ¿Es un email? ¿Es web app? ¿Lo puedo bookmarkear?

Tampoco me dice cómo funcionan los trabajos cuando aparecen: ¿voy a coordinar yo con el inquilino? ¿Llamo? ¿El inquilino me llama?

---

### Otra inmobiliaria verifica el certificado de Mariela

> *"Mariela aplicó para un departamento mío. Me pasó un link 'soyalantapia.github.io/.../verificar/Z3FP-3OOB-SSUY' diciendo que es su certificado de buen inquilino."*

Click. **Voy a `/login` directo.** Esto es absurdo: yo no tengo cuenta en My Alquiler, soy OTRA inmo. Cierro la tab y le digo a Mariela "el link no funciona". Probable pérdida del cliente.

**Causa raíz:** `AuthProvider` redirige cualquier ruta no listada en `RUTAS_PUBLICAS = ['/login', '/garantes', '/p']` al login. Falta `/verificar`.

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | ¿Quick win? |
|---|---|---|---|---|
| **P-11** | `/verificar/[hash]` redirige a /login (falta en RUTAS_PUBLICAS) | 🔴 Crítica | Bajo | ✅ |
| **P-04** | Garante no sabe qué hacer (sin CTA Aceptar/Rechazar/Firmar) | 🔴 Crítica | Medio | — |
| **P-03** | Garante ve "TU GARANTÍA · podés darla de baja" que no le corresponde | 🟠 Alta | Bajo | ✅ |
| **P-08** | Garante no se siente identificado (sin "Hola Diego" ni "Sos garante de…") | 🟠 Alta | Medio | — |
| **P-02** | "Te quedan 2 años y 3 meses" en POV de inquilino — confunde al garante | 🟡 Media | Bajo | ✅ |
| **P-01** | Fechas técnicas "01/09/2025" (no `formatFechaCorta`) | 🟡 Media | Bajo | ✅ |
| **P-07** | CTA "Contactar inmobiliaria" sin método (WhatsApp / Llamar / Email) | 🟡 Media | Bajo | ✅ |
| **P-09** | /p/[token] no explica qué es la plataforma para profesionales primera vez | 🟡 Media | Bajo | ✅ |
| **P-10** | /p/[token] sin brand "My Alquiler" arriba | 🟡 Media | Bajo | ✅ |
| **P-05** | Footer de /garantes cortado "My Alquiler · vista para garante · Con…" | 🔵 Baja | Bajo | ✅ |
| **P-06** | Monto del alquiler $480k arriba sin enmarcar como cobertura del garante | 🔵 Baja | Bajo | — |

---

## 4. Hallazgos detallados

```
[#P-11] [Funcional/Crítico] — /verificar/[hash] redirige a /login
📍 Ubicación:     apps/inquilino/src/components/auth-provider.tsx:7
👀 Qué vi:        Una inmo externa abre el link de verificación del certificado de Mariela y cae en la pantalla de login. Cierra la tab.
😖 Por qué molesta: La ruta /verificar/[hash] está pensada para ser ABIERTA por terceros sin cuenta. Bloquearla con login destruye el caso de uso entero. Mariela pierde la posibilidad de ser "certificada" ante una nueva inmo y la nueva inmo no se entera siquiera.
🔥 Severidad:     Crítica
🔧 Esfuerzo:      Bajo (1 línea de código)
✅ Recomendación: Agregar '/verificar' a RUTAS_PUBLICAS en auth-provider.tsx:
  const RUTAS_PUBLICAS = ['/login', '/garantes', '/p', '/verificar'];
```

```
[#P-04] [UX/Crítico] — Garante no sabe qué hacer (sin CTA Aceptar/Rechazar/Firmar)
📍 Ubicación:     /garantes/[token]
👀 Qué vi:        La pantalla muestra todos los datos del contrato bien, pero solo tiene un CTA al pie "Contactar inmobiliaria". No hay botón "Acepto ser garante", "Rechazo", "Firmar", ni explicación de cuál es el siguiente paso.
😖 Por qué molesta: Diego abre el link porque su sobrino le dijo "vas a tener que aceptar/firmar". La pantalla es 100% lectura. Sin un CTA o un texto explicativo "Esto es informativo, el proceso de firma sigue en la inmobiliaria física" o "Para aceptar ser garante, tocá acá", el garante queda en limbo.
🔥 Severidad:     Crítica (por bloqueo del JTBD)
🔧 Esfuerzo:      Medio
✅ Recomendación: Agregar un bloque arriba "¿Qué hacés acá?" con copy claro según el estado del contrato:
  - Si el contrato es BORRADOR/Pendiente: "Mariela te eligió como garante. Revisá los datos y si estás de acuerdo, [Aceptar ser garante]."
  - Si el contrato YA está activo: "Esto es informativo. Mariela quiere que conozcas los términos del alquiler que firmó con la inmobiliaria del Sol."
```

```
[#P-03] [Copy/POV] — Garante ve info de cobertura SUMA como si fuera suya
📍 Ubicación:     /garantes/[token] → sección "TU GARANTÍA"
👀 Qué vi:        Bloque con título "TU GARANTÍA" + info de cobertura SUMA (tipo, póliza, vigencia, monto $14.4M) + texto: "Si necesitás dar de baja la garantía o cambiarla, contactá directamente con la inmobiliaria".
😖 Por qué molesta: Diego es GARANTE PERSONAL del contrato. La cobertura SUMA es un producto que contrata la inmobiliaria o el inquilino. El título "TU GARANTÍA" + "podés darla de baja" sugiere que Diego contrató SUMA — confuso y posiblemente intimidante (¿estoy en un compromiso que no firmé?).
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Cambiar título a "Garantía del contrato" (no "TU") y reescribir el subtexto:
  "Este contrato tiene cobertura digital SUMA por $14.4M. Esta cobertura la gestiona la inmobiliaria — vos no tenés que hacer nada al respecto."
  + Si Diego es el garante personal, podría haber otra sección "VOS COMO GARANTE" explicando QUÉ COBRE (su responsabilidad).
```

```
[#P-08] [UX/Personalización] — Garante no se siente identificado
📍 Ubicación:     /garantes/[token]
👀 Qué vi:        La página dice "Compartido por Mariela Sosa" pero no me llama por mi nombre ("Hola Diego") ni me sitúa ("Sos garante en este contrato").
😖 Por qué molesta: La pantalla se siente impersonal. Diego abre y no se reconoce. Hubiera ayudado el contexto "Hola, Diego. Mariela te eligió como garante de este contrato".
🔥 Severidad:     Alta (por sensación de seriedad/profesionalismo)
🔧 Esfuerzo:      Medio (requiere asociar el token con el nombre del garante en el mock)
✅ Recomendación: Token incluye/asocia nombre del garante. Header: "Hola, [Diego] 👋 · Mariela te eligió como garante" + el resto del contenido. Si el nombre no está disponible, default a "Hola 👋 · Sos garante en este contrato".
```

```
[#P-02] [Copy/POV] — "Te quedan X de contrato" desde POV de inquilino
📍 Ubicación:     /garantes/[token] → card "Alquiler actual"
👀 Qué vi:        Bajo el monto $480.000 dice "Te quedan 2 años y 3 meses de contrato". El "te" se dirige al inquilino, no al garante.
😖 Por qué molesta: Diego no es el inquilino. El copy lo trata como si lo fuera. Resta profesionalismo.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Reescribir POV neutro: "Vence el 31 ago 2028 · Faltan 2 años y 3 meses" o "Contrato hasta 31 ago 2028".
```

```
[#P-01] [Microcopy] — Fechas técnicas "01/09/2025"
📍 Ubicación:     /garantes/[token] → "Período 01/09/2025 → 31/08/2028" y "Próximo ajuste 01/06/2026"
👀 Qué vi:        Formato DD/MM/YYYY técnico. Inconsistente con otras pantallas del inquilino que ya usan formatFechaCorta ("1 sep 2025").
😖 Por qué molesta: Polish. Y al estar en una pantalla que ve gente externa, suma a la percepción de "se ve técnico/improvisado".
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Reemplazar `formatFecha` por `formatFechaCorta` en garantes/[token]/page.tsx.
```

```
[#P-07] [UX/Acción ambigua] — CTA "Contactar inmobiliaria" sin método
📍 Ubicación:     /garantes/[token] → footer del bloque "¿Dudas sobre el contrato?"
👀 Qué vi:        Un solo botón "Contactar inmobiliaria". Al tocar, no se sabe si abre email, WhatsApp, teléfono.
😖 Por qué molesta: Diego puede dudar si lo va a llamar el sistema, si va a abrir su cliente de email, o si va a una página de chat. Falta especificidad.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Dos botones explícitos: "💬 WhatsApp" + "📞 Llamar" con teléfono visible al lado: "+54 11 4532-1100". Consistente con la card del home del inquilino.
```

```
[#P-09] [Onboarding] — /p/[token] no explica qué es la plataforma
📍 Ubicación:     /p/[token]
👀 Qué vi:        "Hola Sergio 👋 · Sin trabajos asignados · Cuando la inmobiliaria te asigne un trabajo, va a aparecer acá."
😖 Por qué molesta: Sergio recibe el link por primera vez. No sabe qué es My Alquiler, ni cómo va a recibir los trabajos (notificación? email? sólo si entra al link?), ni si tiene que cargar nada (ej, su CBU para cobrar).
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Agregar un mini-onboarding inline en el empty state:
  "Cuando la inmobiliaria te asigne un trabajo (electricidad, plomería, etc.) aparece acá. Te avisamos por WhatsApp. Vas a poder ver: dirección, qué hacer, contacto del inquilino, y subir factura cuando termines."
```

```
[#P-10] [Brand] — /p/[token] sin "My Alquiler" arriba
📍 Ubicación:     /p/[token]
👀 Qué vi:        La pantalla empieza con "Hola Sergio 👋" sin ningún logo ni brand de My Alquiler.
😖 Por qué molesta: Sergio puede pensar que es una webapp custom de la inmobiliaria. Si quiere bookmarkear, no sabe qué nombre poner. Profesionalmente luce menos.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Agregar un mini-header arriba con el logo "My" + "My Alquiler" pequeño y un tagline "Vista para profesionales · [Nombre de la inmobiliaria]".
```

```
[#P-05] [UI/Polish] — Footer cortado en /garantes
📍 Ubicación:     /garantes/[token] → footer
👀 Qué vi:        "My Alquiler · vista para garante · Con…" cortado con elipsis.
😖 Por qué molesta: Probablemente debería decir "Con tecnología de My Alquiler" o similar. Quedó truncado. Polish.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: Revisar el copy completo del footer y dejarlo en 1 línea o 2 con wrap natural. Posible: "My Alquiler · vista para garante · No requiere cuenta".
```

```
[#P-06] [UI/Contexto] — Monto del alquiler $480k arriba sin contexto para el garante
📍 Ubicación:     /garantes/[token] → card "Alquiler actual"
👀 Qué vi:        El monto $480.000 grande en negro sin marco que diga "Esta es tu cobertura potencial como garante".
😖 Por qué molesta: Diego ve el número y puede pensar "ufff, $480k por mes". Pero no se enmarca claramente como su responsabilidad (cuánto cubriría si Mariela no paga). Falta el "para qué te importa este monto a vos".
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: Subtítulo bajo el monto: "Este es el alquiler que garantizás si firmaste como garante personal" o, según el caso, "Cubierto por SUMA, vos no tenés responsabilidad económica".
```

---

## 5. Recomendaciones

### Quick wins (hacer YA — todos < 1h)

1. **#P-11** (CRÍTICO): agregar `/verificar` a `RUTAS_PUBLICAS` en `auth-provider.tsx`. **2 min.**
2. **#P-03**: cambiar "TU GARANTÍA" → "Garantía del contrato" + texto: "Esta cobertura la gestiona la inmobiliaria — vos no tenés que hacer nada al respecto". **10 min.**
3. **#P-02**: "Te quedan X" → "Vence el [fecha] · Faltan X". **5 min.**
4. **#P-01**: `formatFecha` → `formatFechaCorta` en /garantes/[token]/page.tsx. **5 min.**
5. **#P-07**: 2 botones "💬 WhatsApp" + "📞 Llamar" con teléfono explícito. **15 min.**
6. **#P-09**: agregar empty state explicativo en /p/[token]. **15 min.**
7. **#P-10**: mini header con logo + brand en /p/[token]. **10 min.**
8. **#P-05**: revisar/completar footer cortado en /garantes. **5 min.**

**Total estimado quick wins: ~1.5 horas. Resuelve el bug crítico + 7 quick wins.**

### Mejoras estratégicas (próximos sprints)

- **#P-04**: rediseñar /garantes/[token] con un estado contextual (BORRADOR vs ACTIVO) y CTAs accionables según el caso. Si la app va a soportar firma digital del garante en el futuro, este es el lugar.
- **#P-08**: incluir nombre del garante en el token / la URL para personalizar el saludo. Requiere ajuste de modelo de datos.

---

**Nota de cierre:** los 3 flujos públicos existen y funcionan en lo básico, pero les falta el pulido para que se sientan "primera impresión profesional". Para gente que abre estos links sin haber visto nunca My Alquiler, esa primera impresión es CRÍTICA: define si confían o no. Los quick wins arriba mueven mucho la aguja con 1.5h de trabajo total.
