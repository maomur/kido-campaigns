'use client';

import { Card, Title, Text, AreaChart, LineChart, Grid, Flex } from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
];

// Nivel 3 del dashboard: evolucion temporal (gasto vs ingresos, y ROAS) con
// toggle de granularidad dia/semana que controla ambos graficos a la vez.
export default function EvolutionCharts({ series, granularity, onGranularityChange }) {
  const spendRevenueData = (series || []).map((point) => ({
    Fecha: point.date,
    Gasto: point.spend,
    Ingresos: point.revenue,
  }));

  const roasData = (series || []).map((point) => ({
    Fecha: point.date,
    ROAS: point.roas,
  }));

  return (
    <div>
      <Flex justifyContent="between" alignItems="center">
        <Title>Evolución</Title>
        <div className="flex gap-1 rounded-tremor-default border border-tremor-border bg-white p-1">
          {GRANULARITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onGranularityChange(option.value)}
              className={`rounded-tremor-small px-3 py-1 text-tremor-default transition ${
                granularity === option.value
                  ? 'bg-blue-600 text-white'
                  : 'text-tremor-content hover:bg-tremor-background-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Flex>

      <Grid numItemsMd={2} className="gap-4 mt-3">
        <Card>
          <Title>Gasto vs. Ingresos</Title>
          <Text color="gray">Gasto real en Ads frente a ingresos de pedidos confirmados</Text>
          {spendRevenueData.length === 0 ? (
            <Text className="mt-8 text-center" color="gray">
              Sin datos para el rango seleccionado.
            </Text>
          ) : (
            <AreaChart
              className="mt-6 h-64"
              data={spendRevenueData}
              index="Fecha"
              categories={['Gasto', 'Ingresos']}
              colors={['rose', 'emerald']}
              valueFormatter={(value) => EUR.format(value)}
              showAnimation
            />
          )}
        </Card>

        <Card>
          <Title>ROAS</Title>
          <Text color="gray">Ingresos atribuidos / gasto, por periodo</Text>
          {roasData.length === 0 ? (
            <Text className="mt-8 text-center" color="gray">
              Sin datos para el rango seleccionado.
            </Text>
          ) : (
            <LineChart
              className="mt-6 h-64"
              data={roasData}
              index="Fecha"
              categories={['ROAS']}
              colors={['violet']}
              valueFormatter={(value) => `${value.toFixed(2)}x`}
              showAnimation
            />
          )}
        </Card>
      </Grid>
    </div>
  );
}
