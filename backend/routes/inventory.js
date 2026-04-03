import { Router } from 'express';
import { queries, adjustInventory, execToObjects } from '../db.js';

const router = Router();

// -------- POST /api/inventory/in --------
router.post('/in', (req, res) => {
  try {
    const { product_id, quantity, note, operator } = req.body;
    if (!product_id || !quantity) {
      return res.status(400).json({ success: false, message: 'product_id 和 quantity 必填' });
    }
    const productId = parseInt(product_id, 10);
    adjustInventory(productId, 'in', quantity, note || '', operator || 'system');
    res.json({ success: true, message: '入库成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- POST /api/inventory/out --------
router.post('/out', (req, res) => {
  try {
    const { product_id, quantity, note, operator } = req.body;
    if (!product_id || !quantity) {
      return res.status(400).json({ success: false, message: 'product_id 和 quantity 必填' });
    }
    const productId = parseInt(product_id, 10);
    adjustInventory(productId, 'out', quantity, note || '', operator || 'system');
    res.json({ success: true, message: '出库成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- POST /api/inventory/adjust --------
router.post('/adjust', (req, res) => {
  try {
    const { product_id, quantity, note, operator } = req.body;
    if (!product_id || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'product_id 和 quantity 必填' });
    }
    const productId = parseInt(product_id, 10);
    adjustInventory(productId, 'adjust', quantity, note || '', operator || 'system');
    res.json({ success: true, message: '库存调整成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- GET /api/inventory/logs --------
router.get('/logs', (req, res) => {
  try {
    const { product_id } = req.query;
    const result = product_id
      ? queries.getLogsByProduct(parseInt(product_id, 10))
      : queries.getAllLogs();
    res.json({ success: true, data: execToObjects(result) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
