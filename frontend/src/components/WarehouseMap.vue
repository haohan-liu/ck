<template>
  <div class="warehouse-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        库位可视化
      </h1>
      <span class="page-subtitle">快速定位商品位置</span>
    </div>

    <!-- 搜索框 -->
    <div class="search-section">
      <div class="search-box">
        <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchKeyword"
          type="text"
          class="search-input"
          placeholder="输入 SKU 或商品名，查找对应库区..."
        />
        <button v-if="searchKeyword" class="search-clear" @click="searchKeyword = ''">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div v-if="searchKeyword && searchResults.length > 0" class="search-hint">
        找到 <strong>{{ searchResults.length }}</strong> 件商品匹配
      </div>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="main-layout">
      <!-- 左侧：仓库平面图 -->
      <div class="map-panel">
        <div class="panel-header">
          <h3 class="panel-title">仓库平面图</h3>
          <span class="area-count">{{ dynamicAreas.length }} 个库区</span>
        </div>

        <div class="warehouse-map">
          <!-- 动态渲染的库区区块 -->
          <div
            v-for="area in dynamicAreas"
            :key="area.code"
            class="area-block"
            :class="{
              active: selectedArea === area.code,
              highlighted: isHighlighted(area.code),
              empty: area.productCount === 0
            }"
            @click="selectArea(area.code)"
          >
            <div class="area-badge">{{ area.code }}</div>
            <div class="area-content">
              <div class="area-name">{{ area.name }}</div>
              <div class="area-stats">
                <span class="sku-count">{{ area.productCount }} SKU</span>
                <span class="stock-count">{{ area.totalStock }} 件</span>
              </div>
            </div>
            <div class="area-indicator" :class="getStockStatus(area)"></div>
          </div>

          <!-- 空状态 -->
          <div v-if="dynamicAreas.length === 0" class="empty-map">
            <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p>暂无库位数据</p>
            <span>请先添加商品并设置库位</span>
          </div>
        </div>

        <!-- 图例 -->
        <div class="map-legend">
          <div class="legend-item">
            <span class="legend-dot normal"></span>
            <span>库存充足</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot warning"></span>
            <span>库存预警</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot empty"></span>
            <span>库存为零</span>
          </div>
        </div>
      </div>

      <!-- 右侧：商品详情列表 -->
      <div class="detail-panel">
        <Transition name="slide-left">
          <div v-if="selectedArea" class="detail-content">
            <div class="detail-header">
              <div class="detail-title-group">
                <h3 class="detail-title">{{ selectedArea }} 区详情</h3>
                <span class="detail-count">{{ areaProducts.length }} 件商品</span>
              </div>
              <button class="detail-close" @click="selectedArea = null">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- 库位分组 -->
            <div v-if="groupedProducts.length > 0" class="product-groups">
              <div
                v-for="group in groupedProducts"
                :key="group.location"
                class="product-group"
              >
                <div class="group-header">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span class="group-location">{{ group.location }}</span>
                  <span class="group-count">{{ group.products.length }} 件</span>
                </div>
                <div class="group-products">
                  <div
                    v-for="product in group.products"
                    :key="product.id"
                    class="product-card"
                  >
                    <div class="product-main">
                      <div class="product-name">{{ product.name }}</div>
                      <div class="product-sku">{{ product.sku_code }}</div>
                    </div>
                    <div class="product-specs">
                      <span
                        v-for="spec in getAttrList(product)"
                        :key="spec"
                        class="spec-tag"
                      >
                        {{ spec }}
                      </span>
                    </div>
                    <div class="product-stock" :class="getStockClass(product)">
                      <span class="stock-value">{{ product.current_stock }}</span>
                      <span class="stock-unit">{{ product.unit }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="empty-detail">
              <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>该库区暂无商品</p>
            </div>
          </div>

          <!-- 未选中状态 -->
          <div v-else class="detail-placeholder">
            <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p>点击左侧库区查看商品</p>
            <span>或使用上方搜索快速定位</span>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { productApi } from '@/api/index.js'

const products = ref([])
const selectedArea = ref(null)
const searchKeyword = ref('')

// 加载商品数据
async function loadProducts() {
  try {
    const res = await productApi.list()
    products.value = res.data || []
  } catch (err) {
    console.error('加载商品失败:', err)
  }
}

onMounted(() => {
  loadProducts()
})

// 动态提取库区数据
const dynamicAreas = computed(() => {
  const areaMap = new Map()

  products.value.forEach(product => {
    const location = product.location_code || ''
    if (!location) return

    // 提取库区代码（如 "A区-01盒" -> "A区"）
    const match = location.match(/^([A-Za-z0-9]+区)/)
    const areaCode = match ? match[1] : location.split(/[-_/]/)[0]

    if (!areaMap.has(areaCode)) {
      areaMap.set(areaCode, {
        code: areaCode,
        name: areaCode,
        productCount: 0,
        totalStock: 0,
        hasWarning: false,
        hasZero: false
      })
    }

    const area = areaMap.get(areaCode)
    area.productCount++
    area.totalStock += product.current_stock || 0

    if (product.current_stock === 0) {
      area.hasZero = true
    } else if (product.current_stock <= product.min_stock) {
      area.hasWarning = true
    }
  })

  return Array.from(areaMap.values()).sort((a, b) => a.code.localeCompare(b.code))
})

// 获取库区库存状态
function getStockStatus(area) {
  if (area.hasZero) return 'empty'
  if (area.hasWarning) return 'warning'
  return 'normal'
}

// 获取某库区的商品
const areaProducts = computed(() => {
  if (!selectedArea.value) return []

  return products.value.filter(product => {
    const location = product.location_code || ''
    return location.startsWith(selectedArea.value)
  })
})

// 按库位号分组
const groupedProducts = computed(() => {
  const groups = new Map()

  areaProducts.value.forEach(product => {
    const location = product.location_code || '未分类'
    if (!groups.has(location)) {
      groups.set(location, [])
    }
    groups.get(location).push(product)
  })

  return Array.from(groups.entries()).map(([location, products]) => ({
    location,
    products
  })).sort((a, b) => a.location.localeCompare(b.location))
})

// 选择库区
function selectArea(areaCode) {
  if (selectedArea.value === areaCode) {
    selectedArea.value = null
  } else {
    selectedArea.value = areaCode
  }
}

// 获取规格属性列表
function getAttrList(product) {
  if (!product.attributes || typeof product.attributes !== 'object') return []
  return Object.values(product.attributes)
    .filter(v => v && String(v).trim())
}

// 获取库存样式类
function getStockClass(product) {
  if (product.current_stock === 0) return 'zero'
  if (product.current_stock <= product.min_stock) return 'warn'
  return 'ok'
}

// 搜索相关
const searchResults = computed(() => {
  if (!searchKeyword.value.trim()) return []
  const kw = searchKeyword.value.toLowerCase()
  return products.value.filter(p =>
    (p.name || '').toLowerCase().includes(kw) ||
    (p.sku_code || '').toLowerCase().includes(kw)
  )
})

// 检查某库区是否被高亮
function isHighlighted(areaCode) {
  if (!searchKeyword.value.trim()) return false
  return searchResults.value.some(p => {
    const location = p.location_code || ''
    return location.startsWith(areaCode)
  })
}

// 监听搜索结果，自动选中库区
watch(searchResults, (results) => {
  if (results.length === 1 && dynamicAreas.value.length > 0) {
    const location = results[0].location_code || ''
    const match = location.match(/^([A-Za-z0-9]+区)/)
    if (match) {
      selectedArea.value = match[1]
    }
  }
})
</script>

<style scoped>
.warehouse-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 2rem;
}

/* 页面头部 */
.page-header {
  margin-bottom: 2rem;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.page-title svg {
  color: #3b82f6;
}

.page-subtitle {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

/* 搜索区 */
.search-section {
  margin-bottom: 2rem;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 600px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  color: #9ca3af;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 3rem;
  padding: 0 3rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  color: #1a1a2e;
  background: white;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-clear {
  position: absolute;
  right: 0.75rem;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border: none;
  border-radius: 50%;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.search-clear:hover {
  background: #e5e7eb;
  color: #374151;
}

.search-hint {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.search-hint strong {
  color: #3b82f6;
}

/* 主布局 */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

/* 地图面板 */
.map-panel {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.panel-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
}

.area-count {
  font-size: 0.8125rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
}

/* 仓库地图网格 */
.warehouse-map {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.area-block {
  position: relative;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.area-block:hover {
  border-color: #93c5fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.area-block.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.area-block.highlighted {
  animation: pulse-highlight 1.5s ease-in-out infinite;
}

.area-block.empty {
  opacity: 0.5;
}

@keyframes pulse-highlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
  }
}

.area-badge {
  position: absolute;
  top: 0;
  left: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 12px 0 8px 0;
}

.area-block.active .area-badge {
  background: #1d4ed8;
}

.area-content {
  padding-top: 0.5rem;
}

.area-name {
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 0.5rem;
}

.area-stats {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sku-count {
  font-size: 0.8125rem;
  color: #374151;
  font-weight: 500;
}

.stock-count {
  font-size: 0.75rem;
  color: #9ca3af;
}

.area-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.area-indicator.normal {
  background: linear-gradient(90deg, #22c55e, #4ade80);
}

.area-indicator.warning {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.area-indicator.empty {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

/* 空地图状态 */
.empty-map {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: #9ca3af;
}

.empty-map p {
  margin-top: 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
}

.empty-map span {
  margin-top: 0.25rem;
  font-size: 0.875rem;
}

/* 图例 */
.map-legend {
  display: flex;
  gap: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.legend-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
}

.legend-dot.normal {
  background: #22c55e;
}

.legend-dot.warning {
  background: #f59e0b;
}

.legend-dot.empty {
  background: #ef4444;
}

/* 详情面板 */
.detail-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.detail-content,
.detail-placeholder {
  height: 100%;
  min-height: 400px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.detail-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
}

.detail-count {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

.detail-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.detail-close:hover {
  background: #fee2e2;
  color: #ef4444;
}

/* 商品分组 */
.product-groups {
  padding: 1rem;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.product-group {
  margin-bottom: 1.25rem;
}

.product-group:last-child {
  margin-bottom: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: #f3f4f6;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.group-header svg {
  color: #6b7280;
}

.group-location {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  font-family: monospace;
}

.group-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: #9ca3af;
}

.group-products {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 0.5rem;
  border-left: 2px solid #e5e7eb;
}

/* 商品卡片 */
.product-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 0.875rem;
  background: #f9fafb;
  border-radius: 10px;
  transition: background 0.15s;
}

.product-card:hover {
  background: #f3f4f6;
}

.product-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.product-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-sku {
  font-size: 0.75rem;
  color: #3b82f6;
  font-family: monospace;
}

.product-specs {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.spec-tag {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.product-stock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
}

.stock-value {
  font-size: 1.125rem;
  font-weight: 700;
}

.stock-unit {
  font-size: 0.6875rem;
  color: #9ca3af;
}

.product-stock.ok .stock-value {
  color: #059669;
}

.product-stock.warn .stock-value {
  color: #d97706;
}

.product-stock.zero .stock-value {
  color: #dc2626;
}

/* 详情空状态 */
.detail-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #9ca3af;
}

.detail-placeholder p {
  margin-top: 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
}

.detail-placeholder span {
  margin-top: 0.25rem;
  font-size: 0.875rem;
}

.empty-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #9ca3af;
}

.empty-detail p {
  margin-top: 1rem;
  font-size: 0.875rem;
}

/* 过渡动画 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 响应式 */
@media (max-width: 1200px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .detail-panel {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .warehouse-page {
    padding: 1rem;
  }

  .warehouse-map {
    grid-template-columns: repeat(2, 1fr);
  }

  .product-card {
    grid-template-columns: 1fr;
  }

  .product-stock {
    flex-direction: row;
    align-items: baseline;
    gap: 0.25rem;
  }
}
</style>
