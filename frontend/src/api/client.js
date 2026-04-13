import axios from 'axios'

// 开发环境用相对路径，生产环境用绝对路径
const isDev = import.meta.env.DEV
const BASE_URL = isDev ? '/api' : `${window.location.origin}/api`

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// ======================== 全局请求拦截器 ========================
api.interceptors.request.use(
  (config) => {
    // 可在此添加 token 等通用 header
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ======================== 全局响应拦截器 ========================
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // 统一错误处理
    if (error.response) {
      // 后端返回了错误状态码
      const status = error.response.status
      const data = error.response.data

      if (status === 401) {
        // 未授权 - 可跳转登录页
        console.error('[API] 未授权，请重新登录')
      } else if (status === 403) {
        console.error('[API] 权限不足')
      } else if (status === 404) {
        console.error('[API] 请求资源不存在')
      } else if (status >= 500) {
        // 服务器错误
        console.error('[API] 服务器错误:', data?.error || '请联系管理员')
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应（网络错误）
      console.error('[API] 网络连接失败，请检查网络')
    } else {
      // 请求配置出错
      console.error('[API] 请求配置错误:', error.message)
    }

    return Promise.reject(error)
  }
)
