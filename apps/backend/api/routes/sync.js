import { Router } from 'express';
import { runPipeline } from '../../etl/pipeline.js';
import { createLogger } from '../../utils/logger.js';

const router = Router();
const logger = createLogger('api:sync');

// Estado en memoria (proceso unico, sin cola/Redis) para evitar que dos
// corridas del ETL se pisen si alguien hace doble click o dispara el cron
// justo cuando alguien tambien pidio una sincronizacion manual.
let isRunning = false;

router.post('/run', async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: 'Ya hay una sincronización en curso, espera a que termine.' });
  }

  isRunning = true;
  logger.info('Sincronización manual iniciada vía API');
  try {
    const result = await runPipeline({});
    logger.info('Sincronización manual completada', result);
    res.json({ ok: true, ...result, finishedAt: new Date().toISOString() });
  } catch (err) {
    logger.error('Sincronización manual falló', err);
    res.status(500).json({ error: err.message || 'Error ejecutando la sincronización' });
  } finally {
    isRunning = false;
  }
});

router.get('/status', (req, res) => {
  res.json({ running: isRunning });
});

export default router;
