# 📋 Informe de auditoría pre-lanzamiento — My Alquiler

**Fecha:** 2026-06-18 · **Método:** navegador automatizado (Playwright) sobre producción + el panel completo en **modo demo local** (mock, sin login).

## Cobertura

| Superficie | Cómo | Estado |
|---|---|---|
| **Panel — público** (`admin.myalquiler.com`) | Producción | ✅ login, registro, precios, 404 |
| **Panel — autenticado** (14 secciones) | **Demo local** (datos mock) | ✅ Inicio, Propiedades, Propietarios, Pagos, Caja, Contratos, Aprobaciones, Renovaciones, Consorcios, Reclamos, Anuncios, Profesionales, Verificar inquilino, Configuración |
| **Inquilino** (`app.myalquiler.com`) | Producción (sesión con token vencido) | ✅ ~15 pantallas: UI, nav, gating, responsive, estados de error |

> Lo único **no** verificado: los **números reales de tu cuenta** en el panel (el demo usa datos mock; para validar tus datos en vivo haría falta tu sesión de prod, que no se pudo cargar en este entorno). El **diseño, UX, copy, flujos, colores, responsive y funcionamiento** del panel **sí** quedaron auditados vía demo.

---

## 🔎 Hallazgos (14)

### 🟠 Alta — ✅ RESUELTAS Y VERIFICADAS EN VIVO (2026-06-18 · commits `a51270e` + `f833b84`)

> **#1** Inquilino: al vencer la sesión (401) ahora **redirige a `/login?expirada=1`** limpiando token+sesión (confirmado: la home con token vencido redirige sola y deja de mostrar el error trabado). · **#2** Los **6 CTA de alta de `/precios` van a `/registro`** (las "Iniciar sesión" siguen a `/login`). · **#3** "Hablar por WhatsApp" → **`wa.me/5491154596266`**. Las tres verificadas en producción.

| # | Página | Hallazgo | Sugerencia |
|---|--------|----------|------------|
| 1 | Inquilino · toda la app | **Sesión vencida deja trabado al usuario.** Token 401 → cada pantalla con datos muestra *“No pudimos cargar… revisá tu conexión · Reintentar”* en bucle. **No re-loguea**, el mensaje **culpa a la conexión** (es la sesión), y la salida (Mi cuenta→Cerrar sesión) no está a la vista. El token vence (TTL ~15d) → **todo inquilino cae acá**. Confirmado app-wide (Inicio, Recibos, Contrato…). | Interceptar `401` → limpiar sesión → `/login`. Mínimo: botón “Volver a entrar” + no decir “revisá tu conexión” en 401. |
| 2 | Panel · `/precios` | **CTA de alta van a `/login`, no a `/registro`.** “Probar gratis”, “Empezar gratis 14 días” y los 4 “Empezar” de los planes → `/login`. Fuga de conversión. | Apuntar a `/registro`. |
| 3 | Panel · `/precios` | **“Hablar por WhatsApp” sin número** (`wa.me/?text=…`) → abre WhatsApp sin destinatario. 2 veces. | Poner el número real. |

### 🟡 Media
| # | Página | Hallazgo | Sugerencia |
|---|--------|----------|------------|
| 4 | Inquilino · nav | **El botón más prominente lleva a “Disponible pronto”.** El FAB central “Asistente” (y el item del sidebar) → `/broker` está gateado. | Atenuar/etiquetar “Pronto” hasta que exista. |
| 5 | Inquilino · `/cuenta/editar` | **Form editable NO gateado** mientras el resto sí. Riesgo: el inquilino edita su perfil, “guarda” y **no persiste** (solo localStorage, sin endpoint). | Confirmar persistencia; si no, gatear. |
| 6 | Panel · `/precios` vs auth | **Oferta inconsistente:** precios = *“gratis 14 días + −20% primeras 50”*; login/registro = *“gratis hasta el lanzamiento”*. | Unificar una sola narrativa. |
| 7 | Panel · `/precios` (footer) | **Dominio:** footer dice `myalquiler.com.ar`; el sitio es `myalquiler.com`. | Unificar dominio canónico. |
| 8 | Panel · `/propietarios` | **“Rendir” habilitado pese a “Falta CBU para transferir”** (Federico López Vega). Transferir sin CBU puede fallar. | Deshabilitar “Rendir” hasta cargar CBU. |
| 9 | Panel · `/screening` | **Privacidad / Ley 25.326.** La verificación cruza PII profunda de un tercero (redes sociales, vecinos, grupo familiar, BCRA del familiar y empleador) pero el form solo pide CUIT+nombre, **sin paso de consentimiento visible**. | Sumar consentimiento/declaración antes de verificar. |

### 🔵 Baja
| # | Página | Hallazgo |
|---|--------|----------|
| 10 | Ambas | Subtítulo del logo inconsistente (*“Software inmobiliario”* en precios vs *“Panel inmobiliaria”* en auth) + uso de emojis dispar (inquilino sí, panel no). |
| 11 | Panel · `/registro` | Ciudad/Provincia sin `autocomplete` (`address-level2/1`). |
| 12 | Panel · varias | El **FAB “Reportar”** se superpone a contenido de la card inferior derecha (Propiedades, Propietarios…). |
| 13 | Panel · `/aprobaciones` | Se muestra el **ID interno “cnt_003”** en el copy (mejor dirección/inquilino). |
| 14 | Panel · `/configuracion` | **Typo “CUICBA”** en la matrícula (la sigla correcta es **CUCICBA**, como en el badge y /precios). |

---

## ✅ Lo que está muy bien (verificado)

- **Panel — 14 secciones**: todas renderizan **sin overflow, sin NaN/undefined/fechas inválidas, consola limpia**. Diseño **premium y consistente**.
  - **Matemática financiera coherente**: ingresos del mes = suma exacta de alquileres ($3.180.000); a-rendir por propietario calculado bien (bruto − comisión), total $3.036.390 exacto.
  - **Lógica SLA de reclamos excelente**: SLA por urgencia (emergencia 6h / alta 1d / media 3d / baja 7d), “Atrasado hace Nd” vs “Resuelto en 2.2d dentro del plazo”.
  - **Screening** flagship pulido (5 fuentes, validación de dígito CUIT, informe APTO/APTO c-garantía/NO APTO, cita Ley 25.326).
  - **Aprobaciones** con PIN, **Pagos** con validación + facturación ARCA, **Configuración** con 8 secciones.
- **Inquilino**: **gating correcto** en features sin backend (calendario, profesionales, renovación, documentos, broker → “Disponible pronto”, sin forms falsos); **responsive impecable** (cero overflow desktop y mobile 390px); **estados de error prolijos sin crashes**.
- **Login/registro**: 0 errores, validaciones sólidas (aria-invalid, “Mínimo 8 caracteres”, contraseñas no coinciden). **404** de marca.
- **Login del inquilino** (OTP): limpio, split-screen consistente con el del panel. *(Nota: promociona el “Asistente IA” que está gateado → refuerza el hallazgo #4.)*
- **Páginas públicas por token** (`/verificar`, `/garantes`, `/p`): con token inválido muestran un mensaje neutro (“Certificado no disponible” / “Link vencido o inválido” / “No disponible”), **sin filtrar PII** ni romper. Privacidad OK.

---

## ⏭️ Lo único que queda

Validar los **datos reales de tu cuenta** en el panel en vivo (no el demo). Para eso necesito tu sesión de prod (extensión Claude-in-Chrome conectada, o Chrome abierto para control de pantalla). **El resto del panel —diseño, UX, copy, flujos, funcionamiento— ya quedó auditado** vía demo.

**Prioridad para el lanzamiento:** resolver los **3 de severidad Alta** (sesión vencida del inquilino, CTA de precios → registro, WhatsApp sin número). El resto son mejoras de pulido.

---

## 🔧 Resolución (2026-06-18 · commit `b5580f0`)

**✅ Resueltos (Media/Baja técnicos):**
- **#5** `/cuenta/editar` (inquilino): **gateado a "Disponible pronto"** en prod (antes guardaba solo en localStorage y mentía "le avisamos a la inmobiliaria"). En demo sigue el form local.
- **#8** Propietarios: **"Rendir" se deshabilita sin CBU/alias** (+ tooltip).
- **#11** Registro: `autocomplete` en Ciudad/Provincia.
- **#13** Aprobaciones: sacado el ID interno `cnt_003` de la descripción (seed demo).

**❌ Descartados al revisar el código:**
- **#12** El FAB "Reportar" **no se renderiza en prod** (`if (apiEnabled) return null`) — era solo demo.
- **#14** La matrícula ya dice **"CUCICBA"** correcto — fue lectura mía errónea de la captura.

**✅ Resueltos con criterio (commit `2bf57e1`):**
- **#4** Asistente IA: el value-prop del login del inquilino pasó de presente a **"muy pronto"** (está gateado en prod). El FAB queda — al tocarlo muestra "Disponible pronto", que es honesto.
- **#6** Oferta unificada: `/precios` ya **no dice "14 días"** → "Empezar gratis" / "gratis hasta el lanzamiento", consistente con login/registro y con lo que el producto da (cuenta piloto gratis hasta el lanzamiento). El "−20% primeras 50" queda (es separado).
- **#7** Dominio: footer de `/precios` → **`myalquiler.com`**.
- **#9** Screening: **checkbox de consentimiento obligatorio** (Ley 25.326) antes de "Iniciar verificación". *(El texto legal conviene revisarlo con un abogado.)*

**⏸️ / ❌ Lo que queda:**
- **Facturación (v2 Medio):** la coherencia de importes ($45k débito vs $60.500 facturas) **necesita verificarse con datos reales** — no se arregla a ciegas.
- **#10 (cosmético):** "Software inmobiliario" (landing) vs "Panel inmobiliaria" (panel) son superficies distintas → se dejó como está (no es un problema real).

---

## 🔁 Auditoría v2 — deep-dive del panel en demo (2026-06-18)

Segunda pasada **más profunda** sobre el panel (datos mock): páginas de **detalle**, **wizards** de alta y **tabs** de Configuración.

**✅ Fixes verificados en vivo (demo):**
- **#8**: Federico López Vega (sin CBU) → botón **"Rendir" deshabilitado** + tooltip. OK.
- **#13**: Aprobaciones ya no muestra `cnt_003` (ahora "Jorge Newbery 1820"). OK.
- **#14** confirmado **false**: la matrícula dice `CUCICBA 5872` (correcto) — fue lectura mía.

**🆕 Hallazgos nuevos:**
| Sev. | Página | Hallazgo |
|------|--------|----------|
| 🟡 Medio | Configuración › Plan y facturas | **Coherencia de importes:** conviven **$50.000** (plan), **$45.000** (débito automático con descuento) y **$60.500** (facturas = $50k+IVA). El $60.500 cierra, pero el descuento del débito ($45k) **no se ve reflejado** en las facturas. En una página de facturación de lanzamiento conviene que los números reconcilien sin ambigüedad. *(Verificar con datos reales.)* |
| 🔵 Bajo | Datos demo | **CUIT de la inmobiliaria inconsistente:** Configuración muestra `30-71234567-1`, el detalle de propiedad muestra `30-71234567-8`. (Solo demo; en prod viene de una fuente.) |
| 🔵 Bajo | Reclamo detalle | En un reclamo de **Plomería**, la lista "Otros" sugiere profesionales de **otros rubros** (Electricidad/Gas/A.A.) → podría llevar a asignar un oficio equivocado. |
| 🔵 Bajo | Cargar propiedad | Copy: dice *"Aceptás que esta acción modifica tu próxima factura"* pero el plan dice *"Sin cambios en tu factura"* (dentro del límite no cobra). |

**✅ Todo lo demás, sólido:** detalle de propiedad/propietario/reclamo (KPIs, tabs, timeline, SLA, profesionales por rubro con rating, clasificación quién-paga), wizards de **Cargar propiedad** (RESUMEN en vivo, validación, awareness del plan) y **Cargar contrato** (4 pasos PDF→IA→revisar→confirmar), y Configuración con 8 tabs (Empresa, Plan y facturas, etc.). **Cero overflow, cero NaN/fechas inválidas, consola limpia** en todas.
