<script setup>
/**
 * MyFilterSearch — 搜索输入框组件（与筛选框一致的风格）
 */
import { ref } from 'vue'

const props = defineProps({
  modelValue: String,
  placeholder: {
    type: String,
    default: '搜索…',
  },
  disabled: Boolean,
})

const emit = defineEmits(['update:modelValue', 'search'])

const inputRef = ref(null)
const isFocused = ref(false)

function onInput(e) {
  emit('update:modelValue', e.target.value)
  emit('search', e.target.value)
}

function clear() {
  emit('update:modelValue', '')
  emit('search', '')
  inputRef.value?.focus()
}
</script>

<template>
  <div class="relative flex items-center" style="height: 40px;">
    <!-- 搜索图标 -->
    <div 
      class="absolute start-0 flex items-center justify-center pointer-events-none z-10"
      style="width: 44px; height: 100%;"
    >
      <svg
        class="w-4 h-4"
        :style="{ color: isFocused ? 'var(--filter-accent)' : 'var(--text-muted)' }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    </div>

    <!-- 输入框 -->
    <input
      ref="inputRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      type="text"
      class="w-full h-full ps-11 pe-10 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
      :style="{
        backgroundColor: 'var(--input-bg)',
        border: '1px solid ' + (isFocused ? 'var(--filter-accent)' : 'var(--input-border)'),
        color: 'var(--text-primary)',
        outline: 'none',
        boxShadow: isFocused ? '0 0 0 3px var(--filter-glow)' : 'none'
      }"
      @input="onInput"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />

    <!-- 清除按钮 -->
    <button
      v-if="modelValue && !disabled"
      type="button"
      class="absolute end-0 flex items-center justify-center cursor-pointer transition-colors duration-200"
      style="width: 44px; height: 100%; color: var(--text-muted);"
      @click="clear"
      @mouseenter="(e) => e.currentTarget.style.color = 'var(--filter-accent)'"
      @mouseleave="(e) => e.currentTarget.style.color = 'var(--text-muted)'"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>
</template>
