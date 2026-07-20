import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Carga explícita de apps/api/.env (sin dep de dotenv). En Railway no existe el
// archivo y las vars vienen del entorno — este paso es no-op.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2] ?? '';
    }
  }
}

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(3002),
  DEMO_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,https://soyalantapia.github.io')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Fin del acceso gratis pre-lanzamiento (la usa /auth/registro). Si está seteada,
  // tiene que ser una fecha parseable → una basura falla en el ARRANQUE con mensaje
  // claro, en vez de un 500 silencioso al registrarse. Lenient: ISO con o sin hora.
  FECHA_LANZAMIENTO: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'FECHA_LANZAMIENTO no es una fecha válida')
    .optional(),
  // Operativas: declaradas acá para documentar el contrato de entorno en un solo
  // lugar y completar el tipo Env. (Hoy sus consumidores —mailer/cron/uploads/plata—
  // las leen vía process.env; migrarlos a app.env para atrapar typos en runtime es
  // un follow-up.) Todas opcionales: el código ya tiene defaults razonables.
  CRON_SECRET: z.string().optional(),
  CRON_DEVENGO: z.string().optional(),
  // Sonar (error-reporting): proxy server-a-server para la vista Soporte del admin.
  // Todas opcionales: si no están seteadas, /api/soporte/config devuelve { configured: false }.
  // .url() como el resto: una URL mal escrita falla en el ARRANQUE con mensaje claro,
  // en vez de convertirse en un 502 confuso la primera vez que alguien abre Soporte.
  SONAR_API_URL: z.string().url().optional(),
  SONAR_LOGIN_EMAIL: z.string().optional(),
  SONAR_LOGIN_SECRET: z.string().optional(),
  SONAR_PROJECT_ID: z.string().optional(),
  UPLOADS_DIR: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(overrides: Partial<Record<string, string>> = {}): Env {
  return EnvSchema.parse({ ...process.env, ...overrides });
}
