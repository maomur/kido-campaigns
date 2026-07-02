import { describe, it, expect } from 'vitest';
import {
  transformMetaRow,
  transformGoogleRow,
  transformOdooOrder,
  transformCsvOrder,
  transformAll,
} from '../../apps/backend/etl/transform.js';
import { mockInsightsPageA } from '../fixtures/metaAds.fixtures.js';
import { mockGaqlCampaignRows } from '../fixtures/googleAds.fixtures.js';
import { mockSaleOrders } from '../fixtures/odoo.fixtures.js';

const websiteStoreMap = { 1: 'bcn_kids', 2: 'lux_kids', 3: 'lux_living' };

describe('etl/transform', () => {
  it('transformMetaRow maps a raw Meta insights row into the ad_performance shape', () => {
    const row = transformMetaRow(mockInsightsPageA.data[0], 'bcn_kids');

    expect(row).toMatchObject({
      platform: 'meta',
      store: 'bcn_kids',
      date: '2026-06-01',
      campaign_id: '1000001',
      campaign_name: 'BCN Kids - Verano 2026',
      spend: 120.5,
      impressions: 15000,
      clicks: 320,
      conversions: 8,
      conversions_value: 640,
    });
    expect(row.raw_payload).toBe(mockInsightsPageA.data[0]);
  });

  it('transformMetaRow defaults adset_id/ad_id to "" (not null) when absent, e.g. level=campaign', () => {
    // A nivel de campana, Meta no incluye adset_id/ad_id en la respuesta.
    // Deben quedar '' y no null/undefined, porque Postgres nunca trata dos
    // NULL como iguales en el indice unico de ad_performance, lo que rompia
    // el upsert idempotente (cada corrida insertaba filas duplicadas).
    const rawRow = { ...mockInsightsPageA.data[0] };
    delete rawRow.adset_id;
    delete rawRow.ad_id;

    const row = transformMetaRow(rawRow, 'bcn_kids');

    expect(row.adset_id).toBe('');
    expect(row.ad_id).toBe('');
  });

  it('transformGoogleRow converts cost_micros to spend and maps nested campaign/adgroup/ad', () => {
    const row = transformGoogleRow(mockGaqlCampaignRows[0], 'lux_kids');

    expect(row).toMatchObject({
      platform: 'google',
      store: 'lux_kids',
      date: '2026-06-01',
      campaign_id: '4000001',
      campaign_name: 'LUX Kids - Search Brand',
      adset_id: '5000001',
      ad_id: '6000001',
      spend: 80,
      impressions: 5000,
      clicks: 210,
      conversions: 12,
      conversions_value: 900,
    });
  });

  it('transformOdooOrder resolves store from website_id and normalizes false -> null', () => {
    const order = transformOdooOrder(mockSaleOrders[0], websiteStoreMap);

    expect(order).toMatchObject({
      odoo_id: 9001,
      odoo_name: 'S00901',
      store: 'bcn_kids',
      amount_total: 85,
      utm_source: 'facebook',
      utm_campaign: 'BCN Kids - Verano 2026',
      fbclid: 'IwAR_fake_fbclid_001',
      gclid: null,
      utm_content: null,
      utm_term: null,
    });
  });

  it('transformOdooOrder returns all-null tracking fields for a fully organic order', () => {
    const organicOrder = mockSaleOrders.find((o) => o.id === 9005);
    const order = transformOdooOrder(organicOrder, websiteStoreMap);

    expect(order.utm_source).toBeNull();
    expect(order.utm_campaign).toBeNull();
    expect(order.fbclid).toBeNull();
    expect(order.gclid).toBeNull();
  });

  it('transformCsvOrder maps a parsed CSV row into the orders shape, with odoo_id null', () => {
    const rawRow = {
      reference: 'S00901',
      dateOrder: '2026-06-01 10:00:00',
      amountTotal: '1.234,56',
      campaignName: 'BCN Kids - Verano 2026',
      sourceName: 'facebook',
      state: 'Pedido de venta',
    };

    const order = transformCsvOrder(rawRow, 'bcn_kids');

    expect(order).toEqual({
      odoo_id: null,
      odoo_name: 'S00901',
      store: 'bcn_kids',
      date_order: '2026-06-01 10:00:00',
      amount_total: 1234.56,
      state: 'Pedido de venta',
      utm_source: 'facebook',
      utm_medium: null,
      utm_campaign: 'BCN Kids - Verano 2026',
      utm_content: null,
      utm_term: null,
      fbclid: null,
      gclid: null,
    });
  });

  it('transformCsvOrder leaves utm_campaign/utm_source null when the CSV did not have those columns', () => {
    const order = transformCsvOrder(
      { reference: 'S00905', dateOrder: '2026-06-01 14:00:00', amountTotal: '210.00', campaignName: null, sourceName: null, state: null },
      'bcn_kids',
    );

    expect(order.utm_campaign).toBeNull();
    expect(order.utm_source).toBeNull();
    expect(order.state).toBeNull();
  });

  it('transformAll aggregates meta, google and odoo rows into adPerformanceRows/orderRows', () => {
    const metaRows = mockInsightsPageA.data.map((r) => ({ ...r, store: 'bcn_kids' }));
    const googleRows = mockGaqlCampaignRows.map((r) => ({ ...r, store: 'lux_kids' }));

    const { adPerformanceRows, orderRows } = transformAll({
      metaRows,
      googleRows,
      odooOrders: mockSaleOrders,
      websiteStoreMap,
    });

    expect(adPerformanceRows).toHaveLength(metaRows.length + googleRows.length);
    expect(orderRows).toHaveLength(mockSaleOrders.length);
    expect(adPerformanceRows.filter((r) => r.platform === 'meta')).toHaveLength(metaRows.length);
    expect(adPerformanceRows.filter((r) => r.platform === 'google')).toHaveLength(googleRows.length);
  });
});
