const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '档把库存系统后端服务运行中' });
});

app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/stats', require('./routes/stats'));

app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('[Server] 数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`[Server] 档把库存系统后端服务已启动: http://localhost:${PORT}`);
      console.log(`[Server] API 基础路径: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('[Server] 启动失败:', error);
    process.exit(1);
  }
}

startServer();
