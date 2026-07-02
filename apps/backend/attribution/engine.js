import { createLogger } from '../utils/logger.js';

const logger = createLogger('attribution:engine');

const SOURCE_TO_PLATFORM = {
  facebook: 'meta',
  fb: 'meta',
  instagram: 'meta',
  google: 'google',
  'google ads': 'google',
};

export function classifyConfidence(order) {
  if (order.fbclid || order.gclid) return 'high';
  if (order.utm_campaign) return 'medium';
  if (order.utm_source) return 'low';
  return 'none';
}

function normalizeSourceToPlatform(utmSource) {
  if (!utmSource) return null;
  return SOURCE_TO_PLATFORM[utmSource.trim().toLowerCase()] || null;
}

// Limitacion conocida: la Insights API agregada de Meta/Google no expone click IDs
// individuales, asi que la atribucion de "alta confianza" es best-effort por
// plataforma + tienda + fecha cercana al pedido, no un join literal contra
// fbclid/gclid. Si no hay ad_performance para esa combinacion, se conserva la
// confianza "high" (sabemos que vino de un clic directo) con ad_performance_id nulo.
export function matchByClickId(order, adPerformanceRows) {
  const platform = order.fbclid ? 'meta' : order.gclid ? 'google' : null;
  if (!platform) return null;

  const orderDate = new Date(order.date_order).toISOString().slice(0, 10);
  const candidates = adPerformanceRows.filter((row) => row.platform === platform && row.store === order.store);
  return candidates.find((row) => row.date === orderDate) || candidates[0] || null;
}

export function matchByCampaignName(order, adPerformanceRows) {
  if (!order.utm_campaign) return null;
  const target = order.utm_campaign.trim().toLowerCase();
  // Filtrar tambien por tienda: nombres de campana se repiten entre tiendas
  // (ej. campanas estacionales "Soldes d'ete 2026" en varias tiendas de
  // Luxemburgo) -- sin esto, un pedido podia atribuirse a la campana de OTRA
  // tienda con el mismo nombre.
  return (
    adPerformanceRows.find(
      (row) => row.store === order.store && row.campaign_name && row.campaign_name.trim().toLowerCase() === target,
    ) || null
  );
}

export function matchByPlatformOnly(order, adPerformanceRows) {
  const platform = normalizeSourceToPlatform(order.utm_source);
  if (!platform) return null;
  return adPerformanceRows.find((row) => row.platform === platform && row.store === order.store) || null;
}

export async function runAttribution({ db, model = 'last_click' } = {}) {
  const pendingOrders = await db('orders')
    .leftJoin('attribution', function joinOnModel() {
      this.on('attribution.order_id', '=', 'orders.id').andOnVal('attribution.model', model);
    })
    .whereNull('attribution.id')
    .select('orders.*');

  if (pendingOrders.length === 0) {
    logger.info('No hay pedidos pendientes de atribucion');
    return { attributed: 0, skipped: 0 };
  }

  const adPerformanceRows = await db('ad_performance').select('*');

  let attributed = 0;
  let skipped = 0;

  for (const order of pendingOrders) {
    const confidence = classifyConfidence(order);

    // Pedidos sin ningun dato de tracking no generan fila: no hay fuente que
    // registrar. Se derivan como "sin atribuir" en reporting via LEFT JOIN
    // orders -> attribution filtrando attribution.id IS NULL.
    if (confidence === 'none') {
      skipped += 1;
      continue;
    }

    let attributionType;
    let matchedRow = null;

    if (confidence === 'high') {
      attributionType = 'direct_click';
      matchedRow = matchByClickId(order, adPerformanceRows);
    } else if (confidence === 'medium') {
      attributionType = 'utm_campaign';
      matchedRow = matchByCampaignName(order, adPerformanceRows);
    } else {
      // Confianza baja: solo se conoce la plataforma de origen (utm_source), no
      // una campana concreta. ad_performance_id se deja siempre en null aunque
      // exista alguna fila de esa plataforma+tienda -- matchByPlatformOnly no se
      // usa aqui a proposito, ver decision de diseno mas abajo.
      attributionType = 'utm_source';
      matchedRow = null;
    }

    await db('attribution')
      .insert({
        order_id: order.id,
        ad_performance_id: matchedRow ? matchedRow.id : null,
        attribution_type: attributionType,
        confidence,
        model,
      })
      .onConflict(['order_id', 'model'])
      .merge();

    attributed += 1;
  }

  logger.info(`Atribucion completada: ${attributed} pedidos atribuidos, ${skipped} sin tracking`);
  return { attributed, skipped };
}
