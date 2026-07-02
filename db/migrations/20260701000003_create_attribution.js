export async function up(knex) {
  await knex.schema.createTable('attribution', (table) => {
    table.increments('id').primary();
    table
      .integer('order_id')
      .notNullable()
      .references('id')
      .inTable('orders')
      .onDelete('CASCADE');
    table
      .integer('ad_performance_id')
      .nullable()
      .references('id')
      .inTable('ad_performance')
      .onDelete('SET NULL');
    table.string('attribution_type', 50).notNullable(); // direct_click | utm_campaign | utm_source
    table.string('confidence', 20).notNullable(); // high | medium | low
    table.string('model', 20).notNullable().defaultTo('last_click');
    table.timestamps(true, true);

    table.index(['order_id']);
    table.index(['ad_performance_id']);
    table.index(['attribution_type']);
    table.unique(['order_id', 'model']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('attribution');
}
