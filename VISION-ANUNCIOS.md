# 📣 Anuncios — visión de producto (cómo hacerlo superador)

> Pensado como PM, para los **dos lados**: inmobiliaria (emisor) e inquilino
> (receptor). No es implementación: es la visión y el roadmap para decidir.

---

## TL;DR

Hoy Anuncios es un **megáfono de una sola vía**: la inmobiliaria manda y *espera*
que lo lean; el inquilino *solo lee*. Funciona, pero no genera nada medible.

**La visión:** convertirlo en un **loop de comunicación accionable y medible** —
cada anuncio puede (1) **confirmarse leído**, (2) **llevar una acción de un toque**
y (3) **medirse y seguirse**. El anuncio deja de ser "info" y pasa a ser un
**mini-workflow** que mueve un job real (cobro, actualización de datos, asistencia,
aviso operativo).

Eso es lo que **Excel + WhatsApp no pueden hacer** → diferenciación defendible.

---

## Dónde estamos hoy (honesto)

**Inmobiliaria (emisor):** crea anuncio (título, cuerpo, prioridad, audiencia,
App+Email, confirmación de alcance), lista con métricas, filtro por prioridad,
borrar. **Pero envía a ciegas:** no sabe quién lo leyó ni si generó la acción.
`destinatariosCount` es solo "a cuántos lo mandé".

**Inquilino (receptor):** un feed en el home ("Anuncios de la inmobiliaria"),
colapsable, ordenado por prioridad. **Puramente lectura:** no hay "enterado", no
hay acción, no puede responder, no hay bandeja propia.

→ El círculo nunca se cierra. Ahí está todo el upside.

---

## Jobs-to-be-done

**Inmobiliaria:**
- Avisar a la gente correcta sin pisar mi WhatsApp *(✅ ya resuelto)*.
- **Saber si lo leyeron** y a quién insistir.
- **Que el aviso genere la acción** (que actualicen el CBU, que paguen, que confirmen).
- No repetir lo mismo 5 veces ni responder la misma duda 5 veces.
- Que quede **registro** de que avisé (disputas/legal).

**Inquilino:**
- Enterarme de **lo que me afecta**, sin ruido.
- Saber **qué tengo que hacer** (y hacerlo en un toque).
- Confirmar que me enteré (y no perder el aviso importante).
- Preguntar sin tener que llamar.

---

## Los 3 pilares

### 🔵 Pilar 1 — Cerrar el loop (acuse + medición) · *el gap más grande*
- **Inmobiliaria:** por anuncio, ver **Entregado / Leído / Confirmado** (X de N).
  Ej.: "Leyeron 4 de 6 · 2 sin leer" → botón **"Recordar a los que faltan"**.
- **Inquilino:** **"Enterado"** de un toque. En urgentes, pedir acuse explícito.
- **Valor inmo:** pasa de "espero que lo hayan visto" a "sé a quién insistir".
  Y **queda constancia de que avisé y que lo leyó** — clave en alquileres AR
  (conecta con el feedback "te deja todo el historial").
- *Impacto: Alto · Esfuerzo: Bajo–Medio. Este solo ya cambia la naturaleza del feature.*

### 🟢 Pilar 2 — Anuncios accionables (CTA → job) · *el "wow"*
El anuncio deja de ser texto y **lleva una acción** según el tipo:
| Tipo de anuncio | Acción de un toque (inquilino) | La inmo ve… |
|---|---|---|
| **Cambio de CBU** | "Actualizar mi forma de pago" (deep-link) | quién ya actualizó |
| **Recordatorio de vencimiento** | "Pagar ahora" (deep-link al checkout) | quién pagó |
| **Asamblea / visita técnica** | "Confirmar asistencia" (RSVP) | el conteo de asistentes |
| **Corte de agua / operativo** | "Enterado" | acuse |
| **Aumento / ajuste de canon** | acuse + link a la cláusula explicada | quién lo vio |

Ata el anuncio a los jobs reales (cobro, datos, reclamos). El megáfono se vuelve
**disparador de workflow**. *Impacto: Alto · Esfuerzo: Medio (1 CTA por vez).*

### 🟡 Pilar 3 — Menos esfuerzo + más relevancia
- **Inmo — redactar en 5 seg:** plantillas de los tipos recurrentes + **borrador
  con IA** (escribís "corte agua viernes 9-13" y arma el mensaje claro y on-brand).
  Conecta con el posicionamiento AI de la marca.
- **Inmo — set & forget:** programar envío + **recurrentes** (recordatorio de
  vencimiento mensual automático).
- **Inmo — targeting dinámico** (extiende audiencias): "avisar a los que **NO**
  actualizaron el CBU" / "a los morosos que **no leyeron**".
- **Inquilino — bandeja tranquila:** una sección **"Comunicaciones"** real (no solo
  feed en el home) con no-leídos, solo lo que le afecta (su edificio/contrato),
  urgentes arriba y **push** para urgentes. Calma + relevancia = confianza.

---

## Escenario héroe (para verlo concreto)

> **"Cambio de CBU"** — Roberto elige plantilla → IA redacta → audiencia "Todos
> los inquilinos" → envía por App + Email + push. Mariela recibe el push, abre,
> toca **"Actualizar mi forma de pago"** (1 toque, queda cargado) y marca enterado.
> Roberto ve **"5 de 6 actualizaron"** → toca **"Recordar al que falta"** → al
> sexto le llega un nudge. La próxima cobranza concilia sola.
> **Cero llamados, cero "¿cuál era el CBU?", y queda registro.** Eso es lo superador.

---

## Roadmap priorizado

| Fase | Qué | Por qué |
|---|---|---|
| **P0 — el leap mínimo** | Acuse "Enterado" (inquilino) + Leído/Confirmado por anuncio (inmo) + bandeja con no-leídos | Cierra el loop. Solo esto ya cambia la naturaleza del producto. Bajo esfuerzo. |
| **P1 — el wow** | Anuncios accionables con 2–3 CTAs clave (Actualizar CBU · Pagar · Confirmar asistencia) + "quién actuó" + recordar a los que faltan | El diferenciador que ata anuncio ↔ job. |
| **P2 — escala/eficiencia** | Plantillas + borrador IA + programar/recurrentes + targeting dinámico + push | Baja el esfuerzo del emisor y sube la relevancia del receptor. |

---

## Lo que NO haría (foco)
- **Chat bidireccional pesado / mensajería full.** Es otro producto y mata el foco.
  Alcanza con acuse + un "¿Dudas? Preguntá" liviano (la inmo responde una vez y la
  respuesta queda visible tipo FAQ). No reinventar WhatsApp.
- Convertir el feed en un muro/red social.
- Mil tipos de CTA: arrancar con los 2–3 que mueven la aguja.

## Nota de factibilidad
P0 y buena parte de P1 son **demostrables en el front** (todo es estado local /
cross-app hoy). Push real, IA y recurrentes piden backend — se pueden *mostrar*
en demo y dejar el contrato de datos listo.

---

## Conclusión
El salto no es "más campos en el formulario": es pasar de **avisar** a **cerrar el
círculo** (leído → acción → seguimiento). Con P0 el feature ya deja de ser un
megáfono; con P1 se vuelve algo que ninguna planilla puede igualar.
