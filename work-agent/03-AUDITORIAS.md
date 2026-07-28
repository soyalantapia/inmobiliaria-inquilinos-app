# Auditorías — historia y metodología

## El prompt reutilizable

El prompt canónico hoy es **`PROMPT-LOOP-QA-VISUAL-FUNCIONAL.md`** (esta carpeta). El
histórico `historico/AUDITORIA-PROFUNDA-PROMPT.md` fue la herramienta central y encapsula:

- **El lente "¿lo viviría un usuario común?"** — priorizar por daño real (plata mal,
  crash, datos perdidos, éxito falso, fuga entre tenants), no por elegancia.
- **11 dimensiones** con los archivos a leer: corrección del dinero, aislamiento
  multi-tenant, máquinas de estado, races/atomicidad, auth/authz, validación,
  deep-dive de `inquilino-mundo.ts`, robustez backend, panel-en-prod, PWA-en-prod,
  robustez frontend.
- **Reglas duras**: solo bugs trazables con repro + impacto; verificación adversarial
  (3 escépticos, mayoría); **verificar cada confirmado contra el código real antes de
  aplicar** (histórico ~50% falsos positivos); distinguir bug de decisión del dueño.
- **Receta de ejecución** (aprendida a los golpes): usar **sonnet** en finders y
  verificadores, en **tandas secuenciales de ~3**. Disparar muchos finders **opus** a
  la vez **revienta el rate-limit**. La **síntesis en opus puede dispararse por el
  filtro de ciberseguridad** (lista de vulns) → correr la síntesis en sonnet.

### Cómo se ejecuta (workflow)

Se corre con el **Workflow tool** (orquestación multi-agente). Patrón: finders por
dimensión → cada hallazgo pasa por 3 verificadores adversariales (lentes: ¿se
ejecuta?, ¿ya está manejado?, ¿impacto/fix correctos?) → gate por mayoría ≥2/3 →
síntesis que deduplica y arma el plan. Los scripts de los runs anteriores quedaron en
`.claude/.../workflows/scripts/myalq-audit-*.js` (se pueden editar y re-correr).

**IMPORTANTE**: el agente que orquesta debe pasarle al workflow el CONTEXTO COMPLETO
de lo ya arreglado (lista "YA ARREGLADO") para que no re-reporte, y la lista de
falsos positivos conocidos. Si no, re-reporta los ~50 fixes ya hechos.

## Historia de las pasadas

| Pasada | Bugs confirmados | Aplicados | Notas |
|---|---|---|---|
| Pre-lanzamiento + v2 | (varias tandas) | muchos | Cierre pre-launch + bugs de plata/estados/ciclo de vida |
| **v3** | 22 | 14 + 2 decisiones | 9 dimensiones; nació el prompt reutilizable |
| Migraciones diferidas | — | 2 constraints únicos | pago + co-inquilino |
| **v4** (ejecución del prompt) | 24 | 16 + 1 decisión | 2 CRÍTICOS del flujo de aprobación |
| Cierre diferidos v4 | — | 5 + migración sociedad | "continua con todo" |
| **v5** (1ra regresión) | 12 | 11 | agarró una **regresión del propio fix v4** |
| **3ra regresión** | ~20 (15 únicos) | aplicados | regresiones de los fixes v5 |
| **Ola 0** (23/06) | P1–P13 | aplicados | regresiones de v5 + integridad backend |
| **Keystones** (26/06) | — | file storage + cron | desconexiones estructurales, no "bugs" |
| **Auditoría 27/06** | 8 | **8 (todos)** | ver abajo — desconexiones + plata, E2E en prod |
| **Archivos/adjuntos (02-03/07)** | 1 | **1** (`f715055`) | ver abajo — fuga de imagen externa en reclamo/boleta |
| **Backlog construido (04/07)** | — | 8 features / 6 commits | ver abajo — NO son bugs: 5+2 superficies "schema sin feature", E2E |

**Total ~61 bugs/desconexiones reales arreglados** + decisiones de negocio. Julio sumó
la fuga `f715055` (archivos/adjuntos) y, aparte, la **construcción** de 5+2 superficies
que existían en el schema pero ningún endpoint usaba (no cuentan como "bug", pero cierran
el backlog que la auditoría de archivos dejó abierto). Todo con **demo intacta / ambos
modos andan**.

### Auditoría 27/06 (8 hallazgos, todos fixeados + deployados + testeados en prod)

Workflow: 6 finders (3 desconexión + 3 bugs) → verificación adversarial por hallazgo
→ crítico de completitud con 2ª ronda. 0 críticos · 5 ALTO · 1 MEDIO · 2 BAJO.

| # | Sev | Qué · commit |
|---|---|---|
| D1 | ALTO | Co-inquilino del panel REAL (`/contratos/:id/co-inquilinos`) — antes solo localStorage · `6cd6e53` |
| D2 | ALTO | `GET /contratos/:id` incluye `cuentaCobranza` del propietario (PROPIETARIO_DIRECTO) · `74d519f` |
| D3 | ALTO | Rating del inquilino llega al panel + recalcula `profesional.rating` · `bf19128` |
| D4 | MEDIO | Feed real `GET /mis-notificaciones` (la campana dejó de ser no-op) · `23fae36` |
| B1 | ALTO | `/caja/cierre` excluye pagos PROPIETARIO_DIRECTO del ingreso de la inmo · `74d519f` |
| B2 | ALTO | Gasto multi-propietario se rinde por partes y se conserva (+ `rendicion-multiowner.test.ts`) · `dac6d4a` |
| B3 | BAJO | Cierre de caja con comisión a centavos, consistente con la rendición · `6822c4b` |
| B4 | BAJO | `comprobanteUrl`/`archivoUrl` validan prefijo de tenant al persistir · `74d519f` |

Validación: cada uno `tsc`+`build` 0, deploy Railway, **E2E contra prod con
cleanup/restore** (5/5, 10/10, 11/11, 12/12, 4/4 según el flujo). B2 con test de
integración. Script del workflow en `.claude/.../workflows/scripts/myalquiler-audit-backend-bugs-*.js`.

### Auditoría de archivos/adjuntos (02-03/07) — 1 fuga cazada + backlog abierto

Pasada acotada: revisar que **toda** foto/archivo/adjunto de la app esté conectado y
guarde de verdad en el Volume del tenant. 7 superficies verificadas E2E (comprobante de
pago, foto/adjunto de reclamo, boleta de servicio, expediente del contrato, etc.). El
núcleo estaba sano — los uploads pasan por `/uploads` scopeados a `/uploads/<tenant>/…`
y el `GET` valida `tenantDe(payload)`.

**El hallazgo (1) → hardening `f715055`:** `Reclamo.fotoUrl`, `ReclamoEvento.adjuntoUrl`
y `BoletaServicio.archivoUrl` se persistían **SIN** pasar por `urlEsDelTenant`. Como
`urlDeArchivo` renderiza cualquier `https://` tal cual, un inquilino podía inyectar una
imagen externa (`https://…`) desde el panel y quedaba embebida. Fix: validar
`urlEsDelTenant` al persistir, en `operacion.ts` + `inquilino-mundo.ts`. Backend-only,
sin migración. ✅

Esta pasada dejó un **backlog** aparte: campos que existen en el schema pero que **ningún
endpoint usaba** (avatar del inquilino, documentos DNI/recibos/garante, visita del
profesional, resumen bancario, migración de cartera, avatar del panel, comprobante de
caja). Eso NO es un bug de plata ni una fuga — es feature sin construir. Se cerró en la
tanda del 04/07.

### Backlog construido (04/07) — 5+2 superficies "schema sin feature", E2E

⚠️ **Ojo: esto NO es una auditoría de bugs.** Es la **construcción** de las superficies
que la auditoría de archivos marcó como "campo en schema, feature inexistente". Se
construyeron TODAS, de verdad, cada una E2E con **cleanup total (0 residuo)** + typecheck
limpio. Migración `20260703110000_avatar_credito_importacion` aplicada en prod.

**Metodología** (distinta a las auditorías de bugs, que usan finders/verificadores): el
**Workflow tool** con un agente de *Explore por app* + **suites HTTP propias contra la DEV
DB** (no la prod). Cada superficie se prueba end-to-end y se limpia sola. Conteos de checks
E2E:

| Superficie construida | Commit | E2E | Nota |
|---|---|---|---|
| Avatar del inquilino + DOCUMENTOS (DNI/recibos/garante) | `8940981` | **19/19** | con migración (`inquilinos.imageUrl` + slots) |
| Flujo real del profesional por link mágico (fotos antes/después) | `f05b24d` | **24/24** | token opaco → JWT `kind:'profesional'`, sin cuenta |
| Validador de resumen bancario (CSV/Excel, **SIN IA**, matching determinístico) | `1404004` | **16/16** | decisión del dueño: parseo del extracto, no OCR |
| Migración de cartera (Excel/CSV, mapeo flexible de columnas) | `b153ebe` | **17/17** | el dueño sube SU planilla y mapea qué es qué |
| Avatar del usuario del panel + comprobante en gastos de caja | `535d15d` | backend-ready | usa columnas que YA existían → sin migración; **falta UI del panel** |

Las 5 filas = 5 commits; las "2" del título son las dos piezas del último commit (avatar
del panel + comprobante de caja) que quedaron **backend-ready sin UI** — el front del panel
todavía no las consume. Deploy `railway up` de los 3 servicios (exit 0 c/u), push
`15f641c..535d15d`, árbol limpio, smoke test OK (API/admin/app → 200). **Demo intacta /
ambos modos andan** en todo el batch. Detalle de endpoints y schema en `01-ARQUITECTURA.md`.

### Cacería sistemática 27/07 — ~75 hallazgos, **40 corregidos y deployados**

La pasada más grande hasta hoy. Método: **8 investigaciones de dominio en paralelo** +
**39 escépticos adversariales** (uno por hallazgo, con la consigna de *refutarlo*).
Después, **queries read-only contra prod** para separar *incendio activo* de *bomba
dormida* — esto cambió la prioridad de varios: p. ej. el doble cobro al co-propietario
era P0 por lógica, pero prod tiene **0 propiedades multi-dueño**, así que no había plata
mal hoy. Al revés, el borrado de archivos ajenos sí estaba activo.

**Aprendizajes de método (nuevos, valen para la próxima):**

- **Verificar contra prod ANTES de priorizar.** Sin ese paso, la lista ordena por
  gravedad teórica y se trabaja en el orden equivocado.
- **Re-verificar los hallazgos viejos contra el código de HOY.** De 31 pendientes,
  **30 seguían vivos, 1 ya estaba arreglado** por otra sesión, y **5 descripciones
  estaban mal**: una (`N5`) era **peor** que lo escrito; cuatro, más angostas. Un
  hallazgo sin re-verificar es una hipótesis, no un bug.
- **Verificar el comportamiento en prod, no el "deploy OK".** Un deploy exitoso no
  prueba nada: se chequeó allowlist de Soporte (200 en Tapia / 403 en otro tenant),
  el campo `excedente` nuevo, `GET /sociedades` con rol OPERADOR, `?token=[REDACTED]`
  en los logs y `pid=1` (que prueba que el `exec` del Dockerfile funciona).
- **Antes de culpar al código, descartar el entorno.** Dos "regresiones" no lo eran:
  una era **estado sucio en la DB de test** dejado por otra suite del mismo run, y otra
  un `node_modules` viejo. Se verifican con `git stash` (¿falla también SIN mi cambio?).
- **Cuando un test falla, la sospechosa #1 es la aserción.** Un test propio afirmaba
  "ningún mes nace VENCIDO"; con `diaPago:10` importando un 22, el mes corriente vence
  legítimamente. El código estaba bien; la aserción medía mal.

**Lo que salió de la cacería** (11 commits, todo en `main` y deployado): imputación de
reclamos unificada, tope por dueño en la rendición, anulación que ya no deja plata
varada, apagado ordenado del back, importación de cartera reanudable, borrado de
archivos sólo si quedan huérfanos, tokens redactados en logs, moneda en la caja,
permiso vigente del co-inquilino, totales por moneda. Tests nuevos: `deposito`,
`matching-bancario`, `importacion-reanudable`, + `rendicion-multiowner` 3→9.

**Único hallazgo NO cerrado** (es decisión, no código): `usuarios.email` sin `@unique`
global. Ojo — **no** confundir con el falso positivo de acá abajo: scopear el email
**por tenant** rompe el 2do tenant; lo que está en discusión es lo contrario, un mail =
una cuenta en toda la plataforma.

### Caza de REGRESIONES 28/07 — 14 confirmados sobre los fixes del día anterior

Pasada distinta a las demás: en vez de auditar el producto, auditó **los fixes recién
hechos**. 5 revisores de dominio + 2 escépticos por hallazgo con lentes distintos
(¿el código hace lo que dice? / ¿le pasa algo a un usuario real?), y sólo sobrevivía lo
que **ningún** lente refutaba. De ~14 candidatos quedaron 14 confirmados y **los 14 se
cerraron**.

**Por qué valió la pena:** 3 de los 14 eran regresiones directas de los fixes del día
anterior, incluida una que costaba plata — el tope por dueño en la rendición (`52c5699`)
evitaba el doble cobro a una persona pero **no** el sobre-cobro cuando cambia el reparto:
cada dueño nuevo de la propiedad se comía el arreglo entero, indefinidamente, porque los
reclamos no tienen estado terminal. Un fix sin auditar es una hipótesis.

**El patrón dominante (4 de 14): el arreglo existe y no llega a la pantalla.**
- El depósito de garantía corregido había quedado en la rama **demo** de
  `contrato/page.tsx` — la única que los inquilinos NO usan (Railway hornea
  `NEXT_PUBLIC_API_URL` → se renderiza `ContratoReal`). Y el mock no traía el campo, así
  que era código muerto en los DOS builds.
- `puedeAcusar` se agregó en el API y el front nunca lo leyó → botón muerto con 403 mudo.
- `PUT /me/avatar` llevaba semanas vivo sin un solo caller.
- `totalIngresos` viajaba desde el server y el mapper del panel lo tiraba.

**Regla nueva que salió de acá:** *nunca borrar del disco un archivo cuya URL vino en el
body de la request*. El predicado "¿sigue en uso?" se puede ampliar a todas las tablas
(y así está hoy, centralizado en `archivoSigueEnUso`), pero esa lista se pudre en
silencio con la próxima tabla que guarde archivos. En los demás borrados eso cuesta un
huérfano; en `/pagos/informar` costaba el documento de otra persona, porque es el único
lugar donde el atacante elige el archivo.

**Verificar que el test falla sin el fix.** En el bug de plata revertí el tope y confirmé
que el test daba "expected 300 to be close to 200". Un test que pasa antes y después no
protege nada.

**Lo que un escéptico salvó de ser mal arreglado:** el hallazgo P1 "el propietario no
cobra nunca más" era en realidad "cobra tarde, todo recuperable", y tenía una salida no
destructiva que el reporte no vio (cargar un ingreso extra destraba la rendición sin
borrar el gasto). Se arregló la información al operador, no la política — que es decisión
del dueño del producto.

## La tendencia (por qué seguir re-corriendo)

24 → 12 bugs entre pasadas: **el loop converge**. Cada ejecución encuentra menos y de
menor severidad, y **caza lo que la pasada anterior (o sus fixes) dejó**. La 3ra
regresión confirmó el valor: encontró **regresiones que introdujeron los fixes de la
v5** (ej: el `deleteMany` de inquilino al rechazar choca con FKs RESTRICT). Ningún fix
está libre de meter otro bug — por eso se re-corre.

## Falsos positivos conocidos (NO volver a "arreglar")

Verificados contra el código y descartados a propósito:

- **Scopear el email de `POST /usuarios` por tenant**: el login del panel busca el
  email **GLOBAL** a propósito → scopearlo rompería el 2do tenant.
- **Rendiciones "fuera de transacción"**: el lock atómico de gastos ya previene la
  corrupción real.
- **`tamanioBytes` requerido en `/boletas`**: el check de tamaño es client-side y el
  cliente reporta el valor → requerirlo no agrega seguridad real.

## Disciplina al aplicar (no negociable)

1. Leer el hallazgo, **abrir el archivo y trazar el flujo real**.
2. Confirmar que el bug existe y que el fix propuesto es correcto (los planes de
   síntesis a veces sub-analizan; ej. en la v5 el fix sugerido "desvincular contratoId"
   no alcanzaba — había que **borrar** el inquilino).
3. Distinguir bug de **decisión de negocio** (plata real / modelo de producto) →
   preguntar, no aplicar a ciegas.
4. Agrupar por archivo, **typecheck + build entre tandas**, commit con mensaje claro.
5. Deployar (`02-DEPLOY.md`) + smoke test.
