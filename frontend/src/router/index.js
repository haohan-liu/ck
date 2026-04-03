import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue')
    },
    {
      path: '/warehouse',
      name: 'warehouse',
      component: () => import('@/components/WarehouseMap.vue')
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('@/views/ProductManage.vue')
    },
    {
      path: '/scan',
      name: 'scan',
      component: () => import('@/views/ScanStation.vue')
    },
    {
      path: '/inventory',
      name: 'inventory',
      component: () => import('@/views/InventoryLog.vue')
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoryManage.vue')
    }
  ]
})

export default router
