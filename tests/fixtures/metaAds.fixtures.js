export const mockInsightsPageA = {
  data: [
    {
      campaign_id: '1000001',
      campaign_name: 'BCN Kids - Verano 2026',
      adset_id: '2000001',
      adset_name: 'Padres 25-45',
      ad_id: '3000001',
      ad_name: 'Carrusel verano',
      spend: '120.50',
      impressions: '15000',
      clicks: '320',
      reach: '9800',
      actions: [
        { action_type: 'link_click', value: '300' },
        { action_type: 'purchase', value: '8' },
      ],
      action_values: [{ action_type: 'purchase', value: '640.00' }],
      date_start: '2026-06-01',
      date_stop: '2026-06-01',
    },
  ],
  paging: {
    cursors: { after: 'CURSOR_PAGE_A' },
    next: 'https://graph.facebook.com/v19.0/act_XXXXXXXXX/insights?after=CURSOR_PAGE_A',
  },
};

export const mockInsightsPageB = {
  data: [
    {
      campaign_id: '1000002',
      campaign_name: 'BCN Kids - Vuelta al cole',
      adset_id: '2000002',
      adset_name: 'Padres 25-45',
      ad_id: '3000002',
      ad_name: 'Imagen unica',
      spend: '45.00',
      impressions: '6000',
      clicks: '110',
      reach: '4200',
      actions: [{ action_type: 'purchase', value: '2' }],
      action_values: [{ action_type: 'purchase', value: '95.00' }],
      date_start: '2026-06-01',
      date_stop: '2026-06-01',
    },
  ],
  paging: {
    cursors: { after: 'CURSOR_PAGE_B' },
    // Sin "next": ultima pagina.
  },
};

export const mockPagingCursor = 'CURSOR_PAGE_A';

export const mockRateLimitError = {
  error: {
    message: 'User request limit reached',
    type: 'OAuthException',
    code: 17,
    fbtrace_id: 'AbCdEf123456',
  },
};
