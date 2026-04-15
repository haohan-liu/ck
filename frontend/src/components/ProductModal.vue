<script setup>
import { ref, watch, computed, nextTick, reactive } from 'vue'
import { getCategories } from '../api/categories.js'
import { getSkuPreview } from '../api/products.js'
import MySelect from './ui/MySelect.vue'
import MyMessage from './ui/MyMessage.js'

const props = defineProps({ visible: Boolean, product: Object })
const emit = defineEmits(['close', 'success', 'unlock'])

const categories = ref([])
const loading = ref(false)  // 弹窗加载状态
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
const _attrs = ref({})  // 存储原始 attributes 数据
const formError = ref('')

// 规格属性 - 使用 computed 确保响应式追踪
const attrsArray = computed({
  get() {
    const schema = currentSchema.value
    return schema.map(field => ({
      field,
      value: _attrs.value[field] || ''
    }))
  },
  set(newArray) {
    newArray.forEach(item => {
      _attrs.value[item.field] = item.value
    })
  }
})

// 获取单个属性值
function getAttr(field) {
  const val = _attrs.value[field] || ''
  console.log('[ProductModal] getAttr:', field, '=', val, '_attrs:', JSON.stringify(_attrs.value))
  return val
}

// 设置单个属性值
function setAttr(field, value) {
  _attrs.value[field] = value
  console.log('[ProductModal] setAttr:', field, '=', value)
}

// SKU 预览
const skuPreview = ref('')
const skuPreviewLoading = ref(false)

const UNITS = ['件', '个', '套', '对', '箱', '盒']

const categoryOptions = computed(() =>
  categories.value.map(cat => ({ value: cat.id, label: cat.name }))
)

const unitOptions = computed(() =>
  UNITS.map(u => ({ value: u, label: u }))
)

const currentSchema = computed(() => {
  if (!form.value.category_id) return []
  const catId = Number(form.value.category_id)
  const cat = categories.value.find(c => c.id === catId)
  if (!cat) return []
  return Array.isArray(cat.template_schema) ? cat.template_schema : []
})

const currentCategoryName = computed(() => {
  const catId = Number(form.value.category_id)
  const cat = categories.value.find(c => c.id === catId)
  return cat ? cat.name : ''
})

const currentTemplateSchema = computed(() => {
  if (!form.value.category_id) return []
  const catId = Number(form.value.category_id)
  const cat = categories.value.find(c => c.id === catId)
  if (!cat) return []
  return Array.isArray(cat.template_schema) ? cat.template_schema : []
})

const autoName = computed(() => {
  if (!currentCategoryName.value) return ''
  const parts = [currentCategoryName.value]
  for (const field of currentSchema.value) {
    const val = _attrs.value[field]
    if (val && String(val).trim()) parts.push(String(val).trim())
  }
  return parts.join('-')
})


// 生成 SKU 预览（调用后端实时翻译）
async function updateSkuPreview() {
  if (!form.value.category_id) {
    return;
  }

  const catId = Number(form.value.category_id);
  const cat = categories.value.find(c => c.id === catId);
  if (!cat) {
    skuPreview.value = '';
    return;
  }

  const schema = Array.isArray(cat.template_schema) ? cat.template_schema : [];
  if (schema.length === 0) {
    skuPreview.value = '';
    return;
  }

  // 检查是否所有规格都已填写
  const filledSpecs = schema.filter(field => _attrs.value[field] && String(_attrs.value[field]).trim());
  if (filledSpecs.length === 0) {
    skuPreview.value = '';
    return;
  }

  skuPreviewLoading.value = true;
  try {
    // 调用后端 API 进行实时翻译
    const res = await getSkuPreview(catId, _attrs.value);
    if (res.data.success) {
      skuPreview.value = res.data.data.sku_code;
    }
  } catch (e) {
    console.error('生成SKU预览失败:', e);
    skuPreview.value = '';
  } finally {
    skuPreviewLoading.value = false;
  }
}

// 监听规格字段变化
watch(_attrs, () => {
  updateSkuPreview();
}, { deep: true })

// 标志位：是否正在初始化编辑数据
let isInitializing = false

watch(() => form.value.category_id, (newCatId) => {
  // 初始化时不执行清空
  if (isInitializing) {
    console.log('[ProductModal] category_id watch: isInitializing=true, skip clearing')
    return
  }
  
  // 清空 attrs 的所有属性
  Object.keys(_attrs.value).forEach(key => delete _attrs.value[key])
  formError.value = '';
  skuPreview.value = '';
  // 从选中大类读取单价并自动填充
  if (newCatId) {
    const catId = Number(newCatId)
    const cat = categories.value.find(c => c.id === catId)
    if (cat && cat.price !== undefined) {
      form.value.cost_price = Number(cat.price) || 0
    }
  }
})

// 监听 visible 和 product 的组合变化
watch([() => props.visible, () => props.product], async ([visible, product]) => {
  console.log('[ProductModal] watch triggered', { visible, product })
  if (!visible) {
    loading.value = false
    return
  }

  loading.value = true
  console.log('[ProductModal] loading started')

  try {
    // 先加载分类（如果没有的话）
    if (categories.value.length === 0) {
      console.log('[ProductModal] loading categories...')
      try {
        await loadCategories()
        console.log('[ProductModal] categories loaded:', categories.value.length, 'ids:', categories.value.map(c => c.id))
      } catch (catError) {
        console.error('[ProductModal] loadCategories error:', catError)
        loading.value = false
        MyMessage.error('加载分类失败')
        return
      }
    }

    if (product) {
      console.log('[ProductModal] setting form for edit:', product)
      isInitializing = true
      form.value = {
        category_id: product.category_id || '',
        remark: product.remark || '',
        location_code: product.location_code || '',
        current_stock: product.current_stock || 0,
        min_stock: product.min_stock || 0,
        unit: product.unit || '件',
        cost_price: product.cost_price || 0,
      }
      Object.keys(_attrs.value).forEach(key => delete _attrs.value[key])
      Object.assign(_attrs.value, product.attributes || {})
      skuPreview.value = product.sku_code || ''
      console.log('[ProductModal] form.category_id set to:', form.value.category_id, '_attrs:', JSON.stringify(_attrs.value))
    } else {
      isInitializing = true
      form.value = { category_id: '', remark: '', location_code: '', current_stock: 0, min_stock: 0, unit: '件', cost_price: 0 }
      Object.keys(_attrs.value).forEach(key => delete _attrs.value[key])
      skuPreview.value = ''
    }
    formError.value = ''
    
    // 调试：检查 currentSchema
    console.log('[ProductModal] DEBUG: before nextTick - form.category_id:', form.value.category_id, 'type:', typeof form.value.category_id, 'currentSchema:', currentSchema.value)
    console.log('[ProductModal] DEBUG: categories:', categories.value.filter(c => c.id === 7))
    
    await nextTick()
    
    // 在 nextTick 之后再解锁，防止异步 watcher
    isInitializing = false
    console.log('[ProductModal] DEBUG: isInitializing set to false')
    
    // 再次检查
    console.log('[ProductModal] DEBUG: after nextTick - form.category_id:', form.value.category_id, 'currentSchema:', currentSchema.value)
    
    loading.value = false
    console.log('[ProductModal] done - form.category_id:', form.value.category_id, 'currentSchema:', currentSchema.value, 'categoryOptions:', categoryOptions.value.map(o => o.value))
  } catch (error) {
    console.error('[ProductModal] load error:', error)
    loading.value = false
    MyMessage.error('加载商品数据失败')
  }
}, { immediate: true })

async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data.data.map(cat => ({
      ...cat,
      template_schema: (() => {
        if (Array.isArray(cat.template_schema)) return cat.template_schema
        try { return JSON.parse(cat.template_schema) } catch { return [] }
      })()
    }))
  } catch (e) {
    MyMessage.error('加载分类失败')
  }
}

function validateForm() {
  formError.value = ''
  if (!form.value.category_id) { formError.value = '请选择一个大类'; return false }
  if (!autoName.value || autoName.value === currentCategoryName.value) { formError.value = '请填写完整的规格信息以生成商品名称'; return false }
  return true
}

function submit() {
  formError.value = ''
  if (!validateForm()) return
  const payload = {
    category_id: form.value.category_id,
    name: autoName.value,
    attributes: { ..._attrs.value },
    remark: form.value.remark,
    location_code: form.value.location_code,
    current_stock: Number(form.value.current_stock) || 0,
    min_stock: Number(form.value.min_stock) || 0,
    unit: form.value.unit,
    cost_price: Number(form.value.cost_price) || 0,
  }
  emit('success', payload)
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
        <!-- 加载遮罩 -->
        <div v-show="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div class="flex flex-col items-center gap-3">
            <svg class="w-8 h-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/>
            </svg>
            <span class="text-sm font-medium text-slate-600 dark:text-slate-300">加载中...</span>
          </div>
        </div>

        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ mode === 'add' ? '新增商品' : '编辑商品' }}</h3>
          </div>
          <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <MySelect
                v-model="form.category_id"
                :options="categoryOptions"
                placeholder="请选择大类…"
                :disabled="mode === 'edit'"
              />
              <p v-if="mode === 'edit'" class="text-xs text-slate-400 dark:text-slate-500 mt-1">编辑时不可切换大类</p>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">库存单位</label>
              <MySelect
                v-model="form.unit"
                :options="unitOptions"
                placeholder="请选择单位"
              />
            </div>
          </div>

          <!-- 动态规格字段 -->
          <div v-if="currentSchema.length > 0">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">规格信息 <span class="text-rose-500">*</span></label>
            <div class="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
              <div v-for="field in currentSchema" :key="field" class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ field }}</span>
                <input
                  :value="getAttr(field)"
                  @input="e => setAttr(field, e.target.value)"
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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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

          <!-- SKU编号预览 -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">SKU 编号预览</label>
            <div class="px-4 py-3.5 rounded-xl text-sm min-h-[52px] flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5">
              <span v-if="skuPreviewLoading" class="flex items-center gap-2 text-slate-400">
                <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                </svg>
                翻译中...
              </span>
              <span v-else-if="skuPreview" class="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {{ skuPreview }}
              </span>
              <span v-else class="text-slate-400 dark:text-slate-500 italic">填写规格信息后自动生成</span>
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">格式：大类拼音_规格1_规格2...</p>
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
              <input v-model.number="form.cost_price" type="number" min="0" step="0.01" placeholder="选择大类后自动填充" class="w-full py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all placeholder-slate-400" />
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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
          <button @click="submit" class="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all cursor-pointer">
            {{ mode === 'add' ? '确认新增' : '保存修改' }}
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
