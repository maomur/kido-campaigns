import pg from 'pg';
import knexFactory from 'knex';
import knexConfig from '../../db/knexfile.js';

// pg parsea las columnas DATE (OID 1082) como Date en hora LOCAL del proceso,
// no UTC. new Date('2026-06-01').toISOString() en un servidor UTC+2 (ej.
// Espana/Luxemburgo) produce '2026-05-31', un dia atras. Se devuelve el
// string 'YYYY-MM-DD' tal cual, sin pasar por Date.
pg.types.setTypeParser(1082, (value) => value);

const environment = process.env.NODE_ENV || 'development';

const db = knexFactory(knexConfig[environment]);

export default db;
