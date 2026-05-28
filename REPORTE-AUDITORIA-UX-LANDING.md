# 🕵️ Auditoría UX — Landing pública `/presentacion/`

> **Persona:** Marcela, dueña de una inmobiliaria mediana en Mar del Plata. Administra ~80 propiedades con un equipo de 3 personas. Probó dos sistemas anteriores que no terminaron de cuajar. Hoy navega la landing porque le pasaron el link por WhatsApp un colega. Tiene 7 minutos antes de la próxima visita.
> Vino a tres preguntas: **(1)** ¿esto resuelve mis dolores reales? **(2)** ¿cuánto cuesta y qué incluye? **(3)** ¿quién está detrás y me da confianza?

> **Configuración:**
> - PLATAFORMA: My Alquiler — landing pública (`/presentacion/`) que vende el sistema a inmobiliarias y administradores.
> - URL: `https://soyalantapia.github.io/inmobiliaria-inquilinos-app/presentacion/` · build estático desde `scripts/landing-data.json` + `scripts/landing.template.html` + `scripts/build-landing.js`
> - Stack: HTML estático generado por Node (sin React) · CSS-in-HTML con design tokens · vanilla JS para drawer + scroll spy + reveals
> - Método: análisis estático + simulación (el preview tool no podía cross-origin; recorrí leyendo `out/presentacion/index.html` 3.133 líneas + tokens + JS)
> - Idioma: español rioplatense

---

## 1. Resumen ejecutivo

Las **5 fricciones que más sangran**, por orden de impacto:

1. **`[L-PRICE-01]` "Probar 30 días gratis" es promesa rota.** El botón estrella de pricing va al demo público de la app — no hay trial, no hay registro, no hay cuenta. Marcela toca, llega a un login OTP que pide email, y si avanza ve datos mock. Sensación: "me estafaron con el copy".
2. **`[L-FOOTER-01]` Footer vacío (literal `<p></p>`).** Sin Términos, sin Privacidad, sin razón social, sin contacto. Para una SaaS que factura electrónicamente con ARCA y maneja datos sensibles, el footer ausente grita "amateur" o "no es serio todavía". Mata la confianza justo cuando la persona decidió leer.
3. **`[L-SOCIAL-01]` Cero pruebas sociales en toda la landing.** "Lo que reportan las inmobiliarias" promete testimonios y entrega 3 números inventados (12hs, 0, 100%) sin nombre, sin foto, sin caso. Ningún logo de cliente. La sección IMPACTO sin un solo nombre real es peor que no tenerla — sugiere que no hay clientes.
4. **`[L-CTA-01]` Cuatro variantes del MISMO botón principal en una sola página.** Hero dice "Acceder al panel inmobiliario", float CTA dice "Probar la demo", pricing dice "Probar 30 días gratis", CTA final dice "Acceder al panel inmobiliario". Marcela ve cuatro botones y duda cuál es "el bueno".
5. **`[L-NAV-LABEL]` "App propietario" en navbar miente.** El link va a `/inmobiliaria/` — la app del operador/inmobiliaria, no del propietario (el dueño del inmueble es OTRO rol). Inconsistencia agravada porque el hero llama "panel inmobiliario" y el drawer mobile "App del Propietario" al mismo destino. La audiencia se confunde sobre qué app es para quién.

**Sensación general del recorrido:**
La landing **se ve cuidada** — diseño moderno, gradient hero, mockup decorativo con KPIs, 8 secciones de features detalladas, FAQ extensa. Pero al recorrerla como compradora hay dos brechas serias: **(a) falta validación social** (no hay testimonios, logos, números reales, equipo); **(b) los CTAs prometen cosas que el producto no entrega** ("30 días gratis" sin trial real, "Hablar con un asesor" abre un cliente de mail). La sensación final es **"linda pero todavía no es real"** — exactamente lo opuesto a lo que necesita una inmobiliaria que va a migrar 80 contratos.

---

## 2. Diario del usuario

> "Me pasaron el link por WhatsApp. Abro en el celular primero — me espera la propietaria del 3°B en 10 min."

**0:00 — Hero.** Bien, "Tu cartera, tu equipo y tu inquilino en una sola plataforma". Entiendo. Hay dos botones grandes: "Acceder al panel inmobiliario" y "Acceder a la app del inquilino". Espero, ¿"Acceder"? No tengo cuenta. ¿Es demo o tengo que registrarme primero? *(`L-CTA-COPY`)* Y ¿por qué hay dos botones igual de grandes? Yo soy la inmobiliaria, ¿el de inquilino para qué? *(`L-HERO-CTA`)*

**0:30 — Toco "Acceder al panel inmobiliario".** Me lleva a un login que pide email. Vuelvo atrás. No es lo que esperaba — esperaba un video, una demo guiada, o al menos un screenshot real. *(`L-DEMO-01`)*

**0:45 — Sigo bajando.** "10 min para poner tu cartera en operación" — me llama la atención. "1 toque para conciliar pagos" — interesante. "250 propiedades en la versión inicial" — espera, ¿250 *de toda la base*? Eso es chiquito. ¿Y "versión inicial" no implica que están empezando? Si tienen 250 propiedades en total, ¿van a aguantar? *(`L-STATS-01`)*

**1:00 — "Los problemas reales del día a día".** Esta sección la leo entera. ✓ Información dispersa. ✓ Comprobantes que se pierden. ✓ Renovaciones tarde. ✓ Consultas fuera de horario. ✓ Cálculo manual. ✓ Nadie se acuerda quién hizo qué. **Acertaron con todo.** Excelente. *(✓)*

**1:40 — "Antes y después de My Alquiler".** Más de lo mismo de "el problema". Ya entendí. Se siente redundante. *(`L-COMPARE-01`)*

**2:00 — "Implementación en tres etapas".** OK, 01 configurás, 02 operás, 03 cobrás. Bien. Pero, ¿cuánto demora la migración real? ¿Quién carga mis 80 contratos? ¿Tienen importador de planilla? No dice. *(`L-FAQ-MISSING`)*

**2:30 — "Cobranza ordenada".** 4 features. "Aprobación en un movimiento" me gusta. Cada feature tiene un link "Ver pagos pendientes" — toco. Me lleva al panel demo, llego a un screen mock sin contexto. Vuelvo. *(`L-DEEP-LINK-01`)*

**3:00 — "Facturación electrónica integrada".** "Emisión automática al aprobar" — esto sí me interesa. ARCA es un dolor. ¿Pero tiene certificación oficial? ¿Cómo manejan claves fiscales — están guardadas seguras? *(`L-TRUST-01`)*

**3:40 — Sigo bajando.** Contratos, propietarios, reclamos, equipo, app inquilino, reportes. 8 secciones × 4 features = **32 cards de feature.** Empiezo a saltarlas. *(`L-FEATURE-OVERLOAD`)*

**5:00 — "Conexiones con tus herramientas habituales".** ARCA, WhatsApp, MP, Bancos, Índice oficial, Correo. Bien. ¿Pero son integraciones reales o "vamos a integrar"? Sólo dicen "Galicia, Santander, Macro, BBVA y más" — no dice CÓMO se integra. *(`L-INTEGRATIONS-01`)*

**5:30 — "Precios".** $50k / $100k / $200k / $350k según cartera. Voy al "Más elegido" $100k para hasta 50 propiedades. **Pero yo tengo 80** — entonces voy a Pro $200k. ¿Cómo me suscribo a Pro? **No hay botón "Empezar con Pro".** Hay un botón genérico abajo: "Probar 30 días gratis". Toco — me lleva al demo (mismo que el hero). ¿Esto qué tiene que ver con elegir Pro? *(`L-PRICE-02`)*

**6:00 — "Hablar con un asesor".** Toco — me abre **el cliente de mail**. ¿En serio? Estoy en el celular. No quiero abrir el mail. Quería WhatsApp o un form. *(`L-CONTACT-01`)*

**6:30 — FAQ.** 8 preguntas: cobranza, ARCA, contratos sólo expensas, reversión de pago, permisos, índice, conexión ARCA, seguridad de datos. **Pero ninguna sobre lo que YO me pregunto:** ¿hay contrato mínimo? ¿qué pasa con mis datos si me voy? ¿quién hace la migración? ¿soporte por WhatsApp con qué tiempo de respuesta? ¿hay onboarding en vivo? *(`L-FAQ-MISSING`)*

**7:00 — Changelog.** "v4 Doble modalidad de cobranza... 2026-05-13. v3 Aprobación de contratos... 2026-05-13. v2 Modalidades flexibles... 2026-05-13." **Las tres versiones tienen la MISMA fecha.** ¿Es real esto o es contenido de fachada? *(`L-CHANGELOG-01`)* Además: "Carga descentralizada con aprobación **dla** inmobiliaria" — typo. *(`L-CHANGELOG-02`)*

**7:30 — Impacto.** "El impacto el primer mes — Lo que reportan las inmobiliarias después de adoptar la plataforma" + 3 números: 12hs, 0, 100%. **¿Qué inmobiliarias?** Sin un nombre, sin un caso, sin una foto. Si tuvieran testimonios reales, los pondrían. *(`L-SOCIAL-01`)*

**8:00 — CTA final.** "Conocé la plataforma en cinco minutos" + los mismos 2 botones del hero. Y abajo... el footer está vacío. **Sin nada.** No hay Términos. No hay razón social. No hay teléfono. No hay dirección. No hay sociales. *(`L-FOOTER-01`)*

**Veredicto en voz alta:** "Pinta bien. Pero no sé quién está detrás, no veo otras inmobiliarias usándolo, los botones me llevan al mismo demo cuatro veces, y el botón 'asesor' me abre el mail. Mando un WhatsApp al colega: '¿lo usa alguien que conozcas?'"

---

## 3. Tabla priorizada — Matriz impacto × esfuerzo

| ID            | Problema                                                                    | Severidad | Esfuerzo | Quick win? |
|---------------|-----------------------------------------------------------------------------|-----------|----------|------------|
| L-FOOTER-01   | Footer literalmente vacío — sin legales/contacto                            | Crítica   | Bajo     | ✅          |
| L-PRICE-01    | "Probar 30 días gratis" es claim falso (no hay trial)                       | Crítica   | Bajo     | ✅          |
| L-CHANGELOG-02| Typo "dla inmobiliaria" en v3                                                | Alta      | Bajo     | ✅          |
| L-NAV-LABEL   | "App propietario" en navbar va a /inmobiliaria/ — naming roto              | Alta      | Bajo     | ✅          |
| L-CTA-01      | 4 variantes del mismo CTA con copys distintos                                | Alta      | Bajo     | ✅          |
| L-CTA-COPY    | "Acceder al panel" sugiere cuenta existente — debería ser "Ver demo"        | Alta      | Bajo     | ✅          |
| L-CONTACT-01  | "Hablar con un asesor" = mailto — fricción muerta en mobile                  | Alta      | Bajo     | ✅          |
| L-CHANGELOG-01| 3 releases mismo día sospecha de contenido inventado                         | Alta      | Bajo     | ✅          |
| L-PRICE-02    | Tramos sin botón "Empezar con [plan]" — no se puede elegir                   | Alta      | Medio    |            |
| L-FAQ-MISSING | Faltan FAQs del comprador (contrato, datos, onboarding, soporte)            | Alta      | Bajo     | ✅          |
| L-SOCIAL-01   | Cero testimonios/logos/casos — sección Impacto sin nombres                  | Crítica   | Alto     |            |
| L-HERO-CTA    | Dos CTAs igualados en hero confunden audiencia (comprador es inmobiliaria)  | Alta      | Bajo     | ✅          |
| L-DEMO-01     | No hay video / screenshot / GIF real del producto                            | Alta      | Alto     |            |
| L-STATS-01    | "250 propiedades en la versión inicial" suena chico y prematuro              | Media     | Bajo     | ✅          |
| L-FEATURE-OVERLOAD | 32 feature cards — overload de información                              | Media     | Medio    |            |
| L-COMPARE-01  | "Antes/después" repite contenido de "Problema"                              | Media     | Bajo     | ✅          |
| L-DEEP-LINK-01| Links profundos al demo (ej. "/pagos") sin contexto del visitante           | Media     | Medio    |            |
| L-NAV-CHANGES | "Cambios" como link de nav — jerga interna                                  | Baja      | Bajo     | ✅          |
| L-INTEGRATIONS-01 | "Galicia, Santander, Macro... y más" sin decir CÓMO se integra          | Media     | Medio    |            |
| L-TRUST-01    | ARCA mencionado pero sin certificación visible / cómo se guarda la clave    | Media     | Medio    |            |
| L-IMPACTO-COPY| Impacto promete testimonios y entrega números sin respaldo                  | Alta      | Bajo     | ✅          |

---

## 4. Hallazgos detallados

### [L-FOOTER-01] [Confianza/Legales] — Footer literalmente vacío
📍 **Ubicación:** Fin de la landing — `out/presentacion/index.html:2967-2971`
👀 **Qué vi:** `<footer><div><p></p></div></footer>`. Cero contenido. Cero links. Cero razón social. Cero contacto.
😖 **Por qué molesta:** Para una SaaS B2B que toca facturación electrónica oficial (ARCA), maneja datos bancarios y promete almacenar historial inmutable, la ausencia de footer legal grita "amateur" en el último momento del scroll — justo cuando la persona decidió interesarse. Marcela quiere ver "¿quiénes son? ¿con qué CUIT facturan? ¿qué dicen los Términos? ¿tienen dirección física?".
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Footer mínimo viable con 4 columnas + bottom bar:
```
Producto: Funcionalidades · Precios · Cambios · App inquilino
Empresa: Quiénes somos · Contacto · Blog (si hay) · WhatsApp ventas
Legales: Términos · Privacidad · Política de datos · Aviso ARCA
Bottom: "© 2026 [Razón Social] · CUIT XX · Hecho en Argentina"
```
Aunque no haya páginas reales aún, poner los links mata-stub (página simple "en preparación") es 10x mejor que vacío.

---

### [L-PRICE-01] [Microcopy/Conversión] — "Probar 30 días gratis" es promesa rota
📍 **Ubicación:** `out/presentacion/index.html:2805-2812` (sección Precios)
👀 **Qué vi:** El botón estrella debajo de los 4 tramos dice "🚀 Probar 30 días gratis" y va a `../inmobiliaria/`. Pero no hay trial real — `/inmobiliaria/` es un demo navegable con datos mock, sin registro ni cuenta. No hay backend para cobrar después de 30 días.
😖 **Por qué molesta:** El claim "30 días gratis" tiene precio en LATAM: implica que (a) hay una forma de registrarme, (b) el sistema me toma datos reales por 30 días y después cobra. Marcela toca, llega a un login OTP genérico, intenta avanzar y se da cuenta que es demo. **Sensación de engaño en el copy clave de conversión.**
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar a un copy honesto que coincida con lo que entrega el botón:
- Opción A (si la demo es lo que hay): "Probá la demo en vivo" o "Recorrer el panel demo →"
- Opción B (si después hay un form de contacto para iniciar trial real): "Pedir trial de 30 días" → form embebido, no mailto.
Y si querés mantener "30 días gratis" como gancho, montá el trial real con un form simple que dispare onboarding humano.

---

### [L-CHANGELOG-02] [Microcopy] — Typo "dla inmobiliaria"
📍 **Ubicación:** `landing-data.json:510` (changelog v3) → `out/presentacion/index.html:2894`
👀 **Qué vi:** "Carga descentralizada con aprobación **dla** inmobiliaria previa a la activación".
😖 **Por qué molesta:** Un typo en changelog es como un manchón de café en el currículum. Marcela está evaluando si confiar 80 contratos — un typo en la página de venta dice "no hubo nadie cuidando esto antes de publicar".
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo (1 char)
✅ **Recomendación:** `dla` → `de la` en `landing-data.json:510`.

---

### [L-NAV-LABEL] [Naming/Consistencia] — "App propietario" en navbar va a /inmobiliaria/
📍 **Ubicación:** Navbar desktop `index.html:2132-2134`; drawer mobile `index.html:2165-2167`
👀 **Qué vi:** Tres labels distintos para EL MISMO destino (`../inmobiliaria/`):
- Navbar desktop: "App propietario →"
- Drawer mobile: "🏢 App del Propietario"
- Hero CTA: "🏢 Acceder al panel inmobiliario"
- CTA final: "🏢 Acceder al panel inmobiliario"
- Float CTA: "🏢 Probar la demo"
- Pricing CTA: "🚀 Probar 30 días gratis"
😖 **Por qué molesta:** El "propietario" en este negocio es el **dueño del inmueble** (cliente de la inmobiliaria) — un rol completamente distinto del "operador de la inmobiliaria". Llamarle "App propietario" al panel de la inmobiliaria es naming roto, pero peor: ese mismo botón en otro lugar se llama "panel inmobiliario", "demo", "30 días gratis", "App del Propietario". Marcela no sabe si son 5 botones distintos o el mismo.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Unificar a **un solo label** consistente en las 5 ubicaciones. Sugerencia:
- Botón "comprador serio" (hero + nav + CTA final): **"Ver panel inmobiliario en vivo"** o **"Recorrer demo del panel"**
- Float CTA (sticky pequeño): **"Probar demo"**
- Nunca llamarlo "App propietario" — esa palabra es para el dueño del inmueble.

---

### [L-CTA-01] [UI/Consistencia] — 4 variantes del mismo CTA en una sola página
📍 **Ubicación:** Hero, navbar, float, pricing, CTA final (todos `../inmobiliaria/`)
👀 **Qué vi:** El botón principal aparece 5 veces con 5 copys distintos (ver L-NAV-LABEL).
😖 **Por qué molesta:** Cada repetición debería REFORZAR el CTA, no diluirlo. Como los copys cambian, el ojo lee "son 5 botones distintos" y no asocia "ah, todos hacen lo mismo, ya lo entendí".
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Definir UN copy canónico por contexto:
- **Hero + CTA final:** "Recorrer panel demo →" (compromiso bajo, exploración)
- **Pricing card por plan:** "Empezar con [Starter/Growth/Pro/Enterprise]" (después de ver el precio)
- **Float sticky:** misma copy del CTA del hero ("Recorrer demo")
- **Navbar:** mismo copy

---

### [L-CTA-COPY] [Microcopy] — "Acceder al panel" sugiere cuenta existente
📍 **Ubicación:** Hero `index.html:2188-2190`, CTA final `index.html:2954-2956`
👀 **Qué vi:** "🏢 Acceder al panel inmobiliario" para un visitante frío que no tiene cuenta.
😖 **Por qué molesta:** "Acceder" en SaaS = "ya tengo cuenta, voy a loguearme". Marcela toca esperando algo distinto a lo que recibe (un login). Bounce.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Reemplazar "Acceder al panel inmobiliario" por **"Recorrer panel demo →"** o **"Ver demo navegable →"**. Honesto con lo que entrega.

---

### [L-CONTACT-01] [Fricción] — "Hablar con un asesor" = mailto
📍 **Ubicación:** Pricing `index.html:2809-2811`
👀 **Qué vi:** `<a href="mailto:hola@myalquiler.com.ar">Hablar con un asesor</a>`.
😖 **Por qué molesta:** En 2026, mailto: abre el cliente de mail del SO — fricción altísima en mobile (donde la mayoría de inmobiliarias chequea links que llegan por WhatsApp). En desktop también: si la persona usa Gmail web sin handler registrado, no pasa nada al click.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo (si hay WhatsApp Business)
✅ **Recomendación:** Reemplazar por **link de WhatsApp** (`https://wa.me/54XXXXXXXXX?text=Hola...`) o un **form embebido simple** (nombre, mail, teléfono, "¿cuántas propiedades manejás?"). El mailto debería ser fallback escondido, no botón primario.

---

### [L-CHANGELOG-01] [Confianza] — 3 releases con la misma fecha
📍 **Ubicación:** Changelog `landing-data.json:497, 508, 519` → `index.html:2876-2911`
👀 **Qué vi:** v4, v3, v2 todas con fecha **2026-05-13**.
😖 **Por qué molesta:** El propósito del changelog es mostrar **historia real** de evolución. Tres versiones el mismo día sugiere "se inventaron releases para llenar la sección". Daña credibilidad — el usuario evaluando piensa "¿esto es genuino o teatro?".
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Tres caminos:
- (a) Poner fechas reales aunque sea retroactivas con honestidad: v2 = primer mes del producto, v3 = mes 2, v4 = ahora.
- (b) Sacar el changelog hasta tener releases reales con fechas distintas.
- (c) Convertir a "Roadmap" con "Hoy / Próximo / En estudio" — más honesto si recién arrancan.

---

### [L-PRICE-02] [Conversión] — Tramos sin CTA "Empezar con [plan]"
📍 **Ubicación:** Pricing `index.html:2742-2780`
👀 **Qué vi:** 4 cards de tramo (Starter $50k, Growth $100k destacado, Pro $200k, Enterprise $350k). Cada card tiene **nombre + precio + rango**. **Sin botón.** Para "empezar" hay que bajar hasta el CTA genérico debajo que va al mismo demo sin asociar plan.
😖 **Por qué molesta:** El momento de elegir un plan es el momento de mayor intención de compra de toda la landing. Un card sin CTA pierde esa intención. Marcela mira Pro $200k (porque tiene 80 propiedades), no encuentra forma de "agarrarlo", baja, ve "Probar 30 días gratis" sin asociación al plan, duda, se va.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Medio (requiere flujo de selección — puede ser tan simple como pre-llenar un form de contacto con el plan elegido)
✅ **Recomendación:** Agregar botón en cada tramo:
- Starter/Growth/Pro: "Empezar con [plan] →" → form/WhatsApp con plan preseleccionado
- Enterprise: "Hablar con ventas" → form con campos extra (¿cuántas propiedades? ¿cuándo querés migrar?)
- Quitar el CTA genérico de abajo (o moverlo a "¿Aún tenés dudas? Hablá con nosotros")

---

### [L-FAQ-MISSING] [Conversión] — Faltan FAQs del comprador
📍 **Ubicación:** FAQ `index.html:2818-2858`
👀 **Qué vi:** 8 FAQs todas **operativas del producto** (cobranza, ARCA, contratos sólo expensas, reversión, permisos, ajuste índice, conexión ARCA, seguridad de datos).
😖 **Por qué molesta:** Las dudas reales del comprador antes de firmar **no están**:
- ¿Hay contrato mínimo de permanencia?
- ¿Qué pasa con mis datos si me voy?
- ¿Quién carga mis 80 contratos? ¿Hay importador desde planilla?
- ¿Cuánto demora la migración real (no la promesa de "10 min")?
- ¿Soporte por WhatsApp con qué SLA?
- ¿Hay onboarding en vivo o sólo videos?
- ¿Puedo facturar con mi propia razón social a mis clientes (white-label)?
- ¿Cómo cancelo el plan si crece o decrece mi cartera?
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo (sumar 4-6 FAQs al JSON)
✅ **Recomendación:** Reordenar la FAQ en 2 secciones: **"Antes de contratar"** (6 nuevas) y **"Sobre la operación"** (las 8 actuales). La primera responde dudas de la persona que está evaluando comprar.

---

### [L-SOCIAL-01] [Confianza] — Cero pruebas sociales en toda la landing
📍 **Ubicación:** Sección Impacto `index.html:2916-2935` + ausencia general
👀 **Qué vi:** "El impacto el primer mes — Lo que reportan las inmobiliarias después de adoptar la plataforma" + 3 cards: "12 hs menos", "0 comprobantes perdidos", "100% facturas emitidas". **Sin un solo nombre, foto, logo, caso ni inmobiliaria identificada.** En el resto de la landing tampoco hay logos de clientes, ni testimoniales, ni equipo, ni "quiénes somos".
😖 **Por qué molesta:** Es la peor combinación: prometer "lo que reportan las inmobiliarias" y no mostrar ni una sola inmobiliaria. Lee como datos inventados. **Si tuvieran clientes reales, los pondrían.** Esa ausencia es el mayor freno de conversión B2B SaaS.
🔥 **Severidad:** Crítica
🔧 **Esfuerzo:** Alto (requiere conseguir testimoniales reales con permiso)
✅ **Recomendación:** Estrategia escalonada:
- **MVP inmediato:** sacar la sección Impacto hasta tener un testimonio real. Es peor con números inventados que sin sección.
- **Mes 1-2:** conseguir 1-2 testimoniales reales con nombre + inmobiliaria + foto + 1 frase corta. Va arriba del fold de Precios.
- **Mes 3+:** logos de inmobiliarias clientes en franja "+30 inmobiliarias en Argentina usan My Alquiler".
- Mientras tanto, agregar sección **"Quiénes somos"** con foto del equipo, ubicación, contacto directo. Mejor "humano que arranca" que "robot anónimo".

---

### [L-HERO-CTA] [Estrategia/UX] — Dos CTAs igualados en hero diluyen el mensaje
📍 **Ubicación:** Hero `index.html:2187-2194`
👀 **Qué vi:** Dos botones xl lado a lado: "🏢 Acceder al panel inmobiliario" + "📱 Acceder a la app del inquilino".
😖 **Por qué molesta:** La landing va dirigida a **inmobiliarias** (la audiencia que compra y paga). El CTA "app inquilino" en hero atomiza el mensaje y confunde — el inquilino del cliente de Marcela no debería ser el destinatario del hero CTA. Marcela ve "para qué me ponen el botón del inquilino, yo soy la inmobiliaria".
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Hero CTA debe ser **uno solo primary** ("Recorrer panel demo →"). El CTA inquilino mover a un link secundario tipo `<a>Si sos inquilino, entrá acá →</a>` debajo del badge row, o a la sección "App para el inquilino" más abajo (ahí sí es contexto coherente).

---

### [L-DEMO-01] [Conversión] — No hay video / screenshot real del producto
📍 **Ubicación:** Toda la landing
👀 **Qué vi:** El hero tiene un mockup **decorativo** (4 cards de KPIs sintéticas: "$4.820.000 cobrado", "7 pagos por validar", etc.) pero no es un screenshot real. Tampoco hay GIF, ni video de 60s, ni demo guiado embebido.
😖 **Por qué molesta:** Marcela evaluando un SaaS necesita ver **cómo se ve en uso**. Sin video, sin screenshots reales, debe tocar el botón del demo y "descubrir" el producto por sí misma — fricción altísima.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Alto (requiere grabar/montar)
✅ **Recomendación:** Tres entregables:
- **Hero:** reemplazar el mockup decorativo por **un screenshot real del dashboard** con datos representativos (puede tener datos demo).
- **Después del problema:** GIF de 8-12 segundos mostrando "el inquilino paga → la inmo aprueba → ARCA emite → propietario recibe".
- **Antes de pricing:** video embebido de 60-90s con tour guiado (puede ser screencast + voz, no producción de Hollywood).

---

### [L-STATS-01] [Microcopy] — "250 propiedades en la versión inicial" suena prematuro
📍 **Ubicación:** Stats `index.html:2273-2275`
👀 **Qué vi:** Card stat con "250" + "Propiedades en la versión inicial".
😖 **Por qué molesta:** Para una sección que pretende ser social proof, 250 es chico y "versión inicial" sugiere "están empezando". Marcela duda: si tienen 250 propiedades en total, ¿voy a meter mis 80 ahí y voy a ser el 1/3 de su base?
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Tres caminos:
- (a) Quitar el stat hasta que el número sea más grande (mejor 3 stats sólidos que 4 con uno débil).
- (b) Cambiar la métrica a algo más fuerte: "$X cobrados en marzo", "X transacciones procesadas", "+10 inmobiliarias activas".
- (c) Si el número es producto-feature: "250 propiedades soportadas en cualquier plan" (cambia el frame de "tenemos pocas" a "soportamos hasta esto").

---

### [L-FEATURE-OVERLOAD] [UX/Densidad] — 32 feature cards = overload
📍 **Ubicación:** 8 secciones × 4 features `index.html:2429-2691`
👀 **Qué vi:** Cobranza, Facturación, Contratos, Propietarios, Reclamos, Equipo, App inquilino, Reportes — cada una con 4 cards detalladas.
😖 **Por qué molesta:** Un visitante real lee 10-15 features y se va. 32 cards diluye lo importante. Lo que es estratégico (ARCA, Broker IA, cobranza directa) queda igualado en peso visual con lo táctico (cuenta de cobranza directa, ficha integral).
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Comprimir a 2-3 features por sección (las 6-8 que realmente venden) y agregar un "Ver todas las funcionalidades →" link al final de cada sección que abra un modal/expand con las restantes. La página principal queda ~16 features (40-50% del scroll actual).

---

### [L-COMPARE-01] [Estructura] — "Antes/después" repite contenido de "Problema"
📍 **Ubicación:** Sección `antes-despues` `index.html:2337` después de `problema` `:2287`
👀 **Qué vi:** "Antes/Después" enumera 8 filas, varias con redundancia conceptual respecto a los 6 dolores ya descritos arriba ("Información dispersa", "comprobantes WhatsApp", "vencimientos manuales", "consultas reiteradas"...).
😖 **Por qué molesta:** Lectura redundante. Marcela tiene 7 minutos — leer dos veces lo mismo le gasta atención sin agregar valor.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Fusionar las dos secciones: cada "dolor" en la sección Problema podría tener su contrapartida "→ Cómo lo resuelve My Alquiler" inline. Una sola sección + más densa + sin duplicación.

---

### [L-DEEP-LINK-01] [Fricción] — Links profundos al demo sin contexto
📍 **Ubicación:** Cada feature card tiene un link tipo "Ver pagos pendientes" → `../inmobiliaria/pagos`
👀 **Qué vi:** Toco "Ver pagos pendientes" desde una feature card. Me lleva al demo de `/inmobiliaria/pagos` sin contexto: aterrizo en una pantalla mock sin entender por qué llegué ahí.
😖 **Por qué molesta:** El visitante no logueado llega a pantallas internas del producto sin orientación. Pierde el hilo.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Medio (requiere flag de "vengo desde landing" para mostrar un toast/banner contextual)
✅ **Recomendación:** Dos caminos:
- (a) Banner persistente en el demo: "Estás viendo la pantalla [X] del demo. Volver a la landing →"
- (b) Tooltip/spotlight contextual al aterrizar: "Esta es la pantalla [X]. Acá [explicación de 2 líneas]."
- O reemplazar los links profundos por screenshots embebidos en la propia card de feature.

---

### [L-NAV-CHANGES] [Microcopy] — "Cambios" como link de nav es jerga interna
📍 **Ubicación:** Navbar `index.html:2126`
👀 **Qué vi:** "Cómo funciona · Funcionalidades · Integraciones · Precios · Preguntas · **Cambios**".
😖 **Por qué molesta:** "Cambios" significa "changelog" para gente técnica. Para Marcela, "cambios" puede ser "¿cambios al contrato?", "¿cambios al servicio?". Y aunque entendiera changelog, ¿una inmobiliaria evaluando entra a "cambios del producto"? Es el último link del nav y el menos clickeable.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Renombrar a **"Novedades"** o eliminar del nav (puede vivir en el footer).

---

### [L-INTEGRATIONS-01] [Trust] — "Galicia, Santander, Macro... y más" sin decir CÓMO
📍 **Ubicación:** Integraciones `index.html:2694-2729`
👀 **Qué vi:** Card de "Bancos" dice "Galicia, Santander, Macro, BBVA y más" pero no aclara CÓMO se integran: ¿API directa? ¿lectura de extractos? ¿manual?
😖 **Por qué molesta:** Una "integración" puede significar 5 cosas distintas — desde "tenemos botón de Pagar con BBVA" hasta "leemos tu extracto automáticamente". Sin precisión, el comprador asume lo peor (manual) o lo mejor (todo automático) y se decepciona en ambas direcciones.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Medio
✅ **Recomendación:** Cada integración debería tener una línea concreta de tipo de integración:
- ARCA: "Conexión por API oficial (WS) — emisión y CAE en tiempo real"
- Bancos: "Lectura de extractos vía homebanking o conciliación manual asistida"
- WhatsApp: "API Business — comprobantes y notificaciones automáticas"
- MP: "Reconocimiento de pagos por número de operación"

---

### [L-TRUST-01] [Confianza] — ARCA mencionado pero sin certificación/cómo se guardan claves
📍 **Ubicación:** Sección Facturación + FAQ
👀 **Qué vi:** "Conexión con ARCA por propietario" y "Se cargan CUIT, clave fiscal, punto de venta...". Pero no aclara: ¿la clave fiscal queda guardada en sus servidores? ¿cifrada? ¿con qué standard? ¿hay auditoría?
😖 **Por qué molesta:** La clave fiscal AFIP/ARCA es **alta sensibilidad** — comprometerla es comprometer la facturación del propietario. Una inmobiliaria seria no entrega la clave fiscal sin entender exactamente cómo se guarda.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Medio (requiere copy + sección de seguridad)
✅ **Recomendación:** Sección "Seguridad y privacidad" antes del footer:
- Claves fiscales: cifradas con [estándar], nunca expuestas en logs.
- Datos bancarios: lectura sólo, nunca operación.
- Auditoría: historial inmutable.
- Backups y disponibilidad.
- Quien tiene acceso a los datos del cliente.

---

### [L-IMPACTO-COPY] [Microcopy] — Sección Impacto promete testimoniales y entrega claims
📍 **Ubicación:** `index.html:2916-2935`
👀 **Qué vi:** Título "El impacto el primer mes". Subtitle: "Lo que reportan las inmobiliarias después de adoptar la plataforma." → 3 stats anónimos.
😖 **Por qué molesta:** El subtitle promete voces de inmobiliarias reales. Los stats lo desmienten — son afirmaciones sin atribución. Es worse than nothing.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo (cambiar copy mientras se consiguen testimoniales)
✅ **Recomendación:** Mientras no haya testimoniales:
- Cambiar el subtitle: "Las métricas que diseñamos para mejorar" (cambia el frame de "reporte de clientes" a "propuesta de valor").
- O quitar la sección hasta tener al menos 1 testimonial real con nombre.

---

## 5. Recomendaciones

### 🟢 Quick wins (esta semana)

| # | Fix | Archivo | Tiempo |
|---|---|---|---|
| 1 | Footer mínimo viable con 4 columnas | `landing.template.html` + `landing-data.json` | 1h |
| 2 | Cambiar "Probar 30 días gratis" → "Recorrer panel demo" | `landing-data.json` precios.cta | 2min |
| 3 | Corregir typo "dla" → "de la" | `landing-data.json:510` | 30s |
| 4 | Unificar labels CTA en 5 ubicaciones | `landing-data.json` + template | 30min |
| 5 | "Acceder al panel" → "Recorrer panel demo →" | hero + CTA final | 5min |
| 6 | mailto: → wa.me con número real | `landing-data.json` precios.ctaSecundario | 10min |
| 7 | Diferenciar fechas changelog o quitar sección | `landing-data.json` changelog | 15min |
| 8 | Sumar 4-6 FAQs del comprador | `landing-data.json` faq.items | 30min |
| 9 | Hero: dejar 1 CTA primario + link secundario "Si sos inquilino" | hero | 15min |
| 10 | "App propietario" → "Panel inmobiliario" en navbar | template | 5min |
| 11 | "Cambios" → "Novedades" o quitar del nav | template | 2min |
| 12 | Stat "250 versión inicial" → reemplazar o quitar | `landing-data.json` stats | 5min |
| 13 | Subtitle Impacto → frame honesto sin testimoniales | `landing-data.json` | 5min |
| 14 | Comprimir Antes/Después a inline en sección Problema | template + data | 1h |

**Total estimado quick wins:** ~4-5 horas, impacto altísimo en conversión y trust.

### 🔵 Mejoras estratégicas (próximas 2-4 semanas)

1. **Pruebas sociales reales:**
   - Conseguir 2-3 testimoniales con nombre + foto + inmobiliaria
   - Franja de logos de inmobiliarias clientes
   - Sección "Quiénes somos" con equipo + ubicación

2. **Demo visible sin tocar nada:**
   - Screenshot real del dashboard en el hero (reemplazar mockup decorativo)
   - GIF de 8-12s mostrando flujo de pago end-to-end
   - Video tour de 60-90s (screencast + voz)

3. **Flujo de selección de plan:**
   - Botón "Empezar con [plan]" en cada tramo de pricing
   - Form de contacto pre-llenado con plan + tamaño de cartera

4. **Sección "Seguridad y privacidad":**
   - Cómo se guardan claves fiscales/datos bancarios
   - Auditoría, historial inmutable
   - Política de datos si te das de baja

5. **Reducir feature overload:**
   - 8 secciones × 4 features → 8 secciones × 2-3 features
   - "Ver más" expandible para detalles

6. **Trial real:**
   - Si "30 días gratis" se mantiene como promesa, montar form de solicitud + onboarding humano agendado
   - Si no, copy honesto en todo el sitio

---

> **Cierre del audit:**
> La landing **tiene fundamento fuerte**: el contenido del problema es muy bueno, las 8 secciones de feature cubren el producto, el diseño es moderno y los detalles de UX (scroll progress, sticky CTA, drawer mobile, reveal animations) están cuidados. Lo que falta es **honestidad y validación**:
> - **Honestidad** en los CTAs (no prometas "30 días gratis" si no los tenés).
> - **Validación** social (testimoniales, logos, equipo).
> - **Coherencia** de labels (un solo nombre por botón).
> - **Cierre** legal (footer no vacío).
>
> Los 14 quick wins son ~5 horas de trabajo y suben dramáticamente la sensación de "esto es real" que necesita Marcela para mandar el WhatsApp diciendo "lo probé, parece serio, agendemos demo".
