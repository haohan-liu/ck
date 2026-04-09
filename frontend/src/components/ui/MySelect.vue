<script setup>
/**
 * MySelect — 完全自定义下拉单选框
 *
 * Props:
 *   modelValue   — 当前选中值（v-model）
 *   options      — 选项列表 [{ value, label }]
 *   placeholder  — 未选中时提示文字
 *   disabled     — 是否禁用
 *   error        — 错误提示文字
 *   size         — 'sm' | 'md' | 'lg'
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: [String, Number],
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: '请选择…',
  },
  disabled: Boolean,
  error: String,
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const dropdownRef = ref(null)
const labelRef = ref(null)

// 当前选中项
const selectedOption = computed(() => {
  return props.options.find(o => String(o.value) === String(props.modelValue)) || null
})

const displayText = computed(() => {
  return selectedOption.value ? selectedOption.value.label : props.placeholder
})

// 尺寸对应的高度
const sizeHeight = computed(() => {
  if (props.size === 'sm') return 'h-8 text-xs'
  if (props.size === 'lg') return 'h-11 text-base'
  return 'h-9 text-sm'
})

function open() {
  if (props.disabled) return
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

function select(option) {
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
}

// 点击外部关闭
function handleOutsideClick(e) {
  if (!dropdownRef.value) return
  if (!dropdownRef.value.contains(e.target)) {
    close()
  }
}

watch(isOpen, (val) => {
  if (val) {
    document.addEventListener('mousedown', handleOutsideClick)
  } else {
    document.removeEventListener('mousedown', handleOutsideClick)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<template>
  <div ref="dropdownRef" class="relative w-full">
    <!-- 触发器 -->
    <button
      type="button"
      :disabled="disabled"
      :class="[
        'relative w-full flex items-center justify-between rounded-lg border bg-[var(--input-bg)]',
        'transition-all duration-150 text-left select-none',
        sizeHeight,
        isOpen
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent-glow)]'
          : error
          ? 'border-red-500/60'
          : 'border-[var(--input-border)] hover:border-[var(--border-strong)]',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]"
      @click="toggle"
    >
      <span
        :class="[
          'pl-3.5 pr-2 truncate',
          selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
        ]"
      >
        {{ displayText }}
      </span>
      <!-- 箭头图标 -->
      <span
        :class="[
          'mr-3 shrink-0 transition-transform duration-200',
          isOpen ? 'rotate-180' : 'rotate-0',
        ]"
      >
        <svg class="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
        </svg>
      </span>
    </button>

    <!-- 下拉选项列表 -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-[-4px]"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-[-4px]"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--modal-bg)] shadow-xl shadow-black/40 overflow-hidden"
      >
        <div class="max-h-60 overflow-y-auto py-1">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            :class="[
              'w-full flex items-center px-3.5 py-2.5 text-left transition-colors duration-100',
              'hover:bg-[var(--hover-bg)] cursor-pointer',
              String(option.value) === String(modelValue)
                ? 'text-[var(--accent)] bg-[var(--accent)]/10 font-medium'
                : 'text-[var(--text-secondary)]',
            ]"
            :size="size"
            @click="select(option)"
          >
            <span class="truncate">{{ option.label }}</span>
            <!-- 选中标记 -->
            <svg
              v-if="String(option.value) === String(modelValue)"
              class="w-4 h-4 ml-2 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          </button>
          <!-- 空状态 -->
          <div
            v-if="!options || options.length === 0"
            class="px-3.5 py-6 text-center text-sm text-[var(--text-muted)]"
          >
            暂无可选选项
          </div>
        </div>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <p v-if="error" class="mt-1 text-xs text-red-400 flex items-center gap-1">
      <span class="text-base leading-none">!</span>
      {{ error }}
    </p>
  </div>
</template>
