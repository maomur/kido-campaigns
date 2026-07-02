import {
  calculateROAS,
  calculateCPA,
  calculateAOV,
  calculateCTR,
  calculateCPC,
  calculateCPM,
  calculateFrequency,
  calculateConversionRate,
} from '../utils/kpis.js';

// Unico modelo de atribucion usado hoy (ver attribution/engine.js). Se filtra
// explicitamente en vez de confiar en que solo exista una fila por pedido: si
// en el futuro se agrega otro modelo, un JOIN orders->attribution sin este
// filtro contaria el mismo pedido una vez por modelo, inflando ingresos.
const ATTRIBUTION_MODEL = 'last_click';

export function resolveDateRange({ from, to } = {}) {
  const resolvedTo = to || new Date().toISOString().slice(0, 10);
  const fallbackFrom = new Date(resolvedTo);
  fallbackFrom.setDate(fallbackFrom.getDate() - 30);
  const resolvedFrom = from || fallbackFrom.toISOString().slice(0, 10);
  return { from: resolvedFrom, to: resolvedTo };
}

// Postgres devuelve columnas DATE como objetos Date (medianoche UTC); se
// formatean a 'YYYY-MM-DD' para que combinen de forma consistente entre
// ad_performance.date (DATE) y date(orders.date_order) (TIMESTAMP truncado).
function formatDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// Pedidos con fila de atribucion (last_click), unidos a su pedido. El join a
// ad_performance solo se agrega si hace falta filtrar por plataforma -- el
// filtro de tienda se resuelve directo sobre orders.store, sin join.
function buildAttributedOrdersQuery(db, { store, platform, from, to }) {
  const query = db('attribution')
    .join('orders', 'orders.id', 'attribution.order_id')
    .whereBetween('orders.date_order', [from, to])
    .andWhere('attribution.model', ATTRIBUTION_MODEL);
  if (store) query.andWhere('orders.store', store);
  if (platform) {
    query.join('ad_performance', 'ad_performance.id', 'attribution.ad_performance_id').andWhere('ad_performance.platform', platform);
  }
  return query;
}

export async function getSummaryKpis(db, { store, platform, from, to }) {
  const spendQuery = db('ad_performance').whereBetween('date', [from, to]);
  if (store) spendQuery.andWhere({ store });
  if (platform) spendQuery.andWhere({ platform });
  const spendRow = await spendQuery
    .sum({ spend: 'spend' })
    .sum({ impressions: 'impressions' })
    .sum({ clicks: 'clicks' })
    .sum({ reach: 'reach' })
    .sum({ reportedConversions: 'conversions' })
    .first();

  const ordersQuery = db('orders').whereBetween('date_order', [from, to]);
  if (store) ordersQuery.andWhere({ store });
  const ordersRow = await ordersQuery.count({ count: '*' }).sum({ revenue: 'amount_total' }).first();

  // Con filtro de plataforma, el ROAS/CPA deben reflejar solo los pedidos
  // atribuidos a esa plataforma (via el ad_performance vinculado), no todos
  // los pedidos atribuidos en general.
  const attributedRow = await buildAttributedOrdersQuery(db, { store, platform, from, to })
    .count({ count: 'orders.id' })
    .sum({ revenue: 'orders.amount_total' })
    .first();

  const spend = Number(spendRow.spend) || 0;
  const impressions = Number(spendRow.impressions) || 0;
  const clicks = Number(spendRow.clicks) || 0;
  // Suma de "reach" diario: sobreestima el alcance unico real de todo el
  // rango (una misma persona puede sumar en varios dias), pero es la
  // aproximacion estandar cuando se pide desglose diario (time_increment=1)
  // en vez de un unico alcance agregado para todo el periodo.
  const reach = Number(spendRow.reach) || 0;
  const totalRevenue = Number(ordersRow.revenue) || 0;
  const totalOrders = Number(ordersRow.count) || 0;
  const attributedRevenue = Number(attributedRow.revenue) || 0;
  const attributedOrders = Number(attributedRow.count) || 0;

  return {
    spend,
    impressions,
    clicks,
    reach,
    reportedConversions: Number(spendRow.reportedConversions) || 0,
    totalRevenue,
    totalOrders,
    attributedRevenue,
    attributedOrders,
    roas: calculateROAS(attributedRevenue, spend),
    cpa: calculateCPA(spend, attributedOrders),
    aov: calculateAOV(totalRevenue, totalOrders),
    ctr: calculateCTR(clicks, impressions),
    cpc: calculateCPC(spend, clicks),
    cpm: calculateCPM(spend, impressions),
    frequency: calculateFrequency(impressions, reach),
    conversionRate: calculateConversionRate(attributedOrders, clicks),
  };
}

export async function getSpendBreakdown(db, { store, platform, from, to }) {
  const byStoreQuery = db('ad_performance').whereBetween('date', [from, to]).select('store').sum({ spend: 'spend' }).groupBy('store');
  if (store) byStoreQuery.andWhere({ store });
  if (platform) byStoreQuery.andWhere({ platform });
  const byStoreRows = await byStoreQuery;

  const byPlatformQuery = db('ad_performance').whereBetween('date', [from, to]).select('platform').sum({ spend: 'spend' }).groupBy('platform');
  if (store) byPlatformQuery.andWhere({ store });
  if (platform) byPlatformQuery.andWhere({ platform });
  const byPlatformRows = await byPlatformQuery;

  return {
    byStore: byStoreRows.map((row) => ({ store: row.store, spend: Number(row.spend) || 0 })),
    byPlatform: byPlatformRows.map((row) => ({ platform: row.platform, spend: Number(row.spend) || 0 })),
  };
}

// Nivel 2 del dashboard: comparativa Meta Ads vs Google Ads. Solo aparecen
// plataformas con gasto real en el rango.
export async function getPlatformComparison(db, { store, from, to }) {
  const spendQuery = db('ad_performance')
    .whereBetween('date', [from, to])
    .select('platform')
    .sum({ spend: 'spend' })
    .sum({ impressions: 'impressions' })
    .sum({ clicks: 'clicks' })
    .groupBy('platform');
  if (store) spendQuery.andWhere({ store });
  const spendRows = await spendQuery;

  const revenueQuery = db('attribution')
    .join('orders', 'orders.id', 'attribution.order_id')
    .join('ad_performance', 'ad_performance.id', 'attribution.ad_performance_id')
    .whereBetween('orders.date_order', [from, to])
    .andWhere('attribution.model', ATTRIBUTION_MODEL)
    .select('ad_performance.platform')
    .sum({ revenue: 'orders.amount_total' })
    .count({ attributedOrders: 'orders.id' })
    .groupBy('ad_performance.platform');
  if (store) revenueQuery.andWhere('ad_performance.store', store);
  const revenueRows = await revenueQuery;

  const revenueByPlatform = new Map(
    revenueRows.map((row) => [row.platform, { revenue: Number(row.revenue) || 0, attributedOrders: Number(row.attributedOrders) || 0 }]),
  );

  return spendRows
    .map((row) => {
      const rev = revenueByPlatform.get(row.platform) || { revenue: 0, attributedOrders: 0 };
      const spend = Number(row.spend) || 0;
      return {
        platform: row.platform,
        spend,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        revenue: rev.revenue,
        attributedOrders: rev.attributedOrders,
        cpa: calculateCPA(spend, rev.attributedOrders),
        roas: calculateROAS(rev.revenue, spend),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

// Nivel 3 del dashboard: gasto/ingresos/ROAS por dia o por semana.
// "revenue" es el ingreso total del negocio en ese periodo (igual que
// totalRevenue en getSummaryKpis); "attributedRevenue" es el que realmente
// se cruza con el gasto para el grafico de ROAS.
export async function getTimeseries(db, { store, platform, from, to, granularity = 'day' }) {
  const isWeekly = granularity === 'week';
  const dateExpr = isWeekly ? "date_trunc('week', date)::date" : 'date';
  const dateOrderExpr = isWeekly ? "date_trunc('week', date_order)::date" : 'date(date_order)';

  const spendQuery = db('ad_performance')
    .whereBetween('date', [from, to])
    .select(db.raw(`${dateExpr} as date`))
    .sum({ spend: 'spend' })
    .groupBy(db.raw(dateExpr));
  if (store) spendQuery.andWhere({ store });
  if (platform) spendQuery.andWhere({ platform });
  const spendRows = await spendQuery;

  const revenueQuery = db('orders')
    .whereBetween('date_order', [from, to])
    .select(db.raw(`${dateOrderExpr} as date`))
    .sum({ revenue: 'amount_total' })
    .groupBy(db.raw(dateOrderExpr));
  if (store) revenueQuery.andWhere({ store });
  const revenueRows = await revenueQuery;

  const attributedRows = await buildAttributedOrdersQuery(db, { store, platform, from, to })
    .select(db.raw(`${dateOrderExpr} as date`))
    .sum({ attributedRevenue: 'orders.amount_total' })
    .groupBy(db.raw(dateOrderExpr));

  const byDate = new Map();
  const ensure = (date) => {
    if (!byDate.has(date)) byDate.set(date, { date, spend: 0, revenue: 0, attributedRevenue: 0 });
    return byDate.get(date);
  };
  for (const row of spendRows) ensure(formatDate(row.date)).spend = Number(row.spend) || 0;
  for (const row of revenueRows) ensure(formatDate(row.date)).revenue = Number(row.revenue) || 0;
  for (const row of attributedRows) ensure(formatDate(row.date)).attributedRevenue = Number(row.attributedRevenue) || 0;

  return Array.from(byDate.values())
    .map((row) => ({ ...row, roas: calculateROAS(row.attributedRevenue, row.spend) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCampaigns(db, { store, platform, from, to }) {
  const campaignsQuery = db('ad_performance')
    .whereBetween('date', [from, to])
    .select('platform', 'store', 'campaign_id', 'campaign_name')
    .sum({ spend: 'spend' })
    .sum({ impressions: 'impressions' })
    .sum({ clicks: 'clicks' })
    .sum({ reportedConversions: 'conversions' })
    .groupBy('platform', 'store', 'campaign_id', 'campaign_name');
  if (store) campaignsQuery.andWhere({ store });
  if (platform) campaignsQuery.andWhere({ platform });
  const rows = await campaignsQuery;

  // campaign_id NO es unico globalmente (los IDs de campana de Google Ads son
  // unicos solo dentro de la cuenta/tienda, igual que en la clave unica de
  // ad_performance) -- se agrupa/cruza por (platform, store, campaign_id), no
  // solo campaign_id, para no mezclar ingresos de campanas de tiendas
  // distintas que coincidan en ID.
  const revenueQuery = db('attribution')
    .join('orders', 'orders.id', 'attribution.order_id')
    .join('ad_performance', 'ad_performance.id', 'attribution.ad_performance_id')
    .whereBetween('orders.date_order', [from, to])
    .andWhere('attribution.model', ATTRIBUTION_MODEL)
    .select('ad_performance.platform', 'ad_performance.store', 'ad_performance.campaign_id')
    .sum({ revenue: 'orders.amount_total' })
    .count({ attributedOrders: 'orders.id' })
    .groupBy('ad_performance.platform', 'ad_performance.store', 'ad_performance.campaign_id');
  if (store) revenueQuery.andWhere('ad_performance.store', store);
  if (platform) revenueQuery.andWhere('ad_performance.platform', platform);
  const revenueRows = await revenueQuery;

  const campaignKey = (row) => `${row.platform}:${row.store}:${row.campaign_id}`;

  const revenueByCampaign = new Map(
    revenueRows.map((row) => [
      campaignKey(row),
      { revenue: Number(row.revenue) || 0, attributedOrders: Number(row.attributedOrders) || 0 },
    ]),
  );

  return rows
    .map((row) => {
      const rev = revenueByCampaign.get(campaignKey(row)) || { revenue: 0, attributedOrders: 0 };
      const spend = Number(row.spend) || 0;
      return {
        platform: row.platform,
        store: row.store,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        spend,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        reportedConversions: Number(row.reportedConversions) || 0,
        revenue: rev.revenue,
        attributedOrders: rev.attributedOrders,
        cpa: calculateCPA(spend, rev.attributedOrders),
        roas: calculateROAS(rev.revenue, spend),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
