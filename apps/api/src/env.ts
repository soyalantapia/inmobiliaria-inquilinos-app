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
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(overrides: Partial<Record<string, string>> = {}): Env {
  return EnvSchema.parse({ ...process.env, ...overrides });
}
