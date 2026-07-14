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

function localDateTimeDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 按出库日志快照统计排行榜。
 *
 * 分类筛选必须使用日志写入当时的 category_name，而不能使用商品当前分类：
 * 商品被重新归类后，历史出库记录仍应留在原分类的统计中。
 */
function getOutboundRank(days = null, limit = null, categoryName = '') {
  const params = [];
  let timeFilter = '';
  if (days !== null) {
    timeFilter = 'AND l.created_at >= ?';
    params.push(localDateTimeDaysAgo(days));
  }

  // 优先使用库存日志中的分类快照；兼容旧日志没有快照时再回退到当前商品分类。
  const categorySnapshot = "COALESCE(NULLIF(l.category_name, ''), NULLIF(source_category.name, ''), '')";
  let categoryFilter = '';
  if (categoryName) {
    categoryFilter = `AND ${categorySnapshot} = ?`;
    params.push(categoryName);
  }

  let limitClause = '';
  if (limit !== null) {
    limitClause = 'LIMIT ?';
    params.push(limit);
  }

  return getAll(`
    WITH outbound AS (
      SELECT
        l.product_id,
        ${categorySnapshot} AS category_name,
        SUM(ABS(l.quantity)) AS total_out_quantity,
        MAX(l.id) AS latest_log_id
      FROM inventory_logs l
      LEFT JOIN products source_product ON source_product.id = l.product_id
      LEFT JOIN categories source_category ON source_category.id = source_product.category_id
      WHERE l.type = 'out'
        ${timeFilter}
        ${categoryFilter}
      GROUP BY l.product_id, ${categorySnapshot}
      HAVING SUM(ABS(l.quantity)) > 0
    )
    SELECT
      outbound.product_id,
      COALESCE(NULLIF(p.name, ''), NULLIF(latest.product_name, ''), '') AS product_name,
      outbound.category_name,
      outbound.total_out_quantity
    FROM outbound
    LEFT JOIN products p ON p.id = outbound.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN inventory_logs latest ON latest.id = outbound.latest_log_id
    ORDER BY
      outbound.total_out_quantity DESC,
      product_name COLLATE NOCASE ASC,
      outbound.product_id ASC
    ${limitClause}
  `, params);
}

router.get('/', (req, res) => {
  // 使用本地日期而不是 UTC，避免时区差异
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

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
    ORDER BY c.sort_order ASC, c.id ASC
  `);

  // 出库排行榜：分类筛选在聚合前执行，保证每个大类都能取得自己的 Top 20，
  // 且分类口径与库存日志页面的历史快照一致。
  const rankCategory = typeof req.query.rank_category === 'string'
    ? req.query.rank_category.trim()
    : '';
  const thirtyDayOutboundRank = getOutboundRank(30, 20, rankCategory);
  const sixtyDayOutboundRank = getOutboundRank(60, 20, rankCategory);
  const ninetyDayOutboundRank = getOutboundRank(90, 20, rankCategory);
  const allTimeOutboundRank = getOutboundRank(null, null, rankCategory);

  // 低库存预警产品列表（<= min_stock，包括等于的情况）
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
      thirtyDayOutboundRank,
      sixtyDayOutboundRank,
      ninetyDayOutboundRank,
      allTimeOutboundRank,
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
