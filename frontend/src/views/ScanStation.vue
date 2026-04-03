<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { getProductBySku } from '../api/products.js'
import { batchStockIn, batchStockOut } from '../api/inventory.js'

// 从父组件获取主题状态
const isDark = inject('isDark', ref(true))

// 扫码模式
const scanMode = ref('out') // 'out' 批量出库, 'in' 批量入库

// 扫码列表
const scannedItems = ref([])

// 摄像头状态
const scannerRunning = ref(false)
const scannerError = ref('')
const cameraPermission = ref('prompt') // 'prompt', 'granted', 'denied'

// 提交状态
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

// 音效（使用 Web Audio API 生成短促的"滴"声）
let audioContext = null
function playBeep() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 1200
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  } catch (e) {
    console.warn('播放音效失败:', e)
  }
}

// 错误音效
function playErrorBeep() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 400
    oscillator.type = 'square'
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (e) {
    console.warn('播放音效失败:', e)
  }
}

// 防抖相关
const lastScannedSku = ref('')
const lastScanTime = ref(0)
const SCAN_COOLDOWN = 1500 // 1.5秒防抖

// 摄像头实例
let html5QrCode = null

// 初始化摄像头
async function initScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
    } catch (e) {}
  }
  
  scannerError.value = ''
  scannerRunning.value = false
  
  try {
    html5QrCode = new Html5Qrcode('qr-reader')
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1,
      disableFlip: false
    }
    
    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      onScanFailure
    )
    
    scannerRunning.value = true
    cameraPermission.value = 'granted'
  } catch (err) {
    console.error('摄像头启动失败:', err)
    scannerError.value = '无法访问摄像头，请确保已授权摄像头权限'
    cameraPermission.value = 'denied'
  }
}

// 停止摄像头
async function stopScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
    } catch (e) {}
    html5QrCode = null
  }
  scannerRunning.value = false
}

// 扫码成功回调
async function onScanSuccess(decodedText) {
  const now = Date.now()
  
  // 1.5秒防抖：同一个 SKU 不能在1.5秒内重复扫描
  if (decodedText === lastScannedSku.value && now - lastScanTime.value < SCAN_COOLDOWN) {
    return
  }
  
  lastScannedSku.value = decodedText
  lastScanTime.value = now
  
  // 查找是否已在列表中
  const existingIndex = scannedItems.value.findIndex(item => item.sku_code === decodedText)
  
  if (existingIndex >= 0) {
    // 已在列表中，数量 +1
    scannedItems.value[existingIndex].quantity += 1
    playBeep()
  } else {
    // 不在列表中，查询商品信息
    try {
      const res = await getProductBySku(decodedText)
      if (res.data.success) {
        const product = res.data.data
        scannedItems.value.push({
          id: product.id,
          sku_code: product.sku_code,
          name: product.name,
          current_stock: product.current_stock,
          quantity: 1,
          scanned_at: new Date().toISOString(),
          mode: scanMode.value
        })
        playBeep()
      } else {
        playErrorBeep()
        alert(`未找到商品: ${decodedText}`)
      }
    } catch (e) {
      playErrorBeep()
      console.error('查询商品失败:', e)
      alert('查询商品信息失败')
    }
  }
}

// 扫码失败回调
function onScanFailure(error) {
  // 忽略连续扫描失败，不做处理
}

// 移除某个扫描项
function removeItem(index) {
  scannedItems.value.splice(index, 1)
}

// 清空列表
function clearList() {
  if (scannedItems.value.length > 0) {
    if (confirm(`确定清空已扫描的 ${scannedItems.value.length} 件商品？`)) {
      scannedItems.value = []
    }
  }
}

// 切换模式
function switchMode(mode) {
  if (scanMode.value === mode) return
  
  if (scannedItems.value.length > 0) {
    if (!confirm('切换模式将清空当前列表，是否继续？')) {
      return
    }
  }
  
  scanMode.value = mode
  scannedItems.value = []
}

// 提交批量操作
async function handleSubmit() {
  if (scannedItems.value.length === 0) {
    alert('请先扫描商品')
    return
  }
  
  submitting.value = true
  submitError.value = ''
  
  const items = scannedItems.value.map(item => ({
    product_id: item.id,
    quantity: item.quantity,
    note: `${scanMode.value === 'out' ? '批量出库' : '批量入库'}扫码`
  }))
  
  try {
    const apiFn = scanMode.value === 'out' ? batchStockOut : batchStockIn
    const res = await apiFn({ items })
    
    if (res.data.success) {
      submitSuccess.value = true
      setTimeout(() => {
        submitSuccess.value = false
      }, 2000)
      
      // 清空列表
      scannedItems.value = []
    } else {
      // 处理错误信息
      if (res.data.stockErrors) {
        const errorMsg = res.data.stockErrors
          .map(e => `${e.product_name || e.product_id}: ${e.error}`)
          .join('\n')
        submitError.value = errorMsg
        alert(`库存不足:\n${errorMsg}`)
      } else {
        submitError.value = res.data.error || '提交失败'
        alert(submitError.value)
      }
    }
  } catch (e) {
    console.error('提交失败:', e)
    submitError.value = '网络错误，请重试'
    alert('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 计算统计信息
const totalCount = computed(() => {
  return scannedItems.value.reduce((sum, item) => sum + item.quantity, 0)
})

const submitButtonText = computed(() => {
  const action = scanMode.value === 'out' ? '出库' : '入库'
  return `确认${action}（共 ${totalCount.value} 件）`
})

// 格式化时间
function formatTime(isoString) {
  const d = new Date(isoString)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

// 生命周期
onMounted(() => {
  nextTick(() => {
    initScanner()
  })
})

onUnmounted(() => {
  stopScanner()
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" :data-theme="isDark ? 'dark' : 'light'">
    <!-- 页面头部 -->
    <header class="flex items-center justify-between px-8 py-5 border-b border-[var(--border-default)] flex-shrink-0 bg-[var(--bg-secondary)]">
      <div>
        <h2 class="text-lg font-semibold text-[var(--text-primary)]">扫码工作站</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5">批量扫描商品条码进行出入库</p>
      </div>
    </header>

    <!-- 模式切换 Tab -->
    <div class="flex-shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
      <div class="flex">
        <button
          @click="switchMode('out')"
          :class="[
            'flex-1 py-4 text-base font-semibold transition-all duration-200',
            scanMode === 'out' 
              ? 'bg-red-600 text-white border-b-4 border-red-400' 
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)] border-b-4 border-transparent'
          ]"
        >
          批量出库
        </button>
        <button
          @click="switchMode('in')"
          :class="[
            'flex-1 py-4 text-base font-semibold transition-all duration-200',
            scanMode === 'in' 
              ? 'bg-emerald-600 text-white border-b-4 border-emerald-400' 
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)] border-b-4 border-transparent'
          ]"
        >
          批量入库
        </button>
      </div>
    </div>

    <!-- 扫描区域 -->
    <div class="flex-shrink-0 relative bg-black">
      <!-- 摄像头区域 -->
      <div class="relative w-full" style="height: 40vh; min-height: 240px;">
        <div id="qr-reader" class="absolute inset-0"></div>
        
        <!-- 扫描框装饰 -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-48 h-48 relative">
            <!-- 四角装饰 -->
            <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></div>
            <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></div>
            <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></div>
          </div>
        </div>
        
        <!-- 状态提示 -->
        <div v-if="!scannerRunning" class="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]/90">
          <div class="text-5xl mb-3 text-[var(--text-muted)]">📷</div>
          <div class="text-sm text-[var(--text-muted)]">{{ scannerError || '正在启动摄像头...' }}</div>
          <button 
            v-if="scannerError"
            @click="initScanner"
            class="mt-4 px-6 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium"
          >
            重试
          </button>
        </div>
        
        <!-- 扫描中提示 -->
        <div v-else class="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-cyan-600/90 rounded-full text-xs font-medium text-white">
          持续扫描中...
        </div>
      </div>
    </div>

    <!-- 底部列表区域 -->
    <div class="flex-1 flex flex-col overflow-hidden bg-[var(--bg-tertiary)]">
      <!-- 列表头部 -->
      <div class="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-[var(--text-primary)]">已扫描商品</span>
          <span class="px-2 py-0.5 bg-[var(--accent)] text-white text-xs rounded-full">
            {{ scannedItems.length }}
          </span>
        </div>
        <button 
          v-if="scannedItems.length > 0"
          @click="clearList"
          class="px-3 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded transition-colors"
        >
          清空
        </button>
      </div>

      <!-- 商品列表 -->
      <div class="flex-1 overflow-auto">
        <!-- 空状态 -->
        <div v-if="scannedItems.length === 0" class="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
          <div class="text-4xl mb-2">📦</div>
          <div class="text-sm">扫描商品条码开始</div>
        </div>

        <!-- 列表项 -->
        <div v-else class="divide-y divide-[var(--border-default)]">
          <div 
            v-for="(item, index) in scannedItems" 
            :key="item.sku_code"
            class="relative flex items-center px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            <!-- 数量调整 -->
            <div 
              class="flex flex-col items-center justify-center w-14 h-14 rounded-xl mr-3 flex-shrink-0"
              :class="scanMode === 'out' ? 'bg-red-500/20' : 'bg-emerald-500/20'"
            >
              <span class="text-lg font-bold" :class="scanMode === 'out' ? 'text-red-500' : 'text-emerald-500'">
                {{ scanMode === 'out' ? '-' : '+' }}{{ item.quantity }}
              </span>
            </div>

            <!-- 商品信息 -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-[var(--text-primary)] truncate">{{ item.name }}</div>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-[var(--text-muted)] font-mono">{{ item.sku_code }}</span>
                <span class="text-xs text-[var(--text-muted)]">|</span>
                <span class="text-xs text-[var(--text-muted)]">库存: {{ item.current_stock }}</span>
              </div>
              <div class="text-xs text-[var(--text-muted)] mt-0.5">
                {{ formatTime(item.scanned_at) }}
              </div>
            </div>

            <!-- 删除按钮 -->
            <button 
              @click="removeItem(index)"
              class="flex-shrink-0 w-10 h-10 flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 底部统计栏 -->
      <div class="flex-shrink-0 bg-[var(--bg-secondary)] border-t-2 border-[var(--border-default)] p-4">
        <!-- 成功提示 -->
        <div v-if="submitSuccess" class="mb-3 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-center">
          <span class="text-emerald-500 font-medium">提交成功！</span>
        </div>

        <!-- 错误提示 -->
        <div v-if="submitError" class="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-500 max-h-20 overflow-auto">
          {{ submitError }}
        </div>

        <!-- 提交按钮 -->
        <button
          @click="handleSubmit"
          :disabled="submitting || scannedItems.length === 0"
          :class="[
            'w-full py-4 rounded-xl text-lg font-bold transition-all duration-200 active:scale-[0.98]',
            scanMode === 'out'
              ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 text-white'
              : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/30 text-white',
            submitting ? 'opacity-70' : ''
          ]"
        >
          <span v-if="submitting" class="flex items-center justify-center gap-2">
            <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            处理中...
          </span>
          <span v-else>{{ submitButtonText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* html5-qrcode 默认样式覆盖 */
#qr-reader {
  width: 100% !important;
  height: 100% !important;
}

#qr-reader video {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

#qr-reader__scan_region {
  background: transparent !important;
}

#qr-reader__dashboard {
  display: none !important;
}

/* 安全区域适配 */
.safe-area-bottom {
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

/* 隐藏滚动条但保持功能 */
.overflow-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}
</style>
