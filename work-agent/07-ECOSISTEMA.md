# 07 — El ecosistema de My Alquiler

> **Qué es este documento.** Un mapa del sistema **por flujo**, no por archivo: seguí la plata y los
> datos atravesando los tres frentes (API ↔ panel de la inmobiliaria ↔ PWA del inquilino) y lo que
> ve y puede hacer cada lado del mostrador en cada momento.
>
> **Fecha:** 2026-08-18 · **Commit analizado:** `70d4be8` (== `origin/main` == **lo que corre en
> producción**, verificado contra `GET /health`).
>
> **Método:** lectura estática del código, el schema, las migraciones y el historial de git, más
> cuatro `GET` de solo lectura contra la API de producción para verificar qué está deployado.
> No se corrió ningún test, no se consultó la base, no se tocó el tenant real.
> **Orden de verdad aplicado: código > git > prod > docs.** Donde el código contradice a
> `work-agent/`, manda el código y queda anotado en §8.
> Lo que no se pudo verificar está marcado como **"no verificado"**, no rellenado.

---

## ⚠️ Antes que nada: hay una credencial de producción en el repo

El usuario y la contraseña del admin del tenant real están **en texto plano** en cuatro archivos
versionados: `README.md:24`, `PROJECT.MD:42`, `work-agent/00-ESTADO.md:39` y
`work-agent/05-DECISIONES.md:95`. **Este repo estuvo público.**

No la transcribo acá. Hay que **rotar esa contraseña** y sacar la línea de los cuatro archivos —
teniendo en cuenta que borrarla del working tree no la saca del historial de git, que es donde va a
seguir viva.

El resto del barrido salió limpio: no hay tokens, claves de API, connection strings de producción ni
webhooks vivos en archivos trackeados ni en el historial. El único connection string es un
placeholder de localhost en `.env.example`.

---

## 1. Resumen ejecutivo

**My Alquiler** es un SaaS multi-tenant de gestión de alquileres, en producción para un tenant real
(Tapia Propiedades). Tres frentes —una API Fastify con **206 endpoints**, un panel Next.js para la
inmobiliaria y una PWA Next.js para el inquilino— sobre un Postgres de **82 modelos** y un volumen de
archivos en Railway. El aislamiento es por `inmobiliariaId` en cada fila, sin middleware global: es
**disciplina por endpoint**, y hoy la disciplina se cumple — no encontré ni un IDOR cross-tenant en
el panel.

**El sistema está mucho mejor de lo que sus propios documentos sugieren, y en un lugar distinto del
que dicen.** Todo lo que `00-ESTADO.md` marca como *"en main, TODAVÍA SIN DEPLOYAR"* **está en
producción**: prod corre exactamente el HEAD de `main`. El 🔴 abierto que el doc declara —
`usuarios.email` sin unicidad global — se cerró hace veinte días. El cargo de reclamo sí llega a la
PWA y sí está deployado (verificado: `GET /mis-cargos` responde 401, no 404). Los conteos publicados
están mal en los cuatro documentos.

**Lo que sostiene el sistema son tres patrones bien aplicados**: el lock atómico
(`updateMany` con el estado en el `WHERE` → `count===0` ⇒ 409) que aparece en cada transición de
plata; la idempotencia del devengo apoyada en `@@unique([contratoId, periodo])`; y una disciplina
notable de comentarios que explican **por qué** cada guard existe, casi siempre citando el bug real
que lo motivó. El código está lleno de cicatrices bien documentadas.

**Lo que está flojo no es el aislamiento entre tenants sino la revocación dentro de uno**, y un
puñado de agujeros de plata que siguen abiertos. Los tres que más me preocupan: cambiar el modo de
cobranza con cobros viejos sin rendir deja plata que **ningún endpoint puede rendirle al dueño** (o,
al revés, hace rendir plata que nunca entró); el profesional que entra por link mágico puede
**cerrar un reclamo con un costo que él mismo declara, sin tope y sin aprobación**, y si no hay
pagador definido ese costo no se le cobra a nadie; y `finalizar` no cierra los cargos contra el
depósito, que quedan insaldables por los cuatro caminos.

**El 30% del schema es cáscara** (25 de 82 modelos sin un solo uso), concentrado casi enteramente en
el vertical de billing —que vive en localStorage y constantes del front— y en modelos de plata que
fueron reemplazados por cómputos derivados. La contracara buena: **no encontré ni un caso de "aprieto
Guardar, veo el toast verde y el dato se fue a localStorage"** en las pantallas vivas de producción.
Ese problema fue real y recurrente en este proyecto, y hoy está cerrado.

**Dos cosas que ningún documento registra y que conviene mirar hoy**: la CI está en rojo hace 44 días
por un `generateStaticParams` faltante, lo que dejó **la demo pública congelada desde el 5 de julio**
— y esa demo es el único canario del modo `apiEnabled === false` que todos los docs dan por
verificado. Y no hay **un solo test de front** en los dos Next apps.
---

## 2. Mapa de los tres frentes

```
┌────────────────────────────┐         ┌────────────────────────────┐
│  apps/inmobiliaria         │         │  apps/inquilino            │
│  admin.myalquiler.com      │         │  app.myalquiler.com        │
│  Next 14 App Router        │         │  Next 14 App Router · PWA  │
│  desktop-first · 34 páginas│         │  mobile-first · 29 páginas │
│  TanStack Query 5          │         │  TanStack Query 5          │
└──────────┬─────────────────┘         └──────────┬─────────────────┘
           │  JWT kind:'usuario' (15d)            │  JWT 'inquilino' | 'co-inquilino' (15d)
           │  Bearer en header                    │  'persona' (switcher) · 'profesional' (3d)
           │                                      │
           └──────────────┬───────────────────────┘
                          ▼
        ┌──────────────────────────────────────────────┐
        │  apps/api — Fastify 5 + Prisma 6             │
        │  api-production-262e.up.railway.app          │
        │  206 endpoints · 25 archivos de rutas        │
        │  16 libs de negocio · 2 guards + 4 helpers   │
        │  cron in-process de devengo (cada 6h)        │
        └───────┬───────────────────────┬──────────────┘
                ▼                       ▼
     ┌────────────────────┐   ┌──────────────────────┐
     │  PostgreSQL        │   │  Railway Volume      │
     │  82 modelos        │   │  /data/uploads/      │
     │  79 enums          │   │    <tenantId>/<uuid> │
     │  44 migraciones    │   │  (sin barrido)       │
     └────────────────────┘   └──────────────────────┘

        packages/shared  → permisos.ts (31 capacidades × 4 roles) · auth.ts (6 schemas JWT) · periodos.ts
        packages/ui      → design system shadcn/Radix (violeta/lavanda)
        packages/config  → tsconfig + tailwind compartidos
```

**Qué comparten de verdad.** Menos de lo que uno esperaría: `@llave/shared` es el único punto de
contacto real entre los tres, y lo importante que vive ahí es la matriz de permisos, los schemas de
JWT y `enumerarPeriodosContrato`. Esta última merece una mención: es **la fuente única compartida**
entre el devengo del backend y el wizard de alta del panel, para que el front nunca ofrezca un
período que el back no vaya a generar (era el bug i36: período huérfano → 400 → rollback del alta
entera).

**Cómo se hablan.** HTTP/JSON con Bearer token, sin GraphQL, sin websockets, sin colas.
Ambos fronts tienen un `lib/api/client.ts` **casi idéntico**, con dos particularidades:

- `apiFetch` hace **auto-logout** ante un 401 con token presente (limpia `token`, `sesion` y
  `persona`, y redirige a `/login?expirada=1`). Sin eso, el inquilino quedaba atrapado para siempre
  en *"No pudimos cargar tu cuenta · Reintentar"* — reintentar con un token muerto nunca funciona.
- `urlDeArchivo()` arma la URL absoluta y **autenticada por query string** para poder ponerla en un
  `<img src>`, porque un `<img>` no puede mandar `Authorization`.

**Cómo NO se hablan.** No hay ningún canal entre el panel y la PWA. Los archivos
`*-cross-app.ts` que parecen un puente **leen el localStorage de la otra app** y solo funcionan en
la demo de GitHub Pages, donde las dos viven bajo el mismo origen. En producción, con dominios
distintos, el navegador aísla el `localStorage`: **leerían siempre vacío**. Están todos gateados por
`apiEnabled`, así que no rompen nada — pero conviene nombrarlo con todas las letras: **son teatro de
demo, no arquitectura**.

**Un detalle de seguridad que salió de ahí:** `anuncios-cross-app.ts` cae, si el storage viene
vacío, a un `SEEDS_FALLBACK` que incluye un anuncio con **un CBU y un alias inventados** ("Nuevo CBU
para cobranzas"). `hooks.ts:236-247` bloquea explícitamente ese fallback en producción con el
comentario correcto: *"si el API falla NUNCA caemos a los SEEDS_FALLBACK locales (tienen un
CBU/alias hardcodeados → riesgo de phishing)"*. Bien resuelto, y muestra el peligro del patrón.

**El otro canal, el que sí existe:** email SMTP (`apps/api/src/mailer.ts`). Es el **único** canal
saliente de toda la plataforma. **No hay integración de WhatsApp de ningún tipo** — `env.ts` no
declara ni una variable `WHATSAPP_*`. Los botones de WhatsApp del panel abren `wa.me` con texto
pre-armado, que es honesto; el problema es el copy de la PWA que promete avisos automáticos
(ver §5.2).

**Observabilidad:** Sonar (error reporting propio) con correlación browser↔backend por el header
`x-sonar-correlation`, generado en un hook `onRequest` y re-asegurado en `onSend` para cubrir el
preflight `OPTIONS`. El único punto donde se reporta a Sonar son los **500 reales**; los 4xx
esperados y los 5xx `expose:true` (que son "Sonar no responde") salen antes por `return`, para no
generar un lazo. No hay Sentry ni PostHog pese a lo que dice `.env.example`.
---

## 3. El modelo de datos es el mapa del negocio

`apps/api/prisma/schema.prisma`, **2728 líneas · 82 modelos · 79 enums · 44 migraciones**.

### 3.1 Las familias (los 82, sin dejar ninguno afuera)

| Familia | N | Modelos |
|---|---|---|
| **Identidad y tenencia** | 12 | `Inmobiliaria` (tenant raíz, el único sin `inmobiliariaId`) · `Usuario` · `Capacidad` · `CodigoOtp` · `CodigoOtpUsuario` · `Sociedad` · `Inquilino` · `Persona` · `CoInquilino` · `InquilinoInvitado` · `CoInquilinoInvitado` · `DocumentoAdjuntoInvitado` |
| **Propiedades** | 6 | `Propietario` · `ArcaConfig` · `CuentaCobranzaDirecta` · `Propiedad` · `ParticipacionPropietario` · `ServicioPublico` |
| **Contratos** | 11 | `Contrato` · `ContratoDraft` · `Garante` · `CargoContrato` · `AjusteAlquiler` · `RenovacionContrato` · `IntencionRenovacion` · `EventoContrato` · `DocumentoContrato` · `Screening` · `CertificadoInquilino` |
| **Plata** | 16 | `Liquidacion` · `Pago` · `Comprobante` · `MovimientoCaja` · `CuentaCaja` · `CierreCaja` · `Rendicion` · `AlquilerRendido` · `GastoRendido` · `IngresoRendido` · `CargoPagado` · `MovimientoFeed` · `DatosBancarios` · `ProximoCambioBancario` · `ResumenBancario` · `CreditoDetectado` |
| **Reclamos y operación** | 8 | `Reclamo` · `ReclamoEvento` · `Profesional` · `ProfesionalRed` · `VisitaProfesional` · `ConfirmacionReclamo` · `RatingReclamo` · `BoletaServicio` |
| **Consorcios** | 7 | `Consorcio` · `UnidadFuncional` · `MovimientoConsorcio` · `AsambleaConsorcio` · `ItemInventario` · `MovimientoInventario` · `ServicioComunConsorcio` |
| **SaaS / billing / growth** | 13 | `Trial` · `TramoPlan` · `TramoPlanConsorcios` · `Factura` · `Suscripcion` · `Cupon` · `CuponAplicado` · `Referido` · `MetaSemestre` · `CohortMes` · `FunnelStep` · `FuenteAdquisicion` · `BloqueadorObjetivo` |
| **Auditoría y comunicaciones** | 5 | `Aprobacion` · `EventoAuditoria` · `ReportePiloto` · `Anuncio` · `AnuncioAcuse` |
| **Documentación / onboarding** | 4 | `ImportacionCartera` · `ChatMensaje` · `SlotDocumento` · `Documento` |

12+6+11+16+8+7+13+5+4 = **82** ✅

### 3.2 El grafo central

```
                         ┌──────────────────┐
                         │   Inmobiliaria   │  TENANT RAÍZ — no tiene inmobiliariaId
                         └────────┬─────────┘
      ┌──────────┬─────────┬──────┴────┬───────────┬──────────┐
      ▼          ▼         ▼           ▼           ▼          ▼
  Sociedad  Propietario  Persona    Usuario   CuentaCaja  Consorcio
      │          │  1:1 ArcaConfig
      │          │  1:1 CuentaCobranzaDirecta
      │          │
      │          └── N:M ParticipacionPropietario ──┐
      │              @@id([propiedadId,propietarioId])
      │              + porcentaje Float (Σ = 100)   │
      │                                             ▼
      └──────────────── sociedadId ──────▶ ╔═══════════════╗
                                            ║   PROPIEDAD   ║◀── consorcioId
                                            ╚══╦═════════╦══╝
                    1 propiedad → N contratos  ║         ║ Propiedad.contratoActualId @unique
                    (Contrato.propiedadId)     ║         ║  ◄── CICLO BIDIRECCIONAL
                                               ▼ N       ▲ 0..1
                            ╔══════════════════════════════════════╗
                            ║             CONTRATO                 ║
                            ║ estado · monto · moneda              ║
                            ║ modoCobranza (vía cobraDirecto…Id)   ║
                            ║ devengarDesde? · moraTipo/moraValor  ║
                            ║ estadoDeposito                       ║
                            ╚═╦══╦══╦══╦══╦══╦══╦══╦════════════════╝
        Inquilino (contratoId @unique) ──┘  │  │  │  │  │  └── DocumentoContrato
          └── personaId (Restrict) ──▶ Persona │  │  │  └───── Garante
        CoInquilino @@unique([contratoId,email])│  │  └──────── CargoContrato ◀─ reclamoId @unique
        AjusteAlquiler · RenovacionContrato ────┘  └─────────── IntencionRenovacion (@unique)
                                               │
                                               ▼ N
                            ╔══════════════════════════════════════╗
                            ║            LIQUIDACION               ║
                            ║  @@unique([contratoId, periodo])     ║  ◄── el pilar del devengo
                            ║  montoAlquiler + montoExpensas       ║
                            ║  montoPunitorio (snapshot, siempre 0)║
                            ║  montoPunitorioManual? (PISA)        ║
                            ╚══════════════════╦═══════════════════╝
                                               ▼ N
                            ╔══════════════════════════════════════╗
                            ║                PAGO                  ║
                            ║ INFORMADO → CONCILIADO | RECHAZADO   ║
                            ║ tipo TOTAL|PARCIAL (sin default)     ║
                            ║ condonado: cancela saldo pero NO es  ║
                            ║            ingreso (fuera de caja)   ║
                            ╚══════════════════╦═══════════════════╝
                                               │ 0..1 (CreditoDetectado.pagoId @unique)
                                   CreditoDetectado ◀── N ── ResumenBancario

  ─── LA PLATA SALE HACIA EL PROPIETARIO ────────────────────────────────────

                            ╔══════════════════════════════════════╗
                            ║              RENDICION               ║
                            ║  propietarioId — NO cuelga del       ║
                            ║  contrato, cuelga del DUEÑO          ║
                            ║  SIN @@unique(propietarioId,periodo):║
                            ║  es INCREMENTAL (N tandas por mes)   ║
                            ║  neto = bruto − comisión − gastos    ║
                            ╚═╦═════════╦═════════╦═══════════╦════╝
                              ▼         ▼         ▼           ▼
                     AlquilerRendido GastoRendido IngresoRendido MovimientoCaja
                     liquidacionId   refId soft:  refId=movCaja  rendicionId?
                     ¡SIN FK!        'caja:<id>'  ¡SIN FK!       descontadoEnRendicion
                     (snapshot)      'reclamo:<id>'              propiedadId (obligatorio)
```

**Observación estructural que vale la pena internalizar:** el eje
`Contrato → Liquidacion → Pago` es **rígido**, con FKs duras. El eje `Rendicion → *Rendido` es
**deliberadamente blando**: snapshots congelados sin FK (comentado en `schema.prisma:1922-1924`
y `1948-1950`). Borrar una liquidación no rompe la integridad de lo ya rendido — pero tampoco
hay constraint que impida un `AlquilerRendido` apuntando a una liquidación inexistente.
El anti-doble-rendir **no es un constraint de DB**: es lógica de aplicación sobre esas filas
(`schema.prisma:1895-1897` lo documenta).

### 3.3 `Persona`: por qué existe separada

`Inquilino` es **fila-por-contrato** (`contratoId @unique`). Con el viejo
`@@unique([inmobiliariaId, email])` sobre `Inquilino`, un mismo inquilino **no podía tener dos
contratos en la misma inmobiliaria**: cargar el segundo daba *"ya está en tu cartera"*. Casos
reales citados en `lib/persona.ts:13-15`: *"el mismo inquilino con 3 locales en La Rioja, un
propietario con diez departamentos de un consorcio"*.

Se resolvió en dos pasos: `c7537c3` creó el modelo (migración `20260705120000_persona_inquilino`)
y `60fa543` **subió la unicidad del email un nivel** (migración
`20260723120000_multi_alquiler_email_persona`: dropea `inquilinos_inmobiliariaId_email_key` y
crea `personas_inmobiliariaId_email_key`).

Tres cosas importantes:

1. **`Persona` es identidad SOLO del lado inquilino.** `Propietario` y `Garante` **no** tienen
   `personaId` — siguen siendo islas de datos duplicados. (La migración
   `20260705140000_garante_persona` existe en el directorio pero el modelo `Garante` vigente no
   tiene el campo: **no verificado** qué pasó ahí.)
2. **Es por tenant, no global.** `Persona.inmobiliariaId` es obligatorio y los dos uniques están
   scopeados. El mismo humano que alquila en dos inmobiliarias tiene **dos filas `Persona`**.
3. **El login, en cambio, es global.** `auth.ts:86` hace
   `findMany({ where: { email, contratoId: { not: null } } })` sobre `Inquilino` **cruzando
   tenants a propósito**, y de ahí sale el "persona-token" para elegir alquiler. O sea:
   *el login es global, la identidad persistida es por tenant.*

La resolución de identidad (`lib/persona.ts:26-91`) prioriza DNI → email → create, y el chequeo
por email va **antes** del create y fuera de un try/catch, porque corre dentro de la transacción
de la fila de importación: un P2002 abortaría la transacción entera y el fallback también fallaría.

### 3.4 Máquinas de estado (y sus callejones sin salida)

**`EstadoContrato`** — `BORRADOR → ACTIVO → {FINALIZADO | RESCINDIDO}` (los dos terminales).
Alta en `core.ts:863`; nace BORRADOR si el tenant tiene `contratosRequierenAprobacion`
(`core.ts:1017`). Activación por `POST /aprobaciones/:id/aprobar` (`plata.ts:2223`), con claim
atómico de la propiedad (`plata.ts:2293-2297`). Finalizar usa lock atómico
(`core.ts:1394-1397`, `updateMany` con `estado notIn [...]` → `count===0` ⇒ 409).

> 🔴 **Estado zombi:** un `BORRADOR` cuya aprobación fue **rechazada** queda con
> `pendienteAprobacion=false`. No puede activarse (no hay aprobación pendiente) y **no puede
> finalizarse**: `core.ts:1387-1389` responde 409 *"Un contrato en borrador no se finaliza;
> rechazá la aprobación"* — pero la aprobación ya está RECHAZADA. **No tiene salida implementada.**

**`EstadoLiquidacion`** — `PENDIENTE → VENCIDO`, y desde cualquiera de los dos a `PAGADO`/`PARCIAL`.
La única reversión es `POST /pagos/:id/anular` (`plata.ts:522`), que recalcula al estado que
corresponda (`:611-621`).

> ⚠️ `marcarLiquidacionesVencidas` **no toca PARCIAL** (documentado en `lib/liquidaciones.ts:189-191`).
> Una cuota parcialmente pagada que vence **nunca** figura VENCIDO en la columna `estado`; la
> morosidad se deriva on-read (`estadoPagoActual` en `core.ts`). `PARCIAL` es un estado
> **absorbente** frente al barrido.

**`EstadoConciliacion` (`Pago.estado`)** — `INFORMADO → {CONCILIADO | RECHAZADO}`, con
`CONCILIADO → RECHAZADO` vía anular. `RECHAZADO` es **terminal sin salida**: un comprobante
rechazado por error obliga a informar uno nuevo. Anular está bloqueado con 409 si ya hay
`AlquilerRendido` (`plata.ts:541-548`) y libera el `CreditoDetectado` (`:563-566`).

**`EstadoDeposito`** — `RETENIDO → {DEVUELTO | NETEADO | EJECUTADO}`, todos terminales
(`plata.ts:897` da 409 "ya fue resuelto"). Dos caminos: al finalizar el contrato
(`core.ts:1466-1474`) o por `POST /contratos/:id/deposito/resolver` (`plata.ts:874`). La capacidad
es `deposito.devolver` (ADMIN), **no** `contratos.crear` — antes un rol CARGA podía retener el
depósito entero.

**`EstadoReclamo`** — `ABIERTO → RESUELTO → {CERRADO | EN_CURSO}` / `RECHAZADO`.

> 🔴 **`EN_CURSO` es inalcanzable desde `ABIERTO` en producción.** El front lo dice literal en
> `reclamos/[id]/page-client.tsx:135-136`: *"Asignar operador interno y 'tomar/poner en curso' no
> tienen endpoint en el API → solo operan en build demo. En prod quedan deshabilitados."*
> El único camino a `EN_CURSO` es que el inquilino **reabra** un reclamo resuelto
> (`PERSISTE`, `operacion.ts:842-843`). Los filtros del panel cuentan
> "abiertos o en curso" juntos, así que el síntoma no se ve — pero el estado no se usa como
> fue diseñado.

**`EstadoVisitaProfesional`** — `ASIGNADO → CONFIRMADA → EN_CAMINO → LISTO`. Es **la máquina
mejor implementada del schema**: `transicionar()` (`visitas-publicas.ts:126-155`) usa
`updateMany WHERE estado=desde` como lock y un `ORDEN_ESTADO` para distinguir "ya pasó por acá"
(idempotente, 200) de "falta un paso" (409). Único reset: reasignar el profesional.

**`EstadoAprobacion`** — `PENDIENTE → {APROBADA | RECHAZADA}`.

> 🔴 De los **4** valores de `TipoAprobacion`, **solo `CONTRATO_CARGADO` tiene ejecución**.
> `DEVOLUCION_DEPOSITO`, `GASTO_CAJA_ELIMINACION` y `AJUSTE_FUERA_DE_INDICE` devuelven **501** y
> la fila queda PENDIENTE (`plata.ts:2245-2256`). Esto es el fix `26fdfa6` del 04/08: **antes
> marcaban APROBADA y no ejecutaban nada** — aprobar una devolución de depósito daba toast verde
> con la garantía intacta.

**`EstadoPropiedad`** — `DISPONIBLE ⇄ ALQUILADA`. `EN_EDICION` es el **default del schema** pero
ningún endpoint lo escribe ni lo saca: una fila que lo tenga (seed, import viejo) **no tiene
salida implementada**.

**Enums de estado a medio morir:**

| Enum | Situación |
|---|---|
| `EstadoScreening` | Nace directo `COMPLETO`. `EN_CURSO` (¡el default!) y `CONVERTIDO` **nunca se escriben** |
| `EstadoBoleta` | Nace `SUBIDA`. **Cero writes de `estado`** en todo `apps/api/src` — no existe endpoint que la marque PAGADA |
| `EstadoInvitadoInquilino` | `InquilinoInvitado` solo aparece como `deleteMany` (`core.ts:857`). Nunca se crea |
| `EstadoFactura` / `EstadoConvenio` / `EstadoReferido` | Cero writes — cáscara |

### 3.5 Cáscaras: el 30% del schema

**25 de 82 modelos (30%) son cáscara.** El grueso se concentra en dos bloques:

- **El vertical SaaS/billing/growth entero: 13 de 13 modelos son cáscara.** El billing vive en
  localStorage y constantes TS del front (`lib/plan.ts`, `lib/cupones.ts`,
  `lib/referidos-storage.ts`, `lib/objetivos-data.ts`).
- **Modelos de plata reemplazados por soluciones derivadas**: `CierreCaja` por el cómputo on-read
  de `GET /caja/cierre` · `CargoPagado` por `CargoContrato.saldadoAt` · `Comprobante` por la
  derivación de `Pago` CONCILIADO · `MovimientoFeed` por composición on-read · `DatosBancarios`
  por `Sociedad.cuentaCobranza` / `CuentaCobranzaDirecta`.

Y **3 modelos a medio circuito**: `Screening` (endpoint vivo, front bloqueado en prod),
`EventoContrato` (**write-only** — se crea en `core.ts:1784` y `:2833`, y **nunca se lee**) y
`Trial` (write-only: `create` en `auth.ts`, nunca se valida vigencia).

Verificado que ni el `seed.ts` ni los scripts de `apps/api/prisma/` tocan ninguno de los 25.

### 3.6 Índices y unicidad — lo que sostiene la plata y lo que falta

**Lo que sostiene:**

| Constraint | Qué garantiza |
|---|---|
| `Liquidacion @@unique([contratoId, periodo])` (`:1650`) | **El pilar del devengo.** Es lo que hace idempotente al cron vía `createMany({skipDuplicates:true})`. Y es la razón de que exista `CargoContrato`: `Liquidacion` es única por período y no tiene concepto (`:1477`) |
| `CREATE UNIQUE INDEX pagos_liquidacionId_informado_key ON pagos(liquidacionId) WHERE estado='INFORMADO'` | **Índice parcial creado a mano** (migración `20260621000000:14`; Prisma no los expresa). Un solo pago pendiente de validación por liquidación → cierra la carrera de doble-informe |
| `CargoContrato.reclamoId @unique` (`:1495`) | Idempotencia de `imputarCostoReclamo` |
| `CreditoDetectado.pagoId @unique` (`:2081`) | Una línea de extracto → a lo sumo un pago |
| `sociedades_principal_activa_key … WHERE esPrincipal AND activa` | Índice parcial a mano. Una sola sociedad principal por tenant. **No borrar si `migrate dev` marca drift** (`:911-913`) |
| `Propiedad.contratoActualId @unique` (`:1223`) | Doble función: modela el 1:1 **y** es el lock anti-doble-activación |
| **Ausencia deliberada** de `@@unique` en `Rendicion` | Documentada (`:1895-1897`): la rendición es **incremental** |

**Cobertura multi-tenant:** verificado modelo por modelo — **los 68 modelos con `inmobiliariaId`
tienen ese campo como prefijo de al menos un índice o unique**. Cobertura 100%.

**Índices que faltan (impacto de performance, no de corrección):**

| # | Falta | Por qué duele |
|---|---|---|
| 🔴 **1** | **`inquilinos.email` no tiene NINGÚN índice** | El login OTP hace `findMany({ where: { email } })` **global, sin tenant**, en `auth.ts:86`, `:375` y `:419`. El unique viejo se dropeó en `20260612042420:224` y el por-tenant en `20260723120000:10`. Hoy no queda nada ⇒ **seq scan sobre `inquilinos` de todos los tenants en cada login y cada reenvío de OTP**. Es el path más caliente de la PWA |
| 2 | `liquidaciones.fechaVencimiento` | `marcarLiquidacionesVencidas` filtra por él y, **cuando lo llama el cron, `inmobiliariaId` es undefined** ⇒ los índices `(inmobiliariaId, …)` no aplican. Seq scan global cada 6h. Falta `@@index([estado, fechaVencimiento])` |
| 3 | `contratos` por `estado` solo | `devengarTodosLosTenants` hace `findMany({ where: { estado:'ACTIVO' } })` global. Seq scan cada 6h |
| 4 | `gastos_rendidos.refId` — **asimetría con su gemelo** | `IngresoRendido` **sí** tiene `@@index([refId])` (`:2044`); `GastoRendido` no. Y se consulta por ahí en el anti-doble-cobro: `operacion.ts:510-512` busca `refId:'reclamo:<id>'` **sin `inmobiliariaId`** ⇒ escanea todos los tenants en cada resolución de reclamo con costo |

**Unicidad que probablemente debería existir:**

- `Inmobiliaria.cuit` **no es `@unique`** — dos tenants pueden registrarse con el mismo CUIT.
- `Propietario` sin `@@unique([inmobiliariaId, cuit])` — se pueden cargar duplicados. Hay una
  migración (`20260803210000_cuit_normalizado`) que existe justamente porque el CUIT convivía en
  dos formatos; se normalizó el formato, **no** se dedupló.
- `AlquilerRendido` sin `@@unique([rendicionId, liquidacionId])` — el anti-doble-rendir depende
  100% de lógica de aplicación. **No verificado** si `POST /rendiciones` tiene un lock
  transaccional que lo cubra.
- `Aprobacion.entidadId` y `EventoAuditoria.entidadId` son **polimórficos sin FK ni índice**
  (documentado en el schema): una aprobación puede quedar apuntando a un contrato borrado.
---

## 4. Multi-tenant, identidad y acceso

### 4.1 Los tokens: hay SEIS, no tres

Todos se firman con el mismo secreto (`app.jwt` en `app.ts:120`, `JWT_SECRET` con `min(16)` en
`env.ts:19`). **La separación entre tipos es por schema zod, no por clave**: cada guard parsea
contra un schema distinto y rechaza lo que no matchea.

| kind | Emisor | Payload | Vida | Guard | Qué habilita |
|---|---|---|---|---|---|
| `usuario` | `POST /auth/login` (`auth.ts:123`), `/auth/registro` (`:258`), `/auth/usuario/otp/verify` (`:360`) | `{kind, userId, inmobiliariaId, rol}` | **15d** | `requireUsuario` (`guards.ts:45`) | Todo el panel, gateado por capacidad |
| `inquilino` | `POST /auth/inquilino/elegir` (`auth.ts:472`), `/auth/demo` (`:595`) | `{kind, inquilinoId, inmobiliariaId, contratoId\|null}` | **15d** | `requireInquilino` (`:82`) + `requireContratoAcceso` (`:186`) | PWA del titular |
| `co-inquilino` | `POST /co-invitacion/:token/aceptar` (`auth.ts:572`) | `{kind, coInquilinoId, inmobiliariaId, contratoId, permiso}` | **15d** | **solo** `requireContratoAcceso` (`:203`) | Lectura del contrato + informar pagos |
| **`persona`** | `POST /auth/otp/verify` (`auth.ts:443-446`) | `{kind, email}` — **sin `inmobiliariaId`** | 15d | `requirePersona` (`:146`) | **Solo** `/auth/inquilino/alquileres` y `/elegir` |
| **`profesional`** | `GET /visitas-publicas/:token` (`visitas-publicas.ts:82-88`) | `{kind, visitaId, inmobiliariaId, profesionalId}` | **3d** | `requireProfesionalVisita` (`:107`) + `requireAuthOProfesional` (`uploads.ts:94`) | Máquina de estados de UNA visita + subir fotos |
| **`co-invitacion`** (un solo uso, no es sesión) | `POST /co-inquilinos` (`inquilino-mundo.ts:888`), `/co-inquilinos/:id/link` (`:917`) | `{kind, coInquilinoId, contratoId}` | 7d | `leerInvitacion()` local (`auth.ts:499-507`) | Canjear la invitación por sesión |

Detalle de diseño (`packages/shared/src/auth.ts:70-78`): `JwtPayloadSchema` es una unión
discriminada de **solo** usuario/inquilino/co-inquilino. `persona` y `profesional` quedan afuera
**a propósito**, así un token de persona en un endpoint normal da 401 en `requireAuth` y un token
normal en `requirePersona` da 403. El `co-invitacion` no tiene schema en shared, así que **no pasa
`requireAuth` en ningún endpoint**.

> Todos los docs (y el prompt de este trabajo) dicen "3 tipos de token". Son 6.

### 4.2 Cómo entra el `inmobiliariaId` — y qué pasa si falta

**No existe hook global ni middleware de tenant.** `app.ts` registra helmet, rate-limit, cors, jwt,
multipart y los hooks de correlación con Sonar, nada más. El `inmobiliariaId` entra **exclusivamente
por el guard que cada handler llama a mano**, y de ahí se propaga a cada `where` escrito a mano.
**Si un endpoint se olvida del guard, no hay red de seguridad.**

`requireUsuario` (`guards.ts:45-79`) saca el tenant **de la DB, no del token**:

```ts
const vigente = await prisma.usuario.findUnique({
  where: { id: payload.userId },
  select: { activo: true, rol: true, inmobiliariaId: true },
});
if (!vigente || !vigente.activo) return reply.code(401).send({ message: 'Tu acceso fue dado de baja' });
const actual = { ...payload, rol: vigente.rol, inmobiliariaId: vigente.inmobiliariaId };
```

Tres propiedades que valen: (a) `activo` se revalida en **cada** request, así dar de baja a un
empleado corta la sesión al instante en vez de esperar 15 días (era el cazabug AM, P0); (b) el rol
autoritativo es el de la tabla; (c) el tenant también — un token viejo no puede seguir apuntando al
tenant anterior.

**Nunca viene del request.** Grepeado: no hay ni un `inmobiliariaId: body…` / `query…` / `params…`
en `apps/api/src/routes/`.

### 4.3 `requireContratoAcceso` y la jerarquía VER(1) < PAGAR(2) < COMPLETO(3)

Para el co-inquilino hace **tres chequeos contra la DB** (`guards.ts:208-220`) y devuelve
**el permiso de la DB, no el del JWT** (`:224`): bajar a alguien de COMPLETO a VER surte efecto al
instante. El `findUnique` sin `inmobiliariaId` está compensado por `:213`, que exige que el tenant
de la fila coincida con el del token.

> ⚠️ **El tier `PAGAR` no gatea nada.** Grep completo de `requireContratoAcceso`: los únicos
> `minPermiso` explícitos son `'VER'` (`plata.ts:1130`, `anuncios.ts:358`); el resto usa el default
> `'VER'`. **No existe una sola llamada con `'PAGAR'` ni `'COMPLETO'`.** La jerarquía de 3 niveles
> funciona pero está sin uso: los tres permisos son operativamente idénticos. Es consecuencia
> directa de la decisión LOCKED nº2 (cualquier co-inquilino puede pagar), que movió
> `POST /pagos/informar` de `'PAGAR'` a `'VER'`.

`exigirContratoActivo` (`guards.ts:244-257`) es un guard aparte, **por endpoint y solo para
escrituras**. Está deliberadamente fuera de `requireContratoAcceso` para que un ex-inquilino
conserve la lectura de su historial.

### 4.4 Roles, capacidades y aprobación

Fuente: `packages/shared/src/permisos.ts:96-135`. 31 capacidades × 4 roles.
Lo que importa del diseño:

- `contratos.crear` incluye a **CARGA** con `rolesAprobacion:['CARGA']`, y `pago.manual.cargar`
  incluye a **OPERADOR** con `rolesAprobacion:['OPERADOR']` ⇒ lo que cargan **queda pendiente
  de aprobación**.
- `contratoQuedaPendiente()` (`permisos.ts:176-180`) suma dos fuentes: el baseline del catálogo
  **y** el switch por tenant `Inmobiliaria.contratosRequierenAprobacion`. Es **fail-closed**: si el
  rol ni siquiera tiene `contratos.crear`, devuelve `true`.
- Se consume en `core.ts:942-945`: si da `true`, el contrato nace **BORRADOR**, no reclama la
  propiedad, **no devenga liquidaciones**, y se crea una `Aprobacion` tipo `CONTRATO_CARGADO`.

**Guards de rol EXPLÍCITOS, más allá de la capacidad** (porque `*.crear` sola dejaría pasar a CARGA):
`DELETE /propietarios/:id` (`core.ts:719`) · `DELETE /propiedades/:id` (`:837`) ·
`PUT /contratos/:id/mora` (`:1238`, porque editar la mora recalcula punitorios de todas las impagas
= borrarle la deuda a un moroso) · `POST /contratos/:id/finalizar` (`:1361`) · `/ajustar`
(`:1645`, `:2744`) · `/renovar` (`:1721`) · `/modo-cobranza` (`:2866`) ·
`POST /importaciones-cartera/:id/confirmar` (`importaciones-cartera.ts:154`, bloquea CARGA **y**
LECTURA).

Tres endpoints donde la capacidad se **subió** respecto de la obvia, con la razón escrita:
`GET /anuncios` pasó de `contratos.ver` a `comunicaciones.enviar` porque CARGA/LECTURA leían el
cuerpo de todas las comunicaciones por API directa (`anuncios.ts:263-266`);
`POST /pagos/:id/anular` usa `pago.revertir` (ADMIN) y no `pago.conciliar`;
`POST /contratos/:id/deposito/resolver` usa `deposito.devolver` (ADMIN) y no `contratos.crear`.

> La columna "requiere PIN" del catálogo es **letra muerta**: `requierePinPara()` sigue devolviendo
> `true` para 7 capacidades, pero `verificarPinUsuario` aprueba siempre (`auth/pin.ts:11-13`) y
> `/auth/me` responde `tienePin:false` fijo. Ver decisión LOCKED nº7.

### 4.5 Los tres accesos sin cuenta, auditados

**a) Profesional por link mágico `/p/:token` — el único bien hecho.**

Token: `randomBytes(24).toString('base64url')` (`operacion.ts:14-16`) = **192 bits de CSPRNG,
no adivinable**. Opaco (no firmado), `@unique` en DB; el bearer que se canjea sí es JWT.
No tiene expiración propia: la vigencia se computa en el GET (`visitas-publicas.ts:69-80`) con
tres reglas — 48h de gracia post-`listoAt`, muere si el reclamo está CERRADO/RECHAZADO, y tope
duro de 60 días desde `reclamo.createdAt`. Vencido → **410**. La sesión dura **3d**.

Qué ve el portador: dirección de la propiedad, **nombre y teléfono del inquilino titular**,
categoría/urgencia/descripción/foto del reclamo. Qué puede hacer: la máquina de estados completa,
subir fotos, y **`POST /listo` cierra el reclamo, acredita el trabajo e imputa el costo**.

> 🔴 **El agujero real:** `POST /visitas-publicas/listo` deja que el portador declare `montoCobrado`
> (`visitas-publicas.ts:242`, `z.number().nonnegative()`, **sin tope**), y eso se imputa como
> `costoTrabajo` y se cobra al PROPIETARIO / INQUILINO / DEPÓSITO según `reclamo.pagador`,
> **sin ninguna aprobación del panel**. Quien tenga el link mueve plata real.
>
> 🔴 **`regenerar-link` no revoca las sesiones ya emitidas.** El propio código lo admite
> (`operacion.ts:394-397`): rota el token opaco, pero el JWT de 3 días sigue válido porque el guard
> compara `profesionalId`, no el token. El endpoint existe justamente para "sospecho que el link se
> filtró" y **no resuelve ese caso**. Para revocar de verdad hay que reasignar a otro profesional.

**b) Garante `/garantes/[token]` — no hay backend.**

El token se genera **client-side, sin DB y sin firma**:
`base64url("llave-garante-v1:" + JSON.stringify({contratoId, exp}))`. El "secreto" está hardcodeado
y el propio archivo lo declara: `garante-token.ts:10` → `const SECRET = 'llave-garante-v1'; //
no-secret: es solo ofuscación visual`. **Es trivialmente forjable para cualquier `contratoId`.**

En producción **no hace nada**: `garantes/[token]/page.tsx:74-106` renderiza "Disponible pronto"
si `apiEnabled`. En demo muestra mocks.

> Hoy no es un agujero porque no está conectado. Pero la ruta ya existe en prod y el token es
> basura criptográfica. **Si alguien enchufa un `GET /garantes/:token` usando `leerGaranteToken`,
> es un IDOR inmediato sobre cualquier contrato de cualquier tenant.**

**c) Verificación `/verificar/[hash]` — mismo caso, peor a futuro.**

`hashCertificado` (`inquilino-mundo.ts:148-164`) es **FNV-1a de 32 bits + djb2 de 32 bits**
concatenados en base36 y recortados a 12 chars. **No es criptográfico, no tiene sal, no tiene
secreto y es determinístico**: quien conozca DNI + `contratoId` + nombre de la inmobiliaria lo
recomputa en una línea de JS.

Se persiste en `CertificadoInquilino.hash @unique` **con snapshots JSON de nombre, DNI, email,
teléfono, dirección y monto del alquiler**. Hay columna `revocadoAt` — y **nadie la escribe**.
`validoHasta` se guarda y nadie lo consulta.

En producción tampoco resuelve nada: no existe endpoint que busque por hash, y la página corta con
`if (API_HABILITADO)`. El comentario del archivo explica por qué: en demo,
`buscarCertificadoPorHash()` devolvía el certificado del inquilino mock **para cualquier hash con
formato válido**.

> **El hash ya está calculado y guardado en producción, con PII adentro.** El día que se abra el
> endpoint público, el identificador que lo protege es derivable. Hay que reemplazarlo por
> `randomBytes(16)` o un HMAC con `JWT_SECRET` **antes** de escribir ese endpoint, no después.

### 4.6 Co-inquilinos

Invitar es **solo del titular** (`requireInquilino`) — un co-inquilino con COMPLETO no puede invitar
a nadie. Dedup por `@@unique([contratoId, email])`. El token **no se persiste**: se firma al vuelo.

Aceptar (`auth.ts:534-583`) tiene dos guardas que antes no estaban: **409 si el contrato no está
ACTIVO** (`:544-546`) y **un solo uso con lock atómico** (`:554-563`, `updateMany` con
`estado: { not: 'ACEPTADO' }` → `count===0` ⇒ 409). Antes el link servía infinitas veces dentro de
sus 7 días.

`POST /co-inquilinos/:id/link` devuelve la invitación a PENDIENTE si estaba ACEPTADA — y eso
**revoca la sesión vigente en el acto**, porque `requireContratoAcceso` exige `estado==='ACEPTADO'`.
Es rotación real de credencial (a diferencia del link del profesional).

**Qué NO puede el co-inquilino** (todo lo que va por `requireInquilino`): subir boletas, abrir
reclamos / mandar mensajes / confirmar resolución / calificar, documentos personales y avatar,
certificado de buen pagador, gestionar co-inquilinos, ver servicios de la propiedad.
**Qué sí, incluso con permiso VER**: ver el contrato (incluido el CBU de cobranza), cargos,
liquidaciones, pagos y comprobantes, boletas, notificaciones, anuncios — **e informar un pago**.

### 4.7 El punto débil

Barrí `apps/api/src/routes/` buscando `findUnique`/`update`/`delete` con un id del request sin
`inmobiliariaId`. **No encontré ni un caso de IDOR cross-tenant explotable en el panel**: casi todos
están precedidos, en el mismo handler, por un `findFirst({ where: { id, inmobiliariaId } })` que da
404 si el recurso no es del tenant, y los caminos de plata además llevan doble capa (`findFirst`
scoped + `updateMany` con `inmobiliariaId` en el WHERE: `plata.ts:436-438`, `:558-560`, `:2270-2280`).

**Lo que está flojo no es el aislamiento *entre* tenants: es la revocación *dentro* de uno.**

**1. 🔴 `requireInquilino` no revalida NADA contra la DB — la asimetría más grande del sistema.**
`guards.ts:82-90` devuelve el payload tal cual. `requireUsuario` hace lookup por PK;
`requireContratoAcceso` con co-inquilino hace tres chequeos; `requireProfesionalVisita` revalida la
visita. **El titular es el único que corre 15 días con `inquilinoId`, `inmobiliariaId` y
`contratoId` congelados en el token, sin que nada los confronte.** Los comentarios de los otros
guards explican exactamente por qué eso es un agujero ("el token dura 15 días… revocación real, no
solo confiar en un JWT de larga vida", `guards.ts:104-105`) — y el titular quedó afuera de esa
pasada. Borrar la fila `Inquilino` no revoca la sesión. Peor: `/mi-contrato` valida
`contratoId + inmobiliariaId` **ambos sacados del mismo token** (`inquilino-mundo.ts:496`), o sea
que valida el token contra sí mismo. No es explotable hoy sin firmar un JWT, pero la propiedad de
"revocación efectiva" que el resto del sistema tiene, acá no existe.
**Es el arreglo con mejor relación valor/esfuerzo del informe: ~6 líneas en `guards.ts`.**

**2. 🔴 `GET /uploads/:tenant/:name` valida el tenant, NO la propiedad del archivo.**
`uploads.ts:325-340`: el único chequeo es `if (tenantDe(payload) !== tenant) return 403`. Cualquier
inquilino, co-inquilino **o profesional con link mágico** del tenant puede leer **cualquier** archivo
del tenant si conoce el nombre: comprobantes de otros inquilinos, DNIs, recibos de sueldo,
escrituras de garantes, extractos bancarios de la inmobiliaria. Lo único que lo frena es que el
nombre es `randomUUID()` (`:250`) y que ninguna respuesta filtra URLs de otros contratos.
**Es un IDOR intra-tenant mitigado por unguessability, no por autorización.** Y el token viaja por
query string (`?token=`) — redactado en los logs de Fastify (`app.ts:89`, el fix que tapó que cada
foto abierta escribiera una sesión válida en texto plano en Railway), pero igual queda en el
historial del browser y en cualquier proxy intermedio.

**3. `POST /auth/demo` no tiene el guard de `NODE_ENV`.** `auth.ts:585-586` chequea solo
`DEMO_MODE`. Los dos `/otp/verify` sí llevan el doble guard (`:336`, `:423`). Si `DEMO_MODE=true`
se filtrara a la env de producción, `/auth/demo` emite una sesión de inquilino real **sin ninguna
prueba de identidad**. Un `&& process.env.NODE_ENV !== 'production'` cierra la asimetría.

**4. `POST /auth/pin` es un mutador zombi.** Para cambiar el PIN existente llama a
`verificarPinUsuario`, que aprueba siempre ⇒ **cualquiera con la sesión abierta puede pisar el
`pinHash` sin conocer el actual** (`auth.ts:679-682`). Inofensivo mientras el PIN no gatee nada,
pero es superficie viva sin dueño.

**5. La clave del rate-limit del OTP es la IP.** Bien documentado en `auth.ts:322-332`: 20 intentos
/ 15 min contra 1.000.000 de combinaciones es despreciable desde una IP, **pero un atacante
distribuido lo diluye linealmente**. No hay contador de intentos **por código** en
`CodigoOtp`/`CodigoOtpUsuario`. La mitigación fuerte que sí está: pedir un código nuevo invalida el
anterior (`auth.ts:392-395`), así que no se acumulan códigos vivos. El cierre completo pide migración.

**Falsos positivos revisados explícitamente** (para que no queden como duda abierta):
`profesionalRed.findUnique` sin tenant es **correcto por diseño** — `ProfesionalRed` es un catálogo
**global compartido entre tenants** y el gate de escritura es `profesional.findFirst({ profesionalRedId,
inmobiliariaId })` (`operacion.ts:1058-1062`). `auth.ts:459` cruza tenants **a propósito**: es el
punto de la selección de alquiler, y el filtro de autorización es el email del token.
---

## 5. Los flujos de plata

> **Corrección de rumbo antes de empezar.** Los docs dicen que `POST /pagos/informar` y "todo lo
> del home" viven en `inquilino-mundo.ts`. **No es así**: `/pagos/informar` está en
> `plata.ts:1129` y `/mis-liquidaciones` en `plata.ts:1319`. En `inquilino-mundo.ts` viven
> `/mi-contrato` (`:490`), `/mis-cargos` (`:619`) y `/mis-notificaciones` (`:1093`).
> Y `apps/inquilino/src/app/(app)/pagos/page.tsx` **no es una pantalla de pagos**: son 17 líneas
> de redirect a `/`. **El home ES la pantalla de pagos.**

### 5.1 Devengamiento — de dónde sale la deuda

**El cron.** `iniciarCronDevengo` arranca en `index.ts` tras el `listen`, corre a los ~30s y
después **cada 6h** (`cron.ts:22`). Apagable con `CRON_DEVENGO=off`. Es **el único cron del
sistema**. También hay disparo manual: `POST /internal/cron/devengar` (`plata.ts:148`, header
`x-cron-secret`, cerrado si la var no está) y el botón del panel `POST /liquidaciones/devengar`
(tenant-scopeado, ADMIN u OPERADOR).

**Por qué es idempotente:** `createMany({ skipDuplicates: true })` respaldado por
`@@unique([contratoId, periodo])`. Correr dos veces en el mismo segundo no duplica nada, y es
seguro con dos réplicas.

**Tres fixes estructurales que hay que conocer porque explican el diseño:**

1. **Aislamiento de error por contrato** (cazabug AC). `devengarTodosLosTenants` envuelve cada
   contrato en try/catch y acumula `fallidos[]`. Sin eso, **un contrato con datos raros dejaba
   sin facturar a TODAS las inmobiliarias** y —peor— el barrido de vencidos nunca corría. Hoy el
   barrido de vencidos **corre siempre**, aunque algún contrato falle, y `fallidos` viaja en el
   resultado: *"un devengo que se comió errores en silencio es indistinguible de uno que anduvo
   bien"*.
2. **`devengarSiSigueActivo` con `SELECT … FOR UPDATE`** (cazabug AI). El barrido empieza con un
   snapshot `findMany({estado:'ACTIVO'})` y con carteras grandes ese loop dura minutos. Si alguien
   finaliza un contrato en el medio, el barrido **le volvía a crear las cuotas que finalizar acababa
   de anular** → deuda fantasma a nombre de alguien que se fue, que además vencía sola y devengaba
   mora. El `FOR UPDATE` serializa contra finalizar en **los dos órdenes posibles**.
3. **`devengarDesde` es obligatorio aunque acepte `null`** (`liquidaciones.ts:24`). Cuando era
   opcional, de los cinco callers **solo dos lo pasaban**: el botón "Devengar" del panel, la
   activación y la renovación lo omitían y **resucitaban la deuda histórica que la importación de
   cartera había decidido no cobrar** (cazabug AB). Ahora el compilador no deja que un caller nuevo
   se lo saltee.

**Canon por período** (`canonDelPeriodo`, `liquidaciones.ts:47`). `contrato.monto` es la autoridad;
las vigencias futuras sirven para **retroceder** los períodos anteriores a un ajuste que todavía no
rige. Sin esto, **renovar por adelantado —que es el flujo normal— cobraba los meses intermedios al
canon nuevo**: sobrecobro al inquilino y comisión inflada.

**Zona horaria.** El fix del cazabug AH (`diaCivilAR`) está aplicado en `marcarLiquidacionesVencidas`
y en `diasAtraso` de punitorios: el corte va en el día civil argentino, no en el instante UTC — antes
la cuota del 10 se daba por vencida a las 21:00 del 9. **Pero quedan huecos**: `periodoDe()`
(`liquidaciones.ts:320`) sigue en `getUTCMonth()`, y lo usan el guard de modo-cobranza
(`core.ts:2889`) y otros; `metricas.ts` tiene su propia `liqVencida` (`:57`) que cuenta el día del
vencimiento como vencido, mientras `core.ts:33` no. **Dos definiciones de "vencida" que divergen en
una franja de un día.**

**Punitorios: se calculan ON-READ, no se persisten.** `Liquidacion.montoPunitorio` nace en 0 y
**siempre vale 0** — era exactamente el cazabug L ("la salud de pago mostraba la deuda SIN mora:
leía una columna muerta"). La mora vive en `lib/punitorios.ts` con 4 esquemas
(`PORCENTAJE_DIARIO`, `MONTO_FIJO` por meses iniciados, `PORCENTAJE_MENSUAL` prorrateado,
`SIN_MORA`) y una cascada de resolución: `contrato.moraTipo` → legacy `tasaPunitorioDiaria` →
default de la inmobiliaria → `SIN_MORA`. `montoPunitorioManual` **pisa** el cálculo (mora histórica
congelada al migrar; un manual de 0 permite condonar un período). El `asOf` es *hoy* para una
impaga y *la fecha de pago* para una saldada.

### 5.2 El pago informado por el inquilino

**La cadena completa.** Home (`(app)/page.tsx:357`, elige la impaga más vieja con ≤10 días al
vencimiento) → `/pago/[liqId]` → checkout (`checkout/page-client.tsx`, 1768 líneas) →
`subirArchivo()` → `POST /uploads` (Railway Volume) → `POST /pagos/informar` (`plata.ts:1129`) →
fila `Pago` en `INFORMADO` → bandeja del panel `GET /pagos?estado=INFORMADO` (`plata.ts:279`) →
`POST /pagos/:id/validar` (`:347`) → recálculo de la `Liquidacion`.

**El recálculo, con la aritmética real** (`plata.ts:411-455`):

```ts
const punitorio = calcularMora(base, esquema, liq.fechaVencimiento,
                               pago.fechaTransferencia,      // ← fecha del PAGO, no hoy
                               liq.montoPunitorioManual ?? null);
const total  = r2c(base + punitorio);
const saldo  = r2c(total - conciliadosPrev);
if (saldo <= 0.01)                    throw new ValidarLiquidacionYaCubierta();  // 409
if (Number(pago.monto) > saldo + 0.01) throw new ValidarExcedeSaldo();           // 409
const cobrado = r2c(conciliadosPrev + Number(pago.monto));
const cierra  = total > 0 && cobrado >= total - 0.01;
// → PAGADO (+ fechaPago, metodoPago) | PARCIAL
```

Todo con `r2c(n) = Math.round(n*100)/100` y tolerancia ±0.01.

**Lock atómico** (el patrón canónico del proyecto): `updateMany({ where: { id, estado: 'INFORMADO' }, … })`
→ `count === 0` ⇒ **409**. Lo mismo en rechazar, anular, finalizar, aprobar, claim de propiedad y
resolver reclamo.

**El cazabug AJ está cerrado de raíz.** `Pago.tipo` quedó **sin default a propósito** en el schema
(`:1668`): *"cuatro de los seis caminos que crean pagos heredaban TOTAL sin decidir nada y
etiquetaban como completo un cobro parcial"*. Hoy **los 6 sitios** lo pasan explícito
(`/informar`, `/manual`, `saldar-deuda`, aplicar-depósito, conciliar bancario, estado inicial).

**Un solo INFORMADO por liquidación**, garantizado por un índice único **parcial** creado a mano
(`WHERE estado='INFORMADO'`). El inquilino no puede informar el resto hasta que se valide el
primero — y el front lo corta antes con `pagoVivo` para que no transfiera plata real dos veces.

**Los puntos frágiles de este flujo, en orden:**

1. 🔴 **La inmobiliaria puede no enterarse nunca.** No hay push, ni mail, ni WhatsApp
   (`mailer.ts` no exporta nada de pagos), no hay `registrarEvento` en `/pagos/informar`, y el
   contador "A resolver" vive **solo dentro de `/pagos`**. Un comprobante informado el viernes a la
   noche espera hasta que alguien abra esa pantalla. Y **la mora queda frizada en
   `fechaTransferencia`**: el costo del olvido lo paga la inmobiliaria.
2. 🔴 **Copy que promete lo que el sistema no hace.** `checkout/page-client.tsx:501-503`
   ("te avisamos por WhatsApp"), `pago/[liqId]/page-client.tsx:322` ("Te avisamos por WhatsApp en
   24-48hs"), `pagos-por-validar.tsx:142` ("Le avisamos a X con tu nota"). **No existe canal
   saliente de WhatsApp.**
3. 🟠 **La bandeja de validación es ciega a la moneda.** `plata.ts:299-302` no expone
   `liquidacion.moneda` y `pagos-por-validar.tsx` formatea ~20 montos sin moneda: un pago de
   **USD 1.200 se le muestra al operador como "$ 1.200"**.
4. 🟠 **Tres pantallas, dos verdades.** `pago/[liqId]/page-client.tsx:207` mide parcialidad con
   `liq.montoPagado` (solo CONCILIADO), así que un INFORMADO parcial deja `hayParciales=false` y
   muestra el total completo. El home y Recibos **sí** descuentan lo informado (fue el fix
   `e0dd7a8`), pero el detalle quedó afuera.
5. 🟠 **`fechaTransferencia` la fija el cliente y siempre es "ahora"** (`new Date().toISOString()`).
   La ventana de backdate de 30 días y el piso de `fechaInicio` (el fix del cazabug M, "el inquilino
   se auto-condonaba la mora backdateando") solo protegen contra un cliente hecho a mano. Y como
   esa fecha es el `asOf` de la mora, "transferí el viernes, informo el lunes" **cobra mora de más**.
6. 🟠 **Comprobantes huérfanos garantizados por diseño.** `limpiarComprobante` es un **no-op
   declarado** (`plata.ts:1178-1183`): cada informe fallido deja un archivo en el Volume. El
   comentario dice "los limpia un barrido" — **ese barrido no existe** (ver §5.7).
7. 🟡 **`condonado` no llega al inquilino.** Se marca para excluirlo de caja y rendición, pero
   `/mis-liquidaciones` no lo expone y "Pagos recibidos" lo muestra como un cobro más: un inquilino
   cuya deuda le fue perdonada ve *"$X recibido · registrado por la inmobiliaria"*.
8. 🟡 **Un click concilia plata, sin confirmación.** `pin-prompt-dialog.tsx:33` ejecuta la acción
   apenas se "abre" (el PIN es pass-through), así que `triggerConciliar` concilia de inmediato.
   No hay ninguna confirmación para una acción que mueve caja, comisión y rendición.

### 5.3 Conciliación bancaria (CSV/Excel, matching determinístico, sin IA)

**Decisión LOCKED §5, respetada al 100% por el código.** Subir extracto → parseo con `xlsx` →
`CreditoDetectado` por cada línea de crédito → matching **live** contra el estado actual →
el operador elige destino → `POST …/conciliar` crea un `Pago` **directo CONCILIADO** (TRANSFERENCIA,
sin pasar por INFORMADO, porque el banco ya acreditó).

**Reglas de confianza** (`matching-bancario.ts`): monto ±$50 + nombre → **ALTA**; monto solo →
**MEDIA**; ±5% del saldo + nombre → **MEDIA**; ±5% solo → **BAJA**. FIFO por vencimiento más viejo.

**El cruce con el pago informado** (cazabug `53d5ae1`) está bien resuelto y vale entenderlo:
si el inquilino ya informó y después el banco confirma, se crea un `Pago` nuevo CONCILIADO y
—**solo si la liquidación queda cubierta**— se cierra el aviso del inquilino marcándolo
**`RECHAZADO`**, no CONCILIADO: `CONCILIADO` entraría en el `aggregate` de cobrado y
**duplicaría la plata**. Existen dos filas en `pagos` pero **solo una cuenta**. El commit es honesto:
no era plata mal contada (el tope al saldo ya lo impedía), era **trabajo manual evitable**.

**Los tres riesgos reales:**

1. 🔴 **Un crédito que no matchea es prácticamente irrecuperable después de cerrar el diálogo.**
   En el backend nada se pierde: el crédito queda con `conciliado:false` y el archivo se archiva.
   Pero `ValidadorResumenApiDialog` resetea `resumenId` al cerrar y **no existe ninguna UI que liste
   los resúmenes ya subidos** — el hook `useResumenesBancarios` fetchea `resumenes` y **lo tira**
   (`const { subir } = useResumenesBancarios()`). Si subís 40 créditos, conciliás 30 y cerrás, los
   10 restantes solo se retoman re-subiendo el archivo… y ahí el dedup los reconoce como duplicados,
   no crea nada, y el `GET :id` del **nuevo** resumen devuelve lista vacía con *"Todo conciliado"*.
   **Los 10 quedan colgando del resumen viejo, inalcanzables.** No cubierto por ningún test.
2. 🔴 **No hay forma de descartar un crédito.** No hay `DELETE` ni flag `ignorado`. Una devolución
   de proveedor o un depósito de la propia inmo **queda pendiente para siempre**.
3. 🟠 **El dropdown no permite distinguir períodos.** `opciones` solo expone
   `{liquidacionId, contratoId, inquilino}` y el `SelectItem` renderiza solo el nombre. **Un inquilino
   con 3 meses impagos aparece 3 veces con la misma etiqueta**, sin período, sin monto, sin
   vencimiento. Es el punto donde más fácil se imputa plata al período equivocado — y **no lo corta
   ningún guard, porque las 3 opciones son legítimas**.

**Qué protege contra conciliar el pago de A contra la liquidación de B: ninguna barrera técnica.**
El endpoint acepta cualquier `liquidacionId` del tenant. Lo que hay es un colchón que limita el
**daño colateral** (contrato ACTIVO, `modoCobranza='INMOBILIARIA'`, moneda, liq no PAGADA, tope al
saldo re-chequeado dentro de la tx con `FOR UPDATE`, lock optimista `conciliado:false`).
**La protección real es que el error es reversible**: `POST /pagos/:id/anular` libera el crédito —
y requiere `pago.revertir` (**solo ADMIN**, a diferencia de conciliar que incluye OPERADOR).
**La ventana se cierra cuando el período se rinde al propietario** (409 si ya hay `AlquilerRendido`).

> ⚠️ `resumenes-bancarios.ts` tiene **0 llamadas a `registrarEvento`** (`plata.ts` tiene 12).
> Conciliar mueve plata, cambia el estado de una liquidación **y cierra automáticamente un aviso
> del inquilino** — y no deja evento de auditoría.

### 5.4 Modos de cobranza, rendición y caja

**`ModoCobranza` vive en el CONTRATO**, no en la propiedad ni en el propietario.

**El destino real del dinero cambia en UN solo punto**: `inquilino-mundo.ts:519` decide qué CBU ve
el inquilino. Todo lo demás son **filtros de conteo** (12 lugares): `/caja/cierre` (`plata.ts:185`),
`POST /rendiciones` (`:1631`), `metricas.ts:86`, el matching bancario, `armarGanancia`, los KPIs del
panel…

> **Lo que NO ramifica:** `/pagos/informar`, `/pagos/:id/validar`, `/pagos/manual` y `saldar-deuda`
> **no miran `modoCobranza` en ningún lado**. En modo directo el inquilino igual informa, la inmo
> igual concilia y la liquidación igual pasa a PAGADO — solo que ese `Pago` **queda invisible para
> caja, rendición, métricas y ganancia**. Coherente con la decisión §4, pero significa que hay filas
> `Pago` conciliadas que **no suman en ningún agregado de plata**.

**Limitación verificada del modo directo:** en multi-dueño el cobro va **entero al dueño principal**
(`findFirst … orderBy porcentaje desc`). Si la propiedad es 51/49, **el 49% cobra $0 por esa vía y
el sistema no lo registra en ningún lado**.

**La aritmética de la rendición** (`POST /rendiciones`, todo dentro de una `$transaction` con
**advisory lock por dueño+período**):

```ts
cobradoCapeado = min(cobrado, montoTotal)                    // ← el cap deja la MORA afuera
alquilerCobrado = cobradoCapeado × (montoAlquiler/montoTotal) // ← el prorrateo deja las EXPENSAS afuera
parteOwner  = alquilerCobrado × (porcentaje/100)
rendible    = min(parteOwner − yaRendidoAEste, alquilerCobrado − yaRendidoATodos)   // doble tope
comisionMonto = montoBruto × (Propietario.comisionPct/100)
montoNeto = montoBruto − comisionMonto − totalGastos + totalIngresos
```

**Ejemplo numérico** (alquiler $500.000 + expensas $100.000, paga tarde con $30.000 de mora, dueño
único al 8%, gasto de plomería $35.000):

| Paso | Cuenta | Resultado |
|---|---|---|
| `cobradoCapeado` | `min(630.000, 600.000)` | **600.000** ← corta la mora |
| `alquilerCobrado` | `600.000 × (500.000/600.000)` | **500.000** ← corta las expensas |
| `comisionMonto` | `500.000 × 0,08` | **40.000** |
| `montoNeto` | `500.000 − 40.000 − 35.000` | **425.000** |

Si la comisión se cobrara sobre lo que entró a la caja ($630.000) serían **$50.400**: **$10.400 de
sobre-comisión**, 26% de más, del bolsillo del propietario. Sobre `montoTotal` serían $48.000,
todavía $8.000 de más originados en expensas que no le corresponden al dueño. **La decisión LOCKED
§1 está correctamente implementada.**

**La rendición es INCREMENTAL** (sin `@@unique(propietarioId, periodo)`, removido a propósito) y el
anti-doble se hace por `AlquilerRendido`. Verificado que **conserva**: rendir en dos tandas da
exactamente el mismo total que rendir una sola vez. El cazabug Y ("el mes cobrado a medias también
se rinde") está cerrado en server **y** en front.

**La rendición PARCIAL que no existe.** Si `montoNeto < 0` → **409** con `detalle`
`{bruto, comision, gastos, ingresos, moneda}`, el faltante calculado y tres salidas concretas.
Impacto real, sin adornos:

- **El dueño cobra $0, no "menos".** Un mes con una caldera de $400.000 sobre un alquiler de
  $350.000 bloquea la rendición **completa**.
- **Bloquea también el mes siguiente**, porque el carry-over (`fecha: { lt: finPeriodo }`) arrastra
  el mismo gasto contra el nuevo bruto.
- **La plata no se pierde** (los períodos salteados se rinden retroactivamente), pero **el timing lo
  paga el dueño**.
- La cuarta salida —rendir $0 y dejar el faltante como saldo del dueño— **no existe**: `Rendicion`
  no tiene columna de saldo arrastrado. Es una **decisión de producto pendiente**, no un bug.

### 5.5 "Si cambio el modo de cobranza a mitad de mes, ¿qué se rompe?"

**El guard existe pero mira lo que no hay que mirar.** `core.ts:2888-2900` cuenta **`Pago`, no
`Rendicion`**, y **solo del período en curso**. No consulta `AlquilerRendido` ni `Rendicion` nunca.

**Se recalcula: nada.** El `PATCH` es un `UPDATE` de dos columnas. Todo lo demás lee
`contrato.modoCobranza` **en vivo**. Qué queda inconsistente:

- 🔴 **(a) `INMOBILIARIA → PROPIETARIO_DIRECTO` con cobros de meses anteriores sin rendir = plata
  que nunca llega al dueño.** El guard solo mira el período actual. Si julio se cobró y no se
  rindió, y en agosto cambiás el modo, `POST /rendiciones` para julio filtra por el modo **actual**
  → las liquidaciones desaparecen → `montoBruto <= 0` → 409 *"No hay cobros nuevos del período"*.
  **La inmobiliaria tiene la plata y no existe camino en el código para rendirla**, salvo volver el
  modo atrás.
- 🔴 **(b) El inverso hace rendir plata que nunca entró.** Pagos de meses previos que fueron a la
  cuenta del dueño (y que igual se conciliaron, porque validar no mira el modo) pasan a ser
  rendibles. **Doble pago al propietario, sin ninguna alarma.**
- 🟠 **(c) El cierre de caja de días pasados cambia retroactivamente.** Consultar el cierre del 12
  de agosto antes y después del cambio devuelve **dos números distintos**. `CierreCaja` promete en
  su comentario ser un *"snapshot INMUTABLE de auditoría"* y **ningún endpoint lo escribe ni lo lee**.
- 🟠 **(d) La comisión históricamente ganada se borra de la vista.** `armarGanancia` fuerza
  `ganado = 0` si el modo es directo, aunque las filas `AlquilerRendido` sigan en la DB. La inmo
  pierde de vista comisión que **efectivamente cobró**.
- 🟡 **(e) `metricas.ts:86` reescribe el pasado**: toda la serie histórica de ese contrato se evapora
  del dashboard.
- 🟡 **(f) El inquilino ve otro CBU sin aviso.** No hay ninguna notificación. Si ya transfirió a la
  cuenta vieja y todavía no informó, el CBU del checkout ya no coincide con su comprobante.

### 5.6 Ciclo de vida del contrato

**Depósito.** `EstadoDeposito RETENIDO → {DEVUELTO|NETEADO|EJECUTADO}`, todos terminales. Dos
caminos: al finalizar el contrato o por `POST /contratos/:id/deposito/resolver`. `NETEAR`/`EJECUTAR`
llaman `aplicarDepositoADeuda`, que salda cuotas y cierra los `CargoContrato contraDeposito`.

**Ajuste de alquiler.** El fix `fdb49e2` invalida la cache de plata tras ajustar.
🔴 **Hay DOS endpoints de ajuste activos y visibles a la vez** (`POST /contratos/:id/ajustar` en
`core.ts:1642` y `PATCH /contratos/:id/monto` en `core.ts:2737`), **con aritmética, filtros,
historial y cache distintos**: `/ajustar` deja fila `AjusteAlquiler` pero **no** `EventoContrato`;
`PATCH /monto` deja `EventoContrato` pero **no** `AjusteAlquiler`. **Los dos historiales quedan
incompletos según por dónde entre el operador.**

**Rescisión — el punto de mayor riesgo del sistema.** `GET /finalizar-preview` calcula
`saldoNeto = deudaVencida + penalidadSugerida − depositoDisponible`, y usa **la misma condición**
de "vencida" que el backend (`liqVencida` ≡ `esExigible`), a propósito, para que el diálogo no
prometa un número que el backend no cumpla. Si el preview falla, **la rescisión queda bloqueada**
con un cartel rojo — antes salía con `NETEAR / $0 / sin penalidad` y era irreversible.

Los cinco agujeros verificados:

| # | Hallazgo |
|---|---|
| 🔴 **1** | **El `sobrante` de la retención se descarta.** `aplicarDepositoADeuda` solo imputa contra **liquidaciones**, y la penalidad es un `CargoContrato`. Si el depósito disponible supera la deuda vencida, el excedente se retiene pero **no se aplica a la penalidad**: el ex-inquilino ve la penalidad entera como deuda cuando ya le retuvieron parte contra ella. **El `saldoNeto` que mostró el diálogo no coincide con lo que queda en los libros.** El front tampoco muestra `depositoSobrante` |
| 🔴 **2** | **`finalizar` NO cierra los cargos `contraDeposito`** (`deposito/resolver` sí lo hace, con un comentario que explica por qué). Quedan `saldadoAt: null` **para siempre**: salen de `/depositos/en-custodia`, `deposito/resolver` da 409, `/cargos/:id/saldar` los rechaza por `contraDeposito`, y `saldar-deuda` los ignora. **Huérfanos e insaldables por los cuatro caminos** |
| 🟠 **3** | **`finalizar` no valida `montoDepositoDevuelto ≤ disponible`** (el zod solo pide `nonnegative()`); `deposito/resolver` sí valida. Vía API se puede registrar una devolución mayor al depósito |
| 🟠 **4** | **Asimetría de permisos:** resolver el depósito por `deposito/resolver` exige `deposito.devolver` (**ADMIN**); por `finalizar` exige `contratos.crear`, que incluye **OPERADOR**. Un OPERADOR puede ejecutar el depósito entero por la vía de la baja |
| 🟠 **5** | **El fix `26fdfa6` es correcto en el server pero inalcanzable desde el panel.** El server ya resuelve el depósito en cualquier baja (con test), pero el front **sigue sin mandar `decisionDeposito` cuando el tipo es FINALIZADO** (`finalizar-contrato-button.tsx:92-100`), y la sección del depósito se renderiza solo bajo `{esRescision && …}`. En una finalización por plazo el operador **ni ve** las opciones. La consecuencia práctica del bug original (garantía trabada) **sigue existiendo hasta que el operador entre a `/depositos`** |

`Contrato.penalidadRescisionMeses` **se lee y ningún endpoint lo escribe**: el override por contrato
es inalcanzable, siempre manda el default de la inmobiliaria (1.5 meses).

**Efecto en caja a validar con negocio (no lo llamo bug):** los `Pago` que crea
`aplicarDepositoADeuda` entran al cierre de caja **del día** como cobrado y **generan comisión**,
aunque esa plata estaba en poder de la inmobiliaria desde la firma. El código lo declara intencional.

### 5.7 Reclamos: quién paga y cómo llega el cargo

**El choke point único es `lib/imputar-reclamo.ts:49`**, llamado por los **dos** caminos de cierre:
`POST /reclamos/:id/resolver` (`operacion.ts:566`) y `POST /visitas-publicas/listo`
(`visitas-publicas.ts:326`).

**La regla LOCKED "no se cuenta dos veces" está implementada literalmente:** para `PROPIETARIO`,
`imputarCostoReclamo` **no crea nada — al contrario, borra** cualquier `CargoContrato` pendiente
del reclamo (`imputar-reclamo.ts:92-96`). El impacto llega después, por la rendición, como
`GastoRendido` tipo `TRABAJO` con `refId = 'reclamo:<id>'` y **doble tope** (lo ya rendido a este
dueño y lo ya rendido a todos). Para `INQUILINO` y `DEPOSITO` va por `CargoContrato`
(`reclamoId @unique` = idempotencia) y **no entra a la rendición**.

**El cargo SÍ llega a la PWA y SÍ está deployado.** `GET /mis-cargos` (`inquilino-mundo.ts:619`) →
`use-cargos.ts:33` → `cargos-adicionales.tsx:19` → montado en `(app)/page.tsx:461`.
Verificado contra producción: `GET /mis-cargos` responde **401** (ruta viva), no 404.
El "⚠️ falta deployar" de los docs es obsoleto.

Peros honestos: **el cargo no suma a la deuda principal** (`deudaTotal` del panel se calcula solo
sobre liquidaciones) — el inquilino ve dos números que no se suman; y **el detalle del reclamo del
inquilino no menciona el cargo** (0 hits de `cargo|costo` en sus 935 líneas): si le cargaron $80.000
por su plomería, en la pantalla del reclamo no hay ni rastro.

**Los dos agujeros altos del link mágico:**

- 🔴 **`/visitas-publicas/listo` cierra el reclamo con costo SIN validar que haya pagador.**
  `/resolver` sí lo exige. El reclamo queda RESUELTO e **irreclasificable** (409 en `/clasificar` y
  `/resolver`), y la rendición lo ignora porque `pagador != PROPIETARIO` ⇒ **plata perdida**.
- 🔴 **`/listo` no replica el guard de `DEPOSITO`** que sí tiene `/resolver` ⇒ puede crear un
  `CargoContrato contraDeposito` incobrable por los cuatro caminos.

Y el que ya mencioné en §4.5: **el portador del link declara `montoCobrado` sin tope y sin
aprobación del panel**.

### 5.8 Entrada de datos y archivos

**Migración de cartera.** Tres pasos (`SUBIDO → MAPEADO → CONFIRMADO`) con lock SQL crudo
`AND estado = 'MAPEADO'`. **Una fila inválida no aborta nada**: se saltea, se registra en
`errores[]` y se sigue; al final responde `{creadas, errores}` y pasa a CONFIRMADO igual.
Detalle importante: **una fila que falló queda marcada como `procesada`**, así que un reintento
**no la vuelve a intentar** — es deliberado (reintentar a ciegas es lo que duplicaba filas), pero
significa que el único camino de recuperación es corregir la planilla y **subirla de nuevo**.

**Archivos.** `POST /uploads` guarda en `/data/uploads/<inmobiliariaId>/<uuid><ext>` con allowlist
y 10 MB. `GET /uploads/:tenant/:name?token=` acepta el token **por query** porque un `<img>` no
puede mandar `Authorization` — y por eso `app.ts:89` redacta ese valor del log de Fastify: sin eso,
**cada foto que alguien abría escribía una sesión válida en texto plano en los logs de Railway**.

**`urlEsDelTenant`** rechaza en una función URLs absolutas, URLs de otro tenant y traversal.
Cerró una vulnerabilidad real (`f715055`): el zod de `fotoUrl` era `z.string().optional()`, así que
un inquilino podía mandar `https://evil.example/pixel.png`; `urlDeArchivo` tiene un early-return que
devuelve las absolutas **sin tocarlas**, y el panel las renderiza en un `<img>` ⇒ el atacante
obtenía **confirmación de lectura + timestamp, IP y User-Agent del operador**, y un canal de
contenido controlado dentro del panel; el `Referer` filtraba el `reclamoId`.

**Archivos huérfanos: se acumulan y nada los limpia.** `archivoSigueEnUso` mira **las 16 tablas**
con columna de URL y **falla cerrado** (`catch { return true }`) — la asimetría manda el diseño:
un falso "sí está en uso" deja un archivo de más (barato); un falso "no" **destruye un archivo
ajeno**. Pero solo hay **6 call sites** de `borrarArchivoSiHuerfano`, y quedan afuera:

- **`POST /pagos/informar` fallido** (no-op deliberado)
- **Reemplazar la foto de una propiedad** (asimetría directa con los avatares, que sí limpian)
- **`DELETE /propiedades/:id`** (la foto queda)
- **Reemplazar `fotoAntes`/`fotoDespues`** de una visita
- **Reclamos y boletas: no existe `DELETE`** ⇒ `Reclamo.fotoUrl` y `ReclamoEvento.adjuntoUrl`
  **nunca se liberan**
- **Rechazar una aprobación de contrato**: `tx.documento.deleteMany(...)` borra en bloque las filas
  de documentos del inquilino descartado **sin tocar los archivos** — justo los DNI y recibos
- **Uploads abandonados**: el front sube **antes** del POST que persiste; si el usuario cierra el
  form o el POST da 400, el archivo ya está en el Volume y nadie lo referencia jamás

El único cron del sistema es el devengo. **No existe ningún job que barra `/data/uploads`.**
El código lo asume — *"los limpia un barrido"* — y ese barrido no está escrito. El único freno es
el 507 de `ENOSPC`, que es un mensaje de error, no una política de retención.

> El predicado ya existe y está testeado (`archivoSigueEnUso`). Un job que recorra el directorio,
> arme la URL y borre lo que dé `false`, **con piso de antigüedad de mtime de 24h** (para no pisar un
> upload en vuelo), cierra el agujero sin tocar ninguna de las validaciones existentes.
---

## 6. La matriz: inmobiliaria ↔ inquilino

### 6.1 Dominio por dominio

| Dominio | Qué ve la inmobiliaria | Qué puede hacer | Qué ve el inquilino | Qué puede hacer | Dónde se cruzan |
|---|---|---|---|---|---|
| **Contrato** | Ficha completa: monto, moneda, mora, modo de cobranza, garantes, participaciones, ganancia proyectada de la inmo, scoring (demo) | Alta con wizard + extracción IA del PDF, editar, ajustar canon, renovar, cambiar mora, cambiar modo de cobranza, finalizar/rescindir | Datos básicos, monto actual, próximo ajuste, fecha de fin, CBU de cobranza | **Nada.** Lectura pura | `GET /contratos/:id` ↔ `GET /mi-contrato`. **El inquilino NO puede descargar su contrato firmado**: `/mi-contrato` no expone `pdfOriginalUrl` |
| **Liquidaciones** | Todas las del tenant, por mes, con estado y saldo | Devengar a mano, ver mora, ajustar `montoPunitorioManual` | Las suyas, con desglose alquiler/expensas/punitorios | Nada directo | `GET /liquidaciones` ↔ `GET /mis-liquidaciones` |
| **Pagos** | Bandeja "A resolver" (INFORMADO), historial, cobro manual, conciliación bancaria | Validar, rechazar (observación obligatoria), **anular** (solo ADMIN), cobro manual, conciliar extracto | Sus pagos, "Pagos recibidos" (incluye los manuales de la inmo) | **Informar un pago** con comprobante | `POST /pagos/informar` → `GET /pagos?estado=INFORMADO`. **Es el cruce central del producto** |
| **Cargos** | `GET /contratos/:id/cargos`, "Marcar cobrado" y "Descobrar" | Saldar, descobrar | Sección "Cargos adicionales" en el home (`GET /mis-cargos`) | **Solo verlos.** Decisión de producto: se coordinan con la inmo, no hay checkout por cargo | El cargo nace de resolver un reclamo con `pagador: INQUILINO` |
| **Reclamos** | Todos, con SLA, timeline, asignación de profesional, costo y pagador | Asignar profesional, **clasificar quién paga**, resolver con costo, rechazar, responder | Los suyos, timeline, fotos, estado de la visita | Abrir, mandar mensajes, **confirmar o reabrir** la resolución, calificar | `POST /mis-reclamos` ↔ `GET /reclamos`. La confirmación del inquilino (`CONFORME`/`PERSISTE`) es lo único que cierra o reabre |
| **Documentos** | Expediente del contrato (`DocumentoContrato`) **+ los que subió el inquilino** (`GET /contratos/:id/documentos-inquilino`, read-only) | Subir, borrar los del expediente | Sus 7 slots (DNI frente/dorso, recibos, cert. laboral, garante) | Subir y borrar los suyos | Dos colecciones distintas que se ven cruzadas en una sola pantalla del panel |
| **Servicios** | Datos técnicos por propiedad (nº de cuenta de luz/gas/agua) y el pagador | Cargar, editar, borrar | Los servicios de su propiedad + subir la boleta | Subir boleta. **No puede marcarla pagada ni borrarla** (no-ops en prod) | La inmo carga → el inquilino ve. Era un bug histórico que no se propagaba |
| **Propiedad** | Ficha completa, fotos, participaciones, expediente (timeline, salud de pago, seguros, gastos, ganancias) | CRUD completo, migración masiva | Solo la dirección, dentro de su contrato | Nada | Asimetría total, a propósito |
| **Notificaciones** | **Nada.** La campana del panel devuelve `[]` en prod | — | Feed real (`GET /mis-notificaciones`) con pagos, anuncios, reclamos | Marcar leído (**solo local**, no se sincroniza) | Asimetría invertida: el que más necesita enterarse (la inmo, de un pago informado) es el que no tiene feed |
| **Anuncios** | Compositor con alcance y destinatarios | Crear, publicar, borrar. **Se manda por email SMTP real** | Feed de anuncios | Leer y acusar ("Enterado"). Un co-inquilino **puede leer pero no acusar** | `POST /anuncios` → `GET /mis-anuncios` + `POST /anuncios/:id/{leido,enterado}` |
| **Depósito** | `/depositos` con el bruto retenido; el disponible **solo dentro del diálogo** | Devolver / netear / ejecutar (ADMIN) | **Nada de las deducciones.** No ve `disponible` ni por qué se le descontó | Nada | Asimetría **no deliberada**: el inquilino no tiene forma de saber cuánto le van a devolver |
| **Certificado** | No lo ve | — | Su certificado de buen pagador, con nivel y métricas | Generar, copiar link, WhatsApp, imprimir | El link que comparte **cae en una pantalla que no verifica nada** |

### 6.2 Lo que es asimétrico A PROPÓSITO

- **La inmobiliaria ve la plata; el inquilino ve su cuenta.** Comisión, rendiciones, caja, ganancia
  por contrato y métricas **no existen** del lado del inquilino, ni deberían.
- **El inquilino ve el CBU de cobranza y el co-inquilino también, incluso con permiso VER**
  (decisión LOCKED). Es deliberado: se pensó para que cualquiera del contrato pueda pagar.
- **El ex-inquilino conserva la lectura.** `exigirContratoActivo` se aplica **por endpoint y solo a
  escrituras**, precisamente para que alguien que se fue siga viendo su contrato, sus liquidaciones
  y sus comprobantes.
- **La foto de perfil, los documentos personales y el certificado son del titular**, no del
  co-inquilino.
- **La propiedad es un objeto de la inmobiliaria.** El inquilino no ve fotos, gastos, seguros ni
  historial de su propia vivienda.

### 6.3 Lo que es asimétrico y probablemente NO debería

1. **La inmobiliaria no tiene forma de enterarse de un pago informado** salvo abrir `/pagos`.
   No hay mail, ni push, ni campana (devuelve `[]` en prod), ni evento de auditoría. Y mientras
   tanto **la mora queda congelada en la fecha de transferencia**: el costo del olvido lo paga ella.
2. **El inquilino no ve las deducciones de su depósito.** El backend calcula
   retenido/deducido/disponible y el panel lo usa; `/mi-contrato` no lo expone.
3. **El cargo por una reparación no aparece en el detalle del reclamo del inquilino** — solo en otra
   card del home. Y **no suma a la deuda principal**: son dos números que no se suman.
4. **El inquilino no puede declarar que se va ni que quiere renovar.** `IntencionRenovacion` existe y
   el panel la lee, pero la PWA la tiene en `Proximamente`: hoy el dato entra **solo si el operador
   lo carga a mano**.
5. **El inquilino no puede editar sus datos** (nombre, teléfono, email). Solo el avatar.
6. **`condonado` no llega al inquilino**: una deuda perdonada se le muestra como un cobro más.

### 6.4 Lo que está demo-gated a propósito (no son bugs)

Del lado del panel: negociador IA de renovación, scoring del inquilino, extracción IA del
comprobante, conectar ARCA, alta de inquilino, plan/facturas/cupones/referidos/forma de pago,
inbox del día y el gráfico semanal del dashboard, morosos y alertas de servicios en `/pagos`,
la segunda UI de aprobar/rechazar del detalle de contrato, y **screening**.

Del lado de la PWA: `/broker`, `/calendario`, `/profesionales`, `/contrato/renovacion`,
`/cuenta/editar`, y todo el bloque de `/contrato` que no se renderiza en prod
(chat, timeline, historial de ajustes, tracker de depósito, banner de renovación, compartir con el
garante y **el botón "Descargar PDF" del contrato**).

### 6.5 Lo que escribe a localStorage — el veredicto, con nombre y apellido

Se revisaron **~50 archivos en el panel y ~38 en la PWA, uno por uno**, mirando quién los importa y
si el call site está detrás de `apiEnabled`.

> **Resultado principal: no hay ni un solo `*-storage.ts` ejecutándose sin gate en producción.**
> El patrón dominante es consistente: `if (!apiEnabled) return demoData` dentro del hook, o
> `if (apiEnabled) return null / <ComponenteApi/>` en el componente.

Vale registrar algo que aparece leyendo el código: **hay comentarios explícitos admitiendo bugs
pasados exactamente de este tipo** (servicios públicos que el inquilino nunca veía, consorcios que
leían SEEDS de localStorage en prod, asignar-profesional que solo escribía el store demo, scoring
fabricado). Todos con nota de que ya se corrigieron. O sea: **el problema fue real y recurrente, y
hoy está cerrado**.

**Los casos que sí merecen nombre:**

| Caso | Veredicto |
|---|---|
| `sociedades-storage.ts` (13 importadores) | **REAL, patrón intencional**: es un *cache síncrono* que `hidratarSociedadesDesdeApi()` llena con la respuesta del API, para que los lectores síncronos (`sociedadPrincipal()`) no rompan. Frágil si `cargarSociedades()` no corrió antes en esa pantalla, pero no es un fake |
| `boletas-cross-app` · `ratings-cross-app` · `visitas-cross-app` (panel) y `anuncios-cross-app` · `cross-app-inmo` · `visitas-profesional` (PWA) | **SOLO-DEMO, correctamente gateados.** Leen el localStorage de la **otra** app. El propio código lo dice: *"las dos apps viven en el mismo origen (github.io subpath o localhost dev)"* — cierto **solo** en la demo. En prod, con dominios distintos, leerían siempre vacío. **Son teatro de demo, no arquitectura** |
| `cierre-caja.ts` (9.8 KB) | **CÓDIGO MUERTO** — 0 importadores. El cierre real de `/caja` es un componente local |
| `auditoria-storage`, `forma-pago-storage`, `trial-storage`, `empresa-storage`, `referidos-storage`, `contrato-borrador-storage`, `objetivos-data`, `scoring-inquilino`, `negociador-ia`, `extraccion-ia`, `resumen-cuenta`, `gastos-rendicion`, `cargos-a-cobrar`, `alertas-servicios`, `dashboard-helpers`, `migracion-masiva` | **SOLO-DEMO** — todos viven después del gate |
| `participaciones.ts`, `sla-reclamos.ts`, `contrato-generator.ts` | **Mal clasificados por el nombre**: son funciones puras sobre datos reales, no storage |

**Lo que sí escribe localStorage en producción, y está bien:** el JWT (`llave:auth:token`), el
persona-token, la sesión del inquilino, el borrador del formulario de reclamo (se borra al enviar),
el dismiss del prompt de instalación y el "ya vi el tour". **La excepción con costo real:**
`llave:notif-leidas:v1` — el feed viene del API pero el estado de leído es **solo local**: cambiás
de teléfono y todo vuelve a estar sin leer.

### 6.6 Dos cosas del panel que conviene mirar

**El dashboard suma en el navegador, no en el servidor.** `useDashboard()` baja **cinco colecciones
completas** (contratos, propiedades, propietarios, liquidaciones, caja) y agrega todo en el cliente
con `for`/`reduce`. El propio código lo señala por contraste: `/estadisticas` es la única pantalla
con agregación server-side real (`GET /metricas/resumen`). Con una cartera grande esto escala mal, y
además **duplica la aritmética de plata en el front** — de hecho varios de los cazabug recientes
(comisión sobre el total, `PROPIETARIO_DIRECTO` que se colaba, "a rendir" sin restar gastos) fueron
divergencias entre esa copia y el backend.

**`/admin/objetivos` no tiene control de rol.** El propio comentario lo admite: *"En producción esto
debería tener auth basada en rol 'FOUNDER'… Por ahora la ruta está visible solo si la URL se
conoce"*. En prod lo tapa el gate de `apiEnabled` (muestra "disponible pronto"), pero **en el build
demo el panel interno completo —MRR, cohorts, funnel, unit economics— queda accesible a cualquiera
que escriba la URL**. Son números inventados, así que el daño es de imagen, no de datos.
---

## 7. Qué es real, qué es demo y qué es cáscara

El switch es uno solo y vive en el front:

```ts
// apps/inmobiliaria/src/lib/api/client.ts:9-10  (idéntico en apps/inquilino)
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiEnabled = API_URL.length > 0;
```

- **PROD ⇒ `apiEnabled === true`**: `apps/inmobiliaria/Dockerfile:12-13` hornea
  `ARG NEXT_PUBLIC_API_URL=https://api-production-262e.up.railway.app` en build time (ídem inquilino).
- **DEMO ⇒ `apiEnabled === false`**: `scripts/build-static.sh` + `.github/workflows/deploy.yml:29`
  nunca setean la variable.

Del lado del API el flag `DEMO_MODE` (`apps/api/src/env.ts:21`) cambia **exactamente 3 cosas**,
ninguna de plata, y las tres fallan cerradas:

| Archivo:línea | Qué cambia con `DEMO_MODE=true` |
|---|---|
| `apps/api/src/routes/auth.ts:336`, `:423` | backdoor OTP `000000` — **doblemente gateado**: además exige `NODE_ENV !== 'production'` |
| `apps/api/src/routes/auth.ts:586` | `POST /auth/demo` (sesión de un click). Sin el flag → **404** |
| `apps/api/src/routes/inquilino-mundo.ts:936` | `POST /co-inquilinos/:id/aceptar` auto-acepta. Sin el flag → **403** |

### 7.A — REAL (anda de punta a punta contra API + DB en producción)

Auth del panel (login, registro, OTP de usuario) · login del inquilino por OTP + multi-alquiler ·
contratos (alta con wizard, detalle, edición, baja) · propiedades y propietarios (CRUD) ·
liquidaciones + devengo automático por cron · informar pago con comprobante subido al Volume ·
validar/rechazar/anular cobro · cobro manual · **conciliación bancaria por extracto CSV/Excel** ·
caja de gastos + cierre del día + comprobante adjunto · rendiciones al propietario ·
bandeja de aprobaciones · reclamos completos con "¿quién paga?" · rating del reclamo ·
profesionales + red cross-tenant · **flujo del profesional por link mágico con fotos** ·
consorcios Fase 1 · co-inquilinos (ambos lados) · documentos de contrato/propiedad/inquilino ·
avatares (panel e inquilino) · depósitos en custodia y su resolución · rescisión con penalidad ·
**cargos al inquilino → PWA** · saldar deuda de ex-inquilino · ajuste de alquiler · renovación ·
mora por contrato · garantes · anuncios con email SMTP real · servicios públicos y boletas ·
feed de notificaciones del inquilino · certificado + verificación pública · estadísticas
(`GET /metricas/resumen`) · importación masiva de cartera · sociedades · equipo y permisos ·
empresa/cobranza/mercado · historial de acciones (auditoría) · ganancia por contrato y propiedad ·
expediente de propiedad (timeline, salud de pago, seguros, gastos, reclamos) · bandeja de bugs
(Sonar) · personas/historial de inquilinos · trial pre-lanzamiento.

Dos hechos que conviene subrayar porque contradicen el miedo habitual:

1. **No hay ni un solo caso de "aprieto Guardar, veo el toast verde y la plata se fue a
   localStorage"** en las pantallas vivas de producción. Los tres agujeros clásicos —pagos, caja,
   rendiciones— están cableados.
2. Cuando el API se cae, **fallan ruidosamente en vez de fingir éxito**
   (`apps/inmobiliaria/src/lib/api/hooks.ts:421-431`, `apps/inquilino/src/lib/api/use-servicios.ts:212-218`).

### 7.B — DEMO A PROPÓSITO (existe, anda, y en prod está apagado o escondido)

| Feature | Dónde está el gate | Por qué está bien |
|---|---|---|
| Chat con el contrato / "Asistente" | `apps/inquilino/src/app/(app)/broker/page.tsx:113` → `<Proximamente/>`; `ContratoChat` solo se monta en la rama demo de `contrato/page.tsx:194` | No hay RAG ni se escribe `ChatMensaje`. Ver la salvedad en §7.D |
| Dashboard interno de objetivos | `admin/objetivos/page.tsx:44` → "Disponible pronto" | Los números salen de `lib/objetivos-data.ts` (mock estático) |
| Config long-tail: plan, facturas, convenios, cupones, referidos, forma de pago | `configuracion/page.tsx:296` → `if (apiEnabled) return <ConfiguracionProd/>`; todo el bloque demo vive **después** de esa línea | En prod se ve `ConfiguracionProd`, todo persistido en DB |
| Negociador IA de renovación | `renovaciones/page.tsx:145` y `:243` (`{!apiEnabled && …}`) | `lib/negociador-ia.ts` es heurística local sin backend |
| Screening / "Verificar inquilino" | Doble gate: link oculto del menú (`sidebar.tsx:199`) + popup "beta" si entrás por URL (`screening/page.tsx:138`) | Decisión del dueño. **Pero el endpoint es peligroso — ver §7.C y §9** |
| Lectura por IA del comprobante | Panel: `pagos-por-validar.tsx:243` pasa `conIA={false}`. Inquilino: `checkout/page-client.tsx:1222` (`if (!apiEnabled)`) | `lib/extraccion-ia.ts` es un PRNG que inventa banco, CBU y N° de operación. Informar al backend un nro inventado sería fraude contable: **muy bien apagado** |
| Modo "Cliente piloto" (badge + FAB) | `piloto-fab.tsx:80`, `piloto-badge-topbar.tsx:25` | En prod el canal de bugs es Sonar |
| Scoring del inquilino | `contratos/[id]/page-client.tsx:149` | `lib/scoring-inquilino.ts` fabrica el score |
| Conectar ARCA del propietario | `propietarios/[id]/page-client.tsx:108` | `ArcaConfig` no tiene create/read en la API |
| Alta de inquilino desde el panel | `cargar-inquilino-trigger.tsx:40` → botón **disabled** "Próximamente" | Mejor deshabilitado que escribiendo a localStorage |
| Aprobar/rechazar contrato desde el detalle | `contratos/[id]/page-client.tsx:1283`,`:1291` (`disabled={apiEnabled}`) | El camino real es la Bandeja de Aprobaciones |
| Inbox del día + gráfico semanal del dashboard | rama demo de `page.tsx` (gate en `:62`); el gráfico es literalmente `// Mock visual` (`:879`) | Números hardcodeados 78/92/81/84 |
| Calendario · Profesionales (lado inquilino) · Renovación desde la PWA · Editar mis datos | `calendario/page.tsx:55`, `profesionales/page.tsx:49`, `contrato/renovacion/page.tsx:48`, `cuenta/editar/page.tsx:26` → todos `<Proximamente/>` | Sin endpoint detrás |

### 7.C — CÁSCARA y FAKE EN PROD

**Modelos Prisma con CERO usos en todo `apps/api/src`** (tablas muertas):
`Capacidad` (los permisos viven en código, `packages/shared/src/permisos.ts`) ·
`TramoPlan` · `TramoPlanConsorcios` · `Suscripcion` · `Factura` · `Cupon` · `CuponAplicado` ·
`Referido` · `MetaSemestre` · `CohortMes` · `FunnelStep` · `FuenteAdquisicion` ·
`BloqueadorObjetivo` · `ContratoDraft` · `CierreCaja` (¡`GET /caja/cierre` calcula al vuelo y
**no persiste snapshot auditable**!) · `CargoPagado` · `MovimientoFeed` · `DatosBancarios` ·
`ProximoCambioBancario` · `CoInquilinoInvitado` · `ChatMensaje` · `Comprobante` (fiscal) ·
`ArcaConfig` (solo `deleteMany` en cascada, `core.ts:737`).

**Endpoints vivos que ningún front llama:**

| Endpoint | Riesgo |
|---|---|
| `POST /screening` `inquilino-mundo.ts:766` + `GET /screenings` `:818` | **MEDIO-ALTO — ver §9** |
| `POST /reportes` `:1297` + `GET /reportes` `:1379` | Bajo |
| `POST /auth/pin` `auth.ts:660` | Bajo: mutador vivo sin dueño; su validación del "PIN actual" (`:679`) es un no-op porque `verificarPinUsuario` siempre aprueba (`auth/pin.ts:11`) |

**FAKE EN PROD (la pantalla responde pero no persiste):**

| Qué | Evidencia | ¿Puede creer que guardó? | Gravedad |
|---|---|---|---|
| Tab "Comunicaciones" + diálogo "Nuevo mensaje" | El tab existe (`contratos/[id]/page-client.tsx:304`,`:519`) pero `use-contrato.ts:301` hardcodea `comunicaciones: []`. El diálogo abre `wa.me`/`mailto` y su descripción dice **"Queda registrado en el historial del contrato"** (`mensaje-inquilino-dialog.tsx:119`), que es falso — el propio comentario del código lo admite (`:99-101`) | **SÍ** | **Media** |
| Marcar boleta pagada / eliminar boleta (PWA) | En prod son **no-ops literales**: `use-servicios.ts:253-254` → `async () => {}`. Hoy mitigado porque `puedeGestionar: false` (`:236`) esconde los botones | No hoy; **sí** el día que alguien muestre el botón | Media (bomba de tiempo) |
| Campana de notificaciones del panel | `notifications-bell.tsx:39` → `if (apiEnabled) return [];` — existe en la topbar y nunca muestra nada | No | Baja-media |
| `EventoContrato` se escribe y nunca se lee | Se crea en `core.ts:1784` (renovación) y `core.ts:2833` (modo de cobranza / finalización), pero ningún endpoint lo devuelve; `use-contrato.ts:300` hardcodea `eventos: []` → el tab "Historial" siempre dice "Sin eventos registrados" | Al revés: cree que **no** quedó registro y sí quedó | Media |

**Código muerto**: `apps/inmobiliaria/src/lib/cierre-caja.ts` (9.8 KB, 0 importadores) ·
`proximamente.tsx` y `boton-proximamente.tsx` del panel (0 importadores) ·
`boton-proximamente.tsx` del inquilino · `setPinSeguridad` (`hooks.ts:510`, 0 callers).

### 7.D — El dead-end más visible del producto

`apps/inquilino/src/components/nav-bar.tsx:36` pone `/broker` ("Asistente") como **botón central
elevado del bottom-nav**, y el propio código lo describe como "el diferenciador del producto"
(`:29-32`). En producción ese tap cae en `<Proximamente/>`. Es el botón más destacado de la PWA
y no hace nada.
---

## 8. Discrepancias doc ↔ código

Regla aplicada: **manda el código**. Todo lo de abajo está verificado contra HEAD `70d4be8`.

### 8.1 Los números que publican todos los docs están mal

| Métrica | **Real (hoy)** | `01-ARQUITECTURA.md:12` | `PROJECT.MD:183` / `README.md` | `docs/API.md:5` |
|---|---|---|---|---|
| Modelos Prisma | **82** | 72 | 75 | — |
| Enums Prisma | **79** | 72 | 74 | — |
| Endpoints HTTP | **206** | 105 | 153 | 153 |
| Líneas de `schema.prisma` | **2728** | ~2220 | ~2330 | — |
| Migraciones | **44** | "5 migraciones" (`:25`) | — | — |
| Archivos de rutas | **25** | 10 listados | 14 listados | — |

Cómo se llega a 206: no hay prefijos (`app.ts:233-257` registra los 25 plugins sin `{ prefix }`),
así que todo path es literal. El grep de `app.<verbo>('...')` da **204 pares método+path únicos**.
A eso se le suman **2 loops con template literal** que registran 2 rutas cada uno —
`anuncios.ts:395-396` (`leido`/`enterado`) y `plata.ts:2222-2223` (`aprobar`/`rechazar`) —
así que **204 − 2 + 4 = 206**.

Desglose por archivo: `core.ts` 55 · `operacion.ts` 43 · `plata.ts` 25 · `inquilino-mundo.ts` 17 ·
`auth.ts` 13 · `anuncios.ts` 6 · `visitas-publicas.ts`/`mi-perfil.ts`/`importaciones-cartera.ts`/`cuentas.ts` 5 c/u ·
`soporte.ts`/`resumenes-bancarios.ts`/`documentos.ts` 4 c/u · `servicios-publicos.ts` 3 ·
`uploads.ts` 2 · los 9 restantes 1 c/u.

`PROJECT.MD` **ni siquiera menciona** `cuentas.ts`, `soporte.ts`, `metricas.ts`,
`contrato-ganancia.ts` ni los 7 `propiedad-*.ts`.

> El propio prompt que originó este documento repite el "~153 endpoints y ~75 modelos" de
> `PROJECT.MD`, así que también estaba corto.

### 8.2 Cosas que los docs dan por pendientes y ya están cerradas

| Afirmación del doc | Doc:línea | Qué dice el código hoy | Veredicto |
|---|---|---|---|
| "🔴 `usuarios.email` **no es único** a nivel global… no se aplicó sin tu OK" | `00-ESTADO.md:111-116`, `03-AUDITORIAS.md:159-162` | `schema.prisma:753` → `email String @unique`, con el comentario "ÚNICO EN TODA LA PLATAFORMA (decisión del owner, 29/07)". Migración `20260729210000_usuario_email_unico`, commit `d06478d` | ❌ **OBSOLETO** — cerrado hace 20 días |
| "el cargo de reclamo ya llega a la PWA… ⚠️ **Falta deployar**" | `04-PENDIENTES.md:58`, `00-ESTADO.md:136-140` | `GET /mis-cargos` (`inquilino-mundo.ts:619`) consumido por `use-cargos.ts:35`; panel con `GET /contratos/:id/cargos` (`plata.ts:752`), `POST /cargos/:id/saldar` (`:785`) y `/descobrar` (`:850`) en `cargos-contrato-card.tsx:50,63`. Todo ancestro de lo que corre en prod | ❌ **OBSOLETO** — construido **y deployado** |
| "⚠️ el cargo al inquilino aún no llega a su PWA (write-only)" | `00-ESTADO.md:99`, `04-PENDIENTES.md:127` | Ídem | ❌ **OBSOLETO** |
| "Avatar del panel + comprobante en gasto de caja: falta cablear el front" | `04-PENDIENTES.md:41-49` | `avatar-usuario.tsx:48` sube y llama `PUT /me/avatar`, montado con `editable` en `sidebar.tsx:281-285`; el input de comprobante existe en `caja/page.tsx:839-876` y viaja en el POST (`:670`) | ❌ **OBSOLETO** (y `00-ESTADO.md:129-134` ya lo daba por cerrado — los dos docs se contradicen) |
| §B: "objetivos/**métricas internas**" son demo-gated en prod | `04-PENDIENTES.md:65-66` | `GET /metricas/resumen` es REAL (`metricas.ts:148`), consumido con `enabled: apiEnabled` en `use-metricas.ts:39-41`, página `/estadisticas`. Entró en `ed2d9c9` (23/07) | ❌ **OBSOLETO** — las métricas dejaron de ser demo (los *objetivos* sí siguen mock) |
| "`POST /auth/pin/verify` sigue existiendo" | `PROJECT.MD:266`, `docs/API.md:105-106`, `05-DECISIONES.md:54` | **Fue borrado** en `d06478d`. Hay un test que lo blinda: `apps/api/test/auth.test.ts:188`. `POST /auth/pin` sí sigue (`auth.ts:660`) | ⚠️ **MITAD FALSO** |
| "`auth/pin.ts` (lockout anti-fuerza-bruta)" | `PROJECT.MD:159`, `PROMPT-ONBOARDING-DEV-SENIOR.md:72` | No hay lockout: el archivo tiene 13 líneas y **siempre aprueba**. Las columnas `pinIntentosFallidos`/`pinBloqueadoHasta` (`schema.prisma:761-762`) no las escribe nadie | ❌ **FALSO** — el propio `05-DECISIONES.md §7` lo contradice |
| "Bugs abiertos: 0 de los detectados" | `00-ESTADO.md:107` | `26fdfa6` (04/08) encontró **3 bugs de plata más**, uno con el depósito quedando RETENIDO para siempre en el caso **normal** de baja | ❌ **OBSOLETO** |
| "Último deploy… HEAD == origin/main == `535d15d`" | `02-DEPLOY.md:17-21` | Prod corre `70d4be8` | ❌ **OBSOLETO** |
| Lista de migraciones "actuales" (6 ítems, última `20260703110000`) | `02-DEPLOY.md:63-70` | Faltan 38, incluidas todas las de julio-agosto | ❌ **FALSO** |
| "El registro de rutas vive en `app.ts` (líneas 79-92)" | `PROJECT.MD:184`, `02-DEPLOY.md:25` | Está en `app.ts:233-257`; en 79-92 hoy vive el serializer que redacta tokens del log | ❌ **FALSO** |
| Árbol de `routes/` (10 archivos) y de `lib/` (solo `liquidaciones.ts`) | `01-ARQUITECTURA.md:32-49`, `PROJECT.MD:160-161` | 25 rutas y **16** libs (`aplicar-deposito`, `auditoria`, `deposito`, `estado-inicial-contrato`, `ganancia-contrato`, `importacion-cartera`, `imputar-reclamo`, `liquidaciones`, `matching-bancario`, `monto`, `persona`, `punitorios`, `reputacion-red`, `saldos`, `sonar-server-events`, `sonar`) | ❌ **INCOMPLETO** |

### 8.3 Cosas que los docs llaman "fake en prod" y no lo son

1. **`04-PENDIENTES.md §A.1`** dice que la pantalla de "forma de pago" *"escribe a localStorage →
   **fake en prod**"*. **Falso**: `FormaPagoSelector` se monta en `configuracion/page.tsx:759`, o sea
   **después** del `return` de producción de `:296`. En prod esa sección **no se renderiza**. Es
   demo-only, no fake.
2. **`04-PENDIENTES.md §A.2`** dice lo mismo del manager de referidos. **Falso** por el mismo
   motivo (`configuracion/page.tsx:954`).
3. **`04-PENDIENTES.md §B`** menciona "algunas vistas de consorcios" como demo-gated. Consorcios
   está **mayormente cableado en prod** (`operacion.ts:1196-1766`); lo único demo ahí es la razón
   social + CUIT fabricados (`consorcios/[id]/page-client.tsx:187`) y el `MorososPanel`
   (`pagos/page.tsx:690`).

### 8.4 Discrepancias estructurales que no son "un número mal"

- **No hay 3 tipos de token, hay 5.** Todos los docs (y el prompt) dicen "3 tipos: usuario /
  inquilino / co-inquilino". `packages/shared/src/auth.ts` define **cinco**: `usuario` (`:4`),
  `inquilino` (`:13`), `co-inquilino` (`:26`), **`persona`** (`:41`) y **`profesional`** (`:62`),
  más el `kind:'co-invitacion'` que emite la invitación. Los dos últimos quedan **fuera** de la
  unión discriminada `JwtPayloadSchema` (`:73-77`) a propósito. Detalle importante: **el token de
  `persona` es el único sin `inmobiliariaId`** — es cross-tenant por diseño.
- **`.env.example` describe un stack que no existe.** Declara `ANTHROPIC_API_KEY`, `MP_*`,
  `NOSIS_*`, `WHATSAPP_*`, `R2_*`, `RESEND_*`, `CLERK_SECRET_KEY`, `SENTRY_*`, `POSTHOG_*`,
  `REDIS_URL`. El esquema real (`apps/api/src/env.ts`) **no contiene ninguna**: solo
  `DATABASE_URL`, `JWT_SECRET`, `PORT`, `DEMO_MODE`, `CORS_ORIGINS`, `NODE_ENV`,
  `FECHA_LANZAMIENTO`, `CRON_*`, `SONAR_*`, `SOPORTE_TENANT_IDS`, `UPLOADS_DIR`, `SMTP_*`.
  Es herencia del brief original de "LLAVE" (mismo texto que `CLAUDE.md §10`) y hoy **desinforma**.
  En particular: **no hay integración de WhatsApp de ningún tipo**; el único canal saliente es
  SMTP (`apps/api/src/mailer.ts`). Los botones de WhatsApp del panel abren `wa.me` con texto
  pre-armado, que es honesto.
- **`docs/*.md` tiene rutas absolutas de otra máquina** (`/Users/<usuario>/dev/...`, formato macOS) en
  `CONFIG.md:108`, `FRONTEND.md:133-135`, `GLOSARIO.md:64-65`, `TESTING.md:209-212`.

### 8.5 El estado del deploy: al revés de lo que dicen los docs

```
$ curl -s https://api-production-262e.up.railway.app/health
{"ok":true,"db":"up","version":"70d4be8","ts":"2026-08-18T..."}

$ git rev-parse HEAD          → 70d4be8cb4c5e85fe30663e9865f2ff4d260ab6a
$ git rev-parse origin/main   → 70d4be8cb4c5e85fe30663e9865f2ff4d260ab6a
```

`health.ts:29-31` define `version` como `RAILWAY_GIT_COMMIT_SHA.slice(0,7)` (fix U2, `70962f5`).
Devolvió un SHA real, no el fallback.

> **El backend está deployado en el commit exacto de `main`, a 0 commits de atraso.** Todo lo que
> `00-ESTADO.md:7` y `04-PENDIENTES.md:58` marcan como *"en `main`, TODAVÍA SIN DEPLOYAR"* **ya está
> en producción**: los cazabug T→AM, el cargo de reclamo en la PWA, la unicidad de email y los tres
> agujeros de plata del 04/08.

Los dos fronts (`admin.myalquiler.com`, `app.myalquiler.com`) responden 200, pero **en qué commit
están no es verificable**: ningún front expone un build-id cruzable con git, y `02-DEPLOY.md:31`
avisa que los servicios de Railway **no están conectados a GitHub** (hay que correr `railway up`
a mano por servicio). Como el back sí está al día, lo más probable es que se hayan subido los tres
juntos, pero **no lo puedo afirmar**.

**Desfase documental:** `00-ESTADO.md` declara su baseline en `09b454a` (28/07). Desde ahí entraron
**107 commits (89 sin merges)**. `04-PENDIENTES.md` se declara al día con `7e34765` (05/07):
está **44 días atrasado**.

### 8.6 Los dos hallazgos que ningún doc registra

**a) La CI está en rojo hace 44 días.**
`.github/workflows/` tiene **un solo archivo**, `deploy.yml` ("Deploy to GitHub Pages"), que corre
`pnpm install` → `scripts/build-static.sh` → publicar. **No corre tests, ni typecheck, ni lint, ni
build del backend, ni deploy a Railway.** Y lo único que corre, falla:

```
Error: Page "/inquilinos/[id]" is missing "generateStaticParams()"
       so it cannot be used with "output: export" config.
```

Último run verde: `46dc274`, **2026-07-05**. Desde entonces ~40 corridas seguidas en rojo.
Verificado en el código: `apps/inmobiliaria/src/app/(app)/inquilinos/[id]/page.tsx` **nunca tuvo**
`generateStaticParams`; sus cinco hermanas (`consorcios/[id]`, `contratos/[id]`, `propiedades/[id]`,
`propietarios/[id]`, `reclamos/[id]`) sí la tienen.

**Consecuencia real:** la demo pública de GitHub Pages —que es la vitrina **y el canario del modo
`apiEnabled === false`**— está congelada en el estado del 05/07. Todo lo que los docs repiten como
*"demo intacta / ambos modos andan"* (`04-PENDIENTES.md:3`, `00-ESTADO.md:63`) **no se está
verificando desde hace mes y medio**. El fix son ~6 líneas: copiar el `generateStaticParams` de
cualquiera de las hermanas.

**b) No hay un solo test de front.**
64 archivos de test, **todos** en `apps/api/test/`. Cero en `apps/inmobiliaria`, `apps/inquilino`,
`packages/ui` y `packages/shared`. Lo admite el propio autor en `26fdfa6`: *"El del doble click es
de front y se verificó en navegador, porque apps/inmobiliaria no tiene suite."*
Los tests además **pegan a la Postgres de Railway** por el proxy público y `seedBase` es
destructivo-idempotente (`docs/TESTING.md:25`) — por eso no se corrieron acá.
De los 64, **14 son puros** (sin DB) y son los únicos seguros de correr en cualquier lado.

Flujos de plata **sin cobertura** (grep de rutas dentro de `apps/api/test/*.ts`):
`GET /caja/cierre` (0 tests, y ya tuvo dos bugs: B1 excluir `PROPIETARIO_DIRECTO`, B3 redondeo) ·
`POST /internal/cron/devengar` (0 tests, y el cazabug AC fue justo ahí) ·
`POST /cargos/:id/descobrar` (0) · `GET /contratos/:id/cargos` (0) · `GET /mis-cargos` (0) ·
`GET /aprobaciones` (0) · `empresa`/`mercado`/`sociedades` (0) · `mi-inmobiliaria/*` (0) ·
`documentos.ts` y `mi-perfil.ts` (0) · `co-invitacion/*` (0) · **todo el front** (0).
---

## 9. Riesgos y deuda técnica, por impacto

Ordenado por lo que costaría que salga mal. Cada ítem con su referencia; nada de esto es
especulación sobre código que no leí.

### 🔴 Nivel 1 — plata que se pierde o se paga dos veces, hoy

| # | Riesgo | Dónde | Por qué duele |
|---|---|---|---|
| **1** | **Cambiar `modoCobranza` con cobros viejos sin rendir** | `core.ts:2888-2900` vs `plata.ts:1631` | El guard solo mira el **período en curso**, pero la rendición filtra por el modo **actual** en **cualquier** período. Hacia directo: plata cobrada que **ningún endpoint puede rendirle al dueño**. Hacia inmobiliaria: se rinde plata **que nunca entró** ⇒ **doble pago al propietario, sin ninguna alarma** |
| **2** | **`/visitas-publicas/listo` cierra el reclamo con costo sin exigir pagador** | `visitas-publicas.ts:331` vs `operacion.ts:485` | El reclamo queda RESUELTO e **irreclasificable** (409 en `/clasificar` y `/resolver`) y la rendición lo ignora porque `pagador != PROPIETARIO` ⇒ **el costo del arreglo no se le cobra a nadie**. Hermano: `/listo` tampoco replica el guard de `DEPOSITO`, y puede crear un cargo incobrable por los 4 caminos |
| **3** | **El portador del link mágico declara `montoCobrado` sin tope ni aprobación** | `visitas-publicas.ts:242` | `z.number().nonnegative()` sin techo. Se imputa como `costoTrabajo` y se cobra a propietario/inquilino/depósito. **Quien tenga el link mueve plata real.** Y `regenerar-link` **no revoca** las sesiones ya emitidas (`operacion.ts:394-397`) |
| **4** | **`finalizar` no cierra los cargos `contraDeposito`** | `core.ts:1480-1497` vs `plata.ts:954-957` | Quedan `saldadoAt: null` **para siempre**, insaldables por los cuatro caminos. Deuda fantasma en los libros |
| **5** | **El `sobrante` de la retención del depósito se descarta** | `core.ts:1486-1493`, `aplicar-deposito.ts:83-146` | `aplicarDepositoADeuda` solo imputa contra **liquidaciones**; la penalidad es un `CargoContrato`. **El `saldoNeto` que el diálogo le prometió al operador no es el que queda en los libros** |
| **6** | **`IngresoRendido` sin tope global** | `plata.ts:1946-1953` | Gastos y reclamos aplican `min(…, restanteGlobal)`; los ingresos extra **no**. Con un cambio de participaciones, dos dueños pueden llevarse **$300.000 de un ingreso de $200.000** — y es plata que **sale** de la caja de la inmobiliaria |
| **7** | **Un gasto parcialmente rendido se puede BORRAR** | `plata.ts:1560-1562` | En multi-dueño el flag `descontadoEnRendicion` queda en `false` hasta el 100%. Borrarlo deja `GastoRendido` apuntando a un movimiento inexistente (es `refId` soft, sin FK) y **la inmobiliaria se come la mitad**. Anular la rendición tampoco lo recupera |

### 🟠 Nivel 2 — datos personales y credenciales

| # | Riesgo | Dónde |
|---|---|---|
| **8** | **Credencial de producción en texto plano, en 4 archivos del repo** — que además **estuvo público**. Ver el aviso al principio de este documento | `README.md:24`, `PROJECT.MD:42`, `work-agent/00-ESTADO.md:39`, `work-agent/05-DECISIONES.md:95` |
| **9** | **`GET /uploads/:tenant/:name` autoriza por tenant, no por dueño del archivo** | `uploads.ts:325-340` | Cualquier inquilino, co-inquilino **o profesional con link mágico** puede leer **cualquier** archivo del tenant si conoce el nombre: comprobantes ajenos, DNIs, recibos de sueldo, escrituras de garantes, extractos bancarios. Mitigado **solo por `randomUUID()`**, no por autorización |
| **10** | **`requireInquilino` no revalida nada contra la DB** | `guards.ts:82-90` | Es el único guard sin revalidación, en un sistema donde los otros tres la tienen **y sus comentarios explican por qué**. 15 días de token que nadie confronta. **~6 líneas de fix, el mejor valor/esfuerzo del informe** |
| **11** | **`hashCertificado` es FNV-1a + djb2 truncado a 12 chars**, sin sal ni secreto, **determinístico**, y ya está persistido en producción **con PII adentro** (nombre, DNI, email, teléfono, dirección, monto) | `inquilino-mundo.ts:148-164`, `schema.prisma:2709-2718` | El día que se abra el endpoint público de verificación, el identificador que lo protege es derivable. **Hay que reemplazarlo antes, no después** |
| **12** | **El token de garante es `base64url` de un JSON con un "secreto" hardcodeado** que el propio archivo declara como *"no-secret: es solo ofuscación visual"* | `garante-token.ts:10` | Trivialmente forjable para cualquier `contratoId`. Hoy inofensivo porque no hay backend; **el día que lo haya, es un IDOR inmediato cross-tenant** |
| **13** | **`POST /auth/demo` sin guard de `NODE_ENV`** (los dos `/otp/verify` sí lo tienen) | `auth.ts:585-586` | Si `DEMO_MODE=true` se filtrara a la env de producción, emite una sesión de inquilino real **sin ninguna prueba de identidad** |
| **14** | **`POST /screening` fabrica un informe crediticio y lo persiste como `COMPLETO`** | `inquilino-mundo.ts:240-270`, `:786` | Score Nosis, deudas BCRA, cheques y juicios derivados de un PRNG sembrado con los dígitos del CUIT, sobre una **persona real identificada**. Hoy no lo llama nadie, pero el endpoint está **vivo y autenticado**: alcanza con que alguien "termine de cablear la pantalla". **Devolver 501 hasta que exista Nosis** |
| **15** | **Fuga del flujo demo de login en producción** | `auth-otp-api.ts:76-79`, `login/page.tsx:367` | Si `fetch` **tira** (red intermitente, DNS), el catch cae al flujo 100% localStorage: genera un código local, **lo muestra en pantalla en un banner "DEMO"** sin gate de `apiEnabled`, y crea *"un perfil demo genérico para que la app funcione"*. El inquilino queda **"logueado" en una sesión falsa sin JWT** |
| **16** | **`whatsapp-fab.tsx:29-30` cae a `contratoMock` sin gate** | ídem | El FAB del home puede armar el mensaje con la dirección del mock (*"Gorriti 4521, 3°B"*) mientras `/mi-contrato` no resolvió. Es el único `?? contratoMock.*` fuera de una rama demo |

### 🟠 Nivel 3 — el proceso, no el código

| # | Riesgo | Evidencia |
|---|---|---|
| **17** | **La CI está en rojo hace 44 días y nadie lo notó** | Último run verde `46dc274` (05/07); ~40 corridas seguidas en `failure`. Causa: falta `generateStaticParams` en `inquilinos/[id]/page.tsx`, que sus cinco hermanas sí tienen. Fix de ~6 líneas |
| **18** | **La CI no corre tests, ni typecheck, ni lint, ni build del backend** | El único workflow es el build estático de GitHub Pages. Los scripts `pnpm typecheck`/`lint` existen y **ningún workflow los invoca** |
| **19** | **La demo pública está congelada desde el 05/07** | Es la vitrina **y el canario del modo `apiEnabled === false`**. Todo lo que los docs repiten como *"demo intacta / ambos modos andan"* **no se verifica hace mes y medio** |
| **20** | **Cero tests de front** en los dos Next apps | 64 archivos de test, todos en `apps/api/test/`. Y los de API pegan a la Postgres de Railway con `seedBase` destructivo — solo **14 son puros** |
| **21** | **`GET /caja/cierre` y `POST /internal/cron/devengar` sin ningún test** | Son el cierre diario de caja y el que factura a **todos** los tenants. Los dos ya tuvieron bugs (B1/B3 y el cazabug AC) |
| **22** | **Los docs están 107 commits atrasados y afirman lo contrario de la realidad** | `00-ESTADO.md` dice "sin deployar" cuando está todo deployado; declara un 🔴 abierto que se cerró hace 20 días; los conteos de API y schema están mal en los cuatro docs |

### 🟡 Nivel 4 — deuda que todavía no cobró

- **Archivos huérfanos acumulándose sin barrido** (§5.8). El predicado ya existe y está testeado.
- **`EventoContrato` es write-only**: hay trazabilidad en la DB que el panel no muestra, y el tab
  "Historial" dice siempre "Sin eventos registrados". `GET /contratos/:id/eventos` son ~10 líneas.
- **Dos endpoints de ajuste de alquiler activos a la vez**, con aritmética e historial distintos:
  `/ajustar` deja `AjusteAlquiler` sin `EventoContrato`, `PATCH /monto` al revés.
- **El tier `PAGAR` no gatea nada**: VER, PAGAR y COMPLETO son operativamente idénticos.
- **`Contrato.comisionInmobiliaria` se valida, se persiste y no se lee jamás** — la UI del alta hace
  creer que sirve. La comisión real sale de `Propietario.comisionPct`.
- **`Contrato.penalidadRescisionMeses` se lee y ningún endpoint lo escribe**: el override por
  contrato es inalcanzable.
- **`CierreCaja` promete ser un "snapshot inmutable de auditoría"** y ningún endpoint lo escribe:
  el cierre de un día pasado **cambia** si se editan participaciones, comisión o modo de cobranza.
- **`inquilinos.email` sin ningún índice**, en el path más caliente de la PWA (§3.6).
- **`resumenes-bancarios.ts` no registra ningún evento de auditoría** pese a mover plata y cerrar
  avisos del inquilino automáticamente.
- **El PIN dejó rastro por todos lados**: `requierePinPara()` devuelve `true` para 7 capacidades,
  `GRUPO_LABEL.sensible` sigue diciendo *"requieren PIN del usuario"*, los bodies siguen aceptando
  `pin: z.string().optional()`, y `POST /auth/pin` sigue vivo escribiendo `pinHash` **sin poder
  verificar el PIN actual**.
- **Copy que promete lo que no existe**: "te avisamos por WhatsApp" en tres pantallas, "Queda
  registrado en el historial del contrato" en el diálogo de mensaje, y el tour de onboarding que
  vende el Asistente, el calendario, la línea de tiempo del contrato y el link para el garante —
  **cuatro features que en producción son `Proximamente`**.
---

## 10. Preguntas abiertas — solo las puede responder el owner

Las ordeno por cuánto cambia el sistema la respuesta.

**1. ¿La mora es de la inmobiliaria o del propietario?**
El cap `min(cobrado, montoTotal)` (`plata.ts:1719`) deja la mora fuera del bruto rendible, y no
encontré **ningún** cálculo que se la atribuya al dueño. O sea: hoy queda del lado de la
inmobiliaria **por omisión, no por una regla escrita** — no está en `05-DECISIONES.md`. Si la
respuesta es "es del propietario", hay plata mal repartida en producción desde siempre.

**2. ¿La rendición puede ser parcial, o el dueño sigue cobrando $0 cuando los gastos superan lo
cobrado?** Es el pendiente que `00-ESTADO.md` ya identifica. Lo que agrego es que el impacto es peor
de lo que sugiere el doc: no bloquea un mes, **bloquea también los siguientes** por el carry-over, y
las tres salidas son todas manuales. Si la respuesta es "sí, parcial", hace falta una columna de
saldo arrastrado en `Rendicion`, que hoy no existe.

**3. ¿Aplicar el depósito a la deuda debe generar comisión y entrar al cierre de caja del día?**
Hoy sí (`aplicar-deposito.ts:127-128` lo declara intencional). Pero es plata que estaba en poder de
la inmobiliaria desde la firma del contrato, y aparece como "cobrado hoy". Lo dejo como
comportamiento a validar con negocio, no como bug.

**4. En una propiedad multi-dueño con cobranza directa, ¿el 100% va al dueño principal?**
Hoy sí: `findFirst … orderBy porcentaje desc` toma uno solo. En una propiedad 51/49, **el 49% cobra
$0 por esa vía y el sistema no lo registra en ningún lado**. ¿Es la política, o falta el reparto?

**5. ¿Se puede cambiar el modo de cobranza con cobros de meses anteriores sin rendir?**
Hoy el guard no lo impide y el resultado es plata irrendible (o doble pago). ¿Se endurece el guard
para mirar `AlquilerRendido` en vez de `Pago` del período actual, o se acepta y se documenta el
procedimiento manual?

**6. El botón "Asistente" es el tab central elevado de la PWA y no hace nada. ¿Se saca del nav o se
construye?** El código lo describe como *"el diferenciador del producto"*. Hoy es el dead-end más
visible de la plataforma, y el tour de onboarding lo vende explícitamente. Lo mismo aplica, en menor
escala, a `/calendario`, `/profesionales` y `/contrato/renovacion`.

**7. El certificado de buen pagador: ¿se abre el endpoint público de verificación?**
La pantalla es real, calcula el nivel del historial y ofrece compartir un link — que en producción
cae en *"No pudimos verificar este certificado"*. El caso de uso completo ("llevá esto a la inmo
nueva y ahorrate el garante") **está roto de punta a punta**. Y si se abre, **primero** hay que
cambiar el hash (§9.11).

**8. ¿El screening se construye con Nosis o se apaga el endpoint?**
Hoy `POST /screening` fabrica un informe crediticio y lo persiste como `COMPLETO`. Mientras no haya
proveedor real, mi recomendación es devolver 501 — pero es tu llamada.

**9. ¿Un contrato en BORRADOR con la aprobación rechazada qué debería poder hacer?**
Hoy no puede activarse ni finalizarse: queda zombi (§3.4). ¿Se borra, se reabre la aprobación, o se
permite finalizarlo?

**10. ¿`EN_CURSO` sigue siendo un estado del negocio?** Hoy es inalcanzable desde `ABIERTO` en
producción: "tomar / poner en curso" no tiene endpoint. Solo se llega reabriendo un reclamo
resuelto. ¿Se construye el endpoint o se saca el estado?

**11. ¿Los docs de `work-agent/` siguen siendo la fuente de verdad?** Hoy afirman lo contrario de la
realidad en varios puntos importantes (§8). Si van a seguir cumpliendo ese rol, hay que corregirlos;
si no, conviene decir explícitamente que este documento y el código mandan.

---

## Anexo — qué NO se verificó

Para que nadie construya sobre arena:

- **No se corrió ningún test.** Los de `apps/api` pegan a la Postgres de Railway y `seedBase` es
  destructivo-idempotente (regla dura §4 del owner). De los 64, solo 14 son puros.
- **No se consultó la base de producción.** No sé si hay filas `Screening` fabricadas ya
  persistidas, cuántos `EventoContrato` huérfanos hay, ni si el backfill de `backfill-personas.ts`
  llegó a correrse en el tenant real (el commit `c7537c3` avisa que no se había corrido).
- **No se verificó el estado del Volume de Railway** (ocupación real, cantidad de huérfanos).
- **No se verificó en qué commit están los dos fronts.** El API sí (`/health` devuelve `70d4be8`),
  pero ningún front expone un build-id cruzable con git y los servicios de Railway **no están
  conectados a GitHub**. Lo más probable es que se hayan subido los tres juntos; no lo puedo afirmar.
- **No se verificaron las variables de entorno del deploy** (que `NEXT_PUBLIC_API_URL` esté
  efectivamente seteado se infiere del `ARG` horneado en los Dockerfiles).
- **No se leyó cada uno de los 206 handlers línea por línea.** El cruce endpoint↔front fue por grep
  de segmento de path + verificación manual de los casos sospechosos.
- **No se revisó `legacy/`, `contenido/` ni `brand/`.**
- **No se verificó el propósito de la migración `20260705140000_garante_persona`**: el nombre sugiere
  que `Garante` iba a ganar `personaId` y el schema vigente no lo tiene.
