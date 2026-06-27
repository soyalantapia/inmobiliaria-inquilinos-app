# 🕵️ REPORTE DE AUDITORÍA UX — My Alquiler · Panel Inmobiliaria

> **Auditor:** "Roberto Tapia" (persona) — dueño de inmobiliaria de 80 contratos en Córdoba, Chrome desktop, sin paciencia.
> **Producto:** `apps/inmobiliaria` · Next.js 14 + Tailwind + shadcn/ui.
> **Versión auditada:** main `a25e80d` (28/05/2026 14:57 UTC) — deploy live en https://soyalantapia.github.io/inmobiliaria-inquilinos-app/inmobiliaria/
> **Método:** navegación real en `http://localhost:3001`, lectura de código fuente para hallazgos que requerían verificación de lógica.
> **Alcance:** experiencia del usuario recurrente. NO seguridad, NO QA técnico, NO performance de red.

---

## 1. Resumen ejecutivo

**Las 5 fricciones que más sangran (lo primero que arreglaría esta semana):**

1. 🔴 **Onboarding "¡Bienvenido a My Alquiler!" aparece en cada navegación** — bloquea con tour de 11 pasos a usuarios recurrentes que ya saben todo. Mata el primer impacto profesional.
2. 🔴 **Inconsistencia de números entre dashboard y /propiedades** — "83% ocupación" vs "1 alquilada" sobre el mismo set de 6 propiedades. Roberto pierde confianza en los reportes.
3. 🟠 **Cards del dashboard "Para resolver hoy" linkean al listado general sin aplicar el filtro** — clickeo "Reclamos sin asignar" y caigo en TODOS los reclamos. 1 click más para filtrar manual.
4. 🟠 **3 botones PDF + 4 botones "Plantilla" amontonados** en /pagos sin agrupar — confusión visual y dudas: "¿cuál uso?".
5. 🟠 **Wizard "Cargar contrato" tapado por el tour onboarding** — la cosa más importante que vine a hacer queda detrás de un coachmark de 11 pasos.

**Sensación general:**
> *"La plataforma se siente profesional y honesta — los números son honestos (no inflan), el screening funciona en serio, hay anuncios IA que me hacen sentir un negocio adelantado. Pero el onboarding me trata como si fuera mi primer día siempre, los contadores no concuerdan entre pantallas y hay muchos botones uno al lado del otro que tendrían que estar agrupados. Faltan 10% de detalles para que se sienta de gama alta."*

---

## 2. Diario del usuario (narrativa)

> *Lunes a la mañana. Abro Chrome y voy al panel.*

**8:42 — Entro al panel.** Lo primero que veo es un modal violeta gigante: *"¡Bienvenido a My Alquiler!"* con 11 pasos para recorrer las funciones. Pero yo ya conozco esto, lo uso desde hace meses. Le doy "Cerrar" o "X". Vuelvo a entrar mañana y… aparece de nuevo. **¿Cómo apago esta cosa?** No encuentro toggle en Configuración.

**8:44 — Lo cierro y miro el dashboard.** Esta parte está buena. *"Para resolver hoy · 16 acciones"*. Veo cards: ⚠ Reclamos sin asignar (4), Inquilinos atrasados (2), Propietario sin CBU (1), Pagos a validar (5), Propietarios por rendir (4). Los números me dicen exactamente dónde está mi día. Toco la primera, la roja: **Reclamos sin asignar**.

**8:45 — Click en "Reclamos sin asignar".** Me lleva a `/reclamos`. Pero veo **TODOS los reclamos** (6), no solo los sin asignar (4). Los filtros que tengo arriba son Todos / Abiertos / Resueltos — ninguno dice "sin asignar". Me quedo confundido: el dashboard me prometió un filtro y la lista no lo tiene. **Termino mirando uno por uno cuál tiene "Sin asignar"** porque el badge ahí sí aparece.

**8:46 — Entro al reclamo de emergencia (Carlos Romero — saltó el térmico).** Excelente: el sistema ya me sugiere 7 profesionales con rating y categoría. Pero los muestra todos mezclados. Diego Ferrari es electricista (lo necesito), pero también veo Sergio (plomero), Luciana (gas), etc. ¿La IA no podría poner a Diego arriba con un badge "Recomendado para electricidad"? Termino haciendo scroll para confirmarme que Diego es la opción correcta.

**8:50 — Reviso /pagos.** *"Liquidaciones — Mayo 2026"*. Veo botones uno al lado del otro: **Plantilla · Plantilla · Plantilla · Plantilla · Validar por resumen · Cargar pago · PDF de morosos · PDF morosos por sociedad · PDF cobranzas · Recordar a morosos**. Son 10 botones en una fila. Los 4 "Plantilla" me dejan paralizado: *"¿cuál es cuál?"*. Y los 3 PDF distintos — clarísimo que tendrían que ser un solo botón **"Exportar PDF ▾"** con menú.

**8:55 — Click en "Validar por resumen".** Se abre un dialog: *"Sin contraseñas bancarias · solo lee el archivo que subas"* — ¡buenísimo el mensaje de confianza! El flujo de subir PDF + IA matchea inquilinos es genial. Pero el dialog **solo tiene un botón "Cerrar"** abajo. ¿Y si quiero subir? La zona "Tocá para elegir el resumen" en el medio es clickeable pero no destacada. **Casi cierro creyendo que el dialog estaba roto.**

**9:02 — Pruebo el wizard "Cargar contrato".** Voy a `/contratos/nuevo`. Veo el wizard: 1. Subir PDF, 2. Extracción IA, 3. Revisar, 4. Confirmar. Excelente. Pero **inmediatamente** se monta encima el tour de onboarding: *"PASO 1 DE 11 · ¡Bienvenido a My Alquiler!"*. Tengo que cerrar el tour ANTES de poder subir el PDF. Es como si la app me preguntara *"¿venís a hacer algo o querés que te explique el panel desde cero?"*. **A las 9:02 de un lunes, vine a HACER.**

**9:05 — Voy a /propiedades.** Veo: *"PROPIEDADES 6 · 1 alquilada"*. Pero hace 20 minutos en el dashboard leí: *"CONTRATOS ACTIVOS 6 · 83% ocupación"*. Si tengo 6 propiedades y 83% ocupación → debería tener 5 alquiladas, no 1. **¿Cuál es el número real?** Voy a la cama dudando si tengo 1 inquilino o 5. Si esto pasa con propiedades, ¿qué tan honesta es la app con el dinero?

**9:12 — Verifico un inquilino nuevo (`/screening`).** ESTO es lo mejor del producto. Pego CUIT, espero 30 segundos, recibo informe con score Nosis 742, BCRA categoría 1, "APTO sin garantía adicional". Esto justifica solo el plan. Pero el placeholder del CUIT dice `20-31256789-0` que es un CUIT VÁLIDO usable — pegué eso y me dio resultado real (Carlos Méndez). *"¿Estoy haciendo un screening de prueba o ya gasté una consulta del plan?"*. **El placeholder debería ser claramente inválido o decir "ej:".**

**9:30 — Cierro el panel.** Sensación general: cuando funciona, funciona muy bien (screening, anuncios IA, dashboard, plan/facturas). Pero hay 5-7 cosas chicas que me hacen perder confianza o tiempo cada día. Si arreglan eso, pasa de "bueno" a "premium".

---

## 3. Tabla priorizada — Matriz Impacto × Esfuerzo

| ID | Problema | Severidad | Esfuerzo | ¿Quick win? |
|---|---|---|---|---|
| **R-01** | Onboarding modal aparece en cada navegación a `/` | 🔴 Crítica | Bajo | ✅ |
| **R-10** | Inconsistencia "5 alquiladas" vs "1 alquilada" en dashboard vs /propiedades | 🔴 Crítica | Bajo | ✅ |
| **R-03** | Cards "Para resolver hoy" no aplican filtro al click | 🟠 Alta | Bajo | ✅ |
| **R-07** | 3 botones PDF distintos en /pagos sin agrupar | 🟠 Alta | Bajo | ✅ |
| **R-06** | 4 botones "Plantilla" sin contexto | 🟠 Alta | Bajo | ✅ |
| **R-04** | Tour onboarding aparece encima del wizard de carga | 🟠 Alta | Bajo | ✅ |
| **R-09** | Placeholder CUIT de screening es un CUIT real válido | 🟠 Alta | Bajo | ✅ |
| **R-02** | "Para resolver hoy" no diferencia emergencia de urgencia normal | 🟡 Media | Medio | — |
| **R-05** | Lista de 7 profesionales no destaca el recomendado por categoría | 🟡 Media | Medio | — |
| **R-08** | Dialog "Validar por resumen" único botón = "Cerrar" | 🟡 Media | Bajo | ✅ |
| **R-11** | H1 + H2 ambos "Anuncios" (duplicación de título) | 🔵 Baja | Bajo | ✅ |
| **R-12** | Wizard "1 2 3 4" vs tour "PASO 1 DE 11" — choque de paso-counters | 🟡 Media | Bajo | ✅ |

---

## 4. Hallazgos detallados

```
[#R-01] [Comunicación] — Onboarding modal aparece en cada visita a /
📍 Ubicación:     /, /reclamos/[id], /contratos/nuevo, /aprobaciones, /anuncios — TODA navegación nueva
👀 Qué vi:        Al entrar (y al volver al día siguiente, y a la semana) aparece "¡Bienvenido a My Alquiler! · PASO 1 DE 11". Es un coachmark fullscreen con "Siguiente / Saltar tour".
😖 Por qué molesta: Para un usuario recurrente es ruido. Cada vez que entra, "tiene que" cerrarlo. No encuentro toggle "ya vi esto, no lo muestres más" persistente en Configuración. La app trata al usuario como si fuera la primera vez SIEMPRE.
🔥 Severidad:     Crítica
🔧 Esfuerzo:      Bajo
✅ Recomendación: Persistir un flag `llave-inmo:onboarding-completado-v1` en localStorage cuando el usuario cierra el tour O cuando hace 3 acciones (login, abrir un contrato, marcar un pago). No volver a montar a menos que el usuario lo invoque desde Configuración → "Ver tutorial". Verificar el código en `apps/inmobiliaria/src/components/onboarding.tsx` — probablemente ya tiene la lógica pero el flag no se está respetando entre rutas.
```

```
[#R-02] [UI/Jerarquía] — "Para resolver hoy" no diferencia EMERGENCIA de URGENCIA NORMAL
📍 Ubicación:     / (dashboard, sección "Para resolver hoy")
👀 Qué vi:        Las 5 cards (Reclamos sin asignar, Inquilinos atrasados, Sin CBU, Pagos a validar, Por rendir) se ven todas iguales: mismo fondo blanco, mismo número grande, mismo subtítulo. Sólo la primera tiene un ⚠ rojo en el título.
😖 Por qué molesta: Si tengo 1 emergencia (térmico saltado a un inquilino), debería gritarme MÁS que "5 pagos por validar". La jerarquía actual los iguala.
🔥 Severidad:     Media
🔧 Esfuerzo:      Medio
✅ Recomendación: Las cards que contengan emergencias o vencidos > 5 días deberían tener border rojo + un mini-badge "EMERGENCIA" o "URGENTE". El resto se queda neutro. Considerar también ordenar la grilla por urgencia (no por categoría).
```

```
[#R-03] [Flujo] — Cards del dashboard no aplican el filtro al click
📍 Ubicación:     / → click en "Reclamos sin asignar" lleva a /reclamos (lista completa)
👀 Qué vi:        Toqué "Reclamos sin asignar (4)" y caí en /reclamos con los 6 reclamos visibles. Los filtros disponibles son "Todos / Abiertos / Resueltos" — ninguno de "sin asignar".
😖 Por qué molesta: La promesa visual era "te llevo a los 4 sin asignar". La realidad: "te llevo a todos, andá tocando uno por uno". 1+ click extra y carga cognitiva.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Cambiar el href a `/reclamos?filtro=sin-asignar` y agregar ese filtro a `apps/inmobiliaria/src/app/(app)/reclamos/page.tsx`. Lo mismo para "Pagos a validar" → `/pagos?tab=por-validar`. Es 1 query param + un useEffect que lo aplique.
```

```
[#R-04] [Comunicación/UX] — Tour onboarding tapa el wizard de "Cargar contrato"
📍 Ubicación:     /contratos/nuevo
👀 Qué vi:        Abrí el wizard para cargar un contrato. El header dice "1 Subir PDF · 2 Extracción IA · 3 Revisar · 4 Confirmar" y abajo está el dropzone. INMEDIATAMENTE se monta encima: "PASO 1 DE 11 · ¡Bienvenido a My Alquiler! · Te muestro las funciones principales del panel en 1 minuto".
😖 Por qué molesta: Vine A HACER algo concreto y la app me ofrece un tour del panel general. Es contradictorio: si llegué al wizard, es porque ya sé lo que quiero hacer.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Misma lógica del fix #R-01. Si bypaseo, ocultar para siempre. Y NUNCA mostrar el tour si la ruta actual NO es / (dashboard).
```

```
[#R-05] [UI/IA] — Lista de profesionales no destaca el recomendado por categoría
📍 Ubicación:     /reclamos/[id] (cuando vas a "Asignar profesional")
👀 Qué vi:        En el reclamo eléctrico (saltó el térmico de Carlos Romero) la lista muestra: Diego Ferrari (electricidad), Sergio Almeida (plomería), Luciana Pérez (gas), Frío Pro AA, Pablo Cerrajería, Camila Torres (pintura), Mudanzas Soto. 7 profesionales, todos al mismo nivel visual.
😖 Por qué molesta: La app YA sabe que el reclamo es de electricidad. Debería poner a Diego arriba con badge "Recomendado para electricidad", separado del resto con un divider y "Otros profesionales disponibles ▼".
🔥 Severidad:     Media
🔧 Esfuerzo:      Medio
✅ Recomendación: Filtro automático por `reclamo.categoria === profesional.categoria` en la primera tanda. Resto colapsado.
```

```
[#R-06] [Comunicación/Microcopy] — 4 botones "Plantilla" idénticos
📍 Ubicación:     /pagos (sección Liquidaciones, fila de acciones rápidas en cada moroso)
👀 Qué vi:        4 botones consecutivos con el label EXACTO "Plantilla". Sin sufijo, sin ícono distinto.
😖 Por qué molesta: Roberto no sabe cuál corresponde a qué plantilla. Tiene que pasar el mouse o tocar para descubrirlo. Cuatro labels idénticos en la misma fila es un anti-patrón clásico.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Renombrar cada botón con la plantilla específica: "Plantilla cordial", "Plantilla firme", "Plantilla legal", "Plantilla personalizada". O consolidar en un dropdown "Mensajes ▾" con las opciones listadas.
```

```
[#R-07] [UI/UX] — 3 botones PDF distintos uno al lado del otro
📍 Ubicación:     /pagos (acciones globales arriba a la derecha)
👀 Qué vi:        "PDF de morosos · PDF morosos por sociedad · PDF cobranzas" consecutivos. Más "Recordar a morosos" al lado.
😖 Por qué molesta: 3 botones que son LA MISMA acción (exportar PDF) con variantes. Saturan visualmente y obligan a leer cada uno para decidir.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Un solo botón "Exportar PDF ▾" que despliegue un dropdown con: Morosos · Morosos por sociedad · Cobranzas. Reduce 3 botones a 1 + menos carga visual.
```

```
[#R-08] [UI] — Dialog "Validar por resumen" único botón es "Cerrar"
📍 Ubicación:     /pagos → click en "Validar por resumen"
👀 Qué vi:        Se abre un dialog con texto explicativo "1. Subís PDF · 2. Leemos con IA · 3. Te sugerimos qué inquilino lo pagó · 4. Confirmás". Tiene un dropzone "Tocá para elegir el resumen". En el footer, UN solo botón: "Cerrar".
😖 Por qué molesta: La expectativa es ver al menos "Subir archivo" o "Continuar". El botón "Cerrar" como único CTA parece que el dialog está roto o incompleto. El input file es invisible y se confunde con texto plano.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Cambiar dropzone por un Button visible: "Elegir archivo de resumen". El "Cerrar" como secundario está OK pero al lado de "Subir" deja de verse roto.
```

```
[#R-09] [Microcopy/Seguridad mental] — Placeholder CUIT es un CUIT real válido
📍 Ubicación:     /screening → input CUIT/CUIL
👀 Qué vi:        El placeholder dice "20-31256789-0". Si lo escribo literal me da resultado real ("Carlos Méndez · APTO"). No hay prefijo "ej:" ni texto distintivo.
😖 Por qué molesta: Roberto puede creer que su consulta es de prueba y descubrir después que gastó una verificación del plan. Y los datos mostrados son inventados pero hilarantemente convincentes (DNI, score Nosis, etc) — confunde la lectura de demo vs real.
🔥 Severidad:     Alta
🔧 Esfuerzo:      Bajo
✅ Recomendación: Cambiar el placeholder a "Ej: 20-12345678-3 (sólo ejemplo)" O usar un CUIT obviamente falso ("20-00000000-X"). En la demo actual, en el resultado mock, agregar badge "DEMO · datos ficticios" arriba.
```

```
[#R-10] [Funcional/Confianza] — Inconsistencia "5 alquiladas (83%)" vs "1 alquilada"
📍 Ubicación:     / (dashboard "83% ocupación") vs /propiedades ("1 alquilada / 1 disponible")
👀 Qué vi:        Dashboard dice "CONTRATOS ACTIVOS 6 · 83% ocupación" (implica 5 alquiladas de 6). /propiedades dice "PROPIEDADES 6 · ALQUILADAS 1 · 1 disponible". El total coincide (6), pero "alquiladas" da resultados distintos (5 vs 1).
😖 Por qué molesta: Roberto pierde confianza en TODOS los reportes. Si las propiedades no concuerdan, ¿qué pasa con el dinero?
🔥 Severidad:     Crítica
🔧 Esfuerzo:      Bajo (definir UNA fuente de verdad)
✅ Recomendación: Unificar la definición de "alquilada".
- `dashboard-helpers.ts:46` cuenta `p.estado === 'ALQUILADA'`.
- `propiedades/page.tsx:107` cuenta `p.estado === 'ALQUILADA' && !tieneProblemas(p)`.
Renombrar la métrica de /propiedades a "Alquiladas OK" o "Sin problemas" para no usar la misma palabra, O cambiar la del dashboard a esta segunda definición. La métrica "tiene problemas" debe ser una métrica separada.
```

```
[#R-11] [UI/Microcopy] — H1 y H2 ambos dicen "Anuncios"
📍 Ubicación:     /anuncios
👀 Qué vi:        El topbar tiene H1 "Anuncios". Inmediatamente debajo, H2 "Anuncios". Dos veces el mismo título en 200px de altura.
😖 Por qué molesta: Redundancia visual + jerarquía rota. Sugiere que alguien duplicó el header.
🔥 Severidad:     Baja
🔧 Esfuerzo:      Bajo
✅ Recomendación: O dejar el H1 + descripción debajo, O mover el H2 a un sub-título más específico ("Mensajes a tus inquilinos" / "Próximos a enviar").
```

```
[#R-12] [UI/Carga cognitiva] — Choque de step-counters en /contratos/nuevo
📍 Ubicación:     /contratos/nuevo
👀 Qué vi:        Wizard arriba: "1 Subir PDF · 2 Extracción IA · 3 Revisar · 4 Confirmar". Al mismo tiempo, encima, el tour de onboarding: "PASO 1 DE 11". Hay dos "Paso 1" en pantalla refiriendo a cosas distintas.
😖 Por qué molesta: Carga cognitiva al diferenciar cuál es el progreso real vs el tour. Refuerza el problema #R-04.
🔥 Severidad:     Media
🔧 Esfuerzo:      Bajo
✅ Recomendación: Si arreglamos #R-04 (no mostrar tour en rutas no-dashboard), este desaparece solo.
```

---

## 5. Recomendaciones

### Quick wins (hacer esta semana — todos < 2h cada uno)

1. **#R-01 + R-04**: Persistir `onboarding-completado` y NO mostrar tour fuera de `/`. **Estimado: 1h.**
2. **#R-10**: Unificar definición de "alquilada" entre `dashboard-helpers.ts` y `propiedades/page.tsx`. **Estimado: 30 min.**
3. **#R-03**: Agregar `?filtro=` query param a los 5 cards "Para resolver hoy". **Estimado: 1h.**
4. **#R-07**: Consolidar los 3 PDFs en un dropdown "Exportar PDF ▾". **Estimado: 30 min.**
5. **#R-06**: Cambiar los 4 "Plantilla" por labels específicos. **Estimado: 15 min.**
6. **#R-09**: Cambiar el placeholder del CUIT a algo claramente inválido. **Estimado: 5 min.**
7. **#R-11**: Quitar el H2 duplicado en /anuncios. **Estimado: 5 min.**
8. **#R-08**: Reemplazar el dropzone invisible por un Button "Elegir archivo" en el dialog de validar por resumen. **Estimado: 20 min.**

**Total estimado quick wins: ~3-4 horas. Impacto: transforma "se siente algo descuidado" en "se siente premium".**

### Mejoras estratégicas (próximos sprints)

- **#R-02 + R-05**: Repensar la jerarquía visual de urgencia. Las emergencias (térmico, gas, agua corriendo) merecen tratamiento distinto en TODAS las pantallas (badge animado, color sólido, posición top, sonido si está agendado). Hoy hay una mezcla parcial.
- **Refactor onboarding**: en vez de coachmark de 11 pasos, considerar **inline empty states** ("Cuando tengas tu primer reclamo, va a aparecer acá") + un solo "Tour 1 min" opcional desde Configuración.
- **Métricas consolidadas**: revisar TODOS los KPIs cruzando lo que muestra dashboard vs sub-pantallas. La inconsistencia de "alquilada" probablemente no es la única.
- **Asistente de asignación**: la lista de profesionales puede ser mucho más inteligente (categoría + zona + rating + carga actual + última vez usado). Hoy es lista plana.

---

**Nota de cierre:** la mayoría de los problemas son **friction polish**, no rediseños de fondo. La base del producto (screening, dashboard, wizard de carga) está bien pensada. Los quick wins de arriba mueven la aguja MUCHO con poco esfuerzo.
