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
  if (type === 'in') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
  if (type === 'out') return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
  if (type === 'adjust') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
  if (type === 'add') return 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20'
  return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5'
}

function typeDotClass(type) {
  if (type === 'in') return 'bg-emerald-500'
  if (type === 'out') return 'rose-500'
  if (type === 'adjust') return 'bg-amber-500'
  if (type === 'add') return 'bg-sky-500'
  return 'bg-slate-400'
}

function safeStock(val) {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}
</script>

<template>
  <div class="h-full overflow-auto">
    <!-- 页面标题 -->
    <div class="sticky top-0 z-10 px-4 lg:px-6 py-4 lg:py-5
                 bg-slate-50/80 dark:bg-slate-950/80
                 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">库存日志</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">记录所有库存变动历史</p>
        </div>
        <button
          @click="loadLogs"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                 bg-white dark:bg-slate-800
                 border border-slate-200 dark:border-white/10
                 text-slate-600 dark:text-slate-400
                 hover:bg-slate-50 dark:hover:bg-white/5
                 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <svg class="w-4 h-4" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          刷新
        </button>
      </div>

      <!-- 筛选栏 -->
      <div class="flex items-center gap-3 mt-4 flex-wrap">
        <select
          v-model="filterType"
          @change="loadLogs"
          class="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
        >
          <option value="">全部类型</option>
          <option value="add">新增</option>
          <option value="in">入库</option>
          <option value="out">出库</option>
          <option value="adjust">调整</option>
        </select>

        <div class="flex-1 min-w-0">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              v-model="filterKeyword"
              @input="onKeywordInput"
              type="text"
              placeholder="搜索商品名称 / SKU / 运单号"
              class="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <button
          v-if="filterType || filterKeyword"
          @click="resetFilters"
          class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          重置
        </button>
      </div>
    </div>

    <!-- 日志列表内容 -->
    <div class="px-4 lg:px-6 py-4 lg:py-5">

      <!-- 错误 -->
      <div
        v-if="error"
        class="mb-4 flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20"
      >
        <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
        </div>
        <p class="text-sm text-rose-600 dark:text-rose-300 flex-1">{{ error }}</p>
        <button @click="error = ''; loadLogs()" class="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 cursor-pointer">重试</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500 dark:text-slate-400">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-20">
        <div class="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400">
            <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>
          </svg>
        </div>
        <p class="text-base font-semibold text-slate-600 dark:text-slate-300">暂无库存日志</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">入库、出库或调整操作后会产生日志</p>
      </div>

      <!-- 有数据：PC 表格 (>= lg) -->
      <div v-else-if="logs.length > 0" class="hidden lg:block">
        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <th class="px-5 py-3.5 text-left font-medium whitespace-nowrap">操作时间</th>
                <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                <th class="px-5 py-3.5 text-left font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">类型</th>
                <th class="px-5 py-3.5 text-center font-medium">数量</th>
                <th class="px-5 py-3.5 text-center font-medium">操作前</th>
                <th class="px-5 py-3.5 text-center font-medium">操作后</th>
                <th class="px-5 py-3.5 text-left font-medium">运单号</th>
                <th class="px-5 py-3.5 text-left font-medium pr-5">备注</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 dark:divide-white/5">
              <tr
                v-for="log in logs"
                :key="log.id"
                class="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
              >
                <td class="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap font-mono">
                  {{ formatTime(log.created_at) }}
                </td>
                <td class="px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white">
                  {{ log.product_name || '-' }}
                </td>
                <td class="px-5 py-3.5">
                  <span v-if="log.category_name" class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                    {{ log.category_name }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">-</span>
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg" :class="typeClass(log.type)">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="typeDotClass(log.type)"></span>
                    {{ typeLabel(log.type) }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span
                    class="text-sm font-bold tabular-nums"
                    :class="log.type === 'in' || log.type === 'add' ? 'text-emerald-500' : (log.type === 'out' ? 'text-rose-500' : 'text-amber-500')"
                  >
                    {{ log.type === 'in' || log.type === 'add' ? '+' : (log.type === 'out' ? '-' : '') }}{{ safeStock(log.quantity) }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ safeStock(log.stock_before) }}
                </td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ safeStock(log.stock_after) }}
                </td>
                <td class="px-5 py-3.5">
                  <span
                    v-if="log.tracking_number"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
                    </svg>
                    {{ log.tracking_number }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">-</span>
                </td>
                <td class="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate pr-5">
                  {{ log.note || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 有数据：平板/手机卡片列表 (< lg) -->
      <div v-if="!loading && logs.length > 0" class="lg:hidden space-y-3">
        <div
          v-for="log in logs"
          :key="log.id"
          class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm p-4 sm:p-5"
        >
          <!-- 第一行：时间 + 类型 -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-xs text-slate-400 dark:text-slate-500 font-mono">{{ formatDate(log.created_at) }}</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg" :class="typeClass(log.type)">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="typeDotClass(log.type)"></span>
              {{ typeLabel(log.type) }}
            </span>
          </div>

          <!-- 商品名称 -->
          <p class="text-sm font-semibold text-slate-900 dark:text-white leading-snug mb-2">{{ log.product_name || '-' }}</p>

          <!-- 核心数据 -->
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{{ safeStock(log.stock_before) }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span class="font-medium text-slate-700 dark:text-slate-200">{{ safeStock(log.stock_after) }}</span>
            </div>
            <span
              class="text-base font-bold tabular-nums"
              :class="log.type === 'in' || log.type === 'add' ? 'text-emerald-500' : (log.type === 'out' ? 'text-rose-500' : 'text-amber-500')"
            >
              {{ log.type === 'in' || log.type === 'add' ? '+' : (log.type === 'out' ? '-' : '') }}{{ safeStock(log.quantity) }}
            </span>
          </div>

          <!-- 附加信息 -->
          <div v-if="log.note || log.category_name || log.tracking_number" class="flex items-center gap-2 flex-wrap text-xs text-slate-400 dark:text-slate-500">
            <span v-if="log.category_name" class="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
              {{ log.category_name }}
            </span>
            <span v-if="log.tracking_number" class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-mono bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
              </svg>
              {{ log.tracking_number }}
            </span>
            <span v-if="log.note" class="truncate flex-1">{{ log.note }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
</style>
