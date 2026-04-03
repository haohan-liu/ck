<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-card">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">
              <span class="type-indicator" :class="`type-${type}`">
                {{ getTypeName(type) }}
              </span>
              {{ product?.name }}
            </h3>
            <button class="modal-close" @click="handleClose">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- 商品信息 -->
            <div class="product-info">
              <div class="info-item">
                <span class="info-label">SKU</span>
                <span class="info-value sku">{{ product?.sku_code }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">当前库存</span>
                <span class="info-value stock" :class="getStockClass()">{{ product?.current_stock }}</span>
              </div>
            </div>

            <!-- 操作表单 -->
            <div class="form-section">
              <div class="form-field">
                <label class="form-label required">
                  {{ type === 'adjust' ? '调整后库存' : '数量' }}
                </label>
                <div class="input-wrapper">
                  <input
                    v-model.number="form.quantity"
                    :type="type === 'adjust' ? 'number' : 'number'"
                    class="form-input"
                    :placeholder="type === 'adjust' ? '输入调整后的库存数量' : '输入数量'"
                    min="1"
                  />
                  <span class="input-suffix">{{ product?.unit || '件' }}</span>
                </div>
                <p v-if="type === 'adjust'" class="form-hint">
                  当前库存: {{ product?.current_stock }}，将调整为指定数量
                </p>
                <p v-else-if="type === 'in'" class="form-hint success">
                  操作后库存: {{ product?.current_stock + (form.quantity || 0) }}
                </p>
                <p v-else-if="type === 'out'" class="form-hint" :class="{ error: form.quantity > product?.current_stock }">
                  操作后库存: {{ product?.current_stock - (form.quantity || 0) }}
                  <span v-if="form.quantity > product?.current_stock" class="error-text">（库存不足）</span>
                </p>
              </div>

              <div class="form-field">
                <label class="form-label">备注</label>
                <input
                  v-model="form.note"
                  type="text"
                  class="form-input"
                  placeholder="选填，如：采购入库、销售出库..."
                />
              </div>

              <div class="form-field">
                <label class="form-label">操作人</label>
                <input
                  v-model="form.operator"
                  type="text"
                  class="form-input"
                  placeholder="选填"
                />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="handleClose">取消</button>
            <button
              class="btn"
              :class="getSubmitClass()"
              @click="handleSubmit"
              :disabled="loading || !canSubmit"
            >
              <span v-if="loading" class="loading-spinner"></span>
              {{ loading ? '处理中...' : getSubmitText() }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { inventoryApi } from '@/api/index.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  type: { type: String, default: 'in' }, // 'in', 'out', 'adjust'
  product: { type: Object, default: null }
})

const emit = defineEmits(['close', 'success'])

const loading = ref(false)

const defaultForm = () => ({
  quantity: null,
  note: '',
  operator: ''
})

const form = ref(defaultForm())

const canSubmit = computed(() => {
  if (!form.value.quantity || form.value.quantity <= 0) return false
  if (props.type === 'out' && form.value.quantity > (props.product?.current_stock || 0)) {
    return false
  }
  return true
})

watch(() => props.visible, (val) => {
  if (val) {
    form.value = defaultForm()
  }
})

function getTypeName(type) {
  const map = { in: '入库', out: '出库', adjust: '调整' }
  return map[type] || type
}

function getStockClass() {
  if (!props.product) return ''
  const stock = props.product.current_stock
  const min = props.product.min_stock
  if (stock === 0) return 'zero'
  if (stock <= min) return 'warn'
  return 'ok'
}

function getSubmitClass() {
  const map = { in: 'btn-success', out: 'btn-danger', adjust: 'btn-primary' }
  return map[props.type] || 'btn-primary'
}

function getSubmitText() {
  const map = { in: '确认入库', out: '确认出库', adjust: '确认调整' }
  return map[props.type] || '确认'
}

function handleClose() {
  emit('close')
}

async function handleSubmit() {
  if (!canSubmit.value) return

  loading.value = true
  try {
    let quantity = form.value.quantity

    // 调整模式：传入的是最终库存值，需要计算差值
    if (props.type === 'adjust') {
      quantity = quantity - (props.product?.current_stock || 0)
    }

    const payload = {
      product_id: props.product.id,
      quantity: quantity,
      note: form.value.note.trim(),
      operator: form.value.operator.trim() || 'system'
    }

    if (props.type === 'in') {
      await inventoryApi.in(payload)
    } else if (props.type === 'out') {
      await inventoryApi.out(payload)
    } else {
      await inventoryApi.adjust(payload)
    }

    emit('success')
    handleClose()
  } catch (err) {
    alert(err.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-indicator {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-in {
  background: #f0fdf4;
  color: #15803d;
}

.type-out {
  background: #fef2f2;
  color: #dc2626;
}

.type-adjust {
  background: #eff6ff;
  color: #2563eb;
}

.modal-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #6b7280;
  transition: all 0.15s;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #1a1a2e;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* 商品信息 */
.product-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 10px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
}

.info-value.sku {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #3b82f6;
}

.info-value.stock.ok {
  color: #15803d;
}

.info-value.stock.warn {
  color: #d97706;
}

.info-value.stock.zero {
  color: #dc2626;
}

/* 表单 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-input {
  flex: 1;
  height: 2.625rem;
  padding: 0 0.75rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #1a1a2e;
  background: white;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.input-suffix {
  font-size: 0.875rem;
  color: #9ca3af;
}

.form-hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.form-hint.success {
  color: #15803d;
}

.form-hint.error {
  color: #dc2626;
}

.error-text {
  font-weight: 500;
}

/* 按钮 */
.btn {
  height: 2.625rem;
  padding: 0 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-success {
  background: #22c55e;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #16a34a;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1.5px solid #e5e7eb;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.95);
  opacity: 0;
}
</style>
