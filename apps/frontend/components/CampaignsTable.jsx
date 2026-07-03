'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Flex,
  Button,
  TextInput,
} from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-ES');

const PAGE_SIZE = 20;

// Viñeta compacta junto al nombre de la campaña, en vez de una columna de
// Plataforma completa: circulo amarillo "G" (Google) / cuadrado azul "M" (Meta).
function PlatformMarker({ platform }) {
  if (platform === 'google') {
    return (
      <span
        title="Google Ads"
        className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold leading-none text-white"
      >
        G
      </span>
    );
  }
  if (platform === 'meta') {
    return (
      <span
        title="Meta Ads"
        className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-[10px] font-bold leading-none text-white"
      >
        M
      </span>
    );
  }
  return null;
}

// Columnas ordenables: clave -> como leer el valor a comparar y direccion por
// defecto al hacer click por primera vez (numericas empiezan en desc, texto en asc).
// "Confirmadas" (pedidos reales de Odoo via atribucion) y "Reportadas" (conteo
// crudo de conversiones que la propia plataforma afirma, sin verificar) se
// muestran una junto a la otra a proposito, pero nunca deben confundirse -- ver
// nota en ExecutiveKpiCards.jsx.
const COLUMNS = [
  { key: 'campaignName', label: 'Campaña', type: 'string', accessor: (c) => c.campaignName || c.campaignId || '' },
  { key: 'spend', label: 'Gasto', type: 'number', accessor: (c) => c.spend, align: 'right' },
  { key: 'impressions', label: 'Impresiones', type: 'number', accessor: (c) => c.impressions, align: 'right' },
  { key: 'reach', label: 'Alcance', type: 'number', accessor: (c) => c.reach, align: 'right' },
  {
    key: 'attributedOrders',
    label: 'Confirmadas',
    title: 'Pedidos reales de Odoo cruzados con esta campaña',
    type: 'number',
    accessor: (c) => c.attributedOrders,
    align: 'right',
  },
  {
    key: 'reportedConversions',
    label: 'Reportadas',
    title: 'Conversiones que reporta la propia plataforma (Meta/Google), sin confirmar en Odoo',
    type: 'number',
    accessor: (c) => c.reportedConversions,
    align: 'right',
  },
  {
    key: 'revenue',
    label: 'Ingresos',
    title: 'Ingresos de pedidos reales de Odoo cruzados con esta campaña',
    type: 'number',
    accessor: (c) => c.revenue,
    align: 'right',
  },
  {
    key: 'reportedRevenue',
    label: 'Ing. reportados',
    title: 'Ingresos que estima la propia plataforma (Meta/Google) a partir de sus conversiones reportadas, sin confirmar en Odoo',
    type: 'number',
    accessor: (c) => c.reportedRevenue,
    align: 'right',
  },
  { key: 'roas', label: 'ROAS', type: 'number', accessor: (c) => c.roas, align: 'right' },
];

// Nivel 4 del dashboard: ranking de campanas, ordenable por columna.
export default function CampaignsTable({ campaigns }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('spend');
  const [sortDirection, setSortDirection] = useState('desc');

  // Si cambian los filtros (tienda/plataforma/fechas) y llega una lista nueva,
  // volver a la primera pagina en vez de dejar una pagina fuera de rango.
  useEffect(() => {
    setPage(1);
  }, [campaigns]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function handleSort(column) {
    if (column.key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setSortDirection(column.type === 'number' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    const term = search.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter((c) => (c.campaignName || c.campaignId || '').toLowerCase().includes(term));
  }, [campaigns, search]);

  const sortedCampaigns = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sortKey);
    if (!column) return filteredCampaigns;
    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...filteredCampaigns].sort((a, b) => {
      const valueA = column.accessor(a);
      const valueB = column.accessor(b);
      if (column.type === 'number') return (valueA - valueB) * factor;
      return String(valueA).localeCompare(String(valueB), 'es') * factor;
    });
  }, [filteredCampaigns, sortKey, sortDirection]);

  const total = sortedCampaigns.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sortedCampaigns.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <Flex justifyContent="between" alignItems="start" className="flex-wrap gap-2">
        <Title>Campañas</Title>
        <TextInput
          className="w-64"
          placeholder="Buscar campaña..."
          value={search}
          onValueChange={setSearch}
        />
      </Flex>
      {total === 0 ? (
        <Text className="mt-8 text-center" color="gray">
          {search.trim() ? 'Ninguna campaña coincide con la búsqueda.' : 'Sin campañas para el rango/tienda seleccionados.'}
        </Text>
      ) : (
        <>
          <Table className="mt-4 max-h-[560px]">
            <TableHead>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableHeaderCell
                    key={column.key}
                    title={column.title}
                    className={`sticky top-0 z-10 bg-white cursor-pointer select-none hover:text-tremor-content-emphasis ${column.align === 'right' ? 'text-right' : ''} ${column.key === 'campaignName' ? 'w-40' : ''}`}
                    onClick={() => handleSort(column)}
                  >
                    {column.label}
                    {sortKey === column.key && (
                      <span className="ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pageItems.map((campaign) => (
                <TableRow key={`${campaign.platform}-${campaign.store}-${campaign.campaignId}`}>
                  <TableCell>
                    <span className="flex max-w-[160px] items-center whitespace-normal break-words">
                      <PlatformMarker platform={campaign.platform} />
                      {campaign.campaignName || campaign.campaignId}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{EUR.format(campaign.spend)}</TableCell>
                  <TableCell className="text-right">{NUMBER.format(campaign.impressions)}</TableCell>
                  <TableCell className="text-right">{NUMBER.format(campaign.reach)}</TableCell>
                  <TableCell className="text-right">{NUMBER.format(campaign.attributedOrders)}</TableCell>
                  <TableCell className="text-right text-amber-700">{NUMBER.format(campaign.reportedConversions)}</TableCell>
                  <TableCell className="text-right">{EUR.format(campaign.revenue)}</TableCell>
                  <TableCell className="text-right text-amber-700">{EUR.format(campaign.reportedRevenue)}</TableCell>
                  <TableCell className="text-right">
                    <Badge color={campaign.roas >= 1 ? 'emerald' : 'rose'}>{campaign.roas.toFixed(2)}x</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Flex justifyContent="between" alignItems="center" className="mt-4">
            <Text color="gray">
              Mostrando {start + 1}–{Math.min(start + PAGE_SIZE, total)} de {total} campañas
            </Text>
            <Flex justifyContent="end" className="gap-2" alignItems="center">
              <Button
                size="xs"
                variant="secondary"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Text>
                Página {currentPage} de {totalPages}
              </Text>
              <Button
                size="xs"
                variant="secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Card>
  );
}
