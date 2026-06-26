import { buildApp } from './app.js';
import { iniciarCronDevengo } from './cron.js';

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
