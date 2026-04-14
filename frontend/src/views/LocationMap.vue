<script setup>
import { ref, computed, reactive, onMounted, inject } from 'vue'
import { getShelfConfig, saveShelfConfig } from '../api/locations.js'
import { api } from '../api/client.js'
import MyMessage from '../components/ui/MyMessage.js'
import { MyFilterSearch } from '../components/ui/index.js'

// 主题状态
const isDark = inject('isDark', ref(true))

// ==================== 多货架配置（从 index.vue 参考）====================
const DEFAULT_SHELVES = [
  { id: 'A', rows: [
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] }
  ]},
  { id: 'B', rows: [
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] }
  ]}
]

const shelves = ref([])
const isLoadingShelves = ref(true)

// 拖动调整宽度状态
const resizing = reactive({
  active: false,
  shelf: null,
  rowIndex: null,
  colIdx: null,
  direction: 0,
  startX: 0,
  startWidths: []
})

function startResize(shelf, rowIndex, colIdx, direction, event) {
  event.preventDefault()
  if (!shelf.rows[rowIndex] || !shelf.rows[rowIndex].widths) return
  
  resizing.shelf = shelf
  resizing.rowIndex = rowIndex
  resizing.colIdx = colIdx
  resizing.direction = direction
  resizing.startX = event.clientX
  resizing.startWidths = [...shelf.rows[rowIndex].widths]
  
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
}

function doResize(event) {
  if (!resizing.shelf) return
  const row = resizing.shelf.rows[resizing.rowIndex]
  const delta = event.clientX - resizing.startX
  const deltaWidth = delta * 0.02

  const newWidths = [...resizing.startWidths]
  const targetIdx = resizing.colIdx - 1
  newWidths[targetIdx] = Math.max(0.5, Math.min(4, resizing.startWidths[targetIdx] + deltaWidth))
  
  row.widths = newWidths.map(w => Math.round(w * 2) / 2)
}

function stopResize() {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  debouncedSave()
  resizing.shelf = null
}

// 货架颜色 - 第一个用系统主色
const SHELF_COLORS = [
  'bg-gradient-to-br from-indigo-500 to-indigo-600',
  'bg-gradient-to-br from-purple-500 to-pink-600',
  'bg-gradient-to-br from-amber-500 to-orange-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-rose-500 to-red-600',
  'bg-gradient-to-br from-violet-500 to-purple-600',
]

function shelfBadgeClass(idx) {
  return SHELF_COLORS[idx % SHELF_COLORS.length]
}

function nextShelfId() {
  const used = new Set(shelves.value.map(s => s.id))
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!used.has(letter)) return letter
  }
  return `S${shelves.value.length + 1}`
}

// 从高层到低层返回行描述符
function descRowsForShelf(shelf) {
  return shelf.rows
    .map((row, i) => ({ rowNum: i + 1, cols: row.cols, rowIndex: i, widths: row.widths || [] }))
    .reverse()
}

// 计算每列实际宽度比例（返回数组）
function getColWidths(rowDesc) {
  if (!rowDesc.widths || rowDesc.widths.length === 0) {
    return Array(rowDesc.cols).fill(1)
  }
  return rowDesc.widths
}

// 生成库位编码
function cellCode(shelfId, rowNum, col) {
  return `${shelfId}-${String(rowNum).padStart(2, '0')}-${String(col).padStart(2, '0')}`
}

// ==================== 货架配置加载与保存 ====================
async function loadShelfConfig() {
  try {
    isLoadingShelves.value = true
    const res = await getShelfConfig()
    if (res.data?.code === 200 && res.data?.data?.value) {
      shelves.value = res.data.data.value
      // 兼容旧数据：自动添加 widths 字段
      shelves.value.forEach(shelf => {
        shelf.rows.forEach(row => {
          if (!row.widths) {
            row.widths = Array(row.cols).fill(1)
          }
        })
      })
    } else {
      shelves.value = JSON.parse(JSON.stringify(DEFAULT_SHELVES))
      await persistShelfConfig()
    }
  } catch (error) {
    shelves.value = JSON.parse(JSON.stringify(DEFAULT_SHELVES))
  } finally {
    isLoadingShelves.value = false
  }
}

let saveDebounceTimer = null
function debouncedSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(() => persistShelfConfig(), 500)
}

async function persistShelfConfig() {
  try {
    await saveShelfConfig(shelves.value)
    MyMessage.success('货架配置已保存')
  } catch (error) {
    MyMessage.error('保存货架配置失败')
  }
}

// ==================== 库存数据 ====================
const locationData = ref({})
const productList = ref([])
const loadingStock = ref(false)
const pageLoading = ref(true)
const lastUpdateTime = ref('')

function formatNow() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadData() {
  loadingStock.value = true
  try {
    const res = await api.get('/products', { params: { page: 1, pageSize: 9999 } })
    const list = res.data?.data?.list || res.data?.data || []
    productList.value = list

    const data = {}
    list.forEach(p => {
      if (p.location_code) {
        data[p.location_code] = {
          productId: p.id,
          productName: p.name,
          skuCode: p.sku_code,
          categoryName: p.category_name || '',
          attributes: p.attributes || '',
          stock: p.current_stock || 0,
          minStock: p.min_stock || 0,
          costPrice: p.cost_price || 0,
          unit: p.unit || '件'
        }
      }
    })
    locationData.value = data
  } catch (error) {
    MyMessage.error('加载数据失败，请检查网络连接')
  } finally {
    loadingStock.value = false
    lastUpdateTime.value = formatNow()
  }
}

const totalStock = computed(() => {
  return Object.values(locationData.value).reduce((sum, loc) => sum + (loc?.stock || 0), 0)
})

// ==================== 搜索功能 ====================
const searchKeyword = ref('')
const searchResults = ref([])
const highlightedLocation = ref('')
let searchTimer = null

function onSearch(kw) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const keyword = kw.trim().toLowerCase()
    if (!keyword) {
      clearSearch()
      return
    }

    // 从完整商品列表搜索（包含已分配和未分配库位的商品）
    const found = productList.value.filter(p =>
      p.sku_code?.toLowerCase().includes(keyword) ||
      p.name?.toLowerCase().includes(keyword)
    )

    searchResults.value = found

    // 如果找到商品，高亮第一个有库位的
    if (found.length > 0) {
      const withLocation = found.find(p => p.location_code)
      if (withLocation) {
        highlightedLocation.value = withLocation.location_code
      } else {
        highlightedLocation.value = ''
      }
    } else {
      highlightedLocation.value = ''
    }
  }, 300)
}

function clearSearch() {
  searchKeyword.value = ''
  searchResults.value = []
  highlightedLocation.value = ''
}

// ==================== 工具函数 ====================
const locationRefs = {}
function setLocationRef(code, el) { if (el) locationRefs[code] = el }
function getLocationData(code) { return locationData.value[code] || null }
function isOccupied(code) { return !!locationData.value[code] }
function hasStock(code) {
  const d = locationData.value[code]
  return !!(d && (d.stock || 0) > 0)
}

// ==================== 货格状态 ====================
// 与 Dashboard.vue 保持一致：
// - 有货：库存 > 预警线
// - 预警：0 < 库存 <= 预警线
// - 缺货：库存 = 0
// - 空：无商品
function getCellStatus(code) {
  if (highlightedLocation.value && code === highlightedLocation.value) return 'highlight'
  const data = getLocationData(code)
  if (!data) return 'empty'
  if (data.stock === 0) return 'out'
  if (data.minStock > 0 && data.stock <= data.minStock) return 'warn'
  return 'normal'
}

function getCellClass(code) {
  const status = getCellStatus(code)
  
  switch (status) {
    case 'highlight':
      return 'text-white border-indigo-400 hover:border-indigo-300 hover:scale-105'
    case 'normal':
      return 'bg-emerald-500/20 dark:bg-emerald-500/25 border-emerald-400 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/35 hover:scale-105'
    case 'warn':
      return 'bg-amber-500/20 dark:bg-amber-500/25 border-amber-400 dark:border-amber-500/50 text-amber-600 dark:text-amber-300 hover:bg-amber-500/35 hover:scale-105'
    case 'out':
      return 'bg-red-500/20 dark:bg-red-500/25 border-red-400 dark:border-red-500/50 text-red-600 dark:text-red-300 hover:bg-red-500/35 hover:scale-105'
    default:
      return 'bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-700 hover:scale-105'
  }
}

// 获取拖动条颜色（根据相邻格子状态）
function getResizeBarColor(code) {
  const status = getCellStatus(code)
  
  switch (status) {
    case 'highlight':
      return 'background: rgba(129, 140, 248, 0.8);'
    case 'normal':
      return 'background: #34d399;'
    case 'warn':
      return 'background: #fbbf24;'
    case 'out':
      return 'background: #f87171;'
    default:
      return 'background: #9ca3af;'
  }
}

// 获取货格文字颜色
function getCellTextClass(code) {
  const status = getCellStatus(code)
  switch (status) {
    case 'normal': return 'text-emerald-600 dark:text-emerald-300'
    case 'warn': return 'text-amber-600 dark:text-amber-300'
    case 'out': return 'text-red-600 dark:text-red-300'
    case 'highlight': return 'text-white'
    default: return ''
  }
}

// 获取货格高亮样式（蓝紫色渐变发光呼吸效果）
function getCellStyle(code) {
  if (getCellStatus(code) === 'highlight') {
    return {
      background: 'linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)',
      borderColor: 'transparent',
      boxShadow: '0 0 25px rgba(99, 102, 241, 0.7), 0 0 50px rgba(99, 102, 241, 0.4), inset 0 0 15px rgba(255,255,255,0.2)',
      animation: 'highlight-glow 1.2s ease-in-out infinite'
    }
  }
  return {}
}

// 获取 tooltip 中状态文字颜色类
function getStatusTextClass(code) {
  const status = getCellStatus(code)
  switch (status) {
    case 'normal': return 'text-emerald-500'
    case 'warn': return 'text-amber-500'
    case 'out': return 'text-red-500'
    default: return 'text-slate-400'
  }
}

// 获取状态标签样式
function getStatusBadgeClass(code) {
  const status = getCellStatus(code)
  switch (status) {
    case 'normal': return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    case 'warn': return 'bg-amber-500/15 text-amber-500 border-amber-500/30'
    case 'out': return 'bg-red-500/15 text-red-500 border-red-500/30'
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

// 获取状态圆点颜色
function getStatusDotClass(code) {
  const status = getCellStatus(code)
  switch (status) {
    case 'normal': return 'bg-emerald-500 shadow-[0_0_6px_var(--success)]'
    case 'warn': return 'bg-amber-500 shadow-[0_0_6px_var(--warning)]'
    case 'out': return 'bg-red-500 shadow-[0_0_6px_var(--error)]'
    default: return 'bg-slate-500'
  }
}

// 获取状态文本
function getStatusLabel(code) {
  const status = getCellStatus(code)
  switch (status) {
    case 'normal': return '正常'
    case 'warn': return '预警'
    case 'out': return '缺货'
    default: return '空位'
  }
}

// ==================== 货架操作 ====================
const warningDialog = reactive({ visible: false, message: '', conflictCodes: [] })

function showWarning(message, conflictCodes = []) {
  warningDialog.message = message
  warningDialog.conflictCodes = conflictCodes
  warningDialog.visible = true
}

function getOccupiedInRow(shelf, rowIndex) {
  const rowNum = rowIndex + 1
  const cols = shelf.rows[rowIndex].cols
  const codes = []
  for (let col = 1; col <= cols; col++) {
    const code = cellCode(shelf.id, rowNum, col)
    if (hasStock(code)) codes.push(code)
  }
  return codes
}

function getOccupiedInShelf(shelf) {
  const codes = []
  for (let i = 0; i < shelf.rows.length; i++) {
    const rowNum = i + 1
    for (let col = 1; col <= shelf.rows[i].cols; col++) {
      const code = cellCode(shelf.id, rowNum, col)
      if (hasStock(code)) codes.push(code)
    }
  }
  return codes
}

function addShelf() {
  const id = nextShelfId()
  shelves.value.push({ id, rows: [
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] },
    { cols: 5, widths: [1, 1, 1, 1, 1] }
  ]})
  debouncedSave()
}

function deleteShelf(shelf) {
  const occupied = getOccupiedInShelf(shelf)
  if (occupied.length > 0) {
    showWarning(`货架 ${shelf.id} 仍有商品库存，请先清空所有库位或调拨后再删除。`, occupied)
    return
  }
  shelves.value = shelves.value.filter(s => s.id !== shelf.id)
  debouncedSave()
}

function addRowToShelf(shelf) {
  if (shelf.rows.length >= 10) {
    MyMessage.warning('每排货架最多10层')
    return
  }
  const defaultCols = shelf.rows.length > 0 ? shelf.rows[0].cols : 5
  const defaultWidths = shelf.rows.length > 0 && shelf.rows[0].widths
    ? [...shelf.rows[0].widths]
    : Array(defaultCols).fill(1)
  shelf.rows.push({ cols: defaultCols, widths: defaultWidths })
  debouncedSave()
}

function removeTopRow(shelf) {
  if (shelf.rows.length <= 1) return
  const topRowIndex = shelf.rows.length - 1
  const occupied = getOccupiedInRow(shelf, topRowIndex)
  if (occupied.length > 0) {
    showWarning(`第 ${topRowIndex + 1} 层仍有商品库存，请先清空该层库位后再减少层数。`, occupied)
    return
  }
  shelf.rows.pop()
  debouncedSave()
}

function addColToRow(shelf, rowIndex) {
  const row = shelf.rows[rowIndex]
  if (row.cols >= 24) {
    MyMessage.warning('每层最多24列')
    return
  }
  row.cols++
  if (!row.widths) row.widths = Array(row.cols - 1).fill(1)
  row.widths.push(1)
  debouncedSave()
}

function removeColFromRow(shelf, rowIndex) {
  const row = shelf.rows[rowIndex]
  if (row.cols <= 1) return
  const rowNum = rowIndex + 1
  const lastCol = row.cols
  const code = cellCode(shelf.id, rowNum, lastCol)
  if (hasStock(code)) {
    showWarning(`库位 ${code} 仍有商品库存，请先清空后再缩减格子。`, [code])
    return
  }
  row.cols--
  if (row.widths && row.widths.length > row.cols) {
    row.widths.pop()
  }
  debouncedSave()
}

// ==================== Tooltip ====================
const tooltip = reactive({
  visible: false, locationCode: '',
  productName: '', skuCode: '', categoryName: '',
  attributes: '', stock: 0, minStock: 0,
  costPrice: 0, unit: '件',
  x: 0, y: 0
})

function handleHover(code, event) {
  const data = getLocationData(code)
  tooltip.locationCode = code
  tooltip.productName = data?.productName || ''
  tooltip.skuCode = data?.skuCode || ''
  tooltip.categoryName = data?.categoryName || ''
  tooltip.attributes = data?.attributes || ''
  tooltip.stock = data?.stock || 0
  tooltip.minStock = data?.minStock || 0
  tooltip.costPrice = data?.costPrice || 0
  tooltip.unit = data?.unit || '件'

  const rect = event.target.getBoundingClientRect()
  const TW = 220, TH = 160
  let x = rect.right + 12
  let y = rect.top + rect.height / 2 - TH / 2
  if (x + TW > window.innerWidth) x = rect.left - TW - 12
  if (y < 8) y = 8
  else if (y + TH > window.innerHeight) y = window.innerHeight - TH - 8

  tooltip.x = x; tooltip.y = y; tooltip.visible = true
}

function hideTooltip() { tooltip.visible = false }
const tooltipStyle = computed(() => ({ left: `${tooltip.x}px`, top: `${tooltip.y}px` }))

// ==================== 刷新 ====================
async function refresh() {
  await loadData()
  MyMessage.success('数据已刷新')
}

// ==================== 生命周期 ====================
onMounted(async () => {
  pageLoading.value = true
  await loadShelfConfig()
  await loadData()
  pageLoading.value = false
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden" @click="hideTooltip">

    <!-- ════ 顶部工具栏 ════ -->
    <div class="flex-shrink-0 px-4 lg:px-6 py-4 lg:py-5 pb-safe
                backdrop-blur-xl border-b"
         style="background: rgba(var(--bg-glass), 0.8); border-color: var(--border-default);">
      
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <!-- 标题 -->
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" style="color: var(--accent)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 6 6-3 6 3 6-3 3 3-6 3 6 3 3 3-6-3-6 3"/>
            </svg>
            库位地图
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">货架布局总览 · 实时库存可视化</p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 max-w-xl">
          <!-- 搜索框 -->
          <div class="flex-1 min-w-0">
            <MyFilterSearch
              v-model="searchKeyword"
              placeholder="搜索商品名称或SKU..."
              @search="onSearch"
            />
          </div>

          <!-- 刷新按钮 -->
          <button @click="refresh" :disabled="loadingStock"
                  class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
                  style="background: var(--bg-tertiary); border: 1px solid var(--border-default); color: var(--text-secondary);">
            <svg class="w-3.5 h-3.5" :class="loadingStock ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span class="hidden sm:inline">刷新</span>
          </button>

          <!-- 新增货架 -->
          <button @click="addShelf"
                  class="px-3 py-2 rounded-xl text-xs font-medium text-white transition-all flex items-center gap-1.5 shadow-lg shrink-0"
                  style="background: var(--accent);">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            <span>新增货架</span>
          </button>
        </div>
      </div>

      <!-- 搜索结果 -->
      <div v-if="searchResults.length > 0" class="mt-3 p-4 rounded-xl border"
           style="background: var(--bg-tertiary); border-color: var(--filter-border);">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium" style="color: var(--filter-text);">
            找到 {{ searchResults.length }} 个结果
          </span>
          <button @click="clearSearch" class="flex-shrink-0 transition-colors duration-200" style="color: var(--text-muted);">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="space-y-2 max-h-32 overflow-y-auto">
          <div v-for="result in searchResults" :key="result.id"
               class="flex items-center justify-between gap-4 p-2.5 rounded-lg transition-colors"
               :style="{
                 background: result.location_code === highlightedLocation ? 'var(--filter-bg)' : 'transparent',
                 border: '1px solid ' + (result.location_code === highlightedLocation ? 'var(--filter-border)' : 'transparent')
               }">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
              <!-- 商品名 -->
              <span class="font-medium text-sm truncate" style="color: var(--text-primary);">{{ result.name }}</span>
              <!-- SKU -->
              <span class="px-2 py-0.5 rounded text-xs font-mono border shrink-0" 
                    style="background: var(--filter-bg); color: var(--filter-text); border-color: var(--filter-border);">
                {{ result.sku_code }}
              </span>
              <!-- 库位 -->
              <span class="text-sm shrink-0" style="color: var(--text-secondary);">
                库位：
                <span class="font-mono font-medium" 
                      :style="{ color: result.location_code ? 'var(--accent)' : 'var(--text-muted)' }">
                  {{ result.location_code || '未分配' }}
                </span>
              </span>
            </div>
            <!-- 库存 -->
            <span class="text-sm shrink-0" style="color: var(--text-secondary);">
              库存：
              <span class="font-bold" :style="{ color: result.current_stock > 0 ? 'var(--success)' : 'var(--error)' }">
                {{ result.current_stock }}
              </span>
              {{ result.unit || '件' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="flex items-center gap-4 mt-3 flex-wrap">
        <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <svg class="w-3.5 h-3.5" style="color: var(--accent)" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4" stroke-width="2"/>
            <path stroke-width="2" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
          <span>总库存: <strong style="color: var(--success);">{{ totalStock }}</strong> 件</span>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--success);"></span>
            <span style="color: var(--text-muted);">有货</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--warning);"></span>
            <span style="color: var(--text-muted);">预警</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--error);"></span>
            <span style="color: var(--text-muted);">缺货</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm" style="background-color: var(--border-strong);"></span>
            <span style="color: var(--text-muted);">空</span>
          </span>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 ml-auto">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {{ lastUpdateTime || '获取中...' }}
        </div>
      </div>
    </div>

    <!-- ════ 内容区 - 独立滚动 ════ -->
    <div class="flex-1 overflow-auto px-3 sm:px-4 lg:px-6 py-4 lg:py-6 space-y-4 md:space-y-6">

      <!-- 加载状态 -->
      <div v-if="pageLoading" class="flex justify-center items-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500 dark:text-slate-400">加载库位数据…</span>
        </div>
      </div>

      <!-- ════ 空态 ════ -->
      <div v-if="shelves.length === 0 && !isLoadingShelves && !pageLoading"
           class="rounded-2xl p-12 text-center border-2 border-dashed"
           style="border-color: var(--border-default); background: var(--bg-secondary);">
        <svg class="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
        <p class="text-slate-500 dark:text-slate-400 text-lg font-medium">还没有货架</p>
        <p class="text-slate-400 dark:text-slate-600 text-sm mt-1">点击右上角「新增货架」开始配置</p>
      </div>

      <!-- ════ 货架列表 ════ -->
      <div v-for="(shelf, idx) in shelves" :key="shelf.id"
           v-show="!isLoadingShelves && !pageLoading"
           class="rounded-2xl p-4 md:p-5 border backdrop-blur-sm transition-all duration-300"
           style="background: var(--bg-secondary); border-color: var(--border-default);">

        <!-- 货架标题 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div :class="shelfBadgeClass(idx)"
                 class="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span class="text-white font-bold text-sm">{{ shelf.id }}</span>
            </div>
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white leading-tight">货架 {{ shelf.id }}</h2>
              <p class="text-slate-400 dark:text-slate-500 text-xs">{{ shelf.rows.length }} 层，每层独立列数</p>
            </div>
          </div>

          <!-- 操作按钮组 -->
          <div class="flex items-center gap-1.5">
            <button @click="addRowToShelf(shelf)" title="增加一层（最多10层）"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150 active:scale-90"
                    style="background: var(--success-bg); border-color: var(--success-border); color: var(--success);">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
            <button @click="removeTopRow(shelf)" :disabled="shelf.rows.length <= 1" title="减少一层"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    style="background: var(--warning-bg); border-color: var(--warning-border); color: var(--warning);">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/>
              </svg>
            </button>
            <div class="w-px h-5 mx-0.5" style="background: var(--border-default);"></div>
            <button @click="deleteShelf(shelf)" title="删除货架"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150 active:scale-90"
                    style="background: var(--error-bg); border-color: var(--error-border); color: var(--error);">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 货架网格 -->
        <div class="flex flex-col gap-1.5">
          <div v-for="rowDesc in descRowsForShelf(shelf)" :key="rowDesc.rowIndex" class="flex items-stretch gap-1">
            
            <!-- 层标签 -->
            <div class="w-9 flex-shrink-0 flex items-center justify-end text-[10px] font-medium pr-1 leading-none self-center"
                 style="color: var(--text-muted);">
              {{ rowDesc.rowNum }}层
            </div>

            <!-- 货位格子 -->
            <div
              v-for="col in rowDesc.cols"
              :key="col"
              :ref="el => setLocationRef(cellCode(shelf.id, rowDesc.rowNum, col), el)"
              @mouseenter="handleHover(cellCode(shelf.id, rowDesc.rowNum, col), $event)"
              @mouseleave="hideTooltip"
              :class="getCellClass(cellCode(shelf.id, rowDesc.rowNum, col))"
              :style="{ ...getCellStyle(cellCode(shelf.id, rowDesc.rowNum, col)), flex: getColWidths(rowDesc)[col - 1] }"
              class="relative h-12 md:h-14 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center justify-center overflow-hidden select-none border group p-0.5"
            >
              <!-- 拖动区域 - 左侧 -->
              <div v-if="col > 1"
                   class="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center"
                   @mousedown.stop="startResize(shelf, rowDesc.rowIndex, col - 1, -1, $event)">
                <div class="w-0.5 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                     :style="getResizeBarColor(cellCode(shelf.id, rowDesc.rowNum, col - 1))">
                </div>
              </div>
              <!-- 拖动区域 - 右侧 -->
              <div v-if="col < rowDesc.cols"
                   class="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 flex items-center justify-end"
                   @mousedown.stop="startResize(shelf, rowDesc.rowIndex, col, 1, $event)">
                <div class="w-0.5 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                     :style="getResizeBarColor(cellCode(shelf.id, rowDesc.rowNum, col))">
                </div>
              </div>

              <!-- 库位编码 -->
              <span class="text-[7px] md:text-[9px] font-mono font-semibold leading-tight tracking-tighter z-10">
                {{ shelf.id }}-{{ String(rowDesc.rowNum).padStart(2,'0') }}-{{ String(col).padStart(2,'0') }}
              </span>
              <span v-if="hasStock(cellCode(shelf.id, rowDesc.rowNum, col))"
                    class="text-[7px] md:text-[8px] mt-0.5 font-bold leading-tight tracking-tight z-10"
                    :class="getCellTextClass(cellCode(shelf.id, rowDesc.rowNum, col))">
                ×{{ getLocationData(cellCode(shelf.id, rowDesc.rowNum, col))?.stock }}
              </span>
              
              <!-- 悬停边框 - 颜色跟随状态 -->
              <div v-if="getCellStatus(cellCode(shelf.id, rowDesc.rowNum, col)) !== 'highlight'"
                   class="absolute inset-0 rounded-lg border-2 border-transparent group-hover:transition-all group-hover:duration-200 pointer-events-none"
                   :class="{
                     'group-hover:border-emerald-400/60 dark:group-hover:border-emerald-500/50': getCellStatus(cellCode(shelf.id, rowDesc.rowNum, col)) === 'normal',
                     'group-hover:border-amber-400/60 dark:group-hover:border-amber-500/50': getCellStatus(cellCode(shelf.id, rowDesc.rowNum, col)) === 'warn',
                     'group-hover:border-red-400/60 dark:group-hover:border-red-500/50': getCellStatus(cellCode(shelf.id, rowDesc.rowNum, col)) === 'out',
                     'group-hover:border-gray-300/60 dark:group-hover:border-slate-500/50': getCellStatus(cellCode(shelf.id, rowDesc.rowNum, col)) === 'empty'
                   }">
              </div>
            </div>

            <!-- 增加列按钮 -->
            <div @click="addColToRow(shelf, rowDesc.rowIndex)" title="增加一列（最多24列）"
                 class="w-8 flex-shrink-0 h-14 rounded-lg cursor-pointer border flex flex-col items-center justify-center transition-all duration-200 active:scale-90 select-none"
                 style="background: var(--success-bg); border-color: var(--success-border); color: var(--success);">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
              </svg>
            </div>

            <!-- 减少列按钮 -->
            <div v-if="rowDesc.cols > 1" @click="removeColFromRow(shelf, rowDesc.rowIndex)" title="减少一列"
                 class="w-8 flex-shrink-0 h-14 rounded-lg cursor-pointer border flex flex-col items-center justify-center transition-all duration-200 active:scale-90 select-none"
                 style="background: var(--error-bg); border-color: var(--error-border); color: var(--error);">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════ Tooltip ════ -->
    <Teleport to="body">
      <transition name="tooltip-fade">
        <div v-if="tooltip.visible"
             :style="tooltipStyle"
             class="fixed z-50 rounded-xl shadow-2xl pointer-events-none border p-3.5"
             style="background: var(--bg-elevated); border-color: var(--filter-border);">
          <div class="space-y-1 min-w-[200px]">
            <!-- 库位编码 + 状态 -->
            <div class="flex items-center justify-between pb-2 mb-1 border-b" style="border-color: var(--border-default);">
              <span class="px-2.5 py-1 rounded-md font-mono text-xs font-semibold border"
                    style="background: var(--filter-bg); color: var(--filter-text); border-color: var(--filter-border);">
                {{ tooltip.locationCode }}
              </span>
              <!-- 状态标签 -->
              <div class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="getStatusDotClass(tooltip.locationCode)"></span>
                <span class="text-xs font-medium" :class="getStatusTextClass(tooltip.locationCode)">
                  {{ getStatusLabel(tooltip.locationCode) }}
                </span>
              </div>
            </div>

            <div v-if="tooltip.productName">
              <!-- 大类名 - 状态颜色 -->
              <div v-if="tooltip.categoryName" 
                   class="text-sm font-semibold mt-1" 
                   :class="getStatusTextClass(tooltip.locationCode)">
                {{ tooltip.categoryName }}
              </div>

              <!-- 商品名（不显示大类） -->
              <div class="text-sm font-medium mt-0.5" style="color: var(--text-primary);">
                {{ tooltip.productName.replace(new RegExp('^' + tooltip.categoryName + '[\\s\\-_/]*', 'i'), '') || tooltip.productName }}
              </div>

              <!-- SKU编码 -->
              <div class="text-xs font-mono mt-1" style="color: var(--text-secondary);">
                {{ tooltip.skuCode }}
              </div>

              <!-- 价格 -->
              <div v-if="tooltip.costPrice" class="text-xs mt-1" style="color: var(--text-muted);">
                单价：¥{{ Number(tooltip.costPrice).toFixed(2) }}
              </div>

              <!-- 库存信息 -->
              <div class="flex items-center justify-between mt-2 pt-2 border-t" style="border-color: var(--border-default);">
                <div class="flex items-center gap-2">
                  <span class="text-xs" style="color: var(--text-muted);">库存</span>
                  <span class="font-bold text-base" :class="getStatusTextClass(tooltip.locationCode)">
                    {{ tooltip.stock }}
                  </span>
                  <span class="text-xs" style="color: var(--text-muted);">{{ tooltip.unit }}</span>
                </div>
                <span v-if="tooltip.minStock > 0" class="text-xs" style="color: var(--text-muted);">
                  预警 {{ tooltip.minStock }}
                </span>
              </div>
            </div>

            <div v-else class="text-sm mt-1 py-2" style="color: var(--text-muted);">空货位</div>
          </div>
          <div class="absolute w-3 h-3 border-l border-b pointer-events-none rotate-45 -left-1.5 top-1/2 -translate-y-1/2"
               style="background: var(--bg-elevated); border-color: var(--filter-border);"></div>
        </div>
      </transition>
    </Teleport>

    <!-- ════ 警告弹窗 ════ -->
    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="warningDialog.visible"
             class="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm"
             style="background: rgba(0,0,0,0.6);"
             @click.self="warningDialog.visible = false">
          <div class="rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border"
               style="background: var(--modal-bg); border-color: var(--error-border);">
            <div class="flex items-start gap-4 mb-4">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                   style="background: var(--error-bg);">
                <svg class="w-5 h-5" style="color: var(--error);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
              <div>
                <h3 class="font-bold text-base mb-1" style="color: var(--error);">操作失败</h3>
                <p class="text-sm leading-relaxed" style="color: var(--text-secondary);">{{ warningDialog.message }}</p>
                <div v-if="warningDialog.conflictCodes.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="code in warningDialog.conflictCodes" :key="code"
                        class="px-2 py-0.5 rounded font-mono text-xs"
                        style="background: var(--error-bg); color: var(--error); border: 1px solid var(--error-border);">
                    {{ code }}
                  </span>
                </div>
              </div>
            </div>
            <button @click="warningDialog.visible = false"
                    class="w-full py-2.5 rounded-xl font-bold transition-colors text-sm text-white"
                    style="background: var(--error);">
              我知道了
            </button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* 搜索高亮库位呼吸脉冲动画 */
@keyframes highlight-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.5), 0 0 40px rgba(99, 102, 241, 0.25);
  }
  50% {
    box-shadow: 0 0 35px rgba(129, 140, 248, 0.8), 0 0 70px rgba(99, 102, 241, 0.5);
  }
}

.tooltip-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tooltip-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; transform: translateY(6px) scale(0.95); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

::-webkit-scrollbar { height: 4px; width: 4px; }
::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.2); }
::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.4); border-radius: 2px; }
</style>
