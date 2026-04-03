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
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'in', qty, product.current_stock || 0, newStock, note || '', operator || 'system']
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
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'out', qty, current, newStock, note || '', operator || 'system']
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
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'adjust', diff, current, qty, note || '库存调整', operator || 'system']
  );

  res.json({
    success: true,
    message: `调整成功，当前库存：${qty}`,
    newStock: qty,
    beforeStock: current,
    diff,
  });
});

// 批量入库
router.post('/batch-in', (req, res) => {
  const { items, operator } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的数据列表' });
  }

  // 验证所有项目
  const errors = [];
  const validItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      errors.push({ product_id: item.product_id, error: '数量必须为正整数' });
      continue;
    }

    const product = getOne('SELECT * FROM products WHERE id = ?', [item.product_id]);
    if (!product) {
      errors.push({ product_id: item.product_id, error: '产品不存在' });
      continue;
    }

    validItems.push({
      product_id: item.product_id,
      product_name: product.name,
      sku_code: product.sku_code,
      quantity: Number(item.quantity),
      note: item.note || '',
      current_stock: product.current_stock || 0
    });
  }

  if (errors.length > 0 && validItems.length === 0) {
    return res.status(400).json({ success: false, error: '所有项目均无效', errors });
  }

  // 逐条处理入库
  const results = [];
  for (const item of validItems) {
    const newStock = item.current_stock + item.quantity;

    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'in', item.quantity, item.current_stock, newStock, item.note, operator || 'system']
    );

    results.push({
      product_id: item.product_id,
      product_name: item.product_name,
      sku_code: item.sku_code,
      quantity: item.quantity,
      before_stock: item.current_stock,
      after_stock: newStock
    });
  }

  res.json({
    success: true,
    message: `批量入库成功，共处理 ${results.length} 条记录`,
    data: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

// 批量出库（严格校验库存）
router.post('/batch-out', (req, res) => {
  const { items, operator } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的数据列表' });
  }

  // 第一步：验证所有商品的库存是否充足
  const stockErrors = [];
  const validItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      stockErrors.push({
        product_id: item.product_id,
        error: '数量必须为正整数'
      });
      continue;
    }

    const product = getOne('SELECT * FROM products WHERE id = ?', [item.product_id]);
    if (!product) {
      stockErrors.push({
        product_id: item.product_id,
        error: '产品不存在'
      });
      continue;
    }

    const current = product.current_stock || 0;
    const requested = Number(item.quantity);

    if (current < requested) {
      stockErrors.push({
        product_id: item.product_id,
        product_name: product.name,
        sku_code: product.sku_code,
        error: `库存不足，当前 ${current} 件，需要 ${requested} 件，差额 ${requested - current} 件`,
        current_stock: current,
        requested_quantity: requested
      });
    } else {
      validItems.push({
        product_id: item.product_id,
        product_name: product.name,
        sku_code: product.sku_code,
        quantity: requested,
        note: item.note || '',
        current_stock: current
      });
    }
  }

  // 如果有任何库存不足的错误，直接返回失败
  if (stockErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: '部分商品库存不足，无法出库',
      stockErrors,
      validItemsCount: validItems.length
    });
  }

  // 所有验证通过，执行批量出库
  const results = [];
  for (const item of validItems) {
    const newStock = item.current_stock - item.quantity;

    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'out', item.quantity, item.current_stock, newStock, item.note, operator || 'system']
    );

    results.push({
      product_id: item.product_id,
      product_name: item.product_name,
      sku_code: item.sku_code,
      quantity: item.quantity,
      before_stock: item.current_stock,
      after_stock: newStock
    });
  }

  res.json({
    success: true,
    message: `批量出库成功，共处理 ${results.length} 条记录`,
    data: results
  });
});

// 查询日志列表
router.get('/logs', (req, res) => {
  const { product_id, keyword, limit, offset } = req.query;
  let sql = `
    SELECT l.*, p.name as product_name, p.sku_code, p.unit as product_unit, c.name as category_name
    FROM inventory_logs l
    LEFT JOIN products p ON l.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
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
    'SELECT l.*, p.name as product_name, p.sku_code, p.unit as product_unit, c.name as category_name',
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
