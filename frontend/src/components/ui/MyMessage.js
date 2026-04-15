/**
 * MyMessage.js — 全局 Toast 提示插件
 *
 * 用法：
 *   import MyMessage from '@/components/ui/MyMessage.js'
 *   MyMessage.success('保存成功！')
 *   MyMessage.error('网络错误，请重试')
 *   MyMessage.warning('库存已不足，请检查')
 *   MyMessage.info('数据已更新')
 */

import { createApp, defineComponent, h, ref, reactive } from 'vue'

// ======================== 单个 Toast 组件（带独立动画） ========================
const ToastItem = defineComponent({
  name: 'MyMessageToastItem',
  props: {
    toast: { type: Object, required: true },
  },
  emits: ['remove'],
  setup(props, { emit }) {
    const visible = ref(false)
    // 延迟显示，让容器先渲染
    setTimeout(() => { visible.value = true }, 10)

    // 自动移除
    if (props.toast.duration > 0) {
      setTimeout(() => {
        visible.value = false
        setTimeout(() => emit('remove', props.toast.id), 300)
      }, props.toast.duration)
    }

    return { visible }
  },
  computed: {
    iconSvg() {
      switch (this.toast.type) {
        case 'success':
          return `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`
        case 'error':
          return `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        case 'warning':
          return `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
        default:
          return `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
      }
    },
    styleClass() {
      switch (this.toast.type) {
        case 'success': return 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
        case 'error':   return 'border-red-500/50 bg-red-950/80 text-red-200'
        case 'warning':  return 'border-amber-500/50 bg-amber-950/80 text-amber-200'
        default:        return 'border-sky-500/50 bg-sky-950/80 text-sky-200'
      }
    },
    iconColorClass() {
      switch (this.toast.type) {
        case 'success': return 'text-emerald-400'
        case 'error':   return 'text-red-400'
        case 'warning':  return 'text-amber-400'
        default:         return 'text-sky-400'
      }
    },
  },
  render() {
    return h('div', {
      class: [
        'toast-item flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl shadow-black/40 backdrop-blur-sm',
        this.styleClass,
        this.visible ? 'toast-enter-active' : 'toast-leave-active'
      ]
    }, [
      h('span', { class: this.iconColorClass, innerHTML: this.iconSvg }),
      h('p', { class: 'flex-1 text-sm leading-relaxed break-words' }, this.toast.message),
      h('button', {
        class: 'shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer -mt-0.5',
        onClick: () => {
          this.visible = false
          setTimeout(() => this.$emit('remove', this.toast.id), 300)
        }
      }, [
        h('svg', { class: 'w-3.5 h-3.5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.5', d: 'M6 18L18 6M6 6l12 12' })
        ])
      ])
    ])
  },
})

// ======================== Toast 容器 & 全局 API ========================

let toastApp = null
let container = null
let toastList = reactive([])
let toastIdCounter = 0

function ensureContainer() {
  if (!container) {
    container = document.createElement('div')
    container.id = 'my-toast-container'
    container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      width: 90%;
      max-width: 400px;
    `
    document.body.appendChild(container)

    toastApp = createApp({
      setup() {
        return () => toastList.map(toast =>
          h(ToastItem, {
            key: toast.id,
            toast,
            onRemove: (id) => {
              const idx = toastList.findIndex(t => t.id === id)
              if (idx !== -1) toastList.splice(idx, 1)
            }
          })
        )
      }
    })
    toastApp.mount(container)
  }
}

function show(message, type = 'info', duration = 3000) {
  ensureContainer()

  const id = ++toastIdCounter
  toastList.push({ id, type, message, duration })

  return id
}

function hide(id) {
  const idx = toastList.findIndex(t => t.id === id)
  if (idx !== -1) toastList.splice(idx, 1)
}

function injectStyles() {
  if (document.getElementById('my-toast-styles')) return
  const style = document.createElement('style')
  style.id = 'my-toast-styles'
  style.textContent = `
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(24px) scale(0.95); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes toast-out {
      from { opacity: 1; transform: translateX(0) scale(1); }
      to   { opacity: 0; transform: translateX(24px) scale(0.95); }
    }
    .toast-enter-active { animation: toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    .toast-leave-active { animation: toast-out 0.25s ease forwards; }
  `
  document.head.appendChild(style)
}

const MyMessage = {
  success: (msg, duration) => show(msg, 'success', duration ?? 3000),
  error:   (msg, duration) => show(msg, 'error',   duration ?? 4000),
  warning: (msg, duration) => show(msg, 'warning', duration ?? 3500),
  info:    (msg, duration) => show(msg, 'info',    duration ?? 3000),
  hide,
  show,
}

injectStyles()

export default MyMessage

export const MyMessagePlugin = {
  install(app) {
    app.config.globalProperties.$msg = MyMessage
    app.provide('$msg', MyMessage)
  },
}
