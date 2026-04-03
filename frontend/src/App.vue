<script setup>
import { ref, computed, watch, provide } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 主题状态管理
const isDark = ref(true)

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}

// 提供给子组件使用
provide('isDark', isDark)

// 初始化主题
watch(isDark, (val) => {
  document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light')
}, { immediate: true })

// 导航项（首页改为统计面板，产品大类放最后）
const navItems = [
  { name: '统计面板', path: '/stats', icon: '▣' },
  { name: '商品管理', path: '/products', icon: '◈' },
  { name: '库存日志', path: '/inventory', icon: '◉' },
  { name: '扫码入库', path: '/scan', icon: '⌨' },
  { name: '产品大类', path: '/categories', icon: '☰' },
]

// 主题图标
const themeIcon = computed(() => isDark.value ? '☀️' : '🌙')
const themeLabel = computed(() => isDark.value ? '亮色模式' : '暗色模式')
</script>

<template>
  <div class="flex h-screen overflow-hidden" :data-theme="isDark ? 'dark' : 'light'">
    <!-- 侧边导航 -->
    <aside class="w-56 flex-shrink-0 flex flex-col border-r border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <!-- Logo 区域 -->
      <div class="px-5 py-6 border-b border-[var(--border-default)]">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-base font-semibold text-[var(--text-primary)] tracking-wide leading-snug">
              档把库存系统
            </h1>
            <p class="text-xs text-[var(--text-muted)] mt-1">auto-parts-inventory v1.0</p>
          </div>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 px-3 py-4 space-y-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
          :class="
            route.path === item.path
              ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium border border-[var(--accent)]/30'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] border border-transparent'
          "
        >
          <span class="text-base leading-none">{{ item.icon }}</span>
          {{ item.name }}
        </router-link>
      </nav>

      <!-- 底部区域：主题切换 + 版权 -->
      <div class="px-3 pb-3 space-y-2">
        <!-- 主题切换按钮 -->
        <button
          @click="toggleTheme"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-all duration-150 border border-transparent hover:border-[var(--border-default)]"
          :title="themeLabel"
        >
          <div class="flex items-center gap-3">
            <span class="text-base leading-none">{{ themeIcon }}</span>
            <span>{{ themeLabel }}</span>
          </div>
          <span class="text-xs text-[var(--text-muted)]">切换</span>
        </button>

        <!-- 版权信息 -->
        <div class="px-3 pt-3 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)]">
          &copy; 2026 跨境汽配小件
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-auto bg-[var(--bg-primary)]">
      <router-view />
    </main>
  </div>
</template>
