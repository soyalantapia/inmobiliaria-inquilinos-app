# Auditorías — historia y metodología

## El prompt reutilizable

`AUDITORIA-PROFUNDA-PROMPT.md` (raíz del repo) es la herramienta central. Encapsula:

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
| **3ra regresión** | ~20 (15 únicos) | **0 (PENDIENTE)** | síntesis cortada por límite de sesión → ver `04-PENDIENTES.md` |

**Total ~50 bugs reales arreglados** + 3 decisiones de negocio.

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
