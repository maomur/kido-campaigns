function round2(value) {
  return Number(value.toFixed(2));
}

export function calculateROAS(revenue, spend) {
  return spend > 0 ? round2(revenue / spend) : 0;
}

export function calculateCPA(spend, conversions) {
  return conversions > 0 ? round2(spend / conversions) : 0;
}

export function calculateAOV(revenue, orders) {
  return orders > 0 ? round2(revenue / orders) : 0;
}

export function calculateCTR(clicks, impressions) {
  return impressions > 0 ? round2((clicks / impressions) * 100) : 0;
}

export function calculateCPC(spend, clicks) {
  return clicks > 0 ? round2(spend / clicks) : 0;
}

export function calculateCPM(spend, impressions) {
  return impressions > 0 ? round2((spend / impressions) * 1000) : 0;
}

export function calculateFrequency(impressions, reach) {
  return reach > 0 ? round2(impressions / reach) : 0;
}

export function calculateConversionRate(orders, clicks) {
  return clicks > 0 ? round2((orders / clicks) * 100) : 0;
}
