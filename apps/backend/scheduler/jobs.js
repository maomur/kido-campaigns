import cron from 'node-cron';
import { runPipeline } from '../etl/pipeline.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('scheduler');

// Pendiente de Fase 6: alertas (email/Slack) cuando el ROAS baje del umbral configurado.
export function scheduleDailySync() {
  const schedule = process.env.SYNC_CRON_SCHEDULE || '0 6 * * *';
  return cron.schedule(schedule, async () => {
    logger.info('Iniciando ETL programado de marketing...');
    await runPipeline({});
    logger.info('ETL programado completado');
  });
}
