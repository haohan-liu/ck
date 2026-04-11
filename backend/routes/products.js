const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery } = require('../db');

const PINYIN_PREFIX = {
  '奥迪盖子': 'ADGZ',
  '雷克萨斯': 'LKS',
  '路虎旋钮': 'LHXN',
  '前按键': 'QAJ',
  '黑钛色': 'HTS',
  '手动挡': 'SCD',
};

function getPrefixByCategoryName(name) {
  return PINYIN_PREFIX[name] || name.slice(0, 2).toUpperCase();
}

function generateSkuCode(categoryName) {
  const prefix = getPrefixByCategoryName(categoryName);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}-${year}${month}-${random}`;
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

function formatProduct(p) {
  if (!p) return null;
  let attrs = p.attributes;
  if (typeof attrs === 'string') {
    try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
  }
  return { ...p, attributes: attrs };
}

router.get('/', (req, res) => {
  const { category_id, keyword } = req.query;
  let sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
  const params = [];
  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (keyword) {
    sql += ' AND (p.name LIKE ? OR p.sku_code LIKE ? OR p.location_code LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  sql += ' ORDER BY p.sort_order ASC, p.created_at DESC';
  const products = getAll(sql, params);
  res.json({ success: true, data: products.map(formatProduct) });
});

router.get('/sku/:code', (req, res) => {
  const { code } = req.params;
  const product = getOne(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.sku_code = ?',
    [code]
  );
  if (product) {
    res.json({ success: true, data: formatProduct(product) });
  } else {
    res.status(404).json({ success: false, error: '未找到该产品' });
  }
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const product = getOne(
    'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
    [id]
  );
  if (product) {
    res.json({ success: true, data: formatProduct(product) });
  } else {
    res.status(404).json({ success: false, error: '未找到该产品' });
  }
});

router.post('/', (req, res) => {
  const {
    category_id, name, attributes, remark,
    location_code, current_stock, min_stock, unit, cost_price
  } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ success: false, error: '缺少必填字段' });
  }

  const category = getOne('SELECT * FROM categories WHERE id = ?', [category_id]);
  if (!category) {
    return res.status(400).json({ success: false, error: '无效的大类 ID' });
  }

  let sku_code = generateSkuCode(category.name);
  let attempts = 0;
  while (attempts < 20) {
    const existing = getOne('SELECT id FROM products WHERE sku_code = ?', [sku_code]);
    if (!existing) break;
    sku_code = generateSkuCode(category.name);
    attempts++;
  }

  const initStock = current_stock || 0;

  const result = runInsert(
    `INSERT INTO products (category_id, sku_code, name, attributes, remark, location_code, current_stock, min_stock, unit, cost_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category_id,
      sku_code,
      name.trim(),
      JSON.stringify(attributes || {}),
      remark || '',
      location_code || '',
      initStock,
      min_stock || 0,
      unit || '件',
      cost_price || 0,
    ]
  );

  if (result.success) {
    // 新增商品时，无论初始库存是否为 0，都记录一条日志，使用本地时间
    try {
      const logResult = runInsert(
        'INSERT INTO inventory_logs (product_id, type, quantity, stock_before, stock_after, note, operator, product_name, category_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [result.lastId, 'add', initStock, 0, initStock, '新增商品', 'system', name.trim(), category.name, localDateTime()]
      );
      if (!logResult.success) {
        console.error('[products] 写入库存日志失败:', logResult.error);
      }
    } catch (logErr) {
      console.error('[products] 写入库存日志异常:', logErr);
    }
    const newProduct = getOne('SELECT * FROM products WHERE id = ?', [result.lastId]);
    res.json({ success: true, data: formatProduct(newProduct), sku_code });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    category_id, name, attributes, remark,
    location_code, current_stock, min_stock, unit, cost_price
  } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ success: false, error: '缺少必填字段' });
  }

  const result = runQuery(
    `UPDATE products SET category_id=?, name=?, attributes=?, remark=?, location_code=?, current_stock=?, min_stock=?, unit=?, cost_price=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [
      category_id,
      name.trim(),
      JSON.stringify(attributes || {}),
      remark || '',
      location_code || '',
      current_stock || 0,
      min_stock || 0,
      unit || '件',
      cost_price || 0,
      id,
    ]
  );

  if (result.success) {
    const updated = getOne('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ success: true, data: formatProduct(updated) });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = runQuery('DELETE FROM products WHERE id = ?', [id]);
  if (result.success) {
    res.json({ success: true, message: '删除成功' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.post('/reset-all', (req, res) => {
  const products = getAll("SELECT id, attributes FROM products");
  let fixed = 0;
  products.forEach(p => {
    let attrs;
    try { attrs = JSON.parse(p.attributes); } catch { attrs = null; }
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
      runQuery("UPDATE products SET attributes='{}' WHERE id=?", [p.id]);
      fixed++;
    } else {
      const keys = Object.keys(attrs);
      if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
        runQuery("UPDATE products SET attributes='{}' WHERE id=?", [p.id]);
        fixed++;
      }
    }
  });
  res.json({ success: true, message: `已修复 ${fixed} 条损坏数据` });
});

/**
 * POST /api/products/reorder
 * 批量更新商品排序
 * 请求体: { items: [{ id: number, sort_order: number }, ...] }
 */
router.post('/reorder', (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '缺少 items 参数或数组为空' });
  }

  // 参数化验证：确保每个 item 都是有效的数字
  for (const item of items) {
    if (typeof item.id !== 'number' || typeof item.sort_order !== 'number') {
      return res.status(400).json({ success: false, error: '每个 item 必须包含有效的 id 和 sort_order' });
    }
  }

  // 批量更新每个商品的 sort_order
  let updated = 0;
  for (const item of items) {
    const result = runQuery(
      'UPDATE products SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [item.sort_order, item.id]
    );
    if (result.success) {
      updated++;
    }
  }

  res.json({ success: true, message: '排序已保存', updated });
});

module.exports = router;
