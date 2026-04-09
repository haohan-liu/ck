const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery, saveDatabase } = require('../db');

// ======================== 工具函数 ========================

/**
 * 安全获取库存数值（避免 undefined / null 导致 NaN）
 */
function safeStock(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}

// ======================== 入库 ========================

router.post('/in', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
    return res.status(400).json({ success: false, error: '参数错误：数量必须为正整数' });
  }

  const product = getOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }

  const qty = Number(quantity);
  const before = safeStock(product.current_stock);
  const newStock = before + qty;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStock, product_id]
  );
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'in', qty, before, newStock, note || '', operator || 'system', product.name, product.category_name || '']
  );

  res.json({
    success: true,
    message: `入库成功，当前库存：${newStock}`,
    newStock,
    beforeStock: before,
  });
});

// ======================== 出库（严格校验库存） ========================

router.post('/out', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
    return res.status(400).json({ success: false, error: '参数错误：数量必须为正整数' });
  }

  const product = getOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }

  const qty = Number(quantity);
  const current = safeStock(product.current_stock);

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
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'out', qty, current, newStock, note || '', operator || 'system', product.name, product.category_name || '']
  );

  res.json({
    success: true,
    message: `出库成功，当前库存：${newStock}`,
    newStock,
    beforeStock: current,
  });
});

// ======================== 库存调整（盘点） ========================

router.post('/adjust', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || quantity === undefined || quantity === null || !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).json({ success: false, error: '参数错误：调整后数量必须为非负整数' });
  }

  const product = getOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }

  const qty = Number(quantity);
  const current = safeStock(product.current_stock);
  const diff = qty - current;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [qty, product_id]
  );
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'adjust', diff, current, qty, note || '库存调整', operator || 'system', product.name, product.category_name || '']
  );

  res.json({
    success: true,
    message: `调整成功，当前库存：${qty}`,
    newStock: qty,
    beforeStock: current,
    diff,
  });
});

// ======================== 批量入库 ========================

router.post('/batch-in', (req, res) => {
  const { items, operator } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的数据列表' });
  }

  const errors = [];
  const validItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      errors.push({ product_id: item.product_id, error: '数量必须为正整数' });
      continue;
    }

    const product = getOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [item.product_id]);
    if (!product) {
      errors.push({ product_id: item.product_id, error: '产品不存在' });
      continue;
    }

    validItems.push({
      product_id: item.product_id,
      product_name: product.name,
      category_name: product.category_name || '',
      sku_code: product.sku_code,
      quantity: Number(item.quantity),
      note: item.note || '',
      current_stock: safeStock(product.current_stock),
    });
  }

  if (errors.length > 0 && validItems.length === 0) {
    return res.status(400).json({ success: false, error: '所有项目均无效', errors });
  }

  const results = [];
  for (const item of validItems) {
    const before = item.current_stock;
    const newStock = before + item.quantity;

    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'in', item.quantity, before, newStock, item.note, operator || 'system', item.product_name, item.category_name || '']
    );

    results.push({
      product_id: item.product_id,
      product_name: item.product_name,
      sku_code: item.sku_code,
      quantity: item.quantity,
      before_stock: before,
      after_stock: newStock,
    });
  }

  res.json({
    success: true,
    message: `批量入库成功，共处理 ${results.length} 条记录`,
    data: results,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// ======================== 批量出库（严格校验库存） ========================

router.post('/batch-out', (req, res) => {
  const { items, operator } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的数据列表' });
  }

  const stockErrors = [];
  const validItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      stockErrors.push({ product_id: item.product_id, error: '数量必须为正整数' });
      continue;
    }

    const product = getOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [item.product_id]);
    if (!product) {
      stockErrors.push({ product_id: item.product_id, error: '产品不存在' });
      continue;
    }

    const current = safeStock(product.current_stock);
    const requested = Number(item.quantity);

    if (current < requested) {
      stockErrors.push({
        product_id: item.product_id,
        product_name: product.name,
        sku_code: product.sku_code,
        error: `库存不足，当前 ${current} 件，需要 ${requested} 件，差额 ${requested - current} 件`,
        current_stock: current,
        requested_quantity: requested,
      });
    } else {
    validItems.push({
      product_id: item.product_id,
      product_name: product.name,
      sku_code: product.sku_code,
      quantity: requested,
      note: item.note || '',
      current_stock: current,
      category_name: product.category_name || '',
    });
    }
  }

  if (stockErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: '部分商品库存不足，无法出库',
      stockErrors,
      validItemsCount: validItems.length,
    });
  }

  const results = [];
  for (const item of validItems) {
    const before = item.current_stock;
    const newStock = before - item.quantity;

    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'out', item.quantity, before, newStock, item.note, operator || 'system', item.product_name, item.category_name || '']
    );

    results.push({
      product_id: item.product_id,
      product_name: item.product_name,
      sku_code: item.sku_code,
      quantity: item.quantity,
      before_stock: before,
      after_stock: newStock,
    });
  }

  res.json({
    success: true,
    message: `批量出库成功，共处理 ${results.length} 条记录`,
    data: results,
  });
});

// ======================== 扫码出库（绑定运单号） ========================
// 核心新接口：两步扫码 -> 先扫商品条码 -> 再扫运单号 -> 绑定后提交出库
// 与普通批量出库的区别：会将出库记录关联到 shipping_records 表

router.post('/scan-out', (req, res) => {
  const { items, tracking_number, operator } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的出库商品列表' });
  }

  if (!tracking_number || !tracking_number.trim()) {
    return res.status(400).json({ success: false, error: '运单号不能为空' });
  }

  const tracking = tracking_number.trim();

  // 第一步：验证所有商品的库存是否充足
  const stockErrors = [];
  const validItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      stockErrors.push({ product_id: item.product_id, error: '数量必须为正整数' });
      continue;
    }

    const product = getOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [item.product_id]);
    if (!product) {
      stockErrors.push({ product_id: item.product_id, error: '产品不存在' });
      continue;
    }

    const current = safeStock(product.current_stock);
    const requested = Number(item.quantity);

    if (current < requested) {
      stockErrors.push({
        product_id: item.product_id,
        product_name: product.name,
        sku_code: product.sku_code,
        error: `库存不足，当前 ${current} 件，需要 ${requested} 件`,
        current_stock: current,
        requested_quantity: requested,
      });
    } else {
    validItems.push({
      product_id: item.product_id,
      product_name: product.name,
      sku_code: product.sku_code,
      quantity: requested,
      note: item.note || `运单出库: ${tracking}`,
      current_stock: current,
      category_name: product.category_name || '',
    });
    }
  }

  // 库存不足则整体拒绝（不出库任何商品）
  if (stockErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: '部分商品库存不足，无法出库',
      stockErrors,
      validItemsCount: validItems.length,
    });
  }

  // 第二步：处理运单记录
  // 查找是否存在该运单号，不存在则创建，存在则追加
  let shippingRecord = getOne('SELECT * FROM shipping_records WHERE tracking_number = ?', [tracking]);
  let isNewShipping = false;

  if (!shippingRecord) {
    // 新建运单记录
    const insertResult = runInsert(
      'INSERT INTO shipping_records (tracking_number, operator, status, total_items) VALUES (?, ?, ?, ?)',
      [tracking, operator || 'system', 'pending', validItems.length]
    );
    if (!insertResult.success) {
      return res.status(500).json({ success: false, error: '创建运单记录失败: ' + insertResult.error });
    }
    shippingRecord = getOne('SELECT * FROM shipping_records WHERE id = ?', [insertResult.lastId]);
    isNewShipping = true;
  } else {
    // 已存在的运单：累加商品数量
    const newTotal = safeStock(shippingRecord.total_items) + validItems.length;
    runQuery('UPDATE shipping_records SET total_items = ? WHERE id = ?', [newTotal, shippingRecord.id]);
    shippingRecord.total_items = newTotal;
  }

  // 第三步：执行出库并记录明细
  const inventoryResults = [];
  for (const item of validItems) {
    const before = item.current_stock;
    const newStock = before - item.quantity;

    // 更新产品库存
    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );

    // 写入库存日志（保留完整的前后库存快照）
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'out', item.quantity, before, newStock, item.note, operator || 'system', item.product_name, item.category_name || '']
    );

    // 写入运单明细
    runInsert(
      'INSERT INTO shipping_items (shipping_id, product_id, quantity) VALUES (?, ?, ?)',
      [shippingRecord.id, item.product_id, item.quantity]
    );

    inventoryResults.push({
      product_id: item.product_id,
      product_name: item.product_name,
      sku_code: item.sku_code,
      quantity: item.quantity,
      before_stock: before,
      after_stock: newStock,
    });
  }

  res.json({
    success: true,
    message: `扫码出库成功，共处理 ${inventoryResults.length} 件商品，运单号：${tracking}`,
    data: {
      shipping: {
        id: shippingRecord.id,
        tracking_number: shippingRecord.tracking_number,
        status: shippingRecord.status,
        total_items: shippingRecord.total_items,
        is_new: isNewShipping,
      },
      inventory: inventoryResults,
    },
  });
});

// ======================== 查询日志列表 ========================

router.get('/logs', (req, res) => {
  const { product_id, keyword, type, limit, offset } = req.query;
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
    sql += ' AND (COALESCE(l.product_name, \'\') <> \'\' AND l.product_name LIKE ? OR COALESCE(l.product_name, \'\') = \'\' AND p.name LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }
  if (type) {
    sql += ' AND l.type = ?';
    params.push(type);
  }

  sql += ' ORDER BY l.created_at DESC';

  const countSql = sql.replace(
    'SELECT l.*, p.name as product_name, p.sku_code, p.unit as product_unit, c.name as category_name',
    'SELECT COUNT(*) as total'
  );
  const countResult = getOne(countSql, params);
  const total = countResult ? (countResult.total || 0) : 0;

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
