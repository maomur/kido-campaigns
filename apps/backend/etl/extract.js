import { fetchAllStoresMetaInsights, parseAdAccountsMap } from '../connectors/metaAds.js';
import { fetchAllStoresGoogleAdsPerformance, parseCustomerAccountsMap, createGoogleAdsClient } from '../connectors/googleAds.js';
import { fetchNewOrders, createOdooClient, parseWebsiteStoreMap } from '../connectors/odoo.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('etl:extract');

function buildOdooClient() {
  return createOdooClient({
    url: process.env.ODOO_URL,
    db: process.env.ODOO_DB,
    username: process.env.ODOO_USERNAME,
    apiKey: process.env.ODOO_API_KEY,
  });
}

export async function extractAll({ since, until, lastSyncDates = {} }) {
  const adAccountsMap = parseAdAccountsMap(process.env.META_AD_ACCOUNTS);
  const customerAccountsMap = parseCustomerAccountsMap(process.env.GOOGLE_ADS_CUSTOMER_ACCOUNTS);
  const websiteStoreMap = parseWebsiteStoreMap(process.env.ODOO_WEBSITE_STORE_MAP);

  // El acceso de Odoo es solo storefront (Shopinvader), no backend/XML-RPC --
  // connectors/odoo.js siempre fallaria con "Not Found". Se deja apagado por
  // defecto para que el ETL automatico/manual no reporte un "error" en cada
  // corrida por algo que ya sabemos que no funciona; los pedidos siguen
  // entrando via CSV manual (npm run import:sales). Reactivar con
  // ODOO_LIVE_SYNC_ENABLED=true si en el futuro se consigue acceso real.
  const odooLiveSyncEnabled = process.env.ODOO_LIVE_SYNC_ENABLED === 'true';

  const [metaResult, googleResult, odooResult] = await Promise.allSettled([
    fetchAllStoresMetaInsights({ since, until, adAccountsMap }),
    fetchAllStoresGoogleAdsPerformance({
      since,
      until,
      customerAccountsMap,
      client: createGoogleAdsClient(),
    }),
    odooLiveSyncEnabled
      ? fetchNewOrders({ client: buildOdooClient(), lastSyncDate: lastSyncDates.odoo })
      : Promise.resolve([]),
  ]);

  const errors = [];
  if (metaResult.status === 'rejected') {
    logger.error('Fallo extrayendo Meta Ads', metaResult.reason);
    errors.push({ connector: 'meta', error: metaResult.reason });
  }
  if (googleResult.status === 'rejected') {
    logger.error('Fallo extrayendo Google Ads', googleResult.reason);
    errors.push({ connector: 'google', error: googleResult.reason });
  }
  if (odooLiveSyncEnabled && odooResult.status === 'rejected') {
    logger.error('Fallo extrayendo pedidos Odoo', odooResult.reason);
    errors.push({ connector: 'odoo', error: odooResult.reason });
  }

  return {
    metaRows: metaResult.status === 'fulfilled' ? metaResult.value : [],
    googleRows: googleResult.status === 'fulfilled' ? googleResult.value : [],
    odooOrders: odooResult.status === 'fulfilled' ? odooResult.value : [],
    websiteStoreMap,
    errors,
  };
}
