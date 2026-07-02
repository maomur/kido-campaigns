'use client';

import { Card, Grid, Metric, Text, Flex, Title } from '@tremor/react';

const EUR2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

function Kpi({ title, value, subtitle }) {
  return (
    <Card decoration="top" decorationColor="gray">
      <Flex alignItems="start">
        <Text>{title}</Text>
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

// Nivel 6 del dashboard: metricas de diagnostico de calidad del anuncio,
// no de resultado de negocio (esas viven en ExecutiveKpiCards).
export default function DiagnosticKpiCards({ summary }) {
  if (!summary) return null;

  return (
    <div>
      <Title>Diagnóstico de anuncios</Title>
      <Text color="gray">Métricas crudas reportadas por las plataformas, para evaluar calidad de la creatividad/segmentación</Text>
      <Grid numItemsSm={2} numItemsLg={5} className="gap-4 mt-3">
        <Kpi title="CTR" value={`${summary.ctr.toFixed(2)}%`} subtitle="Clics / impresiones" />
        <Kpi title="CPC" value={EUR2.format(summary.cpc)} subtitle="Coste por clic" />
        <Kpi title="CPM" value={EUR2.format(summary.cpm)} subtitle="Coste por mil impresiones" />
        <Kpi title="Frecuencia" value={`${summary.frequency.toFixed(2)}x`} subtitle="Impresiones / alcance" />
        <Kpi title="Tasa de conversión" value={`${summary.conversionRate.toFixed(2)}%`} subtitle="Compras / clics" />
      </Grid>
    </div>
  );
}
