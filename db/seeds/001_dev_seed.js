export async function seed(knex) {
  await knex('attribution').del();
  await knex('ad_performance').del();
  await knex('orders').del();
  await knex('sync_log').del();

  await knex('ad_performance').insert([
    {
      platform: 'meta',
      store: 'bcn_kids',
      date: '2026-06-01',
      campaign_id: '1000001',
      campaign_name: 'BCN Kids - Verano 2026',
      adset_id: '2000001',
      adset_name: 'Padres 25-45',
      ad_id: '3000001',
      ad_name: 'Carrusel verano',
      spend: 120.5,
      impressions: 15000,
      clicks: 320,
      conversions: 8,
      conversions_value: 640.0,
    },
    {
      platform: 'google',
      store: 'lux_kids',
      date: '2026-06-01',
      campaign_id: '4000001',
      campaign_name: 'LUX Kids - Search Brand',
      adset_id: '5000001',
      adset_name: 'Brand Terms',
      ad_id: '6000001',
      ad_name: 'RSA Brand 1',
      spend: 80.0,
      impressions: 5000,
      clicks: 210,
      conversions: 12,
      conversions_value: 900.0,
    },
  ]);

  await knex('orders').insert([
    {
      odoo_id: 9001,
      odoo_name: 'S00901',
      store: 'bcn_kids',
      date_order: '2026-06-01 10:00:00',
      amount_total: 85.0,
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'BCN Kids - Verano 2026',
      fbclid: 'IwAR_fake_fbclid_001',
    },
    {
      odoo_id: 9002,
      odoo_name: 'S00902',
      store: 'lux_kids',
      date_order: '2026-06-01 11:00:00',
      amount_total: 60.0,
      utm_source: 'google',
    },
    {
      odoo_id: 9003,
      odoo_name: 'S00903',
      store: 'lux_living',
      date_order: '2026-06-01 12:00:00',
      amount_total: 210.0,
    },
  ]);
}
