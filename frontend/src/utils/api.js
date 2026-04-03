import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.message || error.message
    return Promise.reject(new Error(message))
  }
)

// 大类 API
export const categoryApi = {
  list: () => api.get('/categories'),
  get: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
}

// 产品 API
export const productApi = {
  list: () => api.get('/products'),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
}

// 库存 API
export const inventoryApi = {
  in: (data) => api.post('/inventory/in', data),
  out: (data) => api.post('/inventory/out', data),
  adjust: (data) => api.post('/inventory/adjust', data),
  logs: (productId) => api.get('/inventory/logs', { params: { product_id: productId } })
}

export default api
