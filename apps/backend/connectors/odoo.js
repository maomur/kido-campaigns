import xmlrpcDefault from 'xmlrpc';
import { createLogger } from '../utils/logger.js';
import { mockSaleOrders } from '../../../tests/fixtures/odoo.fixtures.js';

const logger = createLogger('connector:odoo');

const ORDER_FIELDS = [
  'id',
  'name',
  'date_order',
  'amount_total',
  'state',
  'website_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
];

export function isDryRun() {
  return process.env.DRY_RUN === 'true';
}

function promisifyMethodCall(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

export function createOdooClient({ url, db, username, apiKey, xmlrpcImpl = xmlrpcDefault }) {
  const commonClient = xmlrpcImpl.createClient({ url: `${url}/xmlrpc/2/common` });
  const objectClient = xmlrpcImpl.createClient({ url: `${url}/xmlrpc/2/object` });
  let uid = null;

  async function authenticate() {
    if (uid) return uid;
    uid = await promisifyMethodCall(commonClient, 'authenticate', [db, username, apiKey, {}]);
    if (!uid) throw new Error('Odoo authentication failed: invalid credentials');
    return uid;
  }

  async function searchRead(model, domain, fields) {
    const authenticatedUid = await authenticate();
    return promisifyMethodCall(objectClient, 'execute_kw', [
      db,
      authenticatedUid,
      apiKey,
      model,
      'search_read',
      [domain],
      { fields },
    ]);
  }

  return { authenticate, searchRead };
}

// website_id llega como tupla many2one [id, display_name] desde search_read.
export function parseWebsiteStoreMap(envValue) {
  if (!envValue) return {};
  return Object.fromEntries(
    envValue
      .split(',')
      .map((pair) => pair.trim().split(':'))
      .filter(([websiteId]) => websiteId),
  );
}

export function mapWebsiteIdToStore(websiteId, storeMap) {
  if (!websiteId) return 'unknown';
  const id = Array.isArray(websiteId) ? websiteId[0] : websiteId;
  const store = storeMap[String(id)];
  if (!store) {
    logger.warn(`website_id=${id} no mapeado en ODOO_WEBSITE_STORE_MAP`);
    return 'unknown';
  }
  return store;
}

export async function fetchNewOrders({ client, lastSyncDate, dryRun = isDryRun() }) {
  if (dryRun) {
    logger.info('DRY_RUN activo, devolviendo fixtures de pedidos Odoo');
    return mockSaleOrders;
  }

  const domain = [
    ['state', 'in', ['sale', 'done']],
    ['date_order', '>=', lastSyncDate],
  ];

  logger.info(`Buscando pedidos nuevos desde ${lastSyncDate}`);
  return client.searchRead('sale.order', domain, ORDER_FIELDS);
}
