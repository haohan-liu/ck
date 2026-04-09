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

const showLabelPrintModal = ref(false)
const labelPrintProduct = ref(null)

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

function toggleMobileMenu(productId) {
  mobileActionMenu.value = mobileActionMenu.value === productId ? null : productId
}

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
  <div class="h-full overflow-hidden flex flex-col" @click="onPageClick">

    <!-- ════ 页面标题栏 ════ -->
    <div class="flex-shrink-0 px-4 lg:px-6 py-4 lg:py-5 border-b border-slate-200/60 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">商品管理</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">共 <span class="font-semibold text-indigo-500">{{ products.length }}</span> 件商品</p>
        </div>
        <button
          @click="openAdd"
          class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                 bg-gradient-to-r from-indigo-500 to-indigo-600
                 shadow-md shadow-indigo-500/20
                 hover:from-indigo-600 hover:to-indigo-700
                 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
          新增商品
        </button>
      </div>

      <!-- 筛选栏 -->
      <div class="flex items-center gap-3 mt-4 flex-wrap">
        <select
          v-model="filterCategory"
          @change="loadProducts"
          class="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
        >
          <option value="">全部大类</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
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
              placeholder="搜索名称 / SKU / 库位"
              class="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <button
          v-if="filterCategory || filterKeyword"
          @click="resetFilters"
          class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          重置
        </button>
      </div>
    </div>

    <!-- ════ 列表内容 ════ -->
    <div class="flex-1 overflow-auto">

      <!-- 错误 -->
      <div v-if="listError" class="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
        </div>
        <p class="text-sm text-rose-600 dark:text-rose-300 flex-1">{{ listError }}</p>
        <button @click="listError = ''; loadProducts()" class="text-xs text-rose-500 hover:text-rose-600 cursor-pointer">重试</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500 dark:text-slate-400">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="products.length === 0" class="flex flex-col items-center justify-center py-20">
        <div class="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400">
            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          </svg>
        </div>
        <p class="text-base font-semibold text-slate-600 dark:text-slate-300">暂无商品</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">点击「新增商品」开始添加</p>
      </div>

      <!-- PC 表格 (>= lg) -->
      <div v-else-if="!loading && products.length > 0" class="hidden lg:block px-6 py-5">
        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <th class="px-5 py-3.5 text-left font-medium">SKU 编号</th>
                <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                <th class="px-5 py-3.5 text-left font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">库存</th>
                <th class="px-5 py-3.5 text-center font-medium">预警阈值</th>
                <th class="px-5 py-3.5 text-right font-medium">单价</th>
                <th class="px-5 py-3.5 text-left font-medium">库位</th>
                <th class="px-5 py-3.5 text-right font-medium pr-5">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 dark:divide-white/5">
              <tr
                v-for="p in products"
                :key="p.id"
                class="group hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
              >
                <td class="px-5 py-3.5">
                  <span class="inline-flex px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                    {{ p.sku_code }}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <div class="text-sm font-medium text-slate-900 dark:text-white leading-snug">{{ p.name }}</div>
                  <div v-if="p.remark" class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]">{{ p.remark }}</div>
                </td>
                <td class="px-5 py-3.5">
                  <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                    {{ p.category_name }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center">
                  <div class="flex flex-col items-center gap-1">
                    <span class="text-lg font-bold leading-none" :class="stockStatus(p) === 'zero' ? 'text-rose-500' : (stockStatus(p) === 'warn' ? 'text-amber-500' : 'text-slate-900 dark:text-white')">
                      {{ p.current_stock }}
                    </span>
                    <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="stockStatus(p) === 'zero' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : (stockStatus(p) === 'warn' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')">
                      {{ stockLabel(p) }}
                    </span>
                  </div>
                </td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400">{{ p.min_stock }} {{ p.unit }}</td>
                <td class="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300 pr-8">¥{{ Number(p.cost_price || 0).toFixed(2) }}</td>
                <td class="px-5 py-3.5">
                  <span v-if="p.location_code" class="inline-flex px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                    {{ p.location_code }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
                </td>
                <td class="px-5 py-3.5 pr-5">
                  <div class="flex items-center justify-end gap-1.5 flex-wrap">
                    <!-- 入库 -->
                    <button @click="openStockIn(p)" class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer">
                      +入库
                    </button>
                    <!-- 出库 -->
                    <button @click="openStockOut(p)" :disabled="p.current_stock === 0" class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                      -出库
                    </button>
                    <!-- 调整 -->
                    <button @click="openStockAdjust(p)" class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer">
                      调整
                    </button>
                    <span class="mx-0.5 text-xs" style="color: var(--border-strong);">|</span>
                    <!-- 编辑 -->
                    <button @click="openEdit(p)" class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
                      编辑
                    </button>
                    <!-- 删除 -->
                    <button @click="openDelete(p)" class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer">
                      删除
                    </button>
                    <span class="mx-0.5 text-xs" style="color: var(--border-strong);">|</span>
                    <!-- 打印 -->
                    <button @click="openLabelPrint(p)" class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 active:scale-95 transition-all cursor-pointer">
                      标签
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 平板/手机 卡片列表 (< lg) -->
      <div v-if="!loading && products.length > 0" class="lg:hidden p-4 space-y-3">
        <div
          v-for="p in products"
          :key="p.id"
          class="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden"
        >
          <!-- 卡片头部：SKU + 状态 -->
          <div class="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
            <span class="inline-flex px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 shrink-0">
              {{ p.sku_code }}
            </span>
            <span class="text-xs px-2 py-1 rounded-lg font-medium shrink-0" :class="stockStatus(p) === 'zero' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : (stockStatus(p) === 'warn' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')">
              {{ stockLabel(p) }}
            </span>
          </div>

          <!-- 商品名 -->
          <div class="px-4 pb-3">
            <p class="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{{ p.name }}</p>
            <div v-if="p.remark" class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{{ p.remark }}</div>
          </div>

          <!-- 数据指标 -->
          <div class="px-4 pb-3 flex items-center gap-4">
            <!-- 库存 -->
            <div class="text-center">
              <p class="text-xl font-bold leading-none" :class="stockStatus(p) === 'zero' ? 'text-rose-500' : (stockStatus(p) === 'warn' ? 'text-amber-500' : 'text-slate-900 dark:text-white')">{{ p.current_stock }}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{{ p.unit }}</p>
            </div>
            <div class="w-px h-8" style="background-color: var(--border-default);"></div>
            <!-- 预警 -->
            <div class="text-center">
              <p class="text-sm font-medium text-slate-600 dark:text-slate-300 leading-none">{{ p.min_stock }}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">预警</p>
            </div>
            <div class="w-px h-8" style="background-color: var(--border-default);"></div>
            <!-- 单价 -->
            <div class="text-center">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-none">¥{{ Number(p.cost_price || 0).toFixed(2) }}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">单价</p>
            </div>
          </div>

          <!-- 大类 + 库位 -->
          <div class="px-4 pb-3 flex items-center gap-2 flex-wrap">
            <span class="inline-flex px-2 py-0.5 text-xs rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">{{ p.category_name }}</span>
            <span v-if="p.location_code" class="inline-flex px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 font-mono">
              <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-0.5">
                <path d="m3 6 6-3 6 3 6-3 3z"/><path d="m15 6 6-3 6 3 6-3 3z"/>
              </svg>
              {{ p.location_code }}
            </span>
          </div>

          <!-- 操作按钮行 -->
          <div class="px-4 pb-4 flex items-center gap-2">
            <button @click="openStockIn(p)" class="flex-1 py-2 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer">
              +入库
            </button>
            <button @click="openStockOut(p)" :disabled="p.current_stock === 0" class="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
              -出库
            </button>
            <button @click="openStockAdjust(p)" class="flex-1 py-2 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer">
              调整
            </button>
            <button @click="openEdit(p)" class="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
              编辑
            </button>
            <!-- 更多操作 -->
            <div class="relative">
              <button @click.stop="toggleMobileMenu(p.id)" class="action-menu-btn w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
              <!-- 下拉菜单 -->
              <Transition name="dropdown">
                <div
                  v-if="mobileActionMenu === p.id"
                  class="action-menu-dropdown absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl shadow-black/10 overflow-hidden"
                >
                  <div class="p-1.5 space-y-0.5">
                    <button @click="openLabelPrint(p); mobileActionMenu = null" class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>
                      </svg>
                      打印标签
                    </button>
                    <div class="h-px bg-slate-100 dark:bg-white/5 my-1"></div>
                    <button @click="openDelete(p)" class="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                      删除商品
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <ProductModal :visible="showModal" :product="editingProduct" @close="showModal = false" @success="onModalSuccess" />

    <!-- 库存操作弹窗 -->
    <StockModal :visible="showStockModal" :product="stockProduct" :mode="stockMode" @close="showStockModal = false" @success="onStockSuccess" />

    <!-- 标签打印弹窗 -->
    <LabelPrintModal :visible="showLabelPrintModal" :product="labelPrintProduct" @close="showLabelPrintModal = false" />

    <!-- 删除确认弹窗 -->
    <Transition name="modal-fade">
      <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="confirmDelete = false"></div>
        <div
          class="relative w-full max-w-sm rounded-2xl overflow-hidden scale-in
                 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl">
          <div class="p-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-900 dark:text-white">确认删除商品</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                  确定删除「<strong class="text-slate-700 dark:text-slate-200">{{ deleteTarget?.name }}</strong>」吗？此操作不可恢复。
                </p>
              </div>
            </div>
          </div>
          <div class="px-6 pb-6 flex items-center gap-3">
            <button @click="confirmDelete = false" class="flex-1 py-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
              取消
            </button>
            <button @click="confirmDeleteProduct" :disabled="deleteLoading" class="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-rose-500 to-rose-600 shadow-md shadow-rose-500/20 hover:from-rose-600 hover:to-rose-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
              {{ deleteLoading ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px) scale(0.97); }
.dropdown-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.scale-in { animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes scale-in {
  0%   { opacity: 0; transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}
</style>
