# Estado del proyecto — My Alquiler

> **Documento de handoff.** Resumen ejecutivo de dónde está el proyecto hoy.
> Última actualización: **2026-08-20**. Último commit en `main`: `70b8525`.
> **Último hito (19-20/08): el portal del propietario en pestañas, y la suite de integración
> corriendo por primera vez.** Las dos cosas se cuentan juntas porque la segunda destrabó a la
> primera. Detalle abajo, en «Verificado el 20/08».
> Hito previo (28/07): caza de REGRESIONES sobre los fixes del 27.
> Sobre ese hito: 14 confirmados,
> **los 14 cerrados**, 3 de ellos regresiones directas de los fixes del día anterior
> (una costaba plata). Estuvo semanas en `main` sin deployar; hoy ya está en producción. Detalle en
> `03-AUDITORIAS.md` §caza de regresiones 28/07.
> Hito previo (27/07): cacería sistemática — ~75 hallazgos, **40 corregidos y deployados**.
> Hitos previos (todo en prod, back+front, E2E/verificación OK):
> **(1) Eliminación del PIN** de seguridad en TODA la plataforma (kill-switch `verificarPinUsuario`
> siempre-ok; ninguna acción pide PIN). **(2) Reclamos "¿quién paga?"** — propietario/inquilino/
> depósito con **impacto real en la plata** (rendición del dueño / cargo al inquilino / deducción del
> depósito) + costo + moneda formateada + historial del profesional. **(3) "Pagos recibidos"** en los
> comprobantes del inquilino: los cobros (incluidos los manuales de la inmo) se ven como transacciones.
> Hitos previos (05/07): **ciclo de vida del contrato** (depósitos en custodia, rescisión con
> penalidad+neteo, ajuste de alquiler, saldar deuda de ex-inquilinos, renovación) e **historial de
> inquilinos** (entidad `Persona` + ficha + reuso + expediente). Ver `CHANGELOG.md` para el detalle.
> Contexto absoluto en [`../PROJECT.MD`](../PROJECT.MD). Detalle en los demás `work-agent/`.

## Qué es

**My Alquiler** (codename `@llave/*`) es un SaaS **multi-tenant** de gestión de
alquileres para **Tapia Propiedades** (y futuras inmobiliarias). **Tres** frentes:

- **Panel de la inmobiliaria** (admin): contratos, propiedades, propietarios, pagos,
  rendiciones, caja, reclamos, equipo, sociedades, configuración.
- **PWA del inquilino**: contrato/liquidaciones, informar pagos con comprobante,
  boletas de servicios, reclamos, co-inquilinos, notificaciones.
- **Portal del propietario** (`apps/propietario`, puerto 3003): de **sólo lectura**, en cuatro
  pestañas — Pagos (lo que se le rindió, más lo cobrado y todavía sin rendirle), Unidades,
  Reclamos y Perfil. Login por OTP al email que la inmobiliaria le tiene cargado. Este doc
  decía "dos frentes" y hacía meses que eran tres.

## EN VIVO (producción, Railway)

| Servicio | URL |
|---|---|
| Panel inmobiliaria | **https://admin.myalquiler.com** |
| PWA inquilino | **https://app.myalquiler.com** |
| Portal del propietario | **https://admin.myalquiler.com/propietario** — sin servicio propio: es un export estático servido por el panel. Ver `02-DEPLOY.md`. |
| API | https://api-production-262e.up.railway.app (`GET /health`) |

> ### 🔴 Credenciales — la de producción hay que ROTARLA
>
> **Ninguna credencial va en este repo.** La del admin del tenant real la tiene el dueño.
>
> **La que está en uso hoy hay que darla por comprometida.** Estuvo en texto plano en CINCO
> archivos versionados —`README.md`, `PROJECT.MD`, este archivo, `05-DECISIONES.md` y
> `historico/PROMPT-DEV-SENIOR.md`— desde el commit que creó cada uno, y el repo estuvo
> público. Se sacó del árbol el 20/08/2026, y eso **no la invalida**: sigue viva en el
> historial de git, donde `git show <sha>:<archivo>` la devuelve hoy.
>
> **Lo único que cierra el riesgo es rotarla, y eso lo hace el dueño** — ningún agente toca
> credenciales de producción. Detalle y estado en T-26 (`09-TAREAS-REUNION-CAMILA.md`).

Tenant real: **Tapia Propiedades** · admin `alannaimtapia@gmail.com` — la contraseña **no va en el repo**: la tiene el dueño (ver §Credenciales, arriba).
(el **PIN de seguridad se eliminó** — ninguna acción lo pide).

## Dónde estamos

El sistema está **lanzado y endurecido**, con el flujo central **100% cableado al API
real** (no mock): contratos, liquidaciones, pagos, rendiciones, caja, reclamos,
equipo, sociedades, co-inquilinos, servicios, documentos. Múltiples campañas de
auditoría multi-agente arreglaron **~50+ bugs reales** verificados y deployados.

**Hitos junio 2026 (todo en prod, en `main`):**

- ✅ **File storage REAL** (Railway Volume `/data` + `/uploads` multipart): los 4
  flujos de archivos suben de verdad — comprobante de pago, foto de reclamo, boleta,
  documentos del contrato. (Ver `01-ARQUITECTURA.md` §storage y `../PROJECT.MD` §9.)
- ✅ **Cron de devengo** in-process (cada 6h, idempotente) + endpoint
  `/internal/cron/devengar` con `CRON_SECRET`. Genera liquidaciones futuras sin tocar nada.
- ✅ **Servicios públicos** del panel persistidos (la inmo carga → el inquilino ve) y
  **edición de propiedad** que persiste de verdad (antes era override de localStorage).
- ✅ **Auditoría multi-agente 27/06** — workflow (6 finders → verificación adversarial
  → crítico de completitud) encontró **8 hallazgos, los 8 fixeados/deployados/testeados
  en prod** (E2E con cleanup; B2 con test de regresión). Ver `03-AUDITORIAS.md`.

**Cierre de julio 2026 (02-04/07) — se cerró TODO el backlog de archivos/adjuntos
(todo en prod vía `railway up` y en `main`, demo intacta / ambos modos andan):**

- ✅ **Consorcios Fase 1** (CRUD real: consorcio, UFs, movimientos, asambleas) — 02/07.
- ✅ **8 features que cierran el backlog de "campos en schema SIN feature"** (auditoría de
  archivos/adjuntos): construidas de verdad, E2E, con la demo intacta —
  - **Avatar del inquilino** + **documentos reales** (DNI/recibos/garante).
  - **Flujo real del profesional por link mágico** (`/p/:token`, sin cuenta ni password):
    confirmar → en camino → listo, con **fotos antes/después** a `/uploads`.
  - **Validador de resumen bancario** (CSV/Excel, **matching determinístico SIN IA/OCR**):
    parseo del extracto + conciliación que crea un `Pago` CONCILIADO directo.
  - **Migración de cartera** (Excel/CSV con **mapeo flexible** de columnas): subir → mapear
    → validar fila por fila → confirmar crea propiedades + inquilinos + contratos.
  - **Avatar del usuario del panel** (`PUT /me/avatar`) — backend-ready (falta UI del panel).
  - **Comprobante en gastos de caja** (`MovimientoCaja.comprobanteUrl`) — backend-ready
    (falta UI del panel).
  - **Harden de tenant en uploads** (`f715055`): se cerró la fuga por la que un inquilino
    podía inyectar una imagen externa (`https://`) en foto/adjunto de reclamo y archivo de
    boleta (ahora validan `urlEsDelTenant`).

**Julio 2026 (05/07) — ciclo de vida del contrato, reclamos con plata real y baja del PIN
(todo en prod, back+front):**

- ✅ **Historial de inquilinos** — entidad `Persona` por tenant (identidad reutilizable) + pestaña
  Inquilinos con ficha (contratos/propiedades/reclamos/morosidad on-read) + historial de contratos
  anteriores en la propiedad + reuso del inquilino al armar contrato + 8 tipos de doc legales.
  Migraciones `persona_inquilino` + `doc_contrato_tipos_legales`; backfill idempotente (7 personas).
- ✅ **Ciclo de vida del contrato** (gap-analysis → 5 gaps de plata): **depósitos en custodia**
  (`GET /depositos/en-custodia`, enum `EstadoDeposito`), **rescisión** con penalidad + neteo del
  depósito (`CargoContrato`, `finalizar`/`finalizar-preview`), **ajuste de alquiler** manual-asistido
  (`AjusteAlquiler` — el alquiler antes NUNCA subía), **saldar deuda** de ex-inquilinos
  (`saldar-deuda`) y **renovación** de contrato (`RenovacionContrato`). Migraciones `estado_deposito`,
  `cargo_rescision`, `ajuste_alquiler`, `renovacion_contrato`.
- ✅ **Reclamos "¿quién paga?"** — `PagadorReclamo` (propietario/inquilino/depósito) con impacto real
  en la plata: propietario → rendición (`GastoRendido` tipo TRABAJO), inquilino → `CargoContrato`,
  depósito → deducción neteada en `/depositos/en-custodia`. `POST /reclamos/:id/clasificar` +
  `/resolver` extendido (costo + pagador + suma al profesional + historial). Moneda formateada.
  Migración `reclamo_pagador_cargo`. ⚠️ El cargo al inquilino aún no llega a su PWA (write-only).
- ✅ **Eliminación del PIN** de seguridad — kill-switch `verificarPinUsuario` siempre-ok; ninguna
  acción pide PIN (rol/capacidad + aislamiento multi-tenant siguen protegiendo). Tests actualizados.
- ✅ **"Pagos recibidos"** en los comprobantes del inquilino — los cobros CONCILIADO (incl. manuales
  de la inmo, parciales o de meses futuros) se muestran como transacciones explícitas.

## El área del propietario, reforzada el 20/08

Se exploró entera —seguridad, plata, cobertura, robustez, producto y operación— y se cerró
lo que apareció. Lo que sigue es el resumen; el detalle está en los commits.

**Plata.** Tres bugs que le mostraban al dueño números equivocados, y uno que podía pagarle
de más:

- Con dos dueños, "cobrado y sin rendirte" mostraba el remanente de la UNIDAD: a uno le
  sobraba y al otro le faltaba, al mismo tiempo.
- Los dólares salían con signo de pesos, en el portal y en la rendición impresa.
- La plata de la MIGRACIÓN DE CARTERA se contaba como cobro rendible. `POST /rendiciones`
  se la podía transferir de nuevo al dueño, y de paso trababa con 409 el cambio de reparto
  de toda propiedad con historia previa. Se marca con `Pago.migradoDeCartera`.
- Los períodos rendidos antes del 01/07/2026 no descontaban nada, porque
  `alquileres_rendidos` se creó vacía. No se puede backfillear —`Rendicion` guarda un total
  por (dueño, período), no el desglose—, así que se dan por saldados los períodos con una
  rendición sin líneas.

**Seguridad.** El email es la llave del portal y nadie lo revalidaba: corregir un typo no
cerraba la sesión del que había entrado con el mail equivocado. Ahora sí, con mensaje
distinto al de la baja. ⚠️ Cierra la ventana POSTERIOR a la corrección, no la brecha:
mientras el typo vive, el OTP se manda igual a esa casilla.

**Cobertura.** El portal tenía CERO tests por HTTP: los 7 endpoints y el login nunca se
habían ejecutado. `test/portal-propietario-e2e.test.ts` los cubre, con aislamiento contra
una segunda inmobiliaria REAL y la revocación por baja lógica. Encontró dos cosas en su
primera corrida.

**Lo que hay que saber para no romperlo:**

- El portal se compila de TRES formas y sólo una llega a un dueño real
  (`BASE_PATH=/propietario STATIC_EXPORT=1`). Las tres corren en CI.
- Comparte `localStorage` con el panel, porque comparte origen. El logout del panel barre
  las dos sesiones a propósito.
- `anular` una rendición todavía BORRA la fila. Queda el evento de auditoría con el
  snapshot de los montos; la baja lógica —que quede tachada en vez de desaparecer— está
  pendiente y necesita decisión.

---

## Verificado el 20/08 — qué se corrió de verdad

No es una lista de lo que "debería andar": es lo que se ejecutó, con el resultado que dio.

| Qué | Resultado |
|---|---|
| `tsc --noEmit` en los 6 paquetes | verde |
| Tests sin base (41 archivos) | verde |
| Tests de los tres fronts (12 archivos, 98 tests) | verde |
| Integración, por lotes contra la DB de test | en curso, verde hasta ahora |
| Build de `propietario` y de `inquilino` | verde |
| Build de `inmobiliaria` | **rojo en Windows y sólo en Windows** — ver `02-DEPLOY.md` |
| Portal del propietario, las 4 pestañas con login OTP real | verde |

**Lo que destrabó todo esto fue crear `apps/api/.env`.** Está gitignoreado, así que en un
checkout nuevo no existe y la suite de integración entera falla con un ZodError de entorno
*antes* de tocar la red. Dos tareas anteriores leyeron ese síntoma como "no se puede correr acá"
y lo anotaron como un hecho del repo. Con el archivo puesto corrieron ~60 archivos que llevaban
meses sin ejecutarse, y aparecieron dos bugs que sólo se ven corriéndolos (ver `d65d655`).
La receta está en `docs/TESTING.md`, junto con lo que cuesta: son ~94 archivos contra una
Postgres remota, tarda **horas**, y un timeout que la corta devuelve exit 0 y parece verde.

**Rojo conocido y preexistente:** `certificado-antiguedad.test.ts` falla con 401. Confirmado
con `git stash` que falla igual sin ninguno de los cambios de estos días. Que nadie lo persiga
creyendo que lo rompió.

---

## Qué falta (próximo chat)

**Bugs abiertos: 0 de los detectados** — la cacería del 27/07 cerró los 40 hallazgos
accionables (ver `03-AUDITORIAS.md`). Lo único que quedó **sin resolver es una decisión de
producto, no código**:

0. 🔴 **`usuarios.email` no es único a nivel global.** Prod hoy tiene **0 duplicados**
   (verificado read-only), pero el registro público permite la carrera: dos altas
   simultáneas con el mismo mail crean dos usuarios y el login queda ambiguo. La
   restricción es trivial (`@unique` + migración) pero **rompería a quien hoy use el mismo
   mail en dos inmobiliarias** — por eso no se aplicó sin tu OK. Decidir: ¿un mail = una
   sola cuenta en toda la plataforma?

1. 🟡 **¿La rendición debería poder ser PARCIAL?** Hoy, si los gastos de un período
   superan lo cobrado, el server rechaza (409) y el gasto se vuelve a presentar el mes
   siguiente: el dueño cobra tarde hasta que el operador toca el gasto. **La plata no se
   pierde** (los períodos salteados se rinden retroactivamente) y hay salida no
   destructiva (cargar un ingreso extra). La alternativa —transferir lo cobrado y
   arrastrar el faltante como saldo del dueño— es una decisión de producto, no un bug.
   El 28/07 se arregló la información (el 409 ahora da los números y las salidas; el
   panel dejó de prometer una amortización que no existe), no la política.

Lo demás que queda es cableado:

**Follow-ups de features recientes: ✅ los dos cerrados el 27/07.**

1. ✅ **Avatar del usuario del panel** — el footer del sidebar sube y quita la foto
   (`avatar-usuario.tsx` → `PUT /me/avatar`), con vuelta a iniciales si la imagen falla.
2. ✅ **Comprobante en gastos de caja** — el form ya adjunta el ticket (se sube a
   `/uploads` y el alta persiste `comprobanteUrl`).

_✅ **Cerrado 08/07** (falta deployar — ver colisión multi-chat): el **cargo de reclamo/rescisión ya
llega a la PWA del inquilino**. `GET /mis-cargos` + sección "Cargos adicionales" en el home; panel con
"Marcar cobrado" (`POST /cargos/:id/saldar`) en el detalle del contrato; `saldar-deuda` también salda
cargos. Migración `cargo_saldado` (`saldadoAt`). Los `contraDeposito` se siguen neteando en el depósito.
19/19 E2E. Ver `CHANGELOG.md` → "Cargos del inquilino"._

**Decisión de producto o insumo del owner** (no es bug) — triado en `04-PENDIENTES.md`:

4. **Forma de pago del plan SaaS** (billing): cómo cobra el SaaS a la inmobiliaria.
5. **Programa de referidos**: reglas comerciales.
6. **Screening real** (NOSIS) · **IA/OCR opcional** de comprobantes (presupuesto) — hoy
   el resumen bancario matchea sin IA por decisión del dueño; el OCR sería un extra.
7. **WhatsApp real** (recordatorio a morosos / invitaciones).

## Cómo seguir

1. Para una feature nueva: leé `01-ARQUITECTURA.md` (patrones) + `05-DECISIONES.md`
   (reglas LOCKED) antes de tocar plata/auth/multi-tenant.
2. Cablear con disciplina (verificar file:line, `tsc`+`build` 0, E2E contra prod con
   cleanup), commitear, deployar (`02-DEPLOY.md`), smoke test.
3. Para validar que no se rompió nada: re-correr `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`.

## Mapa de este handoff

| Archivo | Contenido |
|---|---|
| `00-ESTADO.md` | Este resumen ejecutivo |
| `01-ARQUITECTURA.md` | Stack, estructura, multi-tenant, money model, storage, cron, convenciones |
| `02-DEPLOY.md` | Railway, Volume, migraciones, consultar prod, smoke test, reglas duras |
| `03-AUDITORIAS.md` | Historia de las campañas + metodología + la auditoría 27/06 (8 fixes) |
| `04-PENDIENTES.md` | Roadmap — lo que falta (decisiones de producto) |
| `05-DECISIONES.md` | Decisiones de negocio del dueño + reglas duras |
| `06-ANALISIS-SENIOR.md` | Análisis dev senior / roadmap en olas |
| `PROMPT-ESTADO-Y-ORIENTACION.md` | **Prompt de orientación** — analizar todo en orden y reportar "dónde estamos parados" (más liviano que el onboarding) |
| `PROMPT-ONBOARDING-DEV-SENIOR.md` | **Prompt de onboarding** — un dev senior x10 recorre TODO, lo entiende y propone con qué seguir |
| `PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md` | Prompt reutilizable de auditoría en loop |
| `historico/` | Docs viejos archivados (auditorías/reportes/prompts) |
| `../PROJECT.MD` | **Documento maestro (contexto absoluto)** |
| `../README.md` | Orientación + tooling + setup |
| `../docs/` | Referencias: API, modelo de datos, config, runbook, testing, frontend, glosario |
| `../CONTRIBUTING.md` · `../SECURITY.md` · `../CHANGELOG.md` | Contribuir · seguridad · historial |
