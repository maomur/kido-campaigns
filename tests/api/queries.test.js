import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import db from '../../apps/backend/db.js';
import { getSummaryKpis, getSpendBreakdown, getTimeseries, getCampaigns, getPlatformComparison } from '../../apps/backend/api/queries.js';

// Tests de integracion contra Postgres real (requiere `npm run docker:up` +
// `npm run migrate`). Cada test corre dentro de una transaccion que se
// revierte al final, asi que nunca toca los datos reales de la app.
const describeIfDb = process.env.SKIP_DB_TESTS === 'true' ? describe.skip : describe;

function insertedId(result) {
  const row = result[0];
  return typeof row === 'object' ? row.id : row;
}

describeIfDb('api/queries (integracion, Postgres real)', () => {
  let trx;

  beforeEach(async () => {
    trx = await db.transaction();
  });

  afterEach(async () => {
    await trx.rollback();
  });

  async function insertAdPerformance(overrides) {
    const result = await trx('ad_performance')
      .insert({
        platform: 'meta',
        store: 'test_store',
        date: '2027-01-01',
        campaign_id: 'c1',
        campaign_name: 'Test Campaign',
        adset_id: '',
        ad_id: '',
        spend: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        conversions: 0,
        conversions_value: 0,
        ...overrides,
      })
      .returning('id');
    return insertedId(result);
  }

  async function insertOrder(overrides) {
    const result = await trx('orders')
      .insert({
        odoo_name: `T${Math.random().toString(36).slice(2, 8)}`,
        store: 'test_store',
        date_order: '2027-01-01 10:00:00',
        amount_total: 0,
        ...overrides,
      })
      .returning('id');
    return insertedId(result);
  }

  async function insertAttribution(overrides) {
    await trx('attribution').insert({
      attribution_type: 'direct_click',
      confidence: 'high',
      model: 'last_click',
      ...overrides,
    });
  }

  describe('getSummaryKpis', () => {
    it('sums ad_performance metrics but only counts revenue from orders that have an attribution row', async () => {
      const adMeta = await insertAdPerformance({ platform: 'meta', date: '2027-01-01', spend: 100, impressions: 1000, clicks: 50, reach: 400, conversions: 2 });
      await insertAdPerformance({ platform: 'google', campaign_id: 'c2', date: '2027-01-02', spend: 50, impressions: 500, clicks: 20, reach: 0, conversions: 1 });

      const attributedOrder = await insertOrder({ date_order: '2027-01-01 10:00:00', amount_total: 80 });
      await insertOrder({ date_order: '2027-01-02 10:00:00', amount_total: 40 }); // organico, sin atribucion
      await insertAttribution({ order_id: attributedOrder, ad_performance_id: adMeta });

      const summary = await getSummaryKpis(trx, { store: 'test_store', from: '2027-01-01', to: '2027-01-31' });

      expect(summary.spend).toBe(150);
      expect(summary.impressions).toBe(1500);
      expect(summary.clicks).toBe(70);
      expect(summary.reach).toBe(400);
      expect(summary.totalOrders).toBe(2);
      expect(summary.totalRevenue).toBe(120);
      expect(summary.attributedOrders).toBe(1);
      expect(summary.attributedRevenue).toBe(80);
      expect(summary.roas).toBe(Number((80 / 150).toFixed(2)));
      expect(summary.aov).toBe(Number((120 / 2).toFixed(2)));
    });

    it('platform filter scopes both ad spend AND attributed revenue to that platform', async () => {
      const adMeta = await insertAdPerformance({ platform: 'meta', campaign_id: 'c1', date: '2027-01-01', spend: 100 });
      const adGoogle = await insertAdPerformance({ platform: 'google', campaign_id: 'c2', date: '2027-01-01', spend: 50 });

      const orderFromMeta = await insertOrder({ amount_total: 80 });
      const orderFromGoogle = await insertOrder({ amount_total: 30 });
      await insertAttribution({ order_id: orderFromMeta, ad_performance_id: adMeta });
      await insertAttribution({ order_id: orderFromGoogle, ad_performance_id: adGoogle });

      const metaSummary = await getSummaryKpis(trx, { store: 'test_store', platform: 'meta', from: '2027-01-01', to: '2027-01-31' });
      expect(metaSummary.spend).toBe(100);
      expect(metaSummary.attributedRevenue).toBe(80);
      expect(metaSummary.attributedOrders).toBe(1);

      const googleSummary = await getSummaryKpis(trx, { store: 'test_store', platform: 'google', from: '2027-01-01', to: '2027-01-31' });
      expect(googleSummary.spend).toBe(50);
      expect(googleSummary.attributedRevenue).toBe(30);
      expect(googleSummary.attributedOrders).toBe(1);

      // totalRevenue/totalOrders son de todo el negocio, no cambian por plataforma
      expect(metaSummary.totalRevenue).toBe(googleSummary.totalRevenue);
    });

    it('only counts attribution rows for the last_click model, ignoring other models for the same order', async () => {
      const ad = await insertAdPerformance({ spend: 100 });
      const order = await insertOrder({ amount_total: 80 });
      await insertAttribution({ order_id: order, ad_performance_id: ad, model: 'last_click' });
      await insertAttribution({ order_id: order, ad_performance_id: ad, model: 'linear' });

      const summary = await getSummaryKpis(trx, { store: 'test_store', from: '2027-01-01', to: '2027-01-31' });

      // Si se contaran ambas filas de atribucion, attributedRevenue seria 160.
      expect(summary.attributedOrders).toBe(1);
      expect(summary.attributedRevenue).toBe(80);
    });
  });

  describe('getSpendBreakdown', () => {
    it('groups spend by store and by platform independently', async () => {
      await insertAdPerformance({ platform: 'meta', store: 'store_a', campaign_id: 'c1', spend: 100 });
      await insertAdPerformance({ platform: 'google', store: 'store_a', campaign_id: 'c2', spend: 30 });
      await insertAdPerformance({ platform: 'meta', store: 'store_b', campaign_id: 'c3', spend: 70 });

      const breakdown = await getSpendBreakdown(trx, { from: '2027-01-01', to: '2027-01-31' });
      const byStoreMap = Object.fromEntries(breakdown.byStore.filter((r) => r.store.startsWith('store_')).map((r) => [r.store, r.spend]));
      const byPlatformMap = Object.fromEntries(breakdown.byPlatform.map((r) => [r.platform, r.spend]));

      expect(byStoreMap.store_a).toBe(130);
      expect(byStoreMap.store_b).toBe(70);
      expect(byPlatformMap.meta).toBeGreaterThanOrEqual(170);
      expect(byPlatformMap.google).toBeGreaterThanOrEqual(30);
    });
  });

  describe('getTimeseries', () => {
    it('groups spend by date, one row per distinct date', async () => {
      await insertAdPerformance({ date: '2027-01-01', spend: 10 });
      await insertAdPerformance({ campaign_id: 'c2', date: '2027-01-01', spend: 5 });
      await insertAdPerformance({ campaign_id: 'c3', date: '2027-01-02', spend: 20 });

      const series = await getTimeseries(trx, { store: 'test_store', from: '2027-01-01', to: '2027-01-31' });
      const byDate = Object.fromEntries(series.map((s) => [s.date, s.spend]));

      expect(byDate['2027-01-01']).toBe(15);
      expect(byDate['2027-01-02']).toBe(20);
    });

    it('computes roas per period from attributed revenue, not total order revenue', async () => {
      const ad = await insertAdPerformance({ date: '2027-01-01', spend: 100 });
      const attributedOrder = await insertOrder({ date_order: '2027-01-01 09:00:00', amount_total: 150 });
      await insertOrder({ date_order: '2027-01-01 09:00:00', amount_total: 900 }); // organico, no debe entrar al ROAS
      await insertAttribution({ order_id: attributedOrder, ad_performance_id: ad });

      const series = await getTimeseries(trx, { store: 'test_store', from: '2027-01-01', to: '2027-01-31' });
      const day = series.find((s) => s.date === '2027-01-01');

      expect(day.spend).toBe(100);
      expect(day.revenue).toBe(1050); // total del negocio (150 + 900)
      expect(day.attributedRevenue).toBe(150);
      expect(day.roas).toBe(Number((150 / 100).toFixed(2)));
    });

    it('with granularity=week, groups by the Monday of the ISO week', async () => {
      await insertAdPerformance({ date: '2027-02-01', spend: 10 }); // lunes
      await insertAdPerformance({ campaign_id: 'c2', date: '2027-02-03', spend: 20 }); // miercoles, misma semana

      const series = await getTimeseries(trx, { store: 'test_store', from: '2027-02-01', to: '2027-02-07', granularity: 'week' });

      expect(series).toHaveLength(1);
      expect(series[0].date).toBe('2027-02-01');
      expect(series[0].spend).toBe(30);
    });
  });

  describe('getPlatformComparison', () => {
    it('returns spend/revenue/roas/cpa per platform, only for platforms with spend in range', async () => {
      const adMeta = await insertAdPerformance({ platform: 'meta', campaign_id: 'c1', spend: 100, impressions: 1000, clicks: 40 });
      const orderMeta = await insertOrder({ amount_total: 150 });
      await insertAttribution({ order_id: orderMeta, ad_performance_id: adMeta });

      const platforms = await getPlatformComparison(trx, { store: 'test_store', from: '2027-01-01', to: '2027-01-31' });

      expect(platforms).toHaveLength(1);
      expect(platforms[0]).toMatchObject({
        platform: 'meta',
        spend: 100,
        impressions: 1000,
        clicks: 40,
        revenue: 150,
        attributedOrders: 1,
        cpa: 100,
        roas: 1.5,
      });
    });
  });

  describe('getCampaigns', () => {
    it('does not mix revenue between two different stores that happen to share the same campaign_id', async () => {
      // Google Ads campaign_id no es unico globalmente, solo por cuenta/tienda.
      const adStoreA = await insertAdPerformance({ platform: 'google', store: 'store_a', campaign_id: 'SAME_ID', campaign_name: 'Campana A', spend: 100 });
      await insertAdPerformance({ platform: 'google', store: 'store_b', campaign_id: 'SAME_ID', campaign_name: 'Campana B', spend: 200 });

      const orderA = await insertOrder({ store: 'store_a', amount_total: 50 });
      await insertAttribution({ order_id: orderA, ad_performance_id: adStoreA });

      const campaigns = await getCampaigns(trx, { from: '2027-01-01', to: '2027-01-31' });
      const campaignA = campaigns.find((c) => c.store === 'store_a' && c.campaignId === 'SAME_ID');
      const campaignB = campaigns.find((c) => c.store === 'store_b' && c.campaignId === 'SAME_ID');

      expect(campaignA.revenue).toBe(50);
      expect(campaignA.spend).toBe(100);
      // store_b no tiene ningun pedido atribuido -- si el bug de mezclar por
      // campaign_id solamente reapareciera, aqui tambien saldria 50.
      expect(campaignB.revenue).toBe(0);
      expect(campaignB.spend).toBe(200);
    });
  });
});
