# 🧪 PROMPT — QA funcional de My Alquiler (para pegar en Claude Code)

> Copiá TODO el bloque de abajo (desde la línea `═══`) y pegalo como mensaje
> en Claude Code con el repo `inmobiliaria-inquilinos-app` abierto. El agente
> recorre el producto, reporta y arregla lo que encuentre.

═══════════════════════════════════════════════════════════════════

# 🧪 QA FUNCIONAL — My Alquiler

Sos un ingeniero de QA senior. Tu trabajo: recorrer este producto de punta a
punta, **comprobar que cada cosa funciona**, encontrar bugs reales, y
arreglarlos con cuidado. No es auditoría de diseño (eso ya se hizo): es QA de
**comportamiento** — ¿hace lo que dice? ¿se rompe? ¿los datos son coherentes?

## CONTEXTO DEL PRODUCTO

- **Qué es:** plataforma para administrar alquileres en Argentina. Monorepo con
  3 superficies + landing.
- **Stack:** Next.js 14 (App Router), Turborepo + pnpm, static export, **todo
  mock en localStorage, SIN backend**. Es una demo navegable.
- **Repo:** `~/dev/inmobiliaria-inquilinos-app`
- **Idioma del producto:** español rioplatense (vos/tenés).

### Superficies y cómo levantarlas
```bash
pnpm --filter inquilino dev      # → http://localhost:3000  (PWA mobile, inquilina Mariela)
pnpm --filter inmobiliaria dev   # → http://localhost:3001  (panel desktop, dueño Roberto)
```
Landing + legales son estáticas: `bash scripts/build-static.sh` → `out/presentacion/`, `out/legales/`.
**Producción (ya deployada):** `https://soyalantapia.github.io/inmobiliaria-inquilinos-app/{inmobiliaria,inquilino,presentacion,legales}/`

### ⚠️ GOTCHA de build (te va a pasar): 
`scripts/build-static.sh` ABORTA si hay un dev server corriendo en :3000/:3001
(lo chequea `check-dev-port.js`). Para buildear, MATÁ primero los dev:
`lsof -ti:3000 -ti:3001 | xargs kill -9`. Para QA en vivo, dejá el dev corriendo.

### Accesos demo (no hay datos reales)
| Quién | Acceso |
|---|---|
| Roberto (inmobiliaria) | entra solo, mock auto-login |
| Mariela (inquilina) | `localhost:3000/login?demo=1` entra directo SIN OTP. (O botón "Probar con cuenta demo" → código aparece en banner amarillo DEMO.) email: `mariela.sosa@gmail.com` |
| Garante (público) | `/inquilino/garantes/demo` |
| Profesional (público) | `/inquilino/p/demo` |
| Verificar certificado (público) | `/inquilino/verificar/16NJ-PTVB-KF8B` |

### IDs reales del mock (usá ESTOS, no inventes)
- Propiedades: `prp_001` (NO `prop_001`) · Propietarios: `own_001`..`own_005`
- Contratos: `cnt_001` (Mariela), `cnt_008` (tiene chat IA) · Reclamos: `rec_006`
- Consorcios: `cnsr_001`, `cnsr_002`
- **Antes de reportar un 404, confirmá el ID real** en `apps/*/src/lib/*mock*.ts`
  o en el `generateStaticParams` de la ruta. Un 404 con ID inventado NO es bug.

## REGLAS DE DISCIPLINA (las más importantes — leelas dos veces)

1. **Verificá que estás mirando la app correcta ANTES de medir nada.** En esta
   máquina hay varios proyectos corriendo en puertos cercanos (Deenex, Palta,
   etc.). Confirmá que el HTML diga "My Alquiler" / "Inmobiliaria del Sol":
   `curl -s localhost:3000/login | grep -ci "my alquiler"` debe dar > 0 y
   `grep -ci "deenex\|palta"` debe dar 0. Si ves "Panel Administrador" o un logo
   ajeno, estás en el proyecto equivocado — pará y arreglá el puerto.
2. **Verificá antes de reportar. No inventes.** Si una herramienta tira una
   bandera (404, número raro, "parece roto"), confirmala con una segunda
   medición ANTES de anotarla como bug. En este proyecto, ~5 de cada 6 banderas
   resultaron falsos positivos (ID inventado, build viejo cacheado, dir sin
   borrar). Un reporte con un bug real verificado vale más que diez sospechas.
3. **Nunca escribas un número/métrica que no mediste en el build/estado actual.**
   Si no lo pudiste medir, decí "no pude medirlo" — no lo estimes.
4. **No toques datos productivos ni hagas acciones destructivas.** Es demo con
   mocks, pero igual: proponé el fix en código, verificá, commiteá. No borres
   datos ni fuerces flujos irreversibles.
5. **Un commit por fix**, mensaje claro, y `tsc --noEmit` + (cuando aplique)
   `next lint` en verde ANTES de commitear. Si rompés el build, revertí.

## QUÉ RECORRER (job-to-be-done, no pantalla por pantalla)

### Bloque 1 — Smoke test (¿todo carga?)
Recorré las 16 rutas del inquilino y las 24 de la inmobiliaria (listalas con
`find apps/*/src/app -name "page.tsx"`). Cada una debe dar HTTP 200 y no tirar
error en consola. Anotá las que fallen (con el ID real, ver regla de IDs).

### Bloque 2 — Flujos centrales (¿hacen lo que dicen?)
- **Inmobiliaria:** validar/aprobar un pago, cargar contrato con el wizard IA,
  asignar profesional a un reclamo, rendir a un propietario, revisar el
  historial de Auditoría (Configuración → Auditoría).
- **Inquilino (entrá con `?demo=1`, viewport mobile ~390px):** pagar el mes
  (subir comprobante), cargar un reclamo, preguntarle al Broker IA del contrato,
  ver comprobantes.
- **Públicos:** abrir garante, profesional y verificar-certificado. El de
  **verificar NO debe redirigir a login** (es público por diseño) — si te manda
  a login es ❌ CRÍTICO.

### Bloque 3 — Coherencia cruzada (acá saltan los mejores bugs)
- El contrato de Mariela (dirección, monto, inmobiliaria) que ve la app
  inquilino debe COINCIDIR con lo que ve Roberto en la propiedad/propietario.
- El CBU que ve Mariela para pagar = la cuenta recaudadora de la inmobiliaria.
- Marca consistente: todo debe decir "My Alquiler" / "Inmobiliaria del Sol".
  Si aparece otro nombre → contaminación de otro proyecto.
- Coherencia interna de datos: ej. un consorcio que dice "X UF" debe tener X
  unidades reales en su array (no un número que no cuadra).

### Bloque 4 — Romper a propósito (recuperación de errores)
- Inquilino: código OTP mal 5 veces → debe bloquear. Código expirado (>5min) →
  "pedí otro".
- Inmobiliaria: rendir a propietario sin CBU → debe avisar (no necesariamente
  bloquear; avisar y permitir otro método es correcto).
- Navegá a `/cualquier-cosa-que-no-existe` → debe haber un 404 útil (las dos
  apps tienen `not-found.tsx`), no pantalla en blanco.
- Recargá (F5) en medio de un flujo → ¿se pierde lo cargado? ¿el onboarding
  reaparece (no debería si ya lo viste)?

### Bloque 5 — Regresión (¿lo ya arreglado sigue bien?)
Hay ~90 fixes previos documentados en `REPORTE-*.md` (raíz del repo). Si
encontrás algo, chequeá si ya está documentado antes de marcarlo nuevo.
Verificá que estos sigan en pie: `/verificar` es pública, hash de certificado
es estable (no cambia entre builds), footer de la landing no está vacío, rol
"Carga limitada" coherente entre app y landing.

## CÓMO REGISTRAR CADA HALLAZGO
```
[#ID] BLOQUE — Ruta/componente
👀 Qué hice y qué vi (concreto, medido)
✅ Verificación: cómo confirmé que es real (no falso positivo)
🔥 Severidad: Crítica / Alta / Media / Baja
🔧 Fix: qué cambiar (archivo:línea) — o "deferido: requiere decisión del dueño"
```

## ENTREGABLE
1. Generá `REPORTE-QA-FUNCIONAL.md` con: resumen (cuántas rutas OK, cuántos
   bugs reales, cuántos falsos positivos descartados), hallazgos detallados,
   y los falsos positivos que descartaste (para que no se reporten de nuevo).
2. Arreglá los bugs Críticos/Altos de bajo riesgo (CSS, copy, datos mock,
   lógica clara). Para cada uno: fix → `tsc` verde → commit atómico → push.
3. Los que requieran decisión de marca/negocio o backend: dejalos en el
   reporte como "deferido" con la recomendación, NO los apliques solo.
4. Al final: confirmá `git status` limpio, 0 commits sin pushear, y si tocaste
   código verificá en producción (o build local) que el fix está vivo.

Arrancá levantando las apps, verificá identidad (regla 1), y empezá por el
smoke test. Pensá en voz alta qué vas comprobando.

═══════════════════════════════════════════════════════════════════
