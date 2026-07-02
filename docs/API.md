# Referencia de API — My Alquiler

> Las 105 rutas del backend (`apps/api/src/routes/`), agrupadas por archivo. Para cada
> endpoint: auth, request, respuesta, errores y reglas de negocio. Generado del código real.
>
> **Convenciones:** base sin prefijo de versión. Auth por JWT (header `Authorization:
> Bearer <token>`); los 3 kinds (usuario/inquilino/co-inquilino) llevan `inmobiliariaId`.
> Toda query está scopeada por tenant. Errores estándar: `400` validación (zod), `401`
> sin/mal token, `403` rol/permiso insuficiente, `404` no existe (o no es de tu tenant),
> `409` conflicto/carrera (Prisma P2002/P2003 → 409, P2025 → 404). Ver
> [`../PROJECT.MD`](../PROJECT.MD) §5–7 y [`../SECURITY.md`](../SECURITY.md).

---


## auth.ts

Todas las rutas registradas sin prefijo de versión. `TOKEN_TTL = 15d` para todos los JWT de sesión; `OTP_TTL_MS = 10 min`.

### POST /auth/login
Login del panel inmobiliaria (email + password).
- **Auth:** público.
- **Body:** `LoginRequestSchema` — `email` (string, req), `password` (string, req).
- **Respuesta:** `{ token, nombre, rol }` (token JWT `kind:'usuario'` con `userId`, `inmobiliariaId`, `rol`).
- **Errores:** `400` body inválido ("Email y contraseña requeridos"); `401` usuario no encontrado/inactivo, sin `passwordHash` o password incorrecta (mensaje genérico "Email o contraseña incorrectos").
- **Reglas:** busca `usuario` por `email` en minúsculas y `activo: true`; compara con `bcrypt.compareSync`.

### POST /auth/registro
Auto-onboarding: una inmobiliaria crea su cuenta sola (Inmobiliaria piloto + Usuario ADMIN + Trial gratis).
- **Auth:** público.
- **Body:** `RegistroSchema` —
  - `inmobiliaria`: `{ nombre (≥2), email (email), telefono (≥5), ciudad (≥2), provincia (≥2) }` (todos req).
  - `admin`: `{ nombre (≥2), apellido (≥2), password (≥8) }` (todos req).
- **Respuesta:** `201` `{ token, nombre, rol }` (mismo payload que login).
- **Errores:** `400` datos inválidos/incompletos; `409` "Ya existe una cuenta con ese email" (email único entre usuarios); `500` si falla la creación tras reintentos.
- **Reglas de negocio:**
  - Todo en una `$transaction`: crea `Inmobiliaria` (`esPiloto:true`, campos fiscales/dirección vacíos salvo ciudad/provincia, `codigoReferido` generado tipo `GOMEZ-4821`), `Usuario` ADMIN (`activo:true`, password bcrypt cost 10) y `Trial` tipo `LANZAMIENTO` (`desde` ahora, `hasta` = `app.env.FECHA_LANZAMIENTO` o default `2026-12-31`, `activadoPor:'self-service'`).
  - El email pasa a minúsculas y es el login del admin.
  - **Idempotencia/retry:** hasta 5 intentos; reintenta solo si el error matchea colisión de `codigoReferido`/unique constraint, si no loguea y devuelve `500`.

### POST /auth/otp/request
Inquilino: solicita OTP de 6 dígitos por email.
- **Auth:** público.
- **Body:** `OtpRequestSchema` — `email` (string, req).
- **Respuesta:** siempre `{ ok: true }` (idéntica exista o no el email → anti-enumeración).
- **Errores:** `400` "Email requerido".
- **Reglas de negocio:**
  - Email único **por inmobiliaria**, no global: genera un OTP (mismo código, `bcrypt` cost 8, expira 10 min) para **cada** inquilino con ese email (`createMany`), un solo mail.
  - Envía vía SMTP (`enviarOtp`); si SMTP no está configurado o falla, loguea el código como fallback y nunca rompe el login ni filtra el resultado al cliente.

### POST /auth/otp/verify
Inquilino: verifica el OTP y emite sesión.
- **Auth:** público.
- **Body:** `OtpVerifySchema` — `email` (string, req), `code` (6 dígitos, req).
- **Respuesta:** `{ token, nombre }` (token JWT `kind:'inquilino'` con `inquilinoId`, `inmobiliariaId`, `contratoId`).
- **Errores:** `400` body inválido; `401` "Código inválido" (email sin inquilinos) o "Código inválido o vencido" (ningún OTP matchea).
- **Reglas de negocio:**
  - La identidad sale de la **fila OTP que matchea** (no de un `findFirst` por email) → un email compartido entre inmobiliarias no loguea contra el tenant equivocado.
  - Solo considera OTPs `usedAt:null` y no vencidos; al matchear marca `usedAt` (un solo uso).
  - **Backdoor demo:** si `app.env.DEMO_MODE` y `code === '000000'` y `NODE_ENV !== 'production'`, loguea contra `inquilinos[0]` (excluido explícitamente en prod).

### GET /co-invitacion/:token
Detalle de la invitación de co-inquilino para la pantalla del link (sin sesión).
- **Auth:** público (el token de invitación se valida en el handler; debe ser `kind:'co-invitacion'` con `coInquilinoId`).
- **Params:** `token` (path, req).
- **Respuesta:** `{ nombre, relacion, permiso, estado, direccion, ciudad, inmobiliaria }` (de `CoInquilino` + propiedad del contrato + inmobiliaria).
- **Errores:** `400` "Invitación inválida o vencida" (token no verifica o no es del kind correcto); `404` "Invitación inexistente" (co-inquilino no existe).

### POST /co-invitacion/:token/aceptar
Acepta la invitación y emite la sesión de co-inquilino.
- **Auth:** público (token `kind:'co-invitacion'`, firmado por `POST /co-inquilinos`, TTL 7d).
- **Params:** `token` (path, req). Sin body.
- **Respuesta:** `{ token, nombre, email, permiso, contratoId, direccion, ciudad }` (token JWT `kind:'co-inquilino'` con `coInquilinoId`, `inmobiliariaId`, `contratoId`, `permiso` leído de la DB).
- **Errores:** `400` invitación inválida/vencida; `404` "Invitación inexistente"; `409` "Esta invitación ya fue aceptada..." (re-uso del link).
- **Reglas de negocio:**
  - **Link de un solo uso / lock atómico:** `updateMany` condicionado por `estado != 'ACEPTADO'`; solo la primera aceptación gana (count 1), cualquier re-uso o carrera da count 0 → `409`. El titular regenera el link (`POST /co-inquilinos/:id/link`) para volver a PENDIENTE.
  - Identidad y `permiso` se leen de la DB, no del token (token viejo/manipulado no eleva permisos).

### POST /auth/demo
Sesión de inquilino demo (Mariela) con un click.
- **Auth:** público, pero gated por `app.env.DEMO_MODE`.
- **Body:** ninguno.
- **Respuesta:** `{ token, nombre }` (token JWT `kind:'inquilino'` del inquilino `mariela.sosa@gmail.com`).
- **Errores:** `404` "No disponible" si `DEMO_MODE` off; `500` "Seed demo faltante" si no existe el inquilino demo.

### GET /auth/me
Sesión actual (resuelve según el kind del token).
- **Auth:** `requireAuth` (cualquier sesión: usuario / inquilino / co-inquilino).
- **Respuesta (varía por kind):**
  - `usuario`: `{ kind, nombre, email, rol, inmobiliaria, esPiloto, tienePin (!!pinHash), perfilFiscalCompleto (!!cuit && !!direccionCalle), trial: { tipo, hasta, diasRestantes, vigente } | null }`.
  - `co-inquilino`: `{ kind, nombre, email, telefono, dni, contratoId, permiso, esCoInquilino:true }`.
  - `inquilino`: `{ kind, nombre, email, telefono, dni, contratoId }`.
- **Errores:** `401` si el guard falla, o si la entidad (`usuario`/`co-inquilino`/`inquilino`) ya no existe en la DB ("... inexistente").
- **Reglas:** `diasRestantes` = ceil de `(trial.hasta - now)/día`, mínimo 0; `vigente` si `hasta >= now`.

### POST /auth/pin/verify
Verifica el PIN de seguridad de un usuario del panel.
- **Auth:** `requireUsuario` (solo sesión usuario).
- **Body:** `{ pin: string (≥4) }` (req).
- **Respuesta:** `{ valid: true }`.
- **Errores:** `400` "PIN requerido"; código/mensaje de `verificarPinUsuario` con `{ valid:false }` si no valida (incluye lockout anti-fuerza-bruta).

### POST /auth/pin
Configura o cambia el PIN de seguridad (persiste en `usuario.pinHash`).
- **Auth:** `requireUsuario` (solo sesión usuario; cada usuario configura su propio PIN).
- **Body:** `{ pinNuevo: string (regex /^\d{4,6}$/, req), pinActual?: string }`.
- **Respuesta:** `{ ok: true, tienePin: true }`.
- **Errores:** `400` PIN inválido (mensaje del issue zod, ej. "El PIN debe tener 4 a 6 dígitos"); `401` "Usuario inexistente"; código/mensaje de `verificarPinUsuario` si ya hay PIN y el `pinActual` es incorrecto.
- **Reglas de negocio:**
  - Si ya existe `pinHash`, exige `pinActual` correcto vía `verificarPinUsuario` (hereda lockout anti-fuerza-bruta; evita oráculo de adivinanza sin límite).
  - Guarda el nuevo PIN con `bcrypt` cost 10.


## core.ts

Rutas del núcleo del panel de la inmobiliaria. **Todas** usan `requireUsuario` (JWT de usuario del panel, scoped por `inmobiliariaId`). Sin guard pasado → solo autenticación; con string → capacidad de `permisos.ts`; varios endpoints además chequean `u.rol` a mano. Errores comunes a todas: **401** si el JWT falta/inválido (lo emite `requireUsuario`), **403** si falta la capacidad/rol.

### Contratos

- **GET `/contratos`** — cap `contratos.ver`. Lista contratos del tenant. Respuesta: filas `Contrato` con `propiedad` (id, direccion, ciudad, consorcio.nombre), `inquilinoTitular` (id, nombre, apellido, email), más derivados `estadoPagoActual` (estado de la liq. vencida, si no la más reciente, si no `'PENDIENTE'`) y `proximoVencimiento` (fechaVencimiento de la primera liq. PENDIENTE/VENCIDO, o `null`). `liquidaciones` se omite del payload.

- **GET `/contratos/:id`** — cap `contratos.ver`. Detalle. Incluye `propiedad.participaciones.propietario.cuentaCobranza` (para mostrar destino de cobro en PROPIETARIO_DIRECTO), `inquilinoTitular`, `sociedad` (id, nombreComercial), `garantes`, `coInquilinos`, `documentos`, + mismos derivados `estadoPagoActual`/`proximoVencimiento`. **404** `Contrato inexistente`.

- **GET `/contratos/:contratoId/co-inquilinos`** — cap `contratos.ver`. Verifica que el contrato sea del tenant (helper `contratoDelTenant`). Respuesta: filas `CoInquilino` ordenadas por `invitadoAt` desc. **404** `Contrato no encontrado`.

- **POST `/contratos/:contratoId/co-inquilinos`** — cap `contratos.crear`. Verifica tenant. Body (req): `nombre` string 2–120, `email` email, `relacion` string 2–60, `permiso` enum `VER|PAGAR|COMPLETO`; (opc) `telefono` max40, `dni` max20. Email se baja a minúsculas. **201** fila `CoInquilino`. **400** datos incompletos. **404** contrato no encontrado. **409** `Ya hay un co-inquilino con ese email en este contrato` (P2002 sobre `@@unique([contratoId, email])`).

- **DELETE `/contratos/:contratoId/co-inquilinos/:id`** — cap `contratos.crear`. Borra el co-inquilino (scoped por contrato + tenant). Respuesta `{ ok: true }`. **404** `Co-inquilino no encontrado`.

- **POST `/contratos`** — cap `contratos.crear`. Body (req): `propiedadId` string, `inquilino` {`nombre` 2+, opc `apellido`/`email`/`telefono`/`dni`}, `monto` ≥0, `fechaInicio` date, `fechaFin` date, `diaPago` int 1–31, `indiceAjuste` enum `ICL|IPC|CASA_PROPIA|UVA|CAC|RIPTE|FIJO`, `frecuenciaAjusteMeses` int+; (opc/def) `moneda` `ARS|USD` (def ARS), `montoExpensas` +, `tipoContrato` `ALQUILER|SOLO_EXPENSAS|ALQUILER_Y_EXPENSAS` (def ALQUILER), `depositoGarantia` +, `modoCobranza` `INMOBILIARIA|PROPIETARIO_DIRECTO` (def INMOBILIARIA). Respuesta: fila `Contrato` creada.
  - **Reglas de negocio:** `fechaFin > fechaInicio`; `monto=0` solo válido en SOLO_EXPENSAS; ALQUILER_Y_EXPENSAS/SOLO_EXPENSAS exigen `montoExpensas`. **Rol CARGA** crea en estado `BORRADOR` + `pendienteAprobacion` y genera una `Aprobacion` (`CONTRATO_CARGADO`) — no reclama propiedad ni devenga liquidaciones; ADMIN/OPERADOR crean `ACTIVO`. En PROPIETARIO_DIRECTO se apunta `cobraDirectoPropietarioId` al dueño de mayor participación. **Claim atómico** de la propiedad vía `updateMany where contratoActualId=null` → si `count=0` lanza `PROP_OCUPADA`. Al activar se llama `generarLiquidacionesContrato`.
  - **400** datos incompletos / fechas / monto 0 / faltan expensas / falta dueño para cobranza directa. **404** `Propiedad inexistente`. **409** propiedad ya con contrato activo (pre-check o `PROP_OCUPADA`); `Ya tenés un inquilino con ese email en tu cartera` (pre-check o P2002 sobre `@@unique([inmobiliariaId,email])`).

- **POST `/contratos/:id/finalizar`** — cap `contratos.crear`, **pero rol CARGA → 403** (irreversible). Marca `FINALIZADO`, libera propiedad (`contratoActualId=null`, estado `DISPONIBLE`) y desvincula al inquilino titular. **Lock atómico**: `updateMany` condicionado por estado `notIn [FINALIZADO,RESCINDIDO,BORRADOR]` → `count=0` ⇒ 409. Respuesta `{ ok: true }`. **404** `Contrato inexistente`. **409** ya finalizado/rescindido, o BORRADOR (rechazar la aprobación en su lugar).

### Propiedades

- **GET `/propiedades`** — cap `propiedades.ver`. Lista. Filas `Propiedad` con `participaciones.propietario` (id, nombre, apellido) y `contratoActual` (id, estado, monto, moneda, modoCobranza).

- **GET `/propiedades/:id`** — cap `propiedades.ver`. Detalle con `participaciones.propietario`, `contratoActual.inquilinoTitular`, `contratos` (historial desc), `sociedad`. `contratoActual` lleva derivados `estadoPagoActual`/`proximoVencimiento` (o `null` si no hay contrato). **404** `Propiedad inexistente`.

- **POST `/propiedades`** — cap `propiedades.crear`. Body (req): `direccion` 3+, `ciudad` 2+, `provincia` 2+, `tipo` `DEPARTAMENTO|CASA|LOCAL|GALPON`, `propietarios` array≥1 de {`propietarioId`, `porcentaje` >0 ≤100}; (opc) `ambientes` int+, `m2` +. Respuesta: propiedad creada + `participaciones`. **Reglas:** sin propietarios duplicados en el array; porcentajes deben sumar 100 (redondeado); todos los propietarios deben existir en el tenant. Transacción crea propiedad (`estado DISPONIBLE`) + `participacionPropietario`. **400** datos incompletos / propietario duplicado / suma ≠ 100 / algún propietario inexistente.

- **PUT `/propiedades/:id`** — cap `propiedades.crear`. Body (req): `direccion` 1–300, `ciudad` max120, `provincia` max120, `tipo` enum; (opc, nullable) `ambientes` int≥0, `m2` ≥0. Respuesta: propiedad actualizada. **400** `Datos inválidos` (+`detalle`). **404** `Propiedad inexistente`.

- **DELETE `/propiedades/:id`** — cap `propiedades.crear`, **rol CARGA → 403**. Solo borra propiedades sin contrato activo y sin historial. Transacción borra `participacionPropietario`, `servicioPublico`, `inquilinoInvitado` + la propiedad. Respuesta `{ ok: true }`. **404** `Propiedad inexistente`. **409** con contrato activo, o con historial (contratos/reclamos/movimientos de caja).

### Propietarios

- **GET `/propietarios`** — cap `propietarios.ver`. Lista. Filas `Propietario` con `participaciones.propiedad` (id, direccion, estado), ordenadas por apellido.

- **GET `/propietarios/:id`** — cap `propietarios.ver`. Detalle con `participaciones.propiedad.contratoActual.inquilinoTitular`, `arca`, `cuentaCobranza`. **404** `Propietario inexistente`.

- **POST `/propietarios`** — cap `propietarios.crear`. Body (req): `nombre` 2+, `apellido` 1+; (opc) `email` (email o `''`), `telefono`, `cuit`, `cbuAlias`, `comisionPct` 0–100 (def 8), `notas`. Respuesta: propietario creado + `participaciones` (vacío). **400** datos incompletos.

- **PUT `/propietarios/:id/cuenta-cobranza-directa`** — cap `propietarios.crear`. Upsert de `CuentaCobranzaDirecta` por propietario (`@unique propietarioId`). Body (req): `banco` 2+, `titular` 2+, `cbu` regex 22 dígitos, `alias` 2+; (opc) `cuit` (def `''`). Respuesta `{ ok: true, cuentaCobranza }`. **400** mensaje del primer issue. **404** `Propietario inexistente`.

- **DELETE `/propietarios/:id`** — cap `propietarios.crear`, **rol CARGA → 403**. Solo borra si no tiene historial. Transacción borra `cuentaCobranzaDirecta`, `arcaConfig` (FK 1:1) + el propietario. Respuesta `{ ok: true }`. **404** `Propietario inexistente`. **409** asociado a participaciones / rendiciones / contratos de cobranza directa.

### Inquilinos

- **GET `/inquilinos`** — cap `contratos.ver`. Lista inquilinos del tenant con `contrato` (id, estado, propiedad.direccion), ordenados por nombre.

### Configuración — Empresa (datos fiscales)

- **GET `/empresa`** — auth + **rol ADMIN** (else 403). Respuesta: datos de la inmobiliaria (`nombre`, `email`, `cuit`, `matricula`, `telefono`, dirección desglosada) + `perfilFiscalCompleto` (`!!(cuit && direccionCalle)`). **404** `Inmobiliaria inexistente`.

- **PUT `/empresa`** — auth + **rol ADMIN** (else 403). Body (todos opc): `nombre` 2+, `email` email, `cuit`, `matricula`, `telefono`, `direccion*`. Respuesta `{ ok: true, perfilFiscalCompleto }`. **400** datos inválidos.

### Configuración — Cobranza (CBU que ve el inquilino)

Guardada en la sociedad principal (`Sociedad.cuentaCobranza`).

- **GET `/cobranza`** — auth + **rol ADMIN** (else 403). Respuesta: `{ tieneCuenta: bool, cuenta: { banco, titular, cbu, alias, cuit } }`.

- **PUT `/cobranza`** — auth + **rol ADMIN** (else 403). Body (req): `banco` 2+, `titular` 2+, `cbu` 22 dígitos; (opc) `alias` (def `''`), `cuit` (def `''`). Actualiza la sociedad principal activa; si no existe, **crea** la sociedad principal con datos mínimos de la inmobiliaria. Respuesta `{ ok: true, tieneCuenta: true }`. **400** mensaje del primer issue. **404** `Inmobiliaria inexistente`.

### Configuración — Mercado (país/moneda/índice)

- **GET `/mercado`** — auth (cualquier usuario del tenant; lo usa el wizard de contratos para OPERADOR/CARGA, no solo ADMIN). Respuesta: `{ codigo, moneda, indiceDefault }` de la inmobiliaria. **404** `Inmobiliaria inexistente`.

- **PUT `/mercado`** — auth + **rol ADMIN** (else 403). Body (req): `codigo` `AR|UY|BR|PY`, `moneda` `ARS|USD|UYU|BRL|PYG`, `indiceDefault` (mismo enum de contratos). **Regla:** cruce país↔moneda válido (`MONEDAS_POR_PAIS`). Respuesta `{ ok: true }`. **400** datos inválidos / moneda no corresponde al país. **404** `Inmobiliaria inexistente`.

### Configuración — Sociedades (multi-empresa)

Todas auth + **rol ADMIN** (else 403). Body compartido `sociedadBody`: `razonSocial` 2+, `nombreComercial` 1+ (req); `cuit`, `condicionFiscal` `MONOTRIBUTO|RESPONSABLE_INSCRIPTO|EXENTO` (def RI), `domicilioFiscal`, `email`, `telefono`, `cuentaCobranza` (json), `afip` (json) opc.

- **GET `/sociedades`** — Query (opc): `incluirInactivas` bool (coerce). Lista ordenada principal-primero, luego createdAt. Solo activas salvo `incluirInactivas`.

- **POST `/sociedades`** — Body `sociedadBody`. La 1ª sociedad activa queda `esPrincipal` automáticamente. Respuesta: fila creada. **400** datos inválidos. **Carrera:** P2002 sobre el índice parcial único (una principal-activa por tenant) → reintenta creando como no-principal.

- **PUT `/sociedades/:id`** — Body `sociedadBody.partial()`. Respuesta: fila actualizada. **400** datos inválidos. **404** `Sociedad inexistente`.

- **PUT `/sociedades/:id/principal`** — Marca esta sociedad como principal (transacción: pone todas en `esPrincipal=false` + esta en true). Requiere activa. Respuesta `{ ok: true }`. **404** `Sociedad inexistente o inactiva`.

- **PATCH `/sociedades/:id`** — Body (opc): `reactivar` bool. Si `reactivar` → la vuelve activa. Si no → baja lógica (`activa=false`, `esPrincipal=false`) en **tx Serializable**: cuenta activas DESPUÉS del update, rollback si quedan 0; si era principal promueve la siguiente activa más antigua. Respuesta `{ ok: true }`. **404** `Sociedad inexistente`. **409** `No podés dar de baja la única sociedad activa` (`ULTIMA_ACTIVA`).

### Configuración — Equipo (usuarios del panel)

Todas auth + **rol ADMIN** (else 403). Enum rol: `ADMIN|OPERADOR|CARGA|LECTURA`.

- **GET `/usuarios`** — Lista usuarios del tenant (id, nombre, apellido, email, rol, activo, createdAt), ordenados por activo desc luego createdAt, con flag `esVos` (`id === u.userId`).

- **POST `/usuarios`** — Body (req): `nombre` 2+, `apellido` 1+, `email` email, `rol` enum, `password` 6+. Email a minúsculas; `passwordHash` con bcrypt(10). Si el email existe pero estaba dado de baja en **este** tenant → **reactiva** con los nuevos datos (**200**). Crea nuevo → **201** (id, nombre, apellido, email, rol, activo, `esVos:false`). **400** datos inválidos. **409** `Ya existe una cuenta con ese email` (email global, no solo tenant).

- **PUT `/usuarios/:id`** — Body (todos opc): `rol` enum, `nombre` 2+, `apellido` 1+. **Atómico (tx Serializable):** aplica el cambio y verifica que quede ≥1 Admin activo dentro de la misma tx. Respuesta: fila actualizada. **400** datos inválidos. **404** `Usuario inexistente`. **409** `Tiene que quedar al menos un Admin activo` (`SIN_ADMIN`).

- **DELETE `/usuarios/:id`** — Baja lógica (`activo=false`) en **tx Serializable** con la misma verificación de ≥1 Admin. No podés borrarte a vos mismo. Respuesta `{ ok: true }`. **404** `Usuario inexistente`. **409** `No podés quitarte a vos mismo` (id propio), o `Tiene que quedar al menos un Admin activo` (`SIN_ADMIN`).


## plata.ts

Todas las rutas montadas bajo el prefijo del plugin `plataRoutes`. Multi-tenant: todo filtra por `inmobiliariaId` de la sesión. `verificarPin()` delega en `verificarPinUsuario` (lockout anti-fuerza-bruta); cuando el PIN falla devuelve el código/mensaje propio del verificador (típicamente 401/403/429) y corta el handler.

### Liquidaciones

**GET /liquidaciones**
- Guard: `requireUsuario('pagos.ver')`.
- Query: `periodo` (string, opc.), `estado` (enum `PENDIENTE|PAGADO|PARCIAL|VENCIDO`, opc.).
- Respuesta: array de `Liquidacion` con `contrato` incluido (`id`, `propiedad.direccion`, `inquilinoTitular.nombre/apellido`), orden `fechaVencimiento` desc.

**POST /liquidaciones/devengar**
- Guard: `requireUsuario()` + chequeo manual de rol (`ADMIN` u `OPERADOR`).
- Body: ninguno.
- Regla: idempotente (`createMany skipDuplicates` sobre `@@unique([contratoId,periodo])`); top-up de liquidaciones futuras de todos los contratos `ACTIVO` del tenant.
- Respuesta: `{ contratosProcesados, liquidacionesNuevas }`.
- Errores: 403 si el rol no es ADMIN/OPERADOR.

**POST /internal/cron/devengar**
- Guard: público a nivel sesión, pero requiere header `x-cron-secret` que coincida con `process.env.CRON_SECRET` (devengo GLOBAL, todas las inmobiliarias).
- Respuesta: resultado de `devengarTodosLosTenants`. Idempotente.
- Errores: 401 si no hay secret configurado o no coincide (cerrado por defecto).

**GET /caja/cierre**
- Guard: `requireUsuario('caja.ver')`.
- Query: `fecha` (string `YYYY-MM-DD`, opc.; default = hoy en hora Argentina UTC-3).
- Reglas: suma pagos `CONCILIADO` con `decididoAt` dentro del día AR y solo contratos `modoCobranza='INMOBILIARIA'`. Comisión solo sobre la porción de alquiler (proporcional en parciales), ponderada por participación×`comisionPct` de cada dueño; redondeo a centavos.
- Respuesta: `{ fecha, cobrado, comision, cantidad, pagos: [{ id, inquilino, direccion, periodo, monto, comision, metodo, hora }] }`.

### Pagos informados

**GET /pagos**
- Guard: `requireUsuario('pagos.ver')`.
- Query: `estado` (enum `INFORMADO|CONCILIADO|RECHAZADO`, opc.).
- Respuesta: array de `Pago` con `contrato` y `liquidacion` incluidos, orden `informadoAt` desc.

**POST /pagos/:id/validar**
- Guard: `requireUsuario('pago.conciliar')`.
- Params: `id`. Body: `pin` (string, opc.).
- Reglas: transición atómica `INFORMADO→CONCILIADO` vía `updateMany WHERE estado='INFORMADO'` (cierra carrera doble-decisión). La liquidación pasa a `PAGADO` solo si la suma de conciliados ≥ `montoTotal` autoritativo; si no, `PARCIAL`. Mapea método (`CHEQUE`→`TRANSFERENCIA`). Pago que cierra el ciclo se reetiqueta `tipo=TOTAL`. Scoping cross-tenant con `inmobiliariaId` en ambas ops (H-2).
- Respuesta: el `Pago` actualizado.
- Errores: 404 (pago inexistente o de otro tenant), 409 (ya decidido — pre-check y carrera del `updateMany count=0`).

**POST /pagos/:id/rechazar**
- Guard: `requireUsuario('pago.rechazar')`.
- Params: `id`. Body: `pin` (string, opc.), `observacion` (string, **requerido**, min 5).
- Reglas: transición atómica `INFORMADO→RECHAZADO` (mismo lock que validar); guarda `observacion`.
- Respuesta: el `Pago` actualizado.
- Errores: 400 (observación < 5 chars), 404 (inexistente), 409 (ya decidido).

**POST /pagos/informar**
- Guard: `requireContratoAcceso('VER')` — inquilino o **cualquier co-inquilino** del contrato (incluido permiso VER; pagar no se restringe).
- Body: `liquidacionId` (string, **req.**), `monto` (number positivo, **req.**), `metodo` (enum `TRANSFERENCIA|MERCADOPAGO|EFECTIVO|CHEQUE`, **req.**), `nroOperacion` (opc.), `fechaTransferencia` (date coercible, **req.**), `nota` (opc.), `comprobanteUrl`/`comprobanteFileName`/`comprobanteMime` (string, opc.), `comprobanteSize` (int ≥0, opc.).
- Reglas: `comprobanteUrl` (si viene) debe ser `/uploads` del propio tenant (`urlEsDelTenant`). `monto` no puede superar saldo pendiente (`montoTotal − conciliados`). Anti-doble-informe: solo un `INFORMADO` por liquidación (chequeo + índice parcial único → P2002). `tipo`=TOTAL/PARCIAL según monto vs total.
- Respuesta: el `Pago` creado.
- Errores: 400 (no hay contrato activo; datos incompletos; comprobante inválido; monto > saldo), 404 (liquidación inexistente / no del contrato), 409 (liquidación ya paga; saldo ≤ 0 por carrera; ya hay un informe pendiente — secuencial o por P2002 concurrente).

**GET /mis-liquidaciones**
- Guard: `requireContratoAcceso()` (sin capacidad específica).
- Respuesta: array de `Liquidacion` del contrato del inquilino, orden `periodo` desc. `[]` si no tiene contrato activo.

### Caja de gastos

**GET /caja/movimientos**
- Guard: `requireUsuario('caja.ver')`.
- Respuesta: array de `MovimientoCaja` con `propiedad` (`id`, `direccion`), orden `fecha` desc.

**POST /caja/movimientos**
- Guard: `requireUsuario('gasto.caja.cargar')`.
- Body: `propiedadId` (string, **req.**), `categoria` (enum `PLOMERIA|ELECTRICIDAD|GAS|CERRAJERIA|PINTURA|EXPENSAS|MATERIALES|OTRO`, **req.**), `descripcion` (string, **req.**, min 3), `monto` (number positivo, **req.**), `fecha` (date coercible, **req.**), `proveedor` (string nullable, opc.).
- Reglas: la propiedad debe ser del tenant; setea `contratoId` = `contratoActualId` de la propiedad y `cargadoPor` = nombre del usuario.
- Respuesta: el `MovimientoCaja` creado (`tipo=GASTO`).
- Errores: 400 (datos incompletos), 404 (propiedad inexistente).

**DELETE /caja/movimientos/:id**
- Guard: `requireUsuario('caja.eliminar')`.
- Params: `id`. Body: `pin` (string, opc.).
- Reglas: borrado atómico `deleteMany WHERE descontadoEnRendicion=false`; lectura previa solo para distinguir 404 de 409.
- Respuesta: `{ ok: true }`.
- Errores: 404 (inexistente), 409 (ya descontado en una rendición — no se puede eliminar; incluye carrera).

### Rendiciones

**GET /rendiciones**
- Guard: `requireUsuario('pagos.ver')`.
- Query: `propietarioId` (string, opc.).
- Respuesta: array de `Rendicion` con `gastos` y `propietario` (`nombre`, `apellido`), orden `periodo` desc.

**POST /rendiciones**
- Guard: `requireUsuario('rendicion.confirmar')`.
- Body: `propietarioId` (string, **req.**), `periodo` (string `YYYY-MM`, **req.**), `metodo` (enum `TRANSFERENCIA|MERCADOPAGO|EFECTIVO`, default `TRANSFERENCIA`), `pin` (opc.), `notas` (opc.).
- Reglas: bruto = liquidaciones `PAGADO` del período de contratos `modoCobranza='INMOBILIARIA'` de las propiedades del dueño × participación, **solo sobre alquiler** (no expensas/punitorios). Descuenta gastos pendientes solo del período y solo de propiedades que aportaron ingreso, por parte de participación. Neto = bruto − comisión − gastos. Tx atómica: crea rendición + `gastoRendido` snapshots + marca `MovimientoCaja` descontado solo cuando las partes de todos los dueños cubren el total (`updateMany WHERE descontadoEnRendicion=false`). Unicidad `(propietarioId, periodo)` = lock anti-doble-rendición.
- Respuesta: `201` con la `Rendicion` creada.
- Errores: 400 (datos incompletos), 404 (propietario inexistente), 409 (sin CBU/alias; período ya rendido — pre-check o P2002; sin cobros del período; neto negativo por gastos+comisión > cobrado).

**POST /rendiciones/:id/anular**
- Guard: `requireUsuario('rendicion.confirmar')`.
- Params: `id`. Body: `pin` (opc.).
- Reglas: tx atómica — devuelve gastos a `descontadoEnRendicion=false`, borra `gastoRendido`, borra la rendición con `deleteMany` condicionado (lock anti-doble-anulación). Reversible (no movió plata real). Scoping `inmobiliariaId` (H-3).
- Respuesta: `{ ok: true }`.
- Errores: 404 (inexistente), 409 (ya anulada — carrera, `count=0`).

### Aprobaciones (no monetarias, con PIN)

**GET /aprobaciones**
- Guard: `requireUsuario('contratos.ver')`.
- Respuesta: array de `Aprobacion` con `cargadoPor` (`nombre`, `apellido`, `rol`), orden `cargadoAt` desc.

**POST /aprobaciones/:id/aprobar** y **POST /aprobaciones/:id/rechazar** (generadas en bucle, misma firma)
- Guard: `requireUsuario('contrato.aprobar')`.
- Params: `id`. Body: `pin` (opc.), `comentario` (opc. en aprobar; **requerido min 5** en rechazar).
- Reglas: tx atómica única. Lock = `updateMany WHERE estado='PENDIENTE'` (solo la primera request gana) → `APROBADA`/`RECHAZADA`. Si `tipo='CONTRATO_CARGADO'`:
  - aprobar: contrato → `ACTIVO`, `pendienteAprobacion=false`; claim atómico de propiedad (`updateMany WHERE contratoActualId=null` → `ALQUILADA`, lock anti-doble-activación) y devenga liquidaciones (`generarLiquidacionesContrato`).
  - rechazar: contrato queda `BORRADOR` sin pendiente; borra el inquilino del borrador y sus hijos FK (`CodigoOtp`, `AnuncioAcuse`, `Documento`, `CertificadoInquilino`) para liberar el email único.
  - Scoping `inmobiliariaId` en todas las ops (H-4).
- Respuesta: la `Aprobacion` actualizada con `cargadoPor` (mismo shape que GET).
- Errores: 400 (rechazar sin comentario ≥5 chars), 404 (aprobación inexistente), 409 (ya decidida — `lock.count=0`; o propiedad ya ocupada — `PROP_OCUPADA` mapeado, mensaje "La propiedad ya tiene un contrato activo").


## operacion.ts

Base: rutas registradas bajo el prefijo donde se monte `operacionRoutes`. SLA calculado en server vía `conSla` (urgencia → límite: EMERGENCIA 6h, ALTA 24h, MEDIA 72h, BAJA 168h; reabre el reloj desde `resueltoAt` si el reclamo fue reabierto). Todas las queries filtran por `inmobiliariaId` (multi-tenant).

### Reclamos — panel (usuario)

**`GET /reclamos`** — Lista reclamos del panel.
- Auth: `requireUsuario('reclamos.ver')`.
- Query: `estado?` (`ABIERTO|EN_CURSO|RESUELTO|CERRADO|RECHAZADO`), `urgencia?` (`BAJA|MEDIA|ALTA|EMERGENCIA`). Ambos opcionales.
- Respuesta: array de reclamos con `propiedad` (id, direccion, ciudad), `contrato` (id + `inquilinoTitular`), `profesional` (id, nombre, categoria, telefono, rating), ordenados por `createdAt desc`, cada uno con campos SLA (`slaEstado`, `slaVencimiento`, `slaHorasRestantes`, `slaPctConsumido`, `slaTexto`, `slaAlertar`, etc.).
- Errores: 401/403 (guard).

**`GET /reclamos/:id`** — Detalle de un reclamo.
- Auth: `requireUsuario('reclamos.ver')`.
- Params: `id`.
- Respuesta: reclamo con `propiedad`, `contrato` (titular incluye email), `profesional` (completo), `eventos` (orden `fecha asc`), `visita`, `confirmacion`, `rating`, + SLA.
- Errores: 404 `Reclamo inexistente`; 401/403.

**`POST /reclamos/:id/asignar`** — Asigna profesional al reclamo.
- Auth: `requireUsuario('profesional.asignar')`.
- Params: `id`. Body: `profesionalId` (string, requerido).
- Reglas: el profesional debe existir, ser de la inmobiliaria y estar `activo`. **Lock atómico** dentro de transacción: `updateMany` condicionado a `estado NOT IN [RESUELTO,CERRADO,RECHAZADO]`; si `count=0` (cerrado por carrera) → 409. Crea evento `PROFESIONAL_ASIGNADO`.
- Respuesta: reclamo actualizado + SLA.
- Errores: 400 `Indicá qué profesional querés asignar` (body inválido); 404 `Reclamo inexistente`; 409 reclamo ya cerrado (pre-check y lock); 404 `Profesional inexistente o dado de baja`.

**`POST /reclamos/:id/resolver`** — Marca el reclamo como RESUELTO.
- Auth: `requireUsuario('reclamos.gestionar')`.
- Params: `id`. Body: `resolucion` (string, min 5, requerido).
- Reglas: **Lock por estado** en transacción (`updateMany` con `estado NOT IN cerrados`; `count=0` → 409) — evita resolver/rechazar concurrentes. Setea `estado=RESUELTO`, `resolucion`, `resueltoAt=now`. Crea evento `RESUELTO`.
- Respuesta: reclamo + SLA.
- Errores: 400 `Contá cómo se resolvió (mínimo 5 caracteres)`; 404 `Reclamo inexistente`; 409 `El reclamo ya fue decidido`.

**`POST /reclamos/:id/rechazar`** — Rechaza el reclamo.
- Auth: `requireUsuario('reclamos.gestionar')`.
- Params: `id`. Body: `motivo` (string, min 5, requerido).
- Reglas: mismo lock atómico; setea `estado=RECHAZADO`, `resolucion=motivo`. Crea evento `RECHAZADO`.
- Respuesta: reclamo + SLA.
- Errores: 400 `Contale al inquilino por qué se rechaza (mínimo 5 caracteres)`; 404 `Reclamo inexistente`; 409 `El reclamo ya fue decidido`.

**`POST /reclamos/:id/responder`** — Agrega un mensaje de la inmobiliaria al timeline.
- Auth: `requireUsuario('reclamos.gestionar')`.
- Params: `id`. Body: `mensaje` (string, min 1, requerido).
- Respuesta: el `ReclamoEvento` creado (`tipo=MENSAJE_INMO`). No cambia estado del reclamo.
- Errores: 400 `Escribí el mensaje para el inquilino`; 404 `Reclamo inexistente`.

### Reclamos — inquilino

**`GET /mis-reclamos`** — Reclamos del contrato del inquilino.
- Auth: `requireInquilino`.
- Reglas: si el inquilino no tiene `contratoId` → `[]`.
- Respuesta: array (filtrado por `contratoId` + `inmobiliariaId`) con `eventos`, `profesional` (id, nombre, telefono, categoria), `confirmacion` (estado, fecha, comentario), `rating` (estrellas, comentario, enviadoAt), orden `createdAt desc`, + SLA.
- Errores: 401 (guard).

**`POST /mis-reclamos`** — Crea un reclamo.
- Auth: `requireInquilino`.
- Body: `titulo` (string, min 3, req), `descripcion` (string, min 5, req), `categoria` (`PLOMERIA|ELECTRICIDAD|CERRADURA|CALEFACCION|OTRO`, req), `urgencia` (`BAJA|MEDIA|ALTA|EMERGENCIA`, req), `fotoUrl?` (string, opcional — URL ya subida a /uploads).
- Reglas: requiere `contratoId` activo; el modelo no tiene `titulo` → se guarda como `descripcion = "{titulo} — {descripcion}"`. `propiedadId` se toma del contrato. Crea con `estado=ABIERTO` + evento `CREADO` (transacción).
- Respuesta: 201, reclamo creado + SLA.
- Errores: 400 `No tenés un contrato activo` (sin contratoId); 400 `Datos del reclamo incompletos` (body inválido); 404 `Contrato inexistente`.

**`POST /mis-reclamos/:id/confirmar-resolucion`** — El inquilino ratifica o rechaza el cierre.
- Auth: `requireInquilino`.
- Params: `id`. Body: `decision` (`CONFORME|PERSISTE`, req), `comentario?` (string, trim, max 500). Si `decision=PERSISTE`, `comentario` es obligatorio.
- Reglas: requiere `contratoId`; el reclamo debe estar en `RESUELTO`. **Lock**: `updateMany` condicionado a `estado=RESUELTO` (la primera request gana; resto `count=0` → 409).
  - `CONFORME` → `estado=CERRADO`, crea `ConfirmacionReclamo` (única por reclamo, `reclamoId @unique`) + evento `CERRADO`.
  - `PERSISTE` → `estado=EN_CURSO` (reabre), conserva `resueltoAt` como ancla del SLA, crea evento `MENSAJE_INQUILINO`; NO crea `ConfirmacionReclamo` (one-shot por @unique).
- Respuesta: reclamo recargado (con eventos, profesional, confirmacion, rating) + SLA.
- Errores: 400 `No tenés un contrato activo`; 400 `Decisión inválida`; 400 `Contanos qué sigue pasando` (PERSISTE sin comentario); 404 `Reclamo inexistente`; 409 `Este reclamo no está esperando tu confirmación` (estado ≠ RESUELTO); 409 `El reclamo ya fue cerrado` / `El reclamo ya cambió de estado` (lock).

**`POST /mis-reclamos/:id/rating`** — Califica el reclamo (upsert).
- Auth: `requireInquilino`.
- Params: `id`. Body: `estrellas` (int, 1–5, req), `comentario?` (string, trim, max 300).
- Reglas: requiere `contratoId`; el reclamo debe estar `RESUELTO` o `CERRADO`. **Upsert** por `reclamoId @unique` (re-calificable). Si el reclamo tiene `profesionalId`, **recalcula `profesional.rating`** = promedio (`_avg`) real de todas las estrellas de sus reclamos calificados.
- Respuesta: `{ reclamoId, estrellas, comentario, enviadoAt }`.
- Errores: 400 `No tenés un contrato activo`; 400 `Elegí entre 1 y 5 estrellas`; 404 `Reclamo inexistente`; 409 `Solo podés calificar un reclamo resuelto` (estado no resuelto/cerrado).

### Red de profesionales

**`GET /profesionales`** — Lista profesionales de la inmobiliaria.
- Auth: `requireUsuario('profesionales.ver')`.
- Query: `categoria?` (`PLOMERO|ELECTRICISTA|GASISTA|CERRAJERO|PINTOR|TECNICO_AC|FLETE`), `activo?` (`'true'|'false'` como string). Opcionales.
- Respuesta: array de profesionales, orden `rating desc`, luego `nombre asc`.
- Errores: 401/403.

### Consorcios

(No hay capacidad propia de consorcios; se usa `propiedades.ver`.)

**`GET /consorcios`** — Lista consorcios.
- Auth: `requireUsuario('propiedades.ver')`.
- Respuesta: array con `unidades` (orden `id asc`), orden `desde asc`.
- Errores: 401/403.

**`GET /consorcios/:id`** — Detalle de consorcio.
- Auth: `requireUsuario('propiedades.ver')`.
- Params: `id`.
- Respuesta: consorcio con `unidades` (id asc), `movimientos` (fecha desc), `asambleas` (fecha desc).
- Errores: 404 `Consorcio inexistente`; 401/403.

**`POST /consorcios`** — Alta del edificio (Fase 1 CRUD).
- Auth: `requireUsuario('propiedades.crear')`.
- Body: `nombre` (≥2, req), `direccion` (≥3, req), `periodoActual?` (`YYYY-MM`, default mes actual), `expensasPeriodoActual?` (≥0, default 0), `encargado?` (`{nombre, sueldo}` | null), `sociedadId?` (min 1, validada al tenant), `desde?` (date).
- Respuesta: `201` consorcio con `unidades: []` (`cantUf` arranca en 0, derivado).
- Errores: 400 datos incompletos; 404 `Sociedad inexistente`.

**`PUT /consorcios/:id`** — Edición del edificio (parcial).
- Auth: `requireUsuario('propiedades.crear')`. Mismo body que POST, todo opcional; `encargado: null` explícito lo saca.
- Respuesta: consorcio con `unidades`. Errores: 400/404.

**`POST /consorcios/:id/unidades`** — Alta de UF.
- Auth: `requireUsuario('propiedades.crear')`. `saldoDeudor` con rol CARGA → 403 (plata).
- Body: `identificacion` (req, única por consorcio case-insensitive), `titular` (req), `coeficiente` (>0 ≤100, req), `telefono?`, `cargoFijo?` (null = prorrateo), `estado?`, `saldoDeudor?` (deuda histórica al migrar).
- Reglas: validación Σ coeficientes ≤ 100 (tolerancia 0.01) **dentro de tx Serializable** (P2034→409 reintentable); `@@unique(consorcioId, identificacion)` como backstop (P2002→409 amigable); `cantUf` incrementado en la misma tx.
- Errores: 400 coeficiente supera el disponible; 409 unidad duplicada; 404.

**`PUT /consorcios/:id/unidades/:ufId`** — Edición de UF (parcial, mismas validaciones en tx Serializable).

**`DELETE /consorcios/:id/unidades/:ufId`** — Baja de UF.
- Auth: `propiedades.crear` + **rol CARGA → 403**. 409 si `saldoDeudor > 0`. `cantUf` decrementado en la misma tx.

**`POST /consorcios/:id/movimientos`** — Movimiento financiero del edificio.
- Auth: `requireUsuario('gasto.caja.cargar')` (ADMIN/OPERADOR — es plata, no estructura).
- Body: `fecha` (req), `concepto` (≥2, req), `monto` (≠0; **el signo va acoplado a la categoría**: `COBRANZA` = positivo/ingreso, el resto = negativo/egreso), `categoria` (`COBRANZA|SUELDO|MANTENIMIENTO|SERVICIO|IMPUESTO|OTRO`).
- Errores: 400 signo≠categoría o datos incompletos; 404.

**`DELETE /consorcios/:id/movimientos/:movId`** — Solo **ADMIN** (precedente `caja.eliminar`). 404 si no existe.

**`POST /consorcios/:id/asambleas`** — Registra el acta (`fecha`, `tipo` `ORDINARIA|EXTRAORDINARIA`, `asunto` ≥3, `asistentes` ≥0, `acuerdoPrincipal` ≥3).

**`DELETE /consorcios/:id/asambleas/:asambleaId`** — `propiedades.crear`, CARGA → 403.

### Renovaciones

**`GET /renovaciones`** — Contratos activos con datos de vencimiento.
- Auth: `requireUsuario('contratos.ver')`.
- Respuesta: array de contratos `ACTIVO` (id, fechaInicio, fechaFin, monto, moneda, tipoContrato, `propiedad`, `inquilinoTitular`, `intencionRenovacion`), orden `fechaFin asc`, cada uno con `diasParaVencimiento` (entero, días hasta `fechaFin`).
- Errores: 401/403.

**`POST /renovaciones/:contratoId/decision`** — Registra la decisión de renovación (upsert).
- Auth: `requireUsuario('contrato.aprobar')` (rol ADMIN) **+ PIN** (acción sensible: pisa la intención del inquilino).
- Params: `contratoId`. Body: `decision` (`RENOVAR|NO_RENOVAR|PENSANDO|SIN_RESPUESTA`, req), `notas?` (string), `pin?` (string).
- Reglas: PIN verificado vía `verificarPinUsuario` (bloqueo anti-fuerza-bruta). El contrato debe estar `ACTIVO`. **Upsert** de `IntencionRenovacion` por `contratoId`. `decididoAt = null` si `decision=SIN_RESPUESTA`, si no `now`.
- Respuesta: la `IntencionRenovacion` creada/actualizada.
- Errores: 400 `Decisión inválida — usá RENOVAR, NO_RENOVAR, PENSANDO o SIN_RESPUESTA`; código/mensaje del PIN inválido (vía `verificarPin`, p.ej. 401/403/429 según `verificarPinUsuario`); 404 `Contrato inexistente`; 409 `Solo se registra la decisión sobre contratos activos`.

---

Notas transversales:
- **Idempotencia/locks**: las transiciones de estado de reclamo usan `updateMany` condicional como lock optimista; `count=0` lanza `ConflictoEstadoReclamo` → 409, evitando doble-cierre y eventos contradictorios.
- **Unicidad**: `ConfirmacionReclamo` y `RatingReclamo` son `reclamoId @unique` (confirmación one-shot; rating re-calificable vía upsert).
- Códigos de error exactos del PIN no están en este archivo (los define `verificarPinUsuario` en `auth/pin.ts`).


## inquilino-mundo.ts

Base path montada por el plugin (las rutas abajo son relativas al prefijo con que se registra `inquilinoMundoRoutes`). Multi-tenant: todo filtra/escribe por `inmobiliariaId` del guard. Guards definidos en `apps/api/src/auth/guards.ts`; permisos en `packages/shared/src/permisos.ts` (`rolTienePermiso`).

### `GET /mi-contrato`
- **Auth:** `requireContratoAcceso` (inquilino titular o co-inquilino con acceso ACEPTADO).
- **Request:** ninguno.
- **Respuesta:** objeto contrato del inquilino: `id`, `direccion`, `ciudad`, `inmobiliaria`, `inmobiliariaTelefono`, `fechaInicio`/`fechaFin`/`proximoAjuste` (YYYY-MM-DD), `diaPago`, `indiceAjuste`, `montoActual`, `montoExpensas`, `tipoContrato`, `tasaPunitorioDiaria`, `moneda`, y `datosCobranza` (`{ modo: 'PROPIETARIO_DIRECTO'|'INMOBILIARIA', titular, cuit, banco, cbu, alias }` o `null`).
- **Reglas de negocio:** `datosCobranza` sale siempre de la DB real (cuenta del propietario en modo PROPIETARIO_DIRECTO, o cuenta de la sociedad del contrato / sociedad principal en modo INMOBILIARIA). Si no hay cuenta cargada válida (`cbu`+`titular`) devuelve `null` — nunca inventa datos bancarios.
- **Errores:** `404` si el inquilino no tiene `contratoId` ("No tenés un contrato activo"); `404` si el contrato no existe en ese tenant ("Contrato inexistente").

### `GET /certificado`
- **Auth:** `requireInquilino` (solo el inquilino titular logueado, no co-inquilino).
- **Request:** ninguno.
- **Respuesta:** certificado: `id`, `hash` (formato `XXXX-XXXX-XXXX`), `inquilino` (`nombre`, `dni`, `email`, `telefono`), `contratoActual` (`direccion`, `inmobiliaria`, `fechaInicio`, `montoMensual`, `moneda`, `mesesCumplidos`), `historial` (`cuotasTotales`, `cuotasPagadas`, `cuotasAlDia`, `atrasoPromedioDias`, `pagosRechazados`, `ratingPromedio`), `nivel` (`EXCELENTE`/`BUENO`/`REGULAR`/`NUEVO`), `nivelDetalle`, `generadoAt`, `validoHasta`, `urlVerificacion`, `revocadoAt`.
- **Reglas de negocio:** historial calculado server-side desde liquidaciones REALES (comparación normalizada al inicio del día UTC), pagos `RECHAZADO` y promedio de ratings de reclamos. `hash` determinístico (FNV/djb2) sobre datos inmutables `dni|contratoId|nombreInmobiliaria` → el link compartido sigue vivo aunque crezca el historial. Persiste vía `upsert` por `hash` (idempotente; refresca el snapshot). `validoHasta` = +30 días.
- **Errores:** `400` si no hay `contratoId` ("No tenés un contrato activo para certificar"); `404` inquilino inexistente; `404` contrato inexistente.

### `POST /screening`
- **Auth:** `requireUsuario` con capacidad **`screening.ver`** (usuario del panel).
- **Request body:** `cuit` (string, requerido, regex `^\d{2}-?\d{8}-?\d{1}$`), `nombre` (string, requerido, trim min 3).
- **Respuesta:** `201` con la fila `Screening` creada (estado `COMPLETO`, identidad + bcra + cheques + familia + ingresos + empleador + huella digital + `scoreNosis` + `recomendacion` + `recomendacionRazon`).
- **Reglas de negocio:** informe **simulado determinístico** — la identidad (cuit/nombre/apellido) es exactamente la solicitada; el resto se deriva por semilla FNV-1a del CUIT (mismo CUIT → mismo perfil). `recomendacion` (APTO / APTO_CON_GARANTIA / NO_APTO) según `scoreNosis`.
- **Errores:** `400` si CUIT/nombre inválidos.

### `GET /screenings`
- **Auth:** `requireUsuario` con capacidad **`screening.ver`**.
- **Request:** ninguno.
- **Respuesta:** array de filas `Screening` del tenant, orden `createdAt desc`.

### `GET /co-inquilinos`
- **Auth:** `requireContratoAcceso` (titular o co-inquilino).
- **Request:** ninguno.
- **Respuesta:** array de filas `CoInquilino` del contrato (orden `invitadoAt desc`); `[]` si no hay `contratoId`.

### `POST /co-inquilinos`
- **Auth:** `requireInquilino` (solo el titular).
- **Request body:** `nombre` (req, trim min 3), `email` (req, email), `relacion` (req, trim min 2), `permiso` (req, enum `VER`/`PAGAR`/`COMPLETO`), `dni` (opcional), `telefono` (opcional).
- **Respuesta:** `201` con la fila `CoInquilino` creada + `tokenInvitacion` (JWT `kind: 'co-invitacion'`, expira 7d, no persistido — se firma al vuelo para el link/WhatsApp).
- **Reglas de negocio:** email normalizado a lowercase. Anti-duplicado por email en el contrato — chequeo `findFirst` + respaldo del índice único `@@unique([contratoId, email])` que captura la carrera concurrente (P2002).
- **Errores:** `400` datos incompletos; `409` ya hay invitación con ese email (tanto por chequeo previo como por P2002).

### `POST /co-inquilinos/:id/link`
- **Auth:** `requireInquilino` (solo el titular del contrato).
- **Request:** param `:id` del co-inquilino.
- **Respuesta:** `{ tokenInvitacion }` (JWT `co-invitacion`, 7d).
- **Reglas de negocio:** regenerar el link **rota la credencial**: si el co-inquilino estaba `ACEPTADO` lo vuelve a `PENDIENTE` (`aceptadoAt: null`), invalidando la sesión vigente (porque `requireContratoAcceso` exige estado ACEPTADO). Aceptación es de un solo uso.
- **Errores:** `404` co-inquilino inexistente (también si no coincide con el `contratoId` del titular).

### `POST /co-inquilinos/:id/aceptar`
- **Auth:** `requireInquilino` (titular).
- **Request:** param `:id`.
- **Respuesta:** fila `CoInquilino` actualizada a `ACEPTADO` (`aceptadoAt: now`).
- **Reglas de negocio:** **solo disponible en `DEMO_MODE`** — la aceptación real ocurre por el link de invitación (en `auth.ts`); este endpoint solo simula.
- **Errores:** `404` invitación inexistente; `409` ya aceptada; `403` si no está en modo demo ("La aceptación real llega por el link de invitación…").

### `PATCH /co-inquilinos/:id/permiso`
- **Auth:** `requireInquilino` (titular).
- **Request:** param `:id`; body `permiso` (req, enum `VER`/`PAGAR`/`COMPLETO`).
- **Respuesta:** fila `CoInquilino` con el `permiso` actualizado.
- **Errores:** `400` permiso inválido; `404` co-inquilino inexistente.

### `DELETE /co-inquilinos/:id`
- **Auth:** `requireInquilino` (titular).
- **Request:** param `:id`.
- **Respuesta:** `{ ok: true }`.
- **Errores:** `404` co-inquilino inexistente.

### `GET /boletas`
- **Auth:** `requireContratoAcceso` (titular o co-inquilino).
- **Request:** ninguno.
- **Respuesta:** array de filas `BoletaServicio` del contrato (orden `periodo desc`, luego `subidoAt desc`); `[]` si no hay `contratoId`.

### `POST /boletas`
- **Auth:** `requireInquilino` (titular).
- **Request body:** `servicio` (req, enum `LUZ`/`GAS`/`AGUA`/`INTERNET`/`ABL`/`CABLE`), `periodo` (req, regex `^\d{4}-\d{2}$`), `monto` (opcional, positivo), `vencimiento` (opcional, string fecha), `nombreArchivo`/`tipoMime`/`archivoUrl`/`notas` (opcionales), `tamanioBytes` (opcional, int ≥0).
- **Respuesta:** `201` con la fila `BoletaServicio` creada.
- **Reglas de negocio:** límite de tamaño 2 MB; no se permiten períodos futuros. `monto` por defecto = consumo promedio mensual del `ServicioPublico` de la propiedad (o 0). `vencimiento` por defecto = día 10 del mes siguiente al período. `archivoUrl` por defecto = PNG placeholder en base64.
- **Errores:** `400` si no hay `contratoId`; `400` datos incompletos; `400` si supera 2 MB; `400` período futuro; `400` fecha de vencimiento inválida.

### `GET /servicios`
- **Auth:** `requireInquilino` (titular).
- **Request:** ninguno.
- **Respuesta:** array de filas `ServicioPublico` de la propiedad del contrato (NIS, distribuidora, medidor; orden `tipo asc`); `[]` si no hay `contratoId` o contrato.

### `GET /mis-notificaciones`
- **Auth:** `requireContratoAcceso` (titular o co-inquilino).
- **Request:** ninguno.
- **Respuesta:** array (máx 8) de notificaciones `{ id, titulo, detalle, href, cuando, icono, severidad }` con `severidad ∈ {critica, alta, media, baja}`, ordenadas por severidad descendente; `[]` si no hay `contratoId`.
- **Reglas de negocio:** feed **derivado del estado real**, no almacenado. Combina: (1) liquidaciones impagas (comprobante en revisión / vencido=crítica / próximas ≤5 días=alta), (2) pagos decididos últimos 30 días (rechazado=crítica / confirmado=media), (3) reclamos (respuesta de la inmo=alta, profesional asignado=alta, resuelto sin rating=baja). El `unread` lo resuelve el cliente (localStorage).

### `POST /reportes`
- **Auth:** `requireAuth` (cualquier autenticado: usuario del panel, inquilino **o** co-inquilino).
- **Request body:** `tipo` (req, enum `BUG`/`IDEA`), `titulo` (req, trim min 3), `detalle` (opcional), `severidad` (opcional, enum `BLOQUEA`/`MOLESTO`/`MENOR`; solo se guarda si `tipo=BUG`), `url`/`urlCompleta`/`viewport` (opcionales).
- **Respuesta:** `201` con la fila `ReportePiloto` creada.
- **Reglas de negocio:** tracking capturado **automáticamente server-side** (no viene del cliente): `ip`, `userAgent`, `navegador` (derivado del UA), `pantalla` (derivada de la URL), `sessionId` (header `x-session-id`), `build` (header `x-app-build`). Para reportes de inquilinos/co-inquilinos, como `ReportePiloto.usuarioId` es FK obligatoria a `Usuario`, se atribuye al ADMIN activo del tenant como receptor y se conserva la autoría real en `rol='INQUILINO'` + `sessionId` con prefijo (`inquilino:` / `co-inquilino:`).
- **Errores:** `400` tipo/título inválidos; `409` si un inquilino/co-inquilino reporta pero la inmobiliaria no tiene ADMIN activo ("La inmobiliaria no tiene un administrador activo…").

### `GET /reportes`
- **Auth:** `requireUsuario` (usuario del panel) **+** `rol === 'ADMIN'` o permiso **`auditoria.ver`**.
- **Request:** ninguno.
- **Respuesta:** array de filas `ReportePiloto` del tenant (orden `reportadoAt desc`), cada una con `usuario` (nombre/apellido/rol) y campo derivado `reportadoPor` — nombre real del autor resuelto desde `Inquilino`/`CoInquilino` vía el prefijo de `sessionId` (fallback "Inquilino"/"Co-inquilino"), o nombre del usuario del panel.
- **Errores:** `403` si el rol no es ADMIN ni tiene `auditoria.ver` ("Tu rol no permite ver los reportes del piloto").


## anuncios.ts

Prefijo de rutas: registradas vía `anunciosRoutes(app)`. Multi-tenant: todo filtra por `inmobiliariaId` del token. Canales fijos `['APP','EMAIL']` (decisión de producto, el body no los acepta). Sin PIN: `comunicaciones.enviar` no es capacidad sensible (`requierePin=false`).

---

### `GET /anuncios` — listado panel con conteos reales
- **Auth:** `requireUsuario(request, reply, 'comunicaciones.enviar')` (usuario de inmobiliaria; ADMIN/OPERADOR). Nota en código: antes era `contratos.ver`, se endureció a `comunicaciones.enviar` para que CARGA/LECTURA no lean el cuerpo de las comunicaciones por API directa.
- **Request:** sin body/query.
- **Respuesta:** array de anuncios (todos los campos de la fila `Anuncio` salvo `acuses`) + `conteos: { leido, confirmado, total }`, donde `leido`/`confirmado` se cuentan sobre `AnuncioAcuse` (filas con `leidoAt`/`confirmadoAt`) y `total = destinatariosCount`. Orden `enviadoAt desc`.
- **Errores:** 401/403 del guard.

### `POST /anuncios` — crear anuncio (audiencia resuelta server-side)
- **Auth:** `requireUsuario(..., 'comunicaciones.enviar')`.
- **Body (zod):**
  - `titulo` string, min 3 — **requerido**
  - `cuerpo` string, min 5 — **requerido**
  - `prioridad` enum `NORMAL|IMPORTANTE|URGENTE`, default `NORMAL`
  - `audiencia` enum **requerido**: `TODOS_INQUILINOS | INQUILINOS_MOROSOS | INQUILINOS_PENDIENTES | TODOS_PROPIETARIOS | TODOS_CONSORCIOS | INQUILINOS_CONSORCIO | CONTRATOS_ESPECIFICOS`
  - `audienciaIds` string[], default `[]` (IDs de consorcio o de contrato según audiencia)
- **Reglas de negocio:**
  - La audiencia se resuelve server-side (`resolverAudiencia`): cuenta destinatarios reales y arma la lista de inquilinos alcanzados.
  - `INQUILINOS_CONSORCIO`: match por FK `propiedad.consorcioId`; fallback heurístico por dirección (`contains` base normalizada del consorcio) para propiedades sin FK.
  - `INQUILINOS_MOROSOS`/`PENDIENTES`: derivan estado de pago de hasta 6 liquidaciones (vencida manda; si no, la más reciente).
  - `TODOS_PROPIETARIOS`/`TODOS_CONSORCIOS`: cuentan destinatarios pero no generan acuses.
  - `canales` forzado a `['APP','EMAIL']`; `enviadoPor` = nombre+apellido del usuario o `'Panel'`; `enviadoAt` = ahora.
- **Respuesta:** `201` con la fila `Anuncio` creada + `conteos: { leido: 0, confirmado: 0, total: destinatariosCount }`.
- **Errores:**
  - `400` — falla zod (título/cuerpo/audiencia incompletos).
  - `400` — `audiencia` es `INQUILINOS_CONSORCIO` o `CONTRATOS_ESPECIFICOS` pero `audienciaIds` está vacío.
  - `409` — la audiencia resuelta no alcanza a nadie (`destinatariosCount === 0`).
  - 401/403 del guard.

### `DELETE /anuncios/:id` — eliminar anuncio
- **Auth:** `requireUsuario(..., 'comunicaciones.enviar')`.
- **Params:** `id` (anuncio).
- **Reglas:** borra en una `$transaction` los `AnuncioAcuse` del anuncio y luego el `Anuncio` (cascada manual). Verifica pertenencia por `inmobiliariaId` antes de borrar.
- **Respuesta:** `{ ok: true }`.
- **Errores:** `404` si el anuncio no existe / no es de la inmobiliaria; 401/403 del guard.

### `GET /mis-anuncios` — anuncios que le aplican al inquilino + su acuse
- **Auth:** `requireInquilino(request, reply)` (token de inquilino).
- **Request:** sin body/query.
- **Reglas:** trae solo audiencias visibles a inquilinos (`AUDIENCIAS_INQUILINO`: `TODOS_INQUILINOS, INQUILINOS_MOROSOS, INQUILINOS_PENDIENTES, INQUILINOS_CONSORCIO, CONTRATOS_ESPECIFICOS`) y luego filtra in-memory con `aplicaAlContrato` (estado de contrato `ACTIVO`, estado de pago, match de consorcio por FK o heurística por dirección, o contrato en `CONTRATOS_ESPECIFICOS`). La membresía se evalúa al leer (un moroso que se pone al día deja de ver los "a morosos").
- **Respuesta:** array de anuncios filtrados (campos de la fila `Anuncio`) + `acuse: { leidoAt, confirmadoAt } | null` (el acuse propio del inquilino). Orden `enviadoAt desc`.
- **Errores:** 401 del guard de inquilino.

### `POST /anuncios/:id/leido` y `POST /anuncios/:id/enterado` — acuses reales del inquilino
(Mismo handler generado en loop para ambas acciones.)
- **Auth:** `requireInquilino(request, reply)`.
- **Params:** `id` (anuncio).
- **Request:** sin body.
- **Reglas de negocio:**
  - Verifica pertenencia por `inmobiliariaId` y que el anuncio le aplique al contrato (`aplicaAlContrato`).
  - **Upsert atómico** sobre la unique `[anuncioId, inquilinoId]` (evita P2002 / `409` espurio en doble-tap concurrente).
  - **Idempotente / no pisa valores previos:** `leidoAt` conserva el previo si existía (`leido` no pisa un `leidoAt` anterior); `enterado` setea `confirmadoAt` y completa `leidoAt` si faltaba, preservando el primer `confirmadoAt`.
- **Respuesta:** la fila `AnuncioAcuse` resultante (`inmobiliariaId, anuncioId, inquilinoId, leidoAt, confirmadoAt`).
- **Errores:**
  - `404` si el anuncio no existe / no es de la inmobiliaria.
  - `403` `"Este anuncio no es para vos"` si la audiencia no aplica al contrato del inquilino.
  - 401 del guard de inquilino.


## uploads.ts

Almacenamiento de archivos real sobre un Railway Volume montado en `/data` (en dev/test cae a `os.tmpdir()/myalquiler-uploads`). Directorio configurable por `UPLOADS_DIR`. Los archivos se guardan scopeados por `inmobiliariaId` (tenant), extraído del JWT. Tope global: **10 MB**. Tipos permitidos: JPG, PNG, WEBP, GIF, HEIC, PDF.

### `POST /uploads`
Sube un archivo (multipart) y lo guarda en el Volume, scopeado a la inmobiliaria del que sube. Devuelve la URL servible para persistir en el modelo correspondiente (`Comprobante.pdfUrl`, `BoletaServicio.archivoUrl`, `Documento.archivoUrl`, `Reclamo.fotoUrl`).

- **Auth:** `requireAuth` — cualquier identidad autenticada sirve (usuario de panel, inquilino o co-inquilino). No exige capacidad/permiso. Requiere que el JWT tenga `inmobiliariaId`.
- **Request:** `multipart/form-data` con un campo de archivo (`request.file()`). Sin body JSON ni query.
- **Respuesta (200):**
  - `url` (string) — `/uploads/<tenant>/<uuid>.<ext>`. El nombre en disco es un `randomUUID()` + extensión derivada del MIME (no del nombre original).
  - `nombreArchivo` (string) — nombre original (`data.filename`) o el generado si falta.
  - `tipoMime` (string) — MIME del upload.
  - `tamanioBytes` (number) — tamaño real en disco (vía `stat`).
- **Errores:**
  - `403` — JWT sin `inmobiliariaId` ("Sin inmobiliaria asociada").
  - `400` — no se envió archivo ("Falta el archivo").
  - `415` — MIME fuera de la whitelist `EXT_DE_MIME`.
  - `413` — el archivo supera 10 MB (detectado por `data.file.truncated` de `@fastify/multipart`; se borra el parcial).
  - `401` — propagado por `requireAuth` si no hay/invalida el token.
- **Reglas de negocio:**
  - El nombre de archivo se genera server-side (`randomUUID` + ext por MIME) → nunca se confía en el nombre del cliente; la extensión depende del MIME validado.
  - Crea el directorio del tenant on-the-fly (`mkdir recursive`).
  - Si el `pipeline` de escritura falla, borra el destino parcial y re-lanza (cleanup ante error).
  - Si el stream se trunca por exceso de tamaño, borra el parcial antes de responder 413.

### `GET /uploads/:tenant/:name`
Sirve un archivo previamente subido, solo a identidades de la misma inmobiliaria.

- **Auth:** `requireAuth`. **Acepta el token también por query `?token=`** (lo copia a `Authorization: Bearer` solo si no hay header), porque `<a href>`/`<img src>` no pueden mandar headers. Mismo nivel de auth, distinto transporte.
- **Request:**
  - Path: `tenant` (string, requerido), `name` (string, requerido).
  - Query: `token` (string, opcional) — JWT alternativo al header.
- **Respuesta (200):** stream binario del archivo. Headers `Content-Type` (derivado de la extensión vía `mimeDeArchivo`, fallback `application/octet-stream`) y `Cache-Control: private, max-age=86400`.
- **Errores:**
  - `403` — el `tenant` del path no coincide con el `inmobiliariaId` del token ("Sin acceso a este archivo"). Aislamiento cross-tenant.
  - `400` — nombre inválido / path-traversal (rechaza si `path.basename(name) !== name` o contiene `..`).
  - `404` — archivo inexistente o no es un archivo regular (`stat`/`isFile` falla).
  - `401` — propagado por `requireAuth`.
- **Reglas de negocio:**
  - Anti path-traversal: solo se acepta el basename exacto.
  - Aislamiento por tenant verificado al servir (el path no se sirve si el token es de otra inmobiliaria), redundante con la validación al persistir.

### Helpers exportados (no son rutas, pero soportan las reglas de aislamiento)
- `urlEsDelTenant(url, tenant): boolean` — valida que una URL tenga el formato `/uploads/<tenant>/<name>` y pertenezca al tenant indicado (sin `..`, basename exacto). Usado por endpoints que **persisten** una URL (comprobante, documento) para no guardar URLs externas/arbitrarias ni de otra inmobiliaria (defensa en profundidad sobre el re-chequeo del GET).
- `borrarArchivoSubido(url, tenant): Promise<void>` — borra del Volume el archivo de una URL, **solo si pertenece al tenant** (nunca cross-tenant). Best-effort: si la URL no es nuestra o el archivo no existe, no rompe. Lo usa el DELETE de documentos para no dejar huérfanos en disco.


## documentos.ts

Expediente de documentos de un contrato (lado inmobiliaria). Todos los endpoints usan `requireUsuario(...)` y quedan scopeados por `inmobiliariaId` del usuario. El archivo se sube primero a `POST /uploads` (devuelve la url); estos endpoints solo persisten la url + metadatos en la tabla `DocumentoContrato`.

Helper común `contratoDelTenant`: verifica que el contrato exista y pertenezca a la inmobiliaria del usuario; si no, responde **404 `{ message: 'Contrato no encontrado' }`** y corta.

### GET `/contratos/:contratoId/documentos`
Lista el expediente del contrato.
- **Auth/permiso:** usuario, capacidad `contratos.ver`.
- **Params:** `contratoId` (string, requerido).
- **Respuesta:** array de filas `DocumentoContrato` (orden `subidoAt` desc), cada una con campos completos del modelo y `subidoAt` serializado a ISO string. Campos clave: `id`, `tipo`, `etiqueta`, `garanteIndex`, `periodoLiquidacion`, `nombreArchivo`, `tipoMime`, `tamanioBytes`, `archivoUrl`, `subidoPor`, `subidoAt`, `inmobiliariaId`, `contratoId`.
- **Errores:** `401` (sin auth) / `403` (sin `contratos.ver`) vía guard; `404` si el contrato no es del tenant.

### POST `/contratos/:contratoId/documentos`
Anexa un documento ya subido al expediente.
- **Auth/permiso:** usuario, capacidad `contratos.crear`.
- **Params:** `contratoId` (string, requerido).
- **Body** (`crearSchema`, Zod):
  - `tipo` (enum, **requerido**): `CONTRATO_FIRMADO | DNI_TITULAR_FRENTE | DNI_TITULAR_DORSO | DNI_GARANTE_FRENTE | DNI_GARANTE_DORSO | RECIBO_SUELDO | CONVENIO_DESOCUPACION | PAGARE | FOTO_WHATSAPP | OTRO`.
  - `etiqueta` (string, **requerido**, trim, 1–200 chars).
  - `garanteIndex` (int positivo, ≤20, opcional → guarda `null` si falta).
  - `periodoLiquidacion` (string, trim, ≤20, opcional → `null`).
  - `nombreArchivo` (string, **requerido**, trim, 1–300).
  - `tipoMime` (string, **requerido**, trim, 1–120).
  - `tamanioBytes` (int ≥0, **requerido**).
  - `archivoUrl` (string, **requerido**, trim, 1–500).
- **Reglas de negocio:** `archivoUrl` debe ser un `/uploads` de la **misma** inmobiliaria (validado con `urlEsDelTenant`); previene anexar archivos externos o de otro tenant. `subidoPor` se setea con `u.userId`.
- **Respuesta:** `201` con la fila `DocumentoContrato` creada (`subidoAt` en ISO string).
- **Errores:** `401`/`403` vía guard; `404` si el contrato no es del tenant; `400 { message: 'Datos inválidos', detalle: <zod flatten> }` si falla el schema; `400 { message: 'archivoUrl inválido' }` si la url no pertenece al tenant.

### DELETE `/contratos/:contratoId/documentos/:docId`
Saca el documento del expediente y borra el archivo del Volume.
- **Auth/permiso:** usuario, capacidad `contratos.crear`.
- **Params:** `contratoId` (string, requerido), `docId` (string, requerido).
- **Reglas de negocio:** busca con `findFirst` por las tres claves (`id` + `contratoId` + `inmobiliariaId`) → nadie borra documentos de otro contrato u otra inmobiliaria aunque adivine el `docId`. Tras borrar la fila, hace borrado best-effort del archivo en el Volume con `borrarArchivoSubido(...)` (tenant-scopeado). Nota: este endpoint **no** revalida el contrato vía `contratoDelTenant`; la pertenencia se garantiza por las tres claves del `findFirst`.
- **Respuesta:** `200 { ok: true }` (intencionalmente JSON y no `204`, porque el `apiFetch` del panel siempre llama `res.json()`).
- **Errores:** `401`/`403` vía guard; `404 { message: 'Documento no encontrado' }` si no existe la fila para ese tenant/contrato.


## servicios-publicos.ts

Servicios públicos (LUZ/GAS/AGUA/INTERNET/ABL/CABLE) por propiedad, lado inmobiliaria. Todo scopeado por la inmobiliaria del usuario autenticado vía `requireUsuario`. La propiedad debe pertenecer a esa inmobiliaria (`propiedadDelTenant` valida `Propiedad{ id, inmobiliariaId }` → 404 si no existe/no es del tenant). El `:tipo` se valida contra el enum `TIPO` (`LUZ`, `GAS`, `AGUA`, `INTERNET`, `ABL`, `CABLE`).

**Tipos comunes:**
- Param `:propiedadId` (string), `:tipo` (string, debe estar en el enum).
- Forma de la fila de servicio (serializada): `id`, `inmobiliariaId`, `propiedadId`, `tipo`, `distribuidora`, `nis`, `numeroMedidor` (string|null), `titular` (string|null), `observaciones` (string|null), `consumoPromedioMensual` (number|null, convertido con `Number()`), `actualizadoAt` (ISO string).

---

### GET `/propiedades/:propiedadId/servicios`
Lista los servicios públicos de una propiedad.
- **Auth:** `requireUsuario` con capacidad `propiedades.ver`.
- **Params:** `propiedadId` (string, requerido).
- **Respuesta:** array de filas de servicio serializadas, ordenadas por `tipo` ascendente.
- **Errores:** `401/403` por guard (sin sesión / sin capacidad); `404` "Propiedad no encontrada" si la propiedad no existe o no es del tenant.

---

### PUT `/propiedades/:propiedadId/servicios/:tipo`
Alta o edición de un servicio (upsert por la unique `@@unique([propiedadId, tipo])`).
- **Auth:** `requireUsuario` con capacidad `propiedades.crear`.
- **Params:** `propiedadId` (string, requerido); `tipo` (string, requerido, debe estar en el enum).
- **Body** (`upsertSchema`, todos `string` trimmeados salvo el número):
  - `distribuidora` (string, **requerido**, 1–120).
  - `nis` (string, **requerido**, 1–120).
  - `numeroMedidor` (string, opcional, máx 120).
  - `titular` (string, opcional, máx 200).
  - `observaciones` (string, opcional, máx 500).
  - `consumoPromedioMensual` (number, opcional, no negativo).
  - Los opcionales ausentes se persisten como `null`.
- **Respuesta:** la fila de servicio serializada (creada o actualizada).
- **Reglas de negocio:** upsert atómico por clave `propiedadId_tipo`; en `create` setea `inmobiliariaId` del usuario, en `update` solo actualiza los datos (no toca tenant/propiedad/tipo).
- **Errores:** `401/403` por guard; `400` "Tipo de servicio inválido" si `:tipo` no está en el enum; `404` "Propiedad no encontrada" si no es del tenant; `400` "Datos inválidos" (con `detalle: error.flatten()`) si el body falla la validación Zod. Nota: el tipo se valida **antes** que la propiedad; el body se valida **después** del chequeo de propiedad.

---

### DELETE `/propiedades/:propiedadId/servicios/:tipo`
Elimina un servicio. Idempotente.
- **Auth:** `requireUsuario` con capacidad `propiedades.crear`.
- **Params:** `propiedadId` (string, requerido); `tipo` (string, requerido, debe estar en el enum).
- **Respuesta:** `{ ok: true }`.
- **Reglas de negocio:** usa `deleteMany` por `{ propiedadId, tipo }` → no falla si el servicio no existe (idempotente).
- **Errores:** `401/403` por guard; `400` "Tipo de servicio inválido" si `:tipo` no está en el enum; `404` "Propiedad no encontrada" si no es del tenant.


## health.ts

Todas las rutas se registran sin prefijo adicional dentro de `healthRoutes`.

### `GET /health`
- **Auth / guard:** Público. No usa `requireAuth`, `requireUsuario`, `requireInquilino` ni `requireContratoAcceso`. Sin permiso ni capacidad. No es multi-tenant.
- **Request:** Sin body, query ni params.
- **Respuesta (200):**
  - `ok`: `boolean` — siempre `true`.
  - `db`: `string` — `"up"` si `SELECT 1` contra Postgres (vía Prisma) responde, `"down"` si la query lanza.
  - `ts`: `string` — timestamp ISO 8601 (`new Date().toISOString()`).
- **Errores / códigos:** Ninguno notable. El chequeo de DB está envuelto en `try/catch`; si la base está caída no propaga el error: devuelve igual 200 con `db: "down"` (degradación intencional para no tumbar el endpoint).

Es el único endpoint del archivo: un health check liviano para readiness/liveness que reporta el estado de la conexión a la base sin exponer detalles del error.
