// "Alcance" (reach) y "Frecuencia" (impressions/reach) son metricas estandar
// de Meta Ads Manager. Google Ads no expone un equivalente directo via GAQL
// basico, asi que queda en 0 para filas de esa plataforma.
export async function up(knex) {
  await knex.schema.alterTable('ad_performance', (table) => {
    table.bigInteger('reach').defaultTo(0);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('ad_performance', (table) => {
    table.dropColumn('reach');
  });
}
