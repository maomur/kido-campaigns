import { pathToFileURL } from 'node:url';
import defaultDb from '../db.js';
import { extractAll } from './extract.js';
import { transformAll } from './transform.js';
import { upsertAdPerformance, upsertOrders, updateSyncLog } from './load.js';
import { runAttribution } from '../attribution/engine.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('etl:pipeline');

function defaultDateRange() {
  const until = new Date().toISOString().slice(0, 10);
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 1);
  const since = sinceDate.toISOString().slice(0, 10);
  return { since, until };
}

async function getLastSyncDate(db, connector) {
  const row = await db('sync_log').where({ connector }).first();
  if (row) return row.last_synced_at;
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - 30);
  return fallback.toISOString();
}

function connectorStatus(errors, connector) {
  return errors.some((e) => e.connector === connector) ? 'error' : 'success';
}

export async function runPipeline({ dryRun = process.env.DRY_RUN === 'true', db = defaultDb, since, until } = {}) {
  const dateRange = since && until ? { since, until } : defaultDateRange();
  const lastSyncDates = { odoo: dryRun ? null : await getLastSyncDate(db, 'odoo') };

  const { metaRows, googleRows, odooOrders, websiteStoreMap, errors } = await extractAll({
    since: dateRange.since,
    until: dateRange.until,
    lastSyncDates,
  });

  const { adPerformanceRows, orderRows } = transformAll({ metaRows, googleRows, odooOrders, websiteStoreMap });

  if (dryRun) {
    logger.info(
      `DRY_RUN: ${adPerformanceRows.length} filas de ad_performance, ${orderRows.length} pedidos (sin escribir en BD)`,
    );
    return { adPerformanceCount: adPerformanceRows.length, ordersCount: orderRows.length, errors, dryRun: true };
  }

  const adPerformanceCount = await upsertAdPerformance(db, adPerformanceRows);
  const ordersCount = await upsertOrders(db, orderRows);

  await updateSyncLog(db, { connector: 'meta', status: connectorStatus(errors, 'meta'), recordsProcessed: metaRows.length });
  await updateSyncLog(db, { connector: 'google', status: connectorStatus(errors, 'google'), recordsProcessed: googleRows.length });
  await updateSyncLog(db, { connector: 'odoo', status: connectorStatus(errors, 'odoo'), recordsProcessed: odooOrders.length });

  await runAttribution({ db });

  return { adPerformanceCount, ordersCount, errors, dryRun: false };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const cliDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  runPipeline({ dryRun: cliDryRun })
    .then((result) => {
      logger.info('Pipeline finalizado', result);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Pipeline fallo', err);
      process.exit(1);
    });
}
