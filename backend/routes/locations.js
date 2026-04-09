/**
 * locations.js — 库位管理路由
 *
 * 职责：
 *   - GET  /api/locations/settings   读取货架配置（key = 'shelf_config'）
 *   - POST /api/locations/settings   保存货架配置（key = 'shelf_config'）
 */

const express = require('express')
const router = express.Router()
const { getDb, runQuery, saveDatabase } = require('../db')

const SETTING_KEY = 'shelf_config'

/**
 * GET /api/locations/settings
 * 读取货架配置数据
 */
router.get('/settings', (req, res) => {
  try {
    const db = getDb()
    const stmt = db.prepare('SELECT setting_value, updated_at FROM warehouse_settings WHERE setting_key = ?')
    stmt.bind([SETTING_KEY])

    let data = null
    if (stmt.step()) {
      const row = stmt.getAsObject()
      try {
        data = JSON.parse(row.setting_value)
      } catch {
        data = null
      }
    }
    stmt.free()

    res.json({
      code: 200,
      message: '读取成功',
      data: {
        key: SETTING_KEY,
        value: data,
        updated_at: data ? new Date().toISOString() : null,
      },
    })
  } catch (error) {
    console.error('[locations] GET /settings 错误:', error)
    res.status(500).json({
      code: 500,
      message: '读取货架配置失败',
      data: null,
    })
  }
})

/**
 * POST /api/locations/settings
 * 保存货架配置数据
 *
 * body: { value: <任意 JSON 数据> }
 */
router.post('/settings', (req, res) => {
  try {
    const { value } = req.body

    if (value === undefined || value === null) {
      return res.status(400).json({
        code: 400,
        message: '缺少 value 字段',
        data: null,
      })
    }

    const db = getDb()
    const jsonValue = JSON.stringify(value)
    const now = new Date().toISOString()

    // 尝试先查是否存在
    const stmt = db.prepare('SELECT id FROM warehouse_settings WHERE setting_key = ?')
    stmt.bind([SETTING_KEY])
    const exists = stmt.step()
    stmt.free()

    if (exists) {
      db.run(
        'UPDATE warehouse_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?',
        [jsonValue, now, SETTING_KEY]
      )
    } else {
      db.run(
        'INSERT INTO warehouse_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)',
        [SETTING_KEY, jsonValue, now]
      )
    }

    saveDatabase()

    res.json({
      code: 200,
      message: '保存成功',
      data: {
        key: SETTING_KEY,
        value,
        updated_at: now,
      },
    })
  } catch (error) {
    console.error('[locations] POST /settings 错误:', error)
    res.status(500).json({
      code: 500,
      message: '保存货架配置失败',
      data: null,
    })
  }
})

module.exports = router
