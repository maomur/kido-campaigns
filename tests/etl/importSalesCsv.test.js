import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../apps/backend/db.js', () => ({ default: {} }));
vi.mock('../../apps/backend/etl/load.js', () => ({ upsertOrders: vi.fn() }));
vi.mock('../../apps/backend/attribution/engine.js', () => ({ runAttribution: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');
const { upsertOrders } = await import('../../apps/backend/etl/load.js');
const { runAttribution } = await import('../../apps/backend/attribution/engine.js');
const { importSalesCsvFile } = await import('../../apps/backend/etl/importSalesCsv.js');

const sampleCsv = [
  'Referencia del pedido,Fecha de pedido,Total,Campaña/Nombre de campaña,Origen/Nombre de la fuente,Estado',
  'S00901,2026-06-01 10:00:00,85.00,BCN Kids - Verano 2026,facebook,Pedido de venta',
  'S00999,2026-06-01 09:00:00,10.00,,,Presupuesto',
].join('\n');

describe('etl/importSalesCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses, filters out unconfirmed rows, upserts and runs attribution', async () => {
    readFile.mockResolvedValue(sampleCsv);
    upsertOrders.mockResolvedValue(1);

    const result = await importSalesCsvFile({ filePath: './ventas.csv', store: 'bcn_kids', dryRun: false });

    expect(readFile).toHaveBeenCalledWith('./ventas.csv', 'utf-8');
    expect(upsertOrders).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ odoo_name: 'S00901', store: 'bcn_kids', amount_total: 85 }),
    ]);
    expect(runAttribution).toHaveBeenCalled();
    expect(result).toEqual({ ordersCount: 1, dryRun: false });
  });

  it('in dry-run mode parses and reports counts but does not write to the DB', async () => {
    readFile.mockResolvedValue(sampleCsv);

    const result = await importSalesCsvFile({ filePath: './ventas.csv', store: 'bcn_kids', dryRun: true });

    expect(upsertOrders).not.toHaveBeenCalled();
    expect(runAttribution).not.toHaveBeenCalled();
    expect(result).toEqual({ ordersCount: 1, dryRun: true });
  });

  it('throws when filePath or store are missing', async () => {
    await expect(importSalesCsvFile({ store: 'bcn_kids' })).rejects.toThrow('filePath');
    await expect(importSalesCsvFile({ filePath: './ventas.csv' })).rejects.toThrow('store');
  });

  it('skips stray rows without a reference/date instead of failing the whole import', async () => {
    // Los exports de Odoo a veces incluyen una fila suelta de una nota de
    // actividad multilinea, sin Referencia ni Fecha -- no es un pedido real.
    const csvWithStrayRow = [
      'Referencia del pedido,Fecha de pedido,Total,Campaña/Nombre de campaña,Origen/Nombre de la fuente,Estado',
      'S00901,2026-06-01 10:00:00,85.00,BCN Kids - Verano 2026,facebook,Pedido de venta',
      ',,,,,Entregar junto con el pedido S00850',
    ].join('\n');
    readFile.mockResolvedValue(csvWithStrayRow);
    upsertOrders.mockResolvedValue(1);

    const result = await importSalesCsvFile({ filePath: './ventas.csv', store: 'bcn_kids', dryRun: false });

    expect(upsertOrders).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ odoo_name: 'S00901' })]);
    expect(result).toEqual({ ordersCount: 1, dryRun: false });
  });
});
