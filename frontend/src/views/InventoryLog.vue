<script setup>
import { ref, onMounted, computed } from 'vue'
import { getLogs } from '../api/inventory.js'
import { getProducts } from '../api/products.js'

const logs = ref([])
const products = ref([])
const loading = ref(false)
const listError = ref('')
const total = ref(0)

// 筛选
const filterKeyword = ref('')
const filterProductId = ref('')

// 分页
const PAGE_SIZE = 20
const currentPage = ref(1)

const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE) || 1)

const PAGE_WINDOW = 5   // 最多显示 5 个页码

const visiblePages = computed(() => {
  const total = totalPages.value
  const cur = currentPage.value
  if (total <= PAGE_WINDOW) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (cur <= 3) return [1, 2, 3, 4, '...', total]
  if (cur >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total]
  return [1, '...', cur - 1, cur, cur + 1, '...', total]
})

// 防抖搜索
let searchTimer = null
function onKeywordInput() {
  currentPage.value = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadLogs, 400)
}

function onProductFilter() {
  currentPage.value = 1
  loadLogs()
}

function resetFilters() {
  filterKeyword.value = ''
  filterProductId.value = ''
  currentPage.value = 1
  loadLogs()
}

function goPage(page) {
  if (page === '...' || page === currentPage.value) return
  currentPage.value = page
  loadLogs()
}

async function loadLogs() {
  loading.value = true
  listError.value = ''
  try {
    const offset = (currentPage.value - 1) * PAGE_SIZE
    const params = {
      limit: PAGE_SIZE,
      offset,
    }
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    if (filterProductId.value) params.product_id = filterProductId.value

    const res = await getLogs(params)
    logs.value = res.data.data
    total.value = res.data.total || 0
  } catch (e) {
    listError.value = '加载日志失败，请检查后端服务'
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadProducts() {
  try {
    const res = await getProducts({})
    products.value = res.data.data
  } catch (e) {
    console.error(e)
  }
}

function formatTime(str) {
  if (!str) return '-'
  return str.replace('T', ' ').slice(0, 19)
}

function typeLabel(type) {
  if (type === 'in') return '入库'
  if (type === 'out') return '出库'
  if (type === 'adjust') return '调整'
  return type
}

function typeClasses(type) {
  if (type === 'in') return { bg: 'bg-emerald-950/60', text: 'text-emerald-400', label: '+' }
  if (type === 'out') return { bg: 'bg-red-950/60', text: 'text-red-400', label: '-' }
  if (type === 'adjust') return { bg: 'bg-amber-950/60', text: 'text-amber-400', label: '±' }
  return { bg: 'bg-slate-800', text: 'text-slate-400', label: '' }
}

onMounted(() => {
  loadProducts()
  loadLogs()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex items-center justify-between px-8 py-5 border-b border-slate-800 flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-slate-100">库存日志</h2>
        <p class="text-xs text-slate-500 mt-0.5">
          共 <span class="text-slate-300">{{ total }}</span> 条变动记录
        </p>
      </div>
    </header>

    <!-- 筛选栏 -->
    <div class="px-8 py-4 border-b border-slate-800 flex items-center gap-3 flex-shrink-0 bg-slate-900/30">
      <!-- 按产品筛选 -->
      <select
        v-model="filterProductId"
        @change="onProductFilter"
        class="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
      >
        <option value="">全部产品</option>
        <option v-for="p in products" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>

      <!-- 关键词搜索 -->
      <div class="flex-1 max-w-xs">
        <input
          v-model="filterKeyword"
          @input="onKeywordInput"
          type="text"
          placeholder="搜索产品名称 / SKU"
          class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <button
        @click="resetFilters"
        class="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors cursor-pointer"
      >
        重置
      </button>

      <!-- 分页信息 -->
      <span class="ml-auto text-xs text-slate-600">
        第 {{ currentPage }} / {{ totalPages }} 页
      </span>
    </div>

    <!-- 列表错误 -->
    <div
      v-if="listError"
      class="mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300"
    >
      <span class="text-red-400 text-base">!</span>
      {{ listError }}
      <button @click="listError = ''; loadLogs()" class="ml-auto text-red-400 hover:text-red-300 cursor-pointer">重试</button>
    </div>

    <!-- 表格区域 -->
    <div class="flex-1 overflow-auto p-8">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="flex flex-col items-center gap-3 text-slate-500">
          <div class="w-8 h-8 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-24 text-slate-600">
        <div class="text-5xl mb-4">◉</div>
        <p class="text-base mb-1">暂无日志记录</p>
        <p class="text-sm">对商品执行出入库或调整操作后，这里将显示流水</p>
      </div>

      <div v-else class="rounded-xl border border-slate-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
              <th class="px-5 py-3.5 text-left font-medium">时间</th>
              <th class="px-5 py-3.5 text-left font-medium">SKU</th>
              <th class="px-5 py-3.5 text-left font-medium">产品名称</th>
              <th class="px-5 py-3.5 text-center font-medium">类型</th>
              <th class="px-5 py-3.5 text-right font-medium">变动数量</th>
              <th class="px-5 py-3.5 text-left font-medium">备注</th>
              <th class="px-5 py-3.5 text-left font-medium pr-6">操作人</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/80">
            <tr
              v-for="log in logs"
              :key="log.id"
              class="hover:bg-slate-800/30 transition-colors"
            >
              <!-- 时间 -->
              <td class="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                {{ formatTime(log.created_at) }}
              </td>

              <!-- SKU -->
              <td class="px-5 py-4">
                <span class="font-mono text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                  {{ log.sku_code || '-' }}
                </span>
              </td>

              <!-- 产品名称 -->
              <td class="px-5 py-4">
                <span class="text-slate-200 font-medium">{{ log.product_name || '（已删除）' }}</span>
              </td>

              <!-- 变动类型 -->
              <td class="px-5 py-4 text-center">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                  :class="[typeClasses(log.type).bg, typeClasses(log.type).text]"
                >
                  {{ typeLabel(log.type) }}
                </span>
              </td>

              <!-- 变动数量（带符号） -->
              <td class="px-5 py-4 text-right">
                <span
                  class="font-semibold"
                  :class="typeClasses(log.type).text"
                >
                  {{ typeClasses(log.type).label }}{{ Math.abs(log.quantity) }}
                </span>
                <span class="text-slate-600 text-xs ml-1">{{ log.product_unit || '件' }}</span>
              </td>

              <!-- 备注 -->
              <td class="px-5 py-4">
                <span
                  v-if="log.note"
                  class="text-slate-400 text-xs max-w-[180px] truncate block"
                  :title="log.note"
                >
                  {{ log.note }}
                </span>
                <span v-else class="text-slate-700 text-xs">—</span>
              </td>

              <!-- 操作人 -->
              <td class="px-5 py-4 pr-6 text-slate-500 text-xs">
                {{ log.operator || 'system' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 mt-6">
        <!-- 上一页 -->
        <button
          @click="goPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          &laquo;
        </button>

        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goPage(page)"
          class="px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer"
          :class="
            page === currentPage
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : page === '...'
                ? 'border-transparent text-slate-600 cursor-default'
                : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-500'
          "
        >
          {{ page }}
        </button>

        <!-- 下一页 -->
        <button
          @click="goPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          &raquo;
        </button>
      </div>
    </div>
  </div>
</template>
