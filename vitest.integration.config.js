import { defineConfig } from 'vitest/config';

// Tests de integracion contra Postgres real (ver tests/api/queries.test.js).
// Requiere `npm run docker:up` + `npm run migrate` antes de correr.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.test.js'],
  },
});
