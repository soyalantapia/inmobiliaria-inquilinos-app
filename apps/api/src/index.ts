import { buildApp } from './app.js';
import { iniciarCronDevengo } from './cron.js';
import { prisma } from './db.js';

const app = await buildApp();

try {
  await app.listen({ port: app.env.PORT, host: '0.0.0.0' });
  app.log.info(`My Alquiler API escuchando en :${app.env.PORT}`);
  // Devengo periódico de liquidaciones (in-process, idempotente).
  iniciarCronDevengo(app);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

/**
 * APAGADO ORDENADO. Antes no existía: cada redeploy (y son frecuentes) mataba el proceso en
 * seco y los requests en vuelo se cortaban SIN respuesta. Lo que estaba dentro de un
 * `$transaction` revierte solo, pero el operador no sabía si su acción se aplicó y
 * reintentaba a ciegas — con un pago o una rendición, eso es plata.
 *
 * `app.close()` deja de aceptar conexiones nuevas y espera a que terminen las en curso;
 * después soltamos la conexión a la DB. El timeout de gracia evita colgarse para siempre si
 * un request no cierra: Railway manda SIGKILL a los ~30s, así que salimos antes por las
 * nuestras y dejando un log que lo explique.
 *
 * OJO: para que esto sirva, el proceso tiene que RECIBIR la señal. El CMD del Dockerfile usa
 * `exec node …` justamente por eso — sin `exec`, node queda como hijo de `sh` y el shell se
 * come la señal.
 */
const GRACIA_MS = 12_000;
let cerrando = false;

async function apagar(senal: string): Promise<void> {
  if (cerrando) return; // SIGTERM + SIGINT juntos no deben cerrar dos veces
  cerrando = true;
  app.log.info(`[shutdown] ${senal} recibido — drenando requests en vuelo`);

  const forzar = setTimeout(() => {
    app.log.error(`[shutdown] no terminó en ${GRACIA_MS}ms — saliendo igual`);
    process.exit(1);
  }, GRACIA_MS);
  forzar.unref?.();

  try {
    await app.close();
    await prisma.$disconnect();
    app.log.info('[shutdown] listo');
    process.exit(0);
  } catch (err) {
    app.log.error(err, '[shutdown] falló el cierre ordenado');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void apagar('SIGTERM'));
process.on('SIGINT', () => void apagar('SIGINT'));

// Una promesa sin catch tumbaba el proceso sin dejar rastro de qué la causó (Node mata por
// unhandledRejection). La logueamos y seguimos: el error handler global ya contiene los
// fallos por request, así que un rejection suelto no debería voltear la API de TODAS las
// inmobiliarias.
process.on('unhandledRejection', (razon) => {
  app.log.error({ err: razon }, '[proceso] unhandledRejection');
});
process.on('uncaughtException', (err) => {
  // Acá el estado del proceso ya no es confiable: logueamos y cerramos ordenado para que
  // Railway levante una instancia limpia, en vez de seguir sirviendo con memoria dudosa.
  app.log.error({ err }, '[proceso] uncaughtException — cerrando');
  void apagar('uncaughtException');
});
