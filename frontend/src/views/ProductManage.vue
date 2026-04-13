<script setup>
import { ref, computed, onMounted } from 'vue'
import draggable from 'vuedraggable'
import { getProducts, createProduct, updateProduct, deleteProduct, updateProductOrder } from '../api/products.js'
import { getCategories } from '../api/categories.js'
import ProductModal from '../components/ProductModal.vue'
import StockModal from '../components/StockModal.vue'
import LabelPrintModal from '../components/LabelPrintModal.vue'
import MyMessage from '../components/ui/MyMessage.js'
import { MyFilterSelect, MyFilterSearch } from '../components/ui/index.js'

const products = ref([])
const categories = ref([])
const loading = ref(false)
const listError = ref('')

const filterCategory = ref('')
const filterKeyword = ref('')

const showModal = ref(false)
const editingProduct = ref(null)
const saving = ref(false)

const confirmDelete = ref(false)
const deleteTarget = ref(null)
const deleteLoading = ref(false)

const showStockModal = ref(false)
const stockProduct = ref(null)
const stockMode = ref('in')

const showLabelPrintModal = ref(false)
const labelPrintProduct = ref(null)

// 拖拽排序 - 保存原始顺序用于比较
let originalOrder = []

// 分类筛选选项
const categoryOptions = computed(() => [
  { value: '', label: '全部大类' },
  ...categories.value.map(cat => ({ value: cat.id, label: cat.name }))
])

async function loadProducts() {
  loading.value = true
  listError.value = ''
  try {
    const params = {}
    if (filterCategory.value) params.category_id = filterCategory.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await getProducts(params)
    products.value = res.data.data
    originalOrder = products.value.map(p => p.id)
  } catch (e) {
    listError.value = '加载商品列表失败'
    MyMessage.error(e.response?.data?.error || '网络错误，请检查连接')
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data.data
  } catch (e) {
    MyMessage.error(e.response?.data?.error || '加载大类列表失败')
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

async function openEdit(product) {
  editingProduct.value = JSON.parse(JSON.stringify(product))
  // 确保弹窗在 categories 加载完成后再显示
  showModal.value = true
}

async function onModalSuccess(payload) {
  if (saving.value) return
  saving.value = true
  try {
    if (editingProduct.value) {
      await updateProduct(editingProduct.value.id, payload)
      MyMessage.success('商品修改成功')
    } else {
      await createProduct(payload)
      MyMessage.success('新增商品成功')
    }
    showModal.value = false
    await loadProducts()
  } catch (e) {
    MyMessage.error(e.response?.data?.error || '保存失败，请重试')
    // 失败时解锁按钮
    editingProduct.value = editingProduct.value // 保持编辑状态
  } finally {
    saving.value = false
  }
}

function openDelete(product) {
  deleteTarget.value = product
  confirmDelete.value = true
}

async function confirmDeleteProduct() {
  deleteLoading.value = true
  try {
    await deleteProduct(deleteTarget.value.id)
    confirmDelete.value = false
    deleteTarget.value = null
    MyMessage.success('删除商品成功')
    await loadProducts()
  } catch (e) {
    MyMessage.error(e.response?.data?.error || '删除失败')
    confirmDelete.value = false
  } finally {
    deleteLoading.value = false
  }
}

function openStockIn(product) {
  stockProduct.value = product
  stockMode.value = 'in'
  showStockModal.value = true
}

function openStockOut(product) {
  stockProduct.value = product
  stockMode.value = 'out'
  showStockModal.value = true
}

function openStockAdjust(product) {
  stockProduct.value = product
  stockMode.value = 'adjust'
  showStockModal.value = true
}

async function onStockSuccess(result) {
  showStockModal.value = false
  MyMessage.success('库存操作成功')
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
}

// 拖拽排序结束后的回调
async function onDragEnd(evt) {
  // 检查是否真正改变了顺序
  const currentOrder = products.value.map(p => p.id)
  const hasChanged = !currentOrder.every((id, index) => id === originalOrder[index])

  if (!hasChanged) {
    // 顺序没变，不做任何操作
    return
  }

  // 更新原始顺序为当前顺序，避免连续拖动时误判
  originalOrder = currentOrder

  // 生成排序数据
  const items = products.value.map((p, index) => ({
    id: p.id,
    sort_order: index + 1
  }))

  try {
    await updateProductOrder(items)
    MyMessage.success('排序已更新')
  } catch (e) {
    MyMessage.error('保存排序失败: ' + (e.response?.data?.error || e.message))
    await loadProducts()
  }
}

function onPageClick(e) {
  // 点击空白处关闭操作菜单
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
    <div class="flex-shrink-0 px-4 lg:px-6 py-4 lg:py-5 border-b border-slate-200/60 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl pb-safe">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">商品管理</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">共 <span class="font-semibold text-indigo-500">{{ products.length }}</span> 件商品</p>
        </div>
        <button
          @click="openAdd"
          class="flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                 bg-gradient-to-r from-indigo-500 to-indigo-600
                 shadow-md shadow-indigo-500/20
                 hover:from-indigo-600 hover:to-indigo-700
                 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
          <span class="hidden sm:inline">新增商品</span>
        </button>
      </div>

      <!-- 筛选栏 -->
      <div class="mt-4">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-3">
          <!-- 下拉筛选 -->
          <MyFilterSelect
            v-model="filterCategory"
            :options="categoryOptions"
            placeholder="全部大类"
            @change="loadProducts"
          />

          <!-- 搜索框 -->
          <div class="flex-1 min-w-0">
            <MyFilterSearch
              v-model="filterKeyword"
              placeholder="搜索名称 / SKU / 库位"
              @search="onKeywordInput"
            />
          </div>

          <!-- 重置按钮 -->
          <button
            v-if="filterCategory || filterKeyword"
            @click="resetFilters"
            class="shrink-0 h-10 px-4 text-sm font-medium rounded-xl border-2 transition-all duration-200 cursor-pointer
                   text-[var(--filter-accent)] border-[var(--filter-accent)] hover:bg-[var(--filter-bg)]"
          >
            重置
          </button>
        </div>
      </div>
    </div>

    <!-- ════ 列表内容 ════ -->
    <div class="flex-1 overflow-auto">

      <!-- 错误 -->
      <div v-if="listError" class="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
        </div>
        <p class="text-sm text-rose-600 dark:text-rose-300 flex-1">{{ listError }}</p>
        <button @click="listError = ''; loadProducts()" class="text-xs px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/30 cursor-pointer">重试</button>
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
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          </svg>
        </div>
        <p class="text-base font-semibold text-slate-600 dark:text-slate-300">暂无商品</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">点击「新增商品」开始添加</p>
      </div>

      <!-- PC 表格 (>= lg) -->
      <div v-else-if="!loading && products.length > 0" class="hidden lg:block px-6 py-5">
        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[900px]">
              <thead>
                <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                  <th class="w-12 px-3 py-3.5"></th>
                  <th class="px-5 py-3.5 text-left font-medium whitespace-nowrap">SKU 编号</th>
                  <th class="px-5 py-3.5 text-left font-medium min-w-[200px]">商品名称</th>
                  <th class="px-5 py-3.5 text-center font-medium whitespace-nowrap">大类</th>
                  <th class="px-5 py-3.5 text-center font-medium whitespace-nowrap">库存</th>
                  <th class="px-5 py-3.5 text-center font-medium whitespace-nowrap">预警</th>
                  <th class="px-5 py-3.5 text-center font-medium whitespace-nowrap">单价</th>
                  <th class="px-5 py-3.5 text-center font-medium whitespace-nowrap">库位</th>
                  <th class="px-5 py-3.5 text-right font-medium pr-6 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <draggable
                v-model="products"
                item-key="id"
                tag="tbody"
                handle=".drag-handle"
                :animation="150"
                ghost-class="drag-ghost"
                chosen-class="is-drag-chosen"
                drag-class="is-drag-dragging"
                @end="onDragEnd"
              >
                <template #item="{ element: p }">
                  <tr class="group hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    <td class="px-3 py-3.5">
                      <div class="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="拖动排序">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                          <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                        </svg>
                      </div>
                    </td>
                    <td class="px-2 py-3.5">
                      <span class="inline-flex px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                        {{ p.sku_code }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5">
                      <div class="text-sm font-medium text-slate-900 dark:text-white leading-snug">{{ p.name }}</div>
                      <div v-if="p.remark" class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]">{{ p.remark }}</div>
                    </td>
                    <td class="px-5 py-3.5 text-center">
                      <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                        {{ p.category_name }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 text-center whitespace-nowrap">
                      <div class="flex flex-col items-center gap-1">
                        <span class="text-lg font-bold leading-none" :class="stockStatus(p) === 'zero' ? 'text-rose-500' : (stockStatus(p) === 'warn' ? 'text-amber-500' : 'text-slate-900 dark:text-white')">
                          {{ p.current_stock }}
                        </span>
                        <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="stockStatus(p) === 'zero' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : (stockStatus(p) === 'warn' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')">
                          {{ stockLabel(p) }}
                        </span>
                      </div>
                    </td>
                    <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ p.min_stock }} {{ p.unit }}</td>
                    <td class="px-5 py-3.5 text-center font-medium text-slate-700 dark:text-slate-300">¥{{ Number(p.cost_price || 0).toFixed(2) }}</td>
                    <td class="px-5 py-3.5 text-center">
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
                </template>
              </draggable>
            </table>
          </div>
        </div>
      </div>

      <!-- 平板/手机 卡片列表 (< lg) -->
      <div v-if="!loading && products.length > 0" class="lg:hidden p-4 space-y-3">
        <draggable
          v-model="products"
          item-key="id"
          handle=".drag-handle"
          :animation="250"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          drag-class="drag-dragging"
          @end="onDragEnd"
          class="space-y-3"
        >
          <template #item="{ element: p }">
            <div
              class="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden"
            >
              <!-- 卡片头部：SKU + 状态 + 拖拽手柄 -->
              <div class="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
                <div class="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="拖动排序">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                    <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                  </svg>
                </div>
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
                <span v-if="p.location_code" class="inline-flex items-center px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 font-mono">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m3 6 6-3 6 3 6-3 3z" /><path d="m15 6 6-3 6 3 6-3 3z" />
                  </svg>
                  {{ p.location_code }}
                </span>
              </div>

              <!-- 操作按钮行 - 手机端自适应全展示 -->
              <div class="px-2 pb-4 flex items-stretch gap-1">
                <!-- 入库 -->
                <button @click="openStockIn(p)" class="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer" title="入库">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 5v14"/><path d="M5 12h14"/>
                  </svg>
                  <span class="text-[10px] font-medium truncate">入库</span>
                </button>
                <!-- 出库 -->
                <button @click="openStockOut(p)" :disabled="p.current_stock === 0" class="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" title="出库">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                  </svg>
                  <span class="text-[10px] font-medium truncate">出库</span>
                </button>
                <!-- 调整 -->
                <button @click="openStockAdjust(p)" class="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer" title="调整库存">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  <span class="text-[10px] font-medium truncate">调整</span>
                </button>
                <!-- 编辑 -->
                <button @click="openEdit(p)" class="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer" title="编辑">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                  <span class="text-[10px] font-medium truncate">编辑</span>
                </button>
                <!-- 打印 -->
                <button @click="openLabelPrint(p)" class="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 active:scale-95 transition-all cursor-pointer" title="打印标签">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>
                  </svg>
                  <span class="text-[10px] font-medium truncate">打印</span>
                </button>
                <!-- 删除 -->
                <button @click="openDelete(p)" class="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer" title="删除">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                  <span class="text-[10px] font-medium truncate">删除</span>
                </button>
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <ProductModal :visible="showModal" :product="editingProduct" @close="showModal = false" @success="onModalSuccess" @unlock="saving = false" />

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
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          <div class="px-6 pb-6 flex items-center gap-3 pb-safe">
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
/* ============================================= */
/* 拖拽样式 - 简洁高性能版                        */
/* ============================================= */

/* 原位置占位符 - 简洁的虚线边框 */
.drag-ghost {
  opacity: 1 !important;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.06), rgba(99, 102, 241, 0.02)) !important;
  border: 2px dashed rgba(99, 102, 241, 0.3) !important;
}

.drag-ghost td {
  visibility: hidden !important;
}

/* 选中开始拖动时 */
.is-drag-chosen {
  cursor: grabbing !important;
}

/* 正在拖动的行 - 简洁高亮 */
.is-drag-dragging {
  background: rgba(99, 102, 241, 0.15) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.25) !important;
  transform: scale(1.01) !important;
}

/* 拖动手柄悬停 */
.drag-handle:hover {
  background: rgba(99, 102, 241, 0.1) !important;
  border-radius: 6px;
}
</style>
