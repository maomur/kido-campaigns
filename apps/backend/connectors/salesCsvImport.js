import { parse } from 'csv-parse/sync';

// Sin acceso a la API de Odoo, los pedidos se cargan via CSV exportado
// manualmente desde Odoo (Ventas > Pedidos > Exportar), un archivo por
// tienda/compania. Las cabeceras son las etiquetas visibles del selector de
// export de Odoo (en espanol), no los nombres tecnicos de los campos.
const FIELD_ALIASES = {
  reference: ['referencia del pedido', 'referencia', 'pedido', 'order reference', 'name', 'numero de pedido'],
  dateOrder: ['fecha de pedido', 'fecha', 'order date', 'fecha del pedido'],
  amountTotal: ['total', 'importe', 'amount total', 'total del pedido'],
  campaignName: ['campana/nombre de campana', 'nombre de campana', 'campaign/campaign name', 'campaign name', 'campana'],
  sourceName: ['origen/nombre de la fuente', 'nombre de la fuente', 'source/source name', 'source name', 'origen'],
  state: ['estado', 'state', 'status'],
};

const REQUIRED_FIELDS = ['reference', 'dateOrder', 'amountTotal'];

function normalizeHeader(header) {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos/tildes (campaña -> campana)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function resolveFieldMap(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const fieldMap = {};
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (index !== -1) fieldMap[canonical] = headers[index];
  }
  return fieldMap;
}

// Odoo en varias regiones exporta CSV separado por ";" (locales que usan "," como
// separador decimal). Se detecta por el delimitador mas frecuente en la cabecera.
function detectDelimiter(csvContent) {
  const firstLine = csvContent.split(/\r?\n/, 1)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

// Acepta tanto "1234.56" como el formato europeo "1.234,56".
export function parseLocaleAmount(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return 0;
  const cleaned = String(rawValue).replace(/[^\d.,-]/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }

  return Number(normalized) || 0;
}

export function parseSalesCsv(csvContent) {
  const delimiter = detectDelimiter(csvContent);
  const records = parse(csvContent, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (records.length === 0) return [];

  const fieldMap = resolveFieldMap(Object.keys(records[0]));
  const missing = REQUIRED_FIELDS.filter((field) => !fieldMap[field]);
  if (missing.length > 0) {
    throw new Error(
      `El CSV no tiene las columnas requeridas (${missing.join(', ')}). Revisa docs/architecture.md para el checklist de export.`,
    );
  }

  return records.map((record) => ({
    reference: record[fieldMap.reference],
    dateOrder: record[fieldMap.dateOrder],
    amountTotal: record[fieldMap.amountTotal],
    campaignName: fieldMap.campaignName ? record[fieldMap.campaignName] || null : null,
    sourceName: fieldMap.sourceName ? record[fieldMap.sourceName] || null : null,
    state: fieldMap.state ? record[fieldMap.state] || null : null,
  }));
}
