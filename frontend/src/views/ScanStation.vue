<template>
  <div class="scan-container">
    <!-- 顶部状态栏 -->
    <div class="scan-header">
      <h1 class="scan-title">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m10 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        扫码出入库
      </h1>
      <div class="camera-toggle">
        <button
          v-if="!isScanning"
          class="btn-scan-start"
          @click="startScanner"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          打开摄像头
        </button>
        <button
          v-else
          class="btn-scan-stop"
          @click="stopScanner"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          关闭
        </button>
      </div>
    </div>

    <!-- 扫码区域 -->
    <div class="scanner-section">
      <div id="qr-reader" class="qr-reader" :class="{ active: isScanning }"></div>

      <!-- 扫码提示 -->
      <div v-if="!isScanning && !scannedProduct" class="scan-placeholder">
        <div class="placeholder-icon">
          <svg class="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m10 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <p class="placeholder-text">点击上方按钮打开摄像头</p>
        <p class="placeholder-hint">对准商品条码或二维码进行扫描</p>
      </div>

      <!-- 扫描中动画 -->
      <div v-if="isScanning && !scannedProduct" class="scan-overlay">
        <div class="scan-frame">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>
        </div>
        <div class="scan-line-animate"></div>
      </div>
    </div>

    <!-- 手动输入区域 -->
    <div class="manual-input-section">
      <div class="input-row">
        <input
          v-model="manualSku"
          type="text"
          class="manual-input"
          placeholder="或手动输入 SKU 编号"
          @keyup.enter="searchBySku"
        />
        <button class="btn-search" @click="searchBySku">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 商品信息大卡片 -->
    <Transition name="slide-up">
      <div v-if="scannedProduct" class="product-card">
        <!-- 卡片头部 -->
        <div class="card-header">
          <div class="product-info">
            <div class="product-name">{{ scannedProduct.name }}</div>
            <div v-if="getAttrText(scannedProduct)" class="product-specs-text">
              {{ getAttrText(scannedProduct) }}
            </div>
          </div>
          <button class="btn-close" @click="clearProduct">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 关键信息 -->
        <div class="card-stats">
          <div class="stat-item">
            <span class="stat-label">当前库存</span>
            <span class="stat-value" :class="getStockClass(scannedProduct)">
              {{ scannedProduct.current_stock }}
              <small>{{ scannedProduct.unit }}</small>
            </span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">库位</span>
            <span class="stat-value location">{{ scannedProduct.location_code || '未设置' }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">单价</span>
            <span class="stat-value price">{{ formatPrice(scannedProduct.cost_price) }}</span>
          </div>
        </div>

        <!-- SKU 展示 -->
        <div class="card-sku">
          <span class="sku-label">SKU</span>
          <span class="sku-code">{{ scannedProduct.sku_code }}</span>
        </div>

        <!-- 数量操作 -->
        <div class="quantity-section">
          <div class="quantity-input">
            <button class="qty-btn minus" @click="decreaseQty">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4" />
              </svg>
            </button>
            <input
              v-model.number="operationQty"
              type="number"
              class="qty-value"
              min="1"
            />
            <button class="qty-btn plus" @click="increaseQty">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div class="preview-text">
            操作后库存：<span :class="getPreviewClass()">{{ getPreviewStock() }}</span>
          </div>
        </div>

        <!-- 快捷入库出库按钮 -->
        <div class="operation-buttons">
          <button
            class="btn-operation in"
            :disabled="isOperating"
            @click="doOperation('in')"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span class="btn-label">快捷入库</span>
            <span class="btn-hint">+{{ operationQty }}</span>
          </button>
          <button
            class="btn-operation out"
            :disabled="isOperating || operationQty > scannedProduct.current_stock"
            @click="doOperation('out')"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8V4m0 0L13 8m4 4l4-4m-9 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span class="btn-label">快捷出库</span>
            <span class="btn-hint">-{{ operationQty }}</span>
          </button>
        </div>

        <!-- 备注输入 -->
        <div class="note-section">
          <input
            v-model="operationNote"
            type="text"
            class="note-input"
            placeholder="添加备注（选填）"
          />
        </div>
      </div>
    </Transition>

    <!-- 操作成功反馈 -->
    <Transition name="success-pop">
      <div v-if="showSuccess" class="success-overlay">
        <div class="success-content">
          <div class="success-icon">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="success-text">{{ successMessage }}</div>
          <div class="success-stock">{{ successStock }}</div>
        </div>
      </div>
    </Transition>

    <!-- Toast 提示 -->
    <Transition name="fade">
      <div v-if="toast.show" class="toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { inventoryApi } from '@/api/index.js'

const html5QrCode = ref(null)
const isScanning = ref(false)
const scannedProduct = ref(null)
const manualSku = ref('')
const operationQty = ref(1)
const operationNote = ref('')
const isOperating = ref(false)

// 成功反馈
const showSuccess = ref(false)
const successMessage = ref('')
const successStock = ref('')

const toast = ref({
  show: false,
  message: '',
  type: 'success'
})

// 音频反馈
const audioContext = ref(null)

function playSuccessSound() {
  try {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioContext.value
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
    oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
    oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2) // G5

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.4)
  } catch (e) {
    console.warn('Audio not supported:', e)
  }
}

function playErrorSound() {
  try {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioContext.value
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(200, ctx.currentTime)
    oscillator.frequency.setValueAtTime(150, ctx.currentTime + 0.15)

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.3)
  } catch (e) {
    console.warn('Audio not supported:', e)
  }
}

function formatPrice(val) {
  if (!val && val !== 0) return '—'
  return '¥' + Number(val).toFixed(2)
}

function getStockClass(product) {
  if (product.current_stock === 0) return 'zero'
  if (product.current_stock <= product.min_stock) return 'warn'
  return 'ok'
}

// 获取规格属性文本（中圆点拼接）
function getAttrText(product) {
  if (!product.attributes || typeof product.attributes !== 'object') return ''
  const values = Object.values(product.attributes)
    .filter(v => v && String(v).trim())
  return values.join(' · ')
}

function getPreviewClass() {
  if (!scannedProduct.value) return ''
  const preview = scannedProduct.value.current_stock + operationQty.value
  if (preview === 0) return 'zero'
  if (preview <= scannedProduct.value.min_stock) return 'warn'
  return 'ok'
}

function getPreviewStock() {
  if (!scannedProduct.value) return ''
  const preview = scannedProduct.value.current_stock + operationQty.value
  return preview + ' ' + scannedProduct.value.unit
}

async function startScanner() {
  try {
    html5QrCode.value = new Html5Qrcode('qr-reader')

    await html5QrCode.value.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 }
      },
      onScanSuccess,
      onScanFailure
    )

    isScanning.value = true
  } catch (err) {
    console.error('无法启动摄像头:', err)
    showToast('无法访问摄像头，请检查权限设置', 'error')
  }
}

async function stopScanner() {
  if (html5QrCode.value && isScanning.value) {
    try {
      await html5QrCode.value.stop()
      isScanning.value = false
    } catch (err) {
      console.error('停止摄像头失败:', err)
    }
  }
}

function onScanSuccess(decodedText) {
  searchProduct(decodedText)
}

function onScanFailure(error) {
  // 忽略扫描失败
}

async function searchBySku() {
  if (!manualSku.value.trim()) return
  await searchProduct(manualSku.value.trim())
  manualSku.value = ''
}

async function searchProduct(sku) {
  try {
    const response = await fetch(`/api/products/sku/${encodeURIComponent(sku)}`)
    const data = await response.json()

    if (data.success) {
      scannedProduct.value = data.data
      operationQty.value = 1
      operationNote.value = ''
      await stopScanner()
      playSuccessSound()
    } else {
      showToast(data.message || '未找到该商品', 'error')
      playErrorSound()
    }
  } catch (err) {
    showToast('查询失败: ' + err.message, 'error')
    playErrorSound()
  }
}

function clearProduct() {
  scannedProduct.value = null
  operationQty.value = 1
  operationNote.value = ''
}

function increaseQty() {
  operationQty.value++
}

function decreaseQty() {
  if (operationQty.value > 1) {
    operationQty.value--
  }
}

async function doOperation(type) {
  if (!scannedProduct.value || isOperating.value) return

  isOperating.value = true
  try {
    const payload = {
      product_id: scannedProduct.value.id,
      quantity: operationQty.value,
      note: operationNote.value.trim(),
      operator: 'scan_station'
    }

    let newStock
    if (type === 'in') {
      await inventoryApi.in(payload)
      newStock = scannedProduct.value.current_stock + operationQty.value
      successMessage.value = `入库成功 +${operationQty.value}`
    } else {
      await inventoryApi.out(payload)
      newStock = scannedProduct.value.current_stock - operationQty.value
      successMessage.value = `出库成功 -${operationQty.value}`
    }

    // 显示成功反馈
    successStock.value = `当前库存：${newStock} ${scannedProduct.value.unit}`
    showSuccess.value = true
    playSuccessSound()

    // 更新本地数据
    scannedProduct.value.current_stock = newStock
    operationQty.value = 1
    operationNote.value = ''

    // 2秒后隐藏成功反馈并清除
    setTimeout(() => {
      showSuccess.value = false
      setTimeout(() => {
        clearProduct()
      }, 300)
    }, 1500)
  } catch (err) {
    showToast(err.message, 'error')
    playErrorSound()
  } finally {
    isOperating.value = false
  }
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 2500)
}

onMounted(() => {
  startScanner()
})

onUnmounted(() => {
  stopScanner()
})
</script>

<style scoped>
.scan-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  padding: 1rem;
  color: white;
  position: relative;
}

/* 顶部状态栏 */
.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  margin-bottom: 1rem;
}

.scan-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.scan-title svg {
  color: #60a5fa;
}

.camera-toggle {
  display: flex;
  gap: 0.5rem;
}

.btn-scan-start,
.btn-scan-stop {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-scan-start {
  background: #3b82f6;
  color: white;
}

.btn-scan-start:hover {
  background: #2563eb;
}

.btn-scan-stop {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn-scan-stop:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 扫码区域 */
.scanner-section {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #0a0a0f;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.qr-reader {
  width: 100%;
  height: 100%;
  display: none;
}

.qr-reader.active {
  display: block;
}

.qr-reader video {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  border-radius: 16px;
}

/* 扫码占位符 */
.scan-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.placeholder-text {
  font-size: 1.125rem;
  font-weight: 600;
  margin-top: 1rem;
}

.placeholder-hint {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

/* 扫描框动画 */
.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-frame {
  width: 200px;
  height: 200px;
  position: relative;
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border-color: #3b82f6;
  border-style: solid;
}

.corner.top-left {
  top: 0;
  left: 0;
  border-width: 4px 0 0 4px;
  border-radius: 8px 0 0 0;
}

.corner.top-right {
  top: 0;
  right: 0;
  border-width: 4px 4px 0 0;
  border-radius: 0 8px 0 0;
}

.corner.bottom-left {
  bottom: 0;
  left: 0;
  border-width: 0 0 4px 4px;
  border-radius: 0 0 0 8px;
}

.corner.bottom-right {
  bottom: 0;
  right: 0;
  border-width: 0 4px 4px 0;
  border-radius: 0 0 8px 0;
}

.scan-line-animate {
  position: absolute;
  left: 15%;
  right: 15%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  animation: scan 2s ease-in-out infinite;
  box-shadow: 0 0 15px #3b82f6;
}

@keyframes scan {
  0%, 100% { top: 25%; }
  50% { top: 65%; }
}

/* 手动输入 */
.manual-input-section {
  margin-bottom: 1rem;
}

.input-row {
  display: flex;
  gap: 0.5rem;
}

.manual-input {
  flex: 1;
  height: 3rem;
  padding: 0 1rem;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.manual-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.manual-input:focus {
  border-color: #3b82f6;
}

.btn-search {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  border: none;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-search:hover {
  background: #2563eb;
}

/* 商品卡片 */
.product-card {
  background: white;
  border-radius: 20px;
  color: #1a1a2e;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  color: white;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 0.5rem;
}

.product-specs-text {
  font-size: 0.9375rem;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  display: inline-block;
}

.btn-close {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 统计区域 */
.card-stats {
  display: flex;
  justify-content: space-around;
  padding: 1.25rem;
  background: #f9fafb;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-value small {
  font-size: 0.875rem;
  font-weight: 400;
  margin-left: 0.25rem;
}

.stat-value.ok {
  color: #059669;
}

.stat-value.warn {
  color: #d97706;
}

.stat-value.zero {
  color: #dc2626;
}

.stat-value.location {
  font-family: monospace;
  font-size: 1.125rem;
  color: #374151;
}

.stat-value.price {
  font-size: 1.125rem;
  color: #059669;
}

.stat-divider {
  width: 1px;
  background: #e5e7eb;
}

/* SKU 区域 */
.card-sku {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.875rem;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.sku-label {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
}

.sku-code {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
}

/* 数量操作 */
.quantity-section {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: white;
}

.quantity-input {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.qty-btn {
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.qty-btn.minus {
  background: #fef2f2;
  color: #dc2626;
}

.qty-btn.minus:hover {
  background: #fee2e2;
  transform: scale(1.05);
}

.qty-btn.plus {
  background: #f0fdf4;
  color: #059669;
}

.qty-btn.plus:hover {
  background: #dcfce7;
  transform: scale(1.05);
}

.qty-value {
  width: 4rem;
  height: 3.5rem;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  outline: none;
  color: #1a1a2e;
}

.qty-value:focus {
  border-color: #3b82f6;
}

.preview-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.preview-text .ok {
  color: #059669;
  font-weight: 600;
}

.preview-text .warn {
  color: #d97706;
  font-weight: 600;
}

.preview-text .zero {
  color: #dc2626;
  font-weight: 600;
}

/* 操作按钮 */
.operation-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 0 1.25rem 1.25rem;
}

.btn-operation {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 1.25rem;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-operation:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.btn-operation.in {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.btn-operation.in:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 8px 20px rgba(34, 197, 94, 0.4);
}

.btn-operation.out {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.btn-operation.out:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
}

.btn-operation .btn-label {
  font-size: 1.125rem;
  font-weight: 700;
}

.btn-operation .btn-hint {
  font-size: 0.875rem;
  opacity: 0.9;
}

/* 备注 */
.note-section {
  padding: 0 1.25rem 1.25rem;
}

.note-input {
  width: 100%;
  height: 2.75rem;
  padding: 0 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.2s;
}

.note-input:focus {
  border-color: #3b82f6;
}

/* 成功反馈 */
.success-overlay {
  position: fixed;
  inset: 0;
  background: rgba(34, 197, 94, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.success-content {
  text-align: center;
  color: white;
}

.success-icon {
  margin-bottom: 1rem;
  animation: success-pop 0.5s ease-out;
}

.success-text {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.success-stock {
  font-size: 1.25rem;
  opacity: 0.9;
}

@keyframes success-pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Toast */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.875rem 1.5rem;
  border-radius: 12px;
  font-size: 0.9375rem;
  font-weight: 500;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.toast.success {
  background: #059669;
  color: white;
}

.toast.error {
  background: #dc2626;
  color: white;
}

/* 过渡动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.success-pop-enter-active {
  transition: all 0.3s ease;
}

.success-pop-leave-active {
  transition: all 0.3s ease;
}

.success-pop-enter-from,
.success-pop-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 480px) {
  .scan-container {
    padding: 0.75rem;
  }

  .scanner-section {
    aspect-ratio: 1/1;
  }

  .product-name {
    font-size: 1.125rem;
  }

  .stat-value {
    font-size: 1.25rem;
  }

  .btn-operation {
    padding: 1rem;
  }

  .btn-operation .btn-label {
    font-size: 1rem;
  }
}
</style>
