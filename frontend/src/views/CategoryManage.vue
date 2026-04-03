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

const form = ref({
  id: null,
  name: '',
  template_schema: [''],
})

const formRules = {
  name: (v) => (v && v.trim().length > 0) || '大类名称不能为空',
}

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
    template_schema: cat.template_schema.length > 0
      ? [...cat.template_schema]
      : [''],
  }
  showModal.value = true
}

function addField() {
  form.value.template_schema.push('')
}

function removeField(index) {
  if (form.value.template_schema.length > 1) {
    form.value.template_schema.splice(index, 1)
  }
}

function validateForm() {
  if (!form.value.name.trim()) {
    error.value = '大类名称不能为空'
    return false
  }
  const fields = form.value.template_schema.filter(f => f.trim())
  if (fields.length === 0) {
    error.value = '至少需要保留一个规格字段'
    return false
  }
  return true
}

async function submitForm() {
  error.value = ''
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
    categories.value = res.data.data
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
    alert(e.response?.data?.error || '删除失败')
  }
}

onMounted(loadCategories)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <header class="flex items-center justify-between px-8 py-5 border-b border-[var(--border-default)] flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-[var(--text-primary)]">产品大类管理</h2>
        <p class="text-xs text-[var(--text-muted)] mt-0.5">管理所有商品所属的大类及其规格模板</p>
      </div>
      <button
        @click="openAddModal"
        class="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] text-white text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer"
      >
        <span class="text-base leading-none">+</span>
        新增大类
      </button>
    </header>

    <!-- 错误提示 -->
    <div
      v-if="error && !showModal"
      class="mx-8 mt-4 flex items-center gap-3 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-lg text-sm text-red-300"
    >
      <span class="text-red-400 text-base">!</span>
      {{ error }}
      <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-300 text-lg leading-none">&times;</button>
    </div>

    <!-- 表格区域 -->
    <div class="flex-1 overflow-auto p-8">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <div class="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span class="text-sm">加载中…</span>
        </div>
      </div>

      <div v-else-if="categories.length === 0" class="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
        <div class="text-5xl mb-4">☰</div>
        <p class="text-base mb-1">暂无大类</p>
        <p class="text-sm">点击右上角「新增大类」开始创建</p>
      </div>

      <div v-else class="rounded-xl border border-[var(--border-default)] overflow-hidden">
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
                    v-for="(field, fi) in cat.template_schema"
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
              <td class="px-6 py-4 text-[var(--text-muted)] text-xs">
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

    <!-- 新增 / 编辑 弹窗 -->
    <Transition name="fade">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- 遮罩层（禁止点击关闭） -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"></div>

        <!-- 弹窗内容 -->
        <div class="relative w-full max-w-lg bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <!-- 标题栏 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h3 class="text-base font-semibold text-[var(--text-primary)]">
              {{ modalMode === 'add' ? '新增大类' : '编辑大类' }}
            </h3>
            <button
              @click="showModal = false"
              class="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-md transition-all duration-150 cursor-pointer text-lg leading-none"
            >
              &times;
            </button>
          </div>

          <!-- 表单 -->
          <div class="px-6 py-5 space-y-5">
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
              <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                规格模板字段
              </label>
              <p class="text-xs text-[var(--text-muted)] mb-2.5">
                定义该大类产品的规格属性（如型号、LOGO、颜色等），添加商品时需填写对应字段。
              </p>

              <!-- 字段列表 -->
              <div class="space-y-2">
                <div
                  v-for="(field, index) in form.template_schema"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <input
                    v-model="form.template_schema[index]"
                    type="text"
                    :placeholder="`字段 ${index + 1}，如：型号`"
                    class="flex-1 px-3.5 py-2 bg-[var(--input-bg)] border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all duration-200"
                  />
                  <button
                    @click="removeField(index)"
                    :disabled="form.template_schema.length <= 1"
                    class="w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)] transition-all duration-150 cursor-pointer text-lg leading-none"
                    title="移除"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <!-- 快捷添加 -->
              <div class="flex flex-wrap gap-1.5 mt-2.5">
                <span class="text-xs text-[var(--text-muted)] py-1">快速添加：</span>
                <button
                  v-for="quick in ['型号', 'LOGO', '颜色', '规格', '材质']"
                  :key="quick"
                  @click="!form.template_schema.includes(quick) && form.template_schema.push(quick)"
                  :disabled="form.template_schema.includes(quick)"
                  class="px-2 py-1 text-xs rounded-md border transition-all duration-150 cursor-pointer"
                  :class="
                    form.template_schema.includes(quick)
                      ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)] opacity-40 cursor-default'
                      : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]'
                  "
                >
                  {{ quick }}
                </button>
              </div>
            </div>

            <!-- 错误提示 -->
            <div
              v-if="error"
              class="flex items-center gap-2 px-3 py-2.5 bg-red-950/50 border border-red-900/60 rounded-lg text-sm text-red-300"
            >
              <span class="text-red-400 text-base shrink-0">!</span>
              {{ error }}
            </div>
          </div>

          <!-- 底部按钮 -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80">
            <button
              @click="showModal = false"
              class="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
            >
              取消
            </button>
            <button
              @click="submitForm"
              class="px-5 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] rounded-lg font-medium transition-all duration-150 cursor-pointer"
            >
              {{ modalMode === 'add' ? '确认新增' : '保存修改' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除确认弹窗 -->
    <Transition name="fade">
      <div
        v-if="confirmDelete"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- 遮罩层（禁止点击关闭） -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"></div>

        <div class="relative w-full max-w-sm bg-[var(--modal-bg)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div class="px-6 pt-6 pb-2">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-full bg-red-950/60 flex items-center justify-center text-red-400 text-lg">!</div>
              <h3 class="text-base font-semibold text-[var(--text-primary)]">确认删除大类</h3>
            </div>
            <p class="text-sm text-[var(--text-secondary)] pl-[52px]">
              确定要删除「<strong class="text-[var(--text-primary)]">{{ deleteName }}</strong>」吗？<br />
              删除后不可恢复。
            </p>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80">
            <button
              @click="confirmDelete = false"
              class="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
            >
              取消
            </button>
            <button
              @click="confirmDeleteCategory"
              class="px-5 py-2 text-sm text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-lg font-medium transition-all duration-150 cursor-pointer"
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
