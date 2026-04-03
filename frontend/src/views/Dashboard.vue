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

onMounted(loadStats)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex items-center justify-between px-8 py-5 border-b border-[var(--border-default)] flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-[var(--text-primary)]">统计面板</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5">实时库存概况与业务数据</p>
      </div>
      <button
        @click="loadStats"
        class="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
      >
        &#8635; 刷新
      </button>
    </header>

    <div class="flex-1 overflow-auto p-8 space-y-8">

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <!-- 后端连接失败 -->
      <div v-else-if="error" class="mx-auto max-w-md mt-8 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300">
        {{ error }}
      </div>

      <div v-else-if="stats">

        <!-- ==================== 核心指标卡片 ==================== -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- 总产品数 -->
          <div class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-5">
            <p class="text-xs text-[var(--text-muted)] mb-2">总产品数</p>
            <p class="text-3xl font-bold text-[var(--text-primary)]">{{ stats.totalProducts }}</p>
          </div>
          <!-- 总库存数量 -->
          <div class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-5">
            <p class="text-xs text-[var(--text-muted)] mb-2">总库存数量</p>
            <p class="text-3xl font-bold text-emerald-400">{{ stats.totalStock }}</p>
          </div>
          <!-- 库存总价值 -->
          <div class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-5">
            <p class="text-xs text-[var(--text-muted)] mb-2">库存总价值</p>
            <p class="text-3xl font-bold text-[var(--text-primary)]">
              ¥{{ Number(stats.totalValue || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </p>
          </div>
          <!-- 低库存预警 -->
          <div class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-5 relative overflow-hidden">
            <p class="text-xs text-[var(--text-muted)] mb-2">低库存预警</p>
            <p
              class="text-3xl font-bold"
              :class="stats.lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'"
            >
              {{ stats.lowStockCount }}
            </p>
            <p class="text-xs mt-0.5" :class="stats.zeroStockCount > 0 ? 'text-red-500' : 'text-[var(--text-muted)]'">
              其中缺货 {{ stats.zeroStockCount }} 件
            </p>
            <!-- 警示条 -->
            <div
              v-if="stats.lowStockCount > 0"
              class="absolute top-0 right-0 w-2 h-full bg-red-600/40"
            ></div>
          </div>
        </div>

        <!-- ==================== 今日进出库 ==================== -->
        <div class="grid grid-cols-2 gap-5">
          <div class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-5 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-emerald-950/60 flex items-center justify-center text-emerald-400 text-xl shrink-0">+</div>
            <div>
              <p class="text-xs text-[var(--text-muted)] mb-1">今日入库</p>
              <p class="text-2xl font-bold text-emerald-400">+{{ stats.todayIn }}</p>
            </div>
          </div>
          <div class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-5 flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-red-950/60 flex items-center justify-center text-red-400 text-xl shrink-0">-</div>
            <div>
              <p class="text-xs text-[var(--text-muted)] mb-1">今日出库</p>
              <p class="text-2xl font-bold text-red-400">-{{ stats.todayOut }}</p>
            </div>
          </div>
        </div>

        <!-- ==================== 低库存预警列表 ==================== -->
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-1.5 h-5 bg-red-600 rounded-full shrink-0"></div>
            <h3 class="text-sm font-semibold text-red-400">低库存预警</h3>
            <span
              v-if="stats.lowStockList && stats.lowStockList.length > 0"
              class="px-2 py-0.5 bg-red-950/60 text-red-400 text-xs font-medium rounded-full"
            >
              {{ stats.lowStockList.length }} 件商品需要关注
            </span>
            <span v-else class="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 text-xs rounded-full">
              当前无预警，库存充足
            </span>
          </div>

          <!-- 无预警 -->
          <div
            v-if="!stats.lowStockList || stats.lowStockList.length === 0"
            class="flex items-center gap-4 px-6 py-5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl"
          >
            <div class="text-3xl text-emerald-500 shrink-0">&#10003;</div>
            <div>
              <p class="text-sm font-medium text-emerald-300">库存状态良好</p>
              <p class="text-xs text-emerald-500/70 mt-0.5">所有商品库存均高于最低预警线</p>
            </div>
          </div>

          <!-- 预警列表 -->
          <div v-else class="rounded-xl border border-red-900/50 overflow-hidden">
            <!-- 警告顶栏 -->
            <div class="px-5 py-2.5 bg-red-950/30 border-b border-red-900/40 flex items-center gap-2">
              <span class="text-red-400 text-lg">&#9888;</span>
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
                  <!-- 商品名称 -->
                  <td class="px-5 py-3.5">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-[var(--text-primary)] font-medium text-xs leading-snug">{{ p.name }}</span>
                      <span class="font-mono text-[var(--text-muted)] text-xs">{{ p.sku_code }}</span>
                    </div>
                  </td>

                  <!-- 大类 -->
                  <td class="px-5 py-3.5">
                    <span class="inline-flex px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]">
                      {{ p.category_name }}
                    </span>
                  </td>

                  <!-- 当前库存 -->
                  <td class="px-5 py-3.5 text-center">
                    <span
                      class="text-lg font-bold"
                      :class="p.current_stock === 0 ? 'text-red-500' : 'text-red-400'"
                    >
                      {{ p.current_stock }}
                    </span>
                    <span class="text-[var(--text-muted)] text-xs ml-1">{{ p.unit }}</span>
                  </td>

                  <!-- 预警阈值 -->
                  <td class="px-5 py-3.5 text-center text-[var(--text-muted)]">
                    {{ p.min_stock }} {{ p.unit }}
                  </td>

                  <!-- 缺口 -->
                  <td class="px-5 py-3.5 text-center">
                    <span
                      v-if="p.min_stock - p.current_stock > 0"
                      class="text-red-400 text-sm font-medium"
                    >
                      缺 {{ p.min_stock - p.current_stock }}
                    </span>
                    <span v-else class="text-[var(--text-muted)] text-xs">—</span>
                  </td>

                  <!-- 状态 -->
                  <td class="px-5 py-3.5 text-center pr-6">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
                      :class="
                        p.current_stock === 0
                          ? 'bg-red-950/80 text-red-400 border border-red-700/50'
                          : 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                      "
                    >
                      <span
                        class="w-1.5 h-1.5 rounded-full"
                        :class="p.current_stock === 0 ? 'bg-red-400 animate-pulse' : 'bg-amber-400'"
                      ></span>
                      {{ urgencyLabel(p) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ==================== 按大类统计 ==================== -->
        <div>
          <h3 class="text-sm font-semibold text-[var(--text-secondary)] mb-3">按大类统计</h3>
          <div class="rounded-xl border border-[var(--border-default)] overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase">
                  <th class="px-5 py-3.5 text-left font-medium">大类</th>
                  <th class="px-5 py-3.5 text-right font-medium">产品数</th>
                  <th class="px-5 py-3.5 text-right font-medium">总库存</th>
                  <th class="px-5 py-3.5 text-right font-medium pr-6">库存价值</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-default)]">
                <tr v-for="cat in stats.byCategory" :key="cat.name" class="hover:bg-[var(--hover-bg)] transition-colors">
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
          </div>
        </div>

        <!-- ==================== 按库位统计 ==================== -->
        <div v-if="stats.byLocation && stats.byLocation.length > 0">
          <h3 class="text-sm font-semibold text-[var(--text-secondary)] mb-3">按库位统计</h3>
          <div class="rounded-xl border border-[var(--border-default)] overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase">
                  <th class="px-5 py-3.5 text-left font-medium">库位编码</th>
                  <th class="px-5 py-3.5 text-right font-medium">产品数</th>
                  <th class="px-5 py-3.5 text-right font-medium pr-6">总库存</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-default)]">
                <tr v-for="loc in stats.byLocation" :key="loc.location_code" class="hover:bg-[var(--hover-bg)] transition-colors">
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
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
