<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { getProductBySku } from '../api/products.js'
import { batchStockIn, batchStockOut } from '../api/inventory.js'
import { MyModal } from '../components/ui/index.js'
import MyMessage from '../components/ui/MyMessage.js'

// ═══════════════════════════════════════════════════════════
// 主题状态（注入）
// ═══════════════════════════════════════════════════════════
const isDark = inject('isDark', ref(true))

// ═══════════════════════════════════════════════════════════
// 扫码模式 & 一物一码状态
// ═══════════════════════════════════════════════════════════
const scanMode = ref('out') 
const oneToOneMode = ref(false)
const scanState = ref('idle') 
const pendingProduct = ref(null)
const scannedItems = ref([])

// ═══════════════════════════════════════════════════════════
// 摄像头状态与原生 Refs
// ═══════════════════════════════════════════════════════════
const videoElementPC = ref(null)
const videoElementMobile = ref(null)
const scannerRunning = ref(false)
const scannerError = ref('')
const cameraPermission = ref('prompt')
let isInitializing = false
let visibilityHandler = null

// 实例化 ZXing 终极解码器
const codeReader = new BrowserMultiFormatReader()

// ═══════════════════════════════════════════════════════════
// 提交与确认状态
// ═══════════════════════════════════════════════════════════
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
const showSubmitModal = ref(false)
const submitRemark = ref('')

const showClearConfirm = ref(false)
const showSwitchConfirm = ref(false)
const pendingSwitchMode = ref(null)

// ═══════════════════════════════════════════════════════════
// 音效系统 (原生无阻碍)
// ═══════════════════════════════════════════════════════════
let audioContext = null

function initAudio() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
  } catch (e) {}
}

function playBeep() {
  try {
    initAudio()
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.frequency.value = 1200
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.1)
  } catch (e) {}
}

function playErrorBeep() {
  try {
    initAudio()
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.frequency.value = 400
    osc.type = 'square'
    gain.gain.setValueAtTime(0.2, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.3)
  } catch (e) {}
}

function playSuccessBeep() {
  try {
    initAudio()
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.25, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08)
    osc.start(audioContext.currentTime)
    osc.stop(audioContext.currentTime + 0.08)
    setTimeout(() => {
      try {
        const osc2 = audioContext.createOscillator()
        const gain2 = audioContext.createGain()
        osc2.connect(gain2)
        gain2.connect(audioContext.destination)
        osc2.frequency.value = 1100
        osc2.type = 'sine'
        gain2.gain.setValueAtTime(0.25, audioContext.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12)
        osc2.start(audioContext.currentTime)
        osc2.stop(audioContext.currentTime + 0.12)
      } catch(e) {}
    }, 100)
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════
// 防抖与环境亮度
// ═══════════════════════════════════════════════════════════
const lastScannedCode = ref('')
const lastScanTime = ref(0)
const SCAN_COOLDOWN = 1500
const BARCODE_COOLDOWN = 2000
const ERR_DURATION = 3000
const envBrightness = ref('normal')
let scanStartTime = 0

// ═══════════════════════════════════════════════════════════
// 核心：原生 WebRTC 启动逻辑
// ═══════════════════════════════════════════════════════════
async function safeStopCamera() {
  try {
    if (codeReader) {
      codeReader.reset()
    }
  } catch (e) {}
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
  isInitializing = true
  await safeStopCamera()

  scannerError.value = ''
  cameraPermission.value = 'prompt'
  scanStartTime = Date.now()
  
  try { initAudio() } catch(e) {}

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scannerError.value = '当前浏览器不支持原生摄像头 API，请更换浏览器'
    cameraPermission.value = 'denied'
    isInitializing = false
    return
  }

  await nextTick()

  const videoEl = window.innerWidth >= 1024 ? videoElementPC.value : videoElementMobile.value

  if (!videoEl) {
    scannerError.value = '找不到视频渲染容器'
    isInitializing = false
    return
  }

  try {
    videoEl.setAttribute('playsinline', 'true')
    videoEl.setAttribute('webkit-playsinline', 'true')
    videoEl.setAttribute('muted', 'true')
    videoEl.muted = true

    await codeReader.decodeFromConstraints(
      { 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: 'continuous' 
        } 
      },
      videoEl,
      (result, err) => {
        if (result) {
          onScanSuccess(result.getText(), result)
        }
      }
    )
    
    scannerRunning.value = true
    cameraPermission.value = 'granted'
  } catch (err) {
    const errorName = err?.name || 'UnknownError'
    const errorMessage = err?.message || String(err) || '未知错误'

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      scannerError.value = '摄像头权限被拒绝，请在浏览器设置中允许'
      cameraPermission.value = 'denied'
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      scannerError.value = '未检测到可用摄像头'
      cameraPermission.value = 'denied'
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      scannerError.value = '摄像头被占用，请关闭其他应用'
    } else {
      scannerError.value = '摄像头启动失败: ' + errorMessage
      cameraPermission.value = 'denied'
    }
  } finally {
    isInitializing = false
  }
}

// ═══════════════════════════════════════════════════════════
// 扫码成功回调
// ═══════════════════════════════════════════════════════════
async function onScanSuccess(decodedText, decodedResult) {
  if (submitting.value) return

  const now = Date.now()

  const format = decodedResult.getBarcodeFormat()
  const isQRCode = format === BarcodeFormat.QR_CODE || format === BarcodeFormat.DATA_MATRIX
  const isBarcode = !isQRCode

  const isTrackingCandidate = decodedText.length > 10 && isBarcode
  const cooldown = isTrackingCandidate ? BARCODE_COOLDOWN : SCAN_COOLDOWN

  if (decodedText === lastScannedCode.value && now - lastScanTime.value < cooldown) {
    return
  }
  lastScannedCode.value = decodedText
  lastScanTime.value = now

  if (navigator.vibrate) navigator.vibrate(50)

  if (Date.now() - scanStartTime > 3000 && envBrightness.value === 'normal') {
    envBrightness.value = 'dark'
  }

  if (oneToOneMode.value && scanMode.value === 'out') {
    await handleOneToOneScan(decodedText, isQRCode, isBarcode)
    return
  }

  await handleNormalScan(decodedText, decodedResult, isQRCode, isBarcode)
}

// ═══════════════════════════════════════════════════════════
// 一物一码扫码处理
// ═══════════════════════════════════════════════════════════
async function handleOneToOneScan(decodedText, isQRCode, isBarcode) {
  if (scanState.value === 'idle') {
    if (!isQRCode) {
      playErrorBeep()
      MyMessage.warning('请先扫描商品二维码(SKU)', ERR_DURATION)
      return
    }

    const existingIndex = scannedItems.value.findIndex(
      item => item.sku_code === decodedText && item.tracking_number
    )
    if (existingIndex >= 0) {
      playErrorBeep()
      MyMessage.warning('该商品已绑定运单，不可重复扫描')
      return
    }

    try {
      const res = await getProductBySku(decodedText)
      if (res.data.success) {
        const product = res.data.data
        pendingProduct.value = {
          id: product.id,
          sku_code: product.sku_code,
          name: product.name,
          current_stock: product.current_stock,
          scanned_at: new Date().toISOString(),
        }
        scanState.value = 'waiting_tracking'
        playBeep()
        setTimeout(() => playBeep(), 150)
      } else {
        playErrorBeep()
        MyMessage.error(`未找到商品: ${decodedText}`, ERR_DURATION)
      }
    } catch (e) {
      playErrorBeep()
      MyMessage.error('查询商品信息失败，请检查网络', ERR_DURATION)
    }
    return
  }

  if (scanState.value === 'waiting_tracking') {
    if (isQRCode) {
      playErrorBeep()
      MyMessage.warning('请扫描运单条形码', ERR_DURATION)
      return
    }

    const rawTracking = decodedText.trim()

    const existingByTracking = scannedItems.value.findIndex(
      item => item.tracking_number === rawTracking
    )
    if (existingByTracking >= 0) {
      playErrorBeep()
      MyMessage.error('请勿重复扫描当前运单', ERR_DURATION)
      return
    }

    const dupCheck = scannedItems.value.findIndex(
      item => item.sku_code === pendingProduct.value.sku_code && item.tracking_number === rawTracking
    )
    if (dupCheck >= 0) {
      playErrorBeep()
      MyMessage.warning('该商品已绑定此运单')
      return
    }

    // 新增独立的一行
    scannedItems.value.unshift({
      uid: Date.now() + Math.random().toString(36).substr(2, 9),
      ...pendingProduct.value,
      quantity: 1,
      tracking_number: rawTracking,
      tracking_scanned_at: new Date().toISOString(),
    })

    pendingProduct.value = null
    scanState.value = 'idle'
    envBrightness.value = 'normal'
    scanStartTime = Date.now()
    playSuccessBeep()
  }
}

// ═══════════════════════════════════════════════════════════
// 🚨 优化 1: 普通扫码 - 每次扫码生成独立新行 🚨
// ═══════════════════════════════════════════════════════════
async function handleNormalScan(decodedText, decodedResult, isQRCode, isBarcode) {
  if (scanMode.value === 'out' && isBarcode) {
    playErrorBeep()
    MyMessage.error('普通出库模式请扫描商品二维码', ERR_DURATION)
    return
  }

  // 1. 先在已扫描列表里找找看有没有相同的商品 (节省后端请求时间)
  const cachedItem = scannedItems.value.find(item => item.sku_code === decodedText)

  if (cachedItem) {
    // 直接复用商品信息，生成独立新行，插在最前面
    scannedItems.value.unshift({
      uid: Date.now() + Math.random().toString(36).substr(2, 9),
      id: cachedItem.id,
      sku_code: cachedItem.sku_code,
      name: cachedItem.name,
      current_stock: cachedItem.current_stock,
      quantity: 1, // 永远是1，不叠加
      scanned_at: new Date().toISOString(),
    })
    playBeep()
  } else {
    // 2. 本地没扫过，去后端查
    try {
      const res = await getProductBySku(decodedText)
      if (res.data.success) {
        const product = res.data.data
        scannedItems.value.unshift({
          uid: Date.now() + Math.random().toString(36).substr(2, 9),
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
        MyMessage.error(`未找到商品: ${decodedText}`, ERR_DURATION)
      }
    } catch (e) {
      playErrorBeep()
      MyMessage.error('查询商品信息失败，请检查网络', ERR_DURATION)
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 列表操作与模式切换
// ═══════════════════════════════════════════════════════════
function cancelOneToOneScan() {
  pendingProduct.value = null
  scanState.value = 'idle'
  envBrightness.value = 'normal'
  scanStartTime = Date.now()
}

function removeItem(index) {
  scannedItems.value.splice(index, 1)
}

function clearList() {
  if (scannedItems.value.length > 0) {
    showClearConfirm.value = true
  }
}

function confirmClearList() {
  scannedItems.value = []
  showClearConfirm.value = false
  pendingProduct.value = null
  scanState.value = 'idle'
  envBrightness.value = 'normal'
  scanStartTime = Date.now()
}

async function switchMode(mode) {
  if (scanMode.value === mode) return
  if (scannedItems.value.length > 0) {
    pendingSwitchMode.value = mode
    showSwitchConfirm.value = true
    return
  }
  scanMode.value = mode
  scannedItems.value = []
  pendingProduct.value = null
  scanState.value = 'idle'
  envBrightness.value = 'normal'
  await safeStopCamera()
  await nextTick()
  setTimeout(() => { initScanner() }, 100)
}

async function confirmSwitchMode() {
  const mode = pendingSwitchMode.value
  showSwitchConfirm.value = false
  pendingSwitchMode.value = null
  scanMode.value = mode
  scannedItems.value = []
  pendingProduct.value = null
  scanState.value = 'idle'
  envBrightness.value = 'normal'
  scanStartTime = Date.now()
  await safeStopCamera()
  await nextTick()
  setTimeout(() => { initScanner() }, 100)
}

async function toggleOneToOneMode() {
  oneToOneMode.value = !oneToOneMode.value
  pendingProduct.value = null
  scanState.value = 'idle'
  scannedItems.value = []
  envBrightness.value = 'normal'
  scanStartTime = Date.now()
}

// ═══════════════════════════════════════════════════════════
// 提交批量操作
// ═══════════════════════════════════════════════════════════
function openSubmitModal() {
  if (scannedItems.value.length === 0) {
    MyMessage.warning('请先扫描商品')
    return
  }
  submitRemark.value = ''
  showSubmitModal.value = true
}

async function confirmSubmit() {
  showSubmitModal.value = false
  submitting.value = true
  submitError.value = ''

  const items = scannedItems.value.map(item => ({
    product_id: item.id,
    quantity: item.quantity,
    tracking_number: item.tracking_number || null,
    note: submitRemark.value || '', 
  }))

  try {
    let res
    if (scanMode.value === 'out') {
      res = await batchStockOut({ items })
    } else {
      res = await batchStockIn({ items })
    }

    if (res.data.success) {
      submitSuccess.value = true
      
      // 🚨 优化 3: 1.5秒后强制刷新整个网页，释放内存和视频占用 🚨
      setTimeout(() => { 
        window.location.reload()
      }, 1500)
      
    } else {
      playErrorBeep()
      if (res.data.stockErrors) {
        const errorMsg = res.data.stockErrors.map(e => `${e.product_name || e.product_id}: ${e.error}`).join('\n')
        submitError.value = errorMsg
      } else {
        submitError.value = res.data.error || '提交失败'
      }
    }
  } catch (e) {
    playErrorBeep()
    submitError.value = '提交失败：' + (e.response?.data?.error || '网络错误')
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
  if (oneToOneMode.value && scanMode.value === 'out') {
    return `确认${action}（共 ${totalCount.value} 件，已绑定 ${totalCount.value} 个运单）`
  }
  return `确认${action}（共 ${totalCount.value} 件）`
})

const scanStateHint = computed(() => {
  if (!oneToOneMode.value || scanMode.value !== 'out') return ''
  if (scanState.value === 'waiting_tracking') {
    return '等待扫描运单条码'
  }
  return '等待扫描商品条码'
})

const scanStateType = computed(() => {
  if (scanState.value === 'waiting_tracking') return 'tracking'
  return 'product'
})

const showBrightnessWarning = computed(() => {
  return scannerRunning.value && oneToOneMode.value && scanMode.value === 'out' && scanState.value === 'waiting_tracking' && envBrightness.value === 'dark'
})

function formatTime(isoString) {
  if (!isoString) return ''
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
  setTimeout(() => { initScanner() }, 300)
})

onUnmounted(async () => {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  await safeStopCamera()
})
</script>

<template>
  <Transition name="loading-fade">
    <div
      v-if="submitting"
      class="fixed inset-0 z-[100] flex items-center justify-center"
      style="background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(6px);"
    >
      <div class="flex flex-col items-center">
        <div class="relative w-16 h-16 mb-4">
          <div class="absolute inset-0 rounded-full border-4 border-white/20"></div>
          <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 animate-spin"></div>
          <div class="absolute inset-2 rounded-full border-4 border-transparent border-t-rose-400 animate-spin" style="animation-direction: reverse; animation-duration: 0.8s;"></div>
        </div>
        <p class="text-white font-semibold text-base">正在提交，请稍候...</p>
        <p class="text-white/60 text-xs mt-1">防重复提交锁已启用</p>
      </div>
    </div>
  </Transition>

  <div class="hidden lg:flex flex-row flex-1 min-h-0 overflow-hidden pc-scan-layout w-full">
    <div class="flex-1 flex flex-row overflow-hidden p-6 gap-6 w-full">
      <div
        class="w-1/2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm flex flex-col"
        :style="{ minHeight: '500px' }"
      >
        <div class="px-6 pt-6 pb-4 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">扫码工作站</h2>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">对准商品或运单条码，系统将自动识别</p>
            </div>
            <button
              v-if="!scannerRunning && !scannerError"
              @click="initScanner"
              class="px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center leading-none"
            >
              重连摄像头
            </button>
          </div>

          <div class="flex mt-4 rounded-xl p-1 bg-slate-100 dark:bg-white/5">
            <button
              @click="switchMode('out')"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
              :class="scanMode === 'out' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
              批量出库
            </button>
            <button
              @click="switchMode('in')"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
              :class="scanMode === 'in' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
              批量入库
            </button>
          </div>

          <div
            v-if="scanMode === 'out'"
            class="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200"
            :class="oneToOneMode ? 'border-rose-400/50 bg-rose-50/60 dark:bg-rose-500/10' : 'border-slate-200/60 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]'"
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :style="oneToOneMode ? 'background: rgba(244,63,94,0.15);' : 'background: var(--accent-bg);'">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="oneToOneMode ? 'color: #f43f5e;' : 'color: var(--accent);'"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/></svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate" :class="oneToOneMode ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'">开启单件运单绑定</p>
                <p class="text-xs mt-0.5" :class="oneToOneMode ? 'text-rose-500/80 dark:text-rose-500/70' : 'text-slate-400 dark:text-slate-500'">一物一码，每件商品独立绑定运单</p>
              </div>
            </div>
            <button
              @click="toggleOneToOneMode"
              class="relative shrink-0 w-12 rounded-full transition-all duration-300 cursor-pointer focus:outline-none"
              :class="oneToOneMode ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'"
              style="height: 28px !important; box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);"
            >
              <span class="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300" :class="oneToOneMode ? '!left-[26px]' : '!left-[2px]'" style="box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>
            </button>
          </div>

          <div
            v-if="oneToOneMode && scanMode === 'out' && scanStateHint"
            class="mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-center animate-pulse"
            :style="scanStateType === 'tracking' ? 'background: linear-gradient(135deg, rgba(244,63,94,0.12), rgba(244,63,94,0.06)); border: 1.5px solid rgba(244,63,94,0.3); color: #f43f5e; box-shadow: 0 0 16px rgba(244,63,94,0.15);' : 'background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06)); border: 1.5px solid rgba(99,102,241,0.3); color: #6366f1; box-shadow: 0 0 16px rgba(99,102,241,0.15);'"
          >
            <span v-if="scanStateType === 'tracking'">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/></svg>
            </span>
            <span v-else>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
            </span>
            {{ scanStateHint }}
          </div>
        </div>

        <div class="relative flex-1 min-h-0 overflow-hidden rounded-xl bg-black">
          <video 
            ref="videoElementPC" 
            autoplay 
            playsinline 
            muted 
            class="absolute inset-0 w-full h-full object-cover"
          ></video>

          <div
            v-if="scannerRunning"
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            :class="scanState === 'waiting_tracking' ? 'scan-frame-tracking' : ''"
          >
            <div class="relative" style="width: 200px; height: 200px;">
              <div class="absolute top-0 left-0 w-10 h-10" :style="`border-top: 2.5px solid var(--scan-accent); border-left: 2.5px solid var(--scan-accent); border-radius: 6px 0 0 0; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
              <div class="absolute top-0 right-0 w-10 h-10" :style="`border-top: 2.5px solid var(--scan-accent); border-right: 2.5px solid var(--scan-accent); border-radius: 0 6px 0 0; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
              <div class="absolute bottom-0 left-0 w-10 h-10" :style="`border-bottom: 2.5px solid var(--scan-accent); border-left: 2.5px solid var(--scan-accent); border-radius: 0 0 0 6px; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
              <div class="absolute bottom-0 right-0 w-10 h-10" :style="`border-bottom: 2.5px solid var(--scan-accent); border-right: 2.5px solid var(--scan-accent); border-radius: 0 0 6px 0; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
              <div class="scan-line-element"></div>
            </div>
          </div>

          <div
            v-if="scannerRunning"
            class="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium z-20"
            :style="{ background: 'rgba(var(--scan-accent-rgb), 0.88)', backdropFilter: 'blur(8px)', color: 'white', boxShadow: '0 0 12px rgba(var(--scan-accent-rgb), 0.3)' }"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            持续扫描中
          </div>

          <div
            v-if="showBrightnessWarning"
            class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium z-20"
            style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); box-shadow: 0 0 12px rgba(251, 191, 36, 0.2);"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/>
            </svg>
            环境较暗，请对准条码
          </div>

          <button
            v-if="scanState === 'waiting_tracking'"
            @click="cancelOneToOneScan"
            class="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer bg-rose-500/90 hover:bg-rose-600 text-white backdrop-blur-sm shadow-lg shadow-rose-500/30 active:scale-95 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
            取消
          </button>

          <div
            v-if="!scannerRunning"
            class="absolute inset-0 flex flex-col items-center justify-center z-30"
            :style="{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)' }"
          >
            <div class="mb-5">
              <div class="w-16 h-16 rounded-xl flex items-center justify-center" style="background: var(--accent-bg); border: 1.5px solid var(--accent-border);">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
                </svg>
              </div>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center px-8 max-w-xs">{{ scannerError || '正在启动摄像头...' }}</p>
            <button
              v-if="scannerError"
              @click="initScanner"
              class="mt-5 px-6 py-2.5 flex items-center justify-center min-h-[44px] rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              重新启动
            </button>
          </div>
        </div>
      </div>

      <div class="w-1/2 flex flex-col gap-5">
        <div
          v-if="oneToOneMode && scanMode === 'out'"
          class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/20 shadow-sm p-5"
          style="background: linear-gradient(135deg, rgba(244,63,94,0.04), rgba(244,63,94,0.01));"
        >
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(244,63,94,0.1);">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-rose-700 dark:text-rose-400">一物一码运单绑定模式</p>
              <div class="mt-2 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <p class="flex items-start gap-1.5"><span class="text-rose-400 font-bold mt-0.5">1.</span><span>扫描商品条码 → 系统查询商品信息</span></p>
                <p class="flex items-start gap-1.5"><span class="text-rose-400 font-bold mt-0.5">2.</span><span>提示"请扫描运单条码" → 扫描运单条形码</span></p>
                <p class="flex items-start gap-1.5"><span class="text-rose-400 font-bold mt-0.5">3.</span><span>系统自动组装 1商品+1运单 记录到列表</span></p>
                <p class="flex items-start gap-1.5"><span class="text-rose-400 font-bold mt-0.5">4.</span><span>重复以上步骤，完成所有商品绑定后再提交</span></p>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm flex flex-col flex-1 min-h-0">
          <div class="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 flex-shrink-0">
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold text-slate-900 dark:text-white">已扫描商品</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-bold text-white flex items-center justify-center leading-none"
                :style="scanMode === 'out' ? 'background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 0 8px rgba(244,63,94,0.3);' : 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 0 8px rgba(99,102,241,0.3);'"
              >{{ scannedItems.length }}</span>
            </div>
            <button
              v-if="scannedItems.length > 0"
              @click="clearList"
              class="px-3 py-1.5 flex items-center justify-center rounded-xl text-xs font-medium text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              清空全部
            </button>
          </div>

          <div class="flex-1 overflow-auto min-h-0 flex flex-col relative">
            <div v-if="scannedItems.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px]">
              <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-bg); border: 1px solid var(--accent-border);">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
                  <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                </svg>
              </div>
              <p class="text-base font-bold text-slate-700 dark:text-slate-300">尚未扫描商品</p>
              <p class="text-sm text-slate-400 dark:text-slate-500 mt-2 max-w-[200px]">对准商品或运单条码，系统将自动识别</p>
            </div>

            <div v-else class="divide-y divide-slate-100 dark:divide-white/5 pb-4">
              <div
                v-for="(item, index) in scannedItems"
                :key="item.uid || index"
                class="flex items-center px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors duration-150"
              >
                <div
                  class="w-12 h-12 rounded-xl flex flex-col items-center justify-center mr-4 shrink-0"
                  :style="scanMode === 'out' ? 'background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.15);' : 'background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.15);'"
                >
                  <span class="text-base font-bold leading-none" :style="scanMode === 'out' ? 'color: #f43f5e' : 'color: #6366f1'">{{ scanMode === 'out' ? '-' : '+' }}{{ item.quantity }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-900 dark:text-white truncate leading-snug">{{ item.name }}</p>
                  <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-xs font-mono text-slate-400 dark:text-slate-500">{{ item.sku_code }}</span>
                    <span class="text-xs text-slate-200 dark:text-slate-700">|</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">库存 {{ item.current_stock }}</span>
                    <span class="text-xs text-slate-200 dark:text-slate-700">|</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">{{ formatTime(item.scanned_at) }}</span>
                  </div>
                  <div v-if="item.tracking_number" class="mt-1.5 flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400" style="background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2);">
                      运单: {{ item.tracking_number }}
                    </span>
                  </div>
                </div>
                <button
                  @click="removeItem(index)"
                  class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ml-3 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="scannedItems.length > 0" class="px-5 py-4 border-t border-slate-100 dark:border-white/5 flex-shrink-0">
            <div
              v-if="submitSuccess"
              class="mb-3 p-3 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2 scale-in"
              :style="{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
              </svg>
              {{ scanMode === 'out' ? '出库' : '入库' }}成功！即将刷新网页...
            </div>

            <div
              v-if="submitError"
              class="mb-3 p-3 rounded-xl text-xs max-h-20 overflow-auto"
              :style="{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)' }"
            >
              {{ submitError }}
            </div>

            <button
              @click="openSubmitModal"
              :disabled="submitting"
              class="w-full flex items-center justify-center h-14 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 leading-none"
              :style="scanMode === 'out' ? 'background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 4px 20px rgba(244,63,94,0.35);' : 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 20px rgba(99,102,241,0.35);'"
            >
              <span v-if="submitting" class="flex items-center justify-center gap-2">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>处理中...
              </span>
              <span v-else>{{ submitButtonText }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="flex flex-col lg:hidden flex-1 min-h-0 overflow-hidden mobile-scan-layout w-full">
    <div
      class="relative flex-shrink-0 overflow-hidden w-full"
      style="height: 40vh; min-height: 180px; max-height: 280px;"
    >
      <video 
        ref="videoElementMobile" 
        autoplay 
        playsinline 
        muted 
        class="absolute inset-0 w-full h-full object-cover bg-black"
      ></video>

      <div
        v-if="scannerRunning"
        class="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        :class="scanState === 'waiting_tracking' ? 'scan-frame-tracking' : ''"
      >
        <div class="relative" style="width: 160px; height: 160px;">
          <div class="absolute top-0 left-0 w-8 h-8" :style="`border-top: 2.5px solid var(--scan-accent); border-left: 2.5px solid var(--scan-accent); border-radius: 5px 0 0 0; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
          <div class="absolute top-0 right-0 w-8 h-8" :style="`border-top: 2.5px solid var(--scan-accent); border-right: 2.5px solid var(--scan-accent); border-radius: 0 5px 0 0; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
          <div class="absolute bottom-0 left-0 w-8 h-8" :style="`border-bottom: 2.5px solid var(--scan-accent); border-left: 2.5px solid var(--scan-accent); border-radius: 0 0 0 5px; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
          <div class="absolute bottom-0 right-0 w-8 h-8" :style="`border-bottom: 2.5px solid var(--scan-accent); border-right: 2.5px solid var(--scan-accent); border-radius: 0 0 5px 0; filter: drop-shadow(0 0 6px var(--scan-accent));`"></div>
          <div class="scan-line-element-mobile"></div>
        </div>
      </div>

      <div v-if="scannerRunning" class="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style="background: rgba(99,102,241,0.85); backdrop-filter: blur(8px); color: white; box-shadow: 0 0 12px rgba(99,102,241,0.3);">
        <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>持续扫描中
      </div>

      <button
        v-if="scanState === 'waiting_tracking'"
        @click="cancelOneToOneScan"
        class="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer bg-rose-500/90 hover:bg-rose-600 text-white backdrop-blur-sm shadow-lg shadow-rose-500/30 active:scale-95 transition-all duration-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>取消
      </button>

      <div class="absolute bottom-0 left-0 right-0 flex items-stretch z-20" style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0.5rem)); background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);">
        <button
          @click="switchMode('out')"
          class="flex-1 flex items-center justify-center gap-1.5 py-4 text-xs font-semibold transition-all duration-200 relative leading-none"
          style="padding-left: 1rem; padding-right: 1rem;"
          :class="scanMode === 'out' ? 'text-white' : 'text-slate-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
          批量出库
          <span v-if="scanMode === 'out'" class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style="background: #f43f5e; box-shadow: 0 0 8px rgba(244,63,94,0.6);"></span>
        </button>
        <div class="w-px bg-white/20 my-3"></div>
        <button
          @click="switchMode('in')"
          class="flex-1 flex items-center justify-center gap-1.5 py-4 text-xs font-semibold transition-all duration-200 relative leading-none"
          style="padding-left: 1rem; padding-right: 1rem;"
          :class="scanMode === 'in' ? 'text-white' : 'text-slate-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
          批量入库
          <span v-if="scanMode === 'in'" class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style="background: #6366f1; box-shadow: 0 0 8px rgba(99,102,241,0.6);"></span>
        </button>
      </div>

      <div
        v-if="oneToOneMode && scanMode === 'out' && scanStateHint"
        class="absolute left-3 right-3 z-30 px-4 py-2.5 rounded-xl text-sm font-semibold text-center"
        :style="scanStateType === 'tracking' ? 'bottom: 60px; background: linear-gradient(135deg, rgba(244,63,94,0.92), rgba(244,63,94,0.82)); color: white; box-shadow: 0 4px 20px rgba(244,63,94,0.4);' : 'bottom: 60px; background: linear-gradient(135deg, rgba(99,102,241,0.92), rgba(99,102,241,0.82)); color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.4);'"
      >
        <span v-if="scanStateType === 'tracking'">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/></svg>
        </span>
        <span v-else>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>
        </span>
        {{ scanStateHint }}
      </div>

      <div
        v-if="showBrightnessWarning"
        class="absolute left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium z-30"
        style="bottom: 110px; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); box-shadow: 0 0 12px rgba(251, 191, 36, 0.2);"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/>
        </svg>环境较暗，请对准条码
      </div>

      <div
        v-if="!scannerRunning"
        class="absolute inset-0 flex flex-col items-center justify-center z-40 w-full"
        :style="{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)' }"
      >
        <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-bg); border: 1px solid var(--accent-border);">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
          </svg>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 text-center px-8 max-w-xs">{{ scannerError || '正在启动摄像头...' }}</p>
        <button
          v-if="scannerError"
          @click="initScanner"
          class="mt-4 px-5 py-2 flex items-center justify-center min-h-[44px] rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
        >
          重新启动
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0 overflow-hidden rounded-t-xl z-20 relative w-full" :style="{ backgroundColor: 'var(--bg-secondary)', boxShadow: '0 -8px 40px var(--border-subtle)' }">
      <div class="flex-shrink-0 flex justify-center pt-3 pb-2 touch-none select-none" @touchmove.prevent>
        <div class="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
      </div>

      <div v-if="scanMode === 'out'" class="px-4 pb-3 flex-shrink-0" @touchmove.prevent>
        <div class="flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200" :class="oneToOneMode ? 'border-rose-400/50 bg-rose-50/60 dark:bg-rose-500/10' : 'border-slate-200/60 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]'">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" :style="oneToOneMode ? 'background: rgba(244,63,94,0.15);' : 'background: var(--accent-bg);'">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="oneToOneMode ? 'color: #f43f5e;' : 'color: var(--accent);'">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
              </svg>
            </div>
            <div>
              <p class="text-xs font-semibold" :class="oneToOneMode ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'">单件运单绑定</p>
              <p class="text-xs" :class="oneToOneMode ? 'text-rose-500/80' : 'text-slate-400'">{{ oneToOneMode ? '一物一码模式' : '关闭' }}</p>
            </div>
          </div>
          <button @click="toggleOneToOneMode" class="relative shrink-0 w-12 rounded-full transition-all duration-300 cursor-pointer focus:outline-none" :class="oneToOneMode ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'" style="height: 28px !important; box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);">
            <span class="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300" :class="oneToOneMode ? '!left-[26px]' : '!left-[2px]'" style="box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>
          </button>
        </div>
      </div>

      <div class="px-4 pb-2 flex-shrink-0 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-900 dark:text-white">已扫描</span>
          <span class="px-2 py-0.5 rounded-full text-xs font-bold text-white flex items-center justify-center leading-none" :style="scanMode === 'out' ? 'background: linear-gradient(135deg, #f43f5e, #e11d48);' : 'background: linear-gradient(135deg, #6366f1, #4f46e5);'">{{ scannedItems.length }}</span>
        </div>
        <button v-if="scannedItems.length > 0" @click="clearList" class="px-3 py-1.5 flex items-center justify-center rounded-xl text-xs font-medium text-rose-500 hover:text-rose-600 active:scale-95 transition-all cursor-pointer">清空</button>
      </div>

      <div class="flex-1 overflow-y-auto overscroll-none min-h-0 flex flex-col relative px-4">
        <div v-if="scannedItems.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px]">
          <div class="mb-4 p-4 rounded-xl" style="background: var(--accent-bg); border: 1px solid var(--accent-border);">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            </svg>
          </div>
          <p class="text-base font-bold text-slate-700 dark:text-slate-300">尚未扫描商品</p>
          <p class="text-sm text-slate-400 dark:text-slate-500 mt-2 max-w-[200px]">对准商品或运单条码，系统将自动识别</p>
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-white/5 pb-4">
          <div v-for="(item, index) in scannedItems" :key="item.uid || index" class="flex items-center py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors duration-150">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mr-3 shrink-0" :style="scanMode === 'out' ? 'background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.15);' : 'background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.15);'">
              <span class="text-sm font-bold" :style="scanMode === 'out' ? 'color: #f43f5e' : 'color: #6366f1'">{{ scanMode === 'out' ? '-' : '+' }}{{ item.quantity }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ item.name }}</p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ item.sku_code }}</p>
              <div v-if="item.tracking_number" class="mt-1">
                <span class="px-2 py-0.5 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400" style="background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2);">运单: {{ item.tracking_number }}</span>
              </div>
            </div>
            <button @click="removeItem(index)" class="w-8 h-8 rounded-lg flex items-center justify-center ml-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="scannedItems.length > 0" class="flex-shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 dark:border-white/5 touch-none" style="padding-bottom: max(1rem, env(safe-area-inset-bottom, 1rem));" @touchmove.prevent>>
        <div v-if="submitSuccess" class="mb-2.5 p-2.5 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 scale-in" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981;">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="m9 11 3 3L22 4"/></svg>
          {{ scanMode === 'out' ? '出库' : '入库' }}成功！即将刷新...
        </div>
        <div v-if="submitError" class="mb-2.5 p-2.5 rounded-xl text-xs overflow-auto" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); color: #ef4444;">
          {{ submitError }}
        </div>
        <button
          @click="openSubmitModal"
          :disabled="submitting"
          class="w-full flex items-center justify-center h-14 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-45 leading-none"
          :style="scanMode === 'out' ? 'background: linear-gradient(135deg, #f43f5e, #e11d48); box-shadow: 0 4px 16px rgba(244,63,94,0.35);' : 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 4px 16px rgba(99,102,241,0.35);'"
        >
          <span v-if="submitting" class="flex items-center justify-center gap-2">
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>处理中...
          </span>
          <span v-else>{{ submitButtonText }}</span>
        </button>
      </div>
    </div>
  </div>

  <MyModal v-model="showSubmitModal" title="确认提交" width="max-w-sm">
    <div class="space-y-4">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :style="scanMode === 'out' ? 'background: rgba(244,63,94,0.1);' : 'background: rgba(99,102,241,0.1);'">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" :style="scanMode === 'out' ? 'color: #f43f5e;' : 'color: #6366f1;'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white">
            即将提交 {{ scanMode === 'out' ? '出库' : '入库' }} 记录
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">共 {{ totalCount }} 件商品<span v-if="oneToOneMode && scanMode === 'out'">，包含绑定的运单号</span></p>
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">操作备注 (选填)</label>
        <textarea
          v-model="submitRemark"
          rows="3"
          class="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none transition-all duration-200"
          placeholder="请输入备注，不输入则为空"
          style="background-color: var(--bg-primary); border-color: var(--border-default); color: var(--text-primary);"
          @focus="e => e.target.style.borderColor = 'var(--accent)'"
          @blur="e => e.target.style.borderColor = 'var(--border-default)'"
        ></textarea>
      </div>
    </div>
    <template #footer>
      <button @click="showSubmitModal = false" class="px-4 py-2.5 flex items-center justify-center min-h-[44px] text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all leading-none" style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);">取消</button>
      <button @click="confirmSubmit" class="px-5 py-2.5 flex items-center justify-center min-h-[44px] text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer leading-none" :style="scanMode === 'out' ? 'background: linear-gradient(135deg, #f43f5e, #e11d48);' : 'background: linear-gradient(135deg, #6366f1, #4f46e5);'">确认提交</button>
    </template>
  </MyModal>

  <MyModal v-model="showClearConfirm" title="确认清空" width="max-w-sm" @confirm="confirmClearList">
    <div class="flex items-start gap-4">
      <div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-slate-600 dark:text-slate-300">确定要清空已扫描的 <strong class="text-slate-900 dark:text-white">{{ scannedItems.length }}</strong> 件商品吗？</p>
        <p v-if="oneToOneMode && scannedItems.length > 0" class="text-xs text-rose-500 dark:text-rose-400 mt-1">注意：一物一码模式下，所有商品-运单绑定记录都将被清除</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">此操作不可恢复</p>
      </div>
    </div>
    <template #footer>
      <button @click="showClearConfirm = false" class="px-4 py-2.5 flex items-center justify-center min-h-[44px] text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all leading-none" style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);">取消</button>
      <button @click="confirmClearList" class="px-5 py-2.5 flex items-center justify-center min-h-[44px] text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer leading-none" style="background: linear-gradient(135deg, #f43f5e, #e11d48);">确认清空</button>
    </template>
  </MyModal>

  <MyModal v-model="showSwitchConfirm" title="切换操作模式" width="max-w-sm" @confirm="confirmSwitchMode">
    <div class="flex items-start gap-4">
      <div class="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="m17 8 4 4m0 0-4 4m4-4H3"/>
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-slate-600 dark:text-slate-300">切换模式将清空当前已扫描的 <strong class="text-slate-900 dark:text-white">{{ scannedItems.length }}</strong> 件商品</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">是否继续？</p>
      </div>
    </div>
    <template #footer>
      <button @click="showSwitchConfirm = false" class="px-4 py-2.5 flex items-center justify-center min-h-[44px] text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all leading-none" style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);">取消</button>
      <button @click="confirmSwitchMode" class="px-5 py-2.5 flex items-center justify-center min-h-[44px] text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer leading-none" style="background: var(--accent);">确认切换</button>
    </template>
  </MyModal>
</template>

<style scoped>
.loading-fade-enter-active,
.loading-fade-leave-active { transition: opacity 0.2s ease; }
.loading-fade-enter-from,
.loading-fade-leave-to { opacity: 0; }

.scan-frame-tracking { animation: scan-frame-tracking 2s ease-in-out infinite; }
@keyframes scan-frame-tracking {
  0%, 100% { box-shadow: 0 0 20px rgba(248, 113, 113, 0.2), inset 0 0 40px rgba(248, 113, 113, 0.1); }
  50% { box-shadow: 0 0 40px rgba(248, 113, 113, 0.5), inset 0 0 60px rgba(248, 113, 113, 0.2); }
}

.overflow-auto::-webkit-scrollbar { width: 3px; }
.overflow-auto::-webkit-scrollbar-track { background: transparent; }
.overflow-auto::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

.scale-in { animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes scale-in {
  0%   { opacity: 0; transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}

/* 锁定移动端底层视口，杜绝橡皮筋回弹和下拉刷新 */
html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden !important;
  overscroll-behavior: none !important;
  -webkit-overflow-scrolling: touch;
}

/* 彻底杀死移动端的全局橡皮筋拉拽 */
.mobile-scan-layout {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100dvh;
  overflow: hidden !important;
  overscroll-behavior: none !important;
}

/* 精确控制上下移动距离的扫描线动画 */
.scan-line-element {
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 9999px;
  background: linear-gradient(90deg, transparent, var(--scan-accent), transparent);
  box-shadow: 0 0 10px var(--scan-accent), 0 0 20px rgba(var(--scan-accent-rgb),0.4);
  animation: scan-line-pc 2.5s ease-in-out infinite;
}

.scan-line-element-mobile {
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 9999px;
  background: linear-gradient(90deg, transparent, var(--scan-accent), transparent);
  box-shadow: 0 0 10px var(--scan-accent), 0 0 20px rgba(var(--scan-accent-rgb),0.4);
  animation: scan-line-mobile 2.5s ease-in-out infinite;
}

/* PC 端框为 200px 高，向下移动 180px */
@keyframes scan-line-pc {
  0% { transform: translateY(8px); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(180px); opacity: 0; } 
}

/* Mobile 端框为 160px 高，向下移动 140px */
@keyframes scan-line-mobile {
  0% { transform: translateY(8px); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(140px); opacity: 0; } 
}
</style>