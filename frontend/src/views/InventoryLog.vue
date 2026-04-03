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
    logs.value = res.data.data
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
  return t.replace('T', ' ').slice(0, 19)
}

function typeLabel(type) {
  if (type === 'in') return '入库'
  if (type === 'out') return '出库'
  if (type === 'adjust') return '调整'
  return type
}

function typeClass(type) {
  if (type === 'in') return 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
  if (type === 'out') return 'bg-red-950/60 text-red-400 border border-red-700/50'
  if (type === 'adjust') return 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
  return 'bg-[var(--input-bg)] text-[var(--text-muted)] border border-[var(--border-default)]'
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex items-center justify-between px-8 py-5 border-b border-[var(--border-default)] flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-[var(--text-primary)]">库存日志</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5">记录所有库存变动历史</p>
      </div>
    </header>

    <!-- 筛选栏 -->
    <div class="px-8 py-4 border-b border-[var(--border-default)] flex items-center gap-3 flex-shrink-0 bg-[var(--bg-secondary)]/50">
      <select
        v-model="filterType"
        @change="loadLogs"
        class="px-3 py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-all duration-150 cursor-pointer appearance-none"
      >
        <option value="">全部类型</option>
        <option value="in">入库</option>
        <option value="out">出库</option>
        <option value="adjust">调整</option>
      </select>

      <div class="flex-1 max-w-xs">
        <input
          v-model="filterKeyword"
          @input="onKeywordInput"
          type="text"
          placeholder="搜索商品名称"
          class="w-full px-3 py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all duration-150"
        />
      </div>

      <button
        @click="resetFilters"
        class="px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
      >
        重置
      </button>
    </div>

    <!-- 列表错误 -->
    <div
      v-if="error"
      class="mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300"
    >
      <span class="text-red-400 text-base">!</span>
      {{ error }}
      <button @click="error = ''; loadLogs()" class="ml-auto text-red-400 hover:text-red-300 cursor-pointer">重试</button>
    </div>

    <!-- 表格区域 -->
    <div class="flex-1 overflow-auto p-8">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
        <div class="text-5xl mb-4">◉</div>
        <p class="text-base mb-1">暂无库存日志</p>
        <p class="text-sm">对商品进行入库、出库或调整操作后会产生日志</p>
      </div>

      <div v-else class="rounded-xl border border-[var(--border-default)] overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
              <th class="px-5 py-3.5 text-left font-medium">操作时间</th>
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
              class="bg-[var(--row-bg)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <td class="px-5 py-4 text-[var(--text-muted)] text-xs whitespace-nowrap">
                {{ formatTime(log.created_at) }}
              </td>
              <td class="px-5 py-4 text-[var(--text-primary)] font-medium">{{ log.product_name }}</td>
              <td class="px-5 py-4">
                <span class="inline-flex items-center px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]">
                  {{ log.category_name }}
                </span>
              </td>
              <td class="px-5 py-4 text-center">
                <span
                  class="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                  :class="typeClass(log.type)"
                >
                  {{ typeLabel(log.type) }}
                </span>
              </td>
              <td class="px-5 py-4 text-center">
                <span
                  class="font-semibold"
                  :class="log.type === 'in' ? 'text-emerald-400' : (log.type === 'out' ? 'text-red-400' : 'text-amber-400')"
                >
                  {{ log.type === 'in' ? '+' : (log.type === 'out' ? '-' : '') }}{{ log.quantity }}
                </span>
              </td>
              <td class="px-5 py-4 text-center text-[var(--text-muted)]">{{ log.stock_before }}</td>
              <td class="px-5 py-4 text-center text-[var(--text-muted)]">{{ log.stock_after }}</td>
              <td class="px-5 py-4 text-[var(--text-muted)] text-xs max-w-[200px] truncate">
                {{ log.note || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
