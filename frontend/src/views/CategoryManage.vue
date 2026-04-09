<script setup>
import { ref, onMounted } from 'vue'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories.js'

const categories = ref([])
const loading = ref(false)
const error = ref('')
const showModal = ref(false)
const modalMode = ref('add')
const deleteId = ref(null)
const deleteName = ref('')
const confirmDelete = ref(false)

const MAX_FIELDS = 8

const form = ref({
  id: null,
  name: '',
  template_schema: [''],
})

function openAddModal() {
  modalMode.value = 'add'
  form.value = { id: null, name: '', template_schema: [''] }
  showModal.value = true
}

function openEditModal(cat) {
  modalMode.value = 'edit'
  form.value = {
    id: cat.id,
    name: cat.name,
    template_schema: cat.template_schema && cat.template_schema.length > 0
      ? [...cat.template_schema]
      : [''],
  }
  showModal.value = true
}

function addField() {
  if (form.value.template_schema.length >= MAX_FIELDS) {
    error.value = `规格模板字段最多只能添加 ${MAX_FIELDS} 个`
    return
  }
  error.value = ''
  form.value.template_schema.push('')
}

function removeField(index) {
  if (form.value.template_schema.length <= 1) {
    error.value = '至少需要保留一个规格字段'
    return
  }
  error.value = ''
  form.value.template_schema.splice(index, 1)
}

function validateForm() {
  error.value = ''
  if (!form.value.name || !form.value.name.trim()) {
    error.value = '大类名称不能为空'
    return false
  }
  const fields = form.value.template_schema.filter(f => (f && f.trim()))
  if (fields.length === 0) {
    error.value = '至少需要保留一个非空规格字段'
    return false
  }
  if (fields.length !== form.value.template_schema.length) {
    error.value = '存在空白的规格字段，请填写或删除后再保存'
    return false
  }
  return true
}

async function submitForm() {
  if (!validateForm()) return

  const payload = {
    name: form.value.name.trim(),
    template_schema: form.value.template_schema.filter(f => f.trim()),
  }

  try {
    if (modalMode.value === 'add') {
      await createCategory(payload)
    } else {
      await updateCategory(form.value.id, payload)
    }
    showModal.value = false
    await loadCategories()
  } catch (e) {
    error.value = e.response?.data?.error || '保存失败，请重试'
  }
}

async function loadCategories() {
  loading.value = true
  error.value = ''
  try {
    const res = await getCategories()
    categories.value = res.data.data || []
  } catch (e) {
    error.value = '加载大类列表失败'
    console.error(e)
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
    await loadCategories()
  } catch (e) {
    confirmDelete.value = false
    error.value = e.response?.data?.error || '删除失败'
  }
}

onMounted(loadCategories)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-[var(--border-default)]">
      <div>
        <h2 class="text-base sm:text-lg font-semibold text-[var(--text-primary)]">产品大类管理</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">管理所有商品所属的大类及其规格模板</p>
      </div>
      <button
        @click="openAddModal"
        class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-95 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer"
      >
        <span class="text-sm leading-none">+</span>
        <span class="hidden sm:inline">新增大类</span>
        <span class="sm:hidden">新增</span>
      </button>
    </header>

    <!-- 错误提示（全局，非弹窗内） -->
    <div
      v-if="error && !showModal && !confirmDelete"
      class="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs sm:text-sm text-red-300"
    >
      <span class="text-red-400 text-base shrink-0">!</span>
      {{ error }}
      <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-300 text-lg leading-none cursor-pointer">&times;</button>
    </div>

    <!-- 列表区域 -->
    <div class="flex-1 overflow-auto">

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-12 sm:py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="categories.length === 0" class="flex flex-col items-center justify-center py-20 sm:py-24 text-[var(--text-muted)]">
        <div class="text-4xl sm:text-5xl mb-4 opacity-40">☰</div>
        <p class="text-sm sm:text-base mb-1">暂无大类</p>
        <p class="text-xs sm:text-sm opacity-60 hidden sm:block">点击「新增大类」开始创建</p>
      </div>

      <!-- PC 端表格（>= lg） -->
      <div v-if="!loading && categories.length > 0" class="hidden lg:block p-6 lg:p-8">
        <div class="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-[var(--header-bg)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                <th class="px-6 py-3.5 text-left font-medium">大类名称</th>
                <th class="px-6 py-3.5 text-left font-medium">规格模板字段</th>
                <th class="px-6 py-3.5 text-left font-medium">创建时间</th>
                <th class="px-6 py-3.5 text-right font-medium pr-8">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-default)]/80">
              <tr
                v-for="cat in categories"
                :key="cat.id"
                class="bg-[var(--row-bg)] hover:bg-[var(--hover-bg)] transition-colors duration-100 group"
              >
                <td class="px-6 py-4">
                  <span class="font-medium text-[var(--text-primary)]">{{ cat.name }}</span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="(field, fi) in (cat.template_schema || [])"
                      :key="fi"
                      class="inline-flex items-center px-2.5 py-1 bg-[var(--input-bg)] text-[var(--text-secondary)] text-xs rounded-md border border-[var(--border-default)]"
                    >
                      {{ field }}
                    </span>
                    <span
                      v-if="!cat.template_schema || cat.template_schema.length === 0"
                      class="text-[var(--text-muted)] text-xs italic"
                    >
                      无
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 text-[var(--text-muted)] text-xs whitespace-nowrap">
                  {{ cat.created_at ? cat.created_at.replace('T', ' ').slice(0, 19) : '-' }}
                </td>
                <td class="px-6 py-4 pr-8">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openEditModal(cat)"
                      class="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                    >
                      编辑
                    </button>
                    <button
                      @click="openDeleteDialog(cat)"
                      class="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700/80 rounded-md transition-all duration-150 cursor-pointer bg-transparent"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 平板/手机端卡片列表（< lg） -->
      <div v-if="!loading && categories.length > 0" class="lg:hidden p-4 sm:p-6 space-y-3">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-4 space-y-3 hover:border-[var(--border-strong)] transition-colors"
        >
          <!-- 大类名称 -->
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-sm sm:text-base text-[var(--text-primary)]">{{ cat.name }}</span>
            <div class="flex gap-2 shrink-0">
              <button
                @click="openEditModal(cat)"
                class="px-2.5 py-1 text-[10px] sm:text-xs text-[var(--accent)] border border-[var(--accent)]/40 hover:border-[var(--accent)] rounded-md transition-all cursor-pointer bg-transparent"
              >
                编辑
              </button>
              <button
                @click="openDeleteDialog(cat)"
                class="px-2.5 py-1 text-[10px] sm:text-xs text-red-400 border border-red-900/60 rounded-md transition-all cursor-pointer bg-transparent"
              >
                删除
              </button>
            </div>
          </div>

          <!-- 规格字段 -->
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(field, fi) in (cat.template_schema || [])"
              :key="fi"
              class="inline-flex items-center px-2.5 py-1 bg-[var(--input-bg)] text-[var(--text-secondary)] text-[10px] sm:text-xs rounded-md border border-[var(--border-default)]"
            >
              {{ field }}
            </span>
            <span
              v-if="!cat.template_schema || cat.template_schema.length === 0"
              class="text-[var(--text-muted)] text-[10px] sm:text-xs italic"
            >
              无规格字段
            </span>
          </div>

          <!-- 创建时间 -->
          <div class="text-[10px] sm:text-xs text-[var(--text-muted)]">
            创建于 {{ cat.created_at ? cat.created_at.replace('T', ' ').slice(0, 16) : '-' }}
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================ -->
    <!-- 新增 / 编辑 弹窗 -->
    <!-- ================================================ -->
    <Transition name="modal-fade">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      >
        <!-- 遮罩层 -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showModal = false"></div>

        <!-- 弹窗主体 -->
        <div class="relative w-full max-w-lg bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[90vh] flex flex-col">

          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border-default)] flex-shrink-0">
            <h3 class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
              {{ modalMode === 'add' ? '新增大类' : '编辑大类' }}
            </h3>
            <button
              @click="showModal = false"
              class="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-md transition-all duration-150 cursor-pointer text-lg leading-none"
            >
              &times;
            </button>
          </div>

          <!-- 表单内容 -->
          <div class="px-5 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">

            <!-- 大类名称 -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                大类名称 <span class="text-red-400">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                placeholder="例如：奥迪盖子"
                class="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
                @keyup.enter="submitForm"
              />
            </div>

            <!-- 规格模板字段 -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-sm font-medium text-[var(--text-secondary)]">
                  规格模板字段 <span class="text-xs text-[var(--text-muted)] font-normal">（最多 {{ MAX_FIELDS }} 个）</span>
                </label>
                <span class="text-xs text-[var(--text-muted)]">
                  {{ form.template_schema.filter(f => f.trim()).length }} / {{ MAX_FIELDS }}
                </span>
              </div>
              <p class="text-xs text-[var(--text-muted)] mb-3">
                定义该大类产品的规格属性（如型号、LOGO、颜色等），在下方手动添加或删除字段。
              </p>

              <!-- 字段列表 -->
              <div class="space-y-2">
                <div
                  v-for="(field, index) in form.template_schema"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <div class="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs font-medium shrink-0 flex items-center justify-center hidden sm:flex">
                    {{ index + 1 }}
                  </div>
                  <div class="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[10px] font-medium shrink-0 flex items-center justify-center sm:hidden">
                    {{ index + 1 }}
                  </div>
                  <input
                    v-model="form.template_schema[index]"
                    type="text"
                    :placeholder="`字段 ${index + 1}，如：型号`"
                    class="flex-1 px-3 py-2 sm:px-3.5 sm:py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
                  />
                  <button
                    @click="removeField(index)"
                    :disabled="form.template_schema.length <= 1"
                    class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer shrink-0"
                    title="删除此字段"
                  >
                    <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 添加字段按钮 -->
              <button
                v-if="form.template_schema.length < MAX_FIELDS"
                @click="addField"
                class="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-[var(--border-default)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded-lg text-xs sm:text-sm transition-all duration-200 cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                添加字段
              </button>
            </div>

            <!-- 弹窗内错误提示 -->
            <div
              v-if="error"
              class="flex items-center gap-2 px-3 py-2.5 bg-red-950/50 border border-red-900/60 rounded-lg text-xs sm:text-sm text-red-300"
            >
              <span class="text-red-400 text-base shrink-0">!</span>
              {{ error }}
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="flex items-center justify-end gap-2 sm:gap-3 px-5 sm:px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80 flex-shrink-0">
            <button
              @click="showModal = false"
              class="px-3 sm:px-4 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
            >
              取消
            </button>
            <button
              @click="submitForm"
              class="px-4 sm:px-5 py-2 text-xs sm:text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-95 rounded-lg font-medium transition-all duration-150 cursor-pointer"
            >
              {{ modalMode === 'add' ? '确认新增' : '保存修改' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ================================================ -->
    <!-- 删除确认弹窗 -->
    <!-- ================================================ -->
    <Transition name="modal-fade">
      <div
        v-if="confirmDelete"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="confirmDelete = false"></div>

        <div class="relative w-full max-w-sm bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div class="px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-950/60 flex items-center justify-center text-red-400 text-lg shrink-0">!</div>
              <h3 class="text-sm sm:text-base font-semibold text-[var(--text-primary)]">确认删除大类</h3>
            </div>
            <p class="text-xs sm:text-sm text-[var(--text-secondary)] pl-[44px] sm:pl-[52px]">
              确定要删除「<strong class="text-[var(--text-primary)]">{{ deleteName }}</strong>」吗？<br />
              删除后不可恢复。
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 sm:gap-3 px-5 sm:px-6 py-3 sm:py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80">
            <button
              @click="confirmDelete = false"
              class="px-3 sm:px-4 py-2 text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
            >
              取消
            </button>
            <button
              @click="confirmDeleteCategory"
              class="px-4 sm:px-5 py-2 text-xs sm:text-sm text-white bg-red-600 hover:bg-red-500 active:scale-95 rounded-lg font-medium transition-all duration-150 cursor-pointer"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
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

.modal-fade-enter-active .relative,
.modal-fade-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-fade-enter-from .relative {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
.modal-fade-leave-to .relative {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
