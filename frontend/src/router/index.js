import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/categories',
  },
  {
    path: '/categories',
    name: 'CategoryManage',
    component: () => import('../views/CategoryManage.vue'),
  },
  {
    path: '/products',
    name: 'ProductManage',
    component: () => import('../views/ProductManage.vue'),
  },
  {
    path: '/inventory',
    name: 'InventoryLog',
    component: () => import('../views/InventoryLog.vue'),
  },
  {
    path: '/stats',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
