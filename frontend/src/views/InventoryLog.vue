<template>
  <div class="page-container">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">库存日志</h1>
        <span class="log-count">{{ filteredLogs.length }} 条记录</span>
      </div>
      <div class="top-bar-actions">
        <!-- 类型筛选 -->
        <div class="search-group">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <select v-model="filterType" class="filter-select">
            <option value="">全部类型</option>
            <option value="in">入库</option>
            <option value="out">出库</option>
            <option value="adjust">调整</option>
          </select>
        </div>

        <!-- 商品筛选 -->
        <div class="search-group">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="keyword"
            type="text"
            class="search-input"
            placeholder="搜索商品..."
          />
        </div>

        <button class="btn-refresh" @click="loadLogs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="th-time">时间</th>
            <th class="th-type">类型</th>
            <th class="th-sku">SKU</th>
            <th class="th-name">商品名称</th>
            <th class="th-quantity text-right">数量</th>
            <th class="th-note">备注</th>
            <th class="th-operator">操作人</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in paginatedLogs" :key="log.id" class="data-row">
            <td class="td-time">
              <div class="time-cell">
                <span class="date">{{ formatDate(log.created_at) }}</span>
                <span class="time">{{ formatTimeOnly(log.created_at) }}</span>
              </div>
            </td>
            <td class="td-type">
              <span class="type-badge" :class="`type-${log.type}`">
                <span class="type-dot"></span>
                {{ getTypeName(log.type) }}
              </span>
            </td>
            <td class="td-sku">
              <span class="sku-tag">{{ log.sku_code || '—' }}</span>
            </td>
            <td class="td-name">
              <span class="product-name">{{ log.product_name || '—' }}</span>
            </td>
            <td class="td-quantity text-right">
              <span class="quantity-value" :class="getQuantityClass(log)">
                {{ getQuantityPrefix(log) }}{{ log.quantity }}
              </span>
            </td>
            <td class="td-note">
              <span class="note-text" :title="log.note">{{ log.note || '—' }}</span>
            </td>
            <td class="td-operator">
              <span class="operator-text">{{ log.operator || '系统' }}</span>
            </td>
          </tr>

          <!-- 空状态 -->
          <tr v-if="filteredLogs.length === 0">
            <td colspan="7" class="empty-cell">
              <div class="empty-state">
                <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p class="empty-title">暂无日志记录</p>
                <p class="empty-desc">对商品进行出入库操作后，记录将显示在这里</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="page--">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        上一页
      </button>
      <div class="page-numbers">
        <button
          v-for="p in pageNumbers"
          :key="p"
          class="page-number"
          :class="{ active: p === page }"
          @click="page = p"
        >
          {{ p }}
        </button>
      </div>
      <button class="page-btn" :disabled="page >= totalPages" @click="page++">
        下一页
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { inventoryApi } from '@/api/index.js'

const PAGE_SIZE = 20

const logs = ref([])
const filterType = ref('')
const keyword = ref('')
const page = ref(1)
const loading = ref(false)

async function loadLogs() {
  loading.value = true
  try {
    const res = await inventoryApi.logs()
    logs.value = res.data || []
  } catch (err) {
    console.error('加载日志失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadLogs()
})

const filteredLogs = computed(() => {
  let list = [...logs.value]

  if (filterType.value) {
    list = list.filter(l => l.type === filterType.value)
  }

  if (keyword.value.trim()) {
    const kw = keyword.value.toLowerCase()
    list = list.filter(l =>
      (l.sku_code || '').toLowerCase().includes(kw) ||
      (l.product_name || '').toLowerCase().includes(kw) ||
      (l.note || '').toLowerCase().includes(kw)
    )
  }

  return list
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredLogs.value.length / PAGE_SIZE))
)

const paginatedLogs = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredLogs.value.slice(start, start + PAGE_SIZE)
})

// 分页页码
const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = page.value
  const pages = []
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }
  return pages
})

function formatDate(timeStr) {
  if (!timeStr) return '—'
  const date = new Date(timeStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

function formatTimeOnly(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getTypeName(type) {
  const map = { in: '入库', out: '出库', adjust: '调整' }
  return map[type] || type
}

function getQuantityClass(log) {
  if (log.type === 'in') return 'quantity-positive'
  if (log.type === 'out') return 'quantity-negative'
  return 'quantity-neutral'
}

function getQuantityPrefix(log) {
  if (log.type === 'in') return '+'
  if (log.type === 'out') return '-'
  return ''
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

/* ---- 顶部操作栏 ---- */
.top-bar {
  background: white;
  padding: 1.25rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
}

.top-bar-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.log-count {
  font-size: 0.8125rem;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
  pointer-events: none;
}

.search-input {
  height: 2.75rem;
  padding: 0 0.875rem 0 2.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #374151;
  background: white;
  outline: none;
  transition: all 0.2s;
  width: 200px;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.filter-select {
  height: 2.75rem;
  padding: 0 2.75rem 0 2.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #374151;
  background: white;
  outline: none;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  background-size: 1rem 1rem;
  cursor: pointer;
}

.filter-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-refresh {
  height: 2.75rem;
  padding: 0 1.125rem;
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-refresh:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

/* ---- 数据表格 ---- */
.table-wrapper {
  flex: 1;
  padding: 1.5rem 2rem;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.data-table thead {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.data-table th {
  padding: 1rem 1.25rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.data-table th.text-right {
  text-align: right;
}

.data-table td {
  padding: 1rem 1.25rem;
  font-size: 0.875rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.data-table td.text-right {
  text-align: right;
}

.data-row {
  transition: background 0.15s;
}

.data-row:last-child td {
  border-bottom: none;
}

.data-row:hover {
  background: #fafbfc;
}

/* 时间 */
.td-time {
  white-space: nowrap;
}

.time-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.time-cell .date {
  font-size: 0.8125rem;
  color: #334155;
  font-weight: 500;
}

.time-cell .time {
  font-size: 0.75rem;
  color: #94a3b8;
}

/* 类型标签 */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.type-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.type-in {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  color: #15803d;
}

.type-in .type-dot {
  background: #22c55e;
}

.type-out {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #dc2626;
}

.type-out .type-dot {
  background: #ef4444;
}

.type-adjust {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #2563eb;
}

.type-adjust .type-dot {
  background: #3b82f6;
}

/* SKU */
.sku-tag {
  display: inline-block;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
}

/* 商品名称 */
.product-name {
  font-weight: 500;
  color: #1e293b;
}

/* 数量 */
.quantity-value {
  font-weight: 700;
  font-size: 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.quantity-positive {
  color: #15803d;
}

.quantity-negative {
  color: #dc2626;
}

.quantity-neutral {
  color: #2563eb;
}

/* 备注 */
.note-text {
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
  font-size: 0.8125rem;
}

/* 操作人 */
.operator-text {
  color: #94a3b8;
  font-size: 0.8125rem;
}

/* 空状态 */
.empty-cell {
  padding: 4rem 1rem !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.empty-desc {
  font-size: 0.875rem;
  color: #94a3b8;
}

/* 分页 */
.pagination {
  padding: 1.5rem 2rem 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.page-btn {
  height: 2.5rem;
  padding: 0 0.875rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.page-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
  margin: 0 0.5rem;
}

.page-number {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.page-number:hover {
  background: #f1f5f9;
}

.page-number.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

/* 响应式 */
@media (max-width: 1024px) {
  .top-bar {
    padding: 1rem 1.5rem;
  }
  
  .table-wrapper {
    padding: 1rem 1.5rem;
  }
  
  .search-input {
    width: 160px;
  }
}

@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .top-bar-actions {
    width: 100%;
  }
  
  .search-input {
    flex: 1;
    width: auto;
  }
  
  .data-table th,
  .data-table td {
    padding: 0.75rem 1rem;
  }
}
</style>
