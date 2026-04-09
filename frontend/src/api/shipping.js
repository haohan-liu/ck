import { api } from './client.js'

/**
 * ============================================================
 * 运单记录管理 API
 * ============================================================
 */

// 获取所有运单记录（可选状态过滤）
export function getShippingRecords(params) {
  return api.get('/shipping/records', { params })
}

// 获取单条运单详情
export function getShippingRecordById(id) {
  return api.get(`/shipping/records/${id}`)
}

// 根据运单号查询运单及明细
export function getShippingByTracking(tracking_number) {
  return api.get('/shipping/items', { params: { tracking_number } })
}

// 新建运单记录（预创建运单号）
export function createShippingRecord(data) {
  return api.post('/shipping/records', data)
}

// 标记运单为已发货
export function shipShippingRecord(id) {
  return api.put(`/shipping/records/${id}/ship`)
}

// 取消运单
export function cancelShippingRecord(id) {
  return api.put(`/shipping/records/${id}/cancel`)
}

// 扫码出库（绑定运单号）
export function scanStockOut(data) {
  return api.post('/inventory/scan-out', data)
}