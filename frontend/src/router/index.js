import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/stats',
  },
  {
    path: '/stats',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
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
    path: '/categories',
    name: 'CategoryManage',
    component: () => import('../views/CategoryManage.vue'),
  },
  {
    path: '/scan',
    name: 'ScanStation',
    component: () => import('../views/ScanStation.vue'),
    meta: { title: '扫码工作站' }
  },
  {
    path: '/map',
    name: 'LocationMap',
    component: () => import('../views/LocationMap.vue'),
    meta: { title: '库位地图' }
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach(() => {
  document.title = '档把库存系统'
})

export default router
