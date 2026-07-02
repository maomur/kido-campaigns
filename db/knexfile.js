import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// El CLI de Knex cambia el cwd al directorio de knexfile.js antes de ejecutar,
// asi que dotenv/config (que lee desde process.cwd()) no encuentra el .env de
// la raiz del repo. Se resuelve la ruta explicitamente en base a este archivo.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

export default {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
    seeds: { directory: './seeds' },
  },
  test: {
    client: 'pg',
    connection: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
  },
};
