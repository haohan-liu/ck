import axios from 'axios'

// 开发环境用相对路径，生产环境用绝对路径
const isDev = import.meta.env.DEV
const BASE_URL = isDev ? '/api' : `${window.location.origin}/api`

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})
