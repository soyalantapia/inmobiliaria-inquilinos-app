# ✅ Protocolo de QA MANUAL — Anuncios

> Para testear **vos a mano** (clickeando). Seguí los pasos en orden y marcá
> ✅ / ❌ en cada uno. Tiempo estimado: ~15 min.

## Antes de empezar

**Dónde entrar (local, lo que está corriendo):**
- 🏢 **Inmobiliaria** (sos *Roberto Tapia*): `http://localhost:3001/anuncios`
- 🏠 **Inquilino** (sos *Mariela Sosa*): `http://localhost:3000/login?demo=1`
  *(te lleva solo al Inicio)*

**Para probar en celular:** F12 → ícono de celular (responsive) → poné **375px**
de ancho. O abrilo directo desde tu teléfono.

**Tip:** si una pantalla aparece **en blanco**, es el servidor de desarrollo
(refrescá con Ctrl/Cmd+R; si sigue, avisá). No es parte del test.

---

# PARTE 1 — INMOBILIARIA (crear y gestionar)

Entrá a `:3001/anuncios` y tocá **"+ Nuevo anuncio"**.

### 1.1 — El formulario
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Mirá el formulario | Campos **Título** y **Cuerpo** con `*` (obligatorios), **Prioridad** y **Audiencia** | ☐ |
| Mirá "Cómo se envía" | Dice **"Por app y email"** fijo. **NO** hay opción de elegir canales ni WhatsApp | ☐ |
| Mirá el botón | Dice **"Revisar y enviar"** | ☐ |

### 1.2 — Audiencia y alcance (a cuántos llega)
Cambiá el desplegable **Audiencia** y mirá la línea **"Llega a N destinatarios"**:
| Audiencia | Tenés que ver | OK |
|---|---|---|
| Todos los inquilinos | Llega a **6** | ☐ |
| Inquilinos con pago vencido | Llega a **2** | ☐ |
| Inquilinos con pago pendiente | Llega a **1** | ☐ |
| Todos los propietarios | Llega a **5** | ☐ |
| Todos los consorcios | Llega a **2** | ☐ |

### 1.3 — Elegir consorcio / contratos puntuales
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Audiencia → **"Inquilinos de un consorcio"** | Aparece un **selector de consorcio** | ☐ |
| Elegí **"Consorcio Gorriti 4521"** | Llega a **1** | ☐ |
| Audiencia → **"Contratos específicos"** | Aparece una **lista de contratos** + un **buscador** | ☐ |
| Escribí **"cabildo"** en el buscador | Queda solo **Juan Pérez** | ☐ |
| Escribí **"laura"** | Queda solo **Laura Giménez** | ☐ |
| Escribí cualquier cosa que no exista | Dice **"Sin resultados"** | ☐ |
| Borrá el buscador | Vuelven los **6** contratos | ☐ |
| Tildá 2 contratos | Arriba dice "**2** seleccionados" y "Llega a **2**" | ☐ |

### 1.4 — Validaciones (tiene que frenarte)
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Dejá Título/Cuerpo vacíos y tocá "Revisar y enviar" | Aviso rojo **"Faltan datos"** | ☐ |
| Con "Inquilinos de un consorcio" sin elegir consorcio → enviar | Aviso **"Elegí un consorcio"** | ☐ |
| Con "Contratos específicos" sin tildar ninguno → enviar | Aviso **"Elegí al menos un contrato"** | ☐ |

### 1.5 — Confirmar y enviar
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Completá Título "Prueba", Cuerpo "Prueba", Audiencia "Todos los inquilinos" → "Revisar y enviar" | Ventana **"¿Enviar el anuncio?"** con "Vas a avisar a **6 destinatarios** (todos los inquilinos) **por app y email**. Esto no se puede deshacer." + botón **"Enviar a 6"** | ☐ |
| Tocá "Enviar a 6" | Mensaje **"Anuncio enviado"** y aparece la tarjeta **"Prueba"** en la lista | ☐ |

### 1.6 — Lista y filtro por prioridad
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Mirá arriba | 3 tarjetas: **Anuncios enviados / Destinatarios totales / Última semana** | ☐ |
| Mirá los botones de filtro | **Todas · Normal · Importante · Urgente**, cada uno con un **número** | ☐ |
| Tocá **"Importante"** | Quedan solo los anuncios importantes | ☐ |
| Tocá **"Urgente"** (si dice 0) | Dice **"No hay anuncios con prioridad urgente"** | ☐ |
| Tocá **"Todas"** | Vuelven todos | ☐ |

### 1.7 — La tarjeta del anuncio
| Qué tenés que ver en cada tarjeta | OK |
|---|---|
| Una **barra de color a la izquierda** según prioridad (la tarjeta NO está toda pintada) | ☐ |
| El cartel "Importante/Urgente" **solo** si no es Normal | ☐ |
| Abajo: **a quién llegó · N destinatarios** y quién lo envió + fecha | ☐ |
| **"Leído X/6 · Confirmado Y/6"** + una **barra de progreso** | ☐ |
| Un link **"Recordar a los que faltan"** | ☐ |

### 1.8 — Borrar (tiene que avisar bien)
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Tocá el **tachito** del anuncio "Prueba" que creaste | Ventana que avisa: se elimina **"para todos sus destinatarios"** y **les desaparece de la app** | ☐ |
| Confirmá "Eliminar" | La tarjeta "Prueba" desaparece de la lista | ☐ |

### 1.9 — En celular (375px)
| Qué tenés que ver | OK |
|---|---|
| Todo entra sin scroll horizontal | ☐ |
| El formulario "Nuevo anuncio" se abre a **pantalla completa** | ☐ |
| Hay barra de navegación abajo | ☐ |

---

# PARTE 2 — INQUILINO (recibir)

Entrá a `http://localhost:3000/login?demo=1` (entrás como **Mariela**) y bajá
hasta **"Anuncios de la inmobiliaria"** en el Inicio.

### 2.1 — Qué ve y sin leer
| Qué tenés que ver | OK |
|---|---|
| La sección **"Anuncios de la inmobiliaria"** con un cartel **"2 sin leer"** | ☐ |
| Aparece **"Corte de agua · Gorriti 4521"** (es de su edificio) y **"Nuevo CBU"** | ☐ |
| Cada anuncio sin leer tiene un **puntito violeta** y el título en **negrita** | ☐ |

### 2.2 — Abrir = leído
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Tocá un anuncio para abrirlo | Se expande el texto completo; el **puntito desaparece** y el cartel pasa a **"1 sin leer"** | ☐ |

### 2.3 — Marcar "Enterado"
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Tocá el botón **"Enterado"** de un anuncio | Pasa a **"✓ Enterado" en verde** y baja el contador "sin leer" | ☐ |
| Fijate que al tocar "Enterado" | **NO** se abre/expande el anuncio (solo confirma) | ☐ |

### 2.4 — Que no se pierda
| Qué hacer | Qué tenés que ver | OK |
|---|---|---|
| Refrescá la página (Ctrl/Cmd+R) | Los que marcaste siguen **leídos / Enterado** (no vuelve a "sin leer") | ☐ |

### 2.5 — En celular (375px)
| Qué tenés que ver | OK |
|---|---|
| Todo entra sin scroll horizontal | ☐ |
| El botón "Enterado" se ve y se puede tocar | ☐ |
| En el anuncio del CBU, el **número de CBU completo** se ve (no se corta) | ☐ |

---

## ⚠️ Importante para no confundirte
- El **"Leído X/6 · Confirmado Y/6"** que ve la inmobiliaria es una **estimación de
  demo** (en el sistema real lo calcula el servidor). Si marcás "Enterado" como
  inquilino, **ese número de la inmobiliaria NO cambia en la demo** — es esperado,
  no es un error.

## 🐞 Si encontrás un bug, anotá
- En qué app (inmobiliaria / inquilino), en qué paso (ej. 1.3).
- Qué hiciste, qué viste, y qué esperabas ver.
- Si es en celular o en computadora.
