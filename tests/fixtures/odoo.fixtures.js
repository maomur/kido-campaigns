// Odoo XML-RPC devuelve `false` (no `null`/`''`) para campos Char vacios via search_read.
// Los fixtures reflejan ese comportamiento a proposito para que transform/attribution lo manejen.

// website_id llega como tupla [id, display_name] en search_read, tal como lo devuelve
// Odoo para los campos many2one. El mapeo website_id -> store se hace en el conector
// (ver ODOO_WEBSITE_STORE_MAP en .env.example) para soportar las 3 tiendas desde un
// unico despliegue de Odoo, tal como requiere el negocio.
export const mockSaleOrders = [
  {
    id: 9001,
    name: 'S00901',
    date_order: '2026-06-01 10:00:00',
    amount_total: 85.0,
    state: 'sale',
    website_id: [1, 'Abitare Kids Barcelona - Website'],
    utm_source: 'facebook',
    utm_medium: 'cpc',
    utm_campaign: 'BCN Kids - Verano 2026',
    utm_content: false,
    utm_term: false,
    fbclid: 'IwAR_fake_fbclid_001',
    gclid: false,
  },
  {
    id: 9002,
    name: 'S00902',
    date_order: '2026-06-01 11:00:00',
    amount_total: 60.0,
    state: 'sale',
    website_id: [2, 'Abitare Kids Luxembourg - Website'],
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: false,
    utm_content: false,
    utm_term: false,
    fbclid: false,
    gclid: 'Cj0KCQ_fake_gclid_001',
  },
  {
    id: 9003,
    name: 'S00903',
    date_order: '2026-06-01 12:00:00',
    amount_total: 45.0,
    state: 'sale',
    website_id: [2, 'Abitare Kids Luxembourg - Website'],
    utm_source: false,
    utm_medium: false,
    utm_campaign: 'LUX Kids - Search Brand',
    utm_content: false,
    utm_term: false,
    fbclid: false,
    gclid: false,
  },
  {
    id: 9004,
    name: 'S00904',
    date_order: '2026-06-01 13:00:00',
    amount_total: 30.0,
    state: 'sale',
    website_id: [3, 'Abitare Living Luxembourg - Website'],
    utm_source: 'google',
    utm_medium: 'organic',
    utm_campaign: false,
    utm_content: false,
    utm_term: false,
    fbclid: false,
    gclid: false,
  },
  {
    id: 9005,
    name: 'S00905',
    date_order: '2026-06-01 14:00:00',
    amount_total: 210.0,
    state: 'sale',
    website_id: [1, 'Abitare Kids Barcelona - Website'],
    utm_source: false,
    utm_medium: false,
    utm_campaign: false,
    utm_content: false,
    utm_term: false,
    fbclid: false,
    gclid: false,
  },
];

export const mockAuthResponse = 2; // uid simulado de common.authenticate

export const mockEmptyIncrementalResult = [];
