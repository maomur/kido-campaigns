import { createLogger } from '../utils/logger.js';

const logger = createLogger('etl:load');

export async function upsertAdPerformance(db, rows) {
  if (rows.length === 0) return 0;
  await db('ad_performance')
    .insert(rows)
    .onConflict(['platform', 'store', 'campaign_id', 'adset_id', 'ad_id', 'date'])
    .merge();
  logger.info(`Upsert de ${rows.length} filas en ad_performance`);
  return rows.length;
}

export async function upsertOrders(db, rows) {
  if (rows.length === 0) return 0;
  // (store, odoo_name) en vez de odoo_id: la importacion via CSV (ver
  // connectors/salesCsvImport.js) no trae el ID interno de Odoo, pero la
  // referencia del pedido siempre esta presente en cualquier fuente.
  await db('orders').insert(rows).onConflict(['store', 'odoo_name']).merge();
  logger.info(`Upsert de ${rows.length} filas en orders`);
  return rows.length;
}

export async function updateSyncLog(db, { connector, store = null, status, recordsProcessed = 0, errorMessage = null }) {
  await db('sync_log')
    .insert({
      connector,
      store,
      status,
      records_processed: recordsProcessed,
      error_message: errorMessage,
      last_synced_at: db.fn.now(),
    })
    .onConflict(['connector', 'store'])
    .merge();
  logger.info(`sync_log actualizado para connector=${connector} store=${store} status=${status}`);
}
