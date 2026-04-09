<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api/client.js'

const stats = ref(null)
const loading = ref(true)
const error = ref('')

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/stats')
    stats.value = res.data.data
  } catch (e) {
    error.value = '无法加载统计数据，请检查后端服务'
    console.error(e)
  } finally {
    loading.value = false
  }
}

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
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-[var(--border-default)]">
      <div>
        <h2 class="text-base sm:text-lg font-semibold text-[var(--text-primary)]">统计面板</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">实时库存概况与业务数据</p>
      </div>
      <button
        @click="loadStats"
        class="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <span class="hidden sm:inline">刷新</span>
      </button>
    </header>

    <!-- 主内容区 -->
    <div class="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-8">

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-12 sm:py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <!-- 后端连接失败 -->
      <div v-else-if="error" class="mx-auto max-w-md px-2 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300">
        {{ error }}
      </div>

      <div v-else-if="stats">

        <!-- ==================== 核心指标卡片 ==================== -->
        <!-- PC: 4列 | 平板: 2列 | 手机: 2列 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">

          <!-- 总产品数 -->
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-[10px] sm:text-xs text-[var(--text-muted)] mb-1 sm:mb-2">总产品数</p>
                <p class="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none">{{ stats.totalProducts }}</p>
              </div>
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] text-sm sm:text-base shrink-0">
                ◈
              </div>
            </div>
          </div>

          <!-- 总库存数量 -->
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-[10px] sm:text-xs text-[var(--text-muted)] mb-1 sm:mb-2">总库存数量</p>
                <p class="text-2xl sm:text-3xl font-bold text-emerald-400 leading-none">{{ stats.totalStock }}</p>
              </div>
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm sm:text-base shrink-0">
                &#8593;
              </div>
            </div>
          </div>

          <!-- 库存总价值 -->
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-5">
            <div class="flex items-start justify-between">
              <div class="min-w-0">
                <p class="text-[10px] sm:text-xs text-[var(--text-muted)] mb-1 sm:mb-2">库存总价值</p>
                <p class="text-lg sm:text-2xl lg:text-3xl font-bold text-[var(--text-primary)] leading-none truncate">
                  ¥{{ formatCurrency(stats.totalValue) }}
                </p>
              </div>
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 text-sm sm:text-base shrink-0">
                ¥
              </div>
            </div>
          </div>

          <!-- 低库存预警 -->
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-5 relative overflow-hidden"
            :class="stats.lowStockCount > 0 ? 'border-red-900/50' : ''">
            <div class="flex items-start justify-between relative z-10">
              <div>
                <p class="text-[10px] sm:text-xs text-[var(--text-muted)] mb-1 sm:mb-2">低库存预警</p>
                <p
                  class="text-2xl sm:text-3xl font-bold leading-none"
                  :class="stats.lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'"
                >
                  {{ stats.lowStockCount }}
                </p>
                <p class="text-[10px] sm:text-xs mt-0.5 hidden sm:block" :class="stats.zeroStockCount > 0 ? 'text-red-500' : 'text-[var(--text-muted)]'">
                  其中缺货 {{ stats.zeroStockCount }} 件
                </p>
              </div>
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm sm:text-base shrink-0"
                :class="stats.lowStockCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'">
                &#9888;
              </div>
            </div>
            <!-- 警示条（PC端显示） -->
            <div
              v-if="stats.lowStockCount > 0"
              class="hidden lg:block absolute top-0 right-0 w-1.5 h-full bg-red-600/40"
            ></div>
          </div>
        </div>

        <!-- ==================== 今日进出库 ==================== -->
        <!-- PC: 横向 | 移动端: 纵向堆叠 -->
        <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xl sm:text-2xl shrink-0">
              +
            </div>
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs text-[var(--text-muted)] mb-0.5 sm:mb-1">今日入库</p>
              <p class="text-xl sm:text-2xl font-bold text-emerald-400 leading-none">+{{ stats.todayIn }}</p>
            </div>
          </div>
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xl sm:text-2xl shrink-0">
              -
            </div>
            <div class="min-w-0">
              <p class="text-[10px] sm:text-xs text-[var(--text-muted)] mb-0.5 sm:mb-1">今日出库</p>
              <p class="text-xl sm:text-2xl font-bold text-red-400 leading-none">-{{ stats.todayOut }}</p>
            </div>
          </div>
        </div>

        <!-- ==================== 低库存预警列表 ==================== -->
        <div>
          <div class="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div class="w-1.5 h-4 sm:h-5 bg-red-600 rounded-full shrink-0"></div>
            <h3 class="text-sm sm:text-base font-semibold text-red-400">低库存预警</h3>
            <span
              v-if="stats.lowStockList && stats.lowStockList.length > 0"
              class="px-2 py-0.5 bg-red-950/60 text-red-400 text-[10px] sm:text-xs font-medium rounded-full"
            >
              {{ stats.lowStockList.length }} 件商品
            </span>
            <span v-else class="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 text-[10px] sm:text-xs rounded-full">
              库存充足
            </span>
          </div>

          <!-- 无库存提示 + PC/平板/手机三段显示 -->
          <div v-if="!stats.lowStockList || stats.lowStockList.length === 0">
            <div class="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl sm:rounded-2xl">
              <div class="text-2xl sm:text-3xl text-emerald-500 shrink-0">&#10003;</div>
              <div>
                <p class="text-sm font-medium text-emerald-300">库存状态良好</p>
                <p class="text-xs text-emerald-500/70 mt-0.5 hidden sm:block">所有商品库存均高于最低预警线</p>
              </div>
            </div>
          </div>

          <!-- 有库存：PC 端表格（>= lg） -->
          <div v-if="stats.lowStockList && stats.lowStockList.length > 0" class="hidden lg:block rounded-xl border border-red-900/50 overflow-hidden">
            <!-- 警告顶栏 -->
            <div class="px-5 py-2.5 bg-red-950/30 border-b border-red-900/40 flex items-center gap-2">
              <span class="text-red-400 text-base">&#9888;</span>
              <span class="text-xs text-red-400/80">
                以下商品库存低于或等于预警阈值，请及时补货
              </span>
            </div>

            <table class="w-full text-sm">
              <thead>
                <tr class="text-[var(--text-muted)] text-xs uppercase tracking-wider bg-[var(--bg-secondary)]/60">
                  <th class="px-5 py-3 text-left font-medium">商品名称</th>
                  <th class="px-5 py-3 text-left font-medium">大类</th>
                  <th class="px-5 py-3 text-center font-medium">当前库存</th>
                  <th class="px-5 py-3 text-center font-medium">预警阈值</th>
                  <th class="px-5 py-3 text-center font-medium">缺口</th>
                  <th class="px-5 py-3 text-center font-medium pr-6">状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-red-900/20">
                <tr
                  v-for="p in stats.lowStockList"
                  :key="p.id"
                  class="hover:bg-red-950/20 transition-colors"
                  :class="stockUrgency(p) === 'critical' ? 'bg-red-950/10' : ''"
                >
                  <td class="px-5 py-3.5">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-[var(--text-primary)] font-medium text-xs leading-snug">{{ p.name }}</span>
                      <span class="font-mono text-[var(--text-muted)] text-xs">{{ p.sku_code }}</span>
                    </div>
                  </td>
                  <td class="px-5 py-3.5">
                    <span class="inline-flex px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]">
                      {{ p.category_name }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-center">
                    <span class="text-lg font-bold" :class="p.current_stock === 0 ? 'text-red-500' : 'text-red-400'">
                      {{ p.current_stock }}
                    </span>
                    <span class="text-[var(--text-muted)] text-xs ml-1">{{ p.unit }}</span>
                  </td>
                  <td class="px-5 py-3.5 text-center text-[var(--text-muted)]">{{ p.min_stock }} {{ p.unit }}</td>
                  <td class="px-5 py-3.5 text-center">
                    <span v-if="p.min_stock - p.current_stock > 0" class="text-red-400 text-sm font-medium">
                      缺 {{ p.min_stock - p.current_stock }}
                    </span>
                    <span v-else class="text-[var(--text-muted)] text-xs">—</span>
                  </td>
                  <td class="px-5 py-3.5 text-center pr-6">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
                      :class="p.current_stock === 0 ? 'bg-red-950/80 text-red-400 border border-red-700/50' : 'bg-amber-950/80 text-amber-400 border border-amber-700/50'"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :class="p.current_stock === 0 ? 'bg-red-400 animate-pulse' : 'bg-amber-400'"></span>
                      {{ urgencyLabel(p) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 有库存：平板端卡片（sm ~ lg） -->
          <div v-if="stats.lowStockList && stats.lowStockList.length > 0" class="hidden sm:block lg:hidden space-y-3">
            <div
              v-for="p in stats.lowStockList"
              :key="p.id"
              class="rounded-xl border p-4 transition-colors"
              :class="[
                stockUrgency(p) === 'critical'
                  ? 'bg-red-950/20 border-red-900/50'
                  : 'bg-[var(--bg-secondary)]/60 border-[var(--border-default)] hover:border-red-900/40'
              ]"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-[var(--text-primary)] truncate">{{ p.name }}</p>
                  <p class="text-xs text-[var(--text-muted)] font-mono mt-0.5">{{ p.sku_code }}</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="inline-flex px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]">
                      {{ p.category_name }}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-xl font-bold" :class="p.current_stock === 0 ? 'text-red-500' : 'text-red-400'">
                    {{ p.current_stock }}
                  </span>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">{{ p.unit }}</p>
                </div>
              </div>
              <div class="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-default)]/50">
                <div class="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span>预警: {{ p.min_stock }}</span>
                  <span v-if="p.min_stock - p.current_stock > 0" class="text-red-400">
                    缺 {{ p.min_stock - p.current_stock }}
                  </span>
                </div>
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
                  :class="p.current_stock === 0 ? 'bg-red-950/80 text-red-400 border border-red-700/50' : 'bg-amber-950/80 text-amber-400 border border-amber-700/50'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="p.current_stock === 0 ? 'bg-red-400 animate-pulse' : 'bg-amber-400'"></span>
                  {{ urgencyLabel(p) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 有库存：手机端紧凑卡片（< sm） -->
          <div v-if="stats.lowStockList && stats.lowStockList.length > 0" class="sm:hidden space-y-2">
            <div
              v-for="p in stats.lowStockList"
              :key="p.id"
              class="rounded-lg border p-3"
              :class="[
                stockUrgency(p) === 'critical'
                  ? 'bg-red-950/20 border-red-900/50'
                  : 'bg-[var(--bg-secondary)]/60 border-[var(--border-default)]'
              ]"
            >
              <div class="flex items-center justify-between">
                <div class="min-w-0 flex-1 mr-3">
                  <p class="text-xs font-medium text-[var(--text-primary)] truncate">{{ p.name }}</p>
                  <p class="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{{ p.sku_code }}</p>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-lg font-bold leading-none" :class="p.current_stock === 0 ? 'text-red-500' : 'text-red-400'">
                    {{ p.current_stock }}
                  </span>
                  <span class="text-[10px] text-[var(--text-muted)] ml-0.5">{{ p.unit }}</span>
                </div>
              </div>
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-default)]/50">
                <div class="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span>{{ p.category_name }}</span>
                  <span>|</span>
                  <span>预警 {{ p.min_stock }}</span>
                  <span v-if="p.min_stock - p.current_stock > 0" class="text-red-400">· 缺 {{ p.min_stock - p.current_stock }}</span>
                </div>
                <span
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded"
                  :class="p.current_stock === 0 ? 'bg-red-950/80 text-red-400' : 'bg-amber-950/80 text-amber-400'"
                >
                  {{ urgencyLabel(p) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== 按大类统计 ==================== -->
        <div>
          <h3 class="text-sm sm:text-base font-semibold text-[var(--text-secondary)] mb-3 sm:mb-4">按大类统计</h3>
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] overflow-hidden">

            <!-- PC 表格（>= lg） -->
            <table class="hidden lg:table w-full text-sm">
              <thead>
                <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase">
                  <th class="px-5 py-3.5 text-left font-medium">大类</th>
                  <th class="px-5 py-3.5 text-right font-medium">产品数</th>
                  <th class="px-5 py-3.5 text-right font-medium">总库存</th>
                  <th class="px-5 py-3.5 text-right font-medium pr-6">库存价值</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-default)]">
                <tr v-for="cat in stats.byCategory" :key="cat.name" class="hover:bg-[var(--row-hover)] transition-colors">
                  <td class="px-5 py-3.5 text-[var(--text-primary)] font-medium">{{ cat.name }}</td>
                  <td class="px-5 py-3.5 text-right text-[var(--text-muted)]">{{ cat.count }}</td>
                  <td class="px-5 py-3.5 text-right text-[var(--text-muted)]">{{ cat.total_stock }}</td>
                  <td class="px-5 py-3.5 text-right text-[var(--text-muted)] pr-6">
                    ¥{{ Number(cat.total_value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                  </td>
                </tr>
                <tr v-if="stats.byCategory.length === 0">
                  <td colspan="4" class="px-5 py-8 text-center text-[var(--text-muted)]">暂无数据</td>
                </tr>
              </tbody>
            </table>

            <!-- 平板/手机 卡片列表 -->
            <div class="lg:hidden divide-y divide-[var(--border-default)]">
              <div
                v-for="cat in stats.byCategory"
                :key="cat.name"
                class="px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between hover:bg-[var(--row-hover)] transition-colors"
              >
                <div>
                  <p class="text-sm font-medium text-[var(--text-primary)]">{{ cat.name }}</p>
                  <p class="text-xs text-[var(--text-muted)] mt-0.5">{{ cat.count }} 件商品</p>
                </div>
                <div class="text-right shrink-0 ml-4">
                  <p class="text-sm font-semibold text-[var(--text-primary)]">{{ cat.total_stock }}</p>
                  <p class="text-xs text-[var(--text-muted)]">¥{{ formatCurrency(cat.total_value) }}</p>
                </div>
              </div>
              <div v-if="stats.byCategory.length === 0" class="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                暂无数据
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== 按库位统计 ==================== -->
        <div v-if="stats.byLocation && stats.byLocation.length > 0">
          <h3 class="text-sm sm:text-base font-semibold text-[var(--text-secondary)] mb-3 sm:mb-4">按库位统计</h3>
          <div class="rounded-xl sm:rounded-2xl border border-[var(--border-default)] overflow-hidden">

            <!-- PC 表格 -->
            <table class="hidden lg:table w-full text-sm">
              <thead>
                <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase">
                  <th class="px-5 py-3.5 text-left font-medium">库位编码</th>
                  <th class="px-5 py-3.5 text-right font-medium">产品数</th>
                  <th class="px-5 py-3.5 text-right font-medium pr-6">总库存</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-default)]">
                <tr v-for="loc in stats.byLocation" :key="loc.location_code" class="hover:bg-[var(--row-hover)] transition-colors">
                  <td class="px-5 py-3.5">
                    <span class="font-mono text-xs text-[var(--text-secondary)] bg-[var(--input-bg)] px-2 py-0.5 rounded border border-[var(--border-default)]">
                      {{ loc.location_code }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-right text-[var(--text-muted)]">{{ loc.count }}</td>
                  <td class="px-5 py-3.5 text-right text-[var(--text-muted)] pr-6">{{ loc.total_stock }}</td>
                </tr>
              </tbody>
            </table>

            <!-- 平板/手机 卡片列表 -->
            <div class="lg:hidden divide-y divide-[var(--border-default)]">
              <div
                v-for="loc in stats.byLocation"
                :key="loc.location_code"
                class="px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between hover:bg-[var(--row-hover)] transition-colors"
              >
                <span class="font-mono text-xs text-[var(--text-secondary)] bg-[var(--input-bg)] px-2 py-0.5 rounded border border-[var(--border-default)]">
                  {{ loc.location_code }}
                </span>
                <div class="flex items-center gap-4 text-xs text-[var(--text-muted)] ml-4">
                  <span>{{ loc.count }} 件</span>
                  <span class="text-[var(--text-secondary)] font-medium">{{ loc.total_stock }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
