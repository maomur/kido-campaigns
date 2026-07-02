import { describe, it, expect, vi } from 'vitest';
import { fetchMetaInsights, fetchAllStoresMetaInsights, parseAdAccountsMap } from '../../apps/backend/connectors/metaAds.js';
import { mockInsightsPageA, mockInsightsPageB, mockRateLimitError } from '../fixtures/metaAds.fixtures.js';

function jsonResponse(body) {
  return { json: async () => body };
}

describe('metaAds connector', () => {
  it('fetchMetaInsights in dry-run returns fixtures without calling fetch', async () => {
    const fetchImpl = vi.fn();
    const rows = await fetchMetaInsights({ adAccountId: 'act_123', since: '2026-06-01', until: '2026-06-01', fetchImpl, dryRun: true });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rows).toEqual([...mockInsightsPageA.data, ...mockInsightsPageB.data]);
  });

  it('follows paging.cursors.after across multiple pages until there is no "next"', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockInsightsPageA))
      .mockResolvedValueOnce(jsonResponse(mockInsightsPageB));

    const rows = await fetchMetaInsights({
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-01',
      fetchImpl,
      dryRun: false,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([...mockInsightsPageA.data, ...mockInsightsPageB.data]);
    // La segunda llamada usa la url de paging.next de la primera pagina.
    expect(fetchImpl.mock.calls[1][0]).toBe(mockInsightsPageA.paging.next);
  });

  it('retries on rate limit error (code 17) and succeeds on the next attempt', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockRateLimitError))
      .mockResolvedValueOnce(jsonResponse(mockInsightsPageB));

    const rows = await fetchMetaInsights({
      adAccountId: 'act_123',
      since: '2026-06-01',
      until: '2026-06-01',
      fetchImpl,
      dryRun: false,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(rows).toEqual(mockInsightsPageB.data);
  }, 10000);

  it('throws a typed error for non-rate-limit API errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Invalid access token', code: 190 } }),
    );

    await expect(
      fetchMetaInsights({ adAccountId: 'act_123', since: '2026-06-01', until: '2026-06-01', fetchImpl, dryRun: false }),
    ).rejects.toThrow('Meta Ads API error: Invalid access token');
  });

  it('parseAdAccountsMap parses "store:ad_account_id" pairs from env format', () => {
    expect(parseAdAccountsMap('bcn_kids:act_1,lux_kids:act_2')).toEqual({
      bcn_kids: 'act_1',
      lux_kids: 'act_2',
    });
  });

  it('fetchAllStoresMetaInsights tags each row with its store and aggregates all stores', async () => {
    vi.stubEnv('DRY_RUN', 'true');
    const fetchImpl = vi.fn();
    const rows = await fetchAllStoresMetaInsights({
      since: '2026-06-01',
      until: '2026-06-01',
      adAccountsMap: { bcn_kids: 'act_1', lux_kids: 'act_2' },
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rows.every((row) => ['bcn_kids', 'lux_kids'].includes(row.store))).toBe(true);
    expect(rows.length).toBe(4); // 2 fixtures x 2 tiendas
    vi.unstubAllEnvs();
  });

  it('fetchAllStoresMetaInsights keeps data from stores that succeed when another store fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockInsightsPageB)) // bcn_kids: ok, ultima pagina
      .mockRejectedValueOnce(new Error('lux_kids down')); // lux_kids: falla

    const rows = await fetchAllStoresMetaInsights({
      since: '2026-06-01',
      until: '2026-06-01',
      adAccountsMap: { bcn_kids: 'act_1', lux_kids: 'act_2' },
      fetchImpl,
    });

    expect(rows).toEqual(mockInsightsPageB.data.map((row) => ({ ...row, store: 'bcn_kids' })));
  });
});
