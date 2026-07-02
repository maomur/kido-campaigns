'use client';

import { Card, Title, Text, DonutChart, Legend, Grid, Flex } from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const STORE_LABEL = {
  bcn_kids: 'Abitare Kids Barcelona',
  lux_kids: 'Abitare Kids Luxemburgo',
  lux_living: 'Abitare Living Luxemburgo',
  unknown: 'Sin asignar',
};

const PLATFORM_LABEL = { meta: 'Meta Ads', google: 'Google Ads' };

function DonutCard({ title, data, colors }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card>
      <Title>{title}</Title>
      {data.length === 0 || total === 0 ? (
        <Text className="mt-8 text-center" color="gray">
          Sin datos para el rango seleccionado.
        </Text>
      ) : (
        <Flex flexDirection="col" className="mt-4">
          <DonutChart
            data={data}
            category="value"
            index="name"
            colors={colors}
            valueFormatter={(value) => EUR.format(value)}
            className="h-52"
          />
          <Legend
            className="mt-4"
            categories={data.map((item) => item.name)}
            colors={colors}
          />
        </Flex>
      )}
    </Card>
  );
}

export default function SpendBreakdownCharts({ breakdown }) {
  if (!breakdown) return null;

  const byStore = (breakdown.byStore || [])
    .map((item) => ({ name: STORE_LABEL[item.store] || item.store, value: item.spend }))
    .sort((a, b) => b.value - a.value);

  const byPlatform = (breakdown.byPlatform || [])
    .map((item) => ({ name: PLATFORM_LABEL[item.platform] || item.platform, value: item.spend }))
    .sort((a, b) => b.value - a.value);

  return (
    <Grid numItemsMd={2} className="gap-4">
      <DonutCard title="Gasto por tienda" data={byStore} colors={['blue', 'violet', 'amber']} />
      <DonutCard title="Gasto por plataforma" data={byPlatform} colors={['blue', 'amber']} />
    </Grid>
  );
}
