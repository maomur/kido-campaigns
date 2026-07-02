import { describe, it, expect, vi } from 'vitest';
import {
  classifyConfidence,
  matchByClickId,
  matchByCampaignName,
  matchByPlatformOnly,
  runAttribution,
} from '../../apps/backend/attribution/engine.js';

const adPerformanceRows = [
  {
    id: 1,
    platform: 'meta',
    store: 'bcn_kids',
    date: '2026-06-01',
    campaign_name: 'BCN Kids - Verano 2026',
  },
  {
    id: 2,
    platform: 'google',
    store: 'lux_kids',
    date: '2026-06-01',
    campaign_name: 'LUX Kids - Search Brand',
  },
  {
    id: 3,
    platform: 'google',
    store: 'lux_living',
    date: '2026-06-01',
    campaign_name: 'LUX Living - Search Generic',
  },
  {
    id: 4,
    platform: 'meta',
    store: 'lux_living',
    date: '2026-06-01',
    // Mismo nombre que adPerformanceRows[1], pero de OTRA tienda -- simula
    // campanas estacionales que se repiten entre tiendas (ej. "Soldes d'ete").
    campaign_name: 'LUX Kids - Search Brand',
  },
];

const highConfidenceOrder = {
  id: 9001,
  store: 'bcn_kids',
  date_order: '2026-06-01 10:00:00',
  fbclid: 'IwAR_fake_fbclid_001',
  gclid: null,
  utm_campaign: 'BCN Kids - Verano 2026',
  utm_source: 'facebook',
};

const mediumConfidenceOrder = {
  id: 9003,
  store: 'lux_kids',
  date_order: '2026-06-01 12:00:00',
  fbclid: null,
  gclid: null,
  utm_campaign: 'LUX Kids - Search Brand',
  utm_source: null,
};

const lowConfidenceOrder = {
  id: 9004,
  store: 'lux_living',
  date_order: '2026-06-01 13:00:00',
  fbclid: null,
  gclid: null,
  utm_campaign: null,
  utm_source: 'google',
};

const organicOrder = {
  id: 9005,
  store: 'bcn_kids',
  date_order: '2026-06-01 14:00:00',
  fbclid: null,
  gclid: null,
  utm_campaign: null,
  utm_source: null,
};

describe('classifyConfidence', () => {
  it('returns "high" when fbclid or gclid is present', () => {
    expect(classifyConfidence(highConfidenceOrder)).toBe('high');
    expect(classifyConfidence({ ...highConfidenceOrder, fbclid: null, gclid: 'abc' })).toBe('high');
  });

  it('returns "medium" when only utm_campaign is present', () => {
    expect(classifyConfidence(mediumConfidenceOrder)).toBe('medium');
  });

  it('returns "low" when only utm_source is present', () => {
    expect(classifyConfidence(lowConfidenceOrder)).toBe('low');
  });

  it('returns "none" for a fully organic order', () => {
    expect(classifyConfidence(organicOrder)).toBe('none');
  });
});

describe('matchByClickId', () => {
  it('matches meta ad_performance by platform+store+date when fbclid is present', () => {
    const match = matchByClickId(highConfidenceOrder, adPerformanceRows);
    expect(match).toEqual(adPerformanceRows[0]);
  });

  it('returns null when there is no fbclid/gclid', () => {
    expect(matchByClickId(mediumConfidenceOrder, adPerformanceRows)).toBeNull();
  });
});

describe('matchByCampaignName', () => {
  it('matches case-insensitively and trims whitespace', () => {
    const order = { ...mediumConfidenceOrder, utm_campaign: '  lux kids - search brand  ' };
    expect(matchByCampaignName(order, adPerformanceRows)).toEqual(adPerformanceRows[1]);
  });

  it('returns null when no campaign matches', () => {
    expect(matchByCampaignName({ utm_campaign: 'Campana inexistente' }, adPerformanceRows)).toBeNull();
  });

  it('does not match a campaign belonging to a different store, even with an identical name', () => {
    // adPerformanceRows[1] (lux_kids) y adPerformanceRows[3] (lux_living)
    // comparten el mismo campaign_name a proposito.
    const order = { store: 'lux_kids', utm_campaign: 'LUX Kids - Search Brand' };
    expect(matchByCampaignName(order, adPerformanceRows)).toEqual(adPerformanceRows[1]);

    const orderFromAnotherStore = { store: 'bcn_kids', utm_campaign: 'LUX Kids - Search Brand' };
    expect(matchByCampaignName(orderFromAnotherStore, adPerformanceRows)).toBeNull();
  });
});

describe('matchByPlatformOnly', () => {
  it('resolves platform from utm_source and returns any row for that platform+store', () => {
    const order = { store: 'lux_kids', utm_source: 'google' };
    expect(matchByPlatformOnly(order, adPerformanceRows)).toEqual(adPerformanceRows[1]);
  });

  it('returns null for an unrecognized utm_source', () => {
    expect(matchByPlatformOnly({ store: 'bcn_kids', utm_source: 'tiktok' }, adPerformanceRows)).toBeNull();
  });
});

function createFakeDb({ pendingOrders, adPerformanceRows: adRows }) {
  const joinBuilder = {};
  joinBuilder.on = vi.fn(() => joinBuilder);
  joinBuilder.andOnVal = vi.fn(() => joinBuilder);

  const ordersQuery = {};
  ordersQuery.leftJoin = vi.fn((table, cb) => {
    cb.call(joinBuilder);
    return ordersQuery;
  });
  ordersQuery.whereNull = vi.fn(() => ordersQuery);
  ordersQuery.select = vi.fn(() => Promise.resolve(pendingOrders));

  const adPerfQuery = { select: vi.fn(() => Promise.resolve(adRows)) };

  const merge = vi.fn().mockResolvedValue(undefined);
  const onConflict = vi.fn(() => ({ merge }));
  const insert = vi.fn(() => ({ onConflict }));
  const attributionQuery = { insert };

  const db = vi.fn((table) => {
    if (table === 'orders') return ordersQuery;
    if (table === 'ad_performance') return adPerfQuery;
    if (table === 'attribution') return attributionQuery;
    throw new Error(`Tabla inesperada: ${table}`);
  });

  return { db, insert, onConflict, merge, joinBuilder };
}

describe('runAttribution', () => {
  it('inserts a high/medium/low attribution row per order and skips fully organic orders', async () => {
    const { db, insert } = createFakeDb({
      pendingOrders: [highConfidenceOrder, mediumConfidenceOrder, lowConfidenceOrder, organicOrder],
      adPerformanceRows,
    });

    const result = await runAttribution({ db });

    expect(result).toEqual({ attributed: 3, skipped: 1 });
    expect(insert).toHaveBeenCalledTimes(3);

    const insertedRows = insert.mock.calls.map(([row]) => row);
    expect(insertedRows).toContainEqual(
      expect.objectContaining({ order_id: 9001, attribution_type: 'direct_click', confidence: 'high', ad_performance_id: 1 }),
    );
    expect(insertedRows).toContainEqual(
      expect.objectContaining({ order_id: 9003, attribution_type: 'utm_campaign', confidence: 'medium', ad_performance_id: 2 }),
    );
    expect(insertedRows).toContainEqual(
      expect.objectContaining({ order_id: 9004, attribution_type: 'utm_source', confidence: 'low', ad_performance_id: null }),
    );
  });

  it('always stores ad_performance_id=null for low confidence, even when a platform+store match exists', async () => {
    // adPerformanceRows[2] (id: 3) matches lowConfidenceOrder por platform+store,
    // pero la atribucion de baja confianza no debe usar ese match.
    expect(matchByPlatformOnly(lowConfidenceOrder, adPerformanceRows)).toEqual(adPerformanceRows[2]);

    const { db, insert } = createFakeDb({ pendingOrders: [lowConfidenceOrder], adPerformanceRows });
    await runAttribution({ db });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: 9004, confidence: 'low', ad_performance_id: null }),
    );
  });

  it('does not query ad_performance or insert anything when there are no pending orders', async () => {
    const { db, insert } = createFakeDb({ pendingOrders: [], adPerformanceRows });
    const result = await runAttribution({ db });

    expect(result).toEqual({ attributed: 0, skipped: 0 });
    expect(insert).not.toHaveBeenCalled();
  });

  it('joins attribution filtering by the given model via andOnVal', async () => {
    const { db, joinBuilder } = createFakeDb({ pendingOrders: [], adPerformanceRows });
    await runAttribution({ db, model: 'linear' });
    expect(joinBuilder.andOnVal).toHaveBeenCalledWith('attribution.model', 'linear');
  });
});
