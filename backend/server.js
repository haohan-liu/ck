const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
];

function isTunnelOrigin(origin) {
    if (!origin) return false;
    try {
        const u = new URL(origin);
        const h = u.hostname;
        return (
            h.endsWith('.ngrok-free.app') ||
            h.endsWith('.ngrok.io') ||
            h.endsWith('.ngrok.app') ||
            h.endsWith('.loca.lt') ||
            h.endsWith('.trycloudflare.com') ||
            h.endsWith('.cfargotunnel.com')
        );
    } catch {
        return false;
    }
}

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (defaultOrigins.includes(origin) || isTunnelOrigin(origin)) {
            return callback(null, true);
        }
        callback(null, false);
    },
    credentials: true,
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
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/locations', require('./routes/locations'));

// 托管前端构建产物（在 /api 之后，避免与接口冲突）
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA：非 API 的 GET 回退到 index.html
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('[Server] 数据库初始化完成');

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`[Server] 档把库存系统后端服务已启动: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] 启动失败:', error);
    process.exit(1);
  }
}

startServer();
