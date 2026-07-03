import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../apps/backend/connectors/metaAds.js', () => ({
  fetchAllStoresMetaInsights: vi.fn(),
  parseAdAccountsMap: vi.fn(() => ({ bcn_kids: 'act_1' })),
}));

vi.mock('../../apps/backend/connectors/googleAds.js', () => ({
  fetchAllStoresGoogleAdsPerformance: vi.fn(),
  parseCustomerAccountsMap: vi.fn(() => ({ lux_kids: '111' })),
  createGoogleAdsClient: vi.fn(() => ({ fake: 'google-client' })),
}));

vi.mock('../../apps/backend/connectors/odoo.js', () => ({
  fetchNewOrders: vi.fn(),
  createOdooClient: vi.fn(() => ({ fake: 'odoo-client' })),
  parseWebsiteStoreMap: vi.fn(() => ({ 1: 'bcn_kids' })),
}));

const { fetchAllStoresMetaInsights } = await import('../../apps/backend/connectors/metaAds.js');
const { fetchAllStoresGoogleAdsPerformance } = await import('../../apps/backend/connectors/googleAds.js');
const { fetchNewOrders } = await import('../../apps/backend/connectors/odoo.js');
const { extractAll } = await import('../../apps/backend/etl/extract.js');

describe('etl/extract', () => {
  const originalOdooLiveSync = process.env.ODOO_LIVE_SYNC_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    // El acceso real a Odoo (XML-RPC) esta apagado por defecto -- estos tests
    // cubren el comportamiento de cuando SI se habilita (ver test dedicado
    // mas abajo para el default apagado).
    process.env.ODOO_LIVE_SYNC_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.ODOO_LIVE_SYNC_ENABLED = originalOdooLiveSync;
  });

  it('aggregates results from the 3 connectors when all succeed', async () => {
    fetchAllStoresMetaInsights.mockResolvedValue([{ campaign_id: '1' }]);
    fetchAllStoresGoogleAdsPerformance.mockResolvedValue([{ campaign: { id: '2' } }]);
    fetchNewOrders.mockResolvedValue([{ id: 1 }]);

    const result = await extractAll({ since: '2026-06-01', until: '2026-06-01', lastSyncDates: { odoo: '2026-05-01' } });

    expect(result.metaRows).toEqual([{ campaign_id: '1' }]);
    expect(result.googleRows).toEqual([{ campaign: { id: '2' } }]);
    expect(result.odooOrders).toEqual([{ id: 1 }]);
    expect(result.errors).toEqual([]);
  });

  it('does not let a failure in one connector prevent the others from returning data', async () => {
    fetchAllStoresMetaInsights.mockRejectedValue(new Error('Meta down'));
    fetchAllStoresGoogleAdsPerformance.mockResolvedValue([{ campaign: { id: '2' } }]);
    fetchNewOrders.mockResolvedValue([{ id: 1 }]);

    const result = await extractAll({ since: '2026-06-01', until: '2026-06-01' });

    expect(result.metaRows).toEqual([]);
    expect(result.googleRows).toEqual([{ campaign: { id: '2' } }]);
    expect(result.odooOrders).toEqual([{ id: 1 }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].connector).toBe('meta');
  });

  it('collects errors from all 3 connectors if all fail', async () => {
    fetchAllStoresMetaInsights.mockRejectedValue(new Error('Meta down'));
    fetchAllStoresGoogleAdsPerformance.mockRejectedValue(new Error('Google down'));
    fetchNewOrders.mockRejectedValue(new Error('Odoo down'));

    const result = await extractAll({ since: '2026-06-01', until: '2026-06-01' });

    expect(result.metaRows).toEqual([]);
    expect(result.googleRows).toEqual([]);
    expect(result.odooOrders).toEqual([]);
    expect(result.errors).toHaveLength(3);
  });

  it('skips the Odoo connector by default (ODOO_LIVE_SYNC_ENABLED unset) instead of always failing', async () => {
    process.env.ODOO_LIVE_SYNC_ENABLED = originalOdooLiveSync;
    fetchAllStoresMetaInsights.mockResolvedValue([{ campaign_id: '1' }]);
    fetchAllStoresGoogleAdsPerformance.mockResolvedValue([{ campaign: { id: '2' } }]);

    const result = await extractAll({ since: '2026-06-01', until: '2026-06-01' });

    expect(fetchNewOrders).not.toHaveBeenCalled();
    expect(result.odooOrders).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
