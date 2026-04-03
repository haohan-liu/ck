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

export function getLogs(params) {
  return api.get('/inventory/logs', { params })
}
