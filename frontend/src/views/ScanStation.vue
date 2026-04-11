<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { getProductBySku } from '../api/products.js'
import { batchStockIn, batchStockOut } from '../api/inventory.js'
import { MyModal } from '../components/ui/index.js'
import MyMessage from '../components/ui/MyMessage.js'

// 从父组件获取主题状态
const isDark = inject('isDark', ref(true))

// ═══════════════════════════════════════════════════════════
// 屏幕尺寸检测（用于控制只有一个 qr-reader 元素）
// ═══════════════════════════════════════════════════════════
const isMobile = ref(false)
function checkScreenSize() {
  isMobile.value = window.innerWidth < 1024
}

// ═══════════════════════════════════════════════════════════
// 扫码模式
// ═══════════════════════════════════════════════════════════
const scanMode = ref('out') // 'out' 批量出库, 'in' 批量入库

// ═══════════════════════════════════════════════════════════
// 运单绑定模式开关（一物一码）
// ═══════════════════════════════════════════════════════════
const oneToOneMode = ref(false)

// ═══════════════════════════════════════════════════════════
// 一物一码状态机
// ═══════════════════════════════════════════════════════════
const scanState = ref('idle') // 'idle' | 'waiting_tracking'
const pendingProduct = ref(null) // 待绑定运单的暂存商品

// ═══════════════════════════════════════════════════════════
// 扫描列表（在一物一码模式下，每项包含 tracking_number）
// ═══════════════════════════════════════════════════════════
const scannedItems = ref([])

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
// 确认弹窗状态
// ═══════════════════════════════════════════════════════════
const showClearConfirm = ref(false)
const showSwitchConfirm = ref(false)
const pendingSwitchMode = ref(null)

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

function playSuccessBeep() {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    // 两声短促的成功音
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.08)
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
  } catch (e) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════
// 防抖 & 错误提示常量
// ═══════════════════════════════════════════════════════════
const lastScannedSku = ref('')
const lastScanTime = ref(0)
const SCAN_COOLDOWN = 1500
const ERR_DURATION = 3000 // 错误弹窗持续时间（3秒，让工人看清）

// ═══════════════════════════════════════════════════════════
// 摄像头生命周期
// ═══════════════════════════════════════════════════════════

async function safeStopCamera() {
  console.log('[ScanStation] safeStopCamera called, current state:', { html5QrCodeExists: !!html5QrCode, scannerRunning: scannerRunning.value })
  try {
    if (html5QrCode && scannerRunning.value) {
      await html5QrCode.stop()
      scannerRunning.value = false
    }
  } catch (e) {
    console.warn('[ScanStation] 停止摄像头异常:', e?.message || e)
  }
  try {
    if (html5QrCode) {
      html5QrCode.clear()
    }
  } catch (e) {
    console.warn('[ScanStation] 清除摄像头异常:', e?.message || e)
  }
  html5QrCode = null
  scannerRunning.value = false
  console.log('[ScanStation] safeStopCamera 完成')
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

  // 先清理之前的实例
  await safeStopCamera()

  scannerError.value = ''
  cameraPermission.value = 'prompt'

  console.log('[ScanStation] 开始初始化摄像头...')

  // 根据屏幕大小选择不同的容器 ID
  const containerId = isMobile.value ? 'qr-reader-mobile' : 'qr-reader'

  // 检查容器是否存在
  const container = document.getElementById(containerId)
  if (!container) {
    console.error('[ScanStation] 容器不存在:', containerId)
    scannerError.value = '扫码容器未找到，请刷新页面重试'
    cameraPermission.value = 'denied'
    return
  }
  console.log('[ScanStation] 容器存在:', containerId)

  try {
    // 检查 Html5Qrcode 库是否已加载
    if (typeof Html5Qrcode === 'undefined') {
      scannerError.value = '扫码库未加载，请刷新页面重试'
      cameraPermission.value = 'denied'
      return
    }

    html5QrCode = new Html5Qrcode(containerId)

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    }

    console.log('[ScanStation] 启动 html5-qrcode...')

    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      onScanFailure
    )

    scannerRunning.value = true
    cameraPermission.value = 'granted'
    console.log('[ScanStation] 摄像头启动成功')

  } catch (err) {
    const errorName = err?.name || 'UnknownError'
    const errorMessage = err?.message || String(err) || '未知错误'
    console.warn('[ScanStation] 摄像头启动失败:', errorName, errorMessage)

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      scannerError.value = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问'
      cameraPermission.value = 'denied'
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      scannerError.value = '未检测到可用摄像头，请确认设备已连接摄像头'
      cameraPermission.value = 'denied'
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      scannerError.value = '摄像头被其他应用占用，请关闭其他程序'
    } else {
      scannerError.value = '摄像头启动失败: ' + errorMessage
      cameraPermission.value = 'denied'
    }
  } finally {
    isInitializing = false
  }
}

// ═══════════════════════════════════════════════════════════
// 取消一物一码绑定（用户主动取消当前等待运单扫码）
// ═══════════════════════════════════════════════════════════
function cancelOneToOneScan() {
  pendingProduct.value = null
  scanState.value = 'idle'
}

// ═══════════════════════════════════════════════════════════
// 扫码成功回调
// ═══════════════════════════════════════════════════════════
async function onScanSuccess(decodedText) {
  // submitting 状态锁：API 调用期间禁止扫码
  if (submitting.value) return

  const now = Date.now()
  if (decodedText === lastScannedSku.value && now - lastScanTime.value < SCAN_COOLDOWN) return
  lastScannedSku.value = decodedText
  lastScanTime.value = now

  // ════ 一物一码模式 ════
  if (oneToOneMode.value && scanMode.value === 'out') {
    
    // 状态 A【等待扫商品】-> 扫描到商品，暂存并等待运单
    if (scanState.value === 'idle') {
      // 检查是否已存在相同商品+运单组合（防止重复扫）
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
          // 暂存商品，进入等待运单状态
          pendingProduct.value = {
            id: product.id,
            sku_code: product.sku_code,
            name: product.name,
            current_stock: product.current_stock,
            scanned_at: new Date().toISOString(),
          }
          scanState.value = 'waiting_tracking'
          playBeep()
          // 触发提示音提示用户扫描运单
          setTimeout(() => playBeep(), 150)
        } else {
          playErrorBeep()
          MyMessage.error(`未找到商品: ${decodedText}`, ERR_DURATION)
        }
      } catch (e) {
        playErrorBeep()
        MyMessage.error('查询商品信息失败，请检查网络', ERR_DURATION)
      }
    }
    // 状态 B【等待扫运单】-> 扫描到运单，组装数据并加入列表
    else if (scanState.value === 'waiting_tracking') {
      const rawTracking = decodedText.trim()

      // 运单重复检测：如果已存在相同运单号的组合，明确提示
      const existingByTracking = scannedItems.value.findIndex(
        item => item.tracking_number === rawTracking
      )
      if (existingByTracking >= 0) {
        playErrorBeep()
        MyMessage.error('请勿重复扫描当前运单', ERR_DURATION)
        return
      }

      // 商品+运单组合重复检测
      const dupCheck = scannedItems.value.findIndex(
        item => item.sku_code === pendingProduct.value.sku_code && item.tracking_number === rawTracking
      )
      if (dupCheck >= 0) {
        playErrorBeep()
        MyMessage.warning('该商品已绑定此运单')
        return
      }

      // 组装数据：1个商品 + 1个运单号
      scannedItems.value.push({
        ...pendingProduct.value,
        quantity: 1,
        tracking_number: rawTracking,
        tracking_scanned_at: new Date().toISOString(),
      })

      pendingProduct.value = null
      scanState.value = 'idle'
      playSuccessBeep()
    }
    return
  }

  // ════ 普通模式（原逻辑）════
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
        MyMessage.error(`未找到商品: ${decodedText}`, ERR_DURATION)
      }
    } catch (e) {
      playErrorBeep()
      MyMessage.error('查询商品信息失败，请检查网络', ERR_DURATION)
    }
  }
}

function onScanFailure(error) {
  // 忽略扫描失败回调
}

// ═══════════════════════════════════════════════════════════
// 列表操作
// ═══════════════════════════════════════════════════════════
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
}

// ═══════════════════════════════════════════════════════════
// 切换模式
// ═══════════════════════════════════════════════════════════
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
  await safeStopCamera()
  await nextTick()
  setTimeout(() => { initScanner() }, 100)
}

// ═══════════════════════════════════════════════════════════
// 切换一物一码模式
// ═══════════════════════════════════════════════════════════
async function toggleOneToOneMode() {
  oneToOneMode.value = !oneToOneMode.value
  // 切换模式时重置状态
  pendingProduct.value = null
  scanState.value = 'idle'
  scannedItems.value = []
}

// ═══════════════════════════════════════════════════════════
// 提交批量操作
// ═══════════════════════════════════════════════════════════
async function handleSubmit() {
  if (scannedItems.value.length === 0) { MyMessage.warning('请先扫描商品'); return }

  submitting.value = true
  submitError.value = ''

  const items = scannedItems.value.map(item => ({
    product_id: item.id,
    quantity: item.quantity,
    tracking_number: item.tracking_number || null,
    note: `${scanMode.value === 'out' ? '批量出库' : '批量入库'}扫码`,
  }))

  try {
    let res
    if (scanMode.value === 'out') {
      // 出库
      res = await batchStockOut({ items })
    } else {
      res = await batchStockIn({ items })
    }

    if (res.data.success) {
      submitSuccess.value = true
      setTimeout(() => { submitSuccess.value = false }, 3000)
      scannedItems.value = []
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
    console.error('提交失败:', e)
    submitError.value = '网络错误，请检查网络连接'
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

// 状态提示文案
const scanStateHint = computed(() => {
  if (!oneToOneMode.value || scanMode.value !== 'out') return ''
  if (scanState.value === 'waiting_tracking') {
    return '等待扫描运单条码'
  }
  return '等待扫描商品条码'
})

// 状态提示类型（用于样式区分）
const scanStateType = computed(() => {
  if (scanState.value === 'waiting_tracking') return 'tracking'
  return 'product'
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
  // 先检测屏幕尺寸
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)

  visibilityHandler = handleVisibilityChange
  document.addEventListener('visibilitychange', visibilityHandler)

  // 等待 DOM 和响应式更新完成
  await nextTick()
  setTimeout(() => { initScanner() }, 300)
})

onUnmounted(async () => {
  window.removeEventListener('resize', checkScreenSize)
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  await safeStopCamera()
})
</script>

<template>
  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- 全局 Loading 遮罩层                                           -->
  <!-- ═══════════════════════════════════════════════════════════════ -->
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
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
              批量入库
            </button>
          </div>

          <!-- 运单绑定模式开关（仅出库模式显示） -->
          <div 
            v-if="scanMode === 'out'" 
            class="mt-3 flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200"
            :class="oneToOneMode 
              ? 'border-rose-400/50 bg-rose-50/60 dark:bg-rose-500/10' 
              : 'border-slate-200/60 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]'"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center"
                   :style="oneToOneMode
                     ? 'background: rgba(244,63,94,0.15);'
                     : 'background: var(--accent-bg);'">
                <svg xmlns="http://www.w3.org/2000/svg"
                  class="w-4.5 h-4.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :style="oneToOneMode ? 'color: #f43f5e;' : 'color: var(--accent);'"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold" :class="oneToOneMode ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'">
                  开启单件运单绑定
                </p>
                <p class="text-xs mt-0.5" :class="oneToOneMode ? 'text-rose-500/80 dark:text-rose-500/70' : 'text-slate-400 dark:text-slate-500'">
                  一物一码，每件商品独立绑定运单
                </p>
              </div>
            </div>
            <!-- Switch 开关 -->
            <button
              @click="toggleOneToOneMode"
              class="relative w-12 h-7 rounded-full transition-all duration-300 cursor-pointer focus:outline-none"
              :class="oneToOneMode ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'"
              style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);"
            >
              <span
                class="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300"
                :class="oneToOneMode ? 'left-6' : 'left-1'"
                style="box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
              ></span>
            </button>
          </div>

          <!-- 一物一码模式状态提示条 -->
          <div 
            v-if="oneToOneMode && scanMode === 'out' && scanStateHint"
            class="mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-center animate-pulse"
            :style="scanStateType === 'tracking'
              ? 'background: linear-gradient(135deg, rgba(244,63,94,0.12), rgba(244,63,94,0.06)); border: 1.5px solid rgba(244,63,94,0.3); color: #f43f5e; box-shadow: 0 0 16px rgba(244,63,94,0.15);'
              : 'background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06)); border: 1.5px solid rgba(99,102,241,0.3); color: #6366f1; box-shadow: 0 0 16px rgba(99,102,241,0.15);'"
          >
            <span v-if="scanStateType === 'tracking'">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
              </svg>
            </span>
            <span v-else>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </span>
            {{ scanStateHint }}
          </div>
        </div>

        <!-- 摄像头区域 -->
        <div class="relative flex-1 min-h-0 overflow-hidden">
          <!-- 摄像头渲染层 (PC端) -->
          <div v-if="!isMobile" id="qr-reader" class="absolute inset-0 !border-none !rounded-none"></div>

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

          <!-- 取消一物一码等待按钮 -->
          <button
            v-if="scanState === 'waiting_tracking'"
            @click="cancelOneToOneScan"
            class="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer
                   bg-rose-500/90 hover:bg-rose-600 text-white backdrop-blur-sm
                   shadow-lg shadow-rose-500/30 active:scale-95 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
            取消
          </button>

          <!-- 未启动占位 -->
          <div
            v-if="!scannerRunning"
            class="absolute inset-0 flex flex-col items-center justify-center"
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

        <!-- 一物一码模式说明卡片 -->
        <div
          v-if="oneToOneMode && scanMode === 'out'"
          class="rounded-xl overflow-hidden
                 bg-white dark:bg-slate-900
                 border border-rose-200 dark:border-rose-500/20
                 shadow-sm p-5"
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
                <p class="flex items-start gap-1.5">
                  <span class="text-rose-400 font-bold mt-0.5">1.</span>
                  <span>扫描商品条码 → 系统查询商品信息</span>
                </p>
                <p class="flex items-start gap-1.5">
                  <span class="text-rose-400 font-bold mt-0.5">2.</span>
                  <span>提示"请扫描运单条码" → 扫描运单条形码</span>
                </p>
                <p class="flex items-start gap-1.5">
                  <span class="text-rose-400 font-bold mt-0.5">3.</span>
                  <span>系统自动组装 1商品+1运单 记录到列表</span>
                </p>
                <p class="flex items-start gap-1.5">
                  <span class="text-rose-400 font-bold mt-0.5">4.</span>
                  <span>重复以上步骤，完成所有商品绑定后再提交</span>
                </p>
              </div>
            </div>
          </div>
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
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
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
                :key="item.sku_code + (item.tracking_number || '')"
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
                  <!-- 运单号标签（一物一码模式） -->
                  <div v-if="item.tracking_number" class="mt-1.5 flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400" style="background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2);">
                      运单: {{ item.tracking_number }}
                    </span>
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
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        :style="{ height: '38dvh', minHeight: '180px' }"
      >
        <!-- 摄像头渲染 (移动端) -->
        <div v-if="isMobile" id="qr-reader-mobile" class="absolute inset-0 !border-none !rounded-none"></div>

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

        <!-- 取消一物一码等待按钮（移动端） -->
        <button
          v-if="scanState === 'waiting_tracking'"
          @click="cancelOneToOneScan"
          class="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer
                 bg-rose-500/90 hover:bg-rose-600 text-white backdrop-blur-sm
                 shadow-lg shadow-rose-500/30 active:scale-95 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
          取消
        </button>

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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            </svg>
            批量入库
            <span v-if="scanMode === 'in'" class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style="background: #6366f1; box-shadow: 0 0 8px rgba(99,102,241,0.6);"></span>
          </button>
        </div>

        <!-- 一物一码状态提示条（移动端） -->
        <div 
          v-if="oneToOneMode && scanMode === 'out' && scanStateHint"
          class="absolute left-3 right-3 z-10 px-4 py-2.5 rounded-xl text-sm font-semibold text-center"
          :style="scanStateType === 'tracking'
            ? 'bottom: 56px; background: linear-gradient(135deg, rgba(244,63,94,0.92), rgba(244,63,94,0.82)); color: white; box-shadow: 0 4px 20px rgba(244,63,94,0.4);'
            : 'bottom: 56px; background: linear-gradient(135deg, rgba(99,102,241,0.92), rgba(99,102,241,0.82)); color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.4);'"
        >
          <span v-if="scanStateType === 'tracking'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6" y="6" width="4" height="4" rx="1"/>
            </svg>
          </span>
          <span v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1.5 align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            </svg>
          </span>
          {{ scanStateHint }}
        </div>

        <!-- 未启动占位 -->
        <div
          v-if="!scannerRunning"
          class="absolute inset-0 flex flex-col items-center justify-center"
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

        <!-- 一物一码模式开关（移动端） -->
        <div v-if="scanMode === 'out'" class="px-4 pb-3 flex-shrink-0">
          <div 
            class="flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200"
            :class="oneToOneMode 
              ? 'border-rose-400/50 bg-rose-50/60 dark:bg-rose-500/10' 
              : 'border-slate-200/60 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]'"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                   :style="oneToOneMode
                     ? 'background: rgba(244,63,94,0.15);'
                     : 'background: var(--accent-bg);'">
                <svg xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :style="oneToOneMode ? 'color: #f43f5e;' : 'color: var(--accent);'"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <div>
                <p class="text-xs font-semibold" :class="oneToOneMode ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'">
                  单件运单绑定
                </p>
                <p class="text-xs" :class="oneToOneMode ? 'text-rose-500/80' : 'text-slate-400'">
                  {{ oneToOneMode ? '一物一码模式' : '关闭' }}
                </p>
              </div>
            </div>
            <button
              @click="toggleOneToOneMode"
              class="relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer focus:outline-none"
              :class="oneToOneMode ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'"
              style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);"
            >
              <span
                class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300"
                :class="oneToOneMode ? 'left-[22px]' : 'left-0.5'"
                style="box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
              ></span>
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
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">尚未扫描商品</p>
          </div>

          <!-- 列表项 -->
          <div v-else class="space-y-2 pb-4">
            <div
              v-for="(item, index) in scannedItems"
              :key="item.sku_code + (item.tracking_number || '')"
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
                <!-- 运单号标签（移动端） -->
                <div v-if="item.tracking_number" class="mt-1">
                  <span class="px-2 py-0.5 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400" style="background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2);">
                    运单: {{ item.tracking_number }}
                  </span>
                </div>
              </div>
              <button
                @click="removeItem(index)"
                class="w-8 h-8 rounded-lg flex items-center justify-center ml-2
                       text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10
                       active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 底部提交 -->
        <div class="flex-shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 dark:border-white/5"
             :style="{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }">
          <!-- 成功提示 -->
          <div v-if="submitSuccess" class="mb-2.5 p-2.5 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 scale-in"
               style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981;">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
    <!-- 清空列表确认弹窗                                            -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <MyModal v-model="showClearConfirm" title="确认清空" width="max-w-sm" @confirm="confirmClearList">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            确定要清空已扫描的 <strong class="text-slate-900 dark:text-white">{{ scannedItems.length }}</strong> 件商品吗？
          </p>
          <p v-if="oneToOneMode && scannedItems.length > 0" class="text-xs text-rose-500 dark:text-rose-400 mt-1">
            注意：一物一码模式下，所有商品-运单绑定记录都将被清除
          </p>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">此操作不可恢复</p>
        </div>
      </div>
      <template #footer>
        <button @click="showClearConfirm = false" class="px-4 py-2.5 text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all"
          style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);">
          取消
        </button>
        <button @click="confirmClearList" class="px-5 py-2.5 text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer"
          style="background: linear-gradient(135deg, #f43f5e, #e11d48);">
          确认清空
        </button>
      </template>
    </MyModal>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 切换模式确认弹窗                                            -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <MyModal v-model="showSwitchConfirm" title="切换操作模式" width="max-w-sm" @confirm="confirmSwitchMode">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="m17 8 4 4m0 0-4 4m4-4H3"/>
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            切换模式将清空当前已扫描的 <strong class="text-slate-900 dark:text-white">{{ scannedItems.length }}</strong> 件商品
          </p>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">是否继续？</p>
        </div>
      </div>
      <template #footer>
        <button @click="showSwitchConfirm = false" class="px-4 py-2.5 text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all"
          style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);">
          取消
        </button>
        <button @click="confirmSwitchMode" class="px-5 py-2.5 text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer"
          style="background: var(--accent);">
          确认切换
        </button>
      </template>
    </MyModal>
  </div>
</template>

<style scoped>
/* ── Loading 遮罩过渡 ─────────────────────────────────────── */
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.2s ease;
}
.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

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
