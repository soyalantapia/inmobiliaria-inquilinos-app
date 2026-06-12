import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Las suites comparten la DB de test (schema "test") → sin paralelismo entre archivos
    fileParallelism: false,
    testTimeout: 60_000,
    // seedBase corre en beforeAll contra la DB remota (Railway) — necesita aire
    hookTimeout: 420_000,
  },
});
