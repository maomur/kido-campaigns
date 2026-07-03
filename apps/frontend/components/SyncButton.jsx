'use client';

import { useState } from 'react';
import { Button, Text } from '@tremor/react';
import { triggerSync } from '../lib/api.js';

// Dispara el mismo pipeline ETL (extract -> transform -> load -> atribucion)
// que corre solo via cron todos los dias a las 6am, pero bajo demanda.
export default function SyncButton({ onSyncComplete }) {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [message, setMessage] = useState('');

  async function handleClick() {
    setStatus('running');
    setMessage('');
    try {
      const result = await triggerSync();
      const errorCount = result.errors ? result.errors.length : 0;
      setStatus('done');
      setMessage(
        errorCount > 0
          ? `Actualizado con ${errorCount} error(es) parcial(es) — revisa los logs del backend.`
          : `Actualizado: ${result.adPerformanceCount ?? 0} filas de anuncios, ${result.ordersCount ?? 0} pedidos.`,
      );
      onSyncComplete?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="xs" loading={status === 'running'} disabled={status === 'running'} onClick={handleClick}>
        {status === 'running' ? 'Actualizando...' : 'Actualizar datos'}
      </Button>
      {message && (
        <Text className="max-w-xs text-right" color={status === 'error' ? 'rose' : 'gray'}>
          {message}
        </Text>
      )}
    </div>
  );
}
