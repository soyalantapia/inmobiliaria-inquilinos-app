# 🔁 PROMPT — Circuito completo E2E (escenario real, hasta el 2º pago)

> Pegá desde "OBJETIVO" hasta el final en una sesión de Claude que pueda controlar el
> navegador (extensión Claude in Chrome logueada, o control de pantalla). Recorre el
> **ciclo de vida completo** de una inmobiliaria de prueba: alta → propietario →
> propiedad → contrato → inquilino + co-inquilinos → **1er pago** → **2º pago**, con
> **backend real** (las dos apps comparten DB, así la plata fluye de verdad).

---

## ✅ ESTADO DEL BACKEND (2026-06-19)

- **Generación de liquidaciones: CONSTRUIDA y deployada.** Al **activar un contrato** (al crearlo en `POST /contratos`, o al aprobarlo si venía en borrador) el backend ahora **devenga las liquidaciones** (un cargo por mes, desde el inicio hasta el mes que viene inclusive). Así, una propiedad/contrato **nuevo** ya tiene el cargo del mes para pagar (1er pago) **y** el del mes siguiente (2do pago), sin tocar nada a mano. *(Idempotente: no duplica si se reactiva. Cubierto con test unitario del cómputo de períodos.)*
- **Email del inquilino normalizado a minúsculas** al crear el contrato → el login por OTP (que usa minúsculas) siempre matchea.
- **Co-inquilino: flujo real CONSTRUIDO y deployado.** El titular invita y comparte un **link de invitación**; el co-inquilino lo abre (`/invitacion/[token]`), **acepta** y recibe **su propia sesión** (sin OTP, identidad+permiso leídos de la DB). Según el permiso (**VER / PAGAR / COMPLETO**) puede ver el contrato y, con PAGAR o más, **informar pagos**. La Fase 4 ahora valida invitar **y aceptar**. *(Recién shippeado — verificalo e2e en este recorrido.)*

---

## OBJETIVO

Validar, de punta a punta y con **datos reales en la DB**, que el ciclo completo funciona: que al cargar una propiedad/contrato la propiedad queda alquilada, que el inquilino (y un co-inquilino) ven su contrato y los **datos de cobranza reales**, que un pago informado por el inquilino **llega al panel, se valida y se rinde al propietario**, y que todo eso se puede repetir para un **segundo período**. La cuenta tiene que **cerrar en cada paso** (monto − comisión = a rendir).

## ENTORNO Y REGLAS

- **Backend REAL** (no demo): panel `https://admin.myalquiler.com` · inquilino `https://app.myalquiler.com`. Las dos apps pegan a la misma DB → la plata fluye entre ellas.
- Usá una **inmobiliaria de PRUEBA nueva** (alta self-service en `/registro`), **NO** la cuenta real "Tapia Propiedades" — así no ensuciás datos de producción.
- Usá un **email que controles** para el inquilino y el co-inquilino (el login es por **código OTP al mail**; vas a necesitar leer esos códigos).
- **Datos bancarios = de la DB**: cargá la cuenta de cobranza en Configuración para que el inquilino vea CBU/alias reales (no el fallback "pedíselos a la inmobiliaria").
- El **screening** está en **Beta** (abre un popup "todavía no disponible") y el **Asistente IA** está pendiente — **no forman parte de este circuito**.
- En cada paso **verificá el resultado** (no alcanza con crear: confirmá que el estado cambió y que los montos cierran). Sacá screenshot de cada fase.

## DATOS DE PRUEBA (coherentes, ficticios)

- **Inmobiliaria:** "Inmobiliaria QA E2E" · email `qa.e2e+inmo@<tu-dominio>` · tel +54 9 11 5555 0000 · ciudad/prov Córdoba.
- **Cuenta de cobranza:** Banco Galicia · titular "Inmobiliaria QA E2E SRL" · CBU `0070XXXXXXXXXXXXXXXXXX` · alias `qae2e.cobranzas` · CUIT 30-71234567-1.
- **Propietario:** Juan Propietario · CUIT 20-30111222-3 · email `qa.e2e+prop@…` · **CBU/alias** `juan.propietario.cuenta` (sin CBU NO se puede rendir) · comisión 8%.
- **Propiedad:** Departamento · "Av. de Prueba 1234, 5°A, Córdoba" · 2 amb · 50 m².
- **Contrato:** monto $500.000 · expensas $80.000 · día de pago 10 · vigencia 24 meses desde hoy · índice IPC · comisión 8% · depósito 1 mes.
- **Inquilino:** Ana Inquilina · email `qa.e2e+inq@…` · CUIT/DNI a elección.
- **Co-inquilino:** Pedro Co · email `qa.e2e+co@…` · permiso LECTURA.

---

## CIRCUITO PASO A PASO

### FASE 0 — Alta de la inmobiliaria de prueba (panel)
1. `admin.myalquiler.com/registro` → crear "Inmobiliaria QA E2E" (paso 1: datos · paso 2: acceso/contraseña). Entrás al panel.
2. **Configuración › Empresa**: completar CUIT, teléfono, dirección.
3. **Configuración › Sociedades** (o donde esté la cuenta de cobranza): cargar **banco, titular, CBU, alias, CUIT** de cobranza. *(Esto es lo que el inquilino verá para transferir — tiene que ser real.)*
4. **Configuración › Seguridad**: crear el **PIN** (se pide para validar pagos y rendir).
- ✅ Verificar: el panel abre, el nombre es "Inmobiliaria QA E2E", el banner "Cuenta pre-lanzamiento / piloto" aparece.

### FASE 1 — Propietario
5. **Propietarios › Sumar propietario**: cargar Juan Propietario con **CBU/alias** y comisión 8%.
- ✅ Verificar: aparece en la lista, sin alerta "Falta CBU" (porque le cargaste CBU).

### FASE 2 — Propiedad
6. **Propiedades › Cargar propiedad**: tipo Departamento, dirección, m², y **asignar a Juan Propietario al 100%** (la suma de participaciones debe dar 100).
- ✅ Verificar: la propiedad aparece como **Disponible**.

### FASE 3 — Contrato + inquilino
7. **Contratos › Cargar contrato**: cargar el inquilino (Ana, email, DNI), monto $500.000, expensas $80.000, día de pago 10, vigencia 24 meses, índice IPC, comisión 8%, depósito. Confirmar. *(Si el wizard pide subir PDF, podés subir uno de prueba o completar manual.)*
8. Si el contrato queda en **Borrador / pendiente de aprobación** → **Aprobaciones › aprobar con PIN** → pasa a **Activo**.
- ✅ Verificar: la propiedad ahora figura **Alquilada**; el contrato **Activo**; Ana queda como inquilina titular.

### FASE 4 — Inquilino entra + co-inquilinos
9. `app.myalquiler.com` → entrar con el email de **Ana** → recibir y cargar el **código OTP** (revisá el mail). Ve su **home con el contrato**.
- ✅ Verificar: ve dirección, monto, día de pago. (Si no hay liquidación todavía → ver **Fase 5**.)
10. **Mi cuenta › Co-inquilinos › Invitar**: invitar a **Pedro Co** (email, permiso **VER** o **PAGAR**). Copiá el **link de invitación** que genera.
- ✅ Verificar: la invitación queda en la lista de co-inquilinos como **pendiente**.
11. **Aceptación real (ya está en prod):** abrí el **link** (`/invitacion/[token]`) en otra ventana/incógnito → se ve la propiedad y el rol → **Aceptar** → Pedro entra con **su propia sesión**.
- ✅ Verificar: Pedro ve el contrato; el co-inquilino figura **ACEPTADO** en el panel/lista. Si le diste permiso **PAGAR**, puede informar pagos; con **VER**, solo mira (intentar pagar debe dar 403).

### FASE 5 — Liquidaciones (ya se generan solas)
> ✅ **Construido.** Al activar el contrato (Fase 3) el backend ya devengó las liquidaciones: el **período actual** (para el 1er pago) y el **siguiente** (para el 2do pago). No hay que sembrar ni tocar nada.
- ✅ Verificar: en el home del inquilino aparece **un pago pendiente** (el mes actual) y, en "Próximos pagos"/comprobantes, el mes siguiente. Si no aparece nada, revisá que el email del inquilino del contrato coincida con el del login.

### FASE 6 — PRIMER PAGO
12. **Inquilino**: home → la 1ª liquidación aparece como **pendiente** → "Pagar" → **checkout**: ve los **CBU/alias REALES** (los que cargaste en Fase 0), copia los datos, "transfiere", **sube el comprobante** y lo informa.
- ✅ Verificar: el inquilino ve "pago informado / en revisión".
13. **Panel › Pagos**: el pago aparece en **"Pagos por validar"** con la lectura del comprobante → **"Confirmar + facturar ARCA"** (pide **PIN**).
- ✅ Verificar: la liquidación pasa a **Pagada**; el KPI **Cobrado** sube.
14. **Panel › Propietarios**: Juan ahora tiene **"A rendir" = monto − comisión** (ej. $500.000 + $80.000 = $580.000 cobrado − 8% = **$533.600** a rendir, según cómo aplique la comisión) → **Rendir** (PIN) → **"Rendido ✓"**.
- ✅ Verificar: "Sin rendir" baja; el monto a transferir = bruto − comisión.

### FASE 7 — SEGUNDO PAGO (período siguiente)
15. La **2ª liquidación** (período siguiente) ya existe: se generó junto con la 1ª al activar el contrato (Fase 5). El inquilino la ve como el próximo pago.
16. Repetir el flujo completo: **inquilino informa el 2º pago → panel valida (PIN) → rendir al propietario (PIN)**.
- ✅ Verificar: el inquilino ve **2 pagos** en "Comprobantes"; el contrato muestra **2 liquidaciones pagadas**; el propietario **2 rendiciones**.

### FASE 8 — Verificación final
- **Dashboard del panel**: KPIs coherentes (2 meses cobrados, propietario rendido, 0 en mora).
- **Inquilino**: "Mi certificado" refleja el **buen historial** (2 pagos al día, nivel sube).
- **Cierre de números**: en cada pago, `cobrado − comisión = a rendir`, y `alquiler + expensas = total de la liquidación`.

---

## QUÉ REPORTAR

Por cada fase: **✅/❌**, screenshot, y cualquier **fricción/bug** (campos confusos, validaciones, estados que no cambian, números que no cierran). Al final:
- ¿El circuito funciona **de punta a punta** con datos reales (alta → propietario → propiedad → contrato → inquilino → **1er pago → 2do pago → rendición**)?
- ¿En qué fase exacta se corta (si se corta) y por qué?
- **Lista priorizada** de lo que falta. Conocido hoy: (1) **devengo automático de meses futuros** (un cron/acción para que aparezcan nuevos períodos con el tiempo, más allá del actual + siguiente — hoy se generan al activar y hay que re-disparar para meses nuevos); (2) **aviso de la invitación al co-inquilino** (hoy el link se comparte a mano; falta enviarlo por mail/WhatsApp automáticamente).
