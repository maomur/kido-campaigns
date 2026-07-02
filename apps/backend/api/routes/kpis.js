import { Router } from 'express';
import db from '../../db.js';
import { getSummaryKpis, getTimeseries, getSpendBreakdown, getPlatformComparison, resolveDateRange } from '../queries.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('api:kpis');
const router = Router();

// GET /api/kpis/summary?store=&platform=&from=&to=
router.get('/summary', async (req, res) => {
  try {
    const { store, platform } = req.query;
    const { from, to } = resolveDateRange(req.query);
    const summary = await getSummaryKpis(db, { store, platform, from, to });
    res.json({ from, to, store: store || 'all', platform: platform || 'all', ...summary });
  } catch (err) {
    logger.error('Error en GET /kpis/summary', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/kpis/timeseries?store=&platform=&from=&to=&granularity=day|week
router.get('/timeseries', async (req, res) => {
  try {
    const { store, platform, granularity } = req.query;
    const { from, to } = resolveDateRange(req.query);
    const series = await getTimeseries(db, { store, platform, from, to, granularity: granularity === 'week' ? 'week' : 'day' });
    res.json({ from, to, store: store || 'all', platform: platform || 'all', granularity: granularity === 'week' ? 'week' : 'day', series });
  } catch (err) {
    logger.error('Error en GET /kpis/timeseries', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/kpis/breakdown?store=&platform=&from=&to= -- gasto por tienda y por plataforma
router.get('/breakdown', async (req, res) => {
  try {
    const { store, platform } = req.query;
    const { from, to } = resolveDateRange(req.query);
    const breakdown = await getSpendBreakdown(db, { store, platform, from, to });
    res.json({ from, to, store: store || 'all', platform: platform || 'all', ...breakdown });
  } catch (err) {
    logger.error('Error en GET /kpis/breakdown', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/kpis/platform-comparison?store=&from=&to= -- Meta Ads vs Google Ads
router.get('/platform-comparison', async (req, res) => {
  try {
    const { store } = req.query;
    const { from, to } = resolveDateRange(req.query);
    const platforms = await getPlatformComparison(db, { store, from, to });
    res.json({ from, to, store: store || 'all', platforms });
  } catch (err) {
    logger.error('Error en GET /kpis/platform-comparison', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
