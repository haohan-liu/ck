const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery } = require('../db');
const { pinyin } = require('pinyin-pro');
const { translate } = require('bing-translate-api');

// 翻译结果缓存（避免重复翻译）
const translationCache = new Map();

function getPinyinInitial(name) {
  if (!name) return '';
  try {
    const result = pinyin(name, { pattern: 'first', toneType: 'none' });
    return result.replace(/\s+/g, '').toUpperCase() || name.slice(0, 2).toUpperCase();
  } catch (e) {
    return name.slice(0, 2).toUpperCase();
  }
}

// 检测字符串是否包含中文
function hasChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str);
}
function hasChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str);
}

// 检测是否需要翻译（包含中文或中文+数字组合）
function needsTranslation(str) {
  if (!str) return false;
  const trimmed = str.trim();
  // 包含中文的都需要翻译（包括"本田标"、"2016年以前"等）
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return true;
  return false;
}

// 异步翻译单个字符串
async function translateToEnglish(text) {
  if (!text || !needsTranslation(text)) return text;
  try {
    const result = await translate(text, 'zh-Hans', 'en', false);
    return result.translation;
  } catch (e) {
    console.error('[SKU] 翻译失败:', e.message);
    return text;
  }
}

// 翻译规格值（带缓存）
async function translateSpecValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  // 已经是纯英文或英文+数字混排（A4这种），不翻译
  if (!hasChinese(str) && /^[A-Za-z0-9\s\-\.]+$/.test(str)) {
    return str;
  }

  // 检查缓存
  if (translationCache.has(str)) {
    return translationCache.get(str);
  }

  // 需要翻译
  const result = await translateToEnglish(str);
  translationCache.set(str, result);
  return result;
}

// 生成SKU编号：大类拼音 + 翻译后的规格信息（并行翻译）
async function generateSkuCode(categoryName, attributes, templateSchema) {
  const prefix = getPinyinInitial(categoryName);
  
  // 并行翻译所有规格值
  const specPromises = templateSchema.map(async (field) => {
    const value = attributes && attributes[field];
    if (value && String(value).trim()) {
      return await translateSpecValue(String(value).trim());
    }
    return null;
  });
  
  const results = await Promise.all(specPromises);
  const translatedSpecs = results.filter(Boolean);
  
  // 拼接规格信息（用下划线连接）
  const specPart = translatedSpecs.join('_');
  
  if (specPart) {
    return `${prefix}_${specPart}`;
  }
  
  return prefix;
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

// SKU 预览翻译 API
router.post('/sku-preview', async (req, res) => {
  const { category_id, attributes } = req.body;

  if (!category_id) {
    return res.status(400).json({ success: false, error: '缺少 category_id' });
  }

  try {
    const category = getOne('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (!category) {
      return res.status(400).json({ success: false, error: '无效的大类 ID' });
    }

    // 解析 template_schema
    let templateSchema = [];
    if (category.template_schema) {
      try {
        templateSchema = typeof category.template_schema === 'string'
          ? JSON.parse(category.template_schema)
          : category.template_schema;
      } catch (e) {
        templateSchema = [];
      }
    }

    // 生成 SKU 预览（带翻译）
    const skuPreview = await generateSkuCode(category.name, attributes || {}, templateSchema);

    res.json({ success: true, data: { sku_code: skuPreview } });
  } catch (e) {
    console.error('[SKU预览] 生成失败:', e);
    res.status(500).json({ success: false, error: '生成SKU预览失败' });
  }
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

router.post('/', async (req, res) => {
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

  // 检查是否已存在完全相同的商品（相同大类、名称、规格属性）
  const attrsStr = JSON.stringify(attributes || {});
  const existingProduct = getOne(
    'SELECT id, sku_code, name FROM products WHERE category_id = ? AND name = ? AND attributes = ?',
    [category_id, name.trim(), attrsStr]
  );
  if (existingProduct) {
    return res.status(400).json({ 
      success: false, 
      error: `该商品「${existingProduct.name}」已存在，请勿重复创建` 
    });
  }

  // 解析 template_schema
  let templateSchema = [];
  if (category.template_schema) {
    try {
      templateSchema = typeof category.template_schema === 'string' 
        ? JSON.parse(category.template_schema) 
        : category.template_schema;
    } catch (e) {
      templateSchema = [];
    }
  }

  // 异步生成SKU（包含翻译后的规格信息）
  let sku_code = await generateSkuCode(category.name, attributes, templateSchema);
  let attempts = 0;
  while (attempts < 20) {
    const existing = getOne('SELECT id FROM products WHERE sku_code = ?', [sku_code]);
    if (!existing) break;
    // SKU冲突时添加序号后缀
    sku_code = await generateSkuCode(category.name, attributes, templateSchema) + `-${attempts + 1}`;
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
