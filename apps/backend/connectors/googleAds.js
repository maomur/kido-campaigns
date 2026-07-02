import { GoogleAdsApi } from 'google-ads-api';
import { createLogger } from '../utils/logger.js';
import { mockGaqlCampaignRows } from '../../../tests/fixtures/googleAds.fixtures.js';

const logger = createLogger('connector:googleAds');

export function isDryRun() {
  return process.env.DRY_RUN === 'true';
}

export function createGoogleAdsClient({
  clientId = process.env.GOOGLE_ADS_CLIENT_ID,
  clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET,
  developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
} = {}) {
  return new GoogleAdsApi({ client_id: clientId, client_secret: clientSecret, developer_token: developerToken });
}

function buildGaqlQuery(since, until) {
  return `
    SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
           ad_group_ad.ad.id, ad_group_ad.ad.name,
           metrics.cost_micros, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.conversions_value, segments.date
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `;
}

export async function fetchGoogleAdsPerformance({
  customerId,
  since,
  until,
  client,
  loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN,
  dryRun = isDryRun(),
}) {
  if (dryRun) {
    logger.info(`DRY_RUN activo, devolviendo fixtures para customerId=${customerId}`);
    return mockGaqlCampaignRows;
  }

  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: loginCustomerId,
    refresh_token: refreshToken,
  });

  return customer.query(buildGaqlQuery(since, until));
}

// Formato env: store_key:customer_id, separado por comas.
export function parseCustomerAccountsMap(envValue) {
  if (!envValue) return {};
  return Object.fromEntries(envValue.split(',').map((pair) => pair.trim().split(':')));
}

export async function fetchAllStoresGoogleAdsPerformance({ since, until, customerAccountsMap, client }) {
  const stores = Object.entries(customerAccountsMap);
  const settled = await Promise.allSettled(
    stores.map(async ([store, customerId]) => {
      const rows = await fetchGoogleAdsPerformance({ customerId, since, until, client });
      return rows.map((row) => ({ ...row, store }));
    }),
  );

  // Promise.allSettled (no Promise.all): el fallo en una cuenta/tienda no
  // debe descartar los datos ya obtenidos de las demas.
  const rows = [];
  settled.forEach((result, index) => {
    const [store] = stores[index];
    if (result.status === 'fulfilled') {
      rows.push(...result.value);
    } else {
      logger.error(`Fallo extrayendo Google Ads para store=${store}`, result.reason);
    }
  });
  return rows;
}
