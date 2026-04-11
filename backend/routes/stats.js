const express = require('express');
const router = express.Router();
const { getAll, getOne } = require('../db');

function formatProduct(p) {
  if (!p) return null;
  let attrs = p.attributes;
  if (typeof attrs === 'string') {
    try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
  }
  return { ...p, attributes: attrs };
}

router.get('/', (req, res) => {
  // 使用本地日期而不是 UTC，避免时区差异
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const totalProducts = getAll('SELECT COUNT(*) as count FROM products')[0]?.count || 0;
  const stockStats = getAll('SELECT SUM(current_stock) as total, SUM(current_stock * cost_price) as value FROM products')[0] || {};
  const lowStockProducts = getAll('SELECT COUNT(*) as count FROM products WHERE current_stock < min_stock AND current_stock > 0')[0]?.count || 0;
  const zeroStockProducts = getAll('SELECT COUNT(*) as count FROM products WHERE current_stock = 0')[0]?.count || 0;

  const todayIn = getAll(
    `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_logs WHERE type='in' AND date(created_at) = ?`,
    [today]
  )[0]?.total || 0;

  const todayOut = getAll(
    `SELECT COALESCE(SUM(ABS(quantity)), 0) as total FROM inventory_logs WHERE type='out' AND date(created_at) = ?`,
    [today]
  )[0]?.total || 0;

  const byCategory = getAll(`
    SELECT c.name, COUNT(p.id) as count, COALESCE(SUM(p.current_stock), 0) as total_stock, COALESCE(SUM(p.current_stock * p.cost_price), 0) as total_value
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    GROUP BY c.id, c.name
    ORDER BY c.id
  `);

  // 30天出库排行榜
  const thirtyDayOutboundRank = getAll(`
    SELECT
      l.product_id,
      l.product_name,
      l.category_name,
      SUM(ABS(l.quantity)) as total_out_quantity
    FROM inventory_logs l
    WHERE l.type = 'out'
      AND l.created_at >= datetime('now', '-30 days')
    GROUP BY l.product_id, l.product_name, l.category_name
    ORDER BY total_out_quantity DESC
    LIMIT 20
  `);

  // 低库存预警产品列表（< min_stock，不包括等于的情况）
  const lowStockList = getAll(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.current_stock < p.min_stock
    ORDER BY p.current_stock ASC, p.id ASC
    LIMIT 50
  `);

  res.json({
    success: true,
    data: {
      totalProducts,
      totalStock: stockStats.total || 0,
      totalValue: stockStats.value || 0,
      lowStockCount: lowStockProducts,
      zeroStockCount: zeroStockProducts,
      todayIn,
      todayOut,
      byCategory,
      thirtyDayOutboundRank,
      lowStockList: lowStockList.map(formatProduct),
    }
  });
});

router.get('/low-stock', (req, res) => {
  const products = getAll(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.current_stock < p.min_stock
    ORDER BY p.current_stock ASC, p.id ASC
  `);
  res.json({ success: true, data: products.map(formatProduct) });
});

router.get('/recent-logs', (req, res) => {
  const { limit } = req.query;
  const sql = `
    SELECT l.*, p.name as product_name, p.sku_code
    FROM inventory_logs l
    LEFT JOIN products p ON l.product_id = p.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `;
  const logs = getAll(sql, [parseInt(limit) || 20]);
  res.json({ success: true, data: logs });
});

module.exports = router;
