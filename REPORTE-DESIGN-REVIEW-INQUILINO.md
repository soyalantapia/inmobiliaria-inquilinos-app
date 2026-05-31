# 🎨 Design Review (gstack) — App Inquilino (PWA mobile)

> Corrido con el skill `/design-review` de gstack usando el navegador `browse`, viewport **390×844 real** (mobile). Todos los números medidos con la herramienta.

## Alcance real (honesto)

**Lo que pude auditar:** la pantalla de **login a 390px mobile**.

**Lo que NO pude auditar:** la app interna de Mariela (home, pagos, reclamos, contrato, comprobantes, cuenta). El login es OTP de 6 dígitos: el botón "Probar con cuenta demo" solo **prefilla el email** (no loguea), y completar el OTP requiere pedir código → leerlo del banner → tipear 6 inputs → submit. Logré pedir el código (`362960`), llenar los 6 inputs (el botón "Entrar" se habilitó) y hacer click, pero el handler de verificación de React no completó vía eventos sintéticos de `browse`, y el navegador crasheó dos veces en el intento. **No entré.** Reporto solo lo que medí; no invento hallazgos de pantallas que no vi.

> Nota: la app interna del inquilino **ya fue auditada a fondo** por producto (21 fixes M-* en `REPORTE-AUDITORIA-UX-INQUILINO.md`) y se recorrió con el preview tool en sesiones previas. Lo que faltaba era el ojo de `browse` con medición de DOM real — que es lo que aporta este pase, limitado al login por la barrera del OTP.

---

## Hallazgos medidos (login, 390px)

### ✅ Lo que está bien (medido, no asumido)
- **Sin overflow horizontal** a 390px (`scrollWidth == clientWidth`). No hay scroll lateral, el pecado mortal de mobile.
- **Input de email: 48px de alto, font-size 16px.** Los 16px son clave: iOS **no hace auto-zoom** al enfocar el campo (pasa con <16px). Bien resuelto.
- **CTA "Recibir código por email": 56px de alto.** Área táctil cómoda, por encima del mínimo de 44px.
- **Una sola tipografía** (Inter) — sin font soup.
- **DemoBanner abajo, sin tapar el form** — confirma en vivo el fix de posición de la sesión anterior (antes pisaba el header).

### Sub-44px en login: 3 elementos (todos aceptables)
| Elemento | Tamaño | ¿Problema? |
|---|---|---|
| "Probar con cuenta demo" | 302×**34**px | Menor: es CTA secundario (chip dashed). Subir a 44px sería ideal pero no crítico. |
| "Conocé la plataforma" (banner demo) | 123×**16**px | Aceptable: link dentro del banner de aviso, no target primario. |
| ✕ cerrar banner | **20×20**px | Menor: el cierre del banner demo podría ser más grande. |

**Contraste con la landing:** el login del inquilino tiene **3 sub-44px** (2 dentro del banner demo que no va a producción real) vs **54 en la landing**. La PWA arrancó con mejores fundamentos táctiles — coherente con que se diseñó mobile-first.

---

## Veredicto

El **login del inquilino está bien diseñado para mobile**: sin overflow, input a 16px (anti-zoom iOS), CTA de 56px, una tipografía. Los 3 sub-44px son menores y 2 viven en el banner demo (que no es producción).

**Límite del pase:** el OTP es una barrera real para `browse` — no es un bug de la app, es que el flujo de 6 inputs + verificación React no se completa con eventos sintéticos. Para auditar la app interna del inquilino con `browse` haría falta una de estas dos cosas:
1. Una **ruta de bypass de login en modo demo** (ej. `?demo=1` que setee la sesión directo), útil además para tu propio testing.
2. O seguir usando el **preview tool** (mismo origin, sí completa el OTP), que es como se auditó antes.

**Sin hallazgos accionables nuevos** más allá de los 3 menores del login — y ninguno amerita un fix arriesgado. No toco código en este pase: la app de login está sólida y la app interna no la pude medir con esta herramienta.
