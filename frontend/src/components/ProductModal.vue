<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-card">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">{{ isEdit ? '编辑商品' : '新增商品' }}</h3>
            <button class="modal-close" @click="handleClose">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <div class="form-grid">
              <!-- 大类选择 -->
              <div class="form-field span-2">
                <label class="form-label required">选择大类</label>
                <div class="input-with-prefix">
                  <svg class="input-prefix-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <select v-model="form.category_id" class="form-select pl-10" :disabled="isEdit">
                    <option value="">请选择大类...</option>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- SKU -->
              <div class="form-field">
                <label class="form-label required">SKU 编号</label>
                <div class="sku-input-group">
                  <input
                    v-model="form.sku_code"
                    type="text"
                    class="form-input sku-input"
                    placeholder="例如: ADGZ-2405-1832"
                  />
                  <button
                    v-if="!isEdit"
                    type="button"
                    class="btn btn-success btn-sm"
                    @click="generateSku"
                    :disabled="!form.category_id"
                    title="自动生成SKU"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    自动生成
                  </button>
                </div>
              </div>

              <!-- 库位 -->
              <div class="form-field">
                <label class="form-label">库位</label>
                <div class="input-with-prefix">
                  <svg class="input-prefix-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    v-model="form.location_code"
                    type="text"
                    class="form-input pl-10"
                    placeholder="例如: A-01-03"
                  />
                </div>
              </div>

              <!-- 动态规格字段 -->
              <template v-if="selectedCategory">
                <div
                  v-for="field in selectedCategory.template_schema"
                  :key="field"
                  class="form-field"
                >
                  <label class="form-label">{{ field }}</label>
                  <input
                    v-model="form.attributes[field]"
                    type="text"
                    class="form-input"
                    :placeholder="`请输入${field}...`"
                  />
                </div>
              </template>

              <!-- 库存 -->
              <div class="form-field">
                <label class="form-label">初始库存</label>
                <div class="input-with-suffix">
                  <input
                    v-model.number="form.current_stock"
                    type="number"
                    class="form-input pr-12"
                    min="0"
                    placeholder="0"
                  />
                  <span class="input-suffix-text">{{ form.unit }}</span>
                </div>
              </div>

              <!-- 最低库存 -->
              <div class="form-field">
                <label class="form-label">最低库存预警</label>
                <input
                  v-model.number="form.min_stock"
                  type="number"
                  class="form-input"
                  min="0"
                  placeholder="0"
                />
              </div>

              <!-- 单位 -->
              <div class="form-field">
                <label class="form-label">单位</label>
                <select v-model="form.unit" class="form-select">
                  <option value="件">件</option>
                  <option value="个">个</option>
                  <option value="套">套</option>
                  <option value="对">对</option>
                  <option value="箱">箱</option>
                  <option value="盒">盒</option>
                </select>
              </div>

              <!-- 成本单价 -->
              <div class="form-field">
                <label class="form-label">成本单价</label>
                <div class="input-with-suffix">
                  <input
                    v-model.number="form.cost_price"
                    type="number"
                    class="form-input pr-10"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span class="input-suffix-text">元</span>
                </div>
              </div>

              <!-- 自动名称预览 -->
              <div v-if="autoName" class="form-field span-2">
                <label class="form-label">商品名称预览</label>
                <div class="name-preview">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ autoName }}</span>
                </div>
              </div>

              <!-- 备注 -->
              <div class="form-field span-2">
                <label class="form-label">备注</label>
                <textarea
                  v-model="form.remark"
                  class="form-textarea"
                  rows="3"
                  placeholder="可选，添加商品的相关说明或备注信息..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="handleClose">取消</button>
            <button class="btn btn-primary" @click="handleSubmit" :disabled="loading">
              <span v-if="loading" class="loading-spinner"></span>
              {{ loading ? '保存中...' : (isEdit ? '保存修改' : '确认添加') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { categoryApi, productApi } from '@/api/index.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  editData: { type: Object, default: null }
})

const emit = defineEmits(['close', 'success'])

const isEdit = computed(() => !!props.editData)

const categories = ref([])
const loading = ref(false)

// 表单数据
const defaultForm = () => ({
  category_id: '',
  sku_code: '',
  attributes: {},
  remark: '',
  location_code: '',
  current_stock: 0,
  min_stock: 0,
  unit: '件',
  cost_price: 0
})

const form = ref(defaultForm())

// 当前选中大类
const selectedCategory = computed(() =>
  categories.value.find(c => String(c.id) === String(form.value.category_id))
)

// 自动生成名称预览
const autoName = computed(() => {
  if (!selectedCategory.value) return ''
  const parts = Object.values(form.value.attributes).filter(v => v && String(v).trim())
  if (parts.length === 0) return selectedCategory.value.name
  return `${selectedCategory.value.name}-${parts.join('-')}`
})

// 获取大类名称的拼音首字母
function getPinyinInitials(name) {
  if (!name) return 'X'
  const pinyinMap = {
    '奥': 'A', '迪': 'D', '奔': 'B', '驰': 'C', '宝': 'B', '马': 'M',
    '沃': 'W', '沃爾': 'W', '沃我': 'W', '沃娃': 'W',
    '大': 'D', '众': 'D', '汽': 'Q', '车': 'C', '配': 'P', '件': 'J',
    '标': 'B', '志': 'Z', '把': 'B', '档': 'D', '盖': 'G',
    '发': 'F', '光': 'G', '系': 'X', '列': 'L', '款': 'K'
  }
  let initials = ''
  for (const char of name) {
    const upper = char.toUpperCase()
    if (upper >= 'A' && upper <= 'Z') {
      initials += upper
    } else if (pinyinMap[char]) {
      initials += pinyinMap[char]
    }
  }
  if (!initials) {
    return name.charAt(0).toUpperCase()
  }
  return initials.substring(0, 4)
}

// 生成随机4位数字
function generateRandom() {
  return Math.floor(1000 + Math.random() * 9000)
}

// 自动生成 SKU
function generateSku() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const datePart = `${year}${month}`
  const initials = getPinyinInitials(selectedCategory.value?.name || '')
  const randomPart = generateRandom()
  form.value.sku_code = `${initials}-${datePart}-${randomPart}`
}

// 加载大类列表
async function loadCategories() {
  try {
    const res = await categoryApi.list()
    categories.value = res.data || []
  } catch (err) {
    console.error('加载大类失败:', err)
  }
}

// 监听弹窗打开
watch(() => props.visible, async (val) => {
  if (val) {
    await loadCategories()
    if (props.editData) {
      const rawAttrs = props.editData.attributes
      const parsedAttrs = (typeof rawAttrs === 'object' && rawAttrs !== null) 
        ? rawAttrs 
        : {};
      form.value = {
        category_id: props.editData.category_id,
        sku_code: props.editData.sku_code,
        attributes: { ...parsedAttrs },
        remark: props.editData.remark || '',
        location_code: props.editData.location_code || '',
        current_stock: props.editData.current_stock || 0,
        min_stock: props.editData.min_stock || 0,
        unit: props.editData.unit || '件',
        cost_price: props.editData.cost_price || 0
      }
    } else {
      form.value = defaultForm()
    }
  }
})

// 大类切换时重置动态字段
watch(() => form.value.category_id, (newId, oldId) => {
  if (newId !== oldId && isEdit.value) return
  if (newId) {
    const schema = selectedCategory.value?.template_schema || []
    const newAttrs = {}
    schema.forEach(field => {
      newAttrs[field] = form.value.attributes[field] || ''
    })
    form.value.attributes = newAttrs

    // 新增模式下，选完大类后自动生成 SKU
    if (!isEdit.value && !form.value.sku_code) {
      generateSku()
    }
  }
})

function handleClose() {
  emit('close')
}

async function handleSubmit() {
  if (!form.value.category_id) return alert('请选择大类')
  if (!form.value.sku_code.trim()) return alert('请输入SKU编号')

  loading.value = true
  try {
    const payload = {
      category_id: Number(form.value.category_id),
      sku_code: form.value.sku_code.trim(),
      name: autoName.value || form.value.sku_code.trim(),
      attributes: form.value.attributes,
      remark: form.value.remark?.trim() || '',
      location_code: form.value.location_code.trim(),
      current_stock: Number(form.value.current_stock) || 0,
      min_stock: Number(form.value.min_stock) || 0,
      unit: form.value.unit,
      cost_price: Number(form.value.cost_price) || 0
    }

    if (isEdit.value) {
      const productId = Number(props.editData.id)
      await productApi.update(productId, payload)
    } else {
      await productApi.create(payload)
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
/* 弹窗基础样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 680px;
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
  border-bottom: 1px solid #f3f4f6;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
}

.modal-close {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #6b7280;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  background: transparent;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #1a1a2e;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* 表单网格 */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field.span-2 {
  grid-column: span 2;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

/* 输入框 */
.form-input,
.form-select {
  height: 2.75rem;
  padding: 0 0.875rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1a1a2e;
  background: white;
  transition: all 0.2s;
  outline: none;
}

.form-input:focus,
.form-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.form-input:disabled,
.form-select:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: #9ca3af;
}

/* 输入框带前缀图标 */
.input-with-prefix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-prefix .form-input,
.input-with-prefix .form-select {
  padding-left: 2.75rem;
}

.input-prefix-icon {
  position: absolute;
  left: 0.875rem;
  width: 1.25rem;
  height: 1.25rem;
  color: #9ca3af;
  pointer-events: none;
}

/* 输入框带后缀 */
.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix .form-input {
  padding-right: 2.75rem;
}

.input-suffix-text {
  position: absolute;
  right: 0.875rem;
  font-size: 0.875rem;
  color: #9ca3af;
  pointer-events: none;
}

/* 下拉框 */
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  background-size: 1.25rem 1.25rem;
  padding-right: 2.75rem;
  cursor: pointer;
}

.form-select option {
  padding: 0.5rem;
}

/* SKU输入组 */
.sku-input-group {
  display: flex;
  gap: 0.5rem;
}

.sku-input-group .form-input {
  flex: 1;
}

/* 名称预览 */
.name-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 2px solid #86efac;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #15803d;
}

.name-preview svg {
  color: #22c55e;
  flex-shrink: 0;
}

/* 文本域 */
.form-textarea {
  width: 100%;
  padding: 0.75rem 0.875rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1a1a2e;
  background: white;
  transition: all 0.2s;
  outline: none;
  resize: vertical;
  min-height: 5rem;
  font-family: inherit;
  line-height: 1.5;
}

.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.form-textarea::placeholder {
  color: #9ca3af;
}

/* 按钮 */
.btn {
  height: 2.75rem;
  padding: 0 1.25rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
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
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1.5px solid #e5e7eb;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.btn-success {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  transform: translateY(-1px);
}

.btn-sm {
  height: 2.5rem;
  padding: 0 0.875rem;
  font-size: 0.8125rem;
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
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-field.span-2 {
    grid-column: span 1;
  }
  
  .sku-input-group {
    flex-direction: column;
  }
}
</style>
