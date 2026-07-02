// Sin acceso a la API de Odoo (ver docs/architecture.md), los pedidos se cargan
// via exportacion manual de CSV por tienda/compania, que no trae el ID interno
// numerico de Odoo. odoo_id pasa a ser opcional, y (store, odoo_name) -- la
// referencia del pedido, siempre presente en cualquier fuente -- se vuelve la
// clave natural para el upsert idempotente.
export async function up(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.integer('odoo_id').nullable().alter();
    table.unique(['store', 'odoo_name'], { indexName: 'orders_store_name_upsert_key' });
  });
}

export async function down(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropUnique(['store', 'odoo_name'], 'orders_store_name_upsert_key');
    table.integer('odoo_id').notNullable().alter();
  });
}
