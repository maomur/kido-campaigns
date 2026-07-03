import { pathToFileURL } from 'node:url';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './api/routes/index.js';
import { scheduleDailySync } from './scheduler/jobs.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('server');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  app.listen(PORT, () => logger.info(`Servidor escuchando en puerto ${PORT}`));
  const schedule = process.env.SYNC_CRON_SCHEDULE || '0 6 * * *';
  logger.info(`ETL programado activo (cron "${schedule}", DRY_RUN=${process.env.DRY_RUN})`);
  scheduleDailySync();
}

export default app;
