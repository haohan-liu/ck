<script setup>
import { ref, computed, watch } from 'vue'
import { stockIn, stockOut, stockAdjust } from '../api/inventory.js'

const props = defineProps({
  visible: Boolean,
  product: Object,
  mode: {
    type: String,
    default: 'in',
  },
})
const emit = defineEmits(['close', 'success'])

const DEBOUNCE_MS = 800
let debounceTimer = null

const quantity = ref(0)
const note = ref('')
const submitting = ref(false)
const formError = ref('')
const successMsg = ref('')

const MODE_CONFIG = {
  in: {
    title: '入库',
    action: '入库',
    color: 'emerald',
    hint: '输入入库数量，系统将累加到当前库存',
    quantityHint: '入库数量（正整数）',
  },
  out: {
    title: '出库',
    action: '确认出库',
    color: 'red',
    hint: '输入出库数量，系统将从当前库存扣减',
    quantityHint: '出库数量（正整数，不能超过当前库存）',
  },
  adjust: {
    title: '库存调整',
    action: '确认调整',
    color: 'amber',
    hint: '直接设置目标库存数量（原库存将被覆盖）',
    quantityHint: '调整后的目标库存（填入最终数量）',
  },
}

const config = computed(() => MODE_CONFIG[props.mode] || MODE_CONFIG.in)

const colorClasses = computed(() => {
  const c = config.value.color
  if (c === 'emerald') return { btn: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700', border: 'border-emerald-500/50' }
  if (c === 'red') return { btn: 'bg-red-600 hover:bg-red-500 active:bg-red-700', border: 'border-red-500/50' }
  if (c === 'amber') return { btn: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700', border: 'border-amber-500/50' }
  return { btn: 'bg-emerald-600', border: 'border-emerald-500/50' }
})

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

const isDebouncing = computed(() => !!debounceTimer)

watch(() => props.visible, (val) => {
  if (val) {
    quantity.value = 0
    note.value = ''
    formError.value = ''
    successMsg.value = ''
    clearDebounce()
  }
})

function clearDebounce() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
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

  debounceTimer = setTimeout(() => {
    clearDebounce()
  }, DEBOUNCE_MS)

  const payload = {
    product_id: props.product.id,
    quantity: Number(quantity.value),
    note: note.value.trim(),
    operator: 'system',
  }

  try {
    let res
    if (props.mode === 'in') res = await stockIn(payload)
    else if (props.mode === 'out') res = await stockOut(payload)
    else res = await stockAdjust(payload)

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
      <!-- 遮罩层（禁止点击关闭） -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"></div>

      <div class="relative w-full max-w-md flex flex-col bg-[var(--modal-bg)] border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        <!-- 标题栏 -->
        <div :class="['flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] flex-shrink-0', colorClasses.border]">
          <h3 class="text-base font-semibold text-[var(--text-primary)]">
            {{ config.title }} — {{ product?.name }}
          </h3>
          <button
            @click="$emit('close')"
            class="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-md transition-all duration-150 text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <!-- 内容 -->
        <div class="px-6 py-5 space-y-5">

          <!-- 当前库存 vs 操作后库存 -->
          <div class="flex items-center gap-4 p-4 bg-[var(--input-bg)]/60 rounded-xl border border-[var(--border-default)]">
            <div class="text-center flex-1">
              <p class="text-xs text-[var(--text-muted)] mb-1">当前库存</p>
              <p class="text-2xl font-bold text-[var(--text-primary)]">{{ product?.current_stock ?? 0 }}</p>
              <p class="text-xs text-[var(--text-muted)]">{{ product?.unit }}</p>
            </div>
            <div class="w-px h-12 bg-[var(--border-default)]"></div>
            <div class="text-center flex-1">
              <p class="text-xs text-[var(--text-muted)] mb-1">操作后库存</p>
              <p
                class="text-2xl font-bold"
                :class="{
                  'text-emerald-400': successMsg || (previewDiff > 0),
                  'text-red-400': previewDiff < 0 && !successMsg,
                  'text-[var(--text-primary)]': previewDiff === 0 && !successMsg,
                }"
              >
                {{ previewStock }}
              </p>
              <p class="text-xs text-[var(--text-muted)]">{{ product?.unit }}</p>
            </div>
          </div>

          <p class="text-xs text-[var(--text-muted)] -mt-1">{{ config.hint }}</p>

          <!-- 数量输入 -->
          <div>
            <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              {{ config.quantityHint }} <span class="text-red-400">*</span>
            </label>
            <div class="relative">
              <input
                v-model.number="quantity"
                type="number"
                min="1"
                :max="mode === 'out' ? product?.current_stock : undefined"
                placeholder="0"
                class="w-full px-3.5 py-3 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-xl text-[var(--text-primary)] text-center font-semibold focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                @keyup.enter="submit"
              />
            </div>
            <p v-if="outOverWarning" class="text-xs text-red-400 mt-1.5 flex items-center gap-1">
              <span class="text-base shrink-0">!</span>
              {{ outOverWarning }}
            </p>
            <p v-if="mode === 'adjust' && quantity > 0" class="text-xs text-amber-400 mt-1.5">
              {{ adjustPreview }}
            </p>
          </div>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">备注说明</label>
            <textarea
              v-model="note"
              rows="2"
              placeholder="选填，如：供应商送货 / 客户订单 / 盘点修正"
              class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200 resize-none leading-relaxed"
            ></textarea>
          </div>

          <!-- 错误提示 -->
          <div
            v-if="formError"
            class="flex items-center gap-2 px-3.5 py-2.5 bg-red-950/50 border border-red-900/60 rounded-lg text-sm text-red-300"
          >
            <span class="text-red-400 text-base shrink-0">!</span>
            {{ formError }}
          </div>

          <!-- 成功提示 -->
          <div
            v-if="successMsg"
            class="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-950/50 border border-emerald-900/60 rounded-lg text-sm text-emerald-300"
          >
            <span class="text-emerald-400 text-base shrink-0">&#10003;</span>
            {{ successMsg }}
          </div>
        </div>

        <!-- 底部 -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80 flex-shrink-0">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
          >
            关闭
          </button>
          <button
            @click="submit"
            :disabled="submitting || isDebouncing || !!formError || !!outOverWarning || quantity <= 0"
            :class="[
              'px-5 py-2 text-sm text-white rounded-lg font-medium transition-all duration-150 cursor-pointer',
              colorClasses.btn,
              (submitting || isDebouncing || !!formError || !!outOverWarning || quantity <= 0)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            ]"
          >
            {{
              submitting
                ? '处理中…'
                : isDebouncing
                  ? `${DEBOUNCE_MS / 1000}s 防抖中…`
                  : config.action
            }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* 隐藏 number 输入框的浏览器原生箭头 */
input[type="number"] {
  -moz-appearance: textfield;
}
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
