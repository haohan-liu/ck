import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.message || error.message || '网络错误'
    return Promise.reject(new Error(message))
  }
)

// ============================================
// 大类 API
// ============================================
export const categoryApi = {
  list: () => api.get('/categories'),
  get: (id) => api.get(`/categories/${Number(id)}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${Number(id)}`, data),
  delete: (id) => api.delete(`/categories/${Number(id)}`)
}

// ============================================
// 产品 API
// ============================================
export const productApi = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${Number(id)}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${Number(id)}`, data),
  delete: (id) => api.delete(`/products/${Number(id)}`),
  resetAll: () => api.post('/products/reset-all'),
  resetOne: (id) => api.delete(`/products/${id}/reset`)
}

// ============================================
// 库存 API
// ============================================
export const inventoryApi = {
  in: (data) => api.post('/inventory/in', data),
  out: (data) => api.post('/inventory/out', data),
  adjust: (data) => api.post('/inventory/adjust', data),
  // 传入productId则只查该商品日志，不传则查所有日志
  logs: (params) => api.get('/inventory/logs', { params })
}

// ============================================
// 统计 API
// ============================================
export const statsApi = {
  get: () => api.get('/stats'),
  getLowStock: () => api.get('/stats/low-stock'),
  getRecentLogs: (limit = 10) => api.get('/stats/recent-logs', { params: { limit } })
}

export default api
