const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery, saveDatabase } = require('../db');

// ═══════════════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 安全获取库存数值（避免 undefined / null 导致 NaN）
 */
function safeStock(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}

/**
 * 获取本地时间的 SQLite DATETIME 格式字符串
 * 解决 SQLite CURRENT_TIMESTAMP 使用 UTC 时间的问题
 */
function localDateTime() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
         `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 入库
// ═══════════════════════════════════════════════════════════════════════════

router.post('/in', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
    return res.status(400).json({ success: false, error: '参数错误：数量必须为正整数' });
  }

  const product = getOne(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
    [product_id]
  );
  if (!product) return res.status(404).json({ success: false, error: '产品不存在' });

  const qty = Number(quantity);
  const before = safeStock(product.current_stock);
  const newStock = before + qty;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStock, product_id]
  );
  // 写入日志时保留商品名称和大类名称快照，使用本地时间
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'in', qty, before, newStock, note || '', operator || 'system', product.name, product.category_name || '', localDateTime()]
  );

  res.json({
    success: true,
    message: `入库成功，当前库存：${newStock}`,
    newStock,
    beforeStock: before,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 出库（严格校验库存）
// ═══════════════════════════════════════════════════════════════════════════

router.post('/out', (req, res) => {
  const { product_id, quantity, note, operator, tracking_number } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
    return res.status(400).json({ success: false, error: '参数错误：数量必须为正整数' });
  }

  const product = getOne(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
    [product_id]
  );
  if (!product) return res.status(404).json({ success: false, error: '产品不存在' });

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
  const tracking = tracking_number ? String(tracking_number).trim() : '';

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStock, product_id]
  );
  // 写入日志：绑定运单号（如果有的话），使用本地时间
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, tracking_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'out', qty, current, newStock, note || '', operator || 'system', product.name, product.category_name || '', tracking, localDateTime()]
  );

  res.json({
    success: true,
    message: tracking
      ? `出库成功，当前库存：${newStock}（运单号：${tracking}）`
      : `出库成功，当前库存：${newStock}`,
    newStock,
    beforeStock: current,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 库存调整（盘点）
// ═══════════════════════════════════════════════════════════════════════════

router.post('/adjust', (req, res) => {
  const { product_id, quantity, note, operator } = req.body;

  if (!product_id || quantity === undefined || quantity === null || !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).json({ success: false, error: '参数错误：调整后数量必须为非负整数' });
  }

  const product = getOne(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
    [product_id]
  );
  if (!product) return res.status(404).json({ success: false, error: '产品不存在' });

  const qty = Number(quantity);
  const current = safeStock(product.current_stock);
  const diff = qty - current;

  runQuery(
    'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [qty, product_id]
  );
  runInsert(
    'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [product_id, 'adjust', diff, current, qty, note || '库存调整', operator || 'system', product.name, product.category_name || '', localDateTime()]
  );

  res.json({
    success: true,
    message: `调整成功，当前库存：${qty}`,
    newStock: qty,
    beforeStock: current,
    diff,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 批量入库
// ═══════════════════════════════════════════════════════════════════════════

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
    const product = getOne(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
      [item.product_id]
    );
    if (!product) { errors.push({ product_id: item.product_id, error: '产品不存在' }); continue; }

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
    // 更新库存并写入日志，使用本地时间
    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'in', item.quantity, before, newStock, item.note, operator || 'system', item.product_name, item.category_name || '', localDateTime()]
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

// ═══════════════════════════════════════════════════════════════════════════
// 批量出库（严格校验库存）
// ═══════════════════════════════════════════════════════════════════════════

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
    const product = getOne(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
      [item.product_id]
    );
    if (!product) { stockErrors.push({ product_id: item.product_id, error: '产品不存在' }); continue; }

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
    // 更新库存并写入日志，使用本地时间
    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'out', item.quantity, before, newStock, item.note, operator || 'system', item.product_name, item.category_name || '', localDateTime()]
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

// ═══════════════════════════════════════════════════════════════════════════
// 扫码出库（绑定运单号）
// 核心新接口：扫码出库时，将出库记录关联到 shipping_records 表，
// 并将运单号同时写入 inventory_logs 的 tracking_number 字段。
// ═══════════════════════════════════════════════════════════════════════════

router.post('/scan-out', (req, res) => {
  const { items, tracking_number, operator } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少有效的出库商品列表' });
  }
  if (!tracking_number || !String(tracking_number).trim()) {
    return res.status(400).json({ success: false, error: '运单号不能为空' });
  }

  const tracking = String(tracking_number).trim();

  // 第一步：验证所有商品的库存是否充足
  const stockErrors = [];
  const validItems = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      stockErrors.push({ product_id: item.product_id, error: '数量必须为正整数' });
      continue;
    }
    const product = getOne(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
      [item.product_id]
    );
    if (!product) { stockErrors.push({ product_id: item.product_id, error: '产品不存在' }); continue; }

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

  if (stockErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: '部分商品库存不足，无法出库',
      stockErrors,
      validItemsCount: validItems.length,
    });
  }

  // 第二步：处理运单记录
  let shippingRecord = getOne('SELECT * FROM shipping_records WHERE tracking_number = ?', [tracking]);
  let isNewShipping = false;

  if (!shippingRecord) {
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
    const newTotal = safeStock(shippingRecord.total_items) + validItems.length;
    runQuery('UPDATE shipping_records SET total_items = ? WHERE id = ?', [newTotal, shippingRecord.id]);
    shippingRecord.total_items = newTotal;
  }

  // 第三步：执行出库并记录明细（运单号写入 inventory_logs.tracking_number）
  const inventoryResults = [];
  for (const item of validItems) {
    const before = item.current_stock;
    const newStock = before - item.quantity;

    runQuery(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, item.product_id]
    );

    // 写入库存日志：tracking_number 字段用于日志溯源，使用本地时间
    runInsert(
      'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, tracking_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, 'out', item.quantity, before, newStock, item.note, operator || 'system', item.product_name, item.category_name || '', tracking, localDateTime()]
    );

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

// ═══════════════════════════════════════════════════════════════════════════
// 查询日志列表（数据快照解耦：不再依赖 JOIN products）
// 读取 inventory_logs 表的 product_name / category_name / tracking_number 字段，
// 即使商品被删除，日志仍完整独立。
// ═══════════════════════════════════════════════════════════════════════════

router.get('/logs', (req, res) => {
  const { product_id, keyword, type, limit, offset, unbound_only } = req.query;
  const params = [];

  // ── 主查询：直接从 inventory_logs 读取快照字段，移除 LEFT JOIN ──
  let sql = `
    SELECT
      l.id,
      l.product_id,
      l.type,
      l.quantity,
      l.stock_before,
      l.stock_after,
      l.note,
      l.operator,
      l.created_at,
      l.product_name,
      l.category_name,
      l.tracking_number,
      l.domestic_tracking,
      p.sku_code,
      p.unit as product_unit
    FROM inventory_logs l
    LEFT JOIN products p ON l.product_id = p.id
    WHERE 1=1
  `;

  if (product_id) {
    sql += ' AND l.product_id = ?';
    params.push(product_id);
  }
  if (keyword) {
    // 优先匹配快照字段，再兼容 sku_code，同时匹配运单号和国内单号
    sql += ' AND (l.product_name LIKE ? OR l.category_name LIKE ? OR p.sku_code LIKE ? OR l.tracking_number LIKE ? OR l.domestic_tracking LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw, kw);
  }
  if (type) {
    sql += ' AND l.type = ?';
    params.push(type);
  }
  // 集包模式：只查询出库且未绑定国内单号的记录
  if (unbound_only === 'true' || unbound_only === true) {
    sql += " AND l.type = 'out' AND (l.domestic_tracking IS NULL OR l.domestic_tracking = '')";
  }

  sql += ' ORDER BY l.created_at DESC';

  // ── 计数查询（同样移除 JOIN） ──
  let countSql = `
    SELECT COUNT(*) as total
    FROM inventory_logs l
    LEFT JOIN products p ON l.product_id = p.id
    WHERE 1=1
  `;
  const countParams = [...params];
  if (product_id) { countSql += ' AND l.product_id = ?'; }
  if (keyword) { countSql += ' AND (l.product_name LIKE ? OR l.category_name LIKE ? OR p.sku_code LIKE ? OR l.tracking_number LIKE ? OR l.domestic_tracking LIKE ?)'; }
  if (type) { countSql += ' AND l.type = ?'; }
  if (unbound_only === 'true' || unbound_only === true) {
    countSql += " AND l.type = 'out' AND (l.domestic_tracking IS NULL OR l.domestic_tracking = '')";
  }

  const countResult = getOne(countSql, countParams);
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

// ═══════════════════════════════════════════════════════════════════════════
// 批量删除日志
// ═══════════════════════════════════════════════════════════════════════════

router.delete('/logs', (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: '缺少待删除的日志 ID 列表' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const result = runQuery(`DELETE FROM inventory_logs WHERE id IN (${placeholders})`, ids);
  res.json({ success: true, message: `成功删除 ${ids.length} 条日志` });
});

// ═══════════════════════════════════════════════════════════════════════════
// 更新日志备注
// ═══════════════════════════════════════════════════════════════════════════

router.put('/logs/:id/note', (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (note === undefined) {
    return res.status(400).json({ success: false, error: '缺少 note 参数' });
  }

  const result = runQuery(
    'UPDATE inventory_logs SET note = ? WHERE id = ?',
    [String(note), id]
  );

  if (result.success) {
    const updated = getOne('SELECT * FROM inventory_logs WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } else {
    res.status(500).json({ success: false, error: '更新备注失败' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 批量绑定国内单号（集包功能）
// ═══════════════════════════════════════════════════════════════════════════

router.put('/logs/batch-domestic-tracking', (req, res) => {
  const { ids, domestic_tracking } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: '缺少待更新的日志 ID 列表' });
  }
  if (!domestic_tracking || !String(domestic_tracking).trim()) {
    return res.status(400).json({ success: false, error: '国内单号不能为空' });
  }

  const tracking = String(domestic_tracking).trim();
  const placeholders = ids.map(() => '?').join(',');

  // 批量更新 domestic_tracking 字段
  const result = runQuery(
    `UPDATE inventory_logs SET domestic_tracking = ? WHERE id IN (${placeholders})`,
    [tracking, ...ids]
  );

  if (result.success) {
    res.json({
      success: true,
      message: `成功绑定 ${ids.length} 条记录的国内单号：${tracking}`,
      updatedCount: ids.length,
      domestic_tracking: tracking,
    });
  } else {
    res.status(500).json({ success: false, error: '批量绑定国内单号失败' });
  }
});

module.exports = router;
