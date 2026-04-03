<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

const props = defineProps({
  visible: Boolean,
  product: Object
})

const emit = defineEmits(['close'])

// 当前选中的标签规格
const labelSize = ref('40x30') // '40x30' 或 '70x20'

// 二维码数据URL
const qrCodeDataUrl = ref('')
const qrCanvasRef = ref(null)

// 生成二维码
async function generateQRCode() {
  if (!props.product?.sku_code) return
  
  try {
    const data = props.product.sku_code
    qrCodeDataUrl.value = await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
  } catch (err) {
    console.error('二维码生成失败:', err)
    qrCodeDataUrl.value = ''
  }
}

// 监听弹窗打开和商品变化
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

// 标签尺寸配置（毫米转像素，1mm ≈ 3.78px at 96dpi）
const sizeConfigs = {
  '40x30': {
    width: 40,
    height: 30,
    name: '40mm × 30mm',
    // 预览时的像素尺寸（放大显示）
    previewWidth: 300,
    previewHeight: 225
  },
  '70x20': {
    width: 70,
    height: 20,
    name: '70mm × 20mm',
    previewWidth: 420,
    previewHeight: 120
  }
}

const currentConfig = computed(() => sizeConfigs[labelSize.value])

// 预览缩放比例
const previewScale = computed(() => currentConfig.value.previewWidth / currentConfig.value.width)

// 打印函数
async function handlePrint() {
  if (!props.product || !qrCodeDataUrl.value) return

  // 物理尺寸（毫米）
  const width = currentConfig.value.width
  const height = currentConfig.value.height
  
  // 创建 PDF（自定义尺寸，单位毫米）
  const pdf = new jsPDF({
    orientation: width > height ? 'l' : 'p',
    unit: 'mm',
    format: [width, height]
  })

  // 白色背景
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, width, height, 'F')

  // 边框
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.2)
  pdf.rect(0, 0, width, height)

  if (labelSize.value === '40x30') {
    // ========== 40x30mm 标签排版 ==========
    // 上方：商品大类名称
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(props.product.category_name || '', width / 2, 5, { align: 'center' })

    // 中间：二维码
    const qrSize = 18
    const qrX = (width - qrSize) / 2
    const qrY = 7
    try {
      pdf.addImage(qrCodeDataUrl.value, 'PNG', qrX, qrY, qrSize, qrSize)
    } catch (e) {
      console.error('添加二维码到PDF失败:', e)
    }

    // 下方：商品名称（可能需要换行）
    pdf.setFontSize(7)
    pdf.setTextColor(0, 0, 0)
    const productName = props.product.name || ''
    const maxNameWidth = width - 4
    const lines = pdf.splitTextToSize(productName, maxNameWidth)
    
    // 如果名称太长，分两行显示
    if (lines.length <= 2) {
      pdf.text(lines, width / 2, 27, { align: 'center', lineHeightFactor: 1.2 })
    } else {
      // 只取前两行
      pdf.text([lines[0], lines[1]], width / 2, 26, { align: 'center', lineHeightFactor: 1.2 })
    }

    // 库位信息（底部）
    if (props.product.location_code) {
      pdf.setFontSize(6)
      pdf.setTextColor(80, 80, 80)
      pdf.text(`库位: ${props.product.location_code}`, width / 2, 29, { align: 'center' })
    }

  } else {
    // ========== 70x20mm 标签排版 ==========
    // 左边：二维码
    const qrSize = 16
    const qrMargin = 2
    try {
      pdf.addImage(qrCodeDataUrl.value, 'PNG', qrMargin, (height - qrSize) / 2, qrSize, qrSize)
    } catch (e) {
      console.error('添加二维码到PDF失败:', e)
    }

    // 右边：商品名称和库位
    const infoX = qrMargin + qrSize + 3
    const infoWidth = width - infoX - qrMargin

    // 商品名称（上方）
    pdf.setFontSize(8)
    pdf.setTextColor(0, 0, 0)
    const productName = props.product.name || ''
    const lines = pdf.splitTextToSize(productName, infoWidth)
    
    // 只取第一行（标签宽度有限）
    const displayName = lines[0] || productName
    pdf.text(displayName, infoX, 7, { lineHeightFactor: 1.2 })

    // SKU码
    pdf.setFontSize(6)
    pdf.setTextColor(80, 80, 80)
    pdf.text(`SKU: ${props.product.sku_code || ''}`, infoX, 11)

    // 库位信息
    if (props.product.location_code) {
      pdf.setFontSize(6)
      pdf.setTextColor(80, 80, 80)
      pdf.text(`库位: ${props.product.location_code}`, infoX, 15)
    }

    // 大类名称（底部）
    if (props.product.category_name) {
      pdf.setFontSize(5)
      pdf.setTextColor(120, 120, 120)
      pdf.text(props.product.category_name, infoX, 18)
    }
  }

  // 生成文件名：商品名称_SKU编码.pdf
  const safeName = (props.product.name || '商品')
    .replace(/[\/\\:*?"<>|]/g, '_')  // 替换非法字符
    .substring(0, 50)  // 限制长度
  const safeSku = (props.product.sku_code || 'UNKNOWN')
    .replace(/[\/\\:*?"<>|]/g, '_')
  
  const fileName = `${safeName}_${safeSku}.pdf`
  
  // 下载 PDF
  pdf.save(fileName)
}

// 关闭弹窗
function handleClose() {
  emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- 遮罩层 -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleClose"></div>
      
      <div class="relative w-full max-w-2xl bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        <!-- 头部 -->
        <div class="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">打印标签</h3>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">
              {{ product?.name }} · {{ product?.sku_code }}
            </p>
          </div>
          <button
            @click="handleClose"
            class="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-lg transition-all duration-150"
          >
            ✕
          </button>
        </div>

        <!-- 内容区 -->
        <div class="p-6">
          <!-- 规格切换 -->
          <div class="flex items-center gap-3 mb-6">
            <span class="text-sm text-[var(--text-muted)]">标签规格：</span>
            <div class="flex gap-2">
              <button
                v-for="(config, key) in sizeConfigs"
                :key="key"
                @click="labelSize = key"
                :class="[
                  'px-4 py-2 text-sm rounded-lg border transition-all duration-150',
                  labelSize === key
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
                ]"
              >
                {{ config.name }}
              </button>
            </div>
          </div>

          <!-- 标签预览区 -->
          <div class="flex justify-center mb-6">
            <div class="relative" :style="{
              width: currentConfig.previewWidth + 'px',
              height: currentConfig.previewHeight + 'px'
            }">
              <!-- 标签背景 -->
              <div 
                class="absolute inset-0 bg-white border-2 border-black rounded shadow-lg overflow-hidden"
                :style="{ transform: `scale(1)`, transformOrigin: 'top left' }"
              >
                <!-- 40x30mm 布局 -->
                <template v-if="labelSize === '40x30'">
                  <!-- 上方：大类名称 -->
                  <div class="absolute top-[5px] left-0 right-0 text-center">
                    <span class="text-[10px] text-gray-500">{{ product?.category_name }}</span>
                  </div>
                  
                  <!-- 中间：二维码 -->
                  <div class="absolute top-[15px] left-1/2 -translate-x-1/2">
                    <img 
                      v-if="qrCodeDataUrl" 
                      :src="qrCodeDataUrl" 
                      class="w-[60px] h-[60px]" 
                      alt="二维码"
                    />
                    <div v-else class="w-[60px] h-[60px] bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                      加载中
                    </div>
                  </div>
                  
                  <!-- 下方：商品名称 -->
                  <div class="absolute bottom-[18px] left-0 right-0 text-center px-1">
                    <span class="text-[9px] text-black font-medium leading-tight block">
                      {{ product?.name }}
                    </span>
                  </div>
                  
                  <!-- 库位信息 -->
                  <div class="absolute bottom-[4px] left-0 right-0 text-center">
                    <span class="text-[7px] text-gray-600" v-if="product?.location_code">
                      库位: {{ product.location_code }}
                    </span>
                  </div>
                </template>

                <!-- 70x20mm 布局 -->
                <template v-else>
                  <!-- 左边：二维码 -->
                  <div class="absolute left-[4px] top-1/2 -translate-y-1/2">
                    <img 
                      v-if="qrCodeDataUrl" 
                      :src="qrCodeDataUrl" 
                      class="w-[48px] h-[48px]" 
                      alt="二维码"
                    />
                    <div v-else class="w-[48px] h-[48px] bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                      加载中
                    </div>
                  </div>
                  
                  <!-- 右边：商品信息 -->
                  <div class="absolute left-[58px] right-[4px] top-1 bottom-0 flex flex-col justify-center gap-0.5">
                    <span class="text-[10px] text-black font-medium truncate">{{ product?.name }}</span>
                    <span class="text-[7px] text-gray-500">SKU: {{ product?.sku_code }}</span>
                    <span class="text-[7px] text-gray-500" v-if="product?.location_code">
                      库位: {{ product.location_code }}
                    </span>
                    <span class="text-[6px] text-gray-400">{{ product?.category_name }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- 实际尺寸说明 -->
          <div class="text-center text-xs text-[var(--text-muted)] mb-4">
            实际打印尺寸：{{ currentConfig.name }} ({{ currentConfig.width }}mm × {{ currentConfig.height }}mm)
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80">
          <button
            @click="handleClose"
            class="px-5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
          >
            取消
          </button>
          <button
            @click="handlePrint"
            :disabled="!qrCodeDataUrl"
            class="px-5 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-150 cursor-pointer"
          >
            确认打印
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
