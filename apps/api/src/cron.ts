import type { FastifyInstance } from 'fastify';
import { prisma } from './db.js';
import { devengarTodosLosTenants } from './lib/liquidaciones.js';

const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
const ARRANQUE_MS = 30 * 1000;

/**
 * Scheduler in-process del devengo de liquidaciones. El back está SIEMPRE
 * corriendo en Railway → no hace falta una infra de cron aparte. Cada 6h (y una
 * vez ~30s después de arrancar) hace top-up de las liquidaciones de todos los
 * contratos ACTIVO de todas las inmobiliarias.
 *
 * Por qué hace falta: computarLiquidacionesContrato genera hasta "el mes que
 * viene inclusive"; sin un disparo periódico, cada contrato se queda sin
 * liquidaciones a partir del 2º mes y no hay nada que cobrar.
 *
 * Es IDEMPOTENTE (createMany skipDuplicates sobre @@unique([contratoId,periodo]))
 * → repetir o correr en dos réplicas a la vez no duplica nada. Se apaga con
 * CRON_DEVENGO=off.
 */
export function iniciarCronDevengo(app: FastifyInstance): void {
  if (process.env.CRON_DEVENGO === 'off') {
    app.log.info('[cron] devengo deshabilitado (CRON_DEVENGO=off)');
    return;
  }
  const correr = async (): Promise<void> => {
    try {
      const r = await devengarTodosLosTenants(prisma);
      app.log.info(r, '[cron] devengo global ejecutado');
    } catch (err) {
      app.log.error(err, '[cron] devengo global falló');
    }
  };
  // Primer disparo poco después de levantar (deja la conexión a la DB lista).
  const t0 = setTimeout(() => void correr(), ARRANQUE_MS);
  const tN = setInterval(() => void correr(), SEIS_HORAS_MS);
  // No mantener vivo el proceso solo por estos timers.
  t0.unref?.();
  tN.unref?.();
  app.log.info('[cron] devengo programado (cada 6h)');
}
