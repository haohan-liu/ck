<template>
  <div class="page-container">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">商品管理</h1>
        <span class="product-count">{{ filteredProducts.length }} 件商品</span>
      </div>
      <div class="top-bar-actions">
        <!-- 大类筛选 -->
        <div class="search-group">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <select v-model="filterCategory" class="filter-select">
            <option value="">全部大类</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>

        <!-- 关键词搜索 -->
        <div class="search-group">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="keyword"
            type="text"
            class="search-input"
            placeholder="搜索 SKU / 名称 / 规格..."
          />
        </div>

        <button class="btn-add" @click="openAddModal">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          新增商品
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="th-category">大类</th>
            <th class="th-sku">SKU</th>
            <th class="th-name">商品名称</th>
            <th class="th-attrs">规格参数</th>
            <th class="th-location">库位</th>
            <th class="th-stock text-right">库存</th>
            <th class="th-price text-right">单价</th>
            <th class="th-total text-right">库存总额</th>
            <th class="th-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(product, idx) in filteredProducts" :key="product.id">
            <tr class="data-row" :class="{ 'low-stock': isLowStock(product) }">
              <td class="td-category">
                <span class="category-name" :class="{ 'category-muted': isMutedCategory(idx) }">
                  {{ product.category_name }}
                </span>
              </td>
              <td class="td-sku">
                <span class="sku-tag">{{ product.sku_code }}</span>
              </td>
              <td class="td-name">{{ product.name }}</td>
              <td class="td-attrs">
                <div class="attrs-list">
                  <template v-if="getAttrList(product).length > 0">
                    <span
                      v-for="attr in getAttrList(product)"
                      :key="attr.key"
                      class="attr-tag"
                    >
                      {{ attr.text }}
                    </span>
                  </template>
                  <span v-else class="text-gray-400 text-sm">—</span>
                </div>
              </td>
              <td class="td-location">
                <span class="location-code">{{ product.location_code || '—' }}</span>
              </td>
              <td class="td-stock text-right">
                <span
                  class="stock-badge"
                  :class="{
                    'stock-ok': product.current_stock > product.min_stock,
                    'stock-warn': product.current_stock > 0 && product.current_stock <= product.min_stock,
                    'stock-zero': product.current_stock === 0
                  }"
                >
                  {{ product.current_stock }} {{ product.unit }}
                </span>
              </td>
              <td class="td-price text-right">
                <span class="price-value">{{ formatPrice(product.cost_price) }}</span>
              </td>
              <td class="td-total text-right">
                <span class="total-value">{{ formatPrice(product.current_stock * product.cost_price) }}</span>
              </td>
              <td class="td-actions">
                <div class="action-group">
                  <button class="action-btn stock-in" title="入库" @click="openStockModal(product, 'in')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                  <button class="action-btn stock-out" title="出库" @click="openStockModal(product, 'out')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8V4m0 0L13 8m4 4l4-4m-9 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                  <button class="action-btn print" title="打印标签" @click="printLabel(product)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>
                  <button class="action-btn edit" title="编辑" @click="openEditModal(product)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button class="action-btn delete" title="删除" @click="handleDelete(product)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>

          <!-- 统计行 -->
          <tr v-if="filteredProducts.length > 0" class="summary-row">
            <td colspan="5" class="td-summary-label">合计</td>
            <td class="td-summary text-right">
              <span class="summary-stock">{{ summaryTotalStock }} 件</span>
            </td>
            <td class="td-summary text-right">—</td>
            <td class="td-summary text-right">
              <span class="summary-total">{{ formatPrice(summaryTotalValue) }}</span>
            </td>
            <td></td>
          </tr>

          <!-- 空状态 -->
          <tr v-if="filteredProducts.length === 0">
            <td colspan="9" class="empty-cell">
              <div class="empty-state">
                <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p class="text-gray-500 text-base font-medium">{{ keyword || filterCategory ? '未找到匹配商品' : '暂无商品数据' }}</p>
                <p class="text-gray-400 text-sm mt-1">{{ keyword || filterCategory ? '尝试调整筛选条件' : '点击右上角「新增商品」开始添加' }}</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="page--">上一页</button>
      <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="page++">下一页</button>
    </div>

    <!-- 商品编辑弹窗 -->
    <ProductModal
      :visible="modalVisible"
      :edit-data="editProduct"
      @close="closeModal"
      @success="onModalSuccess"
    />

    <!-- 库存操作弹窗 -->
    <StockModal
      :visible="stockModalVisible"
      :type="stockType"
      :product="stockProduct"
      @close="closeStockModal"
      @success="onStockSuccess"
    />

    <!-- 打印预览弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="printModalVisible" class="modal-overlay" @click.self="printModalVisible = false">
          <div class="print-preview-modal">
            <div class="modal-header">
              <h3 class="modal-title">标签预览与导出</h3>
              <div class="header-actions">
                <button class="btn btn-secondary" @click="printModalVisible = false">关闭</button>
                <button class="btn btn-primary" :disabled="isPrinting" @click="doPrint">
                  <svg v-if="!isPrinting" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <svg v-else class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {{ isPrinting ? '生成中...' : '立即打印' }}
                </button>
              </div>
            </div>
            <div class="modal-body">
              <div class="size-selector">
                <label :class="{ active: printSize === '40x30' }">
                  <input type="radio" v-model="printSize" value="40x30" />
                  40mm x 30mm
                </label>
                <label :class="{ active: printSize === '70x20' }">
                  <input type="radio" v-model="printSize" value="70x20" />
                  70mm x 20mm
                </label>
              </div>
              <div class="label-preview" :class="printSize" v-html="labelHtml"></div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { productApi, categoryApi } from '@/api/index.js'
import ProductModal from '@/components/ProductModal.vue'
import StockModal from '@/components/StockModal.vue'

const PAGE_SIZE = 50

const products = ref([])
const categories = ref([])
const filterCategory = ref('')
const keyword = ref('')
const page = ref(1)
const modalVisible = ref(false)
const editProduct = ref(null)

// 库存操作相关
const stockModalVisible = ref(false)
const stockType = ref('in')
const stockProduct = ref(null)

// 打印相关
const printModalVisible = ref(false)
const printSize = ref('40x30')
const printProduct = ref(null)
const printQty = ref(1)
const isPrinting = ref(false)

// 加载数据
async function loadData() {
  try {
    const [prodRes, catRes] = await Promise.all([
      productApi.list(),
      categoryApi.list()
    ])
    products.value = prodRes.data || []
    categories.value = catRes.data || []
  } catch (err) {
    alert('加载数据失败: ' + err.message)
  }
}

onMounted(async () => {
  loadData()
  // 检查是否需要重置损坏的数据
  const needsReset = products.value.some(p => {
    try {
      const attrs = p.attributes;
      if (typeof attrs === 'object') {
        const keys = Object.keys(attrs);
        return keys.length > 0 && keys.every(k => /^\d+$/.test(k));
      }
      return false;
    } catch { return true; }
  });
  
  if (needsReset) {
    if (confirm('检测到损坏的商品数据，是否自动修复？')) {
      await productApi.resetAll()
      await loadData()
    }
  }
})

// 过滤后的商品
const filteredProducts = computed(() => {
  let list = [...products.value]

  if (filterCategory.value) {
    list = list.filter(p => String(p.category_id) === String(filterCategory.value))
  }

  if (keyword.value.trim()) {
    const kw = keyword.value.toLowerCase()
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(kw) ||
      (p.sku_code || '').toLowerCase().includes(kw) ||
      (p.category_name || '').toLowerCase().includes(kw) ||
      JSON.stringify(p.attributes || {}).toLowerCase().includes(kw)
    )
  }

  const start = (page.value - 1) * PAGE_SIZE
  return list.slice(start, start + PAGE_SIZE)
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredProducts.value.length / PAGE_SIZE))
)

// 统计
const summaryTotalStock = computed(() =>
  filteredProducts.value.reduce((sum, p) => sum + (p.current_stock || 0), 0)
)

const summaryTotalValue = computed(() =>
  filteredProducts.value.reduce((sum, p) => sum + (p.current_stock || 0) * (p.cost_price || 0), 0)
)

function formatPrice(val) {
  if (!val && val !== 0) return '—'
  return '¥' + Number(val).toFixed(2)
}

// 检查是否有非空规格属性
function hasAttributes(product) {
  if (!product.attributes || typeof product.attributes !== 'object') return false
  return Object.values(product.attributes).some(v => v && String(v).trim())
}

// 获取规格属性列表，返回格式化的标签数组
function getAttrList(product) {
  if (!product.attributes || typeof product.attributes !== 'object') return []
  return Object.entries(product.attributes)
    .filter(([_, val]) => val && String(val).trim())
    .map(([key, val]) => ({ key, text: `${key}: ${val}` }))
}

function isMutedCategory(idx) {
  if (idx === 0) return false
  const curr = filteredProducts.value[idx]
  const prev = filteredProducts.value[idx - 1]
  return curr && prev && String(curr.category_id) === String(prev.category_id)
}

function isLowStock(product) {
  return product.current_stock <= product.min_stock && product.current_stock > 0
}

// -------- 商品编辑操作 --------
function openAddModal() {
  editProduct.value = null
  modalVisible.value = true
}

function openEditModal(product) {
  editProduct.value = { ...product }
  modalVisible.value = true
}

async function handleDelete(product) {
  if (!confirm(`确认删除商品「${product.name}」吗？`)) return
  try {
    await productApi.delete(product.id)
    await loadData()
  } catch (err) {
    alert('删除失败: ' + err.message)
  }
}

function closeModal() {
  modalVisible.value = false
  editProduct.value = null
}

async function onModalSuccess() {
  await loadData()
}

// -------- 库存操作 --------
function openStockModal(product, type) {
  stockProduct.value = product
  stockType.value = type
  stockModalVisible.value = true
}

function closeStockModal() {
  stockModalVisible.value = false
  stockProduct.value = null
}

async function onStockSuccess() {
  await loadData()
}

// -------- 打印标签 --------
function printLabel(product) {
  printProduct.value = product
  printSize.value = '40x30'
  printModalVisible.value = true
}

// 格式化规格属性：用中圆点拼接
function formatAttrsForPrint(product) {
  if (!product.attributes || typeof product.attributes !== 'object') return ''
  const values = Object.values(product.attributes)
    .filter(v => v && String(v).trim())
  return values.join(' · ')
}

// 预览用 HTML
const labelHtml = computed(() => {
  if (!printProduct.value) return ''
  const p = printProduct.value
  const size = printSize.value
  const attrs = formatAttrsForPrint(p)
  const loc = p.location_code || ''

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(p.sku_code)}`
  const qrImg = `<img class="qr-code" src="${qrUrl}" alt="QR" />`

  if (size === '40x30') {
    return `
      <div class="label-40x30">
        <div class="label-left">${qrImg}</div>
        <div class="label-right">
          <div class="label-name">${p.name}</div>
          ${attrs ? `<div class="label-attrs">${attrs}</div>` : ''}
          <div class="label-location">${loc}</div>
        </div>
      </div>
    `
  } else {
    return `
      <div class="label-70x20">
        <div class="label-top">
          ${qrImg}
          <div class="label-info">
            <div class="label-name">${p.name}</div>
            ${attrs ? `<div class="label-attrs">${attrs}</div>` : ''}
          </div>
        </div>
        ${loc ? `<div class="label-location">${loc}</div>` : ''}
      </div>
    `
  }
})


// 生成 PDF（高质量打印）
async function doPrint() {
  if (!printProduct.value) return
  isPrinting.value = true

  try {
    const { jsPDF } = await import('jspdf')
    const p = printProduct.value
    const size = printSize.value
    const qty = printQty.value
    const is40x30 = size === '40x30'

    // 标签尺寸（mm）- 标签是横向的：宽40mm，高30mm
    let labelW, labelH, qrSize, padding
    if (is40x30) {
      labelW = 40
      labelH = 30
      qrSize = 14
      padding = 2
    } else {
      labelW = 70
      labelH = 20
      qrSize = 14
      padding = 1.5
    }

    // 像素到mm的转换比例
    const pxToMm = 3.78
    const canvasW = labelW * pxToMm
    const canvasH = labelH * pxToMm
    const qrPx = qrSize * pxToMm

    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)

    const textX = padding * pxToMm + qrPx + padding * pxToMm
    const textW = canvasW - textX - padding * pxToMm
    const textCenterY = canvasH / 2

    // 加载二维码
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${Math.round(qrPx * 2)}x${Math.round(qrPx * 2)}&data=${encodeURIComponent(p.sku_code)}&margin=0`
    try {
      const qrImg = await loadImage(qrUrl)
      if (is40x30) {
        ctx.drawImage(qrImg, padding * pxToMm, padding * pxToMm, qrPx, qrPx)
      } else {
        ctx.drawImage(qrImg, padding * pxToMm, (canvasH - qrPx) / 2, qrPx, qrPx)
      }
    } catch (e) { console.warn('QR load failed:', e) }

    const nameFontSize = is40x30 ? 11 : 10
    ctx.font = `bold ${nameFontSize}px Arial, sans-serif`
    ctx.fillStyle = '#1a1a2e'
    ctx.textAlign = 'left'

    const name = p.name || ''
    const attrText = formatAttrsForPrint(p)
    const loc = p.location_code || ''

    let curY = textCenterY - (attrText ? nameFontSize * 1.5 : nameFontSize)

    const wrappedName = wrapText(ctx, name, textW)
    wrappedName.forEach((line, i) => {
      ctx.fillText(line, textX, curY + i * (nameFontSize * 1.2))
    })
    curY += wrappedName.length * nameFontSize * 1.2 + 2

    if (attrText) {
      const attrFontSize = 8
      ctx.font = `${attrFontSize}px Arial, sans-serif`
      ctx.fillStyle = '#555555'
      const wrappedAttrs = wrapText(ctx, attrText, textW)
      wrappedAttrs.forEach((line, i) => {
        ctx.fillText(line, textX, curY + i * (attrFontSize * 1.3))
      })
      curY += wrappedAttrs.length * attrFontSize * 1.3 + 3
    }

    if (loc) {
      const locFontSize = 9
      ctx.font = `bold ${locFontSize}px Arial, sans-serif`
      const locText = ` ${loc} `
      const locMetrics = ctx.measureText(locText)
      const locPad = locFontSize * 0.4
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(textX, curY - locFontSize * 0.9, locMetrics.width + locPad, locFontSize * 1.6)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(locText, textX + locPad / 2, curY)
    }

    const imgData = canvas.toDataURL('image/png')
    
    // 创建PDF，标签尺寸正确
    // 40x30mm标签：宽40mm，高30mm（横向打印）
    // 70x20mm标签：宽70mm，高20mm（横向打印）
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [labelW, labelH]
    })

    for (let i = 0; i < qty; i++) {
      if (i > 0) pdf.addPage([labelW, labelH], 'landscape')
      pdf.addImage(imgData, 'PNG', 0, 0, labelW, labelH)
    }

    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } finally {
    isPrinting.value = false
  }
}

// 文字换行
function wrapText(ctx, text, maxWidth) {
  const lines = []
  let cur = ''
  for (const ch of text) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur)
      cur = ch
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// 加载图片
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

/* ---- 顶部操作栏 ---- */
.top-bar {
  background: white;
  padding: 1.25rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
}

.top-bar-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.product-count {
  font-size: 0.8125rem;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
  pointer-events: none;
}

.filter-select,
.search-input {
  height: 2.5rem;
  padding: 0 0.875rem 0 2.5rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #374151;
  background: white;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.filter-select:focus,
.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-add {
  height: 2.5rem;
  padding: 0 1.125rem;
  background: #1a1a2e;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-add:hover {
  background: #2d2d44;
}

/* ---- 数据表格 ---- */
.table-wrapper {
  flex: 1;
  padding: 1.5rem 2rem;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.data-table thead tr {
  background: #fafafa;
}

.data-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
}

.data-table th.text-right,
.data-table td.text-right {
  text-align: right;
}

.data-table td {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #f9fafb;
  vertical-align: middle;
}

.data-row:last-child td {
  border-bottom: none;
}

.data-row:hover {
  background: #fafbfc;
}

/* 统计行 */
.summary-row {
  background: #f8fafc !important;
}

.summary-row td {
  border-top: 2px solid #e2e8f0;
  padding: 0.875rem 1rem;
}

.td-summary-label {
  font-weight: 700;
  color: #1e293b;
}

.td-summary {
  font-weight: 600;
}

.summary-stock {
  color: #1e293b;
}

.summary-total {
  color: #059669;
  font-size: 1rem;
}

/* 大类列 */
.category-name {
  font-weight: 600;
  color: #1a1a2e;
  font-size: 0.875rem;
  transition: opacity 0.2s;
}

.category-name.category-muted {
  color: #d1d5db;
  font-weight: 400;
}

/* SKU */
.sku-tag {
  display: inline-block;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8125rem;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

/* 规格参数 - 美化胶囊标签 */
.attrs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.attr-tag {
  display: inline-flex;
  font-size: 0.75rem;
  color: #4b5563;
  background: #f3f4f6;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid #e5e7eb;
  transition: all 0.15s;
}

.attr-tag:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

/* 库位 */
.location-code {
  font-family: monospace;
  font-size: 0.8125rem;
  color: #9ca3af;
}

/* 库存状态 */
.stock-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.8125rem;
}

.stock-ok {
  background: #f0fdf4;
  color: #15803d;
}

.stock-warn {
  background: #fffbeb;
  color: #d97706;
}

.stock-zero {
  background: #fef2f2;
  color: #dc2626;
}

/* 单价和总额 */
.price-value {
  font-weight: 500;
  color: #374151;
}

.total-value {
  font-weight: 600;
  color: #059669;
}

.data-row.low-stock td {
  background: #fffbeb08;
}

/* 操作按钮 */
.action-group {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  width: 1.875rem;
  height: 1.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn.stock-in {
  color: #16a34a;
  background: #f0fdf4;
}

.action-btn.stock-in:hover {
  background: #dcfce7;
}

.action-btn.stock-out {
  color: #dc2626;
  background: #fef2f2;
}

.action-btn.stock-out:hover {
  background: #fee2e2;
}

.action-btn.print {
  color: #6b7280;
  background: #f3f4f6;
}

.action-btn.print:hover {
  background: #e5e7eb;
  color: #374151;
}

.action-btn.edit {
  color: #6b7280;
  background: #f3f4f6;
}

.action-btn.edit:hover {
  background: #dbeafe;
  color: #2563eb;
}

.action-btn.delete {
  color: #6b7280;
  background: #f3f4f6;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* 空状态 */
.empty-cell {
  padding: 4rem 1rem !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 分页 */
.pagination {
  padding: 1rem 2rem 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.page-btn {
  height: 2rem;
  padding: 0 0.875rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #374151;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: #6b7280;
}

/* 打印预览弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.print-preview-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.print-preview-modal .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.print-preview-modal .modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.print-preview-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* 打印选项 */
.print-options {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.size-selector {
  display: flex;
  gap: 1rem;
}

.size-selector label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.25rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.size-selector label:hover {
  border-color: #93c5fd;
}

.size-selector label.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.size-selector input {
  display: none;
}

.size-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1a1a2e;
}

.size-desc {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* 份数选择 */
.quantity-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.qty-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6b7280;
}

.qty-input-group {
  display: flex;
  align-items: center;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.qty-input-group .qty-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border: none;
  font-size: 1.25rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.qty-input-group .qty-btn:hover {
  background: #f3f4f6;
  color: #1a1a2e;
}

.qty-input {
  width: 3rem;
  height: 2.5rem;
  text-align: center;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
  outline: none;
}

.qty-input::-webkit-inner-spin-button,
.qty-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 预览区域 */
.preview-section {
  margin-bottom: 1.5rem;
}

.preview-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.label-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  border: 2px dashed #e5e7eb;
}

/* 打印提示 */
.print-tips {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #9ca3af;
}

.tip svg {
  flex-shrink: 0;
}

.label-preview :deep(.label-40x30) {
  width: 160px;
  height: 120px;
  display: flex;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: white;
}

.label-preview :deep(.label-40x30 .label-left) {
  width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.label-preview :deep(.label-40x30 .qr-code) {
  width: 50px;
  height: 50px;
}

.label-preview :deep(.label-40x30 .label-right) {
  width: 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 4px;
}

.label-preview :deep(.label-40x30 .label-name) {
  font-size: 11px;
  font-weight: bold;
  word-break: break-all;
  line-height: 1.3;
}

.label-preview :deep(.label-40x30 .label-attrs) {
  font-size: 10px;
  color: #6b7280;
  margin-top: 3px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.label-preview :deep(.label-40x30 .label-location) {
  font-size: 11px;
  font-weight: bold;
  color: white;
  background: #1a1a2e;
  padding: 2px 6px;
  display: inline-block;
  margin-top: 5px;
  width: fit-content;
  border-radius: 3px;
}

.label-preview :deep(.label-70x20) {
  width: 280px;
  height: 80px;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: white;
}

.label-preview :deep(.label-70x20 .label-top) {
  display: flex;
  align-items: center;
}

.label-preview :deep(.label-70x20 .qr-code) {
  width: 56px;
  height: 56px;
  margin-right: 8px;
}

.label-preview :deep(.label-70x20 .label-info) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label-preview :deep(.label-70x20 .label-name) {
  font-size: 12px;
  font-weight: bold;
  word-break: break-all;
  line-height: 1.2;
}

.label-preview :deep(.label-70x20 .label-attrs) {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.label-preview :deep(.label-70x20 .label-location) {
  font-size: 10px;
  font-weight: bold;
  color: white;
  background: #1a1a2e;
  padding: 2px 6px;
  display: inline-block;
  margin-top: auto;
  width: fit-content;
  border-radius: 3px;
}

/* 按钮 */
.btn {
  height: 2.5rem;
  padding: 0 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1.5px solid #e5e7eb;
}

.btn-secondary:hover {
  background: #f9fafb;
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .print-preview-modal,
.modal-leave-active .print-preview-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .print-preview-modal,
.modal-leave-to .print-preview-modal {
  transform: scale(0.95);
  opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .top-bar {
    padding: 1rem;
  }

  .table-wrapper {
    padding: 1rem;
  }

  .top-bar-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
