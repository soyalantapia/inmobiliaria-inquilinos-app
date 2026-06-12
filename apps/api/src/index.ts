import { buildApp } from './app.js';

const app = await buildApp();

try {
  await app.listen({ port: app.env.PORT, host: '0.0.0.0' });
  app.log.info(`My Alquiler API escuchando en :${app.env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
