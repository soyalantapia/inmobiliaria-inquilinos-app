# 🕵️ REPORTE DE AUDITORÍA UX — My Alquiler · App del Inquilino

> **Auditor:** "Mariela Sosa" (persona) — 32, freelance en Palermo, Android gama media, mobile-first. Usuaria recurrente: paga el alquiler todos los meses, hace 1-2 reclamos al mes, abre el contrato cuando duda algo.
> **Producto:** `apps/inquilino` · Next.js 14 + Tailwind + shadcn/ui (PWA mobile-first).
> **Versión auditada:** main `2294b26` (28/05/2026) — deploy live en https://soyalantapia.github.io/inmobiliaria-inquilinos-app/inquilino/
> **Método:** navegación real en `http://localhost:3000` a 375px (mobile preset), screenshots por cada paso.
> **Alcance:** experiencia del inquilino recurrente. NO seguridad, NO QA técnico, NO performance.
> **Aclaración:** la auditoría previa de inmobiliaria (Roberto) está en `REPORTE-AUDITORIA-UX.md`.

---

## 1. Resumen ejecutivo

**Las 5 fricciones que más sangran (lo primero que arreglaría esta semana):**

1. 🔴 **Trash al lado de download en /servicios** — Mariela puede borrar la boleta de luz que acaba de subir por error con dedo gordo en mobile. Acción destructiva pegada a una no-destructiva, sin separación.
2. 🟠 **Card "TU ALQUILER VIGENTE $480.000" tapa el pago atrasado urgente en /comprobantes** — en mobile, la primera card que ves es el alquiler vigente en violeta gigante, NO el pago atrasado. Mariela tiene que scrollear para ver lo importante.
3. 🟠 **Urgencia en /reclamos/nuevo: 4 cards full-ancho** — "Emergencia" queda fuera del primer viewport. Mariela que viene con una urgencia real podría elegir "Urgente" sin ver que existe "Emergencia".
4. 🟠 **Placeholder "123456789" del N° operación parece valor real** — Mariela puede pensar que es default y no completarlo. Mismo patrón que vi en el CUIT del screening (ya arreglado).
5. 🟠 **"Inquilino" (masculino) bajo "Mariela Sosa"** — concordancia de género rota. Para una app argentina con tono casual, suena descuidado.

**Sensación general:**
> *"La app está bien pensada para mí. El asistente IA del contrato es la joya — me respondió sobre mascotas con la cláusula exacta del PDF firmado. Los flujos de pagar, reclamar y subir boletas son claros. Pero hay 5-6 detalles chicos que me hacen dudar (¿se borró eso por error?, ¿qué dice ese badge?) y algunos copys descuidados (me dice 'Inquilino' cuando me llamo Mariela). Si arreglan esos detalles, pasa de buena a premium."*

---

## 2. Diario del usuario (narrativa)

> *Lunes a la mañana. Abro la app desde el ícono del home screen.*

**8:42 — Login.** Tengo que escribir mi email (o tocar "Probar con cuenta demo"). Después tocar "Recibir código por email". Aparece la pantalla del OTP donde veo mi email partido feo: "mariela.sosa@g · mail.com" (el "g" queda al final de una línea y "mail.com" en la siguiente). El código demo aparece grande en una tarjeta — útil para probar, raro en producción.

**8:43 — Llego al Inicio.** Tour de 9 pasos arranca solo. *"PASO 1 DE 9 · ¡Bienvenido a My Alquiler!"*. Le doy "Saltar tour". Ojalá no me aparezca de nuevo mañana (espero que sea solo la primera vez — en la app del admin ya lo arreglamos).

**8:44 — Veo la home.** "Hola, Mariela 👋 · Atrasado · 23 días" en rojo. Card grande roja: "Tenés un pago atrasado · $591.734 · Venció hace 23 días" + botón "Regularizar". Excelente, **veo lo urgente al toque**. Abajo 4 atajos: Pagar, Reclamo, Contrato, Boleta. Buenísimo.

**8:45 — Toco "Pagar".** Me lleva DIRECTO al checkout (gracias al fix anterior). Veo el desglose: alquiler + expensas + punitorios + tasa diaria. Una card violeta que dice *"¿Necesitás dividir el pago en cuotas? · Negociar por WhatsApp"* — buena empatía. Banner amber *"A partir del 01/06/2026 cambian los datos de cobro"* con CBU y alias nuevos visibles. **Esto está MUY bien**, no me deja transferir al CBU equivocado por error.

**8:48 — Scrolleo y veo los datos para transferir.** Cada dato (titular, CUIT, banco, CBU, alias, monto) tiene su botón "Copiar". 5 botones "Copiar" verticales se sienten un poco saturados. El CBU `00700991200000312345` se ve en 2 líneas y el "60" final queda solo en la segunda línea — al copiar manualmente tengo que ser cuidadosa. Ojalá hubiera un "Copiar TODOS los datos" como opción.

**8:50 — Toco "Ya transferí, subir comprobante".** Step 2. Foto o PDF, hasta 5MB. Bien. Input "N° de operación" con placeholder "123456789" — *eso no me dice si es ejemplo o si tengo que poner ese número*. Casi pongo "123456789" pensando que era default.

**8:55 — Voy a "Reclamos" del NavBar y toco "Nuevo reclamo".** Form clarísimo: 5 categorías con emojis (🚰 🔑 💡 🔥 🛠️), textarea, foto opcional, urgencia con 4 niveles. Pero las 4 cards de urgencia están full-ancho y solo veo 2 en la primera pantalla. Tengo que scrollear para ver "Urgente" y "Emergencia". Si tenía algo urgente, podría haberlo marcado mal por no ver la opción más alta. Cuando intento enviar incompleto, **aparece un hint mágico**: *"Te falta: elegir de qué se trata · contar un poco más · elegir la urgencia"* — esto es ORO, dice exactamente qué hacer.

**9:02 — Voy a "Asistente" y le pregunto "¿Puedo tener mascotas?".** Me responde *"Sí, podés tener mascotas. La cláusula 9 lo permite siempre que sean perros o gatos hasta 25 kg"* con la cita EXACTA del PDF firmado abajo. **Esto justifica solo la app.** Esto es por lo que pagaría.

**9:05 — Voy a Recibos.** Veo una card violeta gigante *"TU ALQUILER VIGENTE $480.000/mes"*. Linda. Pero ABAJO está el pago atrasado urgente — *¿no debería ser al revés? Lo urgente arriba, lo vigente abajo*. Voy a tener que scrollear para regularizar.

**9:08 — /servicios.** Subo boletas de luz/gas. Buenas KPIs arriba (Este mes $34.200, Pagaste este año $51.300, Sin pagar 1). Lista de boletas con botones de descarga + delete (🗑️ rojo). El trash está PEGADO al ícono download. Con mi dedo gordo de iPhone podría borrar una boleta que recién subí. Al lado del PAGADAS, no tengo cómo confirmar "ya pagué" para Gas, solo para la sin pagar. Confundible.

**9:12 — Voy a Cuenta.** Me ven en grande: *"Mariela Sosa · Inquilino · Gorriti 4521, 3°B"*. ¿"Inquilino" para una mujer? Pequeño detalle de copy que descuida. Mi teléfono +5491145678900 y email mariela.sosa@gmail.com. Botón "Editar datos". Las secciones "TU HOGAR" están bien organizadas (Mi contrato, Mis documentos, Mi calendario, Co-inquilinos, Profesionales). Pero "Mi contrato → Ver términos" duplica al tab "Contrato" del NavBar — son lo mismo.

**9:15 — Cierro la app.** Estado general: **producto bueno con detalles chicos**. El asistente IA, el checkout con CBU change warning, el hint en formularios, el dashboard de pago atrasado — todo eso es first-class. Pero los detalles cosméticos (concordancia género, badges ambiguos, dropzone vs trash, copy técnico) restan profesionalismo. Si arreglan eso, pasa de "está bien" a "está pulida".

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | ¿Quick win? |
|---|---|---|---|---|
| **M-16** | Trash al lado de download en /servicios — toque accidental | 🟠 Alta | Bajo | ✅ |
| **M-20** | Card violeta "alquiler vigente" tapa pago atrasado urgente en /comprobantes | 🟠 Alta | Bajo | ✅ |
| **M-12** | Urgencia "Nuevo reclamo": 4 cards full-ancho, "Emergencia" oculta en scroll | 🟠 Alta | Bajo | ✅ |
| **M-09** | Placeholder "123456789" N° operación parece valor real | 🟠 Alta | Bajo | ✅ |
| **M-21** | "Inquilino" (masculino) bajo "Mariela Sosa" — concordancia | 🟠 Alta | Bajo | ✅ |
| **M-17** | Badge "Subida" en boleta es ambiguo (¿subió de precio?) | 🟡 Media | Bajo | ✅ |
| **M-13** | Botón "Enviar reclamo" disabled con violeta claro — bajo contraste | 🟡 Media | Bajo | ✅ |
| **M-19** | URL `/comprobantes` ≠ label "Recibos" en NavBar | 🟡 Media | Bajo | ✅ |
| **M-08** | CBU se corta en 2 líneas con "60" final solo | 🟡 Media | Bajo | ✅ |
| **M-04** | Anuncios "Nuevo CBU" cortado a "Cambiamos a Banco Galicia. CBU..." | 🟡 Media | Bajo | ✅ |
| **M-LOGIN-01** | Email se rompe en "g | mail.com" en OTP step | 🟡 Media | Bajo | ✅ |
| **M-22** | "Mi contrato → Ver términos" en /cuenta duplica tab Contrato del NavBar | 🟡 Media | Medio | — |
| **M-05** | Click en bell (3) no abre nada visible | 🟡 Media | Medio | — |
| **M-01** | Tour 9 pasos al login — verificar si vuelve a aparecer | 🟡 Media | Bajo | ✅ |
| **M-14** | Subtítulo asistente "Ayuda con pagos · Gorriti 45..." cortado en mobile | 🟡 Media | Bajo | ✅ |
| **M-LOGIN-02** | Login OTP en cada entrada — fricción para usuario recurrente | 🟡 Media | Alto | — |
| **M-23** | "01/09/2025" muy técnico, mejor "1 sep 2025" | 🔵 Baja | Bajo | ✅ |
| **M-24** | "Faltan 2 años y 3 meses" repetido 2 veces cerca | 🔵 Baja | Bajo | ✅ |
| **M-02** | Avatar "M" no comunica que es link a /cuenta | 🔵 Baja | Bajo | ✅ |
| **M-07** | 5 botones "Copiar" verticales en datos transferencia | 🔵 Baja | Medio | — |
| **M-18** | KPI "SIN PAGAR" naranja sin explicación | 🔵 Baja | Bajo | ✅ |
| **M-03, M-06** | Verde de WhatsApp confunde con verde de CTAs | 🔵 Baja | Medio | — |
| **M-11** | Cards categoría reclamo sin default sugerido | 🔵 Baja | Bajo | — |
| **M-10** | Dropzone comprobante no menciona drag-drop | 🔵 Baja | Bajo | — |

---

## 4. Hallazgos detallados

```
[#M-16] [Mobile/Accesibilidad] — Trash al lado de download en /servicios
📍 Ubicación:     /servicios → cada fila de boleta
👀 Qué vi:        Cada boleta (luz, gas) tiene dos íconos pegados a la derecha: descarga (azul) y trash (rojo). En mobile están separados ~24px. Mi pulgar puede tocar trash queriendo descargar.
😖 Por qué molesta: Acción destructiva (borrar boleta que subí hace 1 minuto) al MISMO nivel táctil que una segura (descargar). Riesgo real de perder un comprobante de pago.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Mover el trash a un menú de 3 puntos (⋮) que despliegue "Descargar / Eliminar". O al menos separarlos con +20px y agregar confirm dialog (que ya está, pero el pre-toque es el problema).
```

```
[#M-20] [Jerarquía visual] — "Alquiler vigente" tapa el pago atrasado urgente en /comprobantes
📍 Ubicación:     /comprobantes (que en NavBar se llama "Recibos")
👀 Qué vi:        Lo primero que veo es una card violeta gigante "TU ALQUILER VIGENTE $480.000/mes". Abajo aparece la card roja del pago atrasado de $591.734 que está vencido hace 23 días.
😖 Por qué molesta: Si Mariela viene a "ver qué tiene que pagar", lo primero que ve no es lo urgente. Tiene que scrollear. La urgencia debería estar arriba.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Invertir el orden: pago atrasado (si hay) primero, alquiler vigente como referencia abajo (más pequeña o como subtítulo). El violeta gigante distrae del rojo urgente.
```

```
[#M-12] [Mobile/UX] — Urgencia "Nuevo reclamo": 4 cards full-ancho, "Emergencia" oculta en scroll
📍 Ubicación:     /reclamos/nuevo → sección "Urgencia"
👀 Qué vi:        Las 4 opciones de urgencia (Puede esperar / Esta semana / Urgente / Emergencia) son cards full-ancho apiladas. En mobile 375px solo veo 2 sin scroll (Puede esperar, Esta semana). Hay que scrollear para ver Urgente y Emergencia.
😖 Por qué molesta: Si Mariela tiene una EMERGENCIA real (gas saliendo, agua corriendo), podría marcar "Urgente" sin saber que existe "Emergencia". Subestimar la urgencia podría retrasar la respuesta.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Layout 2x2 grid en mobile o cards más compactas (height: 56-64px). Las 4 deberían verse SIN scroll. Considerar también un atajo arriba: "¿Es emergencia? Llamá ya al [número]".
```

```
[#M-09] [Microcopy] — Placeholder "123456789" del N° de operación parece valor real
📍 Ubicación:     /pago/[id]/checkout → Step 2 → input "N° de operación"
👀 Qué vi:        El placeholder dice "123456789". Sin prefijo "Ej:" ni indicación.
😖 Por qué molesta: Mariela puede pensar que es default y no llenarlo. O lo peor: pensar que esto YA es su número y dejarlo. Misma patología que vi en el placeholder CUIT del screening (ya arreglado).
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: "Ej: 123456789" como placeholder. Mismo prefijo que ya usamos en otros placeholders.
```

```
[#M-21] [Microcopy/Inclusión] — "Inquilino" masculino bajo nombre femenino
📍 Ubicación:     /cuenta → header de perfil "Mariela Sosa · Inquilino · Gorriti 4521, 3°B"
👀 Qué vi:        El rol está hardcodeado en masculino "Inquilino" sin importar el género del usuario.
😖 Por qué molesta: Para una app argentina con tono casual y empático, no concordar el género con el nombre suena descuidado. Mariela puede sentir que la app no la conoce bien.
🔥 Severidad:     Alta (por simbolismo, no por funcionalidad)
🔧 Esfuerzo:      Bajo
✅ Recomendación: Tres opciones:
  - Neutro: "Tu hogar · Gorriti 4521, 3°B" (mejor opción)
  - Inferido del nombre: heurística simple (terminada en a → "Inquilina")
  - User-driven: campo opcional "Pronombre" en /cuenta
```

```
[#M-17] [Microcopy] — Badge "Subida" ambiguo en boleta sin pagar
📍 Ubicación:     /servicios → boleta "Luz · May 2026" con badge "Subida"
👀 Qué vi:        Bajo el título "Luz · May 2026" hay un pill blanco con borde que dice "Subida".
😖 Por qué molesta: ¿"Subida" qué? ¿Que la subió Mariela? ¿Que la luz subió de precio? Ambiguo. Para info relacionada con servicios públicos en Argentina, "subida" puede confundirse con aumento tarifario.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: "Cargada" o "Pendiente de pago" o "Subida por vos". Mejor un copy que diga el estado real, no la acción que sucedió.
```

```
[#M-13] [UI/Contraste] — Botón "Enviar reclamo" disabled muy claro, parece habilitado
📍 Ubicación:     /reclamos/nuevo → CTA "Enviar reclamo" cuando el form está incompleto
👀 Qué vi:        El botón en estado disabled es violeta claro (~50% opacity). Por aria-disabled está OK, pero visualmente parece habilitado.
😖 Por qué molesta: Mariela puede tocar pensando que enviará y no pasa nada. Frustración. El hint de "Te falta: X" arriba lo compensa, pero el botón debería verse claramente apagado.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Cuando disabled, bajar opacity a 0.4 o usar bg-muted en vez de violeta diluido. Que se vea inequívocamente apagado.
```

```
[#M-19] [Naming/Consistencia] — URL `/comprobantes` ≠ label "Recibos" en NavBar
📍 Ubicación:     navegación general
👀 Qué vi:        El NavBar inferior dice "Recibos". El `<h1>` de la página dice "Recibos". Pero la URL es `/comprobantes`.
😖 Por qué molesta: Si Mariela comparte el link o lo bookmarkea, ve `/comprobantes` y se confunde. Inconsistencia de naming entre URL y UI.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Renombrar la ruta a `/recibos` con redirect desde `/comprobantes` para no romper links viejos.
```

```
[#M-08] [UI/Polish] — CBU se corta en 2 líneas con "60" final solo
📍 Ubicación:     /pago/[id]/checkout → fila CBU (datos para transferir)
👀 Qué vi:        El CBU "0070099120000031234560" se renderiza en 2 líneas: "00700991200000312345" + "60" en la siguiente. El último número queda colgado.
😖 Por qué molesta: Al copiar manualmente con dedo, Mariela puede perder esos últimos 2 dígitos y transferir a un CBU mal. Riesgo financiero real.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Reducir font-size para que entre en 1 línea, o usar `break-all` con `font-mono` + word-spacing menos agresivo. Idealmente el CBU SIEMPRE entra en una sola línea visible.
```

```
[#M-04] [UI/Copy] — Anuncio "Nuevo CBU" cortado en home
📍 Ubicación:     / (home, sección "Anuncios de la inmobiliaria")
👀 Qué vi:        El segundo anuncio dice "Nuevo CBU para cobranzas · vigente desde 01/06" y el preview del cuerpo: "Cambiamos a Banco Galicia. CBU...". El CBU se corta con "...".
😖 Por qué molesta: Es info CRÍTICA (un nuevo CBU para transferir). Que se corte obliga a tocar para expandir cuando ya está en el anuncio. Si fuera una alerta de servicio (corte de agua), OK. Pero un CBU debe verse completo.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Para anuncios con datos accionables (CBU, alias, número de teléfono), mostrar el dato completo sin truncar. O agregar un mini-link "Ver CBU completo" inline.
```

```
[#M-LOGIN-01] [Mobile/Polish] — Email se rompe feo en "g | mail.com"
📍 Ubicación:     /login → step OTP → texto "Te lo mandamos a mariela.sosa@gmail.com"
👀 Qué vi:        El email mariela.sosa@gmail.com se rompe entre la "g" y "mail.com" en 2 líneas (mobile 375px). Queda "mariela.sosa@g" + salto + "mail.com".
😖 Por qué molesta: Visualmente se ve descuidado. Da impresión de que el desarrollo no probó el email más común de Argentina (gmail.com).
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Usar `word-break: break-word` con `overflow-wrap: anywhere` en email containers, o reducir el font-size si no entra. Mejor: cortar el email a 20 chars + "..." y mostrar tooltip al tocar.
```

```
[#M-22] [Arquitectura/UX] — "Mi contrato" en /cuenta duplica al tab Contrato del NavBar
📍 Ubicación:     /cuenta → sección "TU HOGAR" → item "Mi contrato · Ver los términos completos"
👀 Qué vi:        En /cuenta hay un link "Mi contrato → Ver los términos completos" que va a /contrato. Pero la pestaña Contrato del NavBar inferior ya hace exactamente eso.
😖 Por qué molesta: Dos puntos de entrada al mismo contenido. Mariela podría dudar "¿es lo mismo? ¿es diferente?". Sobre-arquitectura.
🔥 Severidad:     Media
🔧 Esfuerzo:      Medio (revisar si esos links de "TU HOGAR" tienen sentido o son redundantes)
✅ Recomendación: Decidir UN solo punto de entrada por feature. Si Contrato vive en el NavBar, el link de /cuenta puede ser otro (ej "Cambios en mi contrato") o eliminarse.
```

```
[#M-05] [Funcional] — Click en bell (3) no abre nada visible
📍 Ubicación:     header de la home → ícono bell con badge "3"
👀 Qué vi:        Hay un ícono de campana con badge "3 sin leer". Al clickearlo no se abre dropdown visible ni navegación a /notificaciones.
😖 Por qué molesta: Mariela ve que tiene 3 notificaciones pero no puede acceder a ellas desde donde están indicadas. Botón roto o flujo incompleto.
🔥 Severidad:     Media
🔧 Esfuerzo:      Medio (requiere implementar dropdown o ruta)
✅ Recomendación: Abrir un Popover con las últimas 5 notificaciones + "Ver todas". O navegar a `/notificaciones`. Hoy parece muerto.
```

```
[#M-01] [Onboarding] — Tour 9 pasos al login
📍 Ubicación:     / al primer login
👀 Qué vi:        Apenas entro, modal fullscreen "PASO 1 DE 9 · ¡Bienvenido a My Alquiler!". Lo cierro con "Saltar tour".
😖 Por qué molesta: Si vuelve a aparecer en cada login (problema que ya tenía la app del admin antes del fix), Mariela lo va a odiar. Si solo es la primera vez, OK.
🔥 Severidad:     Media (depende si persiste el flag)
🔧 Esfuerzo:      Bajo
✅ Recomendación: Verificar que el flag `llave-inquilino:onboarding-completado` persiste correctamente. Si no, replicar el fix que aplicamos en el admin (`onboarding.tsx`): persistir al abrir, no al cerrar, y solo mostrar en `/`.
```

```
[#M-14] [Mobile/Layout] — Subtítulo asistente cortado
📍 Ubicación:     /broker (Asistente IA) → header
👀 Qué vi:        El sub-header dice "Ayuda con pagos, deuda y trámites · Gorriti 45...". El "45..." es porque "Gorriti 4521, 3°B" no entra.
😖 Por qué molesta: Polish mobile. Mariela puede pensar "¿Gorriti 45 qué?". Confunde.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Wrap a 2 líneas, o quitar la dirección del subtítulo en mobile (ya se sabe que es su contrato).
```

```
[#M-LOGIN-02] [UX/Recurrencia] — Login OTP en cada entrada
📍 Ubicación:     /login
👀 Qué vi:        Cada vez que abro la app fresca tengo que: email → "Recibir código" → tipear 6 dígitos → "Entrar". 4 pasos para entrar.
😖 Por qué molesta: Para usuario recurrente (Mariela entra 5+ veces por mes), 4 pasos cada vez es agotador. Apps modernas: Touch ID / Face ID / sesión persistente de 30 días.
🔥 Severidad:     Media (es PWA, dispositivos podrían cubrir esto)
🔧 Esfuerzo:      Alto (cambio de arquitectura auth)
✅ Recomendación: Estrategia futura. Sesión persistente de 30-60 días con re-validación OTP solo si cambia de dispositivo. Biometric API en PWA + iOS Safari.
```

```
[#M-23] [Microcopy] — "01/09/2025" muy técnico
📍 Ubicación:     /contrato → header de período del contrato
👀 Qué vi:        "Activo · 01/09/2025 → 31/08/2028". Formato DD/MM/YYYY.
😖 Por qué molesta: Para Mariela que ve la app rápido, "1 sep 2025" se lee más natural y argentino.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: Usar `formatFechaCorta` ("1 sep 2025") consistente con el resto de la app.
```

```
[#M-24] [Copy/Densidad] — "Faltan 2 años y 3 meses" repetido cerca
📍 Ubicación:     /contrato
👀 Qué vi:        Banner: "Faltan 2 años y 3 meses. Te avisamos cuando se acerque la renovación · Ver opciones". Card abajo: "Te quedan 2 años y 3 meses de contrato".
😖 Por qué molesta: Misma info, dos formatos, 100px de distancia.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: Mantener solo uno (preferiblemente el banner con CTA "Ver opciones").
```

```
[#M-07] [UI/Densidad] — 5 botones "Copiar" verticales en datos de transferencia
📍 Ubicación:     /pago/[id]/checkout
👀 Qué vi:        5 filas con "Copiar" a la derecha (Titular, CUIT, Banco, CBU, Alias, Monto).
😖 Por qué molesta: Saturación visual. Power-user querría "Copiar todos los datos como texto" para pegar en home banking.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Medio
✅ Recomendación: Mantener los individuales + agregar arriba "Copiar todos como texto" que genere bloque preformateado tipo "Titular: ... | CUIT: ... | CBU: ... | Monto: ...".
```

```
[#M-02] [UI/Affordance] — Avatar "M" no parece clickeable
📍 Ubicación:     header de home → círculo violeta con "M" inicial
👀 Qué vi:        Un círculo violeta con "M". No tiene ningún indicador visual de que es interactivo (chevron, sombra, border de hover).
😖 Por qué molesta: Mariela puede no descubrir que ahí está su cuenta. La aria-label "Cuenta de Mariela" ayuda con screen readers, pero visualmente no hay pista.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: Agregar chevron muy sutil al lado, o pequeño border on hover, o etiqueta "Cuenta" al lado en desktop. En mobile el patrón clásico es "avatar → cuenta", ahí está OK pero un primer-time user dudaría.
```

```
[#M-18] [UI/Color] — KPI "SIN PAGAR" naranja sin explicación
📍 Ubicación:     /servicios → KPI "SIN PAGAR 1"
👀 Qué vi:        Los 3 KPIs (Este mes, Pagaste, Sin pagar) tienen valor grande. Los 2 primeros en negro. "Sin pagar" en NARANJA.
😖 Por qué molesta: Mariela puede pensar que es alerta. Si es solo decorativo, inconsistencia. Si es alerta, debería tener border o ícono.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: O todos negros, o si "Sin pagar > 0" merece atención, agregar ícono ⚠ y texto "Atrasada hace X días".
```

```
[#M-11] [UX] — Cards categoría reclamo sin default sugerido
📍 Ubicación:     /reclamos/nuevo → "¿De qué se trata?"
👀 Qué vi:        5 cards sin pre-selección.
😖 Por qué molesta: Forzar elección desde cero suma 1 click. Para reclamos más comunes (Plomería suele ser top), podría pre-seleccionarse.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: Debate de diseño. Algunos prefieren no asumir (forzar atención del usuario), otros optimizan velocidad. Decidir con datos.
```

```
[#M-10] [Microcopy] — Dropzone comprobante no menciona drag-drop
📍 Ubicación:     /pago/[id]/checkout → Step 2
👀 Qué vi:        "Tocá para elegir un archivo · JPG, PNG o PDF". En mobile OK, en desktop el drag-drop también funciona pero no se menciona.
😖 Por qué molesta: Power-user de desktop puede no descubrir el drag-drop.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: "Tocá o arrastrá un archivo acá".
```

```
[#M-03 + #M-06] [UI/Color] — Verde de WhatsApp se mezcla con verde de CTAs
📍 Ubicación:     home (Pagar atajo verde + WhatsApp FAB verde) + /pago checkout
👀 Qué vi:        El verde de "Reclamo" y el verde del FAB WhatsApp son tonos similares. Sugiere que ambos están en la misma "familia semántica".
😖 Por qué molesta: Convencionalmente, verde = OK/seguir adelante. Si WhatsApp ocupa ese verde, los CTAs pierden distintivo.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Medio (rebrand del verde)
✅ Recomendación: Reservar `bg-emerald-500` para WhatsApp y usar otro color (azul, violeta) para CTAs no relacionados con mensajería.
```

---

## 5. Recomendaciones

### Quick wins (hacer esta semana — todos < 2h, total ~6h)

1. **#M-16**: trash a menú ⋮ o separar 24px+ con confirm pre-toque. **30 min.**
2. **#M-20**: invertir orden de /comprobantes — pago atrasado arriba, vigente como referencia. **45 min.**
3. **#M-12**: grid 2x2 para urgencia en /reclamos/nuevo (mobile). **30 min.**
4. **#M-09**: "Ej: 123456789" en placeholder N° operación. **5 min.**
5. **#M-21**: cambiar "Inquilino" hardcoded por "Tu hogar" neutro. **10 min.**
6. **#M-17**: cambiar "Subida" → "Cargada". **5 min.**
7. **#M-13**: opacity 0.4 + bg-muted en botón disabled. **10 min.**
8. **#M-08**: forzar CBU en 1 línea (font-size más chico o break-all bien). **15 min.**
9. **#M-04**: mostrar CBU completo en preview del anuncio. **15 min.**
10. **#M-LOGIN-01**: word-break en email del OTP step. **10 min.**
11. **#M-23**: usar `formatFechaCorta` en período del contrato. **5 min.**
12. **#M-24**: quitar "Te quedan 2 años y 3 meses" del card o del banner. **5 min.**
13. **#M-18**: KPI "Sin pagar" → mismo color que los otros, o con ícono ⚠ y subtitle. **15 min.**
14. **#M-14**: wrap sub-header asistente o quitar dirección en mobile. **10 min.**
15. **#M-01**: verificar persistencia del onboarding flag. **15 min.**

**Total estimado quick wins: ~4 horas. Impacto: cierre del 70% de la fricción detectada.**

### Mejoras estratégicas (próximos sprints)

- **#M-19**: renombrar `/comprobantes` → `/recibos` con redirect. Requiere actualizar todos los links internos y verificar que no se rompa GH Pages.
- **#M-22**: rediseñar /cuenta — decidir qué pasa con los items "TU HOGAR" que duplican el NavBar. Una vista de "atajos a otras pantallas" vs vista de "datos personales" no debería mezclarse.
- **#M-05**: implementar dropdown de notificaciones o página /notificaciones.
- **#M-LOGIN-02**: arquitectura de sesión persistente larga + biometric API.
- **#M-03/M-06**: rebrand del verde — reservar emerald para WhatsApp, usar otro tono para CTAs.

---

**Nota de cierre:** la app está bien pensada y las 4 capacidades core (pagar, reclamar, asistente IA, comprobantes) funcionan en serio. Los hallazgos son **fricción cosmética + polish** — no rediseños de fondo. Los quick wins de arriba mueven la aguja MUCHO con poco esfuerzo y consistentes con el estándar premium que ya tiene el screening y el chat del contrato.
