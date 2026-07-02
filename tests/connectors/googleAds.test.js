import { describe, it, expect, vi } from 'vitest';
import {
  fetchGoogleAdsPerformance,
  fetchAllStoresGoogleAdsPerformance,
  parseCustomerAccountsMap,
} from '../../apps/backend/connectors/googleAds.js';
import { mockGaqlCampaignRows, mockEmptyResult, mockAuthError } from '../fixtures/googleAds.fixtures.js';

function fakeClient(queryImpl) {
  return { Customer: vi.fn(() => ({ query: queryImpl })) };
}

describe('googleAds connector', () => {
  it('fetchGoogleAdsPerformance in dry-run returns fixtures without calling the client', async () => {
    const client = fakeClient(vi.fn());
    const rows = await fetchGoogleAdsPerformance({
      customerId: '1234567890',
      since: '2026-06-01',
      until: '2026-06-01',
      client,
      dryRun: true,
    });

    expect(client.Customer).not.toHaveBeenCalled();
    expect(rows).toEqual(mockGaqlCampaignRows);
  });

  it('builds a GAQL query filtered by segments.date and returns customer.query() rows', async () => {
    const queryImpl = vi.fn().mockResolvedValue(mockGaqlCampaignRows);
    const client = fakeClient(queryImpl);

    const rows = await fetchGoogleAdsPerformance({
      customerId: '1234567890',
      since: '2026-06-01',
      until: '2026-06-30',
      client,
      dryRun: false,
    });

    expect(rows).toEqual(mockGaqlCampaignRows);
    expect(client.Customer).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: '1234567890' }),
    );
    const gaqlQuery = queryImpl.mock.calls[0][0];
    expect(gaqlQuery).toContain('FROM ad_group_ad');
    expect(gaqlQuery).toContain("segments.date BETWEEN '2026-06-01' AND '2026-06-30'");
  });

  it('returns an empty array when there is no data for the date range', async () => {
    const client = fakeClient(vi.fn().mockResolvedValue(mockEmptyResult));
    const rows = await fetchGoogleAdsPerformance({
      customerId: '1234567890',
      since: '2026-06-01',
      until: '2026-06-01',
      client,
      dryRun: false,
    });
    expect(rows).toEqual([]);
  });

  it('propagates an auth error from customer.query()', async () => {
    const client = fakeClient(vi.fn().mockRejectedValue(mockAuthError));
    await expect(
      fetchGoogleAdsPerformance({ customerId: '1234567890', since: '2026-06-01', until: '2026-06-01', client, dryRun: false }),
    ).rejects.toThrow('invalid_grant');
  });

  it('parseCustomerAccountsMap parses "store:customer_id" pairs from env format', () => {
    expect(parseCustomerAccountsMap('bcn_kids:111,lux_kids:222')).toEqual({
      bcn_kids: '111',
      lux_kids: '222',
    });
  });

  it('fetchAllStoresGoogleAdsPerformance tags each row with its store', async () => {
    const queryImpl = vi.fn().mockResolvedValue(mockGaqlCampaignRows);
    const client = fakeClient(queryImpl);

    const rows = await fetchAllStoresGoogleAdsPerformance({
      since: '2026-06-01',
      until: '2026-06-01',
      customerAccountsMap: { lux_kids: '111', lux_living: '222' },
      client,
    });

    expect(rows.length).toBe(mockGaqlCampaignRows.length * 2);
    expect(rows.every((row) => ['lux_kids', 'lux_living'].includes(row.store))).toBe(true);
  });

  it('fetchAllStoresGoogleAdsPerformance keeps data from stores that succeed when another store fails', async () => {
    const client = {
      Customer: vi.fn(({ customer_id: customerId }) => ({
        query:
          customerId === '111'
            ? vi.fn().mockResolvedValue(mockGaqlCampaignRows)
            : vi.fn().mockRejectedValue(new Error('lux_living down')),
      })),
    };

    const rows = await fetchAllStoresGoogleAdsPerformance({
      since: '2026-06-01',
      until: '2026-06-01',
      customerAccountsMap: { lux_kids: '111', lux_living: '222' },
      client,
    });

    expect(rows).toEqual(mockGaqlCampaignRows.map((row) => ({ ...row, store: 'lux_kids' })));
  });
});
