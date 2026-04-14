<script setup>
/**
 * MyFilterSelect — 下拉筛选组件（蓝紫色主题）
 */
import { ref, computed, watch, onUnmounted } from 'vue'

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
  style: [String, Object],
  compact: Boolean, // 紧凑模式：只显示图标
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const dropdownRef = ref(null)
const buttonRef = ref(null)

const selectedOption = computed(() => {
  return props.options.find(o => String(o.value) === String(props.modelValue)) || null
})

const displayText = computed(() => {
  return selectedOption.value ? selectedOption.value.label : props.placeholder
})

const buttonStyle = computed(() => {
  const baseStyle = {
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    outline: 'none',
    transition: 'border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
  
  // 紧凑模式：只显示图标，居中显示
  if (props.compact) {
    Object.assign(baseStyle, {
      padding: '0 12px',
      borderColor: isOpen.value ? 'var(--filter-accent)' : 'var(--input-border)',
      color: isOpen.value ? 'var(--filter-accent)' : 'var(--text-secondary)',
      boxShadow: isOpen.value ? '0 0 0 3px var(--filter-glow)' : 'none',
      width: '40px' // 正方形按钮
    })
  } else {
    Object.assign(baseStyle, {
      padding: '0 16px',
      fontSize: '14px',
      fontWeight: '500',
      borderColor: isOpen.value ? 'var(--filter-accent)' : 'var(--input-border)',
      color: isOpen.value ? 'var(--filter-accent)' : 'var(--text-secondary)',
      boxShadow: isOpen.value ? '0 0 0 3px var(--filter-glow)' : 'none'
    })
  }
  
  return baseStyle
})

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function select(option) {
  emit('update:modelValue', option.value)
  emit('change', option.value)
  isOpen.value = false
}

function handleOutsideClick(e) {
  if (!dropdownRef.value?.contains(e.target)) {
    isOpen.value = false
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
  <div ref="dropdownRef" class="relative" :style="props.style">
    <!-- 触发器按钮 -->
    <button
      ref="buttonRef"
      type="button"
      :disabled="disabled"
      class="flex items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      :class="compact ? 'h-full justify-center px-0' : 'gap-2'"
      :style="buttonStyle"
      @click="toggle"
    >
      <!-- 筛选图标 -->
      <svg 
        class="shrink-0"
        style="width: 16px; height: 16px;" 
        :style="{ color: isOpen ? 'var(--filter-accent)' : 'var(--text-muted)' }" 
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
      </svg>

      <!-- 文字 (compact 模式下隐藏) -->
      <span v-if="!compact" class="truncate">{{ displayText }}</span>

      <!-- 箭头 -->
      <svg
        v-if="!compact"
        class="shrink-0 transition-transform duration-200"
        style="width: 16px; height: 16px;"
        :style="{ 
          color: isOpen ? 'var(--filter-accent)' : 'var(--text-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
        }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
      </svg>
    </button>

    <!-- 下拉列表 -->
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
        class="absolute z-50"
        style="
          margin-top: 8px;
          min-width: 160px;
          border-radius: 12px;
          background-color: var(--modal-bg);
          border: 1px solid var(--border-strong);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          overflow: hidden;
        "
      >
        <div style="max-height: 240px; overflow-y: auto; padding: 6px 0;">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="w-full flex items-center text-left transition-colors duration-100 cursor-pointer"
            style="padding: 10px 16px; font-size: 14px;"
            :style="{
              backgroundColor: String(option.value) === String(modelValue) ? 'var(--filter-bg)' : 'transparent',
              color: String(option.value) === String(modelValue) ? 'var(--filter-accent)' : 'var(--text-secondary)',
              fontWeight: String(option.value) === String(modelValue) ? '500' : '400'
            }"
            @click="select(option)"
          >
            <span class="truncate flex-1">{{ option.label }}</span>
            <svg
              v-if="String(option.value) === String(modelValue)"
              class="ms-2 shrink-0"
              style="width: 16px; height: 16px; color: var(--filter-accent);"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
          </button>

          <div
            v-if="!options || options.length === 0"
            style="padding: 24px 16px; text-align: center; font-size: 14px; color: var(--text-muted);"
          >
            暂无可选选项
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
