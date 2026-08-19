# Invariantes de plata — verificación post-merge (19/08)

Revisión de lectura sobre la rama ya unida. **Nada se ejecutó**: es código leído, no corrido.

## Resultado: los cinco invariantes están intactos

### 1. El prorrateo de parciales está espejado en TRES lugares y los tres coinciden

Es el más frágil: si una rama tocaba uno y no los otros, la plata dejaba de cerrar. Los tres
capean primero al total de la cuota (para que la mora no infle la porción de alquiler) y recién
después prorratean:

| Dónde | Fórmula |
|---|---|
| `lib/rendicion-pendiente.ts:77` | `Math.min(cobrado, liqTotal) * (liqAlq / liqTotal)` |
| `routes/plata.ts:1996` (rendición) | `Math.min(cobrado, total) * (montoAlquiler / total)` |
| `routes/plata.ts:270` (cierre de caja) | `Math.min(monto, liqTotal) * (liqAlq / liqTotal)` |

### 2. La comisión sale del ALQUILER, no del total

Se desprende de lo anterior: la comisión se calcula sobre `alquilerPortion`, que ya excluye
expensas y capea la mora. El comentario de `plata.ts:268` lo dice explícito.

### 3. Ningún camino le devenga alquiler a un `SOLO_EXPENSAS`

Se contaron **todas** las escrituras de `montoAlquiler` y cada una está cubierta:

| Camino | Cómo se protege |
|---|---|
| `computarLiquidacionesContrato` | `montoAlquilerSegunTipo` (`liquidaciones.ts:111`) |
| `recomputarLiquidacionesFuturas` | `montoAlquilerSegunTipo` (`liquidaciones.ts:387`) |
| `POST /contratos/:id/ajustar` | guard que corta con **409** antes de escribir (`core.ts:2122`) |
| `POST /contratos/:id/renovar` | `const canonNuevo = esSoloExpensas ? 0 : b.montoNuevo` (`core.ts:2256`) |
| `PATCH /contratos/:id/expensas` | no toca el alquiler: lo pasa de largo (`core.ts:3703`) |

### 4. Sin rutas de Fastify duplicadas

`grep` de todos los `app.get/post/patch/put/delete` de `routes/`: **cero paths repetidos**. Una
ruta duplicada hace que el server no arranque.

### 5. El enum del historial coincide de punta a punta

Los 9 valores de `TipoEventoContrato` del schema están declarados en el panel. Ninguno cae en
`undefined` en los mapas de color/label.

---

## Lo que SÍ apareció

**El defecto de T-33 está replicado en el camino de las expensas.** Ver T-33 en el documento de
tareas: son **dos** superficies (`recomputarLiquidacionesFuturas` y `recomputarExpensasFuturas`),
las dos con un caller que pide `_count: { select: { pagos: true } }` **sin filtrar por estado**.
Un pago `RECHAZADO` pesa igual que uno `CONCILIADO` y congela la cuota para siempre.

## Falsas alarmas que se persiguieron y NO lo eran

Se anotan para que nadie las vuelva a perseguir:

- **`basePath` inconsistente entre las dos apps del sitio estático.** No: las dos lo declaran en
  su `next.config.mjs`; la variable del script es redundante, no un hueco.
- **El picker linkea a `/presentacion/` y `build-static.sh` no crea esa carpeta.** La crea
  `build-landing.js`.
- **`moneda` no existe en `RendicionCreateInput`.** El schema **sí** lo tiene; era el cliente de
  Prisma generado antes del cambio. Un `prisma generate` y a 0.
