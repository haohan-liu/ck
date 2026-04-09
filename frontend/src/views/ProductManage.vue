<script setup>
import { ref, onMounted } from 'vue'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/products.js'
import { getCategories } from '../api/categories.js'
import ProductModal from '../components/ProductModal.vue'
import StockModal from '../components/StockModal.vue'
import LabelPrintModal from '../components/LabelPrintModal.vue'

const products = ref([])
const categories = ref([])
const loading = ref(false)
const listError = ref('')

const filterCategory = ref('')
const filterKeyword = ref('')

const showModal = ref(false)
const editingProduct = ref(null)

const confirmDelete = ref(false)
const deleteTarget = ref(null)
const deleteLoading = ref(false)

const showStockModal = ref(false)
const stockProduct = ref(null)
const stockMode = ref('in')

// 标签打印弹窗
const showLabelPrintModal = ref(false)
const labelPrintProduct = ref(null)

// 移动端操作菜单展开状态
const mobileActionMenu = ref(null)

async function loadProducts() {
  loading.value = true
  listError.value = ''
  try {
    const params = {}
    if (filterCategory.value) params.category_id = filterCategory.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await getProducts(params)
    products.value = res.data.data
  } catch (e) {
    listError.value = '加载商品列表失败'
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data.data
  } catch (e) {
    console.error(e)
  }
}

let searchTimer = null
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadProducts, 400)
}

function stockStatus(product) {
  if (product.current_stock === 0) return 'zero'
  if (product.current_stock <= product.min_stock) return 'warn'
  return 'ok'
}

function stockLabel(product) {
  const s = stockStatus(product)
  if (s === 'zero') return '缺货'
  if (s === 'warn') return '预警'
  return '正常'
}

function openAdd() {
  editingProduct.value = null
  showModal.value = true
}

function openEdit(product) {
  editingProduct.value = { ...product }
  showModal.value = true
}

async function onModalSuccess(payload) {
  try {
    if (editingProduct.value) {
      await updateProduct(editingProduct.value.id, payload)
    } else {
      await createProduct(payload)
    }
    showModal.value = false
    await loadProducts()
  } catch (e) {
    alert(e.response?.data?.error || '保存失败')
  }
}

function openDelete(product) {
  deleteTarget.value = product
  confirmDelete.value = true
  mobileActionMenu.value = null
}

async function confirmDeleteProduct() {
  deleteLoading.value = true
  try {
    await deleteProduct(deleteTarget.value.id)
    confirmDelete.value = false
    deleteTarget.value = null
    await loadProducts()
  } catch (e) {
    alert(e.response?.data?.error || '删除失败')
  } finally {
    deleteLoading.value = false
  }
}

function openStockIn(product) {
  stockProduct.value = product
  stockMode.value = 'in'
  showStockModal.value = true
  mobileActionMenu.value = null
}

function openStockOut(product) {
  stockProduct.value = product
  stockMode.value = 'out'
  showStockModal.value = true
  mobileActionMenu.value = null
}

function openStockAdjust(product) {
  stockProduct.value = product
  stockMode.value = 'adjust'
  showStockModal.value = true
  mobileActionMenu.value = null
}

async function onStockSuccess(result) {
  showStockModal.value = false
  await loadProducts()
}

function resetFilters() {
  filterCategory.value = ''
  filterKeyword.value = ''
  loadProducts()
}

function openLabelPrint(product) {
  labelPrintProduct.value = product
  showLabelPrintModal.value = true
  mobileActionMenu.value = null
}

// 切换移动端操作菜单
function toggleMobileMenu(productId) {
  mobileActionMenu.value = mobileActionMenu.value === productId ? null : productId
}

// 点击外部关闭菜单
function onPageClick(e) {
  if (mobileActionMenu.value && !e.target.closest('.action-menu-btn') && !e.target.closest('.action-menu-dropdown')) {
    mobileActionMenu.value = null
  }
}

onMounted(() => {
  loadCategories()
  loadProducts()
  document.addEventListener('click', onPageClick)
})
</script>

<template>
  <div class="flex flex-col h-full" @click="onPageClick">
    <!-- 页面头部 -->
    <header class="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-[var(--border-default)]">
      <div>
        <h2 class="text-base sm:text-lg font-semibold text-[var(--text-primary)]">商品管理</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">
          共 <span class="text-[var(--text-secondary)]">{{ products.length }}</span> 件商品
        </p>
      </div>
      <button
        @click="openAdd"
        class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer"
      >
        <span class="text-sm leading-none">+</span>
        <span class="hidden sm:inline">新增商品</span>
        <span class="sm:hidden">新增</span>
      </button>
    </header>

    <!-- 筛选栏 -->
    <div class="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-[var(--border-default)] flex items-center gap-2 sm:gap-3 flex-shrink-0 bg-[var(--bg-secondary)]/50">
      <select
        v-model="filterCategory"
        @change="loadProducts"
        class="px-2.5 sm:px-3 py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-xs sm:text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-all duration-150 cursor-pointer appearance-none min-w-[80px] sm:min-w-[120px]"
      >
        <option value="">全部</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>

      <div class="flex-1 min-w-0">
        <input
          v-model="filterKeyword"
          @input="onKeywordInput"
          type="text"
          placeholder="搜索名称 / SKU / 库位"
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
      v-if="listError"
      class="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs sm:text-sm text-red-300"
    >
      <span class="text-red-400 text-base shrink-0">!</span>
      {{ listError }}
      <button @click="listError = ''; loadProducts()" class="ml-auto text-red-400 hover:text-red-300 cursor-pointer">重试</button>
    </div>

    <!-- 列表区域 -->
    <div class="flex-1 overflow-auto">

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-12 sm:py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="products.length === 0" class="flex flex-col items-center justify-center py-20 sm:py-24 text-[var(--text-muted)]">
        <div class="text-4xl sm:text-5xl mb-4 opacity-40">◈</div>
        <p class="text-sm sm:text-base mb-1">暂无商品</p>
        <p class="text-xs sm:text-sm opacity-60">点击「新增」开始添加</p>
      </div>

      <!-- 有商品数据：PC 端表格（>= lg） -->
      <div v-if="!loading && products.length > 0" class="hidden lg:block p-6 lg:p-8">
        <div class="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                <th class="px-5 py-3.5 text-left font-medium">SKU 编号</th>
                <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                <th class="px-5 py-3.5 text-left font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">库存</th>
                <th class="px-5 py-3.5 text-center font-medium">预警阈值</th>
                <th class="px-5 py-3.5 text-right font-medium">单价</th>
                <th class="px-5 py-3.5 text-left font-medium">库位</th>
                <th class="px-5 py-3.5 text-right font-medium pr-6">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-default)]">
              <tr
                v-for="p in products"
                :key="p.id"
                class="bg-[var(--row-bg)] hover:bg-[var(--hover-bg)] transition-colors duration-100 group"
              >
                <!-- SKU -->
                <td class="px-5 py-4">
                  <span class="font-mono text-xs text-[var(--text-muted)] bg-[var(--input-bg)] px-2 py-0.5 rounded">
                    {{ p.sku_code }}
                  </span>
                </td>

                <!-- 商品名称 -->
                <td class="px-5 py-4">
                  <div class="text-[var(--text-primary)] font-medium leading-snug">{{ p.name }}</div>
                  <div v-if="p.remark" class="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[200px]">
                    {{ p.remark }}
                  </div>
                </td>

                <!-- 大类 -->
                <td class="px-5 py-4">
                  <span class="inline-flex items-center px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]">
                    {{ p.category_name }}
                  </span>
                </td>

                <!-- 库存 + 状态 -->
                <td class="px-5 py-4 text-center">
                  <div class="flex flex-col items-center gap-1">
                    <span
                      class="text-base font-semibold"
                      :class="{
                        'text-red-400': stockStatus(p) === 'zero',
                        'text-amber-400': stockStatus(p) === 'warn',
                        'text-[var(--text-primary)]': stockStatus(p) === 'ok',
                      }"
                    >
                      {{ p.current_stock }}
                    </span>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded font-medium"
                      :class="{
                        'bg-red-950/60 text-red-400': stockStatus(p) === 'zero',
                        'bg-amber-950/60 text-amber-400': stockStatus(p) === 'warn',
                        'bg-emerald-950/60 text-emerald-400': stockStatus(p) === 'ok',
                      }"
                    >
                      {{ stockLabel(p) }}
                    </span>
                  </div>
                </td>

                <!-- 预警阈值 -->
                <td class="px-5 py-4 text-center text-[var(--text-muted)] text-xs">
                  {{ p.min_stock }} {{ p.unit }}
                </td>

                <!-- 单价 -->
                <td class="px-5 py-4 text-right text-[var(--text-secondary)] pr-8">
                  ¥{{ Number(p.cost_price || 0).toFixed(2) }}
                </td>

                <!-- 库位 -->
                <td class="px-5 py-4">
                  <span v-if="p.location_code" class="font-mono text-xs text-[var(--text-muted)] bg-[var(--input-bg)] px-2 py-0.5 rounded">
                    {{ p.location_code }}
                  </span>
                  <span v-else class="text-[var(--text-muted)] text-xs">—</span>
                </td>

                <!-- 操作按钮组（PC 端） -->
                <td class="px-5 py-4 pr-6">
                  <div class="flex items-center justify-end gap-1 flex-wrap">
                    <!-- 入库 -->
                    <button
                      @click="openStockIn(p)"
                      class="px-2 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-900/50 hover:border-emerald-700/70 rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                      title="入库"
                    >
                      +入库
                    </button>
                    <!-- 出库 -->
                    <button
                      @click="openStockOut(p)"
                      :disabled="p.current_stock === 0"
                      class="px-2 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700/70 rounded-md transition-all duration-150 cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
                      title="出库"
                    >
                      -出库
                    </button>
                    <!-- 调整 -->
                    <button
                      @click="openStockAdjust(p)"
                      class="px-2 py-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-900/50 hover:border-amber-700/70 rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                      title="库存调整"
                    >
                      调整
                    </button>
                    <span class="text-[var(--border-default)] mx-0.5 text-xs">|</span>
                    <!-- 编辑 -->
                    <button
                      @click="openEdit(p)"
                      class="px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                    >
                      编辑
                    </button>
                    <!-- 删除 -->
                    <button
                      @click="openDelete(p)"
                      class="px-2 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700/80 rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                    >
                      删除
                    </button>
                    <span class="text-[var(--border-default)] mx-0.5 text-xs">|</span>
                    <!-- 打印标签 -->
                    <button
                      @click="openLabelPrint(p)"
                      class="px-2 py-1.5 text-xs text-sky-400 hover:text-sky-300 border border-sky-900/50 hover:border-sky-700/70 rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                      title="打印标签"
                    >
                      标签
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 有商品数据：移动端卡片列表（< lg） -->
      <div v-if="!loading && products.length > 0" class="lg:hidden p-4 sm:p-6 space-y-3">
        <div
          v-for="p in products"
          :key="p.id"
          class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-4 space-y-3 hover:border-[var(--border-strong)] transition-colors"
        >
          <!-- 第一行：SKU + 状态 -->
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] bg-[var(--input-bg)] px-1.5 py-0.5 rounded shrink-0">
              {{ p.sku_code }}
            </span>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              :class="{
                'bg-red-950/60 text-red-400': stockStatus(p) === 'zero',
                'bg-amber-950/60 text-amber-400': stockStatus(p) === 'warn',
                'bg-emerald-950/60 text-emerald-400': stockStatus(p) === 'ok',
              }"
            >
              {{ stockLabel(p) }}
            </span>
          </div>

          <!-- 第二行：商品名称 -->
          <div class="text-sm sm:text-base font-medium text-[var(--text-primary)] leading-snug">
            {{ p.name }}
          </div>
          <div v-if="p.remark" class="text-xs text-[var(--text-muted)] truncate">
            {{ p.remark }}
          </div>

          <!-- 第三行：库存 + 单价 + 库位 -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-4">
              <!-- 库存 -->
              <div class="text-center">
                <p
                  class="text-lg sm:text-xl font-bold leading-none"
                  :class="{
                    'text-red-400': stockStatus(p) === 'zero',
                    'text-amber-400': stockStatus(p) === 'warn',
                    'text-[var(--text-primary)]': stockStatus(p) === 'ok',
                  }"
                >
                  {{ p.current_stock }}
                </p>
                <p class="text-[10px] text-[var(--text-muted)] mt-0.5">{{ p.unit }}</p>
              </div>
              <!-- 分隔线 -->
              <div class="w-px h-8 bg-[var(--border-default)]"></div>
              <!-- 预警阈值 -->
              <div class="text-center">
                <p class="text-sm font-medium text-[var(--text-muted)] leading-none">{{ p.min_stock }}</p>
                <p class="text-[10px] text-[var(--text-muted)] mt-0.5">预警</p>
              </div>
              <!-- 分隔线 -->
              <div class="w-px h-8 bg-[var(--border-default)]"></div>
              <!-- 单价 -->
              <div class="text-center">
                <p class="text-sm font-semibold text-[var(--text-secondary)] leading-none">
                  ¥{{ Number(p.cost_price || 0).toFixed(2) }}
                </p>
                <p class="text-[10px] text-[var(--text-muted)] mt-0.5">单价</p>
              </div>
            </div>

            <!-- 更多操作按钮（移动端） -->
            <div class="relative">
              <button
                @click.stop="toggleMobileMenu(p.id)"
                class="action-menu-btn w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] border border-[var(--border-default)] transition-all duration-150 cursor-pointer"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                </svg>
              </button>

              <!-- 下拉菜单 -->
              <Transition name="dropdown">
                <div
                  v-if="mobileActionMenu === p.id"
                  class="action-menu-dropdown absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-[var(--border-strong)] bg-[var(--modal-bg)] shadow-xl shadow-black/40 overflow-hidden"
                >
                  <div class="py-1">
                    <button
                      @click="openStockIn(p)"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-emerald-400 hover:bg-emerald-950/30 transition-colors"
                    >
                      <span class="text-sm">+</span> 入库
                    </button>
                    <button
                      @click="openStockOut(p)"
                      :disabled="p.current_stock === 0"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span class="text-sm">-</span> 出库
                    </button>
                    <button
                      @click="openStockAdjust(p)"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-amber-400 hover:bg-amber-950/30 transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      库存调整
                    </button>
                    <div class="h-px bg-[var(--border-default)] my-1"></div>
                    <button
                      @click="openEdit(p)"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      编辑商品
                    </button>
                    <button
                      @click="openLabelPrint(p)"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-sky-400 hover:bg-sky-950/30 transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                      </svg>
                      打印标签
                    </button>
                    <div class="h-px bg-[var(--border-default)] my-1"></div>
                    <button
                      @click="openDelete(p)"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      删除商品
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 第四行：大类 + 库位标签 -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-secondary)] text-[10px] sm:text-xs rounded-md border border-[var(--border-default)]">
              {{ p.category_name }}
            </span>
            <span v-if="p.location_code" class="inline-flex items-center px-2 py-0.5 bg-[var(--input-bg)] text-[var(--text-muted)] text-[10px] sm:text-xs rounded-md border border-[var(--border-default)] font-mono">
              📍 {{ p.location_code }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑 弹窗 -->
    <ProductModal
      :visible="showModal"
      :product="editingProduct"
      @close="showModal = false"
      @success="onModalSuccess"
    />

    <!-- 库存操作弹窗（入库/出库/调整） -->
    <StockModal
      :visible="showStockModal"
      :product="stockProduct"
      :mode="stockMode"
      @close="showStockModal = false"
      @success="onStockSuccess"
    />

    <!-- 标签打印弹窗 -->
    <LabelPrintModal
      :visible="showLabelPrintModal"
      :product="labelPrintProduct"
      @close="showLabelPrintModal = false"
    />

    <!-- 删除确认弹窗 -->
    <Transition name="fade">
      <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"></div>
        <div class="relative w-full max-w-sm bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div class="px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-950/60 flex items-center justify-center text-red-400 text-lg shrink-0">
                !
              </div>
              <h3 class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">确认删除商品</h3>
            </div>
            <p class="text-xs sm:text-sm text-[var(--text-secondary)] pl-[44px] sm:pl-[52px]">
              确定删除「<strong class="text-[var(--text-primary)]">{{ deleteTarget?.name }}</strong>」吗？
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 sm:gap-3 px-5 sm:px-6 py-3 sm:py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80">
            <button
              @click="confirmDelete = false"
              class="px-3 sm:px-4 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
            >
              取消
            </button>
            <button
              @click="confirmDeleteProduct"
              :disabled="deleteLoading"
              class="px-4 sm:px-5 py-2 text-xs sm:text-sm text-white bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 rounded-lg font-medium transition-all duration-150 cursor-pointer"
            >
              {{ deleteLoading ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 下拉菜单动画 */
.dropdown-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
