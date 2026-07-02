import { describe, it, expect } from 'vitest';
import { parseSalesCsv, parseLocaleAmount } from '../../apps/backend/connectors/salesCsvImport.js';

describe('parseSalesCsv', () => {
  it('parses a comma-delimited CSV with the Spanish Odoo export headers', () => {
    const csv = [
      'Referencia del pedido,Fecha de pedido,Total,Campaña/Nombre de campaña,Origen/Nombre de la fuente,Estado',
      'S00901,2026-06-01 10:00:00,85.00,BCN Kids - Verano 2026,facebook,Pedido de venta',
      'S00902,2026-06-01 11:00:00,60.00,,google,Pedido de venta',
    ].join('\n');

    const rows = parseSalesCsv(csv);

    expect(rows).toEqual([
      {
        reference: 'S00901',
        dateOrder: '2026-06-01 10:00:00',
        amountTotal: '85.00',
        campaignName: 'BCN Kids - Verano 2026',
        sourceName: 'facebook',
        state: 'Pedido de venta',
      },
      {
        reference: 'S00902',
        dateOrder: '2026-06-01 11:00:00',
        amountTotal: '60.00',
        campaignName: null,
        sourceName: 'google',
        state: 'Pedido de venta',
      },
    ]);
  });

  it('auto-detects a semicolon delimiter (common in European locale exports)', () => {
    const csv = [
      'Referencia del pedido;Fecha de pedido;Total;Origen/Nombre de la fuente',
      'S00903;2026-06-01 12:00:00;1.234,56;google',
    ].join('\n');

    const rows = parseSalesCsv(csv);

    expect(rows).toEqual([
      {
        reference: 'S00903',
        dateOrder: '2026-06-01 12:00:00',
        amountTotal: '1.234,56',
        campaignName: null,
        sourceName: 'google',
        state: null,
      },
    ]);
  });

  it('returns an empty array for a CSV with only headers', () => {
    expect(parseSalesCsv('Referencia del pedido,Fecha de pedido,Total')).toEqual([]);
  });

  it('throws a descriptive error when required columns are missing', () => {
    const csv = 'Campaña/Nombre de campaña\nBCN Kids - Verano 2026';
    expect(() => parseSalesCsv(csv)).toThrow(/columnas requeridas/);
  });
});

describe('parseLocaleAmount', () => {
  it('parses a plain decimal amount', () => {
    expect(parseLocaleAmount('85.00')).toBe(85);
  });

  it('parses European format with thousands "." and decimal ","', () => {
    expect(parseLocaleAmount('1.234,56')).toBe(1234.56);
  });

  it('parses a comma as decimal separator with no thousands grouping', () => {
    expect(parseLocaleAmount('85,50')).toBe(85.5);
  });

  it('parses US format with thousands "," and decimal "."', () => {
    expect(parseLocaleAmount('1,234.56')).toBe(1234.56);
  });

  it('returns 0 for empty/null/undefined input', () => {
    expect(parseLocaleAmount('')).toBe(0);
    expect(parseLocaleAmount(null)).toBe(0);
    expect(parseLocaleAmount(undefined)).toBe(0);
  });

  it('strips currency symbols', () => {
    expect(parseLocaleAmount('€85.00')).toBe(85);
  });
});
