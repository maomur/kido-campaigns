export const mockGaqlCampaignRows = [
  {
    campaign: { id: '4000001', name: 'LUX Kids - Search Brand' },
    ad_group: { id: '5000001', name: 'Brand Terms' },
    ad_group_ad: { ad: { id: '6000001', name: 'RSA Brand 1' } },
    metrics: {
      cost_micros: '80000000',
      impressions: '5000',
      clicks: '210',
      conversions: 12,
      conversions_value: 900.0,
    },
    segments: { date: '2026-06-01' },
  },
  {
    campaign: { id: '4000002', name: 'LUX Living - Search Generic' },
    ad_group: { id: '5000002', name: 'Muebles' },
    ad_group_ad: { ad: { id: '6000002', name: 'RSA Generic 1' } },
    metrics: {
      cost_micros: '150000000',
      impressions: '9000',
      clicks: '400',
      conversions: 5,
      conversions_value: 1050.0,
    },
    segments: { date: '2026-06-01' },
  },
];

export const mockEmptyResult = [];

export const mockAuthError = Object.assign(
  new Error('invalid_grant: Token has been expired or revoked.'),
  { code: 'UNAUTHENTICATED' },
);
