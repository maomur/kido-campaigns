'use client';

import { Card, Grid, Metric, Text, Flex, BadgeDelta, Title } from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-ES');

function Kpi({ title, value, subtitle, deltaType, decorationColor = 'blue' }) {
  return (
    <Card decoration="top" decorationColor={decorationColor}>
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

// Nivel 1 del dashboard: vision ejecutiva. Los numeros que importan para
// decidir si la inversion en ads esta funcionando. "Compras confirmadas" (azul)
// viene de pedidos reales de Odoo cruzados por atribucion; "Reportadas por
// Meta/Google" (ambar) es el conteo de conversiones que las propias
// plataformas afirman haber generado, sin verificar contra un pedido real --
// util mientras Odoo no confirma automaticamente, pero no intercambiable con
// la primera (ver CLAUDE.md, seccion de atribucion).
export default function ExecutiveKpiCards({ summary }) {
  if (!summary) return null;

  const roasDeltaType = summary.roas >= 1 ? 'increase' : 'decrease';

  return (
    <div>
      <Title>Visión ejecutiva</Title>
      <Grid numItemsSm={2} numItemsLg={4} className="gap-4 mt-3">
        <Kpi title="Gasto total" value={EUR.format(summary.spend)} />
        <Kpi title="Ingresos atribuidos" value={EUR.format(summary.attributedRevenue)} subtitle="Cruzados con pedidos reales" />
        <Kpi title="ROAS" value={`${summary.roas.toFixed(2)}x`} deltaType={roasDeltaType} />
        <Kpi title="CPA" value={EUR.format(summary.cpa)} subtitle="Coste por compra confirmada" />
        <Kpi title="Compras confirmadas" value={NUMBER.format(summary.attributedOrders)} subtitle="Pedidos reales atribuidos (Odoo)" />
        <Kpi
          title="Reportadas por Meta/Google"
          value={NUMBER.format(summary.reportedConversions)}
          subtitle="Sin confirmar en Odoo todavía"
          decorationColor="amber"
        />
        <Kpi title="Ticket medio" value={EUR.format(summary.aov)} />
      </Grid>
    </div>
  );
}
