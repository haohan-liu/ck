const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery } = require('../db');

/**
 * ============================================================
 * 运单记录管理 API
 * ============================================================
 */

// ======================== 查询接口 ========================

/**
 * GET /api/shipping/records
 * 获取所有运单记录（支持按状态过滤）
 */
router.get('/records', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM shipping_records WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const records = getAll(sql, params);
  res.json({ success: true, data: records });
});

/**
 * GET /api/shipping/records/:id
 * 获取单条运单记录详情
 */
router.get('/records/:id', (req, res) => {
  const { id } = req.params;
  const record = getOne('SELECT * FROM shipping_records WHERE id = ?', [id]);
  if (!record) {
    return res.status(404).json({ success: false, error: '运单记录不存在' });
  }

  const items = getAll(`
    SELECT si.*, p.name as product_name, p.sku_code, p.unit
    FROM shipping_items si
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.shipping_id = ?
    ORDER BY si.id ASC
  `, [id]);

  res.json({ success: true, data: { ...record, items } });
});

/**
 * GET /api/shipping/items?tracking_number=xxx
 * 根据运单号查询明细
 */
router.get('/items', (req, res) => {
  const { tracking_number } = req.query;
  if (!tracking_number) {
    return res.status(400).json({ success: false, error: '运单号不能为空' });
  }

  const record = getOne('SELECT * FROM shipping_records WHERE tracking_number = ?', [tracking_number]);
  if (!record) {
    return res.status(404).json({ success: false, error: '未找到该运单' });
  }

  const items = getAll(`
    SELECT si.*, p.name as product_name, p.sku_code, p.unit
    FROM shipping_items si
    LEFT JOIN products p ON si.product_id = p.id
    WHERE si.shipping_id = ?
    ORDER BY si.id ASC
  `, [record.id]);

  res.json({ success: true, data: { ...record, items } });
});

// ======================== 创建接口 ========================

/**
 * POST /api/shipping/records
 * 新建运单记录（仅在"先录单、后扫码出库"场景使用）
 * body: { tracking_number, operator }
 */
router.post('/records', (req, res) => {
  const { tracking_number, operator } = req.body;

  if (!tracking_number || !tracking_number.trim()) {
    return res.status(400).json({ success: false, error: '运单号不能为空' });
  }

  const trimmed = tracking_number.trim();

  // 运单号唯一性校验
  const existing = getOne('SELECT id FROM shipping_records WHERE tracking_number = ?', [trimmed]);
  if (existing) {
    return res.status(400).json({ success: false, error: '该运单号已存在，请勿重复创建' });
  }

  const result = runInsert(
    'INSERT INTO shipping_records (tracking_number, operator, status, total_items) VALUES (?, ?, ?, ?)',
    [trimmed, operator || 'system', 'pending', 0]
  );

  if (result.success) {
    const newRecord = getOne('SELECT * FROM shipping_records WHERE id = ?', [result.lastId]);
    res.json({ success: true, data: newRecord });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

/**
 * PUT /api/shipping/records/:id/cancel
 * 取消运单（仅可取消 pending 状态的运单）
 */
router.put('/records/:id/cancel', (req, res) => {
  const { id } = req.params;

  const record = getOne('SELECT * FROM shipping_records WHERE id = ?', [id]);
  if (!record) {
    return res.status(404).json({ success: false, error: '运单记录不存在' });
  }

  if (record.status !== 'pending') {
    return res.status(400).json({ success: false, error: '仅可取消「待发货」状态的运单' });
  }

  const result = runQuery('UPDATE shipping_records SET status = ? WHERE id = ?', ['cancelled', id]);
  if (result.success) {
    res.json({ success: true, message: '运单已取消' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

/**
 * PUT /api/shipping/records/:id/ship
 * 标记运单为已发货
 */
router.put('/records/:id/ship', (req, res) => {
  const { id } = req.params;

  const record = getOne('SELECT * FROM shipping_records WHERE id = ?', [id]);
  if (!record) {
    return res.status(404).json({ success: false, error: '运单记录不存在' });
  }

  if (record.status !== 'pending') {
    return res.status(400).json({ success: false, error: '仅可发货「待发货」状态的运单' });
  }

  const result = runQuery('UPDATE shipping_records SET status = ? WHERE id = ?', ['shipped', id]);
  if (result.success) {
    res.json({ success: true, message: '运单已标记为已发货' });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

module.exports = router;
