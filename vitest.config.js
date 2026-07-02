import { defineConfig } from 'vitest/config';

// tests/api/** son de integracion (requieren Postgres real via `npm run
// docker:up` + `npm run migrate`) -- se excluyen de `npm test` para que la
// suite por defecto siga corriendo sin Docker. Se ejecutan aparte con
// `npm run test:integration`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js', 'apps/**/*.test.js'],
    exclude: ['node_modules/**', 'tests/api/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
