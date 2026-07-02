import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../apps/backend/db.js', () => ({ default: {} }));

vi.mock('../../apps/backend/etl/extract.js', () => ({
  extractAll: vi.fn(),
}));

vi.mock('../../apps/backend/etl/transform.js', () => ({
  transformAll: vi.fn(),
}));

vi.mock('../../apps/backend/etl/load.js', () => ({
  upsertAdPerformance: vi.fn(),
  upsertOrders: vi.fn(),
  updateSyncLog: vi.fn(),
}));

vi.mock('../../apps/backend/attribution/engine.js', () => ({
  runAttribution: vi.fn(),
}));

const { extractAll } = await import('../../apps/backend/etl/extract.js');
const { transformAll } = await import('../../apps/backend/etl/transform.js');
const { upsertAdPerformance, upsertOrders, updateSyncLog } = await import('../../apps/backend/etl/load.js');
const { runAttribution } = await import('../../apps/backend/attribution/engine.js');
const { runPipeline } = await import('../../apps/backend/etl/pipeline.js');

function createFakeDb(lastSyncRow = null) {
  const first = vi.fn().mockResolvedValue(lastSyncRow);
  const where = vi.fn(() => ({ first }));
  const db = vi.fn((table) => {
    if (table === 'sync_log') return { where };
    throw new Error(`Tabla inesperada en runPipeline: ${table}`);
  });
  return { db, where, first };
}

describe('etl/pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractAll.mockResolvedValue({
      metaRows: [{ campaign_id: '1' }],
      googleRows: [{ campaign: { id: '2' } }],
      odooOrders: [{ id: 9001 }],
      websiteStoreMap: { 1: 'bcn_kids' },
      errors: [],
    });
    transformAll.mockReturnValue({
      adPerformanceRows: [{ platform: 'meta' }, { platform: 'google' }],
      orderRows: [{ odoo_id: 9001 }],
    });
  });

  it('in dry-run mode: extracts and transforms but does not write to the DB or run attribution', async () => {
    const { db } = createFakeDb();
    const result = await runPipeline({ dryRun: true, db, since: '2026-06-01', until: '2026-06-01' });

    expect(extractAll).toHaveBeenCalledWith({
      since: '2026-06-01',
      until: '2026-06-01',
      lastSyncDates: { odoo: null },
    });
    expect(transformAll).toHaveBeenCalled();
    expect(upsertAdPerformance).not.toHaveBeenCalled();
    expect(upsertOrders).not.toHaveBeenCalled();
    expect(updateSyncLog).not.toHaveBeenCalled();
    expect(runAttribution).not.toHaveBeenCalled();
    expect(result).toEqual({ adPerformanceCount: 2, ordersCount: 1, errors: [], dryRun: true });
  });

  it('in real mode: reads last sync date, writes to DB via load.js, updates sync_log and runs attribution', async () => {
    const { db, where } = createFakeDb({ last_synced_at: '2026-05-01T00:00:00.000Z' });
    upsertAdPerformance.mockResolvedValue(2);
    upsertOrders.mockResolvedValue(1);

    const result = await runPipeline({ dryRun: false, db, since: '2026-06-01', until: '2026-06-01' });

    expect(where).toHaveBeenCalledWith({ connector: 'odoo' });
    expect(extractAll).toHaveBeenCalledWith({
      since: '2026-06-01',
      until: '2026-06-01',
      lastSyncDates: { odoo: '2026-05-01T00:00:00.000Z' },
    });
    expect(upsertAdPerformance).toHaveBeenCalledWith(db, [{ platform: 'meta' }, { platform: 'google' }]);
    expect(upsertOrders).toHaveBeenCalledWith(db, [{ odoo_id: 9001 }]);
    expect(updateSyncLog).toHaveBeenCalledTimes(3);
    expect(updateSyncLog).toHaveBeenCalledWith(db, expect.objectContaining({ connector: 'meta', status: 'success' }));
    expect(updateSyncLog).toHaveBeenCalledWith(db, expect.objectContaining({ connector: 'google', status: 'success' }));
    expect(updateSyncLog).toHaveBeenCalledWith(db, expect.objectContaining({ connector: 'odoo', status: 'success' }));
    expect(runAttribution).toHaveBeenCalledWith({ db });
    expect(result).toEqual({ adPerformanceCount: 2, ordersCount: 1, errors: [], dryRun: false });
  });

  it('marks the connector sync_log entry as "error" when extractAll reports a failure for it', async () => {
    extractAll.mockResolvedValue({
      metaRows: [],
      googleRows: [{ campaign: { id: '2' } }],
      odooOrders: [{ id: 9001 }],
      websiteStoreMap: {},
      errors: [{ connector: 'meta', error: new Error('Meta down') }],
    });
    const { db } = createFakeDb();
    upsertAdPerformance.mockResolvedValue(1);
    upsertOrders.mockResolvedValue(1);

    await runPipeline({ dryRun: false, db, since: '2026-06-01', until: '2026-06-01' });

    expect(updateSyncLog).toHaveBeenCalledWith(db, expect.objectContaining({ connector: 'meta', status: 'error' }));
    expect(updateSyncLog).toHaveBeenCalledWith(db, expect.objectContaining({ connector: 'google', status: 'success' }));
  });

  it('falls back to a computed since/until date range when none is provided', async () => {
    const { db } = createFakeDb();
    await runPipeline({ dryRun: true, db });

    const callArgs = extractAll.mock.calls[0][0];
    expect(typeof callArgs.since).toBe('string');
    expect(typeof callArgs.until).toBe('string');
    expect(callArgs.since <= callArgs.until).toBe(true);
  });
});
