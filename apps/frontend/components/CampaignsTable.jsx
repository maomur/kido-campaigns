'use client';

import { useEffect, useState } from 'react';
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
} from '@tremor/react';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-ES');

const PLATFORM_LABEL = { meta: 'Meta Ads', google: 'Google Ads' };
const PLATFORM_COLOR = { meta: 'blue', google: 'amber' };

const PAGE_SIZE = 20;

// Nivel 4 del dashboard: ranking de campanas.
export default function CampaignsTable({ campaigns }) {
  const [page, setPage] = useState(1);

  // Si cambian los filtros (tienda/plataforma/fechas) y llega una lista nueva,
  // volver a la primera pagina en vez de dejar una pagina fuera de rango.
  useEffect(() => {
    setPage(1);
  }, [campaigns]);

  const total = campaigns ? campaigns.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = (campaigns || []).slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <Title>Campañas</Title>
      <Text color="gray">Ordenadas por gasto, con ROAS calculado a partir de pedidos realmente atribuidos</Text>
      {total === 0 ? (
        <Text className="mt-8 text-center" color="gray">
          Sin campañas para el rango/tienda seleccionados.
        </Text>
      ) : (
        <>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Campaña</TableHeaderCell>
                <TableHeaderCell>Plataforma</TableHeaderCell>
                <TableHeaderCell>Tienda</TableHeaderCell>
                <TableHeaderCell className="text-right">Gasto</TableHeaderCell>
                <TableHeaderCell className="text-right">Ingresos</TableHeaderCell>
                <TableHeaderCell className="text-right">Compras</TableHeaderCell>
                <TableHeaderCell className="text-right">CPA</TableHeaderCell>
                <TableHeaderCell className="text-right">ROAS</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageItems.map((campaign) => (
                <TableRow key={`${campaign.platform}-${campaign.store}-${campaign.campaignId}`}>
                  <TableCell>{campaign.campaignName || campaign.campaignId}</TableCell>
                  <TableCell>
                    <Badge color={PLATFORM_COLOR[campaign.platform] || 'gray'}>
                      {PLATFORM_LABEL[campaign.platform] || campaign.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign.store}</TableCell>
                  <TableCell className="text-right">{EUR.format(campaign.spend)}</TableCell>
                  <TableCell className="text-right">{EUR.format(campaign.revenue)}</TableCell>
                  <TableCell className="text-right">{NUMBER.format(campaign.attributedOrders)}</TableCell>
                  <TableCell className="text-right">{EUR.format(campaign.cpa)}</TableCell>
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
