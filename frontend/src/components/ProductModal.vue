<script setup>
import { ref, watch, computed } from 'vue'
import { getCategories } from '../api/categories.js'

const props = defineProps({ visible: Boolean, product: Object })
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

const UNITS = ['件', '个', '套', '对', '箱', '盒']

const currentSchema = computed(() => {
  if (!form.value.category_id) return []
  const cat = categories.value.find(c => c.id === form.value.category_id)
  if (!cat) return []
  return Array.isArray(cat.template_schema) ? cat.template_schema : []
})

const currentCategoryName = computed(() => {
  const cat = categories.value.find(c => c.id === form.value.category_id)
  return cat ? cat.name : ''
})

const autoName = computed(() => {
  if (!currentCategoryName.value) return ''
  const parts = [currentCategoryName.value]
  for (const field of currentSchema.value) {
    const val = attrs.value[field]
    if (val && String(val).trim()) parts.push(String(val).trim())
  }
  return parts.join('-')
})

watch(() => form.value.category_id, () => {
  attrs.value = {}
  formError.value = ''
})

watch(() => props.visible, async (val) => {
  if (val) {
    await loadCategories()
    if (props.product) {
      originalProduct.value = props.product
      form.value = {
        category_id: props.product.category_id, remark: props.product.remark || '',
        location_code: props.product.location_code || '',
        current_stock: props.product.current_stock || 0,
        min_stock: props.product.min_stock || 0,
        unit: props.product.unit || '件',
        cost_price: props.product.cost_price || 0,
      }
      attrs.value = { ...(props.product.attributes || {}) }
    } else {
      originalProduct.value = null
      form.value = { category_id: '', remark: '', location_code: '', current_stock: 0, min_stock: 0, unit: '件', cost_price: 0 }
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
  } catch (e) { console.error(e) }
  finally { categoryLoading.value = false }
}

function validateForm() {
  formError.value = ''
  if (!form.value.category_id) { formError.value = '请选择一个大类'; return false }
  if (!autoName.value || autoName.value === currentCategoryName.value) { formError.value = '请填写完整的规格信息以生成商品名称'; return false }
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
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('close')"></div>

      <!-- 弹窗主体 -->
      <div
        class="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden scale-in
               bg-white dark:bg-slate-900
               border border-slate-100 dark:border-white/10
               shadow-2xl shadow-black/20"
      >
        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ mode === 'add' ? '新增商品' : '编辑商品' }}</h3>
          </div>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- 表单内容 -->
        <div class="flex-1 overflow-auto px-6 py-5 space-y-5">

          <!-- 第一行：大类 + 单位 -->
          <div class="grid grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">商品大类 <span class="text-rose-500">*</span></label>
              <select
                v-model="form.category_id"
                :disabled="mode === 'edit'"
                class="w-full py-3 px-4 rounded-xl text-sm text-slate-900 dark:text-white
                       bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                       focus:border-indigo-500 focus:outline-none transition-all cursor-pointer disabled:opacity-50"
                style="background-image: url(&quot;data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e&quot;); background-position: right 0.75rem center; background-repeat: no-repeat; background-size: 1.25em; padding-right: 2.5rem; appearance: none;"
              >
                <option value="" disabled>请选择大类…</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
              <p v-if="mode === 'edit'" class="text-xs text-slate-400 dark:text-slate-500 mt-1">编辑时不可切换大类</p>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">库存单位</label>
              <select
                v-model="form.unit"
                class="w-full py-3 px-4 rounded-xl text-sm text-slate-900 dark:text-white
                       bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                       focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                style="background-image: url(&quot;data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e&quot;); background-position: right 0.75rem center; background-repeat: no-repeat; background-size: 1.25em; padding-right: 2.5rem; appearance: none;"
              >
                <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <!-- 动态规格字段 -->
          <div v-if="currentSchema.length > 0">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">规格信息 <span class="text-rose-500">*</span></label>
            <div class="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
              <div v-for="field in currentSchema" :key="field" class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ field }}</span>
                <input
                  v-model="attrs[field]"
                  type="text"
                  :placeholder="`请输入${field}`"
                  class="w-full py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white
                         bg-white dark:bg-slate-900 border-2 border-transparent
                         focus:border-indigo-500 focus:outline-none transition-all
                         placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          <!-- 未选大类提示 -->
          <div v-else class="flex items-center gap-3 p-4 rounded-xl text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            请先在上方选择一个商品大类
          </div>

          <!-- 自动生成的商品名称 -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              商品名称 <span class="text-rose-500">*</span>
            </label>
            <div class="px-4 py-3.5 rounded-xl text-sm min-h-[52px] flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
              <span v-if="autoName && autoName !== currentCategoryName" class="font-bold text-indigo-500">
                {{ autoName }}
              </span>
              <span v-else class="text-slate-400 dark:text-slate-500 italic">填写上方规格信息后自动生成</span>
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">系统根据大类与规格属性自动拼接生成</p>
          </div>

          <!-- 库存信息 -->
          <div class="grid grid-cols-3 gap-5">
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">当前库存</label>
              <input v-model.number="form.current_stock" type="number" min="0" placeholder="0" class="w-full py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all placeholder-slate-400" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">最低库存预警</label>
              <input v-model.number="form.min_stock" type="number" min="0" placeholder="0" class="w-full py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all placeholder-slate-400" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">成本单价 (元)</label>
              <input v-model.number="form.cost_price" type="number" min="0" step="0.01" placeholder="0.00" class="w-full py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all placeholder-slate-400" />
            </div>
          </div>

          <!-- 库位编码 -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">库位编码</label>
            <input v-model="form.location_code" type="text" placeholder="例如：A-01-03" class="w-full py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all placeholder-slate-400" />
          </div>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">备注</label>
            <textarea v-model="form.remark" rows="2" placeholder="选填，商品备注说明" class="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all resize-none placeholder-slate-400 leading-relaxed"></textarea>
          </div>

          <!-- 错误提示 -->
          <div v-if="formError" class="flex items-start gap-2.5 p-3.5 rounded-xl text-sm bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-rose-500 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            {{ formError }}
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-3 flex-shrink-0">
          <button @click="$emit('close')" class="flex-1 py-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
            取消
          </button>
          <button @click="submit" :disabled="submitting" class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
            {{ submitting ? '提交中…' : (mode === 'add' ? '确认新增' : '保存修改') }}
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
input[type="number"] { -moz-appearance: textfield; }
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
