<script setup>
import { watch, onUnmounted, computed } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '提示' },
  width: { type: String, default: 'max-w-lg' },
  closeOnBackdrop: { type: Boolean, default: true },
  hideClose: Boolean,
  showFooter: { type: Boolean, default: true },
  transitionName: { type: String, default: 'modal' },
})

const emit = defineEmits(['update:modelValue', 'close', 'confirm'])

watch(() => props.modelValue, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onUnmounted(() => { document.body.style.overflow = '' })

function close() { emit('update:modelValue', false); emit('close') }
function onBackdropClick() { if (props.closeOnBackdrop) close() }

// 移动端底部抽屉检测
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 1024
})
</script>

<template>
  <Teleport to="body">
    <Transition :name="transitionName" appear>
      <div v-if="modelValue" class="fixed inset-0 z-[100]">
        <!-- PC端居中布局 -->
        <template v-if="!isMobile">
          <!-- 遮罩 -->
          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
            @click="onBackdropClick"
          ></div>
          <!-- 弹窗主体 -->
          <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              class="relative w-full scale-in rounded-2xl shadow-xl pointer-events-auto"
              :style="{
                backgroundColor: 'var(--modal-bg)',
                border: '1px solid var(--modal-border)',
                boxShadow: 'var(--modal-shadow)',
                maxWidth: width === 'full' ? 'calc(100vw - 2rem)' : undefined
              }"
              :class="width !== 'full' ? width : ''"
            >
              <!-- 标题栏 -->
              <div
                class="flex items-center justify-between px-6 py-4"
                style="border-bottom: 1px solid var(--modal-border);"
              >
                <div class="flex items-center gap-3">
                  <slot name="icon" />
                  <h3 class="text-base font-bold leading-snug" style="color: var(--text-primary);">{{ title }}</h3>
                </div>
                <button
                  v-if="!hideClose"
                  @click="close"
                  class="w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                  style="color: var(--text-muted);"
                  @mouseenter="($event.target.style.color = 'var(--text-secondary)')"
                  @mouseleave="($event.target.style.color = 'var(--text-muted)')"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
              <!-- 内容区 -->
              <div class="px-6 py-5 overflow-y-auto" style="max-height: calc(90vh - 140px)">
                <slot />
              </div>
              <!-- 底部按钮 -->
              <div
                v-if="showFooter"
                class="px-6 py-4 flex items-center justify-end gap-3"
                style="border-top: 1px solid var(--modal-border);"
              >
                <slot name="footer">
                  <button @click="close" class="px-4 py-2.5 text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all"
                    style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);"
                  >
                    取消
                  </button>
                  <button @click="$emit('confirm')" class="px-5 py-2.5 text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer"
                    style="background: var(--accent);"
                  >
                    确认
                  </button>
                </slot>
              </div>
            </div>
          </div>
        </template>

        <!-- 移动端底部抽屉 -->
        <template v-else>
          <!-- 全屏遮罩 -->
          <div
            class="absolute inset-0 bg-black/60"
            @click="onBackdropClick"
          ></div>
          <!-- 抽屉主体 -->
          <div
            class="absolute bottom-0 left-0 right-0 rounded-t-2xl scale-in"
            style="
              background-color: var(--modal-bg);
              box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.25);
              max-height: 85vh;
              z-index: 2;
            "
          >
            <!-- 拖拽指示条 -->
            <div class="flex-shrink-0 flex justify-center pt-3 pb-2">
              <div class="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
            </div>

            <!-- 标题栏 -->
            <div
              class="flex items-center justify-between px-4 py-3"
              style="border-bottom: 1px solid var(--modal-border);"
            >
              <div class="flex items-center gap-2">
                <slot name="icon" />
                <h3 class="text-sm font-bold leading-snug" style="color: var(--text-primary);">{{ title }}</h3>
              </div>
              <button
                v-if="!hideClose"
                @click="close"
                class="w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer"
                style="color: var(--text-muted);"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <!-- 内容区 -->
            <div class="px-4 py-4 overflow-y-auto" style="max-height: calc(85vh - 120px); font-size: 13px;">
              <slot />
            </div>

            <!-- 底部按钮 -->
            <div
              v-if="showFooter"
              class="px-4 py-4 flex items-center justify-end gap-2"
              style="border-top: 1px solid var(--modal-border); padding-bottom: max(1rem, env(safe-area-inset-bottom, 1rem));"
            >
              <slot name="footer">
                <button @click="close" class="px-4 py-2 text-xs font-medium rounded-lg border cursor-pointer active:scale-95 transition-all"
                  style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);"
                >
                  取消
                </button>
                <button @click="$emit('confirm')" class="px-4 py-2 text-xs font-bold text-white rounded-lg border border-transparent active:scale-95 transition-all cursor-pointer"
                  style="background: var(--accent);"
                >
                  确认
                </button>
              </slot>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .relative { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease; }
.modal-leave-active .relative { transition: transform 0.15s ease-in, opacity 0.15s ease; }
.modal-enter-from .relative { transform: scale(0.92) translateY(12px); opacity: 0; }
.modal-leave-to .relative { transform: scale(0.95) translateY(8px); opacity: 0; }
.scale-in { animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes scale-in { 0% { opacity: 0; transform: scale(0.94); } 100% { opacity: 1; transform: scale(1); } }
</style>
