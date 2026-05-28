# 🕵️ Auditoría UX — Panel inmobiliaria · V2 (navegación real)

> **Persona:** Roberto Tapia, dueño de Inmobiliaria del Sol. Administra ~6 contratos activos con un equipo de 5 (operadores, contador externo, asistente). Entra al panel varias veces por día: a la mañana para ver qué resolver, durante el día para validar pagos y atender reclamos, al cierre para rendir a propietarios. Ya conoce el panel — esta es una re-visita, busca fricciones finas que le hagan perder tiempo.

> **Configuración:**
> - PLATAFORMA: My Alquiler — panel inmobiliaria (`apps/inmobiliaria`)
> - URL: http://localhost:3001 (navegación real con Claude Preview)
> - Stack: Next.js 14 App Router + React + Tailwind + shadcn/ui
> - Método: **navegación real** (método 1) — recorrí Dashboard, Propietarios (lista + quick-view + ficha completa), Renovaciones, Configuración (Empresa + Equipo y permisos)
> - Idioma: español rioplatense
> - **Nota:** esta es la 2ª pasada sobre la inmobiliaria. La 1ª (reporte `REPORTE-AUDITORIA-UX.md`, hallazgos R-01..R-11) ya está aplicada. Este reporte NO repite esos; busca lo que quedó o apareció después.

---

## 1. Resumen ejecutivo

### Falso positivo verificado y descartado
Durante el recorrido vi el nombre comercial **"Inmo Persiste OK"** en Configuración → me olió a dato de QA filtrado. Antes de reportarlo, **verifiqué el código**: `empresa-storage.ts:24` tiene el default correcto `"Inmobiliaria del Sol"`. El "Inmo Persiste OK" estaba en el **localStorage del navegador** (residuo de un test de persistencia anterior), no en el producto. Lo removí. **No es un bug.** Lo dejo documentado para que no se reporte como tal en el futuro.

### Sensación general
El panel **se siente maduro y cuidado**. Después de los 11 fixes R-*, la operación central (dashboard "Para resolver hoy", validar pagos, propietarios, renovaciones con Negociador IA, equipo con permisos) fluye bien. Los hallazgos de esta pasada son de **pulido**, no de bloqueo — ninguno es Crítico. Eso es buena señal: la app está en estado sólido. Lo que más suma ahora son detalles de consistencia (un FAB que tapa botones, labels que no coinciden con la landing, un doble buscador).

### Las 5 fricciones que más sangran (de esta pasada)

1. **`[I2-01]` El FAB "Reportar" tapa CTAs de las cards.** En Renovaciones, el botón flotante "Reportar" (abajo-derecha) se superpone con "Generar mensaje WhatsApp" de la card de renovación. Roberto va a tocar Reportar cuando quería mandar el WhatsApp de la propuesta.
2. **`[I2-02]` Doble buscador en Propietarios.** Hay un "Buscar…" global en el header Y un "Buscar por nombre, CUIT o email" en la sección. Dos campos de búsqueda visibles a la vez — Roberto duda cuál usa.
3. **`[I2-03]` Filtro "Todas (3)" sin contexto.** El selector del header dice "Todas (3)" pero no aclara de qué son las 3 (¿sociedades? ¿sucursales?). En una pantalla con 5 propietarios, el "(3)" confunde.
4. **`[I2-04]` Naming de permisos inconsistente con la landing.** La app usa "Carga limitada"; la landing y la FAQ dicen "Carga". El comprador que leyó la landing y entra al panel ve un nombre distinto.
5. **`[I2-05]` Badge inconsistente en cards de propietario.** 4 cards muestran "Por rendir" (estado) y 1 muestra "1 unidad" (cantidad) en el mismo slot — semánticas distintas en el mismo lugar visual.

---

## 2. Diario del usuario

> "Entro al panel. Sé moverme, pero veamos qué me hace ruido hoy."

**Dashboard.** "Buenas noches, Roberto. Tu cartera al día." Arriba, "PARA RESOLVER HOY · 16 acciones" con 5 bloques (Reclamos sin asignar, Inquilinos atrasados, Propietario sin CBU, Pagos a validar, Propietarios por rendir). Esto es **exactamente** lo que necesito a la mañana — un inbox de pendientes priorizado. Abajo, KPIs de plata (Cobrado / Por cobrar / En mora / A rendir), operación, gráfico de cobro de 4 semanas y agenda de 14 días. **Muy bueno, no toco nada.** ✓

**Propietarios.** 4 KPIs arriba (5 propietarios, a rendir, sin rendir, sin CBU). Bien. Pero veo **dos buscadores**: el "Buscar…" del header global y el "Buscar por nombre, CUIT o email" de la sección. ¿Cuál uso? *(`I2-02`)* Y arriba un filtro "Todas (3)" — ¿3 qué? Tengo 5 propietarios. *(`I2-03`)*

Las cards de propietario están buenas: avatar, CUIT, contacto, "a rendir este mes" con comisión, WhatsApp + Rendir. Federico sin CBU muestra "Falta CBU para transferir" y deshabilita Rendir — **buen freno preventivo** ✓. Pero noto que Martín Bravo muestra "1 unidad" donde los otros muestran "Por rendir" — el mismo lugar dice cosas distintas. *(`I2-05`)*

**Quick-view de Eduardo Castro.** Toco la card y se abre un modal con todo: stats, WhatsApp/Llamar, "Cobra en: castro.eduardo.cuenta", propiedades, rendiciones (empty state perfecto: "Cuando le rindas el primer mes va a aparecer acá con el comprobante" ✓), notas internas. Dos cosas: "NETO HISTÓRICO —" (un guión, ¿es $0 o sin datos?) *(`I2-06`)* y "Cobra en: castro.eduardo.cuenta" no dice si es CBU o alias *(`I2-07`)*.

**Ficha completa.** "Abrir ficha completa" me lleva a `/propietarios/own_001`. Excelente: KPIs (propiedad, bruto, a rendir, ingreso anual), datos bancarios, propiedades (Gorriti 4521 · **Mariela Sosa** · Alquilada — me gusta que el inquilino sea el mismo del otro lado), ARCA conectado, cobranza directa configurada. **Ficha sólida.** ✓

**Renovaciones.** Esta pantalla es una joya: Negociador IA me dice que si cierro todas las renovaciones con la propuesta sugerida, sumo $773.000/mes. La card de Juan Pérez tiene aumento sugerido 21%, prob. renovación 98%, y botones "Negociar en chat" + "Generar mensaje WhatsApp". **Pero el FAB 'Reportar' flotante tapa el botón de WhatsApp** — voy a tocar Reportar sin querer. *(`I2-01`)*

**Configuración.** Tabs: Empresa, Sociedades, Equipo y permisos, Plan y facturas, Convenios, Invitar colegas, Mercado, Auditoría. En Empresa veo el nombre "Inmo Persiste OK" — *(me huele a testing; lo verifico después en código → era localStorage residual, no bug)*. En Equipo y permisos: 5 personas con roles (Admin, Operador, Solo lectura, Carga limitada), admin propio protegido (no me puedo borrar), PIN de seguridad. **Bien armado.** Pero el rol "Carga limitada" — en la landing decía "Carga". *(`I2-04`)* Y "Contador externo" figura como nombre de la persona, cuando es un rol — debería ser el nombre real. *(`I2-08`)*

**Veredicto:** "El panel está sólido. No me frené en nada grave. Lo que me haría la vida más fácil: que el botón flotante no me tape los CTAs, un solo buscador, y que los nombres de permisos sean los mismos que vi cuando me vendieron el producto."

---

## 3. Tabla priorizada — Matriz impacto × esfuerzo

| ID | Problema | Severidad | Esfuerzo | Quick win? |
|---|---|---|---|---|
| I2-01 | FAB "Reportar" tapa CTAs de las cards | Alta | Bajo | ✅ |
| I2-02 | Doble buscador en Propietarios (global + sección) | Media | Bajo | ✅ |
| I2-03 | Filtro "Todas (3)" sin contexto de qué son las 3 | Media | Bajo | ✅ |
| I2-04 | "Carga limitada" (app) vs "Carga" (landing/FAQ) | Media | Bajo | ✅ |
| I2-05 | Badge inconsistente: "Por rendir" vs "1 unidad" | Media | Bajo | ✅ |
| I2-06 | "NETO HISTÓRICO —" ambiguo en quick-view | Baja | Bajo | ✅ |
| I2-07 | "Cobra en" sin tipo de cuenta (CBU/alias/CVU) | Baja | Bajo | ✅ |
| I2-08 | "Contador externo" como nombre de persona (demo data) | Baja | Bajo | ✅ |

---

## 4. Hallazgos detallados

### [I2-01] [UI/Fricción] — El FAB "Reportar" tapa los CTAs de las cards
📍 **Ubicación:** FAB flotante global (abajo-derecha) presente en todas las secciones; choque visible en `/renovaciones` con el botón "Generar mensaje WhatsApp" de cada card de renovación.
👀 **Qué vi:** El botón flotante violeta "✦ Reportar" (abajo-derecha, fixed) se superpone con el botón "Generar mensaje WhatsApp" de la card de Juan Pérez. El texto del botón de la card queda parcialmente tapado ("Generar mensaje Wh…").
😖 **Por qué molesta:** Roberto quiere mandar la propuesta de renovación por WhatsApp y el FAB le interpone "Reportar". Toca el equivocado → abre el reporte de bug en vez de mandar el mensaje. Pasa en cualquier sección donde haya CTAs en la esquina inferior derecha de una card al final del scroll.
🔥 **Severidad:** Alta
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Tres opciones:
- (a) Agregar `padding-bottom` al contenedor de contenido para que el FAB nunca solape el último CTA.
- (b) Que el FAB se oculte/encoja al hacer scroll hasta el fondo (cuando hay CTAs cerca).
- (c) Mover el FAB "Reportar" a un lugar que no compita (ej. dentro del menú de usuario, o un botón en el header). Si "Reportar" es para feedback de la demo, podría vivir junto al banner demo.

---

### [I2-02] [Navegación/Claridad] — Doble buscador en Propietarios
📍 **Ubicación:** `/propietarios` — header global ("Buscar…") + buscador de sección ("Buscar por nombre, CUIT o email")
👀 **Qué vi:** Dos campos de búsqueda visibles simultáneamente: uno en la barra superior global, otro dentro de la sección de Propietarios.
😖 **Por qué molesta:** Roberto no sabe cuál usar ni si buscan lo mismo. El global probablemente busca en todo el panel; el de sección filtra propietarios. Pero no es evidente — genera una micro-duda cada vez.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Dos caminos:
- (a) Si el buscador global ya cubre propietarios, quitar el de sección (o viceversa).
- (b) Si ambos tienen sentido, diferenciarlos con placeholder explícito: global = "Buscar en todo el panel…", sección = "Filtrar estos propietarios…".

---

### [I2-03] [Microcopy] — Filtro "Todas (3)" sin contexto
📍 **Ubicación:** Header global, selector "🌐 Todas (3) ▾" (visible en Propietarios y otras secciones)
👀 **Qué vi:** El selector dice "Todas (3)" sin etiqueta de qué agrupa. En una pantalla con 5 propietarios, el "(3)" no se relaciona con nada visible.
😖 **Por qué molesta:** Roberto no sabe qué filtra. Probablemente son sociedades/sucursales (vi un tab "Sociedades" en Configuración), pero el label desnudo "Todas (3)" no lo dice. Pierde su función si nadie entiende qué selecciona.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Etiquetar el selector: "Sociedad: Todas (3)" o un ícono + tooltip "Filtrar por sociedad". Si es sucursal, "Sucursal: Todas (3)".

---

### [I2-04] [Consistencia] — "Carga limitada" (app) vs "Carga" (landing/FAQ)
📍 **Ubicación:** `/configuracion` → Equipo y permisos (rol "Carga limitada" de Camila Acosta) vs `landing-data.json` FAQ ("Carga (alta de datos sin facultad de aprobación)")
👀 **Qué vi:** La app llama al rol "Carga limitada". La landing y la FAQ lo llaman "Carga".
😖 **Por qué molesta:** El comprador leyó "cuatro niveles: Administrador, Operador, Carga, Sólo lectura" en la landing. Al entrar al panel ve "Carga limitada". Pequeña inconsistencia que erosiona la sensación de producto coherente.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Unificar a un solo nombre en ambas superficies. Sugerencia: "Carga" (más corto) en los dos lados, o "Carga limitada" en los dos. Lo importante es que coincidan.

---

### [I2-05] [UI/Consistencia] — Badge inconsistente en cards de propietario
📍 **Ubicación:** `/propietarios` — badge superior-derecho de cada card
👀 **Qué vi:** 4 cards muestran "📅 Por rendir" (estado de rendición); Martín Bravo (con $0 a rendir) muestra "1 unidad" (cantidad de propiedades) en el mismo slot.
😖 **Por qué molesta:** El mismo lugar visual comunica dos cosas distintas (estado vs cantidad). Roberto escanea las cards esperando ver el estado de rendición de cada una; en Martín ve "1 unidad" y tiene que recalibrar qué significa ese badge.
🔥 **Severidad:** Media
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Mantener el badge para una sola dimensión (estado de rendición). Para Martín (sin nada por rendir), usar un estado coherente: "Al día" o "Sin pendientes" en vez de "1 unidad". La cantidad de unidades puede ir en el cuerpo de la card, no en el badge de estado.

---

### [I2-06] [Microcopy] — "NETO HISTÓRICO —" ambiguo
📍 **Ubicación:** Modal quick-view de propietario → stat "NETO HISTÓRICO"
👀 **Qué vi:** Para un propietario sin rendiciones, el stat muestra "—" (un guión).
😖 **Por qué molesta:** "—" es ambiguo: ¿es $0, sin datos, o no aplica? Roberto duda si es un propietario nuevo o un error de carga.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Reemplazar "—" por "$0" (si es cero real) o "Sin rendiciones aún" (coherente con el empty state de la sección Rendiciones que ya dice eso bien).

---

### [I2-07] [Microcopy] — "Cobra en" sin tipo de cuenta
📍 **Ubicación:** Modal quick-view de propietario → "Cobra en: castro.eduardo.cuenta"
👀 **Qué vi:** Se muestra el destino de cobro ("castro.eduardo.cuenta") sin aclarar si es CBU, alias o CVU.
😖 **Por qué molesta:** Roberto rinde plata a esa cuenta. Saber si es alias o CBU importa para verificar antes de transferir. La ficha completa sí lo etiqueta ("CBU / Alias"); el quick-view no.
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Etiquetar en el quick-view igual que en la ficha: "Cobra en (alias): castro.eduardo.cuenta" o "CBU/Alias: …".

---

### [I2-08] [Demo data] — "Contador externo" como nombre de persona
📍 **Ubicación:** `/configuracion` → Equipo y permisos → miembro "Contador externo · martin.contador@gmail.com"
👀 **Qué vi:** En la lista de equipo, un miembro figura con nombre "Contador externo" (que es su rol/función) en vez de su nombre real.
😖 **Por qué molesta:** Es data de demo, pero en una pantalla que se muestra a prospectos, usar un rol como nombre se ve descuidado. Lo demás del equipo tiene nombres reales (Roberto Tapia, Luciana Vidal, etc.).
🔥 **Severidad:** Baja
🔧 **Esfuerzo:** Bajo
✅ **Recomendación:** Cambiar el mock a un nombre real con su rol aparte: "Martín Gómez" + rol "Solo lectura" + una etiqueta opcional "Contador externo". Es mock data — un cambio de string.

---

## 5. Recomendaciones

### 🟢 Quick wins (esta semana — ~2h total)

| # | Fix | Archivo aprox. | Tiempo |
|---|---|---|---|
| 1 | FAB "Reportar" no tape CTAs (padding-bottom o auto-hide) | layout/FAB global inmobiliaria | 30min |
| 2 | Resolver doble buscador en Propietarios | `propietarios/page.tsx` + header | 20min |
| 3 | Etiquetar filtro "Todas (3)" → "Sociedad: Todas (3)" | header global | 10min |
| 4 | Unificar "Carga limitada" ↔ "Carga" (app + landing) | permisos + `landing-data.json` | 15min |
| 5 | Badge propietario sin pendientes → "Al día" (no "1 unidad") | `propietarios/page.tsx` | 15min |
| 6 | "NETO HISTÓRICO —" → "$0" / "Sin rendiciones aún" | quick-view propietario | 10min |
| 7 | "Cobra en" con tipo de cuenta en quick-view | quick-view propietario | 10min |
| 8 | "Contador externo" → nombre real en mock de equipo | mock equipo | 5min |

**Total:** ~2h. Ninguno es crítico — la app está madura. Estos son detalles de pulido que suben la sensación de "producto terminado".

### 🔵 Mejoras estratégicas
Ninguna mayor detectada en esta pasada. La arquitectura de la app inmobiliaria es sólida tras los fixes R-*. Si se quisiera profundizar:
- **Auditar la pestaña "Auditoría"** (historial inmutable) en detalle — no pude abrirla en esta pasada por fricción del preview con el componente de tabs; vale una revisión dedicada porque es feature estrella de la landing.
- **Secciones secundarias** (Consorcios, Anuncios, Mercado, Convenios, Roadmap) no se recorrieron a fondo — candidatas para una pasada futura enfocada en estados vacíos y propósito claro.

---

> **Cierre:**
> La app inmobiliaria está en **estado sólido**. Tras los 11 fixes de la 1ª auditoría, esta 2ª pasada (con navegación real) no encontró nada crítico — 1 hallazgo Alta (el FAB que tapa CTAs) y 7 de pulido. Eso habla bien de la madurez del panel.
> El aprendizaje metodológico de esta pasada: **verificar el código antes de reportar**. "Inmo Persiste OK" parecía un bug evidente, pero era localStorage residual de un test — el producto está bien. Reportarlo habría sido un falso positivo.
