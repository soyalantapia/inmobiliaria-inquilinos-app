# 🧪 QA Manual — My Alquiler · Guion de testeo completo

> **Para qué sirve esto:** recorrer las 3 superficies del producto (panel inmobiliaria, app inquilino, flujos públicos) + la landing, entender qué hace cada cosa, y anotar cualquier error. No hace falta saber programar: seguís los pasos, mirás lo que pasa, y marcás ✅ / ⚠️ / ❌.
>
> **Cómo anotar cada hallazgo** (copiá este formato al final del doc):
> ```
> [#] PANTALLA — qué hiciste — qué esperabas — qué pasó — 🔥 Crítico/Alto/Medio/Bajo
> ```

---

## 0. Antes de arrancar — levantar todo

```bash
cd ~/dev/inmobiliaria-inquilinos-app
pnpm --filter inquilino dev      # → http://localhost:3000
pnpm --filter inmobiliaria dev   # → http://localhost:3001   (en otra terminal)
```

**O testear en producción (GitHub Pages, ya deployado):**
- Inmobiliaria: https://soyalantapia.github.io/inmobiliaria-inquilinos-app/inmobiliaria/
- Inquilino: https://soyalantapia.github.io/inmobiliaria-inquilinos-app/inquilino/
- Landing: https://soyalantapia.github.io/inmobiliaria-inquilinos-app/presentacion/

### Accesos demo (no hay datos reales, todo es mock)
| Quién | Cómo entra |
|---|---|
| **Roberto** (dueño inmobiliaria) | Entra solo, sin login (usuario mock). En `/login` si pide algo, es demo. |
| **Mariela** (inquilina) | En el login: botón **"Probar con cuenta demo (Mariela Sosa)"** → pide código → el código aparece en un **banner amarillo "DEMO"** en la misma pantalla, copialo. **Atajo:** agregá `?demo=1` a la URL del login y entra directo sin código. |
| **Diego** (garante, sin cuenta) | Link público: `/inquilino/garantes/demo` |
| **Plomero/profesional** (sin cuenta) | Link público: `/inquilino/p/demo` |
| **Otra inmobiliaria** (verificar certificado) | Link público: `/inquilino/verificar/16NJ-PTVB-KF8B` (hash estable del inquilino demo) |

> **Tip mobile:** la app del inquilino es una PWA pensada para celular. Testeala en el celular real o achicá la ventana del navegador a ~390px de ancho (DevTools → modo responsive → iPhone). El panel inmobiliaria es para desktop.

---

## PARTE A — Panel Inmobiliaria (Roberto) · desktop

> Es el centro del producto. Entrá a `localhost:3001` (o la URL de prod). Te recibe "Buenas, Roberto. Tu cartera al día."

### A1. Dashboard / Inicio (`/`)
- [ ] Arriba aparece **"PARA RESOLVER HOY"** con bloques (Reclamos sin asignar, Inquilinos atrasados, Propietario sin CBU, Pagos a validar, Propietarios por rendir). **Tocá cada bloque** → debe llevarte a la sección correspondiente ya filtrada.
- [ ] Las 4 tarjetas de plata (Cobrado / Por cobrar / En mora / A rendir) muestran montos. ¿Tienen sentido entre sí?
- [ ] El gráfico "Cobro de las últimas 4 semanas" se ve completo.
- [ ] "Próximos 14 días" lista vencimientos/ajustes. ¿Las fechas son coherentes?
- [ ] **Probá el selector "Todas las sociedades"** (arriba a la derecha) → cambiar de sociedad debería filtrar todo el panel.

### A2. Propietarios (`/propietarios`)
- [ ] Se ven 5 propietarios en tarjetas. KPIs arriba (a rendir, sin rendir, sin CBU).
- [ ] **Tocá una tarjeta** → se abre una vista rápida (modal) con datos, propiedades, rendiciones.
- [ ] En el modal, tocá **"Abrir ficha completa"** → te lleva a `/propietarios/own_001` con KPIs, datos bancarios, ARCA, propiedades.
- [ ] Federico López Vega debe mostrar **"Falta CBU"** y el botón Rendir deshabilitado (freno correcto).
- [ ] El propietario sin pendientes debe decir **"Al día"** (no "1 unidad").
- [ ] El buscador de la sección filtra. (Ya NO debería haber un segundo buscador en la barra de arriba.)

### A3. Propiedades (`/propiedades`)
- [ ] Lista de propiedades con estado (Alquilada / Disponible). 
- [ ] Tocá una → ficha `/propiedades/[id]`: contrato vigente, propietario, historial.
- [ ] Probá **"Nueva propiedad"** (`/propiedades/nueva`) → el formulario, ¿valida campos? ¿el botón guardar responde?

### A4. Pagos (`/pagos`) — flujo central
- [ ] Lista de pagos pendientes de validar con comprobante.
- [ ] **Aprobá un pago** → ¿confirma? ¿se mueve a "resueltos"? ¿aparece en el historial?
- [ ] Probá **rechazar** y **revertir** un pago. ¿Pide motivo? ¿queda registrado?
- [ ] **Cargá un pago manual** (efectivo/transferencia por fuera) → ¿el formulario es claro?

### A5. Contratos (`/contratos`)
- [ ] Lista de contratos. Tocá uno → `/contratos/[id]`.
- [ ] **Probá el asistente IA del contrato** (`/contratos/cnt_008` tiene la conversación): preguntale algo tipo "¿cuándo vence?" o "¿cuánto sube?". ¿Responde con sentido?
- [ ] **Cargar contrato nuevo** (`/contratos/nuevo`): subí un PDF (cualquiera) → ¿el wizard "lee" los datos? ¿se puede revisar/confirmar?

### A6. Caja (`/caja`)
- [ ] Gastos imputados a propiedades (plomería, expensas, etc.). ¿Se descuentan de la rendición?
- [ ] Cargá un gasto nuevo. ¿Pide propiedad + monto + categoría?

### A7. Reclamos (`/reclamos`)
- [ ] Lista de reclamos con categoría (urgente/plomería/etc.) y estado.
- [ ] Tocá uno → `/reclamos/[id]`. **Asigná un profesional** → ¿la lista prioriza por categoría del reclamo? ¿manda WhatsApp?
- [ ] Mirá que el FAB "Reportar" (abajo-derecha) **no tape** ningún botón de las tarjetas.

### A8. Renovaciones (`/renovaciones`)
- [ ] Negociador IA: propuesta de aumento por contrato, % sugerido, prob. renovación.
- [ ] Botón **"Generar mensaje WhatsApp"** de cada tarjeta → ¿abre WhatsApp con texto pre-armado? ¿el FAB no lo tapa?

### A9. Screening / Verificar inquilino (`/screening`)
- [ ] Informe de aspirante: historial financiero, vínculos, bienes, empleador.
- [ ] ¿El placeholder del CUIT NO es un CUIT válido? (debe ser claramente de ejemplo)

### A10. Consorcios (`/consorcios`)
- [ ] 2 consorcios con expensas, ingresos, egresos, deuda por UF.
- [ ] **Verificá que los números cuadren:** el badge "X UF" debe coincidir con las unidades reales listadas (antes el Cabildo decía 24 pero tenía 4 → ya corregido, confirmá).
- [ ] Tocá uno → `/consorcios/[id]`.

### A11. Anuncios (`/anuncios`)
- [ ] 3 anuncios con prioridad (Importante/Normal) y canales (APP/WhatsApp/Email).
- [ ] **El autor de cada anuncio debe ser un miembro real del equipo** (Roberto, Luciana, Sergio, Martín, Camila). NO debe aparecer "Eugenia Rinaldi" (era fantasma, ya corregido).
- [ ] Probá **"Nuevo anuncio"** → ¿se puede elegir audiencia + canales?

### A12. Configuración (`/configuracion`) — 8 pestañas
- [ ] **Empresa**: nombre debe ser "Inmobiliaria del Sol" (NO "Inmo Persiste OK" — si lo ves, es localStorage viejo, limpialo). CUIT válido.
- [ ] **Equipo y permisos**: 5 personas con roles. El contador debe tener nombre real (NO "Contador externo" como nombre).
- [ ] **Auditoría** (pestaña clave): historial de ~155 acciones con autor + rol + fecha. **Verificá: ningún rol "Carga limitada" debe aparecer haciendo acciones que no le corresponden** (ej. Camila/Carga cargando un pago manual → ya corregido). Probá los filtros por módulo/usuario/rango.
- [ ] Mirá que el rol diga **"Carga limitada"** consistente (en Equipo y en Auditoría igual).
- [ ] Pestañas Sociedades, Plan y facturas, Convenios, Invitar colegas, Mercado: abrí cada una, ¿carga sin romper?

---

## PARTE B — App Inquilino (Mariela) · MOBILE (~390px)

> Entrá con `?demo=1` o el botón demo + código del banner. Es PWA mobile.

### B1. Login (`/login`)
- [ ] El fondo no se "corta" (debe ser gradient continuo arriba-abajo).
- [ ] Email no se rompe feo en el paso del código.
- [ ] El banner amarillo "DEMO" muestra el código de 6 dígitos.
- [ ] Probá `?demo=1` → entra directo sin código.

### B2. Home (`/`)
- [ ] Saludo "Hola Mariela". Si hay pago atrasado, banner rojo arriba con monto + "Regularizar".
- [ ] Accesos rápidos: Pagar, Reclamo, Contrato, Boleta.
- [ ] Bloque de la inmobiliaria con WhatsApp + Llamar (CBU completo, en 1 línea).
- [ ] Card del Asistente IA (Broker). Últimos movimientos.
- [ ] **No debe haber scroll horizontal.** La barra de abajo (Inicio/Asistente/Contrato/Recibos/Reclamos) es cómoda de tocar.

### B3. Pagar (`/pagos` → checkout)
- [ ] Monto, datos bancarios, botón **"Copiar todos"** los datos.
- [ ] Cargá un comprobante (3 pasos). ¿Queda informado al instante?
- [ ] El N° de operación tiene placeholder con "Ej:".

### B4. Reclamos (`/reclamos`, `/reclamos/nuevo`)
- [ ] Nuevo reclamo: la urgencia es un grid 2x2. Subí una foto. Descripción.
- [ ] ¿Se envía y aparece en la lista con estado?

### B5. Contrato + Broker IA (`/contrato`, `/broker`)
- [ ] El contrato muestra cláusulas, ajustes, depósito, vencimientos.
- [ ] **Broker IA**: preguntale algo del contrato. ¿Responde citando cláusula?
- [ ] Renovación (`/contrato/renovacion`): ¿se entiende la propuesta?

### B6. Comprobantes / Boletas (`/comprobantes`)
- [ ] Histórico de comprobantes. Pago atrasado debe ir arriba.
- [ ] Boletas de servicios: subir (dropzone "Tocá o arrastrá"), menú ⋮ para borrar.
- [ ] Botón "Copiar todos" para el contador.

### B7. Cuenta (`/cuenta`)
- [ ] Título "Tu hogar". Editar datos. Avatar "M" con chevron.
- [ ] No debe duplicar lo que ya está en la barra de navegación.

### B8. Otras (`/calendario`, `/documentos`, `/co-inquilinos`, `/certificado`, `/servicios`, `/profesionales`, `/ayuda`)
- [ ] Abrí cada una. ¿Carga? ¿Tiene propósito claro? ¿Estado vacío útil (no desolado)?

---

## PARTE C — Flujos públicos (sin cuenta)

### C1. Garante (`/inquilino/garantes/demo`)
- [ ] Bloque "Sos garante de este contrato" arriba (contexto claro).
- [ ] Datos del contrato (solo lectura), fechas en formato corto.
- [ ] "Garantía del contrato" (NO "Tu garantía") + aclaración "la gestiona la inmobiliaria".
- [ ] CTAs **WhatsApp + Llamar** con el número visible.
- [ ] Footer "vista para garante · sin cuenta requerida".

### C2. Profesional (`/inquilino/p/demo`)
- [ ] Si no hay trabajo: empty state explica "¿Qué vas a ver?".
- [ ] Brand "Con tecnología de My Alquiler" abajo.

### C3. Verificar certificado (`/inquilino/verificar/16NJ-PTVB-KF8B`)
- [ ] **Esta es PÚBLICA** (no debe redirigir a login). Si te manda a login → ❌ CRÍTICO.
- [ ] Muestra el certificado del inquilino para que otra inmobiliaria lo valide.
- [ ] **Bug encontrado y arreglado en este QA (BUG-01):** el hash del certificado cambiaba con el tiempo (incluía `cuotasPagadas`, que crece mes a mes), entonces un link compartido se rompía con 404 en el siguiente deploy. Fix: el hash ahora depende solo de datos inmutables (DNI+contrato+inmobiliaria). El hash estable es `16NJ-PTVB-KF8B`.

---

## PARTE D — Landing comercial (`/presentacion/`) · desktop + mobile

- [ ] Hero: 1 CTA principal "Recorrer panel demo" + link chico "Si sos inquilino". Nota "demo en vivo sin registro".
- [ ] Sección "Los problemas reales" (6 dolores). "Cómo funciona" (3 pasos).
- [ ] 8 secciones de features. "Por qué confiar" (6 garantías).
- [ ] **Precios**: 4 planes, cada uno con botón **"Empezar con [plan]"** → WhatsApp pre-armado con el plan. Enterprise = "Hablar con ventas".
- [ ] FAQ: las primeras deben ser del comprador (contrato mínimo, migración, datos al darse de baja, soporte, claves).
- [ ] Novedades (changelog) con fechas distintas (no todas iguales).
- [ ] **Footer**: 4 columnas (Producto/Apps/Contacto/Legales) — NO vacío. Los links de Legales van a `/legales/` (no rebotan al top).
- [ ] **Mobile**: nav-links y botones cómodos de tocar (44px). Sin scroll horizontal.
- [ ] Página `/legales/`: Términos + Privacidad + Datos con disclaimer "Versión preliminar".

---

## PARTE E — Pruebas de coherencia cruzada (lo que más revela bugs)

- [ ] **Mariela ↔ Roberto**: el contrato/dirección de Mariela (Gorriti 4521, 3°B) en la app inquilino debe coincidir con lo que ve Roberto en la propiedad/propietario.
- [ ] **El CBU** que ve Mariela para pagar debe ser el de la cuenta recaudadora de la inmobiliaria.
- [ ] **Un pago** que Mariela informa, ¿aparece en "Pagos a validar" de Roberto?
- [ ] **Marca consistente**: en toda la app inquilino e inmobiliaria debe decir "Inmobiliaria del Sol" / "My Alquiler". Si aparece "Deenex", "Palta" u otro nombre → ❌ (es contaminación de otro proyecto).
- [ ] **Modo nocturno**: NO debe haber toggle de dark mode (se quitó a propósito). Todo blanco siempre.

---

## PARTE F — Romper a propósito (recuperación de errores)

- [ ] Inquilino: pedí código, esperá >5 min, tipealo → debe decir "expiró, pedí otro".
- [ ] Inquilino: tipeá un código mal 5 veces → debe bloquear y pedir uno nuevo.
- [ ] Inmobiliaria: intentá rendir a un propietario sin CBU → debe frenar.
- [ ] Recargá la página en medio de un flujo (F5) → ¿se pierde lo cargado? ¿el onboarding vuelve a aparecer (no debería si ya lo viste)?
- [ ] Navegá a una URL que no existe (`/cualquiercosa`) → ¿404 útil o pantalla en blanco?

---

## Plantilla de hallazgos (completar mientras testeás)

```
[1] _______ — hice _______ — esperaba _______ — pasó _______ — 🔥 ___
[2] ...
```

## Contexto: qué se hizo en este proyecto (para entender el "por qué")

Este producto pasó por **6 auditorías UX** (inmobiliaria ×3, inquilino, públicos, landing ×2) + design-review con gstack. Se aplicaron ~90 fixes. Los reportes están en la raíz del repo: `REPORTE-AUDITORIA-UX*.md` y `REPORTE-DESIGN-REVIEW-*.md`. Si encontrás un bug, vale la pena chequear si ya está documentado en esos reportes antes de marcarlo como nuevo.

**Estado conocido (no son bugs):**
- Es un demo: todo corre sobre datos mock en localStorage, sin backend real.
- Falta material de marketing en la landing: testimoniales reales + video (el "hook" está listo, falta el contenido).
- La estética de la landing tiene "look generado por IA" (violeta + emojis + todo centrado) — es una decisión de marca pendiente, no un bug.
