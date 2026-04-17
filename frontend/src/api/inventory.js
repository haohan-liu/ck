import { api } from './client.js'

export function stockIn(data) {
  return api.post('/inventory/in', data)
}

export function stockOut(data) {
  return api.post('/inventory/out', data)
}

export function stockAdjust(data) {
  return api.post('/inventory/adjust', data)
}

export function batchStockIn(data) {
  return api.post('/inventory/batch-in', data)
}

export function batchStockOut(data) {
  return api.post('/inventory/batch-out', data)
}

export function getLogs(params) {
  return api.get('/inventory/logs', { params })
}

// 扫码出库（带运单号绑定）
export function scanStockOut(data) {
  return api.post('/inventory/scan-out', data)
}

// 别名兼容
export const getInventoryLogs = getLogs

// 批量删除日志
export function deleteLogs(data) {
  return api.delete('/inventory/logs', { data })
}

// 更新日志备注
export function updateLogNote(id, note) {
  return api.put(`/inventory/logs/${id}/note`, { note })
}

// 批量绑定国内单号（集包功能）
export function updateBatchDomesticTracking(ids, domesticTracking) {
  return api.put('/inventory/logs/batch-domestic-tracking', { ids, domestic_tracking: domesticTracking })
}
