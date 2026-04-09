/**
 * MyMessage.js — 全局 Toast 提示插件
 *
 * 用法：
 *   import MyMessage from '@/components/ui/MyMessage.js'
 *   MyMessage.success('保存成功！')
 *   MyMessage.error('网络错误，请重试')
 *   MyMessage.warning('库存已不足，请检查')
 *   MyMessage.info('数据已更新')
 *
 * 也支持组件内直接调用：
 *   const { $msg } = getCurrentInstance()
 *   $msg.success('操作成功')
 */

import { createApp } from 'vue'

// ======================== Toast 组件（无 UI 框架，纯 CSS） ========================

const ToastComponent = {
  name: 'MyMessageToast',
  props: {
    id: { type: Number, required: true },
    type: { type: String, default: 'info' }, // info | success | warning | error
    message: { type: String, required: true },
    duration: { type: Number, default: 3000 },
  },
  emits: ['close'],
  computed: {
    iconSvg() {
      switch (this.type) {
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
      switch (this.type) {
        case 'success':
          return 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
        case 'error':
          return 'border-red-500/50 bg-red-950/80 text-red-200'
        case 'warning':
          return 'border-amber-500/50 bg-amber-950/80 text-amber-200'
        default:
          return 'border-sky-500/50 bg-sky-950/80 text-sky-200'
      }
    },
    iconColorClass() {
      switch (this.type) {
        case 'success': return 'text-emerald-400'
        case 'error':   return 'text-red-400'
        case 'warning':  return 'text-amber-400'
        default:         return 'text-sky-400'
      }
    },
  },
  mounted() {
    if (this.duration > 0) {
      this._timer = setTimeout(() => this.$emit('close'), this.duration)
    }
  },
  beforeUnmount() {
    if (this._timer) clearTimeout(this._timer)
  },
  template: `
    <div class="flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl shadow-black/40 backdrop-blur-sm" :class="styleClass">
      <span :class="iconColorClass" v-html="iconSvg"></span>
      <p class="flex-1 text-sm leading-relaxed break-words">{{ message }}</p>
      <button
        @click="$emit('close')"
        class="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer -mt-0.5"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `,
}

// ======================== Toast 容器 & 全局 API ========================

let toastApp = null
let container = null
let toastList = [] // 当前显示的 Toast 实例列表
let toastIdCounter = 0

// 确保容器已挂载
function ensureContainer() {
  if (!container) {
    container = document.createElement('div')
    container.id = 'my-toast-container'
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 360px;
      width: 100%;
    `
    document.body.appendChild(container)

    // 创建独立 Vue 实例用于 Toast 渲染
    toastApp = createApp({})
    toastApp.mount(container)
  }
}

function removeToast(id) {
  const idx = toastList.findIndex(t => t.id === id)
  if (idx !== -1) {
    const [toast] = toastList.splice(idx, 1)
    // 重新渲染列表
    renderToasts()
  }
}

function renderToasts() {
  if (!toastApp) return

  // 清除旧组件
  const existing = container.querySelectorAll('[data-toast-id]')
  existing.forEach(el => el.remove())

  toastList.forEach(toast => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-toast-id', toast.id)
    wrapper.style.cssText = `
      pointer-events: auto;
      animation: toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `
    container.appendChild(wrapper)

    const vm = toastApp.mount(wrapper)
    vm.$data = toast
    vm.$options.emits = { close: null }
    vm.$on('close', () => removeToast(toast.id))
  })
}

function show(message, type = 'info', duration = 3000) {
  ensureContainer()

  const id = ++toastIdCounter
  toastList.push({ id, type, message, duration })

  // 延迟挂载，确保容器已准备好
  setTimeout(() => renderToasts(), 0)

  return id
}

function hide(id) {
  removeToast(id)
}

// 添加 CSS 动画（仅首次）
function injectStyles() {
  if (document.getElementById('my-toast-styles')) return
  const style = document.createElement('style')
  style.id = 'my-toast-styles'
  style.textContent = `
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(20px) scale(0.95); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }
  `
  document.head.appendChild(style)
}

// ======================== 对外暴露的 API ========================

const MyMessage = {
  success: (msg, duration) => show(msg, 'success', duration ?? 3000),
  error:   (msg, duration) => show(msg, 'error',   duration ?? 4000),
  warning: (msg, duration) => show(msg, 'warning', duration ?? 3500),
  info:    (msg, duration) => show(msg, 'info',    duration ?? 3000),
  hide,
  show,
}

// 自动注入动画样式
injectStyles()

export default MyMessage

// ======================== Vue 插件模式（可选） ========================
// 如需在 Vue 中以 app.use(MyMessage) 方式注册：
export const MyMessagePlugin = {
  install(app) {
    app.config.globalProperties.$msg = MyMessage
    app.provide('$msg', MyMessage)
  },
}