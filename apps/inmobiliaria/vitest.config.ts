import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Runner de tests del front (T-32).
 *
 * Hasta ahora los tres fronts tenían archivos `*.test.ts` que NO los corría nadie: ni `vitest`,
 * ni config, ni tarea `test` en `turbo.json`. Eran cuatro archivos escritos de buena fe que
 * pasaban por verdes sin haberse ejecutado nunca — peor que no tenerlos, porque daban una
 * sensación de cobertura que no existía.
 *
 * `environment: 'node'` a propósito: lo que hay para testear acá es LÓGICA PURA (saldos,
 * períodos, formatos, coherencia de datos demo), no componentes. Un jsdom trae un árbol de
 * dependencias y una clase entera de flakiness para algo que hoy nadie necesita. El día que haya
 * que testear un componente, se agrega — y ahí sí se justifica.
 *
 * Los tests viven al lado del código (`src/**`) y no en un `test/` aparte como en la API: son de
 * funciones puras y tenerlos pegados al archivo que prueban hace más probable que alguien los
 * actualice cuando toca esa función.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      // Mismo alias que el tsconfig del app. Sin esto, cualquier test que importe con `@/…`
      // —o cualquier módulo que el test arrastre— falla al resolver.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
