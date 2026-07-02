export async function up(knex) {
  await knex.schema.createTable('sync_log', (table) => {
    table.increments('id').primary();
    table.string('connector', 20).notNullable(); // odoo | meta | google
    table.string('store', 50).nullable();
    table.timestamp('last_synced_at').notNullable();
    table.string('status', 20).notNullable(); // success | error
    table.integer('records_processed').defaultTo(0);
    table.text('error_message');
    table.timestamps(true, true);

    table.unique(['connector', 'store']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sync_log');
}
