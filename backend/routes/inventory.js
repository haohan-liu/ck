const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery } = require('../db');

// 入库
router.post('/in', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
    return res.status(400).json({ success: false, error: '参数错误：数量必须为正整数' });
  }

  const product = getOne('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }

  const qty = Number(quantity);
  const newStock = (product.current_stock || 0) + qty;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStock, product_id]
  );
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, note, operator) VALUES (?, ?, ?, ?, ?)',
    [product_id, 'in', qty, note || '', operator || 'system']
  );

  res.json({
    success: true,
    message: `入库成功，当前库存：${newStock}`,
    newStock,
    beforeStock: product.current_stock || 0,
  });
});

// 出库（严格校验库存）
router.post('/out', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
    return res.status(400).json({ success: false, error: '参数错误：数量必须为正整数' });
  }

  const product = getOne('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }

  const qty = Number(quantity);
  const current = product.current_stock || 0;

  // 严格校验：库存不足直接拒绝
  if (current < qty) {
    return res.status(400).json({
      success: false,
      error: `库存不足，当前库存 ${current} 件，尝试出库 ${qty} 件，差额 ${qty - current} 件`,
      currentStock: current,
      requestedQty: qty,
    });
  }

  const newStock = current - qty;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStock, product_id]
  );
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, note, operator) VALUES (?, ?, ?, ?, ?)',
    [product_id, 'out', qty, note || '', operator || 'system']
  );

  res.json({
    success: true,
    message: `出库成功，当前库存：${newStock}`,
    newStock,
    beforeStock: current,
  });
});

// 库存调整（盘点）
router.post('/adjust', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || quantity === undefined || quantity === null || !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).json({ success: false, error: '参数错误：调整后数量必须为非负整数' });
  }

  const product = getOne('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }

  const qty = Number(quantity);
  const current = product.current_stock || 0;
  const diff = qty - current;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [qty, product_id]
  );
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, note, operator) VALUES (?, ?, ?, ?, ?)',
    [product_id, 'adjust', diff, note || '库存调整', operator || 'system']
  );

  res.json({
    success: true,
    message: `调整成功，当前库存：${qty}`,
    newStock: qty,
    beforeStock: current,
    diff,
  });
});

// 查询日志列表
router.get('/logs', (req, res) => {
  const { product_id, keyword, limit, offset } = req.query;
  let sql = `
    SELECT l.*, p.name as product_name, p.sku_code, p.unit as product_unit
    FROM inventory_logs l
    LEFT JOIN products p ON l.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (product_id) {
    sql += ' AND l.product_id = ?';
    params.push(product_id);
  }
  if (keyword) {
    sql += ' AND (p.name LIKE ? OR p.sku_code LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }

  sql += ' ORDER BY l.created_at DESC';

  // 先获取总数
  const countSql = sql.replace(
    'SELECT l.*, p.name as product_name, p.sku_code, p.unit as product_unit',
    'SELECT COUNT(*) as total'
  );
  const countResult = getOne(countSql, params);
  const total = countResult ? countResult.total : 0;

  if (limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
    if (offset) {
      sql += ' OFFSET ?';
      params.push(parseInt(offset));
    }
  }

  const logs = getAll(sql, params);
  res.json({ success: true, data: logs, total });
});

module.exports = router;
