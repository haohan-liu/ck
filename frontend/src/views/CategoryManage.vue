<template>
  <div class="page-container">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <h1 class="page-title">大类管理</h1>
        <span class="category-count">{{ categories.length }} 个大类</span>
      </div>
      <div class="top-bar-actions">
        <button class="btn-add" @click="openAddModal">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          新增大类
        </button>
      </div>
    </div>

    <!-- 大类卡片列表 -->
    <div class="category-grid">
      <div v-for="cat in categories" :key="cat.id" class="category-card">
        <div class="card-header">
          <div class="card-title">
            <h3>{{ cat.name }}</h3>
            <span class="product-count">{{ cat.product_count || 0 }} 件商品</span>
          </div>
          <div class="card-actions">
            <button class="action-btn edit" title="编辑" @click="openEditModal(cat)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="action-btn delete" title="删除" @click="handleDelete(cat)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div class="schema-section">
            <span class="schema-label">规格模板</span>
            <div class="schema-tags">
              <span
                v-for="field in cat.template_schema"
                :key="field"
                class="schema-tag"
              >
                {{ field }}
              </span>
              <span v-if="!cat.template_schema || cat.template_schema.length === 0" class="no-schema">
                暂无规格
              </span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span class="create-time">
            创建于 {{ formatTime(cat.created_at) }}
          </span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="categories.length === 0" class="empty-state-card">
        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <p class="text-gray-500 text-base font-medium">暂无大类</p>
        <p class="text-gray-400 text-sm mt-1">点击右上角「新增大类」开始添加</p>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="modalVisible" class="modal-overlay" @click.self="closeModal">
          <div class="modal-card">
            <div class="modal-header">
              <h3 class="modal-title">{{ isEdit ? '编辑大类' : '新增大类' }}</h3>
              <button class="modal-close" @click="closeModal">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <!-- 大类名称 -->
              <div class="form-field">
                <label class="form-label required">大类名称</label>
                <input
                  v-model="form.name"
                  type="text"
                  class="form-input"
                  placeholder="例如：奥迪盖子"
                />
              </div>

              <!-- 规格模板 -->
              <div class="form-field">
                <label class="form-label">规格模板</label>
                <p class="form-hint">定义该大类商品的规格字段，每个商品可拥有不同的规格值</p>
                <div class="schema-editor">
                  <div
                    v-for="(field, index) in form.template_schema"
                    :key="index"
                    class="schema-row"
                  >
                    <input
                      v-model="form.template_schema[index]"
                      type="text"
                      class="form-input"
                      placeholder="规格名称，例如：型号"
                    />
                    <button
                      class="btn-remove-field"
                      @click="removeSchemaField(index)"
                      title="删除"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <button class="btn-add-field" @click="addSchemaField">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    添加规格字段
                  </button>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" @click="closeModal">取消</button>
              <button class="btn btn-primary" @click="handleSubmit" :disabled="loading">
                <span v-if="loading" class="loading-spinner"></span>
                {{ loading ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { categoryApi, productApi } from '@/api/index.js'

const categories = ref([])
const modalVisible = ref(false)
const isEdit = ref(false)
const loading = ref(false)
const editId = ref(null)

const defaultForm = () => ({
  name: '',
  template_schema: ['规格', '型号', 'LOGO']
})

const form = ref(defaultForm())

async function loadCategories() {
  try {
    const catRes = await categoryApi.list()
    const prodRes = await productApi.list()

    const categoriesData = catRes.data || []
    const productsData = prodRes.data || []

    // 统计每个大类下的商品数量
    categories.value = categoriesData.map(cat => ({
      ...cat,
      product_count: productsData.filter(p => String(p.category_id) === String(cat.id)).length
    }))
  } catch (err) {
    console.error('加载大类失败:', err)
    alert('加载大类失败: ' + err.message)
  }
}

function openAddModal() {
  isEdit.value = false
  editId.value = null
  form.value = defaultForm()
  modalVisible.value = true
}

function openEditModal(cat) {
  isEdit.value = true
  editId.value = cat.id
  form.value = {
    name: cat.name,
    template_schema: [...(cat.template_schema || [])]
  }
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
}

function addSchemaField() {
  form.value.template_schema.push('')
}

function removeSchemaField(index) {
  form.value.template_schema.splice(index, 1)
}

async function handleSubmit() {
  if (!form.value.name.trim()) {
    return alert('请输入大类名称')
  }

  // 过滤空字段
  const schema = form.value.template_schema.filter(s => s && s.trim())

  loading.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      template_schema: schema
    }

    if (isEdit.value) {
      await categoryApi.update(editId.value, payload)
    } else {
      await categoryApi.create(payload)
    }

    await loadCategories()
    closeModal()
  } catch (err) {
    alert(err.message)
  } finally {
    loading.value = false
  }
}

async function handleDelete(cat) {
  if (cat.product_count > 0) {
    return alert(`该大类下有 ${cat.product_count} 件商品，无法删除`)
  }
  if (!confirm(`确认删除大类「${cat.name}」吗？`)) return

  try {
    await categoryApi.delete(cat.id)
    await loadCategories()
  } catch (err) {
    alert(err.message)
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  const date = new Date(timeStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

onMounted(() => {
  loadCategories()
})
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 2rem;
}

/* ---- 顶部操作栏 ---- */
.top-bar {
  background: white;
  padding: 1.25rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.top-bar-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.category-count {
  font-size: 0.8125rem;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
}

.btn-add {
  height: 2.5rem;
  padding: 0 1.125rem;
  background: #1a1a2e;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: background 0.15s;
}

.btn-add:hover {
  background: #2d2d44;
}

/* ---- 大类卡片 ---- */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.category-card {
  background: white;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.category-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-title h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 0.25rem;
}

.product-count {
  font-size: 0.8125rem;
  color: #9ca3af;
}

.card-actions {
  display: flex;
  gap: 0.375rem;
}

.action-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn.edit {
  color: #6b7280;
  background: #f3f4f6;
}

.action-btn.edit:hover {
  background: #dbeafe;
  color: #2563eb;
}

.action-btn.delete {
  color: #6b7280;
  background: #f3f4f6;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.card-body {
  padding: 1rem 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.schema-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schema-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.schema-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.schema-tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.8125rem;
  color: #374151;
  background: #f3f4f6;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
}

.no-schema {
  font-size: 0.8125rem;
  color: #9ca3af;
  font-style: italic;
}

.card-footer {
  padding-top: 0.75rem;
}

.create-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* 空状态 */
.empty-state-card {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* ---- 弹窗 ---- */
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
  max-width: 540px;
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

/* 表单 */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.form-hint {
  font-size: 0.8125rem;
  color: #9ca3af;
  margin-top: -0.25rem;
}

.form-input {
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

/* 规格编辑器 */
.schema-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schema-row {
  display: flex;
  gap: 0.5rem;
}

.schema-row .form-input {
  flex: 1;
}

.btn-remove-field {
  width: 2.625rem;
  height: 2.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-remove-field:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

.btn-add-field {
  height: 2.625rem;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1.5px dashed #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add-field:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
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
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
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

/* 响应式 */
@media (max-width: 768px) {
  .page-container {
    padding: 1rem;
  }

  .top-bar {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
  }

  .category-grid {
    grid-template-columns: 1fr;
  }
}
</style>
