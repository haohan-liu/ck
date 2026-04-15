<script setup>
import { ref, computed, watch, provide } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// ======================== 主题状态 ========================
const isDark = ref(localStorage.getItem('theme') !== 'light')

const toggleTheme = () => {
  isDark.value = !isDark.value
}
watch(isDark, (val) => {
  const theme = val ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  document.body.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}, { immediate: true })
provide('isDark', isDark)

// ======================== 移动端抽屉 ========================
const drawerOpen = ref(false)
function openDrawer()  { drawerOpen.value = true }
function closeDrawer() { drawerOpen.value = false }

// ======================== 导航项定义 ========================
const navItems = [
  {
    name: '统计面板',
    path: '/stats',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`
  },
  {
    name: '商品管理',
    path: '/products',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`
  },
  {
    name: '扫码出库',
    path: '/scan',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m9 11 5 5"/><path d="m14 11 5 5"/><path d="m14 11-5 5"/><path d="m9 16 5-5"/><rect x="6" y="6" width="4" height="4" rx="1"/></svg>`
  },
  {
    name: '库存日志',
    path: '/inventory',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`
  },
  {
    name: '库位地图',
    path: '/map',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`
  },
  {
    name: '产品大类',
    path: '/categories',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`
  },
]

function isActive(path) {
  return route.path === path
}
</script>

<template>
  <div
    class="fixed inset-0 w-full h-full overflow-hidden flex flex-row bg-slate-50 dark:bg-slate-950"
    :data-theme="isDark ? 'dark' : 'light'"
  >
    <div class="hidden lg:flex w-full h-full p-4 gap-4">
      <aside
        class="w-60 h-full flex flex-col shrink-0
               rounded-2xl overflow-hidden
               bg-white/70 dark:bg-slate-900/50
               backdrop-blur-xl
               border border-slate-200/50 dark:border-white/5
               shadow-[0_8px_30px_rgb(0,0,0,0.04)]
               dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
      >
        <div class="px-6 py-6 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                     bg-gradient-to-br from-indigo-500 to-indigo-600
                     shadow-lg shadow-indigo-500/25"
            >
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <h1 class="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight leading-snug">
                档把库存系统
              </h1>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">inventory</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 overflow-hidden"
            :class="
              isActive(item.path)
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
            "
          >
            <span
              v-if="isActive(item.path)"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/60"
            ></span>
            <span
              class="shrink-0 transition-transform duration-200 w-5 h-5"
              :class="isActive(item.path) ? 'scale-110' : 'group-hover:scale-105'"
              v-html="item.icon"
            ></span>
            {{ item.name }}
          </router-link>
        </nav>

        <div class="px-3 pb-5 pt-2 space-y-1 flex-shrink-0">
          <div class="h-px bg-slate-100 dark:bg-white/5 mx-1 mb-3"></div>

          <button
            @click="toggleTheme"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm
                   text-slate-600 dark:text-slate-400
                   hover:bg-slate-100 dark:hover:bg-white/5
                   hover:text-slate-900 dark:hover:text-white
                   transition-all duration-200 cursor-pointer"
          >
            <svg v-if="isDark"
              xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-amber-500" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/><path d="M12 20v2"/>
              <path d="m4.93 4.93 1.41 1.41"/>
              <path d="m17.66 17.66 1.41 1.41"/>
              <path d="M2 12h2"/><path d="M20 12h2"/>
              <path d="m6.34 17.66-1.41 1.41"/>
              <path d="m19.07 4.93-1.41 1.41"/>
            </svg>
            <svg v-else
              xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
            <span class="flex-1 text-left">{{ isDark ? '亮色模式' : '暗色模式' }}</span>
            <div class="w-9 h-5 rounded-full p-0.5 bg-slate-200 dark:bg-indigo-900/50 transition-all duration-300">
              <div
                class="w-4 h-4 rounded-full bg-white dark:bg-indigo-400 shadow-sm transition-all duration-300"
                :style="{ marginLeft: isDark ? '16px' : '0' }"
              ></div>
            </div>
          </button>

          <div class="pt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            &copy; 2026 浩涵 All Rights Reserved
          </div>
        </div>
      </aside>

      <main class="flex-1 min-w-0 h-full rounded-2xl overflow-hidden
                   bg-white/70 dark:bg-slate-900/50
                   backdrop-blur-xl
                   border border-slate-200/50 dark:border-white/5
                   shadow-[0_8px_30px_rgb(0,0,0,0.04)]
                   dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
        <div class="h-full overflow-auto p-3 md:p-4 lg:p-6">
          <router-view />
        </div>
      </main>
    </div>

    <div class="flex lg:hidden w-full h-full relative">

      <header
        class="absolute top-0 left-0 right-0 h-[56px] z-50 flex items-center justify-between px-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-100 dark:border-white/5"
        @touchmove.prevent
      >
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                   bg-gradient-to-br from-indigo-500 to-indigo-600
                   shadow-md shadow-indigo-500/25"
          >
            <svg class="w-[13px] h-[13px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <span class="text-sm font-bold text-slate-900 dark:text-white">档把库存</span>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="toggleTheme"
            class="w-9 h-9 flex items-center justify-center rounded-xl
                   text-slate-500 dark:text-slate-400
                   hover:bg-slate-100 dark:hover:bg-white/5
                   transition-all duration-200 cursor-pointer active:scale-95"
          >
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          </button>
          <button
            @click="openDrawer"
            class="w-9 h-9 flex items-center justify-center rounded-xl
                   text-slate-500 dark:text-slate-400
                   hover:bg-slate-100 dark:hover:bg-white/5
                   transition-all duration-200 cursor-pointer active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      <main
        class="absolute left-0 right-0 overflow-y-auto overscroll-none flex flex-col"
        style="top: 56px; bottom: calc(56px + env(safe-area-inset-bottom)); -webkit-overflow-scrolling: touch;"
      >
        <router-view />
      </main>

      <nav
        class="absolute bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-100 dark:border-white/5 flex items-stretch"
        style="padding-bottom: env(safe-area-inset-bottom); height: calc(56px + env(safe-area-inset-bottom));"
        @touchmove.prevent
      >
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="relative flex-1 flex flex-col items-center justify-center h-[56px] gap-0.5 text-[10px] transition-all duration-200 cursor-pointer select-none"
          :class="isActive(item.path) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'"
        >
          <div v-if="isActive(item.path)" class="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full" style="background: linear-gradient(90deg, #6366f1, #818cf8);"></div>
          <span class="transition-transform duration-150 w-5 h-5" :class="isActive(item.path) ? 'scale-110' : ''" v-html="item.icon"></span>
          <span class="font-medium leading-none">{{ item.name }}</span>
        </router-link>
      </nav>

    </div>

    <Transition name="drawer-slide">
      <div v-if="drawerOpen" class="fixed inset-0 z-[100] lg:hidden">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm touch-none" @click="closeDrawer" @touchmove.prevent></div>
        <div
          class="absolute right-0 top-0 h-full w-[280px] flex flex-col
                 rounded-l-2xl overflow-hidden
                 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl
                 border-l border-slate-200/50 dark:border-white/5
                 shadow-[-12px_0_60px_rgba(0,0,0,0.15)]"
        >
          <div class="px-5 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between touch-none" @touchmove.prevent>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
                <svg class="w-[13px] h-[13px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
              <span class="text-sm font-bold text-slate-900 dark:text-white">导航菜单</span>
            </div>
            <button @click="closeDrawer" class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto overscroll-none">
            <router-link
              v-for="item in navItems" :key="item.path" :to="item.path" @click="closeDrawer"
              class="group flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200"
              :class="isActive(item.path) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'"
            >
              <span class="shrink-0" v-html="item.icon"></span>
              {{ item.name }}
            </router-link>
          </nav>

          <div class="px-5 py-5 border-t border-slate-100 dark:border-white/5 space-y-2 touch-none" @touchmove.prevent>
            <button
              @click="toggleTheme(); closeDrawer()"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm
                     text-slate-600 dark:text-slate-400
                     hover:bg-slate-100 dark:hover:bg-white/5
                     hover:text-slate-900 dark:hover:text-white
                     transition-all duration-200 cursor-pointer"
            >
              <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              {{ isDark ? '亮色模式' : '暗色模式' }}
            </button>
            <div class="pt-2 text-center text-xs text-slate-400 dark:text-slate-500">
              &copy; 2026 浩涵 All Rights Reserved
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active > div:last-child,
.drawer-slide-leave-active > div:last-child {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-slide-enter-from > div:last-child {
  transform: translateX(100%);
}
.drawer-slide-leave-to > div:last-child {
  transform: translateX(100%);
}
</style>

<style>
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  /* 杜绝一切横向或纵向的原生页面弹性越界 */
  overflow: hidden !important;
  overscroll-behavior-y: none !important;
  -webkit-text-size-adjust: 100%;
}

#app {
  width: 100%;
  height: 100%;
  overflow: hidden !important;
}
</style>