<script setup>
import { ref, computed, watch, provide } from 'vue'
import { useRoute } from 'vue-router'
import { MyButton } from './components/ui/index.js'

const route = useRoute()

// ======================== 主题状态 ========================
// 从 localStorage 读取保存的主题，避免刷新后恢复默认
const isDark = ref(localStorage.getItem('theme') !== 'light')

const toggleTheme = () => {
  isDark.value = !isDark.value
}
watch(isDark, (val) => {
  document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light')
  localStorage.setItem('theme', val ? 'dark' : 'light')
}, { immediate: true })
provide('isDark', isDark)

// ======================== 移动端抽屉 ========================
const drawerOpen = ref(false)
function openDrawer()  { drawerOpen.value = true }
function closeDrawer() { drawerOpen.value = false }

// ======================== 导航项定义 ========================
const navItems = [
  { name: '统计面板', path: '/stats', icon: '▣' },
  { name: '商品管理', path: '/products', icon: '◈' },
  { name: '库存日志', path: '/inventory', icon: '◉' },
  { name: '扫码入库', path: '/scan', icon: '⌨' },
  { name: '库位地图', path: '/map', icon: '▦' },
  { name: '产品大类', path: '/categories', icon: '☰' },
]

function isActive(path) {
  return route.path === path
}

function navigateTo(path) {
  closeDrawer()
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-[var(--bg-primary)]" :data-theme="isDark ? 'dark' : 'light'">

    <!-- ================================================ -->
    <!-- PC 端侧边栏（桌面宽度 >= 1024px 固定显示） -->
    <!-- ================================================ -->
    <aside class="hidden lg:flex w-56 flex-shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <!-- Logo 区 -->
      <div class="px-5 py-6 border-b border-[var(--border-default)]">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-sm font-bold shrink-0">
            档
          </div>
          <div class="min-w-0">
            <h1 class="text-sm font-semibold text-[var(--text-primary)] truncate tracking-wide leading-snug">
              档把库存系统
            </h1>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">auto-parts-inventory</p>
          </div>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group"
          :class="
            isActive(item.path)
              ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium border border-[var(--accent)]/30 shadow-sm shadow-[var(--accent)]/10'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] border border-transparent'
          "
        >
          <span class="text-base leading-none shrink-0 transition-transform duration-150"
            :class="isActive(item.path) ? 'scale-110' : 'group-hover:scale-105'">
            {{ item.icon }}
          </span>
          <span class="truncate">{{ item.name }}</span>
          <!-- 激活态小圆点 -->
          <span
            v-if="isActive(item.path)"
            class="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0"
          ></span>
        </router-link>
      </nav>

      <!-- 底部：主题切换 + 版权 -->
      <div class="px-3 pb-4 space-y-1">
        <!-- 主题切换 -->
        <button
          @click="toggleTheme"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] transition-all duration-150 border border-transparent hover:border-[var(--border-default)]"
        >
          <div class="flex items-center gap-3">
            <!-- 太阳图标（暗色模式切换到亮色） -->
            <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            <!-- 月亮图标（亮色模式切换到暗色） -->
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
            <span>{{ isDark ? '亮色模式' : '暗色模式' }}</span>
          </div>
          <span class="text-xs opacity-60">{{ isDark ? '☀️' : '🌙' }}</span>
        </button>

        <!-- 版权 -->
        <div class="px-3 pt-3 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)]">
          &copy; 2026 跨境汽配小件
        </div>
      </div>
    </aside>

    <!-- ================================================ -->
    <!-- 移动端布局（< 1024px） -->
    <!-- ================================================ -->
    <div class="flex flex-col flex-1 min-w-0 lg:hidden">

      <!-- 顶部栏 -->
      <header class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <!-- Logo -->
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold">档</div>
          <span class="text-sm font-semibold text-[var(--text-primary)]">档把库存</span>
        </div>
        <!-- 操作按钮 -->
        <div class="flex items-center gap-1">
          <!-- 主题切换 -->
          <button
            @click="toggleTheme"
            class="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] transition-colors cursor-pointer"
            :title="isDark ? '切换亮色模式' : '切换暗色模式'"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
          </button>
          <!-- 汉堡菜单 -->
          <button
            @click="openDrawer"
            class="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] transition-colors cursor-pointer"
            title="导航菜单"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- 主内容区 -->
      <main class="flex-1 overflow-auto">
        <router-view />
      </main>

      <!-- 底部导航（手机固定底部） -->
      <nav class="flex-shrink-0 flex items-center bg-[var(--bg-secondary)] border-t border-[var(--border-default)] pb-safe">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors duration-150 relative"
          :class="
            isActive(item.path)
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          "
        >
          <span class="text-base leading-none">{{ item.icon }}</span>
          <span class="leading-none">{{ item.name }}</span>
          <!-- 激活下划线指示器 -->
          <span
            v-if="isActive(item.path)"
            class="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[var(--accent)]"
          ></span>
        </router-link>
      </nav>
    </div>

    <!-- ================================================ -->
    <!-- PC 端主内容区 -->
    <!-- ================================================ -->
    <main class="flex-1 flex-col overflow-auto hidden lg:flex">
      <router-view />
    </main>

    <!-- ================================================ -->
    <!-- 移动端抽屉菜单 -->
    <!-- ================================================ -->
    <Transition name="drawer-fade">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-50 lg:hidden"
      >
        <!-- 遮罩 -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="closeDrawer"
        ></div>

        <!-- 抽屉 -->
        <div class="absolute right-0 top-0 h-full w-64 bg-[var(--bg-secondary)] border-l border-[var(--border-default)] shadow-2xl shadow-black/50 flex flex-col">
          <!-- 抽屉头部 -->
          <div class="flex items-center justify-between px-5 py-5 border-b border-[var(--border-default)]">
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-md bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold">档</div>
              <span class="text-sm font-semibold text-[var(--text-primary)]">导航菜单</span>
            </div>
            <button
              @click="closeDrawer"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] cursor-pointer"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- 导航列表 -->
          <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <router-link
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              @click="closeDrawer"
              class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-150"
              :class="
                isActive(item.path)
                  ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium border border-[var(--accent)]/30'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] border border-transparent'
              "
            >
              <span class="text-base leading-none">{{ item.icon }}</span>
              {{ item.name }}
            </router-link>
          </nav>

          <!-- 抽屉底部 -->
          <div class="px-5 py-5 border-t border-[var(--border-default)] space-y-3">
            <button
              @click="toggleTheme(); closeDrawer()"
              class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--row-hover)] transition-colors border border-transparent hover:border-[var(--border-default)] cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                </svg>
                {{ isDark ? '亮色模式' : '暗色模式' }}
              </div>
              <span class="text-xs opacity-60">{{ isDark ? '☀️' : '🌙' }}</span>
            </button>
            <div class="text-xs text-[var(--text-muted)] text-center pt-1">
              &copy; 2026 跨境汽配小件
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* 抽屉过渡动画 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-active .absolute.right-0,
.drawer-fade-leave-active .absolute.right-0 {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-fade-enter-from .absolute.right-0 {
  transform: translateX(100%);
}
.drawer-fade-leave-to .absolute.right-0 {
  transform: translateX(100%);
}

/* 安全区域适配（刘海屏底部） */
.pb-safe {
  padding-bottom: max(6px, env(safe-area-inset-bottom));
}
</style>
