import { Router } from 'express';
import db from '../../db.js';
import { getCampaigns, resolveDateRange } from '../queries.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('api:campaigns');
const router = Router();

// GET /api/campaigns?store=&platform=&from=&to=
router.get('/', async (req, res) => {
  try {
    const { store, platform } = req.query;
    const { from, to } = resolveDateRange(req.query);
    const campaigns = await getCampaigns(db, { store, platform, from, to });
    res.json({ from, to, store: store || 'all', platform: platform || 'all', campaigns });
  } catch (err) {
    logger.error('Error en GET /campaigns', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
