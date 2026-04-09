<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

const props = defineProps({
  visible: Boolean,
  product: Object
})

const emit = defineEmits(['close'])

const labelSize = ref('40x30')
const qrCodeDataUrl = ref('')

async function generateQRCode() {
  if (!props.product?.sku_code) return
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(props.product.sku_code, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    })
  } catch (err) {
    console.error('二维码生成失败:', err)
    qrCodeDataUrl.value = ''
  }
}

watch(() => props.visible, async (val) => {
  if (val && props.product) {
    await nextTick()
    await generateQRCode()
  }
})
watch(() => props.product, async () => {
  if (props.visible && props.product) {
    await nextTick()
    await generateQRCode()
  }
})

const sizeConfigs = {
  '40x30': { width: 40, height: 30, name: '40mm × 30mm' },
  '70x20': { width: 70, height: 20, name: '70mm × 20mm' }
}
const currentConfig = computed(() => sizeConfigs[labelSize.value])

/** 商品名若以大类开头则去掉重复前缀（大类单独印在顶部时） */
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

/** 标签上展示的商品短标题（不含重复大类） */
const labelProductTitle = computed(() =>
  stripCategoryFromProductName(props.product?.name, props.product?.category_name)
)

/** 导出用分辨率：越大越清晰（整页栅格进 PDF，文字为位图但足够清晰） */
const PX_PER_MM = 14

/**
 * 字号换算为 px。Canvas 的 font 不支持可靠的 mm 单位，必须用 px；
 * 与画布坐标一致：版心 1mm ≈ PX_PER_MM 像素，故「标签上约 Xmm 高」的字号取 X * PX_PER_MM px。
 */
function mmToFontPx(mm) {
  return Math.round(mm * PX_PER_MM * 100) / 100
}

function wrapTextLines(ctx, text, maxWidth) {
  const lines = []
  if (!text) return lines
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** 将文字截断至不超过 maxWidth 像素，末尾保留省略号 */
function truncateToWidth(ctx, text, maxWidth) {
  if (!text) return ''
  const ellipsis = '…'
  let s = text
  if (ctx.measureText(s).width <= maxWidth) return s
  while (s.length > 1 && ctx.measureText(s + ellipsis).width > maxWidth) {
    s = s.slice(0, -1)
  }
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

/**
 * 整页绘制到 Canvas：中文用系统字体，避免 jsPDF 内置字体/OTF 兼容问题导致「只有二维码」
 *
 * 标签尺寸与内容分配：
 *   40x30mm：上下留白对称 → 大类(较大灰字) → 大二维码 → 商品名(较小黑字)；无库位、无描边
 *   70x20mm：左二维码 + 右文字，充分利用 70×20mm
 *     - 二维码 14mm（高度方向垂直居中）
 *     - 商品名 8pt、SKU 6pt、库位 6pt、类别 5pt
 *     - 左边距 2mm，二维码后 3mm 间距，右边距 2mm
 */
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
  // 不绘制外框：热敏/标签打印通常为白底无边线，避免实物出现黑边

  const fontStack = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'

  // ===== 40×30mm：商品名单行，二维码上下间距对称、尽量大 =====
  if (labelSize.value === '40x30') {
    const p = props.product
    const sideMm = 1.5
    const gap = 2.0       // 二维码上下与文字的间距（相等）
    const categoryH = 2.5 // 大类估算行高（mm）
    const nameH = 1.75    // 商品名行高（mm）

    ctx.textAlign = 'center'

    let qrTopMm, QR

    if (p?.category_name) {
      // 大类：约 2.8mm 字高（灰），紧贴顶部
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#666666'
      ctx.font = `${mmToFontPx(2.8)}px ${fontStack}`
      ctx.fillText(p.category_name, cw / 2, (categoryH + gap) * PX_PER_MM)
      // 二维码：大类下方 + gap，对称布局：30 - top - QR - gap - nameH = bottomGap
      qrTopMm = categoryH + gap + gap
      QR = heightMm - qrTopMm - gap - nameH
    } else {
      // 无大类：二维码上下间隙相等，居中最大化
      qrTopMm = gap
      QR = heightMm - gap * 2 - nameH
    }

    const qx = ((widthMm - QR) / 2) * PX_PER_MM
    const qrYpx = qrTopMm * PX_PER_MM
    if (qrCodeDataUrl.value) {
      const img = await loadImage(qrCodeDataUrl.value)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, qx, qrYpx, QR * PX_PER_MM, QR * PX_PER_MM)
    }

    // 商品名：单行，约 1.75mm 字高（比大类小），宽度最多 35mm（超出截断）
    const shortTitle = stripCategoryFromProductName(p?.name || '', p?.category_name)
    const nameMaxW = Math.min((widthMm - sideMm * 2) * PX_PER_MM, 35 * PX_PER_MM)
    ctx.fillStyle = '#000000'
    ctx.font = `${mmToFontPx(1.75)}px ${fontStack}`
    ctx.textBaseline = 'alphabetic'
    const nameTruncated = truncateToWidth(ctx, shortTitle, nameMaxW)
    ctx.fillText(nameTruncated, cw / 2, (qrTopMm + QR + gap) * PX_PER_MM)

  // ===== 70×20mm：左二维码 + 右文字 =====
  } else {
    const p = props.product
    const leftMargin = 2
    const QR = 14
    const infoGap = 3
    const infoX = (leftMargin + QR + infoGap) * PX_PER_MM
    const infoW = (widthMm - leftMargin - QR - infoGap - leftMargin) * PX_PER_MM
    const lh = 3.1

    // 第一行基准 Y（顶部留 3mm）
    const line1Y = 3.8 * PX_PER_MM

    // 二维码（垂直居中）
    if (qrCodeDataUrl.value) {
      const img = await loadImage(qrCodeDataUrl.value)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, leftMargin * PX_PER_MM, ((heightMm - QR) / 2) * PX_PER_MM, QR * PX_PER_MM, QR * PX_PER_MM)
    }

    // 商品名称
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#000000'
    ctx.font = `${mmToFontPx(2.47)}px ${fontStack}`
    const shortTitle = stripCategoryFromProductName(p?.name || '', p?.category_name)
    const nameLines = wrapTextLines(ctx, shortTitle, infoW)
    ctx.fillText(nameLines[0] || shortTitle, infoX, line1Y)

    // SKU
    ctx.fillStyle = '#505050'
    ctx.font = `${mmToFontPx(1.94)}px ${fontStack}`
    ctx.fillText(`SKU: ${p?.sku_code || ''}`, infoX, line1Y + lh * PX_PER_MM)

    // 库位
    if (p?.location_code) {
      ctx.fillText(`库位: ${p.location_code}`, infoX, line1Y + lh * 2 * PX_PER_MM)
    }

    // 大类名称
    if (p?.category_name) {
      ctx.fillStyle = '#888888'
      ctx.font = `${mmToFontPx(1.59)}px ${fontStack}`
      ctx.fillText(p.category_name, infoX, line1Y + lh * 3 * PX_PER_MM)
    }
  }

  return canvas
}

async function handlePrint() {
  if (!props.product || !qrCodeDataUrl.value) return

  const w = currentConfig.value.width
  const h = currentConfig.value.height

  const canvas = await renderLabelToCanvas()
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({
    orientation: w > h ? 'l' : 'p',
    unit: 'mm',
    format: [w, h]
  })
  pdf.addImage(imgData, 'PNG', 0, 0, w, h)

  const safeName = (props.product.name || '商品').replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50)
  const safeSku = (props.product.sku_code || 'UNKNOWN').replace(/[\/\\:*?"<>|]/g, '_')
  const fileName = `${safeName}_${safeSku}.pdf`

  const blob = pdf.output('blob')
  const blobUrl = URL.createObjectURL(blob)

  // 用 HTML 包装页打开 PDF，可同时设置标签页标题（文件名）
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    *{margin:0;padding:0;height:100%;}
    body{display:flex;justify-content:center;align-items:center;background:#333;}
    embed{width:100%;height:100%;border:none;}
  </style>
</head>
<body>
  <embed src="${blobUrl}" type="application/pdf">
  <script>document.title=${JSON.stringify(fileName)};<\/script>
</body>
</html>`
  const htmlBlob = new Blob([html], { type: 'text/html' })
  const htmlUrl = URL.createObjectURL(htmlBlob)
  window.open(htmlUrl, '_blank', 'noopener,noreferrer')

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
    URL.revokeObjectURL(htmlUrl)
  }, 300000) // 5min 后释放
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleClose"></div>

      <div class="relative w-full max-w-2xl bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        <div class="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">打印标签</h3>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">
              {{ product?.name }} · {{ product?.sku_code }}
            </p>
          </div>
          <button type="button" @click="handleClose" class="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-lg transition-all duration-150">✕</button>
        </div>

        <div class="p-6">
          <div class="flex items-center gap-3 mb-6">
            <span class="text-sm text-[var(--text-muted)]">标签规格：</span>
            <div class="flex gap-2">
              <button
                v-for="(config, key) in sizeConfigs"
                :key="key"
                type="button"
                @click="labelSize = key"
                :class="['px-4 py-2 text-sm rounded-lg border transition-all duration-150',
                  labelSize === key ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                   : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)]']"
              >{{ config.name }}</button>
            </div>
          </div>

          <div class="flex justify-center mb-4 overflow-x-auto">
            <div
              class="bg-white rounded overflow-hidden shrink-0 relative box-border shadow-[0_2px_14px_rgba(0,0,0,0.12)]"
              :style="{ width: currentConfig.width + 'mm', height: currentConfig.height + 'mm' }"
            >
              <template v-if="labelSize === '40x30'">
                <div class="absolute inset-0 flex flex-col items-stretch text-black pt-[2mm] pb-[2mm] box-border">
                  <!-- 大类：紧贴顶部，字号大于下方商品 -->
                  <div v-if="product?.category_name" class="flex-none text-center text-gray-500 px-[1.5mm]" style="font-size: 2.05mm; line-height: 1.2">
                    {{ product.category_name }}
                  </div>
                  <div v-else class="flex-none min-h-0" />
                  <!-- 二维码：占满中间，视觉约 19mm -->
                  <div class="flex-1 flex items-center justify-center min-h-0">
                    <img
                      v-if="qrCodeDataUrl"
                      :src="qrCodeDataUrl"
                      alt="二维码"
                      class="object-contain"
                      style="width: 19mm; height: 19mm"
                    />
                    <div
                      v-else
                      class="flex items-center justify-center text-gray-400 bg-gray-100"
                      style="width: 19mm; height: 19mm; font-size: 1.7mm"
                    >
                      加载中
                    </div>
                  </div>
                  <!-- 商品名：单行，最多 35mm 宽，字号小于大类 -->
                  <div class="flex-none px-[1.5mm] text-center min-h-0">
                    <span class="font-medium text-black block" style="font-size: 1.65mm; line-height: 1.25; max-width: 35mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">{{ labelProductTitle }}</span>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="absolute inset-0 flex flex-row items-stretch text-black">
                  <!-- 二维码 14mm，垂直居中 -->
                  <div class="flex-none flex items-center pl-[2mm]">
                    <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="二维码" class="object-contain" style="width: 14mm; height: 14mm" />
                    <div v-else class="flex items-center justify-center text-gray-400 bg-gray-100" style="width: 14mm; height: 14mm; font-size: 2mm">加载中</div>
                  </div>
                  <!-- 右侧文字信息 -->
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

          <div class="text-center text-xs text-[var(--text-muted)] mb-2">
            标签打印预览，接近实际打印尺寸（依显示器校准略有偏差）
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80">
          <button type="button" @click="handleClose" class="px-5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer">取消</button>
          <button type="button" @click="handlePrint" :disabled="!qrCodeDataUrl" class="px-5 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-150 cursor-pointer">确认打印</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
