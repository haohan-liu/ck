const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery } = require('../db');

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

function formatCategory(cat) {
  if (!cat) return null;
  let template = cat.template_schema;
  if (typeof template === 'string') {
    try { template = JSON.parse(template); } catch { template = []; }
  }
  return { ...cat, template_schema: template };
}

router.get('/', (req, res) => {
  const categories = getAll('SELECT * FROM categories ORDER BY id');
  res.json({ success: true, data: categories.map(formatCategory) });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const category = getOne('SELECT * FROM categories WHERE id = ?', [id]);
  if (category) {
    res.json({ success: true, data: formatCategory(category) });
  } else {
    res.status(404).json({ success: false, error: '未找到该大类' });
  }
});

router.post('/', (req, res) => {
  const { name, template_schema } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: '名称不能为空' });
  }
  const schema = Array.isArray(template_schema) ? template_schema : [];
  const result = runInsert(
    'INSERT INTO categories (name, template_schema, created_at) VALUES (?, ?, ?)',
    [name.trim(), JSON.stringify(schema), localDateTime()]
  );
  if (result.success) {
    const newCategory = getOne('SELECT * FROM categories WHERE id = ?', [result.lastId]);
    res.json({ success: true, data: formatCategory(newCategory) });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, template_schema } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: '名称不能为空' });
  }
  const schema = Array.isArray(template_schema) ? template_schema : [];
  const result = runQuery(
    'UPDATE categories SET name = ?, template_schema = ? WHERE id = ?',
    [name.trim(), JSON.stringify(schema), id]
  );
  if (result.success) {
    const updated = getOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, data: formatCategory(updated) });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const products = getAll('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id]);
  if (products[0].count > 0) {
    return res.status(400).json({
      success: false,
      error: `该大类下存在 ${products[0].count} 个产品，无法删除`
    });
  }
  const result = runQuery('DELETE FROM categories WHERE id = ?', [id]);
  if (result.success) {
    res.json({ success: true, message: '删除成功' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

module.exports = router;
