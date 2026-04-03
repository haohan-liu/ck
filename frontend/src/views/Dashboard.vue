<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">库存看板</h1>
      <span class="page-subtitle">WMS 仓储管理系统</span>
    </div>

    <!-- 顶部指标卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.totalProducts }}</span>
          <span class="stat-label">SKU 种类</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.totalStock.toLocaleString() }}</span>
          <span class="stat-label">总库存件数</span>
        </div>
      </div>

      <div class="stat-card highlight">
        <div class="stat-icon purple">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value value-rmb">{{ formatCurrency(stats.totalValue) }}</span>
          <span class="stat-label">库存总货值</span>
        </div>
      </div>

      <div class="stat-card" :class="{ danger: stats.lowStockCount > 0 }">
        <div class="stat-icon" :class="stats.lowStockCount > 0 ? 'red' : 'orange'">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="stat-info">
          <span class="stat-value" :class="stats.lowStockCount > 0 ? 'text-danger' : ''">{{ stats.lowStockCount }}</span>
          <span class="stat-label">低库存预警</span>
        </div>
      </div>
    </div>

    <!-- 主体布局：左右分栏 -->
    <div class="main-content">
      <!-- 左侧：需补货清单 -->
      <div class="content-card">
        <div class="card-header">
          <h3 class="card-title">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            需补货清单
          </h3>
          <span v-if="lowStockProducts.length > 0" class="badge badge-danger">{{ lowStockProducts.length }}</span>
        </div>
        <div class="card-body">
          <div v-if="loading.lowStock" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="lowStockProducts.length === 0" class="empty-state">
            <svg class="w-12 h-12 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>库存充足，无需补货</p>
          </div>
          <div v-else class="stock-list">
            <div v-for="item in lowStockProducts" :key="item.id" class="stock-item">
              <div class="stock-info">
                <span class="stock-name">{{ item.name }}</span>
                <span class="stock-location" v-if="item.location_code">{{ item.location_code }}</span>
              </div>
              <div class="stock-numbers">
                <span class="current-stock" :class="item.current_stock === 0 ? 'zero' : 'low'">
                  {{ item.current_stock }}
                </span>
                <span class="stock-divider">/</span>
                <span class="min-stock">{{ item.min_stock }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：最新入库动态 -->
      <div class="content-card">
        <div class="card-header">
          <h3 class="card-title">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            最新出入库动态
          </h3>
        </div>
        <div class="card-body">
          <div v-if="loading.logs" class="loading-state">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="recentLogs.length === 0" class="empty-state">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p>暂无操作记录</p>
          </div>
          <div v-else class="log-list">
            <div v-for="log in recentLogs" :key="log.id" class="log-item">
              <div class="log-icon" :class="log.type">
                <svg v-if="log.type === 'in'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <svg v-else-if="log.type === 'out'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8V4m0 0L13 8m4 4l4-4m-9 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div class="log-content">
                <div class="log-product">{{ log.product_name || log.sku_code }}</div>
                <div class="log-meta">
                  <span class="log-time">{{ formatTime(log.created_at) }}</span>
                  <span v-if="log.note" class="log-note">{{ log.note }}</span>
                </div>
              </div>
              <div class="log-quantity" :class="log.type">
                {{ log.type === 'in' ? '+' : log.type === 'out' ? '-' : '' }}{{ log.quantity }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <router-link to="/products" class="quick-action">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
        </svg>
        <span>商品管理</span>
      </router-link>
      <router-link to="/scan" class="quick-action scan">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m10 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <span>扫码出入库</span>
      </router-link>
      <router-link to="/inventory" class="quick-action">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        </svg>
        <span>库存日志</span>
      </router-link>
      <router-link to="/categories" class="quick-action">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span>大类管理</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { statsApi } from '@/api/index.js'

const stats = ref({
  totalProducts: 0,
  totalStock: 0,
  totalValue: 0,
  lowStockCount: 0,
  zeroStockCount: 0
})

const lowStockProducts = ref([])
const recentLogs = ref([])
const loading = ref({
  stats: false,
  lowStock: false,
  logs: false
})

// 定时刷新
let refreshInterval = null

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return '￥' + Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now - date

  // 5分钟内显示"刚刚"
  if (diff < 5 * 60 * 1000) return '刚刚'

  // 1小时内显示"X分钟前"
  if (diff < 60 * 60 * 1000) {
    return Math.floor(diff / 60 / 1000) + '分钟前'
  }

  // 24小时内显示"X小时前"
  if (diff < 24 * 60 * 60 * 1000) {
    return Math.floor(diff / 60 / 60 / 1000) + '小时前'
  }

  // 否则显示日期时间
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

async function loadStats() {
  try {
    const res = await statsApi.get()
    if (res.success) {
      stats.value = res.data
    }
  } catch (err) {
    console.error('加载统计数据失败:', err)
  }
}

async function loadLowStock() {
  loading.value.lowStock = true
  try {
    const res = await statsApi.getLowStock()
    if (res.success) {
      lowStockProducts.value = res.data
    }
  } catch (err) {
    console.error('加载低库存列表失败:', err)
  } finally {
    loading.value.lowStock = false
  }
}

async function loadRecentLogs() {
  loading.value.logs = true
  try {
    const res = await statsApi.getRecentLogs(10)
    if (res.success) {
      recentLogs.value = res.data
    }
  } catch (err) {
    console.error('加载操作记录失败:', err)
  } finally {
    loading.value.logs = false
  }
}

async function loadAll() {
  await Promise.all([loadStats(), loadLowStock(), loadRecentLogs()])
}

onMounted(() => {
  loadAll()
  // 每30秒自动刷新一次
  refreshInterval = setInterval(loadStats, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.page-subtitle {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-card.highlight {
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border: 1px solid #c4b5fd;
}

.stat-card.danger {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 1px solid #fca5a5;
}

.stat-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 1.75rem;
  height: 1.75rem;
}

.stat-icon.blue {
  background: #eff6ff;
  color: #3b82f6;
}

.stat-icon.green {
  background: #f0fdf4;
  color: #22c55e;
}

.stat-icon.purple {
  background: #f5f3ff;
  color: #7c3aed;
}

.stat-icon.orange {
  background: #fffbeb;
  color: #f59e0b;
}

.stat-icon.red {
  background: #fef2f2;
  color: #ef4444;
}

.stat-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}

.stat-value.value-rmb {
  color: #7c3aed;
  font-size: 1.5rem;
}

.stat-value.text-danger {
  color: #ef4444;
}

.stat-label {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

/* 主体布局 */
.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.content-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}

.card-title svg {
  color: #6b7280;
}

.card-body {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  gap: 0.75rem;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
}

.empty-state p {
  font-size: 0.875rem;
}

/* 补货列表 */
.stock-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border-radius: 8px;
  transition: background 0.15s;
}

.stock-item:hover {
  background: #f3f4f6;
}

.stock-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.stock-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-location {
  font-size: 0.75rem;
  color: #6b7280;
  font-family: monospace;
}

.stock-numbers {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  flex-shrink: 0;
}

.current-stock {
  font-size: 1.25rem;
  font-weight: 700;
}

.current-stock.zero {
  color: #ef4444;
}

.current-stock.low {
  color: #f59e0b;
}

.stock-divider {
  color: #d1d5db;
}

.min-stock {
  font-size: 0.875rem;
  color: #6b7280;
}

/* 操作日志列表 */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  transition: background 0.15s;
}

.log-item:hover {
  background: #f9fafb;
}

.log-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-icon.in {
  background: #f0fdf4;
  color: #22c55e;
}

.log-icon.out {
  background: #fef2f2;
  color: #ef4444;
}

.log-icon.adjust {
  background: #eff6ff;
  color: #3b82f6;
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-product {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.log-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.log-note {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.log-quantity {
  font-size: 1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.log-quantity.in {
  color: #22c55e;
}

.log-quantity.out {
  color: #ef4444;
}

.log-quantity.adjust {
  color: #3b82f6;
}

/* 徽章 */
.badge {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-danger {
  background: #fef2f2;
  color: #ef4444;
}

/* 快捷操作 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.quick-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  background: #f9fafb;
  border-radius: 12px;
  color: #374151;
  text-decoration: none;
  transition: all 0.15s;
}

.quick-action:hover {
  background: #f3f4f6;
  transform: translateY(-2px);
}

.quick-action svg {
  width: 1.5rem;
  height: 1.5rem;
  color: #6b7280;
}

.quick-action span {
  font-size: 0.875rem;
  font-weight: 500;
}

.quick-action.scan {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  color: white;
}

.quick-action.scan svg {
  color: #60a5fa;
}

.quick-action.scan:hover {
  background: linear-gradient(135deg, #2d2d44, #1a1a2e);
}

/* 响应式 */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .main-content {
    grid-template-columns: 1fr;
  }

  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .stat-value.value-rmb {
    font-size: 1.25rem;
  }

  .quick-actions {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
