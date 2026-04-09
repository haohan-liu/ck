import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import './style.css'
import App from './App.vue'

// 注册全局 Toast 插件（替换所有 alert / confirm）
import { MyMessagePlugin } from './components/ui/MyMessage.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(MyMessagePlugin) // 全局 $msg

app.mount('#app')
