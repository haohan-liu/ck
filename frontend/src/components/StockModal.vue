<script setup>
import { ref, computed, watch, inject } from 'vue'
import { stockIn, stockOut, stockAdjust } from '../api/inventory.js'

const isDark = inject('isDark', ref(true))

const props = defineProps({
  visible: Boolean,
  product: Object,
  mode: { type: String, default: 'in' },
})
const emit = defineEmits(['close', 'success'])

const DEBOUNCE_MS = 800
let debounceTimer = null

const quantity = ref(0)
const note = ref('')
const trackingNumber = ref('')
const submitting = ref(false)
const formError = ref('')
const successMsg = ref('')

const MODE_CONFIG = {
  in: {
    title: '入库',
    action: '确认入库',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    glow: 'rgba(16,185,129,0.3)',
    textColor: '#10b981',
    hint: '输入入库数量，系统将累加到当前库存',
    quantityHint: '入库数量（正整数）',
  },
  out: {
    title: '出库',
    action: '确认出库',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    glow: 'rgba(239,68,68,0.3)',
    textColor: '#ef4444',
    hint: '输入出库数量，系统将从当前库存扣减',
    quantityHint: '出库数量（正整数，不能超过当前库存）',
  },
  adjust: {
    title: '库存调整',
    action: '确认调整',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    glow: 'rgba(245,158,11,0.3)',
    textColor: '#f59e0b',
    hint: '直接设置目标库存数量（原库存将被覆盖）',
    quantityHint: '调整后的目标库存（填入最终数量）',
  },
}

const config = computed(() => MODE_CONFIG[props.mode] || MODE_CONFIG.in)

const previewStock = computed(() => {
  if (!props.product) return 0
  const cur = props.product.current_stock || 0
  const qty = Number(quantity.value) || 0
  if (props.mode === 'in') return cur + qty
  if (props.mode === 'out') return Math.max(0, cur - qty)
  return qty
})

const previewDiff = computed(() => {
  if (!props.product) return 0
  const cur = props.product.current_stock || 0
  if (props.mode === 'adjust') return (Number(quantity.value) || 0) - cur
  return Number(quantity.value) || 0
})

const outOverWarning = computed(() => {
  if (props.mode !== 'out' || !props.product) return ''
  const qty = Number(quantity.value) || 0
  const cur = props.product.current_stock || 0
  if (qty > cur) return `超出当前库存 ${qty - cur} 件，无法出库`
  return ''
})

const adjustPreview = computed(() => {
  if (props.mode !== 'adjust' || !props.product) return ''
  const cur = props.product.current_stock || 0
  const target = Number(quantity.value) || 0
  const diff = target - cur
  if (diff > 0) return `将增加 ${diff} 件`
  if (diff < 0) return `将减少 ${Math.abs(diff)} 件`
  return '库存不变'
})

const trackingHint = computed(() => {
  if (props.mode !== 'out' || !trackingNumber.value.trim()) return ''
  return `将绑定运单号 "${trackingNumber.value.trim()}" 出库`
})

const isDebouncing = computed(() => !!debounceTimer)

const previewColor = computed(() => {
  if (successMsg.value) return config.value.textColor
  if (previewDiff.value > 0) return config.value.textColor
  if (previewDiff.value < 0) return '#ef4444'
  return 'inherit'
})

watch(() => props.visible, (val) => {
  if (val) {
    quantity.value = 0
    note.value = ''
    trackingNumber.value = ''
    formError.value = ''
    successMsg.value = ''
    clearDebounce()
  }
})

function clearDebounce() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
}

function validate() {
  formError.value = ''
  const qty = Number(quantity.value)
  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    formError.value = '数量必须为正整数'
    return false
  }
  if (props.mode === 'out' && qty > (props.product?.current_stock || 0)) {
    formError.value = '出库数量不能超过当前库存'
    return false
  }
  if (props.mode === 'adjust' && qty < 0) {
    formError.value = '调整后库存不能为负数'
    return false
  }
  return true
}

async function submit() {
  if (!validate()) return
  if (isDebouncing.value) return

  submitting.value = true
  debounceTimer = setTimeout(() => { clearDebounce() }, DEBOUNCE_MS)

  const basePayload = {
    product_id: props.product.id,
    quantity: Number(quantity.value),
    note: note.value.trim(),
    operator: 'system',
  }
  if (props.mode === 'out' && trackingNumber.value.trim()) {
    basePayload.tracking_number = trackingNumber.value.trim()
  }

  try {
    let res
    if (props.mode === 'in') res = await stockIn(basePayload)
    else if (props.mode === 'out') res = await stockOut(basePayload)
    else res = await stockAdjust(basePayload)

    successMsg.value = res.data.message || '操作成功'
    emit('success', { mode: props.mode, ...res.data })
  } catch (e) {
    formError.value = e.response?.data?.error || '操作失败，请重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>

      <!-- 弹窗主体 -->
      <div
        class="relative w-full max-w-md rounded-2xl overflow-hidden scale-in
               bg-white dark:bg-slate-900
               border border-slate-100 dark:border-white/10
               shadow-xl"
      >
        <!-- 标题栏：主题色描边 -->
        <div
          class="px-6 py-4 flex items-center justify-between flex-shrink-0"
          :style="{
            borderBottom: `1px solid ${config.textColor}30`,
            background: `${config.textColor}08`
          }"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" :style="{ background: config.gradient + '20' }">
              <svg v-if="mode === 'in'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :style="{ color: config.textColor }">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
              <svg v-else-if="mode === 'out'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :style="{ color: config.textColor }">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :style="{ color: config.textColor }">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">{{ config.title }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{{ product?.name }}</p>
            </div>
          </div>
          <button
            @click="$emit('close')"
            class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- 内容区 -->
        <div class="px-6 py-5 space-y-5">

          <!-- 库存预览卡片 -->
          <div class="rounded-xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
            <div class="flex items-center gap-4">
              <div class="text-center flex-1">
                <p class="text-xs text-slate-400 dark:text-slate-500 mb-1">当前库存</p>
                <p class="text-2xl font-bold text-slate-900 dark:text-white leading-none">{{ product?.current_stock ?? 0 }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{{ product?.unit || '件' }}</p>
              </div>
              <div class="flex flex-col items-center">
                <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mb-1"></div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
                <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mt-1"></div>
              </div>
              <div class="text-center flex-1">
                <p class="text-xs text-slate-400 dark:text-slate-500 mb-1">操作后库存</p>
                <p class="text-2xl font-bold leading-none" :style="{ color: previewColor }">
                  {{ previewStock }}
                </p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">{{ product?.unit || '件' }}</p>
              </div>
            </div>
          </div>

          <p class="text-xs text-slate-400 dark:text-slate-500 -mt-1">{{ config.hint }}</p>

          <!-- 数量输入 — Apple 风格大 Input -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {{ config.quantityHint }} <span class="text-rose-500">*</span>
            </label>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              :max="mode === 'out' ? product?.current_stock : undefined"
              placeholder="0"
              class="w-full py-4 px-6 rounded-xl text-xl text-center font-bold
                     bg-slate-50 dark:bg-slate-800
                     border-2 border-transparent
                     text-slate-900 dark:text-white
                     placeholder-slate-300 dark:placeholder-slate-600
                     focus:outline-none transition-all"
              :class="formError ? 'border-rose-400 dark:border-rose-500' : 'focus:border-indigo-500'"
              @keyup.enter="submit"
            />
            <p v-if="outOverWarning" class="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
              </svg>
              {{ outOverWarning }}
            </p>
            <p v-if="mode === 'adjust' && quantity > 0" class="text-xs mt-1.5" style="color: var(--warning);">{{ adjustPreview }}</p>
          </div>

          <!-- 运单号（仅出库） -->
          <Transition name="field-expand">
            <div v-if="mode === 'out'">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                运单号
                <span class="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">选填，绑定后可在日志中追溯</span>
              </label>
              <div class="relative">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400">
                    <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
                  </svg>
                </div>
                <input
                  v-model="trackingNumber"
                  type="text"
                  placeholder="请输入或扫码运单号"
                  class="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-slate-900 dark:text-white
                         bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                         placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>
              <p v-if="trackingHint" class="text-xs mt-1.5 flex items-center gap-1" style="color: var(--info);">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                </svg>
                {{ trackingHint }}
              </p>
            </div>
          </Transition>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">备注说明</label>
            <textarea
              v-model="note"
              rows="2"
              placeholder="选填，如：供应商送货 / 客户订单 / 盘点修正"
              class="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white
                     bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                     placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-all resize-none leading-relaxed"
            ></textarea>
          </div>

          <!-- 错误 -->
          <div v-if="formError" class="flex items-start gap-2.5 p-3.5 rounded-xl text-sm bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            {{ formError }}
          </div>

          <!-- 成功 -->
          <div v-if="successMsg" class="flex items-center gap-2.5 p-3.5 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
            </svg>
            {{ successMsg }}
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-3 flex-shrink-0">
          <button
            @click="$emit('close')"
            class="flex-1 py-2.5 text-sm font-medium rounded-xl
                   bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300
                   border border-slate-200 dark:border-white/10
                   hover:bg-slate-200 dark:hover:bg-white/10
                   active:scale-95 transition-all cursor-pointer"
          >
            关闭
          </button>
          <button
            @click="submit"
            :disabled="submitting || isDebouncing || !!formError || !!outOverWarning || quantity <= 0"
            class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98]"
            :style="(submitting || isDebouncing || !!formError || !!outOverWarning || quantity <= 0) ? '' : `background: ${config.gradient}; box-shadow: 0 4px 14px ${config.glow};`"
          >
            <span v-if="submitting" class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              处理中...
            </span>
            <span v-else-if="isDebouncing" class="flex items-center justify-center gap-1.5">
              <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ DEBOUNCE_MS / 1000 }}s 防抖中…
            </span>
            <span v-else>{{ config.action }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.scale-in { animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes scale-in { 0% { opacity: 0; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }

.field-expand-enter-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
.field-expand-leave-active { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
.field-expand-enter-from, .field-expand-leave-to { opacity: 0; max-height: 0; margin-top: 0; }
.field-expand-enter-to, .field-expand-leave-from { opacity: 1; max-height: 120px; }

input[type="number"] { -moz-appearance: textfield; }
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
