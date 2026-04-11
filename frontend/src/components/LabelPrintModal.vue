<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

const props = defineProps({ visible: Boolean, product: Object })
const emit = defineEmits(['close'])

const labelSize = ref('40x30')
const qrCodeDataUrl = ref('')

async function generateQRCode() {
  if (!props.product?.sku_code) return
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(props.product.sku_code, {
      width: 256, margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    })
  } catch (err) {
    console.error('二维码生成失败:', err)
    qrCodeDataUrl.value = ''
  }
}

watch(() => props.visible, async (val) => {
  if (val && props.product) { await nextTick(); await generateQRCode() }
})
watch(() => props.product, async () => {
  if (props.visible && props.product) { await nextTick(); await generateQRCode() }
})

const sizeConfigs = {
  '40x30': { width: 40, height: 30, name: '40mm × 30mm' },
  '70x20': { width: 70, height: 20, name: '70mm × 20mm' }
}
const currentConfig = computed(() => sizeConfigs[labelSize.value])

function stripCategoryFromProductName(name, category) {
  if (!name) return ''
  const n = String(name).trim()
  const c = category ? String(category).trim() : ''
  if (!c || n.length < c.length) return n
  if (n.startsWith(c)) {
    let rest = n.slice(c.length)
    rest = rest.replace(/^[\s\-–—·•、，,]+/, '')
    return rest || n
  }
  return n
}

const labelProductTitle = computed(() => stripCategoryFromProductName(props.product?.name, props.product?.category_name))
const PX_PER_MM = 14

function mmToFontPx(mm) { return Math.round(mm * PX_PER_MM * 100) / 100 }

function wrapTextLines(ctx, text, maxWidth) {
  const lines = []
  if (!text) return lines
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

function truncateToWidth(ctx, text, maxWidth) {
  if (!text) return ''
  const ellipsis = '…'
  let s = text
  if (ctx.measureText(s).width <= maxWidth) return s
  while (s.length > 1 && ctx.measureText(s + ellipsis).width > maxWidth) { s = s.slice(0, -1) }
  return s + ellipsis
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function renderLabelToCanvas() {
  const widthMm = currentConfig.value.width
  const heightMm = currentConfig.value.height
  const cw = Math.round(widthMm * PX_PER_MM)
  const ch = Math.round(heightMm * PX_PER_MM)
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, cw * dpr)
  canvas.height = Math.max(1, ch * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cw, ch)
  const fontStack = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'

  if (labelSize.value === '40x30') {
    const p = props.product
    const sideMm = 1.5; const gap = 2.0; const categoryH = 2.5; const nameH = 1.75
    ctx.textAlign = 'center'
    let qrTopMm, QR
    if (p?.category_name) {
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#666666'
      ctx.font = `${mmToFontPx(2.8)}px ${fontStack}`
      ctx.fillText(p.category_name, cw / 2, (categoryH + gap) * PX_PER_MM)
      qrTopMm = categoryH + gap + gap
      QR = heightMm - qrTopMm - gap - nameH
    } else {
      qrTopMm = gap; QR = heightMm - gap * 2 - nameH
    }
    const qx = ((widthMm - QR) / 2) * PX_PER_MM
    const qrYpx = qrTopMm * PX_PER_MM
    if (qrCodeDataUrl.value) {
      const img = await loadImage(qrCodeDataUrl.value)
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, qx, qrYpx, QR * PX_PER_MM, QR * PX_PER_MM)
    }
    const shortTitle = stripCategoryFromProductName(p?.name || '', p?.category_name)
    const nameMaxW = Math.min((widthMm - sideMm * 2) * PX_PER_MM, 35 * PX_PER_MM)
    ctx.fillStyle = '#000000'
    ctx.font = `${mmToFontPx(1.75)}px ${fontStack}`
    ctx.textBaseline = 'alphabetic'
    const nameTruncated = truncateToWidth(ctx, shortTitle, nameMaxW)
    ctx.fillText(nameTruncated, cw / 2, (qrTopMm + QR + gap) * PX_PER_MM)
  } else {
    const p = props.product
    const leftMargin = 2; const QR = 14; const infoGap = 3
    const infoX = (leftMargin + QR + infoGap) * PX_PER_MM
    const infoW = (widthMm - leftMargin - QR - infoGap - leftMargin) * PX_PER_MM
    const lh = 3.1
    const line1Y = 3.8 * PX_PER_MM
    if (qrCodeDataUrl.value) {
      const img = await loadImage(qrCodeDataUrl.value)
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, leftMargin * PX_PER_MM, ((heightMm - QR) / 2) * PX_PER_MM, QR * PX_PER_MM, QR * PX_PER_MM)
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#000000'; ctx.font = `${mmToFontPx(2.47)}px ${fontStack}`
    const shortTitle = stripCategoryFromProductName(p?.name || '', p?.category_name)
    const nameLines = wrapTextLines(ctx, shortTitle, infoW)
    ctx.fillText(nameLines[0] || shortTitle, infoX, line1Y)
    ctx.fillStyle = '#505050'; ctx.font = `${mmToFontPx(1.94)}px ${fontStack}`
    ctx.fillText(`SKU: ${p?.sku_code || ''}`, infoX, line1Y + lh * PX_PER_MM)
    if (p?.location_code) { ctx.fillText(`库位: ${p.location_code}`, infoX, line1Y + lh * 2 * PX_PER_MM) }
    if (p?.category_name) {
      ctx.fillStyle = '#888888'; ctx.font = `${mmToFontPx(1.59)}px ${fontStack}`
      ctx.fillText(p.category_name, infoX, line1Y + lh * 3 * PX_PER_MM)
    }
  }
  return canvas
}

async function handlePrint() {
  if (!props.product || !qrCodeDataUrl.value) return
  const w = currentConfig.value.width; const h = currentConfig.value.height
  const canvas = await renderLabelToCanvas()
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'mm', format: [w, h] })
  pdf.addImage(imgData, 'PNG', 0, 0, w, h)
  const safeName = (props.product.name || '商品').replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50)
  const safeSku = (props.product.sku_code || 'UNKNOWN').replace(/[\/\\:*?"<>|]/g, '_')
  const fileName = `${safeName}_${safeSku}.pdf`
  const blob = pdf.output('blob')
  const blobUrl = URL.createObjectURL(blob)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title><style>*{margin:0;padding:0;height:100%;}body{display:flex;justify-content:center;align-items:center;background:#333;}embed{width:100%;height:100%;border:none;}</style></head><body><embed src="${blobUrl}" type="application/pdf"><script>document.title=${JSON.stringify(fileName)};<\/script></body></html>`
  const htmlBlob = new Blob([html], { type: 'text/html' })
  const htmlUrl = URL.createObjectURL(htmlBlob)
  window.open(htmlUrl, '_blank', 'noopener,noreferrer')
  setTimeout(() => { URL.revokeObjectURL(blobUrl); URL.revokeObjectURL(htmlUrl) }, 300000)
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>

      <div
        class="relative w-full max-w-2xl rounded-2xl overflow-hidden scale-in
               bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 shadow-xl"
      >
        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">打印标签</h3>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[240px]">{{ product?.name }} · {{ product?.sku_code }}</p>
            </div>
          </div>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- 标签规格选择 -->
        <div class="px-6 py-5">
          <div class="flex items-center gap-3 mb-6">
            <span class="text-sm font-medium text-slate-600 dark:text-slate-300">标签规格：</span>
            <div class="flex gap-2">
              <button
                v-for="(config, key) in sizeConfigs"
                :key="key"
                @click="labelSize = key"
                class="px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all cursor-pointer"
                :class="labelSize === key
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-400 hover:text-indigo-500'"
              >{{ config.name }}</button>
            </div>
          </div>

          <!-- 标签预览 -->
          <div class="flex justify-center mb-4">
            <div
              class="bg-white rounded overflow-hidden shrink-0 relative box-border"
              :style="{ width: currentConfig.width + 'mm', height: currentConfig.height + 'mm', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }"
            >
              <template v-if="labelSize === '40x30'">
                <div class="absolute inset-0 flex flex-col items-stretch text-black pt-[2mm] pb-[2mm] box-border">
                  <div v-if="product?.category_name" class="flex-none text-center text-gray-500 px-[1.5mm]" style="font-size: 2.05mm; line-height: 1.2">{{ product.category_name }}</div>
                  <div v-else class="flex-none min-h-0" />
                  <div class="flex-1 flex items-center justify-center min-h-0">
                    <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="二维码" class="object-contain" style="width: 19mm; height: 19mm" />
                    <div v-else class="flex items-center justify-center text-gray-400 bg-gray-100" style="width: 19mm; height: 19mm; font-size: 1.7mm">加载中</div>
                  </div>
                  <div class="flex-none px-[1.5mm] text-center min-h-0">
                    <span class="font-medium text-black block" style="font-size: 1.65mm; line-height: 1.25; max-width: 35mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">{{ labelProductTitle }}</span>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="absolute inset-0 flex flex-row items-stretch text-black">
                  <div class="flex-none flex items-center pl-[2mm]">
                    <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="二维码" class="object-contain" style="width: 14mm; height: 14mm" />
                    <div v-else class="flex items-center justify-center text-gray-400 bg-gray-100" style="width: 14mm; height: 14mm; font-size: 2mm">加载中</div>
                  </div>
                  <div class="flex-1 flex flex-col justify-center pl-[3mm] pr-[2mm] gap-[0.7mm] min-w-0">
                    <span class="font-medium text-black truncate block w-full" style="font-size: 2mm; line-height: 1.3">{{ labelProductTitle }}</span>
                    <span class="text-gray-500 truncate block w-full" style="font-size: 1.6mm; line-height: 1.3">SKU: {{ product?.sku_code }}</span>
                    <span v-if="product?.location_code" class="text-gray-500 truncate block w-full" style="font-size: 1.6mm; line-height: 1.3">库位: {{ product.location_code }}</span>
                    <span v-if="product?.category_name" class="text-gray-400 truncate block w-full" style="font-size: 1.4mm; line-height: 1.3">{{ product.category_name }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <p class="text-center text-xs text-slate-400 dark:text-slate-500">标签打印预览，接近实际打印尺寸（依显示器校准略有偏差）</p>
        </div>

        <!-- 底部按钮 -->
        <div class="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-3">
          <button @click="$emit('close')" class="flex-1 py-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
            取消
          </button>
          <button
            @click="handlePrint"
            :disabled="!qrCodeDataUrl"
            class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            确认打印
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.scale-in { animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes scale-in { 0% { opacity: 0; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }
</style>
