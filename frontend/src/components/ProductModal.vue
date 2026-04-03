<script setup>
import { ref, watch, computed } from 'vue'
import { getCategories } from '../api/categories.js'

const props = defineProps({
  visible: Boolean,
  product: Object,     // null = 新增, Object = 编辑
})
const emit = defineEmits(['close', 'success'])

// 所有大类
const categories = ref([])
const categoryLoading = ref(false)

const mode = computed(() => props.product ? 'edit' : 'add')

// 表单基础字段
const form = ref({
  category_id: '',
  remark: '',
  location_code: '',
  current_stock: 0,
  min_stock: 0,
  unit: '件',
  cost_price: 0,
})

// 动态规格属性
const attrs = ref({})

// 原始 product 数据（编辑时）
const originalProduct = ref(null)

// 错误提示
const formError = ref('')

// 提交中
const submitting = ref(false)

// 各大类固定的选项配置（按钮组）
const FIELD_OPTIONS = {
  '奥迪盖子': {
    '规格':     { type: 'radio', options: ['发光', '不发光'] },
    '型号':     { type: 'radio', options: ['A6L', 'A4L', 'A8L'] },
    'LOGO':     { type: 'text' },
  },
  '雷克萨斯': {
    '型号':     { type: 'radio', options: ['ES', 'RX', 'NX', 'LS', 'IS', 'UX'] },
    'LOGO':     { type: 'text' },
  },
  '路虎旋钮': {
    '型号':     { type: 'radio', options: ['揽胜', '发现', '卫士', '揽运', '极光'] },
    '颜色':     { type: 'text' },
  },
  '前按键': {
    '型号':     { type: 'radio', options: ['高配', '低配', '运动款'] },
    'LOGO':     { type: 'text' },
  },
  '黑钛色': {
    '型号':     { type: 'radio', options: ['A6L', 'A4L', 'A8L', 'A3'] },
    '材质':     { type: 'text' },
    '适用车型': { type: 'text' },
  },
  '手动挡': {
    '型号':     { type: 'radio', options: ['6挡', '5挡', '4挡'] },
    '挡位':     { type: 'radio', options: ['标准', '运动'] },
    '材质':     { type: 'text' },
  },
}

// 当前选中大类的规格模板
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

// 根据字段名获取字段配置
function getFieldConfig(fieldName) {
  const catName = currentCategoryName.value
  if (FIELD_OPTIONS[catName] && FIELD_OPTIONS[catName][fieldName]) {
    return FIELD_OPTIONS[catName][fieldName]
  }
  return { type: 'text' }
}

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

// 监听：大类切换时重置 attrs
watch(() => form.value.category_id, (newId) => {
  attrs.value = {}
  formError.value = ''
})

// 监听：props.product 变化时填充表单
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
      <!-- 遮罩 -->
      <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" @click="$emit('close')"></div>

      <!-- 弹窗 -->
      <div class="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <h3 class="text-base font-semibold text-slate-100">
            {{ mode === 'add' ? '新增商品' : '编辑商品' }}
          </h3>
          <button
            @click="$emit('close')"
            class="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <!-- 表单内容 -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          <!-- 第一行：大类 + 单位 -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">
                商品大类 <span class="text-red-400">*</span>
              </label>
              <select
                v-model="form.category_id"
                :disabled="mode === 'edit'"
                class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              >
                <option value="" disabled>请选择大类…</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
              <p v-if="mode === 'edit'" class="text-xs text-slate-600 mt-1">编辑时不可切换大类</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">库存单位</label>
              <select
                v-model="form.unit"
                class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors cursor-pointer appearance-none"
              >
                <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <!-- 动态规格字段 -->
          <div v-if="currentSchema.length > 0">
            <label class="block text-sm font-medium text-slate-300 mb-2">
              规格信息 <span class="text-red-400">*</span>
            </label>

            <div class="space-y-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <div
                v-for="field in currentSchema"
                :key="field"
                class="flex flex-col gap-2"
              >
                <!-- 字段标签 -->
                <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">{{ field }}</span>

                <!-- 按钮组类型（有固定选项） -->
                <div
                  v-if="getFieldConfig(field).type === 'radio'"
                  class="flex flex-wrap gap-2"
                >
                  <button
                    v-for="opt in getFieldConfig(field).options"
                    :key="opt"
                    type="button"
                    @click="attrs[field] = opt"
                    class="px-3.5 py-1.5 text-sm rounded-md border font-medium transition-all duration-150 cursor-pointer"
                    :class="
                      attrs[field] === opt
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    "
                  >
                    {{ opt }}
                  </button>
                </div>

                <!-- 文本输入类型 -->
                <input
                  v-else
                  v-model="attrs[field]"
                  type="text"
                  :placeholder="`请输入${field}`"
                  class="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
            </div>
          </div>

          <!-- 尚未选择大类时的提示 -->
          <div v-else class="flex items-center gap-3 px-4 py-3 bg-slate-950/40 border border-slate-800 rounded-xl text-sm text-slate-500">
            <span class="text-slate-600 text-lg">☰</span>
            请先在上方选择一个商品大类
          </div>

          <!-- 自动生成的商品名称 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">
              商品名称 <span class="text-red-400">*</span>
            </label>
            <div class="px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm min-h-[42px] flex items-center">
              <span
                v-if="autoName && autoName !== currentCategoryName"
                class="text-emerald-400 font-medium"
              >
                {{ autoName }}
              </span>
              <span v-else class="text-slate-600 italic">
                填写上方规格信息后自动生成
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-1.5">系统根据大类与规格属性自动拼接生成</p>
          </div>

          <!-- 第二行：库存信息 -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">当前库存</label>
              <input
                v-model.number="form.current_stock"
                type="number"
                min="0"
                placeholder="0"
                class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">最低库存预警</label>
              <input
                v-model.number="form.min_stock"
                type="number"
                min="0"
                placeholder="0"
                class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">成本单价 (元)</label>
              <input
                v-model.number="form.cost_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
              />
            </div>
          </div>

          <!-- 第三行：库位编码 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">库位编码</label>
            <input
              v-model="form.location_code"
              type="text"
              placeholder="例如：A-01-03"
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
          </div>

          <!-- 备注 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">备注</label>
            <textarea
              v-model="form.remark"
              rows="2"
              placeholder="选填，商品备注说明"
              class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors resize-none"
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
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex-shrink-0">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            @click="submit"
            :disabled="submitting"
            class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors cursor-pointer"
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
