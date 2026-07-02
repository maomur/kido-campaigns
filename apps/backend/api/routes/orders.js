import { Router } from 'express';

const router = Router();

// Pendiente de Fase 5:
//   GET /api/campaigns?store=&platform=&from=&to=
//   GET /api/conversions?store=&from=&to= -- pedidos atribuidos con detalle de campana/producto
//   POST /api/sync/run -- ejecutar ETL manualmente
router.get('/', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
