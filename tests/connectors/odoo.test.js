import { describe, it, expect, vi } from 'vitest';
import {
  createOdooClient,
  fetchNewOrders,
  parseWebsiteStoreMap,
  mapWebsiteIdToStore,
} from '../../apps/backend/connectors/odoo.js';
import { mockSaleOrders, mockAuthResponse } from '../fixtures/odoo.fixtures.js';

function createFakeXmlrpcImpl({ authResult = mockAuthResponse, searchReadResult = mockSaleOrders } = {}) {
  const commonMethodCall = vi.fn((method, params, cb) => cb(null, authResult));
  const objectMethodCall = vi.fn((method, params, cb) => cb(null, searchReadResult));
  return {
    createClient: vi.fn(({ url }) => {
      if (url.endsWith('/xmlrpc/2/common')) {
        return { methodCall: commonMethodCall };
      }
      return { methodCall: objectMethodCall };
    }),
    commonMethodCall,
    objectMethodCall,
  };
}

describe('odoo connector', () => {
  it('authenticate() calls common.authenticate with db/username/apiKey and caches the uid', async () => {
    const xmlrpcImpl = createFakeXmlrpcImpl();
    const client = createOdooClient({
      url: 'https://abitare.odoo.com',
      db: 'abitare-prod',
      username: 'api@abitare.com',
      apiKey: 'secret',
      xmlrpcImpl,
    });

    const uid = await client.authenticate();
    expect(uid).toBe(mockAuthResponse);
    expect(xmlrpcImpl.commonMethodCall).toHaveBeenCalledWith(
      'authenticate',
      ['abitare-prod', 'api@abitare.com', 'secret', {}],
      expect.any(Function),
    );

    await client.authenticate();
    expect(xmlrpcImpl.commonMethodCall).toHaveBeenCalledTimes(1);
  });

  it('searchRead() calls execute_kw with the given model/domain/fields after authenticating', async () => {
    const xmlrpcImpl = createFakeXmlrpcImpl();
    const client = createOdooClient({
      url: 'https://abitare.odoo.com',
      db: 'abitare-prod',
      username: 'api@abitare.com',
      apiKey: 'secret',
      xmlrpcImpl,
    });

    const domain = [['state', 'in', ['sale', 'done']]];
    const result = await client.searchRead('sale.order', domain, ['id', 'name']);

    expect(result).toEqual(mockSaleOrders);
    expect(xmlrpcImpl.objectMethodCall).toHaveBeenCalledWith(
      'execute_kw',
      ['abitare-prod', mockAuthResponse, 'secret', 'sale.order', 'search_read', [domain], { fields: ['id', 'name'] }],
      expect.any(Function),
    );
  });

  it('fetchNewOrders in dry-run returns fixtures without calling the client', async () => {
    const client = { searchRead: vi.fn() };
    const result = await fetchNewOrders({ client, lastSyncDate: '2026-01-01', dryRun: true });
    expect(result).toEqual(mockSaleOrders);
    expect(client.searchRead).not.toHaveBeenCalled();
  });

  it('fetchNewOrders in real mode filters by state and date_order', async () => {
    const client = { searchRead: vi.fn().mockResolvedValue(mockSaleOrders) };
    const result = await fetchNewOrders({ client, lastSyncDate: '2026-06-01', dryRun: false });

    expect(result).toEqual(mockSaleOrders);
    expect(client.searchRead).toHaveBeenCalledWith(
      'sale.order',
      [
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', '2026-06-01'],
      ],
      expect.arrayContaining(['website_id', 'utm_source', 'fbclid', 'gclid']),
    );
  });

  it('parseWebsiteStoreMap parses "id:store" pairs from env format', () => {
    expect(parseWebsiteStoreMap('1:bcn_kids,2:lux_kids,3:lux_living')).toEqual({
      1: 'bcn_kids',
      2: 'lux_kids',
      3: 'lux_living',
    });
  });

  it('parseWebsiteStoreMap returns {} for empty input', () => {
    expect(parseWebsiteStoreMap('')).toEqual({});
    expect(parseWebsiteStoreMap(undefined)).toEqual({});
  });

  it('mapWebsiteIdToStore resolves the store from a many2one tuple', () => {
    const storeMap = { 1: 'bcn_kids', 2: 'lux_kids' };
    expect(mapWebsiteIdToStore([1, 'Abitare Kids Barcelona - Website'], storeMap)).toBe('bcn_kids');
  });

  it('mapWebsiteIdToStore returns "unknown" for unmapped or falsy website_id', () => {
    const storeMap = { 1: 'bcn_kids' };
    expect(mapWebsiteIdToStore([99, 'Otra tienda'], storeMap)).toBe('unknown');
    expect(mapWebsiteIdToStore(false, storeMap)).toBe('unknown');
  });
});
