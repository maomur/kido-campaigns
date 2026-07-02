'use client';

import { Card, Title, Text, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge } from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-ES');

const PLATFORM_LABEL = { meta: 'Meta Ads', google: 'Google Ads' };
const PLATFORM_COLOR = { meta: 'blue', google: 'amber' };

// Nivel 2 del dashboard: comparativa directa Meta Ads vs Google Ads.
export default function PlatformComparisonTable({ platforms }) {
  return (
    <Card>
      <Title>Meta Ads vs Google Ads</Title>
      <Text color="gray">Comparativa de canales para el periodo seleccionado</Text>
      {(!platforms || platforms.length === 0) ? (
        <Text className="mt-8 text-center" color="gray">
          Sin datos para el rango/tienda seleccionados.
        </Text>
      ) : (
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Plataforma</TableHeaderCell>
              <TableHeaderCell className="text-right">Gasto</TableHeaderCell>
              <TableHeaderCell className="text-right">Ingresos</TableHeaderCell>
              <TableHeaderCell className="text-right">Compras</TableHeaderCell>
              <TableHeaderCell className="text-right">CPA</TableHeaderCell>
              <TableHeaderCell className="text-right">ROAS</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {platforms.map((row) => (
              <TableRow key={row.platform}>
                <TableCell>
                  <Badge color={PLATFORM_COLOR[row.platform] || 'gray'}>{PLATFORM_LABEL[row.platform] || row.platform}</Badge>
                </TableCell>
                <TableCell className="text-right">{EUR.format(row.spend)}</TableCell>
                <TableCell className="text-right">{EUR.format(row.revenue)}</TableCell>
                <TableCell className="text-right">{NUMBER.format(row.attributedOrders)}</TableCell>
                <TableCell className="text-right">{EUR.format(row.cpa)}</TableCell>
                <TableCell className="text-right">
                  <Badge color={row.roas >= 1 ? 'emerald' : 'rose'}>{row.roas.toFixed(2)}x</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
