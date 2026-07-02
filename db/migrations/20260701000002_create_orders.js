export async function up(knex) {
  await knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.integer('odoo_id').notNullable().unique();
    table.string('odoo_name', 50);
    table.string('store', 50).notNullable();
    table.timestamp('date_order').notNullable();
    table.decimal('amount_total', 12, 2).defaultTo(0);
    table.string('currency', 10).defaultTo('EUR');
    table.string('state', 20);
    table.string('utm_source', 100);
    table.string('utm_medium', 100);
    table.string('utm_campaign', 255);
    table.string('utm_content', 255);
    table.string('utm_term', 255);
    table.string('fbclid', 255);
    table.string('gclid', 255);
    table.timestamps(true, true);

    table.index(['store', 'date_order']);
    table.index(['utm_campaign']);
    table.index(['fbclid']);
    table.index(['gclid']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('orders');
}
