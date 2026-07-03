import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import defaultDb from '../db.js';
import { parseSalesCsv } from '../connectors/salesCsvImport.js';
import { transformCsvOrder } from './transform.js';
import { upsertOrders } from './load.js';
import { runAttribution } from '../attribution/engine.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('etl:importSalesCsv');

const VALID_STATE_KEYWORDS = ['pedido de venta', 'bloqueado', 'sale', 'done', 'locked'];

// Si el CSV trae columna de estado, se descartan presupuestos/cancelados. Si no
// la trae (recomendado: filtrar en Odoo antes de exportar), se conservan todas
// las filas.
function isConfirmedRow(row) {
  if (!row.state) return true;
  const normalized = row.state.toLowerCase();
  return VALID_STATE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

// Los exports de Odoo a veces incluyen filas sueltas que no son pedidos reales
// -- por ejemplo notas de "Activities" con salto de linea que Odoo separa en
// su propia fila del CSV, sin Referencia ni Fecha. Sin este filtro, una sola
// fila asi tumbaba la importacion completa (Referencia/Fecha vacia rompe el
// insert en Postgres) en vez de solo omitirse.
function isRealOrderRow(row) {
  return Boolean(row.reference && row.dateOrder);
}

export async function importSalesCsvFile({ filePath, store, db = defaultDb, dryRun = false }) {
  if (!filePath) throw new Error('importSalesCsvFile requiere filePath');
  if (!store) throw new Error('importSalesCsvFile requiere store');

  const csvContent = await readFile(filePath, 'utf-8');
  const parsedRows = parseSalesCsv(csvContent);
  const skippedCount = parsedRows.filter((row) => !isRealOrderRow(row)).length;
  if (skippedCount > 0) {
    logger.info(`${skippedCount} fila(s) sin Referencia/Fecha omitida(s) (no son pedidos reales)`);
  }
  const rawRows = parsedRows.filter(isRealOrderRow).filter(isConfirmedRow);
  const orderRows = rawRows.map((row) => transformCsvOrder(row, store));

  if (dryRun) {
    logger.info(`DRY_RUN: ${orderRows.length} pedidos parseados de ${filePath} para store=${store} (sin escribir en BD)`);
    return { ordersCount: orderRows.length, dryRun: true };
  }

  const ordersCount = await upsertOrders(db, orderRows);
  await runAttribution({ db });

  logger.info(`Importados ${ordersCount} pedidos de ${filePath} para store=${store}`);
  return { ordersCount, dryRun: false };
}

function parseCliArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const { file, store, ['dry-run']: dryRunFlag } = parseCliArgs(process.argv.slice(2));
  if (!file || !store) {
    logger.error('Uso: npm run import:sales -- --file=./ventas.csv --store=bcn_kids [--dry-run=true]');
    process.exit(1);
  }

  importSalesCsvFile({ filePath: file, store, dryRun: dryRunFlag === 'true' })
    .then((result) => {
      logger.info('Importacion finalizada', result);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Importacion fallo', err);
      process.exit(1);
    });
}
