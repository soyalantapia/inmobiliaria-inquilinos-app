# CAZABUG — Ledger

> Foco de esta pasada: **PLATA** (backend). Rama `fix/cazabug-plata` (worktree
> `~/dev/myalq-cazabug`, off origin/main). **Sin push/deploy** (esperando OK del usuario).
> 7 causas cerradas: 1 causa/commit, test rojo→verde, gate tsc+build por commit.

| Sección | Estado | Hallazgos cerrados |
|---|---|---|
| pagos / plata.ts | ✅ limpia | P3 centavos · A saldar-deuda TOCTOU |
| caja | ✅ limpia | P3 cubre /caja/movimientos |
| liquidaciones / devengo | ✅ limpia | F ajuste/renovación vigencia futura |
| rendiciones | ✅ limpia | B reclamo multi-dueño dedup por dueño |
| depositos | ✅ limpia | C cap contra disponible (no bruto) |
| contratos (alta/baja) | ✅ limpia | D finalizar+pago RECHAZADO |
| reclamos (quién paga) | ✅ limpia | E guard doble-cobro en el helper |
| import cartera | 🟡 parcial | G parseo de monto US ✅ · quedan idempotencia/dedup |
| resúmenes bancarios | 🟡 parcial | G parseo CSV AR (monto+fecha) ✅ · queda dedup de créditos |

## Commits (rama fix/cazabug-plata, off origin/main 5208527)

| # | Commit | Causa raíz (1 línea) | Test |
|---|---|---|---|
| P3 | `c73387d` | monto de pago sin redondear → sub-centavo fantasma / drift | pago-monto-centavos (3) |
| D | `ec31f77` | finalizar no anula cuota futura con pago RECHAZADO (FK RESTRICT 500) | finalizar-cuota-rechazada (3) |
| A | `d65bebb` | saldar-deuda lee la suma fuera de la tx → doble Pago CONCILIADO | saldar-deuda-concurrencia (1) |
| C | `a66f547` | depósito capea contra el bruto, ignora deducciones contraDeposito | deposito-cap-disponible (2) |
| F | `fedf6ab` | ajustar/renovar bumpean monto ya → meses intermedios al canon nuevo | ajuste-renovar-vigencia-futura (2) |
| B | `5b3f6f9` | rendición reclamo: dedup binario global excluye al co-dueño | rendicion-reclamo-multiduenio (3) |
| E | `bce6a24` | /listo imputa sin el guard anti-doble-cobro que tiene /resolver | imputar-reclamo-ya-rendido (2) |
| G | `79085f5` | extracto CSV: xlsx coacciona (monto ÷1000, fecha mm/dd) + normalizador borra la coma decimal (×100) | monto-ar (7) + extracto-csv-parseo (4) |
| F v2 | `deef2fe` | devengo sin canon por período → vigencia futura cobra los meses intermedios al canon nuevo | canon-por-periodo (7) |

### Nota sobre F: el guard fue REEMPLAZADO por el fix de causa raíz
`fedf6ab` bloqueaba la vigencia futura con 400. Al revisar el panel apareció que **renovar por
adelantado es el flujo normal** (el default de `montoDesde` es el mes siguiente al fin del contrato),
así que el guard era una regresión de producto. Decidido con el usuario → `deef2fe` implementa el
canon por período y **quita** el bloqueo. `contrato.monto` sigue siendo la autoridad porque el ajuste
masivo `PATCH /contratos/:id/monto` lo pisa sin dejar fila de ajuste.

## Trampas encontradas (blast radius que el fix "obvio" habría reventado)
- **D**: FK `Pago→Liquidacion` = ON DELETE RESTRICT → hubo que soltar los pagos muertos ANTES de borrar la cuota (el cambio de filtro solo daba 500). `CreditoDetectado.pagoId` = SET NULL (soltar el pago es seguro).
- **A**: `pg_advisory_xact_lock` necesita `$executeRaw` (no `$queryRaw` → 500). Resuelto con FOR UPDATE per-liq (patrón /pagos/manual). El índice único de Pago sólo cubre INFORMADO.
- **C**: match exacto de la semántica de /depositos/en-custodia (no filtrar moneda/saldadoAt).
- **F**: NO borrar/recrear liquidaciones (FK RESTRICT); guard de input, umbral = mes próximo (no "cualquier futuro", que rompería el ajuste legítimo del mes que viene).
- **B**: NO agregar @@unique(refId) a GastoRendido (rompe multi-dueño); dedup por (dueño, reclamo) via `rendicion: { propietarioId }`.
- **E**: /listo NO tenía try/catch → un throw del helper daría 500; se agregó el catch → 409. Solo 2 callers del helper, ambos cubiertos.

## Pendientes CONFIRMADOS (cazados y verificados, todavía SIN fixear)
De la pasada sobre import/resúmenes salieron 25 hallazgos que, deduplicados, dejan estas causas abiertas:
- **[P1] Confirmar importación de cartera no es idempotente** — el estado pasa a CONFIRMADO recién al final
  del loop: un reintento o dos pestañas duplican la cartera entera (`importaciones-cartera.ts:149-152`).
- **[P1] Reimportar el mismo archivo duplica todo** — el dedup mira sólo el email y las filas sin email
  están explícitamente permitidas.
- **[P1] Re-subir un extracto solapado duplica los créditos** — no hay dedup por operación, así que la
  MISMA transferencia se puede conciliar dos veces contra dos liquidaciones distintas.
- **[P2] Conciliación sin control de MONEDA** — un crédito en pesos salda una liquidación en USD.
- **[P2] Rendición multi-moneda: 409 sin salida** — el propietario con contratos ARS y USD no se puede
  rendir nunca (y la inmobiliaria no realiza su comisión).
- **[P2] MAX_FILAS trunca el archivo en silencio** · **[P2] contratos ya vencidos se importan ACTIVO y
  nacen con deuda falsa del mes** · **[P3] el pago nacido de conciliación queda `tipo: TOTAL` aunque sea parcial**.

## Resultado de la regresión final (10 files)
**9/10 files verdes, 75 tests.** Los fixes no rompieron nada.
- `core.test.ts` falla 3 asserts que cuentan filas del seed (`propiedades → 6`, `inquilinos → 7`,
  `propietarios de prp_001 = [Castro, Morales]`). Es **ruido de la DB de test COMPARTIDA**, no código:
  al inspeccionarla hay una propiedad extra con id cuid (creada por API, no por el seed), 2 inquilinos
  de más, y `own_001` renombrado a "Eduardo **Repro**" por otra sesión. Ninguno de los tests de esta
  rama crea propiedades/inquilinos ni renombra propietarios (todos los fixtures son `ZZ-cazabug-*` y se
  limpian en afterAll). No se tocaron esos datos ajenos.
- En corridas anteriores hubo además 401 de login y un "Can't reach database server" (Railway): mismo
  origen ambiental. Cada file re-corrido aislado pasa.

⚠️ **Para el que siga:** `core.test.ts` es frágil por diseño (asserts sobre conteos exactos del seed) y
va a fallar cada vez que otra sesión deje datos en la DB compartida.

## Verificación (Fase 6)
- Cada fix: test rojo antes / verde después + `tsc --noEmit` 0 errores + `tsup build` OK.
- A y B: red-before empírico (stash del fix → el test falla como se espera).
- Regresión: suite de los 8 files que tocan plata.ts/core.ts/imputar-reclamo/operacion/visitas-publicas.

## Falsos positivos (NO tocar): email global de /usuarios · rendiciones "fuera de tx" · tamanioBytes en /boletas · PIN eliminado (verificarPin={ok:true})
