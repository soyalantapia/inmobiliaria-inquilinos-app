# Piloto Ramiro Villalón — prep de reunión (sáb 04/07) + onboarding (lun 06/07)

> Doc de trabajo para la reunión con Ramiro. Estado al **04/07/2026** (HEAD `108065e`).
> El tenant de demostración es **separado del real** (Tapia Propiedades) — nunca se toca Tapia.

## TL;DR — ¿está listo?

| Área para el piloto | Estado |
|---|---|
| Alta de cartera (propietario/propiedad/contrato) | ✅ listo (dry-run E2E 15/15 contra prod) |
| **Migración masiva de cartera** (Excel/CSV) | ✅ listo — **arranca al día** (fix 04/07, ver §2) |
| Contrato "en curso" con deuda histórica + mora | ✅ listo (wizard `periodosAnteriores`, mora dinámica) |
| **Resumen de morosidad con deuda real** | ✅ listo (`deudaTotal` acumulada + PDF de cobranza) |
| Lo que ve el inquilino (deuda exacta, mora) | ✅ listo (verificado en prod) |
| Consorcios (administración de edificios) | ⚙️ Fase 1 (CRUD) lista; Fase 2 (expensas) necesita 2-3 decisiones — ver §4 |

**No hay blockers técnicos para el lunes.** Lo que falta son decisiones de producto (§4).

---

## 1. Demo en vivo — guión

**Entrar como:** panel `admin.myalquiler.com` · tenant demo **"Inmobiliaria Demo Piloto"**
(usuario `alannaimtapia+demo-piloto@gmail.com`; la contraseña la tiene Alan — es un
tenant de demo descartable, no Tapia). Ya está cargado con 3 contratos que cuentan la historia:

1. **Marta ($500k) — el moroso.** Contrato cargado "en curso" (cuota 7 de 12): venía
   pagando y se atrasó. El sistema muestra **deuda real $845.000** (resto de mayo
   parcial + junio vencido + **mora** $30k/$15k congelada), no "un mes". → *Mensaje:
   "el sistema te dice quién debe cuánto de verdad, con la mora ya calculada."*
2. **Lucía ($450k) y Diego ($380k) — la cartera migrada.** Se subieron con una planilla
   Excel. Ambos aparecen **al día ($0)**: la migración **no inventa deuda vieja** —
   arranca a cobrar desde el mes de la migración. → *Mensaje: "subís tu Excel y en 2
   minutos tenés tu cartera adentro, sin quilombo de deuda falsa."*

**Qué mostrar (orden):** cartera → detalle de Marta (deuda + mora + liquidaciones mes a
mes) → **PDF "Morosos · cobranza"** (botón en /pagos: hoja imprimible con la deuda real
por inquilino) → lo que ve el inquilino en su app (deuda exacta, ponerse al día).

---

## 2. Migración de cartera para el LUNES — checklist de la planilla

Ramiro sube **su propia planilla** (Excel `.xlsx/.xls` o `.csv`, hasta 15 MB, hasta el
límite de filas). **No hay formato fijo:** el sistema detecta las columnas por su nombre
y él confirma/corrige el mapeo (3 pasos: subir → mapear → confirmar). Sinónimos que
autodetecta:

| Campo | Requerido | Nombres que reconoce |
|---|---|---|
| **Dirección** | ✅ | dirección, domicilio, propiedad, inmueble |
| **Inquilino** (nombre) | ✅ | inquilino, locatario, nombre |
| **Monto del alquiler** | ✅ | monto, alquiler, importe, valor, canon |
| **Fecha de inicio** | ✅ | inicio, desde, fecha inicio |
| Propietario | — | propietario, dueño, locador |
| Email / Teléfono / DNI | — | email/correo · teléfono/celular · dni/documento/cuit |
| Ciudad / Provincia / Tipo | — | ciudad/localidad · provincia · tipo |
| Fin de contrato / Día de pago | — | fin/hasta/vencimiento · día de pago |

**Validación fila por fila antes de confirmar:** OK / ADVERTENCIA (falta email o DNI, se
importa igual) / ERROR (falta un requerido) / DUPLICADO (email ya en la cartera).

⚠️ **Importante (fix 04/07):** un contrato migrado que arrancó hace meses **NO** nace
debiendo esos meses. La app empieza a devengar/cobrar desde la migración; el contrato
guarda su fecha de inicio real (para antigüedad y ajuste). Para cargar un inquilino que
**sí** viene atrasado, se usa el alta manual "contrato en curso" (marca los meses
pagados/parciales/adeudados) — como Marta.

**Sugerencia:** que Ramiro traiga su Excel real (aunque sea 5-10 contratos) para
migrarla en vivo el lunes. Si falta algún dato, no bloquea (se importa con advertencia).

---

## 3. Morosidad — cómo se ve el resumen

- En **/pagos** hay un botón que exporta el **PDF "Morosos · cobranza"**: una hoja
  imprimible con inquilino, propiedad, teléfono, garante, días de atraso y **la deuda
  real acumulada** (todas las cuotas impagas + mora) — no el alquiler mensual. Hay una
  variante **por sociedad gestora** para inmobiliarias con varias razones sociales.
- La deuda real por contrato (`deudaTotal`) también está en la lista de contratos y en
  el detalle. Se calcula server-side con la misma fuente de verdad que ve el inquilino.

---

## 4. Preguntas de producto para Ramiro (para desbloquear lo que sigue)

**Consorcios Fase 2 (emisión de expensas)** — la Fase 1 (cargar el edificio, unidades,
gastos, actas) ya está; para emitir/cobrar expensas necesito su forma real de trabajar:
1. **Honorarios de administración:** ¿cobra un % de los gastos del mes o un monto fijo
   por edificio? (es el modelo de ingreso del módulo).
2. **Fondo de reserva:** ¿aplica un % fijo sobre la expensa? ¿configurable por consorcio?
3. **Cobranza de expensas:** ¿la registra la inmo, o el titular de la UF la paga/informa
   por la app (como el alquiler)?

**Del negocio:**
4. ¿Cuántos contratos y cuántos edificios administra? (dimensiona el piloto).
5. ¿Cómo cobra hoy la mora? (validar que uno de los 4 esquemas ya cubiertos le sirve).

---

## 5. Riesgos / pendientes conocidos (transparencia)

- **WhatsApp automático a morosos:** el link/recordatorio hoy se manda a mano (el
  backend arma el texto; falta la cuenta de WhatsApp Business para automatizar).
- **Screening crediticio:** demo (falta integrar NOSIS).
- **Facturación del plan** (cómo le cobramos a la inmobiliaria): a definir con el negocio.
- **UI chica pendiente** (backend listo): foto de perfil del usuario del panel +
  adjuntar comprobante al gasto de caja. No afecta el piloto.

---

_Actualizá este doc después de la reunión con lo que decida Ramiro (§4) para desbloquear
Consorcios Fase 2 y el resto del roadmap._
