<script setup>
import { ref, watch, computed } from 'vue'
import { getCategories } from '../api/categories.js'

const props = defineProps({
  visible: Boolean,
  product: Object,
})
const emit = defineEmits(['close', 'success'])

const categories = ref([])
const categoryLoading = ref(false)

const mode = computed(() => props.product ? 'edit' : 'add')

const form = ref({
  category_id: '',
  remark: '',
  location_code: '',
  current_stock: 0,
  min_stock: 0,
  unit: '件',
  cost_price: 0,
})

const attrs = ref({})
const originalProduct = ref(null)
const formError = ref('')
const submitting = ref(false)

// 动态规格模板（完全由后端数据驱动）
const currentSchema = computed(() => {
  if (!form.value.category_id) return []
  const cat = categories.value.find(c => c.id === form.value.category_id)
  if (!cat) return []
  return Array.isArray(cat.template_schema) ? cat.template_schema : []
})

// 当前大类名称
const currentCategoryName = computed(() => {
  const cat = categories.value.find(c => c.id === form.value.category_id)
  return cat ? cat.name : ''
})

// 自动生成的商品名称
const autoName = computed(() => {
  if (!currentCategoryName.value) return ''
  const parts = [currentCategoryName.value]
  for (const field of currentSchema.value) {
    const val = attrs.value[field]
    if (val && String(val).trim()) {
      parts.push(String(val).trim())
    }
  }
  return parts.join('-')
})

// 大类切换时重置 attrs
watch(() => form.value.category_id, (newId) => {
  attrs.value = {}
  formError.value = ''
})

// 填充表单数据
watch(() => props.visible, async (val) => {
  if (val) {
    await loadCategories()
    if (props.product) {
      originalProduct.value = props.product
      form.value = {
        category_id: props.product.category_id,
        remark: props.product.remark || '',
        location_code: props.product.location_code || '',
        current_stock: props.product.current_stock || 0,
        min_stock: props.product.min_stock || 0,
        unit: props.product.unit || '件',
        cost_price: props.product.cost_price || 0,
      }
      attrs.value = { ...(props.product.attributes || {}) }
    } else {
      originalProduct.value = null
      form.value = {
        category_id: '',
        remark: '',
        location_code: '',
        current_stock: 0,
        min_stock: 0,
        unit: '件',
        cost_price: 0,
      }
      attrs.value = {}
    }
    formError.value = ''
  }
})

async function loadCategories() {
  categoryLoading.value = true
  try {
    const res = await getCategories()
    categories.value = res.data.data
  } catch (e) {
    console.error(e)
  } finally {
    categoryLoading.value = false
  }
}

function validateForm() {
  if (!form.value.category_id) {
    formError.value = '请选择一个大类'
    return false
  }
  if (!autoName.value || autoName.value === currentCategoryName.value) {
    formError.value = '请填写完整的规格信息以生成商品名称'
    return false
  }
  return true
}

async function submit() {
  formError.value = ''
  if (!validateForm()) return

  submitting.value = true
  try {
    const payload = {
      category_id: form.value.category_id,
      name: autoName.value,
      attributes: { ...attrs.value },
      remark: form.value.remark,
      location_code: form.value.location_code,
      current_stock: Number(form.value.current_stock) || 0,
      min_stock: Number(form.value.min_stock) || 0,
      unit: form.value.unit,
      cost_price: Number(form.value.cost_price) || 0,
    }
    emit('success', payload)
  } finally {
    submitting.value = false
  }
}

const UNITS = ['件', '个', '套', '对', '箱', '盒']
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- 遮罩层（禁止点击关闭） -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"></div>

      <!-- 弹窗主体 -->
      <div class="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[var(--modal-bg)] border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] flex-shrink-0">
          <h3 class="text-base font-semibold text-[var(--text-primary)]">
            {{ mode === 'add' ? '新增商品' : '编辑商品' }}
          </h3>
          <button
            @click="$emit('close')"
            class="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-md transition-all duration-150 text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <!-- 表单内容 -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          <!-- 第一行：大类 + 单位 -->
          <div class="grid grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                商品大类 <span class="text-red-400">*</span>
              </label>
              <select
                v-model="form.category_id"
                :disabled="mode === 'edit'"
                class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              >
                <option value="" disabled>请选择大类…</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
              <p v-if="mode === 'edit'" class="text-xs text-[var(--text-muted)] mt-1">编辑时不可切换大类</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">库存单位</label>
              <select
                v-model="form.unit"
                class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200 cursor-pointer appearance-none"
              >
                <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <!-- 动态规格字段（完全数据驱动） -->
          <div v-if="currentSchema.length > 0">
            <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              规格信息 <span class="text-red-400">*</span>
            </label>

            <div class="space-y-4 p-4 bg-[var(--input-bg)]/40 rounded-xl border border-[var(--border-default)]">
              <div
                v-for="field in currentSchema"
                :key="field"
                class="flex flex-col gap-2"
              >
                <span class="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{{ field }}</span>
                <input
                  v-model="attrs[field]"
                  type="text"
                  :placeholder="`请输入${field}`"
                  class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <!-- 尚未选择大类时的提示 -->
          <div v-else class="flex items-center gap-3 px-4 py-3 bg-[var(--input-bg)]/30 border border-[var(--border-default)] rounded-xl text-sm text-[var(--text-muted)]">
            <span class="text-[var(--text-muted)] text-lg">☰</span>
            请先在上方选择一个商品大类
          </div>

          <!-- 自动生成的商品名称 -->
          <div>
            <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              商品名称 <span class="text-red-400">*</span>
            </label>
            <div class="px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border-default)] rounded-lg text-sm min-h-[42px] flex items-center">
              <span
                v-if="autoName && autoName !== currentCategoryName"
                class="text-[var(--accent)] font-medium"
              >
                {{ autoName }}
              </span>
              <span v-else class="text-[var(--text-muted)] italic">
                填写上方规格信息后自动生成
              </span>
            </div>
            <p class="text-xs text-[var(--text-muted)] mt-1.5">系统根据大类与规格属性自动拼接生成</p>
          </div>

          <!-- 第二行：库存信息 -->
          <div class="grid grid-cols-3 gap-5">
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">当前库存</label>
              <input
                v-model.number="form.current_stock"
                type="number"
                min="0"
                placeholder="0"
                class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">最低库存预警</label>
              <input
                v-model.number="form.min_stock"
                type="number"
                min="0"
                placeholder="0"
                class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">成本单价 (元)</label>
              <input
                v-model.number="form.cost_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
              />
            </div>
          </div>

          <!-- 第三行：库位编码 -->
          <div>
            <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">库位编码</label>
            <input
              v-model="form.location_code"
              type="text"
              placeholder="例如：A-01-03"
              class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
            />
          </div>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">备注</label>
            <textarea
              v-model="form.remark"
              rows="2"
              placeholder="选填，商品备注说明"
              class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200 resize-none"
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
        </div>

        <!-- 底部按钮 -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80 flex-shrink-0">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
          >
            取消
          </button>
          <button
            @click="submit"
            :disabled="submitting"
            class="px-5 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-150 cursor-pointer"
          >
            {{ submitting ? '提交中…' : (mode === 'add' ? '确认新增' : '保存修改') }}
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

/* 隐藏所有 select 原生下拉箭头 */
select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.6rem center;
  background-repeat: no-repeat;
  background-size: 1.25em 1.25em;
  padding-right: 2.5rem;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

/* 隐藏 number 输入框原生箭头 */
input[type="number"] {
  -moz-appearance: textfield;
}
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
