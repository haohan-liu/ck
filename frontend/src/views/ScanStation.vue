<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { getProductBySku } from '../api/products.js'
import { batchStockIn, batchStockOut } from '../api/inventory.js'
import { scanStockOut } from '../api/shipping.js'

// 从父组件获取主题状态
const isDark = inject('isDark', ref(true))

// ═══════════════════════════════════════════════════════════
// 扫码模式
// ═══════════════════════════════════════════════════════════
const scanMode = ref('out') // 'out' 批量出库, 'in' 批量入库

// ═══════════════════════════════════════════════════════════
// 扫描列表
// ═══════════════════════════════════════════════════════════
const scannedItems = ref([])

// ═══════════════════════════════════════════════════════════
// 运单号（仅出库模式可选填）
// ═══════════════════════════════════════════════════════════
const trackingNumber = ref('')
const showTrackingScan = ref(false)
let trackingScanner = null
const trackingScanError = ref('')

// ═══════════════════════════════════════════════════════════
// 摄像头状态
// ═══════════════════════════════════════════════════════════
const scannerRunning = ref(false)
const scannerError = ref('')
const cameraPermission = ref('prompt')
let html5QrCode = null
let isInitializing = false
let visibilityHandler = null

// ═══════════════════════════════════════════════════════════
// 提交状态
// ═══════════════════════════════════════════════════════════
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

// ═══════════════════════════════════════════════════════════
// 音效
// ═══════════════════════════════════════════════════════════
let audioContext = null
function playBeep() {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)()
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
  } catch (e) { /* silent */ }
}

function playErrorBeep() {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)()
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
  } catch (e) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════
// 防抖
// ═══════════════════════════════════════════════════════════
const lastScannedSku = ref('')
const lastScanTime = ref(0)
const SCAN_COOLDOWN = 1500

// ═══════════════════════════════════════════════════════════
// 摄像头生命周期
// ═══════════════════════════════════════════════════════════

async function safeStopCamera() {
  if (!html5QrCode) return
  try {
    if (scannerRunning.value) { await html5QrCode.stop() }
  } catch (e) { /* ignore */ }
  try {
    html5QrCode.clear()
  } catch (e) { /* ignore */ }
  html5QrCode = null
  scannerRunning.value = false
}

function handleVisibilityChange() {
  if (document.hidden) {
    safeStopCamera()
  } else {
    setTimeout(() => { initScanner() }, 300)
  }
}

async function initScanner() {
  if (isInitializing) return
  if (scannerRunning.value && html5QrCode) return

  isInitializing = true
  await safeStopCamera()

  scannerError.value = ''
  cameraPermission.value = 'prompt'

  try {
    html5QrCode = new Html5Qrcode('qr-reader')
    const config = {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1,
      disableFlip: false,
      rememberLastUsedCamera: true,
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
    console.warn('[ScanStation] 摄像头启动失败:', err)
    if (String(err).includes('Permission')) {
      scannerError.value = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问'
      cameraPermission.value = 'denied'
    } else if (String(err).includes('NotFoundError') || String(err).includes('no cameras')) {
      scannerError.value = '未检测到可用摄像头'
      cameraPermission.value = 'denied'
    } else {
      scannerError.value = '摄像头启动失败，请重试'
    }
  } finally {
    isInitializing = false
  }
}

// ═══════════════════════════════════════════════════════════
// 运单号扫码弹窗
// ═══════════════════════════════════════════════════════════
async function openTrackingScan() {
  showTrackingScan.value = true
  trackingScanError.value = ''
  await nextTick()
  setTimeout(async () => {
    try {
      trackingScanner = new Html5Qrcode('tracking-reader')
      const config = { fps: 10, qrbox: { width: 200, height: 100 }, aspectRatio: 1.5, disableFlip: false }
      await trackingScanner.start(
        { facingMode: 'environment' },
        config,
        (text) => {
          trackingNumber.value = text.trim()
          closeTrackingScan()
        },
        () => {}
      )
    } catch (e) {
      trackingScanError.value = '无法启动摄像头，请手动输入'
    }
  }, 200)
}

async function closeTrackingScan() {
  showTrackingScan.value = false
  if (trackingScanner) {
    try { await trackingScanner.stop() } catch (e) {}
    try { trackingScanner.clear() } catch (e) {}
    trackingScanner = null
  }
}

// ═══════════════════════════════════════════════════════════
// 扫码成功回调
// ═══════════════════════════════════════════════════════════
async function onScanSuccess(decodedText) {
  const now = Date.now()
  if (decodedText === lastScannedSku.value && now - lastScanTime.value < SCAN_COOLDOWN) return
  lastScannedSku.value = decodedText
  lastScanTime.value = now

  const existingIndex = scannedItems.value.findIndex(item => item.sku_code === decodedText)
  if (existingIndex >= 0) {
    scannedItems.value[existingIndex].quantity += 1
    playBeep()
  } else {
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
        })
        playBeep()
      } else {
        playErrorBeep()
        alert(`未找到商品: ${decodedText}`)
      }
    } catch (e) {
      playErrorBeep()
      alert('查询商品信息失败')
    }
  }
}

function onScanFailure(error) {
  // 忽略扫描失败回调
}

// ═══════════════════════════════════════════════════════════
// 列表操作
// ═══════════════════════════════════════════════════════════
function removeItem(index) { scannedItems.value.splice(index, 1) }

function clearList() {
  if (scannedItems.value.length > 0 && confirm(`确定清空已扫描的 ${scannedItems.value.length} 件商品？`)) {
    scannedItems.value = []
  }
}

// ═══════════════════════════════════════════════════════════
// 切换模式
// ═══════════════════════════════════════════════════════════
async function switchMode(mode) {
  if (scanMode.value === mode) return
  if (scannedItems.value.length > 0) {
    if (!confirm('切换模式将清空当前列表，是否继续？')) return
  }
  scanMode.value = mode
  scannedItems.value = []
  trackingNumber.value = ''
  await safeStopCamera()
  await nextTick()
  setTimeout(() => { initScanner() }, 100)
}

// ═══════════════════════════════════════════════════════════
// 提交批量操作
// ═══════════════════════════════════════════════════════════
async function handleSubmit() {
  if (scannedItems.value.length === 0) { alert('请先扫描商品'); return }

  submitting.value = true
  submitError.value = ''

  const items = scannedItems.value.map(item => ({
    product_id: item.id,
    quantity: item.quantity,
    note: `${scanMode.value === 'out' ? '批量出库' : '批量入库'}扫码`,
  }))

  try {
    let res
    if (scanMode.value === 'out') {
      if (trackingNumber.value.trim()) {
        res = await scanStockOut({ items, tracking_number: trackingNumber.value.trim() })
      } else {
        res = await batchStockOut({ items })
      }
    } else {
      res = await batchStockIn({ items })
    }

    if (res.data.success) {
      submitSuccess.value = true
      setTimeout(() => { submitSuccess.value = false }, 3000)
      scannedItems.value = []
      if (scanMode.value === 'out') trackingNumber.value = ''
    } else {
      if (res.data.stockErrors) {
        const errorMsg = res.data.stockErrors.map(e => `${e.product_name || e.product_id}: ${e.error}`).join('\n')
        submitError.value = errorMsg
      } else {
        submitError.value = res.data.error || '提交失败'
      }
    }
  } catch (e) {
    console.error('提交失败:', e)
    submitError.value = '网络错误，请重试'
  } finally {
    submitting.value = false
  }
}

// ═══════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════
const totalCount = computed(() => scannedItems.value.reduce((sum, item) => sum + item.quantity, 0))
const submitButtonText = computed(() => {
  const action = scanMode.value === 'out' ? '出库' : '入库'
  return `确认${action}（共 ${totalCount.value} 件）`
})

function formatTime(isoString) {
  const d = new Date(isoString)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════
// 生命周期
// ═══════════════════════════════════════════════════════════
onMounted(async () => {
  visibilityHandler = handleVisibilityChange
  document.addEventListener('visibilitychange', visibilityHandler)
  await nextTick()
  setTimeout(() => { initScanner() }, 200)
})

onUnmounted(async () => {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  await closeTrackingScan()
  await safeStopCamera()
})
</script>

<template>
  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- PC端：Grid 网格布局 (≥1024px)                           -->
  <!-- 移动端：沉浸式上下布局 (<1024px)                        -->
  <!-- ═══════════════════════════════════════════════════════════════ -->
  <div class="h-full overflow-hidden">

    <!-- PC端：Grid 布局 -->
    <div class="hidden lg:grid lg:grid-cols-12 lg:gap-6 lg:p-6 lg:h-full lg:content-start">

      <!-- ════ 左侧：扫描器卡片 (col-span-5) ════ -->
      <div
        class="col-span-5 rounded-xl overflow-hidden
               bg-white dark:bg-slate-900
               border border-slate-100 dark:border-white/5
               shadow-sm
               flex flex-col"
        :style="{ minHeight: '580px' }"
      >
        <!-- 扫描器标题栏 -->
        <div class="px-6 pt-6 pb-4 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">扫码工作站</h2>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">对准商品条码，摄像头将自动识别</p>
            </div>
            <!-- 重连按钮 -->
            <button
              v-if="!scannerRunning && !scannerError"
              @click="initScanner"
              class="px-3 py-1.5 rounded-xl text-xs font-medium
                     bg-indigo-600 hover:bg-indigo-700 text-white
                     shadow-md shadow-indigo-500/20
                     active:scale-95 transition-all duration-200 cursor-pointer"
            >
              重连摄像头
            </button>
          </div>

          <!-- 模式切换 Tab -->
          <div class="flex mt-4 rounded-xl p-1 bg-slate-100 dark:bg-white/5">
            <button
              @click="switchMode('out')"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                     transition-all duration-200 cursor-pointer"
              :class="scanMode === 'out'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
              批量出库
            </button>
            <button
              @click="switchMode('in')"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                     transition-all duration-200 cursor-pointer"
              :class="scanMode === 'in'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
              批量入库
            </button>
          </div>
        </div>

        <!-- 摄像头区域 -->
        <div class="relative flex-1 min-h-0 overflow-hidden">
          <!-- 摄像头渲染层 -->
          <div id="qr-reader" class="absolute inset-0 !border-none !rounded-none"></div>

          <!-- 扫描框 UI 叠加层 -->
          <div
            v-if="scannerRunning"
            class="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              class="relative"
              :style="{ width: '200px', height: '200px' }"
            >
              <!-- 左上角 -->
              <div class="absolute top-0 left-0 w-10 h-10" :style="`border-top: 2.5px solid var(--accent); border-left: 2.5px solid var(--accent); border-radius: 6px 0 0 0; animation: corner-pulse 2s ease-in-out infinite; filter: drop-shadow(0 0 6px var(--accent));`"></div>
              <!-- 右上角 -->
              <div class="absolute top-0 right-0 w-10 h-10" :style="`border-top: 2.5px solid var(--accent); border-right: 2.5px solid var(--accent); border-radius: 0 6px 0 0; animation: corner-pulse 2s ease-in-out infinite 0.4s; filter: drop-shadow(0 0 6px var(--accent));`"></div>
              <!-- 左下角 -->
              <div class="absolute bottom-0 left-0 w-10 h-10" :style="`border-bottom: 2.5px solid var(--accent); border-left: 2.5px solid var(--accent); border-radius: 0 0 0 6px; animation: corner-pulse 2s ease-in-out infinite 0.8s; filter: drop-shadow(0 0 6px var(--accent));`"></div>
              <!-- 右下角 -->
              <div class="absolute bottom-0 right-0 w-10 h-10" :style="`border-bottom: 2.5px solid var(--accent); border-right: 2.5px solid var(--accent); border-radius: 0 0 6px 0; animation: corner-pulse 2s ease-in-out infinite 1.2s; filter: drop-shadow(0 0 6px var(--accent));`"></div>
              <!-- 扫描线 -->
              <div
                class="absolute left-2 right-2 h-0.5 rounded-full overflow-hidden"
                :style="`background: linear-gradient(90deg, transparent, var(--accent), transparent); box-shadow: 0 0 10px var(--scan-accent), 0 0 20px rgba(var(--scan-accent-rgb),0.4); animation: scan-line 2.5s ease-in-out infinite; top: 8px;`"
              ></div>
            </div>
          </div>

          <!-- 扫描中指示 -->
          <div
            v-if="scannerRunning"
            class="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            :style="{ background: 'rgba(var(--scan-accent-rgb), 0.88)', backdropFilter: 'blur(8px)', color: 'white', boxShadow: '0 0 12px rgba(var(--scan-accent-rgb), 0.3)' }"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            持续扫描中
          </div>

          <!-- 未启动占位 -->
          <div
            v-if="!scannerRunning"
            class="absolute inset-0 flex flex-col items-center justify-center"
            :style="{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)' }"
          >
            <div class="mb-5">
              <div class="w-16 h-16 rounded-xl flex items-center justify-center" style="background: var(--accent-bg); border: 1.5px solid var(--accent-border);">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
                </svg>
              </div>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center px-8 max-w-xs">{{ scannerError || '正在启动摄像头...' }}</p>
            <button
              v-if="scannerError"
              @click="initScanner"
              class="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                     bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20
                     active:scale-95 transition-all duration-200 cursor-pointer"
            >
              重新启动
            </button>
          </div>
        </div>
      </div>

      <!-- ════ 右侧：操作面板 (col-span-7) ════ -->
      <div class="col-span-7 flex flex-col gap-5">

        <!-- 运单号输入卡片 -->
        <div
          v-if="scanMode === 'out'"
          class="rounded-xl overflow-hidden
                 bg-white dark:bg-slate-900
                 border border-slate-100 dark:border-white/5
                 shadow-sm p-5"
        >
          <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            运单号
            <span class="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1.5">选填，绑定后可在日志中追溯</span>
          </label>
          <div class="flex gap-3">
            <input
              v-model="trackingNumber"
              type="text"
              placeholder="请输入或扫码运单号"
              class="flex-1 py-4 px-6 rounded-xl text-base font-medium
                     bg-slate-50 dark:bg-slate-800
                     border-2 border-transparent
                     text-slate-900 dark:text-white
                     placeholder-slate-400 dark:placeholder-slate-500
                     focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                     transition-all duration-200"
            />
            <button
              @click="openTrackingScan"
              class="w-14 h-14 rounded-xl flex items-center justify-center shrink-0
                     bg-indigo-600 hover:bg-indigo-700 text-white
                     shadow-md shadow-indigo-500/20
                     active:scale-95 transition-all duration-200 cursor-pointer"
              title="扫码填入运单号"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m9 11 5 5"/><path d="m14 11 5 5"/><path d="m14 11-5 5"/><path d="m9 16 5-5"/><rect x="6" y="6" width="4" height="4" rx="1"/>
              </svg>
            </button>
          </div>
          <p v-if="trackingNumber.trim()" class="mt-2.5 text-xs flex items-center gap-1.5" style="color: var(--info);">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            将绑定运单号出库，提交后可追溯
          </p>
        </div>

        <!-- 已扫描商品卡片 -->
        <div
          class="rounded-xl overflow-hidden
                 bg-white dark:bg-slate-900
                 border border-slate-100 dark:border-white/5
                 shadow-sm flex flex-col flex-1 min-h-0"
        >
          <!-- 卡片头部 -->
          <div class="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 flex-shrink-0">
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold text-slate-900 dark:text-white">已扫描商品</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                :style="scanMode === 'out'
                  ? 'background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 0 8px rgba(244,63,94,0.3);'
                  : 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 0 8px rgba(99,102,241,0.3);'"
              >{{ scannedItems.length }}</span>
            </div>
            <button
              v-if="scannedItems.length > 0"
              @click="clearList"
              class="px-3 py-1.5 rounded-xl text-xs font-medium
                     text-rose-500 bg-rose-50 dark:bg-rose-500/10
                     border border-rose-200 dark:border-rose-500/20
                     hover:bg-rose-100 dark:hover:bg-rose-500/20
                     active:scale-95 transition-all duration-200 cursor-pointer"
            >
              清空全部
            </button>
          </div>

          <!-- 列表内容 -->
          <div class="flex-1 overflow-auto min-h-0">

            <!-- 空状态 -->
            <div
              v-if="scannedItems.length === 0"
              class="flex flex-col items-center justify-center h-full py-16"
            >
              <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-bg); border: 1px solid var(--accent-border);">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
                  <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                </svg>
              </div>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">尚未扫描商品</p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">对准商品条码，摄像头将自动识别并添加到列表</p>
            </div>

            <!-- 列表项 -->
            <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
              <div
                v-for="(item, index) in scannedItems"
                :key="item.sku_code"
                class="flex items-center px-5 py-3.5
                       hover:bg-slate-50 dark:hover:bg-white/[0.03]
                       transition-colors duration-150"
              >
                <!-- 数量圆徽章 -->
                <div
                  class="w-12 h-12 rounded-xl flex flex-col items-center justify-center mr-4 shrink-0"
                  :style="scanMode === 'out'
                    ? 'background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.15);'
                    : 'background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.15);'"
                >
                  <span
                    class="text-base font-bold leading-none"
                    :style="scanMode === 'out' ? 'color: #f43f5e' : 'color: #6366f1'"
                  >{{ scanMode === 'out' ? '-' : '+' }}{{ item.quantity }}</span>
                </div>

                <!-- 商品信息 -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-900 dark:text-white truncate leading-snug">{{ item.name }}</p>
                  <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{{ item.sku_code }}</span>
                    <span class="text-xs text-slate-200 dark:text-slate-700">|</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">库存 {{ item.current_stock }}</span>
                    <span class="text-xs text-slate-200 dark:text-slate-700">|</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">{{ formatTime(item.scanned_at) }}</span>
                  </div>
                </div>

                <!-- 删除 -->
                <button
                  @click="removeItem(index)"
                  class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-3
                         text-slate-300 dark:text-slate-600
                         hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10
                         active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 底部提交区 -->
          <div class="px-5 py-4 border-t border-slate-100 dark:border-white/5 flex-shrink-0">

            <!-- 成功提示 -->
            <div
              v-if="submitSuccess"
              class="mb-3 p-3 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2 scale-in"
              :style="{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
              </svg>
              {{ scanMode === 'out' ? '出库' : '入库' }}成功！库存已更新
            </div>

            <!-- 错误提示 -->
            <div
              v-if="submitError"
              class="mb-3 p-3 rounded-xl text-xs max-h-20 overflow-auto"
              :style="{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)' }"
            >
              {{ submitError }}
            </div>

            <!-- 提交按钮 -->
            <button
              @click="handleSubmit"
              :disabled="submitting || scannedItems.length === 0"
              class="w-full py-4 rounded-xl text-sm font-bold text-white transition-all duration-200
                     active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
              :style="
                scannedItems.length === 0 || submitting
                  ? ''
                  : scanMode === 'out'
                    ? 'background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 4px 20px rgba(244,63,94,0.35);'
                    : 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 20px rgba(99,102,241,0.35);'
              "
            >
              <span v-if="submitting" class="flex items-center justify-center gap-2">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                处理中...
              </span>
              <span v-else>{{ submitButtonText }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 移动端：沉浸式上下布局 (<1024px)                       -->
    <!-- 上半部分：满屏扫描器                                    -->
    <!-- 下半部分：Bottom Sheet 悬浮卡片                        -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="flex flex-col lg:hidden h-full">

      <!-- 扫描器区域 — 占据上半部分 -->
      <div
        class="relative flex-shrink-0 overflow-hidden"
        :style="{ height: '42dvh', minHeight: '200px' }"
      >
        <!-- 摄像头渲染 -->
        <div id="qr-reader" class="absolute inset-0 !border-none !rounded-none"></div>

        <!-- 扫描框 UI -->
        <div
          v-if="scannerRunning"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div class="relative" :style="{ width: '180px', height: '180px' }">
            <!-- 四角边框 -->
            <div class="absolute top-0 left-0 w-8 h-8" :style="`border-top: 2.5px solid var(--accent); border-left: 2.5px solid var(--accent); border-radius: 5px 0 0 0; animation: corner-pulse 2s ease-in-out infinite; filter: drop-shadow(0 0 6px var(--accent));`"></div>
            <div class="absolute top-0 right-0 w-8 h-8" :style="`border-top: 2.5px solid var(--accent); border-right: 2.5px solid var(--accent); border-radius: 0 5px 0 0; animation: corner-pulse 2s ease-in-out infinite 0.4s; filter: drop-shadow(0 0 6px var(--accent));`"></div>
            <div class="absolute bottom-0 left-0 w-8 h-8" :style="`border-bottom: 2.5px solid var(--accent); border-left: 2.5px solid var(--accent); border-radius: 0 0 0 5px; animation: corner-pulse 2s ease-in-out infinite 0.8s; filter: drop-shadow(0 0 6px var(--accent));`"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8" :style="`border-bottom: 2.5px solid var(--accent); border-right: 2.5px solid var(--accent); border-radius: 0 0 5px 0; animation: corner-pulse 2s ease-in-out infinite 1.2s; filter: drop-shadow(0 0 6px var(--accent));`"></div>
            <!-- 扫描线 -->
            <div class="absolute left-2 right-2 h-0.5 rounded-full overflow-hidden" :style="`background: linear-gradient(90deg, transparent, var(--accent), transparent); box-shadow: 0 0 8px var(--scan-accent), 0 0 16px rgba(var(--scan-accent-rgb),0.4); animation: scan-line 2.5s ease-in-out infinite; top: 8px;`"></div>
          </div>
        </div>

        <!-- 扫描中指示 -->
        <div v-if="scannerRunning" class="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style="background: rgba(99,102,241,0.85); backdrop-filter: blur(8px); color: white; box-shadow: 0 0 12px rgba(99,102,241,0.3);">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          持续扫描中
        </div>

        <!-- 模式切换 — 叠加在摄像头底部 -->
        <div
          class="absolute bottom-0 left-0 right-0 flex items-stretch"
          style="background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,0.05);"
          :style="{ background: 'rgba(var(--bg-glass), 0.92)' }"
        >
          <button
            @click="switchMode('out')"
            class="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-semibold transition-all duration-200 relative"
            :class="scanMode === 'out' ? 'text-white' : 'text-slate-500'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            </svg>
            批量出库
            <span v-if="scanMode === 'out'" class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style="background: #f43f5e; box-shadow: 0 0 8px rgba(244,63,94,0.6);"></span>
          </button>
          <div class="w-px bg-slate-200 dark:bg-white/5"></div>
          <button
            @click="switchMode('in')"
            class="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-semibold transition-all duration-200 relative"
            :class="scanMode === 'in' ? 'text-white' : 'text-slate-500'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            </svg>
            批量入库
            <span v-if="scanMode === 'in'" class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style="background: #6366f1; box-shadow: 0 0 8px rgba(99,102,241,0.6);"></span>
          </button>
        </div>

        <!-- 未启动占位 -->
        <div
          v-if="!scannerRunning"
          class="absolute inset-0 flex flex-col items-center justify-center"
          :style="{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)' }"
        >
          <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-bg); border: 1px solid var(--accent-border);">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
            </svg>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 text-center px-8 max-w-xs">{{ scannerError || '正在启动摄像头...' }}</p>
          <button
            v-if="scannerError"
            @click="initScanner"
            class="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white
                   bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20
                   active:scale-95 transition-all cursor-pointer"
          >
            重新启动
          </button>
        </div>
      </div>

      <!-- ════ 下半部分：Bottom Sheet 悬浮卡片 ════ -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden rounded-t-xl"
           :style="{ backgroundColor: 'var(--bg-secondary)', boxShadow: '0 -8px 40px var(--border-subtle)' }">
        <!-- 拖拽指示条 -->
        <div class="flex-shrink-0 flex justify-center pt-3 pb-2">
          <div class="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>

        <!-- 运单号输入（出库模式） -->
        <div v-if="scanMode === 'out'" class="px-4 pb-3 flex-shrink-0">
          <div class="flex gap-2">
            <input
              v-model="trackingNumber"
              type="text"
              placeholder="运单号（选填）"
              class="flex-1 py-3 px-4 rounded-xl text-sm font-medium
                     bg-slate-100 dark:bg-slate-800
                     border-2 border-transparent
                     text-slate-900 dark:text-white
                     placeholder-slate-400 dark:placeholder-slate-500
                     focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                     transition-all duration-200"
            />
            <button
              @click="openTrackingScan"
              class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                     bg-indigo-600 hover:bg-indigo-700 text-white
                     shadow-md shadow-indigo-500/20
                     active:scale-95 transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m9 11 5 5"/><path d="m14 11 5 5"/><path d="m14 11-5 5"/><path d="m9 16 5-5"/><rect x="6" y="6" width="4" height="4" rx="1"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 列表头部 -->
        <div class="px-4 pb-2 flex-shrink-0 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">已扫描</span>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-bold text-white"
              :style="scanMode === 'out'
                ? 'background: linear-gradient(135deg, #f43f5e, #e11d48);'
                : 'background: linear-gradient(135deg, #6366f1, #4f46e5);'"
            >{{ scannedItems.length }}</span>
          </div>
          <button
            v-if="scannedItems.length > 0"
            @click="clearList"
            class="text-xs font-medium text-rose-500 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
          >
            清空
          </button>
        </div>

        <!-- 列表内容 -->
        <div class="flex-1 overflow-auto min-h-0 px-4">

          <!-- 空状态 -->
          <div v-if="scannedItems.length === 0" class="flex flex-col items-center justify-center py-12">
            <div class="mb-3 p-3 rounded-xl" style="background: var(--accent-bg); border: 1px solid var(--accent-border);">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">尚未扫描商品</p>
          </div>

          <!-- 列表项 -->
          <div v-else class="space-y-2 pb-4">
            <div
              v-for="(item, index) in scannedItems"
              :key="item.sku_code"
              class="flex items-center p-3 rounded-xl
                     bg-white dark:bg-slate-800
                     border border-slate-100 dark:border-white/5
                     shadow-sm"
            >
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center mr-3 shrink-0"
                :style="scanMode === 'out'
                  ? 'background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.15);'
                  : 'background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.15);'"
              >
                <span class="text-sm font-bold" :style="scanMode === 'out' ? 'color: #f43f5e' : 'color: #6366f1'">
                  {{ scanMode === 'out' ? '-' : '+' }}{{ item.quantity }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ item.name }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ item.sku_code }}</p>
              </div>
              <button
                @click="removeItem(index)"
                class="w-8 h-8 rounded-lg flex items-center justify-center ml-2
                       text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10
                       active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 底部提交 -->
        <div class="flex-shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 dark:border-white/5">
          <!-- 成功提示 -->
          <div v-if="submitSuccess" class="mb-2.5 p-2.5 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 scale-in"
               style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
            </svg>
            {{ scanMode === 'out' ? '出库' : '入库' }}成功！
          </div>
          <!-- 错误 -->
          <div v-if="submitError" class="mb-2.5 p-2.5 rounded-xl text-xs overflow-auto"
               style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); color: #ef4444;">
            {{ submitError }}
          </div>
          <button
            @click="handleSubmit"
            :disabled="submitting || scannedItems.length === 0"
            class="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200
                   active:scale-[0.98] cursor-pointer disabled:opacity-45"
            :style="
              scannedItems.length === 0 || submitting
                ? 'opacity: 0.45'
                : scanMode === 'out'
                  ? 'background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 4px 16px rgba(244,63,94,0.35);'
                  : 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 16px rgba(99,102,241,0.35);'
            "
          >
            <span v-if="submitting" class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              处理中...
            </span>
            <span v-else>{{ submitButtonText }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 运单号扫码弹窗                                            -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <Transition name="modal-fade">
      <div
        v-if="showTrackingScan"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeTrackingScan"></div>
        <div
          class="relative w-full max-w-sm rounded-xl overflow-hidden scale-in
                 bg-white dark:bg-slate-900
                 border border-slate-100 dark:border-white/5
                 shadow-xl"
        >
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">扫码运单号</h3>
            <button
              @click="closeTrackingScan"
              class="w-7 h-7 rounded-xl flex items-center justify-center
                     text-slate-400 hover:text-slate-600 dark:hover:text-white
                     hover:bg-slate-100 dark:hover:bg-white/5
                     transition-all duration-200 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
          <div class="p-4 space-y-3">
            <div id="tracking-reader" class="w-full rounded-xl overflow-hidden" style="height: 160px; background: #000;"></div>
            <p v-if="trackingScanError" class="text-xs" style="color: #ef4444;">{{ trackingScanError }}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500 text-center">将运单条码对准扫描框，自动填入</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── html5-qrcode 全局强制清理 ─────────────────────────────── */
:global(#qr-reader) {
  width: 100% !important;
  height: 100% !important;
  border: none !important;
  border-radius: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
}
:global(#qr-reader video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  border-radius: 0 !important;
}
:global(#qr-reader__scan_region) {
  background: transparent !important;
  min-height: unset !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
:global(#qr-reader__dashboard),
:global(#qr-reader__header),
:global(#qr-reader__status_span),
:global(#qr-reader__controls),
:global(#qr-reader__stop_button),
:global(#qr-reader__torch_button),
:global(#qr-reader__camera_selection),
:global(#qr-reader__img-info),
:global(#qr-reader__result_container),
:global(#qr-reader__status),
:global(#qr-reader__title),
:global(#qr-reader__share_summary),
:global(#qr-reader__dashboard_section_swaplink),
:global(#qr-reader__region_selection) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
  pointer-events: none !important;
}
:global(#tracking-reader) {
  width: 100% !important;
  border: none !important;
  border-radius: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
}
:global(#tracking-reader video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
:global(#tracking-reader__scan_region) {
  background: transparent !important;
}
:global(#tracking-reader__dashboard) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
  pointer-events: none !important;
}

/* ── 扫描线动画 ───────────────────────────────────────────── */
@keyframes scan-line {
  0%   { transform: translateY(-8px); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(184px); opacity: 0; }
}

/* ── 角落脉冲 ─────────────────────────────────────────────── */
@keyframes corner-pulse {
  0%, 100% { opacity: 0.7; filter: drop-shadow(0 0 4px var(--scan-accent)); }
  50%       { opacity: 1;   filter: drop-shadow(0 0 12px var(--scan-accent)); }
}

/* ── 弹窗过渡 ─────────────────────────────────────────────── */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* ── 滚动条 ───────────────────────────────────────────────── */
.overflow-auto::-webkit-scrollbar {
  width: 3px;
}
.overflow-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-auto::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.1);
  border-radius: 2px;
}

/* ── 成功/缩放动画 ─────────────────────────────────────────── */
.scale-in {
  animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes scale-in {
  0%   { opacity: 0; transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}

/* ── 列表项入场 ────────────────────────────────────────────── */
div[style*="scannedItems"] > div {
  animation: slide-up 0.2s ease forwards;
}
@keyframes slide-up {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
