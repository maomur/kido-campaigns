'use client';

import { Card, Grid, Metric, Text, Flex, BadgeDelta, Title } from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-ES');

function Kpi({ title, value, subtitle, deltaType }) {
  return (
    <Card decoration="top" decorationColor="blue">
      <Flex alignItems="start">
        <Text>{title}</Text>
        {deltaType && <BadgeDelta deltaType={deltaType} />}
      </Flex>
      <Metric className="mt-1">{value}</Metric>
      {subtitle && (
        <Text className="mt-1" color="gray">
          {subtitle}
        </Text>
      )}
    </Card>
  );
}

// Nivel 1 del dashboard: vision ejecutiva. Solo los 6 numeros que importan
// para decidir si la inversion en ads esta funcionando.
export default function ExecutiveKpiCards({ summary }) {
  if (!summary) return null;

  const roasDeltaType = summary.roas >= 1 ? 'increase' : 'decrease';

  return (
    <div>
      <Title>Visión ejecutiva</Title>
      <Grid numItemsSm={2} numItemsLg={3} className="gap-4 mt-3">
        <Kpi title="Gasto total" value={EUR.format(summary.spend)} />
        <Kpi title="Ingresos atribuidos" value={EUR.format(summary.attributedRevenue)} subtitle="Cruzados con pedidos reales" />
        <Kpi title="ROAS" value={`${summary.roas.toFixed(2)}x`} deltaType={roasDeltaType} />
        <Kpi title="Compras" value={NUMBER.format(summary.attributedOrders)} subtitle="Pedidos atribuidos" />
        <Kpi title="CPA" value={EUR.format(summary.cpa)} subtitle="Coste por compra" />
        <Kpi title="Ticket medio" value={EUR.format(summary.aov)} />
      </Grid>
    </div>
  );
}
