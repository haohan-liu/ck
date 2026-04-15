import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import './style.css'
import App from './App.vue'

// 注册全局 Toast 插件（替换所有 alert / confirm）
import { MyMessagePlugin } from './components/ui/MyMessage.js'

// 启动日志
const logo = `
%c
     ┌───────────────────────────────┐
     │  ╔═══╗                         │
     │ ╔╝ ╔╝╔═══╗  ╔═══╗  ╔═══╗      │
     │ ║ ╔╝ ╚═══║ ╔═══╝ ╔═══╝      │
     │ ║ ║      ║ ║                    │
     │ ╚═╝      ╚═╝                    │
     │         档 把 库 存 系 统        │
     │    ════════════════════         │
     │    │ 系统名称：档把库存系统 │    │
     │    │ 开发作者：浩涵        │    │
     │    │ 开发日期：2026年4月   │    │
     │    │ 版权声明：归浩涵所有  │    │
     │    ════════════════════         │
     └───────────────────────────────┘
`

console.log(logo, 'color: #6366f1; font-weight: bold; font-size: 13px; font-family: "Courier New", monospace;')

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(MyMessagePlugin) // 全局 $msg

app.mount('#app')