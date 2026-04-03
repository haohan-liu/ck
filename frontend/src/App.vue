<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { name: '统计面板', path: '/stats', icon: '▣' },
  { name: '产品大类', path: '/categories', icon: '☰' },
  { name: '商品管理', path: '/products', icon: '◈' },
  { name: '库存日志', path: '/inventory', icon: '◉' },
]
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
    <!-- 侧边导航 -->
    <aside class="w-56 flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/50">
      <div class="px-5 py-6 border-b border-slate-800">
        <h1 class="text-base font-semibold text-slate-100 tracking-wide leading-snug">
          档把库存系统
        </h1>
        <p class="text-xs text-slate-500 mt-1">auto-parts-inventory v1.0</p>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150"
          :class="
            route.path === item.path
              ? 'bg-slate-800 text-emerald-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          "
        >
          <span class="text-base leading-none">{{ item.icon }}</span>
          {{ item.name }}
        </router-link>
      </nav>

      <div class="px-5 py-4 border-t border-slate-800 text-xs text-slate-600">
        &copy; 2026 跨境汽配小件
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
