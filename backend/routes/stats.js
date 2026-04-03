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
  const today = new Date().toISOString().split('T')[0];

  const totalProducts = getAll('SELECT COUNT(*) as count FROM products')[0]?.count || 0;
  const stockStats = getAll('SELECT SUM(current_stock) as total, SUM(current_stock * cost_price) as value FROM products')[0] || {};
  const lowStockProducts = getAll('SELECT COUNT(*) as count FROM products WHERE current_stock <= min_stock AND current_stock > 0')[0]?.count || 0;
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

  const byLocation = getAll(`
    SELECT location_code, COUNT(*) as count, SUM(current_stock) as total_stock
    FROM products
    WHERE location_code IS NOT NULL AND location_code != ''
    GROUP BY location_code
    ORDER BY location_code
  `);

  // 低库存预警产品列表（<= min_stock，包括零库存）
  const lowStockList = getAll(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.current_stock <= p.min_stock
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
      byLocation,
      lowStockList: lowStockList.map(formatProduct),
    }
  });
});

router.get('/low-stock', (req, res) => {
  const products = getAll(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.current_stock <= p.min_stock
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
