import { api } from './client.js'

export function getProducts(params) {
  return api.get('/products', { params })
}

export function getProduct(id) {
  return api.get(`/products/${id}`)
}

export function getProductBySku(code) {
  return api.get(`/products/sku/${code}`)
}

export function createProduct(data) {
  return api.post('/products', data)
}

export function updateProduct(id, data) {
  return api.put(`/products/${id}`, data)
}

export function deleteProduct(id) {
  return api.delete(`/products/${id}`)
}

export function resetAllProducts() {
  return api.post('/products/reset-all')
}

export function updateProductOrder(items) {
  return api.post('/products/reorder', { items })
}
