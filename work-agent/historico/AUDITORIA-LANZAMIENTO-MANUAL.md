# 🔍 PROMPT — Auditoría manual pre-lanzamiento · My Alquiler

> **v2 — 2026-06-18.** Pegá todo lo que sigue (desde "ROL Y MISIÓN" hasta el final) en una
> sesión de Claude que **pueda controlar tu Google Chrome** (extensión Claude in Chrome
> **logueada**, o control de pantalla). Audita **las dos apps**, página por página, antes del
> lanzamiento. **Leé primero "ESTADO AL 2026-06-18"**: ya hubo una auditoría y varios fixes;
> esta pasada los verifica y busca lo nuevo.

---

## 📌 ESTADO AL 2026-06-18 — LEER PRIMERO

Este proyecto **ya tuvo una primera auditoría** (ver `INFORME-AUDITORIA-LANZAMIENTO.md`). Esta pasada **no arranca de cero**: **verificá que los fixes ya hechos sigan bien y NO los reportes de nuevo**, y poné la energía en (a) el **panel con datos reales** (lo que la primera pasada no pudo ver por falta de sesión) y (b) **cualquier hallazgo nuevo**.

**✅ Ya corregido y desplegado (verificar que siga OK, no re-reportar):**
- Inquilino: al vencer la sesión (401) **redirige a `/login?expirada=1`** (antes quedaba trabado en "No pudimos cargar tu cuenta · Reintentar").
- `/precios`: los CTA de alta van a **`/registro`**; "Hablar por WhatsApp" → **`wa.me/5491154596266`**.
- Inquilino **`/cuenta/editar`**: gateado a "Disponible pronto" en prod (antes guardaba solo en localStorage).
- Panel **`/propietarios`**: el botón **"Rendir" se deshabilita si el propietario no tiene CBU**.
- **`/registro`**: `autocomplete` en Ciudad/Provincia.

**⏸️ Decisiones de producto/negocio ABIERTAS (NO son bugs; si las ves, anotá criterio, no las marques como error):**
- El **"Asistente IA"** se promociona (FAB central del inquilino + value-prop del login) pero está "Disponible pronto".
- **Oferta inconsistente**: `/precios` dice "gratis 14 días + −20% primeras 50"; login/registro dicen "gratis hasta el lanzamiento".
- **Dominio**: el footer de `/precios` dice `myalquiler.com.ar`; el sitio vive en `myalquiler.com`.
- **Screening**: no muestra paso de **consentimiento** del tercero (Ley 25.326).

---

## ROL Y MISIÓN

Sos un **auditor senior de QA + Producto + Diseño**. Estamos por hacer el **lanzamiento oficial** de *My Alquiler* y necesito estar **100% seguro**. Tu trabajo es **tomar control de Google Chrome** y **auditar TODO el producto, pantalla por pantalla, en producción**, con ojo crítico y meticuloso.

Buscás **todo tipo de problema**:
- 🐞 **Bugs funcionales** (botones/links/forms que no hacen lo que dicen, navegación rota, estados que no se actualizan, errores en consola).
- 👁️ **Bugs visuales** (overflow, recortes, solapamientos, scroll raro, desalineación, imágenes rotas, z-index).
- 🎨 **Diseño / consistencia** (spacing, tipografía, jerarquía, componentes inconsistentes entre páginas, densidad, “slop”).
- 💬 **Comunicación / copy** (claridad, tono, ortografía/gramática, placeholders olvidados, mensajes de error inútiles, microcopy, español rioplatense “vos”, nada en inglés suelto).
- 🌈 **Color / marca** (paleta violeta consistente, contraste legible, semántica de estados verde/rojo/ámbar, nada fuera de marca).
- ⚠️ **Malas prácticas** (datos demo/mock filtrados en prod, CBU falso, info sensible expuesta, validaciones flojas, acciones destructivas sin confirmación).
- 💡 **Oportunidades de mejora** (“esto se puede hacer mejor”: fricciones, pasos de más, quick wins, features que faltan).

**NO arreglás nada.** Documentás **cada hallazgo** en un informe estructurado para resolverlo después.

---

## ⛔ REGLAS DE ORO (LEER ANTES DE TOCAR NADA)

Esto es **PRODUCCIÓN con DATOS REALES** (inmobiliaria real "Tapia Propiedades", propietarios e inquilinos reales). Romper o ensuciar datos reales es inaceptable.

1. **PROHIBIDO ejecutar acciones destructivas/irreversibles sobre datos reales:** no eliminar, no desalojar, no marcar pagos como pagados, no rendir a propietarios, no aprobar/rechazar, no archivar/desactivar contratos, no crear/editar propiedades, propietarios o contratos reales, no cambiar configuración, PIN ni contraseña.
2. **PROHIBIDO enviar comunicaciones reales:** no enviar anuncios, no mandar mensajes/WhatsApp/email a propietarios ni inquilinos, no compartir certificados/links/garantes a terceros, no iniciar screenings con datos de personas reales.
3. **Para probar formularios y validaciones:** abrí el form, completá campos, dispará las validaciones y observá los estados — pero **cancelá antes del submit final**. Si *necesitás* verificar una mutación de punta a punta, usá **solo un registro de prueba inconfundible** (ej. nombre `ZZZ PRUEBA AUDITORÍA`) y **borralo al terminar**; nunca toques registros reales.
4. **No tipear contraseñas.** Usá la sesión ya iniciada en Chrome.
5. **Documentá, no corrijas.** Tu salida es el informe.
6. Si una página tiene una acción que no podés probar sin riesgo, **anotala como “pendiente de probar en entorno seguro”** en vez de ejecutarla.

---

## ACCESO

- **Panel inmobiliario:** `https://admin.myalquiler.com` (sesión del titular ya iniciada).
- **App del inquilino:** `https://app.myalquiler.com` (sesión del inquilino de prueba ya iniciada; el login es por **código OTP al email** — si no hay sesión, documentá el flujo de login sin completarlo).
- Ambas apps en producción usan **API real** (no debería haber datos mock). **Marca = violeta.**
- El producto está en **español rioplatense** (“vos”, “tu cartera”, etc.).

### ⚠️ Cómo conectar de verdad (lecciones de la 1ª corrida)
- **Extensión "Claude in Chrome":** instalarla **NO alcanza** — hay que **iniciar sesión** en su panel lateral con tu cuenta de Anthropic para que el agente la detecte. Si `list_connected_browsers` da `[]`, es que falta el login de la extensión.
- **Control de pantalla (computer-use):** en la última corrida el sistema **no encontró "Google Chrome"** como app instalada/abierta (solo veía Safari). Asegurate de que Chrome **esté abierto** antes de pedir acceso, o decí qué navegador usás.
- **Panel sin tu sesión (plan B que funciona):** si no se puede cargar tu sesión, el panel se audita **en modo demo** — correr el dev server del panel con `NEXT_PUBLIC_API_URL` vacío ⇒ entra sin login con datos mock y se ven **las 14 secciones completas**. Cubre **diseño / UX / copy / colores / flujos / responsive** (todo **menos tus números reales**, que requieren tu sesión de prod).
- **Inquilino:** el token vence (~15 días). Si la sesión está vencida, ahora redirige solo a `/login` (re-OTP).

---

## MÉTODO — para CADA URL del inventario

1. **Navegá** a la URL y esperá la carga completa.
2. **Mirada en frío:** ¿qué impresión da en los primeros 3 segundos? ¿qué confunde? ¿la jerarquía guía bien?
3. Recorré las **11 dimensiones** (checklist abajo).
4. **Interactuá de forma segura:** hover, tabs, abrir diálogos/modales (sin confirmar), filtros, búsqueda, ordenamientos, paginación, ver estados.
5. **Responsive:** revisá en **desktop (~1440px)** y **mobile (~390px)**. Buscá scroll horizontal, recortes, touch targets chicos, nav inferior (app inquilino).
6. **Consola del navegador:** abrí DevTools y registrá **errores JS, warnings y requests fallidos (4xx/5xx)**.
7. **Screenshot** de cada hallazgo (y de cada pantalla clave).
8. **Anotá** cada hallazgo en el formato de salida.

---

## LAS 11 DIMENSIONES (revisar en cada página)

1. **Funcional** — ¿cada botón/link/form hace lo que promete? ¿navegación correcta? ¿los datos se actualizan? ¿errores en consola?
2. **Visual** — overflow, recortes, solapamientos, alineación, scroll raro, z-index, imágenes/íconos rotos, parpadeos.
3. **Diseño / consistencia** — spacing, tipografía, jerarquía, componentes consistentes entre pantallas y entre las dos apps, densidad, “slop”.
4. **Comunicación / copy** — claridad, tono, ortografía/gramática, placeholders/lorem olvidados, mensajes de error accionables, microcopy de botones, “vos” consistente, nada en inglés.
5. **Color / marca** — violeta consistente, **contraste accesible** (texto legible sobre fondo), semántica verde=éxito / rojo=error / ámbar=alerta, nada fuera de marca.
6. **Estados** — loading/skeleton, **vacío** (empty state con CTA, no pantalla en blanco), **error** (mensaje claro + reintento, sin caer a datos falsos), primer uso.
7. **Responsive** — desktop + mobile, sin scroll horizontal, targets táctiles ≥ 40px, nav inferior del inquilino.
8. **Accesibilidad** — foco visible, navegación por teclado, `alt` en imágenes, `label` en inputs, jerarquía de headings, contraste.
9. **Performance** — tiempo de carga, layout shift, spinners eternos, requests duplicados o lentos.
10. **Datos / correctitud** — ¿los números cierran? (totales, comisiones, mora, a rendir, fechas, montos), formato **moneda y fecha es-AR**, **cero datos demo/mock/CBU falso** filtrados en prod, “Disponible pronto” donde corresponda.
11. **Mejoras** — fricciones, pasos de más, oportunidades de UX, features que faltan, quick wins (“esto se puede hacer mejor”).

---

## SEVERIDAD

- 🔴 **Crítico** — bloquea el lanzamiento: rompe, pierde/expone datos, cálculo financiero incorrecto, acción destructiva sin confirmación, fuga de datos demo en prod.
- 🟠 **Alto** — funcionalidad importante rota o muy confusa; bug visual evidente en pantalla clave.
- 🟡 **Medio** — bug menor; inconsistencia de diseño o copy notable.
- 🔵 **Bajo** — detalle cosmético.
- 💡 **Mejora** — no es bug, es una oportunidad.

---

## FORMATO DE SALIDA

Un **hallazgo por fila**, agrupado por página. Para cada uno:

| ID | Severidad | App | Página (URL) | Dimensión | Título | Descripción | Pasos para reproducir | Evidencia (screenshot) | Sugerencia de arreglo |
|----|-----------|-----|--------------|-----------|--------|-------------|-----------------------|------------------------|-----------------------|

Al final, agregá:
- **Resumen ejecutivo:** conteo por severidad y por app.
- **Top 10 “sí o sí antes de lanzar”.**
- **Veredicto: 🟢 GO / 🟡 GO con reservas / 🔴 NO-GO**, con justificación.

---

## 🗺️ INVENTARIO PÁGINA POR PÁGINA

### APP 1 — Panel inmobiliario · `https://admin.myalquiler.com`

| # | URL | En qué enfocarte |
|---|-----|------------------|
| 1 | `/login` | Rediseño nuevo (split-screen + hero con mockup + bloque “Apoyan / CPI”). Que **entre en una pantalla sin scroll** en alto de laptop, responsive, validaciones de login, mensajes de error, link a registro. |
| 2 | `/registro` | Wizard de 2 pasos (datos inmobiliaria → datos de acceso). Indicador de progreso, validaciones (email, contraseña ≥ 8, confirmación), copy, que no rompa al volver atrás. **No completar un alta real.** |
| 3 | `/precios` | Landing de planes/tarifas: copy, CTAs, coherencia de marca, que los precios y los topes tengan sentido. |
| 4 | `/` (Inicio) | Dashboard: KPIs reales (Cobrado / Por cobrar / En mora / A rendir + operacionales) → **¿los números cierran?** Saludo, CTAs (Verificar inquilino / Cargar contrato), “Necesitan tu atención”, “Próximos 14 días”, banner trial pre-lanzamiento. **Sin datos demo.** |
| 5 | `/propiedades` | Listado + KPIs + filtros (Alquiladas / Con problemas / Disponibles) + búsqueda. Cards (dirección, inquilino, propietario, alquiler, reclamos). Botones “Cargar propiedad” y “Migrar mi cartera” (abrir, **no importar**). Estados vacío/loading. |
| 6 | `/propiedades/nueva` | Wizard de alta (ubicación → características → propietarios **suma 100%** → resumen). Validaciones, autocomplete provincia/ciudad. **No confirmar el alta** (o usar registro `ZZZ PRUEBA` y borrarlo). |
| 7 | `/propiedades/[id]` | Abrí una propiedad **real para LEER**: tabs (Inquilino / Reclamos / Boletas / Servicios), propietarios y participaciones, estado de pago. **No editar, no desalojar, no cambiar inquilino.** Probar deep-link directo por URL. |
| 8 | `/propietarios` | Listado + métricas (cobrado del mes, a rendir) + filtros (sin-cbu / sin-rendir) + búsqueda. Menú de acciones (Rendir / Mensaje / Editar / Eliminar) → **abrir, no ejecutar**. ¿Cálculos coherentes? |
| 9 | `/propietarios/[id]` | Detalle de un propietario real (**LEER**): participaciones, historial de rendiciones, datos de contacto. |
| 10 | `/pagos` | Cobranza: pendientes / pagados / morosos, **cálculo de mora y punitorios**, formato moneda, “Cargar pago manual”, validar/rechazar pago → **no confirmar sobre datos reales**. |
| 11 | `/caja` | Gastos de la inmobiliaria: listado, categorías, “Cargar gasto” (abrir, no confirmar), comprobantes, totales presupuestado vs real. |
| 12 | `/contratos` | Listado + KPIs + filtros (Activos / Borradores / Archivados) + búsqueda. Vigencias, próximos ajustes, estados, monedas (ARS/USD). |
| 13 | `/contratos/nuevo` | Wizard con **subida de PDF + extracción por IA**. Probá el flujo (idealmente con un PDF de prueba): manejo de error/timeout de la IA, indicadores de confianza, validaciones de campos. **No confirmar la carga real.** |
| 14 | `/contratos/[id]` | Detalle de contrato real (**LEER**): términos, liquidaciones, renovación, “Compartir/Descargar” → **no compartir a terceros**. |
| 15 | `/aprobaciones` | Bandeja de pendientes (badge en el sidebar). **No aprobar/rechazar nada real.** Revisar empty state. |
| 16 | `/reclamos` | Listado + SLA (al día / por vencer / vencido) + filtros + búsqueda. Coherencia de colores de urgencia/estado. |
| 17 | `/reclamos/[id]` | Detalle de reclamo real (**LEER**): timeline, asignar a profesional / resolver → **no ejecutar**. |
| 18 | `/anuncios` | Listado + “Crear anuncio” (**abrir el modal, NO enviar** — saldría a gente real). Tracking de lectura/confirmación. |
| 19 | `/screening` | Verificación de inquilinos. **No iniciar una verificación con datos/PII de una persona real.** Revisar copy, estados y manejo de error. |
| 20 | `/consorcios` | Listado de consorcios + métricas por edificio (morosidad, saldo). |
| 21 | `/consorcios/[id]` | Detalle (**LEER**): unidades, expensas, morosidad, reclamos. |
| 22 | `/profesionales` | Directorio de oficios. **No contactar ni eliminar.** |
| 23 | `/renovaciones` | Pipeline de vencimientos + negociador (sugerencia de aumento). **No ejecutar acciones de renovación reales.** ¿La sugerencia de aumento es razonable? |
| 24 | `/configuracion` | Perfil, plan/facturación, seguridad (**no cambiar PIN ni contraseña**), integraciones, usuarios del equipo (**no invitar/eliminar**), banner trial. |
| 25 | `/admin/objetivos` | Página interna oculta (no está en el menú). **Verificá que no sea accesible sin permisos** y que no exponga nada que no deba. |

**Extra panel:** entrá a una URL inexistente (ej. `/cualquier-cosa`) para ver el **404**. Revisá **favicon, título de pestaña y meta**.

---

### APP 2 — App del inquilino (PWA) · `https://app.myalquiler.com`

| # | URL | En qué enfocarte |
|---|-----|------------------|
| 1 | `/login` | Login por **OTP al email**: copy, cooldown de reenvío, contador de intentos, errores. (Si no hay sesión, documentá el flujo sin completarlo con un email real ajeno.) |
| 2 | `/` (Inicio) | Estado de pago (pendiente/atrasado/al día), banner con monto + desglose, quick actions (Pagar/Reclamo/Contrato/Boleta), últimos movimientos, card de la inmo, anuncios. **Que NO aparezca el selector demo “Atrasado/A tiempo/Al día”.** |
| 3 | `/comprobantes` | Historial + pendientes, filtro por año, **“Descargar CSV”** (¿expone datos sensibles?), botón regularizar. Empty state. |
| 4 | `/pago/[liqId]` | Detalle de una liquidación (**LEER**). |
| 5 | `/pago/[liqId]/checkout` | **FLUJO DE PAGO (crítico)**: 3 pasos (datos bancarios/CBU + monto → subir comprobante → confirmación). Copiar CBU, validación de monto vs saldo, **punitorios**, upload (tipos/peso). **No informar un pago falso real.** |
| 6 | `/contrato` | Detalle del contrato, **Descargar PDF** (datos sensibles), “Compartir garante” (**no compartir**), tabs (Contrato/Garantía/Depósito/Ajustes), banner de renovación, chat del asistente. |
| 7 | `/contrato/renovacion` | Decisión en 3 pasos (Renovar / No / Pensándolo). Verificá que el copy **no prometa algo que no pasa** (puede ser solo local / “Disponible pronto” en prod). |
| 8 | `/reclamos` | Listado (abiertos vs archivados) + banner de confirmación al crear. |
| 9 | `/reclamos/nuevo` | Form (categoría, urgencia, descripción, foto). Autosave de borrador, botón de emergencia (`tel:`). **No crear un reclamo basura real** (si lo hacés, borralo). |
| 10 | `/reclamos/[id]` y `/reclamos/r?id=…` | Detalle de reclamo: timeline, estados, cerrar/reabrir/eliminar → **no ejecutar sobre datos reales**. La ruta `/reclamos/r` es fallback por query — probá que no rompa con un id inexistente. |
| 11 | `/servicios` | Boletas de servicios: listado, estados, marcar pagada / eliminar → **no ejecutar**. |
| 12 | `/servicios/subir` | Form de subida de boleta (tipo, período, monto, archivo). Validaciones y preview. |
| 13 | `/cuenta` | Perfil + accesos (Certificado / Ayuda / Co-inquilinos / Documentos) + “Relanzar tour” + Logout (**dejá el logout para el final**). |
| 14 | `/cuenta/editar` | Editar perfil. En prod puede estar **deshabilitado / “Próximamente”** — verificá que se comunique bien. |
| 15 | `/co-inquilinos` + `/co-inquilinos/invitar` | Gestión e invitación. **No invitar a un email real.** Revisar permisos y copy. |
| 16 | `/broker` | Asistente IA: probá el chat. ¿Responde con sentido o está “Disponible pronto” en prod? Buscá alucinaciones / respuestas vacías / falta de moderación. |
| 17 | `/certificado` | “Reemplazo del garante”: nivel, métricas, compartir/PDF (**no compartir a terceros**), link de verificación pública. |
| 18 | `/documentos` | Documentos personales (DNI, recibos): **privacidad** (¿se exponen?), estado “Próximamente” en prod, límites de subida. |
| 19 | `/ayuda` | FAQ con búsqueda y categorías. ¿Información actual y correcta? Link a WhatsApp de la inmo. |
| 20 | `/calendario` | Eventos (pagos, ajustes, vencimientos). Puede estar **“Próximamente”** en prod — verificá la comunicación. |
| 21 | `/profesionales` | Red de profesionales verificados. Puede estar **“Próximamente”** en prod. |
| 22 | `/verificar/[hash]` | Verificación **pública** de certificado (sin login): **que NO exponga PII de más**, manejo de hash inválido (404 prolijo). |
| 23 | `/garantes/[token]` | Vista pública para garantes por token: read-only, manejo de token inválido. |
| 24 | `/p/[token]` | Vista pública de reseña a profesionales por token. |

**Extra inquilino:** probá la **PWA** (manifest, ícono, “Agregar a inicio”), el **404**, y la navegación inferior en mobile.

---

## ✅ CHEQUEOS TRANSVERSALES (ambas apps)

- [ ] **Cero fugas de demo/mock en prod:** ningún CBU falso, ningún “Inmobiliaria del Sol”, ni nombres de demo (Roberto/Mariela), ni selector demo, ni números inventados.
- [ ] **Coherencia de marca** entre panel e inquilino (violeta, tipografía, componentes, tono).
- [ ] **Features sin backend** correctamente gateadas a “Disponible pronto / Próximamente” (no formularios que parecen funcionar pero no guardan).
- [ ] **Consola limpia** (sin errores rojos) en cada pantalla.
- [ ] **Deep-links directos** por URL a páginas `[id]` no rompen (entrar pegando la URL).
- [ ] **Sesión / logout** funcionan; al desloguear, las rutas privadas redirigen al login.
- [ ] **404, favicon, título de pestaña y metadatos** correctos en ambas apps.
- [ ] **Responsive real** en mobile 390px (lo más probable es que los inquilinos entren desde el celular).

---

### Recordatorio final
**Documentá todo, no arregles nada, no toques datos reales ni envíes comunicaciones.** El entregable es el **informe con todos los hallazgos clasificados + Top 10 + veredicto GO/NO-GO**.
