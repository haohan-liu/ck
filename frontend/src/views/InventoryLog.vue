<script setup>
import { ref, onMounted } from 'vue'
import { getLogs } from '../api/inventory.js'

const logs = ref([])
const loading = ref(false)
const error = ref('')
const filterType = ref('')
const filterKeyword = ref('')

async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (filterType.value) params.type = filterType.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await getLogs(params)
    logs.value = res.data.data || []
  } catch (e) {
    error.value = '加载库存日志失败'
    console.error(e)
  } finally {
    loading.value = false
  }
}

let searchTimer = null
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadLogs, 400)
}

function resetFilters() {
  filterType.value = ''
  filterKeyword.value = ''
  loadLogs()
}

onMounted(loadLogs)

function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 19) || '-'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatDate(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 16) || '-'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function typeLabel(type) {
  if (type === 'in') return '入库'
  if (type === 'out') return '出库'
  if (type === 'adjust') return '调整'
  if (type === 'add') return '新增商品'
  return type || '-'
}

function typeClass(type) {
  if (type === 'in') return 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
  if (type === 'out') return 'bg-red-950/60 text-red-400 border border-red-700/50'
  if (type === 'adjust') return 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
  if (type === 'add') return 'bg-blue-950/60 text-blue-400 border border-blue-700/50'
  return 'bg-[var(--input-bg)] text-[var(--text-muted)] border border-[var(--border-default)]'
}

function typeDotClass(type) {
  if (type === 'in') return 'bg-emerald-400'
  if (type === 'out') return 'bg-red-400'
  if (type === 'adjust') return 'bg-amber-400'
  if (type === 'add') return 'bg-blue-400'
  return 'bg-[var(--text-muted)]'
}

function safeStock(val) {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-[var(--border-default)]">
      <div>
        <h2 class="text-base sm:text-lg font-semibold text-[var(--text-primary)]">库存日志</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">记录所有库存变动历史</p>
      </div>
      <button
        @click="loadLogs"
        class="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <span class="hidden sm:inline">刷新</span>
      </button>
    </header>

    <!-- 筛选栏 -->
    <div class="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-[var(--border-default)] flex items-center gap-2 sm:gap-3 flex-shrink-0 bg-[var(--bg-secondary)]/50">
      <select
        v-model="filterType"
        @change="loadLogs"
        class="px-2.5 sm:px-3 py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-xs sm:text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-all duration-150 cursor-pointer appearance-none min-w-[70px] sm:min-w-[120px]"
      >
        <option value="">全部</option>
        <option value="add">新增</option>
        <option value="in">入库</option>
        <option value="out">出库</option>
        <option value="adjust">调整</option>
      </select>

      <div class="flex-1 min-w-0">
        <input
          v-model="filterKeyword"
          @input="onKeywordInput"
          type="text"
          placeholder="搜索商品名称 / SKU"
          class="w-full px-3 py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-xs sm:text-sm text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all duration-150"
        />
      </div>

      <button
        @click="resetFilters"
        class="px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer hidden sm:block"
      >
        重置
      </button>
    </div>

    <!-- 列表错误 -->
    <div
      v-if="error"
      class="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs sm:text-sm text-red-300"
    >
      <span class="text-red-400 text-base shrink-0">!</span>
      {{ error }}
      <button @click="error = ''; loadLogs()" class="ml-auto text-red-400 hover:text-red-300 cursor-pointer">重试</button>
    </div>

    <!-- 列表 / 空状态 / 加载 -->
    <div class="flex-1 overflow-auto">

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-12 sm:py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && logs.length === 0" class="flex flex-col items-center justify-center py-20 sm:py-24 text-[var(--text-muted)]">
        <div class="text-4xl sm:text-5xl mb-4 opacity-40">◉</div>
        <p class="text-sm sm:text-base mb-1">暂无库存日志</p>
        <p class="text-xs sm:text-sm opacity-60 hidden sm:block">入库、出库或调整操作后会产生日志</p>
      </div>

      <!-- 有数据：PC 端表格（>= lg） -->
      <div v-if="!loading && logs.length > 0" class="hidden lg:block p-6 lg:p-8">
        <div class="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                <th class="px-5 py-3.5 text-left font-medium whitespace-nowrap">操作时间</th>
                <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                <th class="px-5 py-3.5 text-left font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">类型</th>
                <th class="px-5 py-3.5 text-center font-medium">数量</th>
                <th class="px-5 py-3.5 text-center font-medium">操作前</th>
                <th class="px-5 py-3.5 text-center font-medium">操作后</th>
                <th class="px-5 py-3.5 text-left font-medium">备注</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-default)]">
              <tr
                v-for="log in logs"
                :key="log.id"
                class="bg-[var(--row-bg)] hover:bg-[var(--hover-bg)] transition-colors duration-100"
              >
                <td class="px-5 py-4 text-[var(--text-muted)] text-xs whitespace-nowrap">
                  {{ formatTime(log.created_at) }}
                </td>
                <td class="px-5 py-4 text-[var(--text-primary)] font-medium">
                  {{ log.product_name || '-' }}
                </td>
                <td class="px-5 py-4">
                  <span
                    v-if="log.category_name"
                    class="inline-flex items-center px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]"
                  >
                    {{ log.category_name }}
                  </span>
                  <span v-else class="text-[var(--text-muted)] text-xs">-</span>
                </td>
                <td class="px-5 py-4 text-center">
                  <span
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded"
                    :class="typeClass(log.type)"
                  >
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="typeDotClass(log.type)"></span>
                    {{ typeLabel(log.type) }}
                  </span>
                </td>
                <td class="px-5 py-4 text-center">
                  <span
                    class="font-semibold tabular-nums"
                    :class="log.type === 'in' || log.type === 'add' ? 'text-emerald-400' : (log.type === 'out' ? 'text-red-400' : 'text-amber-400')"
                  >
                    {{ log.type === 'in' || log.type === 'add' ? '+' : (log.type === 'out' ? '-' : '') }}{{ safeStock(log.quantity) }}
                  </span>
                </td>
                <td class="px-5 py-4 text-center text-[var(--text-muted)] tabular-nums">
                  {{ safeStock(log.stock_before) }}
                </td>
                <td class="px-5 py-4 text-center text-[var(--text-muted)] tabular-nums">
                  {{ safeStock(log.stock_after) }}
                </td>
                <td class="px-5 py-4 text-[var(--text-muted)] text-xs max-w-[200px] truncate">
                  {{ log.note || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 有数据：平板/手机端卡片列表（< lg） -->
      <div v-if="!loading && logs.length > 0" class="lg:hidden p-4 sm:p-6 space-y-2 sm:space-y-3">
        <div
          v-for="log in logs"
          :key="log.id"
          class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-4 space-y-2.5 hover:border-[var(--border-strong)] transition-colors"
        >
          <!-- 第一行：时间 + 类型标签 -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] sm:text-xs text-[var(--text-muted)]">{{ formatDate(log.created_at) }}</span>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded"
              :class="typeClass(log.type)"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="typeDotClass(log.type)"></span>
              {{ typeLabel(log.type) }}
            </span>
          </div>

          <!-- 商品名称 -->
          <div class="text-xs sm:text-sm font-medium text-[var(--text-primary)] leading-snug">
            {{ log.product_name || '-' }}
          </div>

          <!-- 库存变化核心数据 -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{{ safeStock(log.stock_before) }}</span>
              <span class="opacity-40">&#8594;</span>
              <span class="font-medium text-[var(--text-secondary)]">{{ safeStock(log.stock_after) }}</span>
            </div>
            <span
              class="text-sm sm:text-base font-bold tabular-nums"
              :class="log.type === 'in' || log.type === 'add' ? 'text-emerald-400' : (log.type === 'out' ? 'text-red-400' : 'text-amber-400')"
            >
              {{ log.type === 'in' || log.type === 'add' ? '+' : (log.type === 'out' ? '-' : '') }}{{ safeStock(log.quantity) }}
            </span>
          </div>

          <!-- 备注 + 大类（仅平板显示） -->
          <div v-if="log.note || log.category_name" class="flex items-center gap-3 text-[10px] sm:text-xs text-[var(--text-muted)]">
            <span v-if="log.category_name" class="inline-flex items-center px-1.5 py-0.5 bg-[var(--input-bg)] rounded border border-[var(--border-default)]">
              {{ log.category_name }}
            </span>
            <span v-if="log.note" class="truncate flex-1">{{ log.note }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
