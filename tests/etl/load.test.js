import { describe, it, expect, vi } from 'vitest';
import { upsertAdPerformance, upsertOrders, updateSyncLog } from '../../apps/backend/etl/load.js';

function createFakeDb() {
  const merge = vi.fn().mockResolvedValue(undefined);
  const onConflict = vi.fn(() => ({ merge }));
  const insert = vi.fn(() => ({ onConflict }));
  const db = vi.fn(() => ({ insert }));
  db.fn = { now: vi.fn(() => 'NOW()') };
  return { db, insert, onConflict, merge };
}

describe('etl/load', () => {
  it('upsertAdPerformance inserts with onConflict on the platform/store/campaign/adset/ad/date key', async () => {
    const { db, insert, onConflict, merge } = createFakeDb();
    const rows = [{ platform: 'meta', store: 'bcn_kids', campaign_id: '1', adset_id: '2', ad_id: '3', date: '2026-06-01' }];

    const count = await upsertAdPerformance(db, rows);

    expect(db).toHaveBeenCalledWith('ad_performance');
    expect(insert).toHaveBeenCalledWith(rows);
    expect(onConflict).toHaveBeenCalledWith(['platform', 'store', 'campaign_id', 'adset_id', 'ad_id', 'date']);
    expect(merge).toHaveBeenCalled();
    expect(count).toBe(1);
  });

  it('upsertAdPerformance is a no-op for an empty array', async () => {
    const { db, insert } = createFakeDb();
    const count = await upsertAdPerformance(db, []);
    expect(db).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('upsertOrders inserts with onConflict on (store, odoo_name)', async () => {
    const { db, insert, onConflict, merge } = createFakeDb();
    const rows = [{ odoo_name: 'S00901', store: 'bcn_kids', amount_total: 85 }];

    const count = await upsertOrders(db, rows);

    expect(db).toHaveBeenCalledWith('orders');
    expect(insert).toHaveBeenCalledWith(rows);
    expect(onConflict).toHaveBeenCalledWith(['store', 'odoo_name']);
    expect(merge).toHaveBeenCalled();
    expect(count).toBe(1);
  });

  it('updateSyncLog upserts into sync_log keyed by connector+store', async () => {
    const { db, insert, onConflict, merge } = createFakeDb();

    await updateSyncLog(db, { connector: 'odoo', store: null, status: 'success', recordsProcessed: 5 });

    expect(db).toHaveBeenCalledWith('sync_log');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ connector: 'odoo', store: null, status: 'success', records_processed: 5 }),
    );
    expect(onConflict).toHaveBeenCalledWith(['connector', 'store']);
    expect(merge).toHaveBeenCalled();
  });
});
