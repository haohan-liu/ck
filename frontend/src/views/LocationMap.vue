<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { MyMessage } from '../components/ui/index.js'
import { MyButton } from '../components/ui/index.js'
import { MyModal } from '../components/ui/index.js'
import { getShelfConfig, saveShelfConfig } from '../api/locations.js'
import { api } from '../api/client.js'

// ============================================================
// 主题注入
// ============================================================
const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')

// ============================================================
// 货架配置
// ============================================================
const rows = ref(4)
const cols = ref(6)

// ============================================================
// 产品映射：location_code -> product
// ============================================================
const stockMap = ref({}) // { 'S1-01-01': { name, sku_code, current_stock, ... } }
const loadingStock = ref(false)

// ============================================================
// 搜索
// ============================================================
const searchText = ref('')
const flashTarget = ref(null) // 'S1-01-01'
const flashTimer = ref(null)

// ============================================================
// 编辑模式 & 行列增减
// ============================================================
const isEditMode = ref(false)
const tempRows = ref(4)
const tempCols = ref(6)

// ============================================================
// 弹窗
// ============================================================
const showSaveModal = ref(false)

// ============================================================
// 加载状态
// ============================================================
const pageLoading = ref(true)

// ============================================================
// 工具函数
// ============================================================

/**
 * 生成货架上所有货格的 cellCode
 * 格式: S{货架号}-{行号(两位)}-{列号(两位)}
 * 示例: S1-01-01, S1-04-06
 */
function buildCellCode(shelfNo, r, c) {
  const row = String(r).padStart(2, '0')
  const col = String(c).padStart(2, '0')
  return `S${shelfNo}-${row}-${col}`
}

/**
 * 计算每个格子的像素位置（用于 Tooltip 精确定位）
 * row/col 从 1 开始
 */
function calcPosition(r, c) {
  const CELL_W = 72 // px
  const CELL_H = 52 // px
  const GAP = 4    // px
  const HEADER_W = 40 // px（行号列宽）
  const COL_HEADER_H = 36 // px（列号行高）

  return {
    x: HEADER_W + (c - 1) * (CELL_W + GAP) + CELL_W / 2,
    y: COL_HEADER_H + (r - 1) * (CELL_H + GAP) + CELL_H / 2,
  }
}

/**
 * 根据 current_stock 决定货格颜色状态
 * 返回: 'empty' | 'low' | 'normal' | 'high'
 */
function cellStatus(stock, minStock = 0) {
  if (!stock || stock === 0) return 'empty'
  if (minStock > 0 && stock <= minStock) return 'low'
  if (stock >= 20) return 'high'
  return 'normal'
}

/**
 * 防抖保存
 */
let saveTimer = null
function debounceSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistShelfConfig()
  }, 800)
}

// ============================================================
// 数据加载
// ============================================================

async function loadShelfConfig() {
  try {
    const res = await getShelfConfig()
    if (res.data && res.data.code === 200 && res.data.data && res.data.data.value) {
      const cfg = res.data.data.value
      if (cfg.rows) rows.value = cfg.rows
      if (cfg.cols) cols.value = cfg.cols
    }
  } catch (e) {
    console.error('[LocationMap] 读取货架配置失败:', e)
    MyMessage.warning('读取货架配置失败，将使用默认值')
  }
}

async function persistShelfConfig() {
  try {
    await saveShelfConfig({ rows: rows.value, cols: cols.value })
  } catch (e) {
    console.error('[LocationMap] 保存货架配置失败:', e)
    MyMessage.error('保存货架配置失败')
  }
}

async function loadStockMap() {
  loadingStock.value = true
  try {
    const res = await api.get('/products', { params: { page: 1, pageSize: 9999 } })
    const list = res.data?.data?.list || res.data?.data || []
    const map = {}
    list.forEach(p => {
      if (p.location_code) {
        map[p.location_code] = p
      }
    })
    stockMap.value = map
  } catch (e) {
    console.error('[LocationMap] 加载库存映射失败:', e)
  } finally {
    loadingStock.value = false
  }
}

onMounted(async () => {
  pageLoading.value = true
  await loadShelfConfig()
  tempRows.value = rows.value
  tempCols.value = cols.value
  await loadStockMap()
  pageLoading.value = false
})

// ============================================================
// 搜索定位
// ============================================================

async function handleSearch() {
  if (!searchText.value.trim()) {
    MyMessage.info('请输入 SKU 或货位编码进行搜索')
    return
  }
  const keyword = searchText.value.trim().toUpperCase()

  // 精确匹配 location_code
  const foundCode = Object.keys(stockMap.value).find(
    code => code.toUpperCase() === keyword
  )

  if (foundCode) {
    triggerFlash(foundCode)
    return
  }

  // 模糊匹配 SKU
  const foundProduct = Object.values(stockMap.value).find(
    p => (p.sku_code || '').toUpperCase().includes(keyword)
  )

  if (foundProduct && foundProduct.location_code) {
    triggerFlash(foundProduct.location_code)
    MyMessage.success(`已定位到 SKU: ${foundProduct.sku_code}`)
  } else {
    MyMessage.warning(`未找到匹配 " ${keyword} " 的货位或 SKU`)
  }
}

function triggerFlash(cellCode) {
  if (flashTimer.value) clearTimeout(flashTimer.value)
  flashTarget.value = cellCode
  flashTimer.value = setTimeout(() => {
    flashTarget.value = null
  }, 2000)

  // 滚动到目标元素
  nextTick(() => {
    const el = document.querySelector(`[data-cell="${cellCode}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
  })
}

// ============================================================
// 行列编辑
// ============================================================

function openEditMode() {
  tempRows.value = rows.value
  tempCols.value = cols.value
  isEditMode.value = true
}

function closeEditMode() {
  isEditMode.value = false
}

function addRow() {
  if (tempRows.value >= 10) {
    MyMessage.warning('最多支持 10 行')
    return
  }
  tempRows.value++
}

function removeRow() {
  if (tempRows.value <= 1) {
    MyMessage.warning('至少保留 1 行')
    return
  }
  // 检查最底行是否有货
  const lastRow = tempRows.value
  for (let c = 1; c <= tempCols.value; c++) {
    const code = buildCellCode(1, lastRow, c)
    if (stockMap.value[code]) {
      MyMessage.error(`第 ${lastRow} 行仍有商品 ${stockMap.value[code].sku_code}，请先清空`)
      return
    }
  }
  tempRows.value--
}

function addCol() {
  if (tempCols.value >= 12) {
    MyMessage.warning('最多支持 12 列')
    return
  }
  tempCols.value++
}

function removeCol() {
  if (tempCols.value <= 1) {
    MyMessage.warning('至少保留 1 列')
    return
  }
  // 检查最右列是否有货
  const lastCol = tempCols.value
  for (let r = 1; r <= tempRows.value; r++) {
    const code = buildCellCode(1, r, lastCol)
    if (stockMap.value[code]) {
      MyMessage.error(`第 ${lastCol} 列仍有商品 ${stockMap.value[code].sku_code}，请先清空`)
      return
    }
  }
  tempCols.value--
}

function confirmResize() {
  rows.value = tempRows.value
  cols.value = tempCols.value
  persistShelfConfig()
  isEditMode.value = false
  showSaveModal.value = false
  MyMessage.success('货架尺寸已更新')
}

// ============================================================
// 点击货格：显示商品详情（通过复制 SKU）
// ============================================================
const selectedCell = ref(null)
const tooltipVisible = ref(false)
const tooltipStyle = ref({})

function onCellClick(r, c, e) {
  const code = buildCellCode(1, r, c)
  const product = stockMap.value[code]
  if (!product) return

  selectedCell.value = { code, product, r, c }
  tooltipVisible.value = true

  const rect = e.currentTarget.getBoundingClientRect()
  const parentRect = e.currentTarget.closest('.shelf-grid')?.getBoundingClientRect() || { left: 0, top: 0 }
  tooltipStyle.value = {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.bottom + 8}px`,
    transform: 'translateX(-50%)',
    zIndex: 200,
  }
}

function closeTooltip() {
  tooltipVisible.value = false
  selectedCell.value = null
}

// 点击空白处关闭 tooltip
function onGridClick(e) {
  if (!e.target.closest('.cell-item') && !e.target.closest('.cell-tooltip')) {
    closeTooltip()
  }
}

// ============================================================
// 货格样式
// ============================================================
function getCellClass(stock, minStock) {
  const s = cellStatus(stock, minStock)
  const base = 'w-[72px] h-[52px] rounded-lg border flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-150 relative hover:scale-105 hover:z-10'
  switch (s) {
    case 'empty':
      return `${base} bg-[var(--bg-tertiary)]/60 border-[var(--border-subtle)]/50 text-[var(--text-muted)]/40`
    case 'low':
      return `${base} bg-amber-950/60 border-amber-700/60 text-[var(--text-secondary)] shadow-sm shadow-amber-900/30`
    case 'high':
      return `${base} bg-emerald-950/60 border-emerald-700/60 text-[var(--text-secondary)] shadow-sm shadow-emerald-900/30`
    default:
      return `${base} bg-[var(--bg-elevated)]/80 border-[var(--border-default)]/70 text-[var(--text-secondary)] shadow-sm`
  }
}

function getBadgeClass(stock, minStock) {
  const s = cellStatus(stock, minStock)
  switch (s) {
    case 'empty':   return 'bg-[var(--bg-tertiary)]/80 text-[var(--text-muted)]'
    case 'low':     return 'bg-amber-600/80 text-white'
    case 'high':    return 'bg-emerald-600/80 text-white'
    default:         return 'bg-sky-600/80 text-white'
  }
}

// ============================================================
// 货架生成
// ============================================================
const shelfCells = computed(() => {
  const cells = []
  for (let r = 1; r <= rows.value; r++) {
    for (let c = 1; c <= cols.value; c++) {
      const code = buildCellCode(1, r, c)
      const product = stockMap.value[code] || null
      cells.push({ r, c, code, product })
    }
  }
  return cells
})

// ============================================================
// 列数组（用于生成列头）
// ============================================================
const colNumbers = computed(() =>
  Array.from({ length: cols.value }, (_, i) => i + 1)
)
</script>

<template>
  <div class="flex flex-col h-full" @click="onGridClick">

    <!-- ================================================ -->
    <!-- 页面头部 -->
    <!-- ================================================ -->
    <header class="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <!-- 标题 -->
        <div>
          <h2 class="text-base sm:text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <svg class="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
            </svg>
            库位地图
          </h2>
          <p class="text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">
            货架布局总览 · 实时库存可视化
          </p>
        </div>

        <!-- 操作按钮组 -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 搜索栏 -->
          <div class="flex items-center gap-2">
            <div class="relative">
              <input
                v-model="searchText"
                type="text"
                placeholder="SKU / 货位编码"
                class="w-36 sm:w-44 pl-8 pr-3 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-glow)] outline-none transition-all"
                @keyup.enter="handleSearch"
              />
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <button
              @click="handleSearch"
              class="px-3 py-2 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors cursor-pointer"
            >
              定位
            </button>
          </div>

          <!-- 刷新库存 -->
          <button
            @click="loadStockMap"
            :disabled="loadingStock"
            class="flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <svg
              class="w-3.5 h-3.5"
              :class="loadingStock ? 'animate-spin' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            刷新
          </button>

          <!-- 编辑尺寸 -->
          <button
            @click="openEditMode"
            class="flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
            </svg>
            编辑尺寸
          </button>
        </div>
      </div>

      <!-- 统计摘要（仅在非编辑模式显示） -->
      <div v-if="!isEditMode" class="flex items-center gap-4 mt-3 flex-wrap">
        <span class="text-[10px] text-[var(--text-muted)]">
          货架 1 · {{ rows }} 行 × {{ cols }} 列 = {{ rows * cols }} 格
        </span>
        <div class="flex items-center gap-3 text-[10px]">
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded bg-emerald-600/70"></span>
            <span class="text-[var(--text-muted)]">充足</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded bg-sky-600/70"></span>
            <span class="text-[var(--text-muted)]">有货</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded bg-amber-600/70"></span>
            <span class="text-[var(--text-muted)]">预警</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded bg-[var(--bg-tertiary)]/80 border border-[var(--border-subtle)]/50"></span>
            <span class="text-[var(--text-muted)]">空</span>
          </span>
        </div>
      </div>
    </header>

    <!-- ================================================ -->
    <!-- 主内容区 -->
    <!-- ================================================ -->
    <div class="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">

      <!-- 加载中 -->
      <div v-if="pageLoading" class="flex justify-center items-center py-20">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载库位数据…</span>
        </div>
      </div>

      <!-- 货架可视化 -->
      <div v-else>

        <!-- 移动端横向滚动包装 -->
        <div class="inline-block min-w-full md:overflow-x-auto scroll-touch">

          <!-- 货架主体 -->
          <div
            class="relative"
            :style="{
              '--rows': rows,
              '--cols': cols,
              display: 'inline-block',
              minWidth: '100%',
            }"
          >

            <!-- 货架装饰：顶边 -->
            <div class="absolute -top-2 left-0 right-0 h-2 rounded-t-xl bg-gradient-to-b from-[var(--accent)]/30 to-transparent pointer-events-none"></div>

            <!-- 货架装饰：底边 + 支柱 -->
            <div class="absolute -bottom-2 left-0 right-0 flex justify-between px-1 pointer-events-none">
              <div class="w-2 h-4 bg-[var(--border-strong)] rounded-b-sm"></div>
              <div class="w-2 h-4 bg-[var(--border-strong)] rounded-b-sm"></div>
            </div>

            <!-- 列号表头 -->
            <div class="flex pl-10 mb-1">
              <div
                v-for="n in colNumbers"
                :key="n"
                class="w-[72px] text-center text-[10px] text-[var(--text-muted)] font-medium select-none"
              >
                {{ n }}
              </div>
            </div>

            <!-- 货架网格 -->
            <div
              class="relative shelf-grid"
              :style="{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 72px)`,
                gap: '4px',
                paddingLeft: '40px',
                paddingTop: '0',
              }"
            >
              <!-- 列号行（绝对定位在顶部） -->
              <!-- 行号列（绝对定位在左侧，由外层 pl-10 保证） -->

              <!-- 每个货格 -->
              <div
                v-for="cell in shelfCells"
                :key="cell.code"
                :data-cell="cell.code"
                class="cell-item relative group"
                :class="getCellClass(cell.product?.current_stock, cell.product?.min_stock)"
                :style="{
                  width: '72px',
                  height: '52px',
                }"
                @click.stop="onCellClick(cell.r, cell.c, $event)"
              >
                <!-- 闪烁动画 -->
                <Transition name="flash">
                  <div
                    v-if="flashTarget === cell.code"
                    class="absolute inset-0 rounded-lg border-2 border-[var(--accent)] bg-[var(--accent)]/30 z-10"
                  ></div>
                </Transition>

                <!-- 货格内容 -->
                <template v-if="cell.product">
                  <!-- 数量徽章 -->
                  <div
                    class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center shadow-md"
                    :class="getBadgeClass(cell.product.current_stock, cell.product.min_stock)"
                  >
                    {{ cell.product.current_stock }}
                  </div>

                  <!-- SKU 首字母 -->
                  <span class="text-[11px] font-semibold font-mono text-[var(--text-primary)] leading-none truncate max-w-[60px]">
                    {{ (cell.product.sku_code || '').slice(-4) || '?' }}
                  </span>

                  <!-- 货位编码 -->
                  <span class="text-[9px] text-[var(--text-muted)] mt-0.5 font-mono leading-none">
                    {{ cell.r }}-{{ cell.c }}
                  </span>
                </template>

                <template v-else>
                  <!-- 空格子：只显示货位编码 -->
                  <span class="text-[10px] font-mono text-[var(--text-muted)]/40 leading-none">
                    {{ cell.r }}-{{ cell.c }}
                  </span>
                </template>

                <!-- 悬停态提示边框 -->
                <div class="absolute inset-0 rounded-lg border border-transparent group-hover:border-[var(--accent)]/40 transition-all duration-150 pointer-events-none"></div>
              </div>
            </div>

            <!-- 行号标注（左侧绝对定位） -->
            <div
              class="absolute left-0 top-[36px] flex flex-col gap-[4px] pointer-events-none"
              :style="{ height: `${rows * 52 + (rows - 1) * 4}px` }"
            >
              <div
                v-for="r in rows"
                :key="r"
                class="w-8 flex items-center justify-center text-[10px] font-medium text-[var(--text-muted)]"
                :style="{ height: '52px' }"
              >
                {{ r }}
              </div>
            </div>

          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="Object.keys(stockMap).length === 0"
          class="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]"
        >
          <svg class="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          <p class="text-sm">暂无库存数据</p>
          <p class="text-xs mt-1 opacity-60">请在商品管理中为产品分配库位</p>
        </div>

      </div>
    </div>

    <!-- ================================================ -->
    <!-- 货格详情 Tooltip -->
    <!-- ================================================ -->
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="tooltipVisible && selectedCell"
          :style="tooltipStyle"
          class="cell-tooltip"
          @click.stop
        >
          <div class="bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-xl shadow-2xl shadow-black/50 p-4 w-64">
            <!-- 标题 -->
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold text-[var(--text-primary)]">
                {{ selectedCell.code }}
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full"
                :class="{
                  'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'high',
                  'bg-sky-950/80 text-sky-400 border border-sky-700/50': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'normal',
                  'bg-amber-950/80 text-amber-400 border border-amber-700/50': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'low',
                  'bg-red-950/80 text-red-400 border border-red-700/50': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'empty',
                }"
              >
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="{
                    'bg-emerald-400': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'high',
                    'bg-sky-400': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'normal',
                    'bg-amber-400': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'low',
                    'bg-red-400': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'empty',
                  }"
                ></span>
                {{ selectedCell.product.current_stock }} 件
              </span>
            </div>

            <!-- 商品信息 -->
            <div class="space-y-2">
              <div>
                <p class="text-[10px] text-[var(--text-muted)]">商品名称</p>
                <p class="text-sm text-[var(--text-primary)] font-medium leading-snug mt-0.5">
                  {{ selectedCell.product.name }}
                </p>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p class="text-[10px] text-[var(--text-muted)]">SKU</p>
                  <p class="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                    {{ selectedCell.product.sku_code }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] text-[var(--text-muted)]">预警线</p>
                  <p class="text-xs text-[var(--text-secondary)] mt-0.5">
                    {{ selectedCell.product.min_stock }} 件
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 小三角 -->
          <div class="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3 h-1.5 overflow-hidden pointer-events-none">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--modal-bg)] border-l border-t border-[var(--border-strong)] rotate-45"></div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ================================================ -->
    <!-- 编辑尺寸弹窗 -->
    <!-- ================================================ -->
    <MyModal
      v-model="isEditMode"
      title="编辑货架尺寸"
      width="max-w-sm"
      @confirm="confirmResize"
    >
      <div class="space-y-5">

        <!-- 行数调节 -->
        <div>
          <label class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-4 bg-[var(--accent)] rounded-full"></span>
              <span class="text-sm font-medium text-[var(--text-primary)]">货架行数</span>
            </div>
            <span class="text-sm font-semibold text-[var(--accent)]">{{ tempRows }} 行</span>
          </label>
          <div class="flex items-center gap-3">
            <button
              @click="removeRow"
              class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-700/50 transition-all cursor-pointer disabled:opacity-30"
              :disabled="tempRows <= 1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
              </svg>
            </button>
            <div class="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-[var(--accent)] to-emerald-400 rounded-full transition-all duration-300"
                :style="{ width: `${(tempRows / 10) * 100}%` }"
              ></div>
            </div>
            <button
              @click="addRow"
              class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-emerald-400 hover:border-emerald-700/50 transition-all cursor-pointer disabled:opacity-30"
              :disabled="tempRows >= 10"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          </div>
          <p class="text-[10px] text-[var(--text-muted)] mt-1.5 text-right">最多 10 行</p>
        </div>

        <!-- 列数调节 -->
        <div>
          <label class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-4 bg-sky-500 rounded-full"></span>
              <span class="text-sm font-medium text-[var(--text-primary)]">货架列数</span>
            </div>
            <span class="text-sm font-semibold text-sky-400">{{ tempCols }} 列</span>
          </label>
          <div class="flex items-center gap-3">
            <button
              @click="removeCol"
              class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-700/50 transition-all cursor-pointer disabled:opacity-30"
              :disabled="tempCols <= 1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
              </svg>
            </button>
            <div class="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-sky-500 to-sky-300 rounded-full transition-all duration-300"
                :style="{ width: `${(tempCols / 12) * 100}%` }"
              ></div>
            </div>
            <button
              @click="addCol"
              class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-emerald-400 hover:border-emerald-700/50 transition-all cursor-pointer disabled:opacity-30"
              :disabled="tempCols >= 12"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          </div>
          <p class="text-[10px] text-[var(--text-muted)] mt-1.5 text-right">最多 12 列</p>
        </div>

        <!-- 预览信息 -->
        <div class="bg-[var(--bg-tertiary)]/60 rounded-lg px-4 py-3 border border-[var(--border-subtle)]">
          <div class="flex items-center justify-between text-xs">
            <span class="text-[var(--text-muted)]">总货格数</span>
            <span class="text-[var(--text-secondary)] font-semibold">{{ tempRows * tempCols }} 格</span>
          </div>
          <div class="flex items-center justify-between text-xs mt-1.5">
            <span class="text-[var(--text-muted)]">布局</span>
            <span class="text-[var(--text-secondary)] font-medium">
              {{ tempRows }} 行 <span class="text-[var(--text-muted)] mx-1">×</span> {{ tempCols }} 列
            </span>
          </div>
        </div>

        <!-- 防呆提示 -->
        <div class="flex items-start gap-2 px-3 py-2 bg-amber-950/20 border border-amber-800/30 rounded-lg">
          <svg class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p class="text-[10px] text-amber-300/80 leading-relaxed">
            减少行列时，系统会检查目标行/列是否仍有商品库存。若有商品，系统将拒绝缩小并提示您先清空该行/列。
          </p>
        </div>
      </div>
    </MyModal>

  </div>
</template>

<style scoped>
/* ================================================ */
/* 闪烁动画（搜索定位） */
/* ================================================ */
.flash-enter-active {
  animation: flash-pulse 0.5s ease-in-out 3;
}
.flash-leave-active {
  transition: opacity 0.3s ease;
}
.flash-leave-to {
  opacity: 0;
}

@keyframes flash-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%       { opacity: 0.8; transform: scale(1.05); }
}

/* ================================================ */
/* Tooltip 过渡动画 */
/* ================================================ */
.tooltip-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px) scale(0.95);
}
.tooltip-fade-enter-to,
.tooltip-fade-leave-from {
  transform: translateX(-50%) translateY(0) scale(1);
}

/* ================================================ */
/* 移动端横向滚动指示器 */
/* ================================================ */
@media (max-width: 768px) {
  .shelf-grid {
    scroll-snap-type: x mandatory;
  }
  .cell-item {
    scroll-snap-align: center;
  }
}

/* ================================================ */
/* 暗色模式 Tooltip 样式增强 */
/* ================================================ */
:deep(.cell-tooltip) {
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.6));
}
</style>
