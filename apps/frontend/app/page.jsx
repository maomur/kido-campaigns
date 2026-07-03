'use client';

import { useEffect, useState } from 'react';
import { Title, Text, Flex, Select, SelectItem, TextInput, Callout, Card } from '@tremor/react';
import {
  fetchSummary,
  fetchTimeseries,
  fetchCampaigns,
  fetchBreakdown,
  fetchPlatformComparison,
} from '../lib/api.js';
import ExecutiveKpiCards from '../components/ExecutiveKpiCards.jsx';
import PlatformComparisonTable from '../components/PlatformComparisonTable.jsx';
import SpendBreakdownCharts from '../components/SpendBreakdownCharts.jsx';
import EvolutionCharts from '../components/EvolutionCharts.jsx';
import CampaignsTable from '../components/CampaignsTable.jsx';
import DiagnosticKpiCards from '../components/DiagnosticKpiCards.jsx';
import SyncButton from '../components/SyncButton.jsx';

const STORES = [
  { value: '', label: 'Todas las tiendas' },
  { value: 'bcn_kids', label: 'Abitare Kids Barcelona' },
  { value: 'lux_kids', label: 'Abitare Kids Luxemburgo' },
  { value: 'lux_living', label: 'Abitare Living Luxemburgo' },
];

const PLATFORMS = [
  { value: '', label: 'Todas las plataformas' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
];

function defaultDateRange() {
  // Termina ayer, no hoy: el dia en curso todavia esta acumulando gasto en
  // Meta/Google Ads, y sus paneles (Ads Manager, etc.) tampoco lo muestran
  // como un dia cerrado -- incluir "hoy" aqui hacia que el dashboard nunca
  // coincidiera exactamente con lo que el usuario ve ahi.
  const toDate = new Date();
  toDate.setDate(toDate.getDate() - 1);
  const to = toDate.toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export default function DashboardPage() {
  const [store, setStore] = useState('');
  const [platform, setPlatform] = useState('');
  const [{ from, to }, setDateRange] = useState(defaultDateRange);
  const [granularity, setGranularity] = useState('day');
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSummary({ store, platform, from, to }),
      fetchTimeseries({ store, platform, from, to, granularity }),
      fetchCampaigns({ store, platform, from, to }),
      fetchBreakdown({ store, platform, from, to }),
      fetchPlatformComparison({ store, from, to }),
    ])
      .then(([summaryRes, timeseriesRes, campaignsRes, breakdownRes, platformComparisonRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setSeries(timeseriesRes.series);
        setCampaigns(campaignsRes.campaigns);
        setBreakdown(breakdownRes);
        setPlatforms(platformComparisonRes.platforms);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [store, platform, from, to, granularity, refreshKey]);

  return (
    <main className="p-6 md:p-10 max-w-7xl mx-auto">
      <Flex justifyContent="between" alignItems="start" className="flex-wrap gap-3">
        <Flex justifyContent="start" alignItems="center" className="w-auto gap-3">
          <div className="h-9 w-9 rounded-tremor-default bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <div>
            <Title className="text-2xl">Abitare Marketing Dashboard</Title>
            <Text>KPIs reales de Meta Ads / Google Ads cruzados con pedidos confirmados vía atribución.</Text>
          </div>
        </Flex>
        <SyncButton onSyncComplete={() => setRefreshKey((k) => k + 1)} />
      </Flex>

      <Card className="mt-6">
        <Flex justifyContent="start" className="gap-4 flex-wrap" alignItems="end">
          <div className="w-64">
            <Text className="mb-1">Tienda</Text>
            <Select value={store} onValueChange={setStore}>
              {STORES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <Text className="mb-1">Plataforma</Text>
            <Select value={platform} onValueChange={setPlatform}>
              {PLATFORMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <Text className="mb-1">Desde</Text>
            <TextInput
              type="date"
              value={from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            />
          </div>
          <div>
            <Text className="mb-1">Hasta</Text>
            <TextInput
              type="date"
              value={to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </Flex>
      </Card>

      {error && (
        <Callout className="mt-6" title="No se pudo cargar el dashboard" color="rose">
          {error} — ¿el backend está corriendo en {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}?
        </Callout>
      )}

      {loading && !error && (
        <Text className="mt-6" color="gray">
          Cargando…
        </Text>
      )}

      {!loading && !error && (
        <div className="mt-6 space-y-6">
          <ExecutiveKpiCards summary={summary} />

          <div className="space-y-4">
            <PlatformComparisonTable platforms={platforms} />
            <SpendBreakdownCharts breakdown={breakdown} />
          </div>

          <EvolutionCharts series={series} granularity={granularity} onGranularityChange={setGranularity} />

          <DiagnosticKpiCards summary={summary} />

          <CampaignsTable campaigns={campaigns} />
        </div>
      )}
    </main>
  );
}
