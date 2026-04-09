<script setup>
/**
 * MyModal — 优雅的弹窗组件（支持遮罩层点击关闭 / 禁止关闭 / 按钮区自定义）
 *
 * Props:
 *   modelValue       — v-model 控制显示/隐藏
 *   title            — 弹窗标题
 *   width            — 最大宽度，默认 'max-w-lg'（可传 'max-w-sm', 'max-w-2xl', 'max-w-4xl', 'full'）
 *   closeOnBackdrop  — 点击遮罩是否关闭，默认 true
 *   hideClose        — 是否隐藏右上角关闭按钮，默认 false
 *   footer           — 是否显示底部按钮区，默认 true
 *   transitionName   — 过渡动画名，默认 'modal'
 *
 * Slots:
 *   default  — 弹窗主体内容
 *   footer   — 自定义底部（优先级高于默认按钮区）
 *   icon     — 自定义标题区图标
 */
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  title: {
    type: String,
    default: '提示',
  },
  width: {
    type: String,
    default: 'max-w-lg',
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true,
  },
  hideClose: Boolean,
  showFooter: {
    type: Boolean,
    default: true,
  },
  transitionName: {
    type: String,
    default: 'modal',
  },
})

const emit = defineEmits(['update:modelValue', 'close', 'confirm'])

// 响应式关闭遮罩滚动
watch(() => props.modelValue, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onBackdropClick() {
  if (props.closeOnBackdrop) close()
}
</script>

<template>
  <Teleport to="body">
    <Transition :name="transitionName" appear>
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- 遮罩层：高斯模糊 + 半透明黑 -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="onBackdropClick"
        ></div>

        <!-- 弹窗主体 -->
        <div
          :class="[
            'relative w-full bg-[var(--modal-bg)] border border-[var(--border-strong)]',
            'rounded-2xl shadow-2xl shadow-black/60 overflow-hidden',
            width === 'full' ? 'max-w-[calc(100vw-2rem)]' : width,
          ]"
        >
          <!-- ��题栏 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <div class="flex items-center gap-3">
              <!-- 自定义图标区 -->
              <slot name="icon" />
              <h3 class="text-base font-semibold text-[var(--text-primary)] leading-snug">
                {{ title }}
              </h3>
            </div>
            <!-- 关闭按钮 -->
            <button
              v-if="!hideClose"
              @click="close"
              class="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-all duration-150 cursor-pointer"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- 内容区 -->
          <div class="px-6 py-5 overflow-y-auto" style="max-height: calc(90vh - 140px)">
            <slot />
          </div>

          <!-- 底部按钮区 -->
          <div
            v-if="showFooter"
            class="px-6 py-4 border-t border-[var(--border-default)] bg-[var(--modal-bg)]/80 flex items-center justify-end gap-3"
          >
            <slot name="footer">
              <!-- 默认按钮插槽（如果 footer slot 有内容则优先使用） -->
              <button
                @click="close"
                class="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-all duration-150 cursor-pointer"
              >
                取消
              </button>
              <button
                @click="$emit('confirm')"
                class="px-5 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-95 rounded-lg font-medium transition-all duration-150 cursor-pointer"
              >
                确认
              </button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 过渡动画：弹窗从下方升起 + 淡入 */
.modal-enter-active {
  transition: opacity 0.2s ease;
}
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* 弹窗内容缩放动画（配合淡入淡出） */
.modal-enter-active .relative {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}
.modal-leave-active .relative {
  transition: transform 0.15s ease-in, opacity 0.15s ease;
}
.modal-enter-from .relative {
  transform: scale(0.92) translateY(12px);
  opacity: 0;
}
.modal-leave-to .relative {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>