/**
 * locations.js — 库位管理 API 封装
 *
 * 对接后端 /api/locations 接口：
 *   - getShelfConfig()   读取货架配置
 *   - saveShelfConfig() 保存货架配置
 */

import { api } from './client.js'

/**
 * 读取货架配置（从后端 warehouse_settings 表）
 * @returns {Promise<{code, message, data}>}
 */
export function getShelfConfig() {
  return api.get('/locations/settings')
}

/**
 * 保存货架配置（持久化到后端 warehouse_settings 表）
 * @param {Object} config - 货架配置对象
 * @returns {Promise<{code, message, data}>}
 */
export function saveShelfConfig(config) {
  return api.post('/locations/settings', { value: config })
}
