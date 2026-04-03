<script setup>
import { ref, onMounted } from 'vue'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/products.js'
import { getCategories } from '../api/categories.js'
import ProductModal from '../components/ProductModal.vue'
import StockModal from '../components/StockModal.vue'

const products = ref([])
const categories = ref([])
const loading = ref(false)
const listError = ref('')

// 筛选条件
const filterCategory = ref('')
const filterKeyword = ref('')

// 弹窗控制
const showModal = ref(false)
const editingProduct = ref(null)

// 删除确认
const confirmDelete = ref(false)
const deleteTarget = ref(null)
const deleteLoading = ref(false)

// 库存操作弹窗
const showStockModal = ref(false)
const stockProduct = ref(null)
const stockMode = ref('in')

// 加载商品列表
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

// 加载大类（筛选下拉用）
async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data.data
  } catch (e) {
    console.error(e)
  }
}

// 搜索（防抖）
let searchTimer = null
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadProducts, 400)
}

// 库存状态样式
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

// 打开新增弹窗
function openAdd() {
  editingProduct.value = null
  showModal.value = true
}

// 打开编辑弹窗
function openEdit(product) {
  editingProduct.value = { ...product }
  showModal.value = true
}

// 弹窗提交成功
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

// 删除
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
    await loadProducts()
  } catch (e) {
    alert(e.response?.data?.error || '删除失败')
  } finally {
    deleteLoading.value = false
  }
}

// 库存快捷操作
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
  // 关闭弹窗，刷新列表
  showStockModal.value = false
  await loadProducts()
}

// 重置筛选
function resetFilters() {
  filterCategory.value = ''
  filterKeyword.value = ''
  loadProducts()
}

// 库存状态
onMounted(() => {
  loadCategories()
  loadProducts()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex items-center justify-between px-8 py-5 border-b border-slate-800 flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-slate-100">商品管理</h2>
        <p class="text-xs text-slate-500 mt-0.5">
          共 <span class="text-slate-300">{{ products.length }}</span> 件商品
        </p>
      </div>
      <button
        @click="openAdd"
        class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        <span class="text-base leading-none">+</span>
        新增商品
      </button>
    </header>

    <!-- 筛选栏 -->
    <div class="px-8 py-4 border-b border-slate-800 flex items-center gap-3 flex-shrink-0 bg-slate-900/30">
      <select
        v-model="filterCategory"
        @change="loadProducts"
        class="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
      >
        <option value="">全部大类</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>

      <div class="flex-1 max-w-xs">
        <input
          v-model="filterKeyword"
          @input="onKeywordInput"
          type="text"
          placeholder="搜索名称 / SKU / 库位"
          class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <button
        @click="resetFilters"
        class="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors cursor-pointer"
      >
        重置
      </button>
    </div>

    <!-- 列表错误 -->
    <div
      v-if="listError"
      class="mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300"
    >
      <span class="text-red-400 text-base">!</span>
      {{ listError }}
      <button @click="listError = ''; loadProducts()" class="ml-auto text-red-400 hover:text-red-300 cursor-pointer">重试</button>
    </div>

    <!-- 表格区域 -->
    <div class="flex-1 overflow-auto p-8">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="flex flex-col items-center gap-3 text-slate-500">
          <div class="w-8 h-8 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <div v-else-if="products.length === 0" class="flex flex-col items-center justify-center py-24 text-slate-600">
        <div class="text-5xl mb-4">◈</div>
        <p class="text-base mb-1">暂无商品</p>
        <p class="text-sm">点击右上角「新增商品」开始添加</p>
      </div>

      <div v-else class="rounded-xl border border-slate-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
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
          <tbody class="divide-y divide-slate-800/80">
            <tr
              v-for="p in products"
              :key="p.id"
              class="hover:bg-slate-800/30 transition-colors group"
            >
              <!-- SKU -->
              <td class="px-5 py-4">
                <span class="font-mono text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                  {{ p.sku_code }}
                </span>
              </td>

              <!-- 商品名称 -->
              <td class="px-5 py-4">
                <div class="text-slate-200 font-medium leading-snug">{{ p.name }}</div>
                <div v-if="p.remark" class="text-xs text-slate-600 mt-0.5 truncate max-w-[200px]">
                  {{ p.remark }}
                </div>
              </td>

              <!-- 大类 -->
              <td class="px-5 py-4">
                <span class="inline-flex items-center px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-md border border-slate-700">
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
                      'text-slate-200': stockStatus(p) === 'ok',
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
              <td class="px-5 py-4 text-center text-slate-500 text-xs">
                {{ p.min_stock }} {{ p.unit }}
              </td>

              <!-- 单价 -->
              <td class="px-5 py-4 text-right text-slate-300 pr-8">
                ¥{{ Number(p.cost_price || 0).toFixed(2) }}
              </td>

              <!-- 库位 -->
              <td class="px-5 py-4">
                <span
                  v-if="p.location_code"
                  class="font-mono text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded"
                >
                  {{ p.location_code }}
                </span>
                <span v-else class="text-slate-700 text-xs">—</span>
              </td>

              <!-- 操作 -->
              <td class="px-5 py-4 pr-6">
                <div class="flex items-center justify-end gap-1.5 flex-wrap">
                  <!-- 入库 -->
                  <button
                    @click="openStockIn(p)"
                    class="px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-900/50 hover:border-emerald-700/70 rounded-md transition-colors cursor-pointer bg-transparent"
                    title="入库"
                  >
                    +入库
                  </button>
                  <!-- 出库 -->
                  <button
                    @click="openStockOut(p)"
                    :disabled="p.current_stock === 0"
                    class="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700/70 rounded-md transition-colors cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
                    title="出库"
                  >
                    -出库
                  </button>
                  <!-- 调整 -->
                  <button
                    @click="openStockAdjust(p)"
                    class="px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-900/50 hover:border-amber-700/70 rounded-md transition-colors cursor-pointer bg-transparent"
                    title="库存调整"
                  >
                    调整
                  </button>
                  <span class="text-slate-700 mx-0.5 text-xs">|</span>
                  <!-- 编辑 -->
                  <button
                    @click="openEdit(p)"
                    class="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md transition-colors cursor-pointer bg-transparent"
                  >
                    编辑
                  </button>
                  <!-- 删除 -->
                  <button
                    @click="openDelete(p)"
                    class="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700/80 rounded-md transition-colors cursor-pointer bg-transparent"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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

    <!-- 删除确认弹窗 -->
    <Transition name="fade">
      <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="confirmDelete = false"></div>
        <div class="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div class="px-6 pt-6 pb-2">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-full bg-red-950/60 flex items-center justify-center text-red-400 text-lg">!</div>
              <h3 class="text-base font-semibold text-slate-100">确认删除商品</h3>
            </div>
            <p class="text-sm text-slate-400 pl-[52px]">
              确定删除「<strong class="text-slate-200">{{ deleteTarget?.name }}</strong>」吗？<br />
              相关库存日志也会一并清除，此操作不可恢复。
            </p>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/80">
            <button
              @click="confirmDelete = false"
              class="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              @click="confirmDeleteProduct"
              :disabled="deleteLoading"
              class="px-5 py-2 text-sm text-white bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 rounded-lg font-medium transition-colors cursor-pointer"
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
</style>
