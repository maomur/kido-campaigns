const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API ${path} respondio ${response.status}`);
  }
  return response.json();
}

export function fetchSummary(params) {
  return getJson(`/api/kpis/summary${buildQuery(params)}`);
}

export function fetchTimeseries(params) {
  return getJson(`/api/kpis/timeseries${buildQuery(params)}`);
}

export function fetchCampaigns(params) {
  return getJson(`/api/campaigns${buildQuery(params)}`);
}

export function fetchBreakdown(params) {
  return getJson(`/api/kpis/breakdown${buildQuery(params)}`);
}

export function fetchPlatformComparison(params) {
  return getJson(`/api/kpis/platform-comparison${buildQuery(params)}`);
}
