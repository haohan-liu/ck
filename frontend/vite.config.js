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
    // 1. 允许通过局域网 IP 访问（手机访问必备）
    host: true, 
    // 2. 允许特定的域名访问（解决 Cloudflare Tunnel 的报错）
    // 这里建议设置为 true（允许所有）或者 '.trycloudflare.com'（允许所有隧道子域名）
    allowedHosts: ['.trycloudflare.com'], 
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
