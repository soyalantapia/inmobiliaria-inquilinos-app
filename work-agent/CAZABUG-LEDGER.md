# CAZABUG — Ledger

> Barrido de **PLATA** del backend de My Alquiler. Rama `fix/cazabug-v2`, rebasada sobre
> `origin/main` (52c5699). Objetivo: mergear a main.

## ⚠️ Reconciliación con main (leer antes de tocar nada)
Mientras corría esta pasada, **otras sesiones cazaron varios de los mismos bugs** y los
mergearon a main. Se rearmó la rama desde `origin/main` y se descartaron los duplicados:

| Causa | Estado |
|---|---|
| saldar-deuda sin lock (doble-cobro) | **ya en main** (`c27496f`) — mismo enfoque: FOR UPDATE + re-aggregate |
| extracto: xlsx coacciona monto/fecha | **ya en main** (`c27496f`) — `raw:true` + `parsearMonto` |
| depósito capeado contra el bruto | **ya en main** (`afb9efe`) |
| rendición: co-dueño cobrado dos veces | **ya en main** (`52c5699`) |
| contratos importados devengan deuda falsa | **ya en main** (`8743e78`, campo `devengarDesde`) |
| pago de conciliación con `tipo: TOTAL` siendo parcial | **ya en main** (ahora condicional a `cubierta`) |

Mis tests de esas causas **se conservaron igual**: pasan a ser la auditoría que valida las
implementaciones de main y las blinda contra regresiones.

## Causas cerradas en esta rama

| # | Commit | Causa raíz | Test |
|---|---|---|---|
| P3 | `a48231f` | monto de pago sin redondear → sub-centavo fantasma / drift | pago-monto-centavos (3) |
| D | `d80eec6` | finalizar no anula la cuota futura con pago RECHAZADO (FK RESTRICT → 500) | finalizar-cuota-rechazada (3) |
| E | `38e0776` | /listo imputa sin el guard anti-doble-cobro que sí tiene /resolver | imputar-reclamo-ya-rendido (2) |
| F | `d339c6e` | devengo sin canon por período → vigencia futura cobra los meses intermedios al canon nuevo | canon-por-periodo (7) |
| G2 | `0c22c64` | la cartera tenía su propio parser de montos: locale US entraba 1000x más chico | monto-ar (7) + extracto-csv-parseo (4) |
| H | `03f7400` | confirmar importación sin lock atómico → un reintento duplica la cartera entera | — (necesita DB) |
| I | `c115ced` | dedup de importación sólo por email (opcional) → re-subir duplica todo | import-dedup-direccion (6) |
| J | `10dd562` | extractos solapados duplican créditos · conciliación sin control de moneda (ARS salda USD 1:1) | — (necesita DB) |
| H2 | `847e334` | el panel mostraba el total ya truncado por MAX_FILAS | — (UI) |

## Trampas encontradas (el fix "obvio" habría roto algo)
- **D**: FK `Pago→Liquidacion` = ON DELETE RESTRICT → hay que soltar los pagos muertos ANTES
  de borrar la cuota; cambiar sólo el filtro daba 500. `CreditoDetectado.pagoId` es SET NULL.
- **F**: `PATCH /contratos/:id/monto` cambia el canon **sin dejar fila de ajuste**. La regla
  intuitiva ("manda el último ajuste") habría revertido ese cambio en silencio. Por eso
  `contrato.monto` es la autoridad y las vigencias sólo retroceden los meses previos.
- **F (producto)**: el primer fix bloqueaba la vigencia futura con 400, pero **renovar por
  adelantado es el flujo normal** (el default del panel es el mes siguiente al fin del
  contrato). Se decidió con el usuario reemplazarlo por el motor de canon por período.
- **J**: `nroOperacion` NO sirve solo como clave de dedup: si el extracto no trae esa
  columna, el parser usa el índice de fila. Se compara la línea entera.
- **J**: el dedup NO puede ser silencioso → se informa `creditosDuplicados` en la respuesta
  y en el panel; si no, el operador cree que el banco exportó de menos.

## Pendiente NO resuelto (decisión de producto)
- **[P2] Rendición multi-moneda sin salida**: un propietario con contratos en ARS y USD
  recibe 409 y no se puede rendir nunca (la Rendicion guarda un solo monto/moneda). El
  mensaje es explícito y el modelo de plata está LOCKED, así que soportarlo es una feature
  (rendición por moneda), no un fix. Queda anotado para decidir.

## Verificación
- Gate por commit: `tsc --noEmit` 0 errores en **api y panel**, `tsup build` OK.
- Tests puros (sin DB, instantáneos): canon-por-periodo (7), monto-ar (7),
  extracto-csv-parseo (4), import-dedup-direccion (6), liquidaciones (18).
- Tests con DB que auditan los fixes de main: saldar-deuda-concurrencia,
  deposito-cap-disponible, rendicion-reclamo-multiduenio, pago-monto-centavos,
  finalizar-cuota-rechazada, imputar-reclamo-ya-rendido.

⚠️ **La DB de test es COMPARTIDA entre sesiones.** `core.test.ts` afirma conteos exactos
del seed y falla cada vez que otra sesión deja datos (se vio una propiedad extra, 2
inquilinos de más y `own_001` renombrado a "Repro"). También aparecieron 401 de login y un
"Can't reach database server" de Railway. Cada file re-corrido aislado pasa.

## Falsos positivos (NO tocar)
email global de /usuarios · rendiciones "fuera de tx" · tamanioBytes en /boletas ·
PIN eliminado de la plataforma (`verificarPin` devuelve `{ok:true}`).
