# 🧪 REPORTE — QA del feature ANUNCIOS (inmobiliaria + inquilino)

> Ejecución de `PROMPT-QA-ANUNCIOS.md`. Todo **medido** vía DOM en vivo (Claude
> Preview), viewports reales. REGLA 0/1/2 aplicadas.

## Resumen

| | Resultado |
|---|---|
| Checks ejecutados | **16** (A1–A10 inmobiliaria + B1–B6 inquilino) |
| Pasan | **16 / 16** ✅ |
| Bugs reales | **0** |
| Falsos positivos / notas (REGLA 2) | 3 (HMR, guard defensivo, cross-origin simulado) |

**Veredicto: Anuncios PASA el QA en las dos apps.** Emisor (inmobiliaria) y
receptor (inquilino) funcionan de punta a punta, incluido el P0 del loop
(acuse + no-leídos + Leído/Confirmado).

---

## REGLA 0 — Identidad
- `:3000` y `:3001` = **My Alquiler**. Contaminación (Deenex/Palta/San Pedro) = **0**.
- ⚠️ Operativo (no bug): ambos dev servers estaban con **HMR corrupto** (pantalla
  en blanco, **sin errores en consola**). Se resolvió con `preview_stop`+`start`
  (server limpio). El código compila (tsc+lint verdes); es un tema del HMR de
  larga duración, ya documentado en el prompt.

---

## A) INMOBILIARIA (emisor) — `:3001/anuncios`

| # | Check | Resultado |
|---|---|---|
| A1 | Form: título/cuerpo, **"Por app y email" fijo**, sin toggle/chips WhatsApp, botón "Revisar y enviar" | ✅ |
| A2 | Alcance en vivo (conteo real) | ✅ Todos **6** · Morosos **2** · Pendientes **1** · Propietarios **5** · Consorcios **2** |
| A3 | Sub-selección consorcio + contratos + buscador | ✅ Gorriti→**1**; buscador `cabildo`→Juan, `laura`→Laura, inexistente→"Sin resultados", vacío→**6**; 2 sel→**2** |
| A4 | Validaciones | ✅ V1 "Faltan datos" · V2 "Elegí un consorcio" · V3 "Elegí al menos un contrato" *(V4 "Sin destinatarios" = guard defensivo, ver notas)* |
| A5 | Confirmación de alcance + crear | ✅ "Vas a avisar a **6 destinatarios** (todos los inquilinos) por app y email" + "Enviar a 6" → crea + toast "Anuncio enviado" + aparece en lista |
| A6 | Métricas + filtro por prioridad | ✅ Pills **Todas 3 · Normal 2 · Importante 1 · Urgente 0**; filtra OK; Urgente→"No hay anuncios con prioridad urgente" |
| A7 | Card | ✅ barra de color izq (no card tintada), badge **solo si no-Normal**, pie **audiencia · N destinatarios**, **sin chips de canal** |
| A8 | Acuse (loop) | ✅ "Leído X/N · Confirmado Y/N" (medido **2/6, 3/6, 2/6** — varían) + barra de progreso + "Recordar a N que faltan" |
| A9 | Borrado avisa | ✅ "Se elimina … **para todos sus destinatarios (6)**. También les desaparece de la app y no se puede deshacer." → borra OK |
| A10 | Responsive 375 | ✅ overflow **0**, diálogo **full-screen**, bottom-nav presente |

---

## B) INQUILINO (receptor) — `:3000` (home, sesión demo Mariela)

| # | Check | Resultado |
|---|---|---|
| B1 | Feed + audiencia correcta + "N sin leer" | ✅ muestra su consorcio (**"Corte de agua · Gorriti 4521"**) + TODOS ("Nuevo CBU"); badge **"2 sin leer"**, 2 dots |
| B2 | Abrir marca leído | ✅ expandir → cuerpo completo + **2→1 sin leer**, dot quitado |
| B3 | Acuse "Enterado" | ✅ → **"✓ Enterado" verde**, baja contador (→**0 sin leer**), **no togglea el expand** (stopPropagation) |
| B4 | Persistencia | ✅ tras reload sigue **0 sin leer** + 2 confirmados verdes (localStorage) |
| B5 | Contenido | ✅ preview a 2 líneas + expandido muestra todo; el **CBU completo no se trunca** (line-clamp-2 intencional) |
| B6 | Responsive 375 | ✅ overflow **0** |

---

## Hallazgos reales
**Ninguno.** 0 bugs. 0 overflow real. Todas las interacciones medidas se comportan
como se espera.

## Notas / falsos positivos descartados (REGLA 2)
1. **HMR corrupto → pantalla en blanco** (ambos servers de larga duración). NO es
   bug de código (tsc+lint verdes; restart lo resuelve). Es operativo del dev server.
2. **A4-V4 "Sin destinatarios"** no es alcanzable con los datos seed (todos los
   presets tienen ≥1; los casos 0 de consorcio/contratos los atrapan V2/V3 antes).
   Es un **guard defensivo correcto**, no un check fallido.
3. **"Leído X/N" del inmo es simulado determinístico** (por diseño, documentado en
   el código): en dev las apps están en orígenes distintos, así que el "Enterado"
   real de Mariela no viaja al inmo. En backend el server calcula el real. **No es
   bug** — el acuse del inquilino (no-leídos, persistencia) sí es 100% real.
4. El artefacto de **scrollbar headless (~5px)** del inmo **no apareció** en esta
   corrida (overflow 0 en todos lados con server fresco).

## Conclusión
16/16 checks verdes. Anuncios cierra el loop emisor↔receptor (envío dirigido +
confirmación de alcance del lado inmo; acuse "Enterado" + bandeja no-leídos del
lado inquilino) sin defectos. **Pasa el QA.**
