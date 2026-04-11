import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      // exceljs 主入口是 Node 版，浏览器必须用 dist 打包版，否则动态导入会加载失败
      exceljs: path.resolve(__dirname, 'node_modules/exceljs/dist/exceljs.min.js'),
    },
  },
  optimizeDeps: {
    include: ['exceljs', 'html5-qrcode'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
