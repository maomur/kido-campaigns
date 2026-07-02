import { createLogger } from '../utils/logger.js';
import { mockInsightsPageA, mockInsightsPageB } from '../../../tests/fixtures/metaAds.fixtures.js';

const logger = createLogger('connector:metaAds');

const API_VERSION = process.env.META_API_VERSION || 'v19.0';
// Codigos de error de Graph API asociados a rate limiting / throttling, o a
// fallos transitorios del lado de Meta (1 "Unknown error", 2 "Service
// temporarily unavailable") observados en consultas pesadas (rango de varios
// meses con time_increment=1). Meta recomienda reintentar todos estos.
const RATE_LIMIT_CODES = new Set([1, 2, 4, 17, 32, 613]);
const MAX_RETRIES = 3;

export function isDryRun() {
  return process.env.DRY_RUN === 'true';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchInsightsPage(url, fetchImpl, attempt = 1) {
  const response = await fetchImpl(url);
  const body = await response.json();

  if (body.error) {
    if (RATE_LIMIT_CODES.has(body.error.code) && attempt <= MAX_RETRIES) {
      const backoffMs = 2 ** attempt * 500;
      logger.warn(`Rate limit de Meta Ads (code ${body.error.code}), reintentando en ${backoffMs}ms`, {
        attempt,
      });
      await sleep(backoffMs);
      return fetchInsightsPage(url, fetchImpl, attempt + 1);
    }
    const err = new Error(`Meta Ads API error: ${body.error.message}`);
    err.code = body.error.code;
    throw err;
  }

  return body;
}

export async function fetchMetaInsights({
  adAccountId,
  since,
  until,
  level = 'campaign',
  fetchImpl = fetch,
  dryRun = isDryRun(),
}) {
  if (dryRun) {
    logger.info(`DRY_RUN activo, devolviendo fixtures para adAccountId=${adAccountId}`);
    return [...mockInsightsPageA.data, ...mockInsightsPageB.data];
  }

  const baseUrl = new URL(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights`);
  baseUrl.searchParams.set(
    'fields',
    'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,actions,action_values',
  );
  baseUrl.searchParams.set('time_range', JSON.stringify({ since, until }));
  baseUrl.searchParams.set('level', level);
  // Sin esto, Meta devuelve una unica fila agregando todo el rango de fechas
  // (date_start=since, date_stop=until) en vez de una fila por dia, lo cual
  // hace inutil cualquier serie temporal diaria.
  baseUrl.searchParams.set('time_increment', '1');
  baseUrl.searchParams.set('access_token', process.env.META_ACCESS_TOKEN);

  const rows = [];
  let nextUrl = baseUrl.toString();

  while (nextUrl) {
    const page = await fetchInsightsPage(nextUrl, fetchImpl);
    rows.push(...(page.data || []));
    nextUrl = page.paging?.next || null;
  }

  return rows;
}

// Formato env: store_key:ad_account_id, separado por comas.
export function parseAdAccountsMap(envValue) {
  if (!envValue) return {};
  return Object.fromEntries(envValue.split(',').map((pair) => pair.trim().split(':')));
}

export async function fetchAllStoresMetaInsights({ since, until, adAccountsMap, fetchImpl = fetch }) {
  const stores = Object.entries(adAccountsMap);
  const settled = await Promise.allSettled(
    stores.map(async ([store, adAccountId]) => {
      const rows = await fetchMetaInsights({ adAccountId, since, until, fetchImpl });
      return rows.map((row) => ({ ...row, store }));
    }),
  );

  // Promise.allSettled (no Promise.all): el fallo en una tienda no debe
  // descartar los datos ya obtenidos de las demas.
  const rows = [];
  settled.forEach((result, index) => {
    const [store] = stores[index];
    if (result.status === 'fulfilled') {
      rows.push(...result.value);
    } else {
      logger.error(`Fallo extrayendo Meta Ads para store=${store}`, result.reason);
    }
  });
  return rows;
}
