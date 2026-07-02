import { mapWebsiteIdToStore } from '../connectors/odoo.js';
import { parseLocaleAmount } from '../connectors/salesCsvImport.js';

// Odoo XML-RPC devuelve `false` para campos Char vacios; se normaliza a null.
function odooValueOrNull(value) {
  return value === false ? null : value;
}

function sumActionValue(actions = [], actionType) {
  const match = actions.find((action) => action.action_type === actionType);
  return match ? Number(match.value) : 0;
}

export function transformMetaRow(rawRow, store) {
  return {
    platform: 'meta',
    store,
    date: rawRow.date_start,
    campaign_id: rawRow.campaign_id,
    campaign_name: rawRow.campaign_name,
    // '' en vez de null/undefined: Postgres nunca trata dos NULL como iguales
    // en un indice unico, asi que con level='campaign' (sin adset_id/ad_id)
    // cada upsert insertaria una fila nueva en vez de actualizar la existente.
    adset_id: rawRow.adset_id || '',
    adset_name: rawRow.adset_name,
    ad_id: rawRow.ad_id || '',
    ad_name: rawRow.ad_name,
    spend: Number(rawRow.spend),
    impressions: Number(rawRow.impressions),
    clicks: Number(rawRow.clicks),
    reach: Number(rawRow.reach) || 0,
    conversions: sumActionValue(rawRow.actions, 'purchase'),
    conversions_value: sumActionValue(rawRow.action_values, 'purchase'),
    raw_payload: rawRow,
  };
}

export function transformGoogleRow(rawRow, store) {
  return {
    platform: 'google',
    store,
    date: rawRow.segments.date,
    campaign_id: rawRow.campaign.id,
    campaign_name: rawRow.campaign.name,
    adset_id: rawRow.ad_group.id,
    adset_name: rawRow.ad_group.name,
    ad_id: rawRow.ad_group_ad.ad.id,
    ad_name: rawRow.ad_group_ad.ad.name,
    spend: Number(rawRow.metrics.cost_micros) / 1e6,
    impressions: Number(rawRow.metrics.impressions),
    clicks: Number(rawRow.metrics.clicks),
    // Google Ads no expone "reach" de forma estandar via GAQL basico.
    reach: 0,
    // Google Ads puede reportar conversiones fraccionarias segun el modelo de
    // atribucion configurado en la cuenta; se redondean porque
    // ad_performance.conversions es INTEGER.
    conversions: Math.round(Number(rawRow.metrics.conversions)),
    conversions_value: Number(rawRow.metrics.conversions_value),
    raw_payload: rawRow,
  };
}

export function transformOdooOrder(rawOrder, websiteStoreMap = {}) {
  return {
    odoo_id: rawOrder.id,
    odoo_name: rawOrder.name,
    store: mapWebsiteIdToStore(rawOrder.website_id, websiteStoreMap),
    date_order: rawOrder.date_order,
    amount_total: Number(rawOrder.amount_total),
    state: rawOrder.state,
    utm_source: odooValueOrNull(rawOrder.utm_source),
    utm_medium: odooValueOrNull(rawOrder.utm_medium),
    utm_campaign: odooValueOrNull(rawOrder.utm_campaign),
    utm_content: odooValueOrNull(rawOrder.utm_content),
    utm_term: odooValueOrNull(rawOrder.utm_term),
    fbclid: odooValueOrNull(rawOrder.fbclid),
    gclid: odooValueOrNull(rawOrder.gclid),
  };
}

// Fuente alternativa a XML-RPC: export manual de "Ventas > Pedidos" en Odoo
// (ver connectors/salesCsvImport.js y docs/architecture.md). No trae el ID
// interno de Odoo ni utm_medium/utm_content/utm_term/fbclid/gclid -- solo
// campaign/source nativos de Odoo (utm.mixin), suficientes para atribucion de
// confianza media y baja.
export function transformCsvOrder(rawRow, store) {
  return {
    odoo_id: null,
    odoo_name: rawRow.reference,
    store,
    date_order: rawRow.dateOrder,
    amount_total: parseLocaleAmount(rawRow.amountTotal),
    state: rawRow.state || null,
    utm_source: rawRow.sourceName || null,
    utm_medium: null,
    utm_campaign: rawRow.campaignName || null,
    utm_content: null,
    utm_term: null,
    fbclid: null,
    gclid: null,
  };
}

export function transformAll({ metaRows = [], googleRows = [], odooOrders = [], websiteStoreMap = {} }) {
  return {
    adPerformanceRows: [
      ...metaRows.map((row) => transformMetaRow(row, row.store)),
      ...googleRows.map((row) => transformGoogleRow(row, row.store)),
    ],
    orderRows: odooOrders.map((order) => transformOdooOrder(order, websiteStoreMap)),
  };
}
