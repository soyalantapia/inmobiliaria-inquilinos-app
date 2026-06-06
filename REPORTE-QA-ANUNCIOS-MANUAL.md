# 🧪 REPORTE — QA manual de Anuncios (ejecutado por Claude Code)

> Ejecución del prompt `PROMPT-QA-ANUNCIOS-CLAUDE-CODE.md`. Todo **medido** vía DOM
> en vivo (Claude Preview), viewports reales, las 3 REGLAS aplicadas.

## REGLA 0 — Identidad
- `:3000` y `:3001` = **My Alquiler**. Contaminación (Deenex/Palta/San Pedro) = **0**.
- En esta corrida **no hizo falta reiniciar** ningún server: ambos renderizaron bien
  (inmo bodyLen 1219, h1 "Anuncios"; inquilino feed OK). El HMR corrupto no apareció.

## Resumen
| | |
|---|---|
| Checks | **14** (1.1–1.9 inmobiliaria + 2.1–2.5 inquilino) |
| Verdes | **14 / 14** ✅ |
| Bugs reales | **0** |

**Veredicto: Anuncios PASA el QA manual (14/14).**

---

## PARTE 1 — Inmobiliaria (`:3001/anuncios`)

| # | Check | Resultado (medido) |
|---|---|---|
| 1.1 | Formulario | ✅ Título/Cuerpo presentes · "Por app y email" fijo · sin toggle/chips WhatsApp · botón "Revisar y enviar" |
| 1.2 | Audiencia + alcance | ✅ Todos=**6** · Vencido=**2** · Pendiente=**1** · Propietarios=**5** · Consorcios=**2** |
| 1.3 | Sub-selección | ✅ Gorriti→**1** · buscador `cabildo`→Juan, `laura`→Laura, inexistente→"Sin resultados", vacío→**6**, 2 tildados→**2** |
| 1.4 | Validaciones | ✅ "Faltan datos" · "Elegí un consorcio" · "Elegí al menos un contrato" |
| 1.5 | Confirmar + crear | ✅ "Vas a avisar a **6 destinatarios** (todos los inquilinos) por app y email" + "Enviar a 6" → toast "Anuncio enviado" + card creada |
| 1.6 | Métricas + filtro | ✅ Métricas **3 / 18 / 1** · pills **Todas 3 · Normal 2 · Importante 1 · Urgente 0** · filtra · Urgente→"No hay anuncios con prioridad urgente" |
| 1.7 | Tarjeta + acuse | ✅ barra de color izq · sin chips de canal · pie audiencia·destinatarios · progress + "Recordar" · **Leído/Confirmado: 4/6·3/6, 3/6·2/6, 2/6·1/6** (varían) |
| 1.8 | Borrar avisa | ✅ "Se elimina … **para todos sus destinatarios (6)**. También les desaparece de la app…" → borrado OK (sin basura) |
| 1.9 | Mobile 375 | ✅ overflow **0** · diálogo **full-screen** · bottom-nav |

## PARTE 2 — Inquilino (`:3000`, demo Mariela)

| # | Check | Resultado (medido) |
|---|---|---|
| 2.1 | Feed + sin leer | ✅ badge **"2 sin leer"** · "Corte de agua · Gorriti 4521" + "Nuevo CBU" · 2 dots · 2 botones |
| 2.2 | Abrir = leído | ✅ expandir → cuerpo completo, dot quitado, **2→1 sin leer** |
| 2.3 | Acuse "Enterado" | ✅ → **"✓ Enterado" verde** · baja a **0 sin leer** · **no togglea** el expand |
| 2.4 | Persistencia | ✅ tras reload sigue **0 sin leer** + confirmado verde (localStorage) |
| 2.5 | Mobile 375 | ✅ overflow **0** · "Enterado" visible · **CBU completo** (0070100120000018273645) no se trunca |

---

## Hallazgos reales
**Ninguno.** 0 bugs, 0 overflow real, todas las interacciones medidas OK.

## Notas / falsos positivos (REGLA 2)
1. **"Leído X/N" del inmo = simulado determinístico** (por diseño; cross-origin en
   dev). El "Enterado" del inquilino no lo cambia en dev. **No es bug** — el acuse
   del inquilino (no-leídos + persistencia) sí es real y se verificó.
2. **V4 "Sin destinatarios"** no es alcanzable con datos seed (presets ≥1; los casos
   0 los atrapan las validaciones de consorcio/contratos). Guard defensivo correcto.
3. **Artefacto scrollbar ~5px**: no apareció (overflow 0 en todo).

## Conclusión
14/14 verdes. El loop emisor↔receptor de Anuncios funciona end-to-end (envío
dirigido + confirmación de alcance del lado inmo; bandeja no-leídos + acuse
"Enterado" persistente del lado inquilino). **Pasa el QA.**
