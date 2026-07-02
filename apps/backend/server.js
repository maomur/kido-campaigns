import { pathToFileURL } from 'node:url';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './api/routes/index.js';
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
}

export default app;
