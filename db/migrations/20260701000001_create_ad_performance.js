export async function up(knex) {
  await knex.schema.createTable('ad_performance', (table) => {
    table.increments('id').primary();
    table.string('platform', 20).notNullable(); // 'meta' | 'google'
    table.string('store', 50).notNullable(); // 'bcn_kids' | 'lux_kids' | 'lux_living'
    table.date('date').notNullable();
    table.string('campaign_id', 100);
    table.string('campaign_name', 255);
    table.string('adset_id', 100);
    table.string('adset_name', 255);
    table.string('ad_id', 100);
    table.string('ad_name', 255);
    table.decimal('spend', 12, 2).defaultTo(0);
    table.bigInteger('impressions').defaultTo(0);
    table.integer('clicks').defaultTo(0);
    table.integer('conversions').defaultTo(0);
    table.decimal('conversions_value', 12, 2).defaultTo(0);
    table.jsonb('raw_payload');
    table.timestamps(true, true);

    table.index(['store', 'date']);
    table.index(['campaign_id']);
    table.index(['platform']);
    // "store" forma parte de la clave: los campaign_id de Google Ads son unicos
    // solo dentro de la cuenta (una por tienda), no globalmente como en Meta.
    table.unique(['platform', 'store', 'campaign_id', 'adset_id', 'ad_id', 'date'], {
      indexName: 'ad_performance_upsert_key',
    });
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('ad_performance');
}
