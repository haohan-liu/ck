import { Router } from 'express';
import { queries } from '../db.js';

const router = Router();

// -------- GET /api/stats --------
router.get('/', (req, res) => {
  try {
    const stats = queries.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- GET /api/stats/low-stock --------
router.get('/low-stock', (req, res) => {
  try {
    const products = queries.getLowStockProducts();
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- GET /api/stats/recent-logs --------
router.get('/recent-logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = queries.getRecentLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
