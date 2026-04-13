<script setup>
import { ref, onMounted } from 'vue'
import draggable from 'vuedraggable'
import { getCategories, createCategory, updateCategory, deleteCategory, updateCategoryOrder } from '../api/categories.js'
import MyMessage from '../components/ui/MyMessage.js'

const categories = ref([])
const loading = ref(false)
const showModal = ref(false)
const modalMode = ref('add')
const deleteId = ref(null)
const deleteName = ref('')
const confirmDelete = ref(false)
const MAX_FIELDS = 8

const form = ref({ id: null, name: '', template_schema: [''], price: '' })

// 拖拽排序 - 保存原始顺序用于比较
let originalOrder = []

// 时间格式化函数 - 使用本地时间
function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 19) || '-'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function openAddModal() {
  modalMode.value = 'add'
  form.value = { id: null, name: '', template_schema: [''], price: '' }
  showModal.value = true
}

function openEditModal(cat) {
  modalMode.value = 'edit'
  form.value = {
    id: cat.id,
    name: cat.name,
    template_schema: cat.template_schema && cat.template_schema.length > 0 ? [...cat.template_schema] : [''],
    price: cat.price || '',
  }
  showModal.value = true
}

function addField() {
  if (form.value.template_schema.length >= MAX_FIELDS) { MyMessage.warning(`规格模板字段最多只能添加 ${MAX_FIELDS} 个`); return }
  form.value.template_schema.push('')
}

function removeField(index) {
  if (form.value.template_schema.length <= 1) { MyMessage.warning('至少需要保留一个规格字段'); return }
  form.value.template_schema.splice(index, 1)
}

function validateForm() {
  if (!form.value.name || !form.value.name.trim()) { MyMessage.warning('大类名称不能为空'); return false }
  const fields = form.value.template_schema.filter(f => (f && f.trim()))
  if (fields.length === 0) { MyMessage.warning('至少需要保留一个非空规格字段'); return false }
  if (fields.length !== form.value.template_schema.length) { MyMessage.warning('存在空白的规格字段，请填写或删除后再保存'); return false }
  if (form.value.price === '' || form.value.price === null || isNaN(Number(form.value.price))) { MyMessage.warning('大类单价不能为空且必须为有效数字'); return false }
  if (Number(form.value.price) < 0) { MyMessage.warning('大类单价不能为负数'); return false }
  return true
}

async function submitForm() {
  if (!validateForm()) return
  const payload = {
    name: form.value.name.trim(),
    template_schema: form.value.template_schema.filter(f => f.trim()),
    price: Number(form.value.price) || 0,
  }
  try {
    if (modalMode.value === 'add') {
      await createCategory(payload)
      MyMessage.success('新增大类成功')
    } else {
      await updateCategory(form.value.id, payload)
      MyMessage.success('修改大类成功')
    }
    showModal.value = false
    await loadCategories()
  } catch (e) {
    MyMessage.error(e.response?.data?.error || '保存失败，请重试')
  }
}

async function loadCategories() {
  loading.value = true
  try {
    const res = await getCategories()
    categories.value = res.data.data || []
    originalOrder = categories.value.map(c => c.id)
  } catch (e) {
    MyMessage.error(e.response?.data?.error || '加载大类列表失败')
  } finally {
    loading.value = false
  }
}

function openDeleteDialog(cat) {
  deleteId.value = cat.id
  deleteName.value = cat.name
  confirmDelete.value = true
}

async function confirmDeleteCategory() {
  try {
    await deleteCategory(deleteId.value)
    confirmDelete.value = false
    deleteId.value = null
    deleteName.value = ''
    MyMessage.success('删除大类成功')
    await loadCategories()
  } catch (e) {
    confirmDelete.value = false
    MyMessage.error(e.response?.data?.error || '删除失败')
  }
}

onMounted(loadCategories)

// 拖拽排序结束后的回调
async function onDragEnd(evt) {
  const currentOrder = categories.value.map(p => p.id)
  const hasChanged = !currentOrder.every((id, index) => id === originalOrder[index])

  if (!hasChanged) return

  originalOrder = currentOrder

  const items = categories.value.map((p, index) => ({
    id: p.id,
    sort_order: index + 1
  }))

  try {
    await updateCategoryOrder(items)
    MyMessage.success('排序已更新')
  } catch (e) {
    MyMessage.error('保存排序失败: ' + (e.response?.data?.error || e.message))
    await loadCategories()
  }
}
</script>

<template>
  <div class="h-full overflow-hidden flex flex-col">

    <!-- ════ 页面标题栏 ════ -->
    <div class="flex-shrink-0 px-4 lg:px-6 py-4 lg:py-5 border-b border-slate-200/60 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl pb-safe">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">产品大类</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">管理所有商品所属的大类及其规格模板</p>
        </div>
        <button
          @click="openAddModal"
          class="flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                 bg-gradient-to-r from-indigo-500 to-indigo-600
                 shadow-md shadow-indigo-500/20
                 hover:from-indigo-600 hover:to-indigo-700
                 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
          <span class="hidden sm:inline">新增大类</span>
        </button>
      </div>
    </div>

    <!-- ════ 列表内容 ════ -->
    <div class="flex-1 overflow-auto">

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500 dark:text-slate-400">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="categories.length === 0" class="flex flex-col items-center justify-center py-20">
        <div class="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
          </svg>
        </div>
        <p class="text-base font-semibold text-slate-600 dark:text-slate-300">暂无大类</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">点击「新增大类」开始创建</p>
      </div>

      <!-- PC 表格 (>= lg) -->
      <div v-else-if="!loading && categories.length > 0" class="hidden lg:block px-6 py-5">
        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <th class="w-12 px-3 py-3.5"></th>
                <th class="px-6 py-3.5 text-left font-medium">大类名称</th>
                <th class="px-6 py-3.5 text-left font-medium">规格模板字段</th>
                <th class="px-6 py-3.5 text-center font-medium">单价</th>
                <th class="px-6 py-3.5 text-center font-medium">创建时间</th>
                <th class="px-6 py-3.5 text-right font-medium pr-5">操作</th>
              </tr>
            </thead>
            <draggable
              v-model="categories"
              item-key="id"
              tag="tbody"
              handle=".drag-handle"
              :animation="150"
              ghost-class="drag-ghost"
              chosen-class="is-drag-chosen"
              drag-class="is-drag-dragging"
              @end="onDragEnd"
            >
              <template #item="{ element: cat }">
                <tr class="group hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                  <td class="px-3 py-3.5">
                    <div class="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="拖动排序">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                      </svg>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                        </svg>
                      </div>
                      <span class="text-sm font-semibold text-slate-900 dark:text-white">{{ cat.name }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="(field, fi) in (cat.template_schema || [])"
                        :key="fi"
                        class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5"
                      >
                        {{ field }}
                      </span>
                      <span v-if="!cat.template_schema || cat.template_schema.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic">无规格字段</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                    ¥{{ Number(cat.price || 0).toFixed(2) }}
                  </td>
                  <td class="px-6 py-4 text-center text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap font-mono">
                    {{ cat.created_at ? formatTime(cat.created_at) : '-' }}
                  </td>
                  <td class="px-6 py-4 pr-5">
                    <div class="flex items-center justify-end gap-2">
                      <button @click="openEditModal(cat)" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
                        编辑
                      </button>
                      <button @click="openDeleteDialog(cat)" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </draggable>
          </table>
        </div>
      </div>

      <!-- 平板/手机 卡片列表 (< lg) -->
      <div v-if="!loading && categories.length > 0" class="lg:hidden p-4 space-y-3">
        <draggable
          v-model="categories"
          item-key="id"
          handle=".drag-handle"
          :animation="250"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          drag-class="drag-dragging"
          @end="onDragEnd"
          class="space-y-3"
        >
          <template #item="{ element: cat }">
            <div
              class="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden p-4"
            >
              <div class="flex items-center justify-between">
                <div class="drag-handle cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0" title="拖动排序">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                    <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                  </svg>
                </div>
                <div class="flex items-center gap-3 flex-1 min-w-0 mx-2">
                  <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                    </svg>
                  </div>
                  <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ cat.name }}</span>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button @click="openEditModal(cat)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-500 active:scale-95 transition-all cursor-pointer" title="编辑">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                  </button>
                  <button @click="openDeleteDialog(cat)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer" title="删除">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="(field, fi) in (cat.template_schema || [])" :key="fi" class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">{{ field }}</span>
                <span v-if="!cat.template_schema || cat.template_schema.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic">无规格字段</span>
              </div>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono">创建于 {{ cat.created_at ? formatTime(cat.created_at).slice(0, 16) : '-' }}</p>
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                <span class="text-slate-400 dark:text-slate-500">单价：</span>
                <span class="text-indigo-500 font-semibold">¥{{ Number(cat.price || 0).toFixed(2) }}</span>
              </p>
            </div>
          </template>
        </draggable>
      </div>
    </div>

    <!-- ════ 新增 / 编辑弹窗 ════ -->
    <Transition name="modal-fade">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showModal = false"></div>
        <div
          class="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden scale-in
                 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl"
        >
          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                  <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                  <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                </svg>
              </div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ modalMode === 'add' ? '新增大类' : '编辑大类' }}</h3>
            </div>
            <button @click="showModal = false" class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>

          <!-- 表单内容 -->
          <div class="flex-1 overflow-auto px-6 py-5 space-y-5">

            <!-- 大类名称 -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                大类名称 <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                placeholder="例如：奥迪盖子"
                class="w-full py-3 px-4 rounded-xl text-sm text-slate-900 dark:text-white
                       bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                       focus:border-indigo-500 focus:ring-0 focus:outline-none
                       placeholder-slate-400 transition-all"
                @keyup.enter="submitForm"
              />
            </div>

            <!-- 规格模板字段 -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">规格模板字段</label>
                <span class="text-xs text-slate-400 dark:text-slate-500">{{ form.template_schema.filter(f => f.trim()).length }} / {{ MAX_FIELDS }}</span>
              </div>
              <p class="text-xs text-slate-400 dark:text-slate-500 mb-3">定义该大类产品的规格属性，在下方添加或删除字段。</p>
              <div class="space-y-2.5">
                <div v-for="(field, index) in form.template_schema" :key="index" class="flex items-center gap-2.5">
                  <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0">{{ index + 1 }}</span>
                  <input
                    v-model="form.template_schema[index]"
                    type="text"
                    :placeholder="`字段 ${index + 1}，如：型号`"
                    class="flex-1 py-2.5 px-3.5 rounded-xl text-sm text-slate-900 dark:text-white
                           bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                           focus:border-indigo-500 focus:ring-0 focus:outline-none
                           placeholder-slate-400 transition-all"
                  />
                  <button
                    @click="removeField(index)"
                    :disabled="form.template_schema.length <= 1"
                    class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              <button
                v-if="form.template_schema.length < MAX_FIELDS"
                @click="addField"
                class="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                       border-2 border-dashed border-slate-200 dark:border-white/10
                       text-slate-400 dark:text-slate-500
                       hover:border-indigo-400 hover:text-indigo-500
                       active:scale-95 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                添加字段
              </button>
            </div>

            <!-- 大类单价 -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                大类单价 <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">￥</span>
                <input
                  v-model="form.price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full py-3 px-4 pl-8 rounded-xl text-sm text-slate-900 dark:text-white
                         bg-slate-50 dark:bg-slate-800 border-2 border-transparent
                         focus:border-indigo-500 focus:ring-0 focus:outline-none
                         placeholder-slate-400 transition-all"
                />
              </div>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">设置该大类下所有商品的默认单价</p>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-3 flex-shrink-0 pb-safe">
            <button @click="showModal = false" class="flex-1 py-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
              取消
            </button>
            <button @click="submitForm" class="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all cursor-pointer">
              {{ modalMode === 'add' ? '确认新增' : '保存修改' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ════ 删除确认弹窗 ════ -->
    <Transition name="modal-fade">
      <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="confirmDelete = false"></div>
        <div class="relative w-full max-w-sm rounded-2xl overflow-hidden scale-in bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl">
          <div class="p-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-900 dark:text-white">确认删除大类</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5">确定要删除「<strong class="text-slate-700 dark:text-slate-200">{{ deleteName }}</strong>」吗？删除后不可恢复。</p>
              </div>
            </div>
          </div>
          <div class="px-6 pb-6 flex items-center gap-3 pb-safe">
            <button @click="confirmDelete = false" class="flex-1 py-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">取消</button>
            <button @click="confirmDeleteCategory" class="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-rose-500 to-rose-600 shadow-md shadow-rose-500/20 hover:from-rose-600 hover:to-rose-700 active:scale-95 transition-all cursor-pointer">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.scale-in { animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes scale-in { 0% { opacity: 0; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }

/* ============================================= */
/* 拖拽样式 - 与 ProductManage 保持一致          */
/* ============================================= */

.drag-ghost {
  opacity: 1 !important;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.06), rgba(99, 102, 241, 0.02)) !important;
  border: 2px dashed rgba(99, 102, 241, 0.3) !important;
}

.drag-ghost td {
  visibility: hidden !important;
}

.is-drag-chosen {
  cursor: grabbing !important;
}

.is-drag-dragging {
  background: rgba(99, 102, 241, 0.15) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.25) !important;
  transform: scale(1.01) !important;
}

.drag-handle:hover {
  background: rgba(99, 102, 241, 0.1) !important;
  border-radius: 6px;
}

/* 移动端卡片拖拽样式 */
.drag-ghost.drag-card {
  opacity: 1 !important;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(99, 102, 241, 0.02)) !important;
  border: 2px dashed rgba(99, 102, 241, 0.3) !important;
  transform: none !important;
}

.drag-chosen {
  cursor: grabbing !important;
}

.drag-dragging {
  background: rgba(99, 102, 241, 0.15) !important;
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.3) !important;
  transform: scale(1.02) !important;
}
</style>
