import { Router } from 'express';
import healthRouter from './health.js';
import kpisRouter from './kpis.js';
import campaignsRouter from './campaigns.js';
import ordersRouter from './orders.js';
import syncRouter from './sync.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/kpis', kpisRouter);
router.use('/campaigns', campaignsRouter);
router.use('/orders', ordersRouter);
router.use('/sync', syncRouter);

export default router;
