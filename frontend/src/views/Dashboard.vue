<script setup>
import { onMounted, ref, computed } from 'vue'
import { api } from '../api/client.js'
import MyFilterSelect from '../components/ui/MyFilterSelect.vue'

const stats = ref(null)
const loading = ref(true)
const error = ref('')
const refreshTime = ref('')
const selectedCategory = ref('')

function updateRefreshTime() {
  const now = new Date()
  refreshTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/stats')
    stats.value = res.data.data
    updateRefreshTime()
  } catch (e) {
    error.value = '无法加载统计数据，请检查后端服务'
    console.error(e)
  } finally {
    loading.value = false
  }
}

const categoryOptions = computed(() => {
  if (!stats.value?.byCategory) return []
  return [
    { label: '全部大类', value: '' },
    ...stats.value.byCategory
      .filter(cat => cat.name)
      .map(cat => ({ label: cat.name, value: cat.name }))
  ]
})

const filteredRank = computed(() => {
  if (!stats.value?.thirtyDayOutboundRank) return []
  if (!selectedCategory.value) return stats.value.thirtyDayOutboundRank
  return stats.value.thirtyDayOutboundRank.filter(item => item.category_name === selectedCategory.value)
})

function stockUrgency(p) {
  if (p.current_stock === 0) return 'critical'
  const diff = p.min_stock - p.current_stock
  if (diff >= p.min_stock) return 'critical'
  return 'warn'
}

function urgencyLabel(p) {
  if (p.current_stock === 0) return '缺货'
  return '预警'
}

function formatCurrency(val) {
  return Number(val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(loadStats)
</script>

<template>
  <div class="h-full overflow-auto p-3 sm:p-4 lg:p-6">
    <!-- 页面标题 -->
    <div class="mb-4 md:mb-6">
      <div class="flex items-center justify-between flex-nowrap gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div>
            <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">统计面板</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">实时库存概况与业务数据</p>
          </div>
        </div>
        <div class="flex items-center gap-4 flex-shrink-0">
          <!-- 电脑端显示时间 -->
          <div v-if="refreshTime" class="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>{{ refreshTime }}</span>
          </div>
          <!-- 手机端刷新按钮（仅图标，靠右） -->
          <button
            @click="loadStats"
            class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center
                   text-indigo-500 dark:text-indigo-400
                   hover:text-indigo-600 dark:hover:text-indigo-300
                   hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15
                   active:scale-90 transition-all duration-200 cursor-pointer flex-shrink-0"
          >
            <svg class="w-5 h-5" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <!-- 电脑端刷新按钮（带文字） -->
          <button
            @click="loadStats"
            class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                   bg-white dark:bg-slate-800
                   border border-slate-200 dark:border-white/10
                   text-slate-600 dark:text-slate-400
                   hover:bg-slate-50 dark:hover:bg-white/5
                   active:scale-95 transition-all duration-200 cursor-pointer flex-shrink-0"
          >
            <svg class="w-4 h-4 shrink-0" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            刷新数据
          </button>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex justify-center items-center py-24">
      <div class="flex flex-col items-center gap-4">
        <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
        <span class="text-sm text-slate-500 dark:text-slate-400">加载中…</span>
      </div>
    </div>

    <!-- 后端连接失败 -->
    <div v-else-if="error" class="mx-auto max-w-md mt-8 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
              </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-rose-700 dark:text-rose-300">连接失败</p>
          <p class="text-xs text-rose-500 dark:text-rose-400 mt-0.5">{{ error }}</p>
        </div>
      </div>
    </div>

    <div v-else-if="stats">

      <!-- ════ 核心指标卡片 (PC: 4列 | 平板: 2列 | 手机: 2列) ════ -->
      <div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-5 mb-4 md:mb-6">

        <!-- 总产品数 -->
        <div class="rounded-xl p-3 sm:p-4 md:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <div class="flex items-start justify-between gap-2 sm:gap-3">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">总产品数</p>
              <p class="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1 sm:mt-2 leading-tight">{{ stats.totalProducts }}</p>
              <p class="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-1 sm:mt-2">件商品</p>
            </div>
            <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 总库存数量 -->
        <div class="rounded-xl p-3 sm:p-4 md:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <div class="flex items-start justify-between gap-2 sm:gap-3">
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">总库存数量</p>
              <p class="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-500 mt-1 sm:mt-2 leading-tight">{{ stats.totalStock }}</p>
              <p class="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-1 sm:mt-2">件</p>
            </div>
            <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 库存总价值 -->
        <div class="rounded-xl p-3 sm:p-4 md:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <div class="flex items-start justify-between gap-2 sm:gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">库存总价值</p>
              <p class="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white mt-1 sm:mt-2 leading-tight truncate">¥{{ formatCurrency(stats.totalValue) }}</p>
            </div>
            <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
              <span class="text-sky-500 font-bold" style="font-size: 18px; font-family: Arial, sans-serif;">¥</span>
            </div>
          </div>
        </div>

        <!-- 低库存预警 -->
        <div
          class="rounded-xl p-3 sm:p-4 md:p-5 bg-white dark:bg-slate-900 border shadow-sm overflow-hidden relative"
          :class="stats.lowStockCount > 0
            ? 'border-rose-200 dark:border-rose-500/30'
            : 'border-emerald-200 dark:border-emerald-500/30'"
        >
          <!-- 警示条纹 -->
          <div v-if="stats.lowStockCount > 0" class="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-rose-400 to-rose-600"></div>
          <div class="flex items-start justify-between gap-2 sm:gap-3 relative z-10">
            <div class="min-w-0 flex-1">
              <p class="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">低库存预警</p>
              <p class="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2 leading-tight" :class="stats.lowStockCount > 0 ? 'text-rose-500' : 'text-emerald-500'">{{ stats.lowStockCount }}</p>
              <p class="text-[10px] sm:text-xs mt-1 sm:mt-2 leading-tight" :class="stats.zeroStockCount > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'">
                其中缺货 {{ stats.zeroStockCount }} 件
              </p>
            </div>
            <div
              class="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
              :class="stats.lowStockCount > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" :class="stats.lowStockCount > 0 ? 'text-rose-500' : 'text-emerald-500'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- ════ 今日进出库 ════ -->
      <div class="grid grid-cols-2 gap-3 md:gap-4 lg:gap-5 mb-6">
        <div class="rounded-xl p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
          </div>
          <div>
            <p class="text-xs text-slate-400 dark:text-slate-500">今日入库</p>
            <p class="text-2xl font-bold text-emerald-500 mt-0.5 leading-none">+{{ stats.todayIn }}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">件</p>
          </div>
        </div>

        <div class="rounded-xl p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
          </div>
          <div>
            <p class="text-xs text-slate-400 dark:text-slate-500">今日出库</p>
            <p class="text-2xl font-bold text-rose-500 mt-0.5 leading-none">-{{ stats.todayOut }}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">件</p>
          </div>
        </div>
      </div>

      <!-- ════ 低库存预警列表 ════ -->
      <div class="mb-6">
        <!-- 区块标题 -->
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
              </svg>
          </div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">低库存预警</h3>
          <span
            v-if="stats.lowStockList && stats.lowStockList.length > 0"
            class="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
            style="background: linear-gradient(135deg, #f43f5e, #e11d48);"
          >{{ stats.lowStockList.length }} 件</span>
          <span v-else class="px-2.5 py-0.5 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            库存充足
          </span>
        </div>

        <!-- 无预警 -->
        <div
          v-if="!stats.lowStockList || stats.lowStockList.length === 0"
          class="rounded-xl p-6 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
            </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">库存状态良好</p>
              <p class="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">所有商品库存均高于最低预警线</p>
            </div>
          </div>
        </div>

        <!-- 有预警 — PC 表格 -->
        <div
          v-if="stats.lowStockList && stats.lowStockList.length > 0"
          class="rounded-xl overflow-hidden border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-slate-900 shadow-sm"
        >
          <!-- 警告顶栏 -->
          <div class="px-5 py-3 flex items-center gap-3" style="background: rgba(244,63,94,0.05); border-bottom: 1px solid rgba(244,63,94,0.1);">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
            <span class="text-xs text-rose-600 dark:text-rose-400">以下商品库存低于或等于预警阈值，请及时补货</span>
          </div>

          <!-- PC 表格 -->
          <div class="hidden lg:block">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                <th class="px-5 py-3.5 text-center font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">当前库存</th>
                  <th class="px-5 py-3.5 text-center font-medium">预警阈值</th>
                  <th class="px-5 py-3.5 text-center font-medium">缺口</th>
                  <th class="px-5 py-3.5 text-center font-medium pr-5">状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 dark:divide-white/5">
                <tr
                  v-for="p in stats.lowStockList"
                  :key="p.id"
                  class="group"
                  :class="stockUrgency(p) === 'critical' ? 'bg-rose-50/50 dark:bg-rose-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'"
                >
                  <td class="px-5 py-3.5">
                    <p class="text-sm font-medium text-slate-900 dark:text-white leading-snug">{{ p.name }}</p>
                    <p class="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{{ p.sku_code }}</p>
                  </td>
                  <td class="px-5 py-3.5 text-center">
                    <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                      {{ p.category_name }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-center">
                    <span class="text-lg font-bold" :class="p.current_stock === 0 ? 'text-rose-500' : 'text-rose-400'">{{ p.current_stock }}</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500 ml-1">{{ p.unit }}</span>
                  </td>
                  <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400">{{ p.min_stock }} {{ p.unit }}</td>
                  <td class="px-5 py-3.5 text-center">
                    <span class="text-sm font-semibold text-rose-500">
                      缺 {{ p.min_stock - p.current_stock }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-center pr-5">
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg"
                      :class="p.current_stock === 0
                        ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                        : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :class="p.current_stock === 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'"></span>
                      {{ urgencyLabel(p) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 平板/手机 卡片列表 -->
          <div class="lg:hidden divide-y divide-slate-100 dark:divide-white/5">
            <div
              v-for="p in stats.lowStockList"
              :key="p.id"
              class="p-4 sm:p-5"
              :class="stockUrgency(p) === 'critical' ? 'bg-rose-50/50 dark:bg-rose-500/5' : ''"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ p.name }}</p>
                  <p class="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{{ p.sku_code }}</p>
                  <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <span class="inline-flex px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                      {{ p.category_name }}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-xl font-bold" :class="p.current_stock === 0 ? 'text-rose-500' : 'text-rose-400'">{{ p.current_stock }}</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ p.unit }}</p>
                </div>
              </div>
              <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>预警: {{ p.min_stock }}</span>
                  <span class="text-rose-500 font-semibold">缺 {{ p.min_stock - p.current_stock }}</span>
                </div>
                <span
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg"
                  :class="p.current_stock === 0
                    ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="p.current_stock === 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'"></span>
                  {{ urgencyLabel(p) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ════ 按大类统计 ════ -->
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
              <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
            </svg>
          </div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">按大类统计</h3>
        </div>

        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <!-- PC 表格 -->
          <table class="hidden lg:table w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <th class="px-5 py-3.5 text-left font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">产品数</th>
                <th class="px-5 py-3.5 text-center font-medium">总库存</th>
                <th class="px-5 py-3.5 text-right font-medium pr-5">库存价值</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 dark:divide-white/5">
              <tr
                v-for="cat in stats.byCategory"
                :key="cat.name"
                class="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <td class="px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white">{{ cat.name }}</td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400">{{ cat.count }} 件</td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400">{{ cat.total_stock }} 件</td>
                <td class="px-5 py-3.5 text-right text-sm font-medium text-slate-700 dark:text-slate-300 pr-5">
                  ¥{{ Number(cat.total_value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </td>
              </tr>
              <tr v-if="stats.byCategory.length === 0">
                <td colspan="4" class="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">暂无数据</td>
              </tr>
            </tbody>
          </table>

          <!-- 平板/手机 卡片 -->
          <div class="lg:hidden divide-y divide-slate-100 dark:divide-white/5">
            <div
              v-for="cat in stats.byCategory"
              :key="cat.name"
              class="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p class="text-sm font-medium text-slate-900 dark:text-white">{{ cat.name }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ cat.count }} 件商品</p>
              </div>
              <div class="text-right shrink-0 ml-4">
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ cat.total_stock }} 件</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">¥{{ formatCurrency(cat.total_value) }}</p>
              </div>
            </div>
            <div v-if="stats.byCategory.length === 0" class="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">暂无数据</div>
          </div>
        </div>
      </div>

      <!-- ════ 30天出库排行榜 ════ -->
      <div class="mb-4">
        <!-- 区块标题 -->
        <div class="flex items-center justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>
              </svg>
            </div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">30天出库排行榜</h3>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">近30天出库</span>
            <MyFilterSelect
              v-if="categoryOptions.length > 0"
              v-model="selectedCategory"
              :options="categoryOptions"
              placeholder="按大类筛选"
              :style="{ width: '140px' }"
            />
          </div>
        </div>

        <!-- 有数据 -->
        <div v-if="filteredRank.length > 0" class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <!-- PC 表格 -->
          <div class="hidden lg:block">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                  <th class="px-5 py-3.5 text-center font-medium w-16">排名</th>
                  <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                  <th class="px-5 py-3.5 text-center font-medium">大类</th>
                  <th class="px-5 py-3.5 text-right font-medium pr-5">出库数量</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50 dark:divide-white/5">
                <tr
                  v-for="(item, index) in filteredRank"
                  :key="item.product_id"
                  class="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                >
                  <td class="px-5 py-3.5 text-center">
                    <span
                      v-if="index < 3"
                      class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                      :class="{
                        'bg-indigo-500 text-white': index === 0,
                        'bg-violet-400 text-white': index === 1,
                        'bg-rose-400 text-white': index === 2,
                      }"
                    >{{ index + 1 }}</span>
                    <span
                      v-else
                      class="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                    >{{ index + 1 }}</span>
                  </td>
                  <td class="px-5 py-3.5">
                    <span class="text-sm font-medium text-slate-900 dark:text-white">{{ item.product_name }}</span>
                  </td>
                  <td class="px-5 py-3.5 text-center">
                    <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                      {{ item.category_name || '-' }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-right pr-5">
                    <span class="text-base font-semibold tabular-nums" :class="{
                      'text-indigo-600 dark:text-indigo-400': index === 0,
                      'text-violet-500 dark:text-violet-400': index === 1,
                      'text-rose-500 dark:text-rose-400': index === 2,
                      'text-slate-700 dark:text-slate-300': index > 2
                    }">
                      {{ Number(item.total_out_quantity).toLocaleString() }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 平板/手机 卡片列表 -->
          <div class="lg:hidden divide-y divide-slate-100 dark:divide-white/5">
            <div
              v-for="(item, index) in filteredRank"
              :key="item.product_id"
              class="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <span
                  v-if="index < 3"
                  class="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                  :class="{
                    'bg-indigo-500 text-white': index === 0,
                    'bg-violet-400 text-white': index === 1,
                    'bg-rose-400 text-white': index === 2,
                  }"
                >{{ index + 1 }}</span>
                <span
                  v-else
                  class="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                >{{ index + 1 }}</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-slate-900 dark:text-white truncate">{{ item.product_name }}</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ item.category_name || '-' }}</p>
                </div>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="text-base font-semibold tabular-nums" :class="{
                  'text-indigo-600 dark:text-indigo-400': index === 0,
                  'text-violet-500 dark:text-violet-400': index === 1,
                  'text-rose-500 dark:text-rose-400': index === 2,
                  'text-slate-700 dark:text-slate-300': index > 2
                }">
                  {{ Number(item.total_out_quantity).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 无数据 -->
        <div v-else class="rounded-xl p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-slate-600 dark:text-slate-300">
                {{ selectedCategory ? '该大类暂无出库记录' : '暂无出库数据' }}
              </p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {{ selectedCategory ? `近30天内"${selectedCategory}"没有出库记录` : '近30天内没有出库记录' }}
              </p>
            </div>
            <button
              v-if="selectedCategory"
              @click="selectedCategory = ''"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              清除筛选
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 所有动画均使用全局变量，保持与 App 一致 */
</style>
