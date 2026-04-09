<script setup>
import { ref, computed, onMounted, watch, nextTick, inject } from 'vue'
import { MyMessage } from '../components/ui/index.js'
import { MyModal } from '../components/ui/index.js'
import { getShelfConfig, saveShelfConfig } from '../api/locations.js'
import { api } from '../api/client.js'

// 通过 provide/inject 获取父组件主题状态，确保切换时自动响应
const isDark = inject('isDark', ref(true))

const rows = ref(4)
const cols = ref(6)
const stockMap = ref({})
const loadingStock = ref(false)
const searchText = ref('')
const flashTarget = ref(null)
const flashTimer = ref(null)
const isEditMode = ref(false)
const tempRows = ref(4)
const tempCols = ref(6)
const showSaveModal = ref(false)
const pageLoading = ref(true)

function buildCellCode(shelfNo, r, c) {
  const row = String(r).padStart(2, '0')
  const col = String(c).padStart(2, '0')
  return `S${shelfNo}-${row}-${col}`
}

function cellStatus(stock, minStock = 0) {
  if (!stock || stock === 0) return 'empty'
  if (minStock > 0 && stock <= minStock) return 'low'
  if (stock >= 20) return 'high'
  return 'normal'
}

let saveTimer = null
function debounceSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { persistShelfConfig() }, 800)
}

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
    list.forEach(p => { if (p.location_code) map[p.location_code] = p })
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

async function handleSearch() {
  if (!searchText.value.trim()) { MyMessage.info('请输入 SKU 或货位编码进行搜索'); return }
  const keyword = searchText.value.trim().toUpperCase()
  const foundCode = Object.keys(stockMap.value).find(code => code.toUpperCase() === keyword)
  if (foundCode) { triggerFlash(foundCode); return }
  const foundProduct = Object.values(stockMap.value).find(p => (p.sku_code || '').toUpperCase().includes(keyword))
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
  flashTimer.value = setTimeout(() => { flashTarget.value = null }, 2000)
  nextTick(() => {
    const el = document.querySelector(`[data-cell="${cellCode}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  })
}

function openEditMode() { tempRows.value = rows.value; tempCols.value = cols.value; isEditMode.value = true }
function closeEditMode() { isEditMode.value = false }

function addRow() {
  if (tempRows.value >= 10) { MyMessage.warning('最多支持 10 行'); return }
  tempRows.value++
}

function removeRow() {
  if (tempRows.value <= 1) { MyMessage.warning('至少保留 1 行'); return }
  const lastRow = tempRows.value
  for (let c = 1; c <= tempCols.value; c++) {
    const code = buildCellCode(1, lastRow, c)
    if (stockMap.value[code]) { MyMessage.error(`第 ${lastRow} 行仍有商品 ${stockMap.value[code].sku_code}，请先清空`); return }
  }
  tempRows.value--
}

function addCol() {
  if (tempCols.value >= 12) { MyMessage.warning('最多支持 12 列'); return }
  tempCols.value++
}

function removeCol() {
  if (tempCols.value <= 1) { MyMessage.warning('至少保留 1 列'); return }
  const lastCol = tempCols.value
  for (let r = 1; r <= tempRows.value; r++) {
    const code = buildCellCode(1, r, lastCol)
    if (stockMap.value[code]) { MyMessage.error(`第 ${lastCol} 列仍有商品 ${stockMap.value[code].sku_code}，请先清空`); return }
  }
  tempCols.value--
}

function confirmResize() {
  rows.value = tempRows.value; cols.value = tempCols.value
  persistShelfConfig(); isEditMode.value = false; showSaveModal.value = false
  MyMessage.success('货架尺寸已更新')
}

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
  tooltipStyle.value = {
    position: 'fixed', left: `${rect.left + rect.width / 2}px`,
    top: `${rect.bottom + 8}px`, transform: 'translateX(-50%)', zIndex: 200,
  }
}

function closeTooltip() { tooltipVisible.value = false; selectedCell.value = null }
function onGridClick(e) { if (!e.target.closest('.cell-item') && !e.target.closest('.cell-tooltip')) closeTooltip() }

function getCellStyle(stock, minStock) {
  const s = cellStatus(stock, minStock)
  const base = {
    width: '72px',
    height: '52px',
    borderRadius: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.15s ease',
    position: 'relative',
  }
  switch (s) {
    case 'empty':
      return { ...base, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }
    case 'low':
      return { ...base, backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', boxShadow: '0 1px 3px var(--error-border)' }
    case 'high':
      return { ...base, backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', boxShadow: '0 1px 3px var(--success-border)' }
    default:
      return { ...base, backgroundColor: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--info)', boxShadow: '0 1px 3px var(--info-border)' }
  }
}

function getBadgeStyle(stock, minStock) {
  const s = cellStatus(stock, minStock)
  switch (s) {
    case 'empty': return { backgroundColor: 'var(--border-strong)', color: 'var(--text-secondary)' }
    case 'low': return { backgroundColor: 'var(--error)', color: '#fff' }
    case 'high': return { backgroundColor: 'var(--success)', color: '#fff' }
    default: return { backgroundColor: 'var(--info)', color: '#fff' }
  }
}

const shelfCells = computed(() => {
  const cells = []
  for (let r = 1; r <= rows.value; r++)
    for (let c = 1; c <= cols.value; c++)
      cells.push({ r, c, code: buildCellCode(1, r, c), product: stockMap.value[buildCellCode(1, r, c)] || null })
  return cells
})

const colNumbers = computed(() => Array.from({ length: cols.value }, (_, i) => i + 1))
</script>

<template>
  <div class="h-full overflow-auto" @click="onGridClick">
    <!-- ════ 页面标题栏 ════ -->
    <div class="sticky top-0 z-10 px-4 lg:px-6 py-4 lg:py-5
                 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl
                 border-b border-slate-200/60 dark:border-white/5">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500 shrink-0">
              <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="m15 6 6-3 6 3 3-3-6-3"/>
            </svg>
            库位地图
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">货架布局总览 · 实时库存可视化</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- 搜索 -->
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              v-model="searchText"
              type="text"
              placeholder="SKU / 货位编码"
              class="w-36 sm:w-44 pl-9 pr-3 py-2 rounded-xl text-sm text-slate-900 dark:text-white
                     bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10
                     placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                     focus:outline-none transition-all"
              @keyup.enter="handleSearch"
            />
          </div>
          <button @click="handleSearch" class="px-3 py-2 rounded-xl text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all cursor-pointer">
            定位
          </button>

          <!-- 刷新 -->
          <button @click="loadStockMap" :disabled="loadingStock" class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
            <svg class="w-3.5 h-3.5" :class="loadingStock ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            刷新
          </button>

          <!-- 编辑尺寸 -->
          <button @click="openEditMode" class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            编辑尺寸
          </button>
        </div>
      </div>

      <!-- 统计摘要 -->
      <div class="flex items-center gap-4 mt-3 flex-wrap">
        <span class="text-xs text-slate-400 dark:text-slate-500 font-mono">货架 1 · {{ rows }} 行 × {{ cols }} 列 = {{ rows * cols }} 格</span>
        <div class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--success);"></span>
            <span style="color: var(--text-muted);">充足</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--info);"></span>
            <span style="color: var(--text-muted);">有货</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--error);"></span>
            <span style="color: var(--text-muted);">预警</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--border-strong);"></span>
            <span style="color: var(--text-muted);">空</span>
          </span>
        </div>
      </div>
    </div>

    <!-- ════ 内容区 ════ -->
    <div class="px-4 lg:px-6 py-5 lg:py-6">

      <!-- 加载中 -->
      <div v-if="pageLoading" class="flex justify-center items-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500 dark:text-slate-400">加载库位数据…</span>
        </div>
      </div>

      <!-- 货架可视化 -->
      <div v-else>
        <div class="inline-block min-w-full md:overflow-x-auto">
          <div
            class="relative"
            :style="{ display: 'inline-block', minWidth: '100%' }"
          >
            <!-- 顶边装饰 -->
            <div class="absolute -top-2 left-0 right-0 h-2 rounded-t-xl pointer-events-none" style="background: linear-gradient(to bottom, var(--accent-glow), transparent);"></div>

            <!-- 底边支柱装饰 -->
            <div class="absolute -bottom-2 left-0 right-0 flex justify-between px-1 pointer-events-none">
              <div class="w-2 h-4 rounded-b-sm" style="background-color: var(--border-strong);"></div>
              <div class="w-2 h-4 rounded-b-sm" style="background-color: var(--border-strong);"></div>
            </div>

            <!-- 列号表头 -->
            <div class="flex pl-10 mb-1">
              <div v-for="n in colNumbers" :key="n" class="w-[72px] text-center text-xs text-slate-400 dark:text-slate-500 font-medium select-none">{{ n }}</div>
            </div>

            <!-- 货架网格 -->
            <div
              class="relative shelf-grid"
              :style="{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 72px)`, gap: '4px', paddingLeft: '40px' }"
            >
              <div
                v-for="cell in shelfCells"
                :key="cell.code"
                :data-cell="cell.code"
                class="cell-item relative group cursor-pointer"
                :style="{ ...getCellStyle(cell.product?.current_stock, cell.product?.min_stock), width: '72px', height: '52px' }"
                @click.stop="onCellClick(cell.r, cell.c, $event)"
              >
                <!-- 闪烁动画 -->
                <Transition name="flash">
                  <div v-if="flashTarget === cell.code" class="absolute inset-0 rounded-xl border-2 border-indigo-500 bg-indigo-500/20 z-10"></div>
                </Transition>

                <!-- 货格内容 -->
                <template v-if="cell.product">
                  <div
                    class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center shadow-md"
                    :style="getBadgeStyle(cell.product.current_stock, cell.product.min_stock)"
                  >
                    {{ cell.product.current_stock }}
                  </div>
                  <span class="text-[11px] font-semibold font-mono leading-none truncate max-w-[60px]" style="color: var(--text-secondary);">
                    {{ (cell.product.sku_code || '').slice(-4) || '?' }}
                  </span>
                  <span class="text-[9px] mt-0.5 font-mono leading-none" style="color: var(--text-muted);">{{ cell.r }}-{{ cell.c }}</span>
                </template>
                <template v-else>
                  <span class="text-[10px] font-mono leading-none" style="color: var(--text-muted);">{{ cell.r }}-{{ cell.c }}</span>
                </template>
                <!-- 悬停边框 -->
                <div class="absolute inset-0 rounded-xl border border-transparent group-hover:border-indigo-400/40 dark:group-hover:border-indigo-500/30 transition-all duration-150 pointer-events-none"></div>
              </div>
            </div>

            <!-- 行号标注 -->
            <div
              class="absolute left-0 top-[36px] flex flex-col gap-[4px] pointer-events-none"
              :style="{ height: `${rows * 52 + (rows - 1) * 4}px` }"
            >
              <div v-for="r in rows" :key="r" class="w-8 flex items-center justify-center text-[10px] font-medium text-slate-400 dark:text-slate-500" :style="{ height: '52px' }">
                {{ r }}
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="Object.keys(stockMap).length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-40">
            <path d="m3 6 6-3 6 3 6-3 3 3-6 3 6 3 3 3-6-3-6 3"/>
          </svg>
          <p class="text-sm">暂无库存数据</p>
          <p class="text-xs mt-1 opacity-60">请在商品管理中为产品分配库位</p>
        </div>
      </div>
    </div>

    <!-- ════ 货格详情 Tooltip ════ -->
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div v-if="tooltipVisible && selectedCell" :style="tooltipStyle" class="cell-tooltip" @click.stop>
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl shadow-black/20 p-4 w-64">
            <div class="flex items-center justify-between mb-3">
              <span class="inline-flex px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5">
                {{ selectedCell.code }}
              </span>
              <span
                class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg"
                :class="{
                  'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'high',
                  'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'normal',
                  'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'low',
                  'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'empty',
                }"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="{
                  'bg-emerald-500': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'high',
                  'bg-sky-500': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'normal',
                  'bg-rose-500': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'low',
                  'bg-slate-400': cellStatus(selectedCell.product.current_stock, selectedCell.product.min_stock) === 'empty',
                }"></span>
                {{ selectedCell.product.current_stock }} 件
              </span>
            </div>
            <div class="space-y-2">
              <div>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">商品名称</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{{ selectedCell.product.name }}</p>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p class="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">SKU</p>
                  <p class="text-xs font-mono" style="color: var(--text-secondary);">{{ selectedCell.product.sku_code }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">预警线</p>
                  <p class="text-xs" style="color: var(--text-secondary);">{{ selectedCell.product.min_stock }} 件</p>
                </div>
              </div>
            </div>
          </div>
          <div class="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3 h-1.5 overflow-hidden pointer-events-none">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-slate-900 border-l border-t border-slate-200 dark:border-white/10 rotate-45"></div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ════ 编辑尺寸弹窗 ════ -->
    <MyModal v-model="isEditMode" title="编辑货架尺寸" width="max-w-sm" @confirm="confirmResize">
      <div class="space-y-6">

        <!-- 行数 -->
        <div>
          <label class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">货架行数</span>
            </div>
            <span class="text-sm font-bold text-indigo-500">{{ tempRows }} 行</span>
          </label>
          <div class="flex items-center gap-3">
            <button @click="removeRow" :disabled="tempRows <= 1" class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-500/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
            </button>
            <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300" :style="{ width: `${(tempRows / 10) * 100}%` }"></div>
            </div>
            <button @click="addRow" :disabled="tempRows >= 10" class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-300 dark:hover:border-emerald-500/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          </div>
          <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-right">最多 10 行</p>
        </div>

        <!-- 列数 -->
        <div>
          <label class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-4 bg-sky-500 rounded-full"></span>
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">货架列数</span>
            </div>
            <span class="text-sm font-bold text-sky-500">{{ tempCols }} 列</span>
          </label>
          <div class="flex items-center gap-3">
            <button @click="removeCol" :disabled="tempCols <= 1" class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-500/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
            </button>
            <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-sky-500 to-sky-300 rounded-full transition-all duration-300" :style="{ width: `${(tempCols / 12) * 100}%` }"></div>
            </div>
            <button @click="addCol" :disabled="tempCols >= 12" class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-300 dark:hover:border-emerald-500/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          </div>
          <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-right">最多 12 列</p>
        </div>

        <!-- 预览 -->
        <div class="rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 dark:text-slate-500">总货格数</span>
            <span class="font-semibold text-slate-700 dark:text-slate-200">{{ tempRows * tempCols }} 格</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 dark:text-slate-500">布局</span>
            <span class="text-slate-600 dark:text-slate-300 font-medium">{{ tempRows }} 行 <span class="text-slate-300 dark:text-slate-600 mx-1">×</span> {{ tempCols }} 列</span>
          </div>
        </div>

        <!-- 防呆提示 -->
        <div class="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 shrink-0 mt-0.5">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
          </svg>
          <p class="text-[10px] text-amber-600 dark:text-amber-300 leading-relaxed">
            减少行列时，系统会检查目标行/列是否仍有商品库存。若有商品，系统将拒绝缩小并提示您先清空该行/列。
          </p>
        </div>
      </div>
    </MyModal>
  </div>
</template>

<style scoped>
/* 闪烁动画 */
.flash-enter-active { animation: flash-pulse 0.5s ease-in-out 3; }
.flash-leave-active { transition: opacity 0.3s ease; }
.flash-leave-to { opacity: 0; }
@keyframes flash-pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }

/* Tooltip 动画 */
.tooltip-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tooltip-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.95); }

/* 移动端滚动 */
@media (max-width: 768px) {
  .shelf-grid { scroll-snap-type: x mandatory; }
  .cell-item { scroll-snap-align: center; }
}
</style>
