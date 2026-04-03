import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDB } from './db.js';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import inventoryRouter from './routes/inventory.js';
import statsRouter from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================
// 静态文件托管（生产环境）
// ============================================
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.use(express.static(join(__dirname, '../frontend/dist')));
}

// ============================================
// API 路由注册
// ============================================
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/stats', statsRouter);

// ============================================
// SPA 路由兜底（生产环境）
// ============================================
if (isProd) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../frontend/dist/index.html'));
  });
}

// ============================================
// 启动（异步初始化数据库）
// ============================================
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
    console.log(`📦 环境: ${isProd ? '生产' : '开发'}`);
  });
}

start();
