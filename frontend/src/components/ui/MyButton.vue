<script setup>
/**
 * MyButton — 统一样式按钮组件
 *
 * Props:
 *   type        — 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
 *   size        — 'sm' | 'md' | 'lg'
 *   disabled    — 是否禁用
 *   loading     — 是否显示加载中状态
 *   fullWidth   — 是否占满宽度
 */
const props = defineProps({
  type: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'danger', 'ghost', 'warning'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  disabled: Boolean,
  loading: Boolean,
  fullWidth: Boolean,
})

const emit = defineEmits(['click'])

function handleClick(e) {
  if (props.disabled || props.loading) return
  emit('click', e)
}
</script>

<template>
  <button
    :type="'button'"
    :disabled="disabled || loading"
    :class="[
      // 基础样式
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
      'transition-all duration-150 cursor-pointer select-none',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      // 尺寸
      size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm',
      // 宽度
      fullWidth ? 'w-full' : '',
      // 类型
      type === 'primary'
        ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-95 active:bg-[var(--accent-active)] text-white focus-visible:ring-[var(--accent)]'
        : type === 'secondary'
        ? 'border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-strong)] bg-transparent active:scale-95 focus-visible:ring-[var(--border-strong)]'
        : type === 'danger'
        ? 'bg-red-600 hover:bg-red-500 active:bg-red-700 active:scale-95 text-white focus-visible:ring-red-500'
        : type === 'warning'
        ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 active:scale-95 text-white focus-visible:ring-amber-500'
        : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] active:scale-95 focus-visible:ring-[var(--border-strong)]',
      // 禁用
      (disabled || loading) ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
    ]"
    @click="handleClick"
  >
    <!-- 加载指示器 -->
    <svg
      v-if="loading"
      class="animate-spin shrink-0"
      :class="size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
    <slot />
  </button>
</template>
