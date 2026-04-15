# 💎 晶钻档把库存管理系统 (Crystal Gear Knob Inventory System)

[![Node Version](https://img.shields.io/badge/Node-v24.11.1-green.svg)]()
[![Framework](https://img.shields.io/badge/Framework-Vue%203-4fc08d.svg)]()
[![Tailwind](https://img.shields.io/badge/CSS-Tailwind%204.0-38bdf8.svg)]()
[![License](https://img.shields.io/badge/License-haohan--liu-6366f1.svg)]()

> **专为跨境电商视觉设计师打造的高感官、全栈库存管理方案。**
>
> 针对水晶档把类目 SKU 繁杂、物流关联难的痛点，本系统通过“一物一码”链式扫码逻辑，实现了从入库到跨境小包发货的闭环管理。

---

## 📖 1. 系统简介 (System Overview)

本系统由拥有 6 年行业经验的资深设计师主导视觉与交互设计，旨在提供工业级精度的同时，保持极简的操作体验。

### 🌟 核心亮点
* **沉浸式工作站**：针对移动端进行深度 HCI 优化，支持全屏锁定、震动反馈与立体声效提示。
* **原生 WebRTC 驱动**：纯网页端调用摄像头，无需安装 APP，适配所有主流手机浏览器。
* **一物一码逻辑**：出库时通过“扫产品码 + 扫运单码”快速绑定，发货信息绝对精准。
* **单端口融合架构**：Node.js 后端统一托管静态资源，服务器仅需开放一个端口（如 3002）。

---

## 📂 2. 部署目录结构 (Project Structure)

为了实现最轻量化的部署，建议在服务器上保持以下结构，避免冗余源码干扰：

```text
/www/wwwroot/ck/
├── backend/                   # 核心服务端（Node 项目运行目录）
│   ├── server.js              # 服务入口：监听 3002 端口，托管前端
│   ├── db.js                  # 数据库初始化逻辑
│   ├── inventory.db           # 💎 核心数据库：存放所有库存变动数据
│   ├── package.json           # 项目配置文件
│   ├── routes/                # 各类业务接口路由
│   └── ...
└── frontend/
    └── dist/                  # 前端打包产物（由 server.js 静态托管）
        ├── index.html         # SPA 入口文件
        └── assets/            # 编译后的静态资源
```

---

## 🚀 3. 保姆级上线指南 (Deployment Guide)

针对**国内（上海）服务器 + 宝塔面板**环境深度优化，请严格按顺序执行：

### Step 1: 本地构建与打包
1. 在本地电脑 `frontend` 目录下运行：
   ```bash
   npm run build
   ```
2. **提取文件**：新建一个空文件夹，放入本地的 `backend` 文件夹和生成的 `frontend/dist`。
3. **打包上传**：将此文件夹压缩为 `ck_deploy.zip`（**切勿包含 node_modules**）。

### Step 2: 服务器环境初始化
1. 登录宝塔，在 `/www/wwwroot/` 目录下新建 `ck` 文件夹。
2. 上传并解压 `ck_deploy.zip`，确保目录层级如上所述。

### Step 3: 安装纯净依赖
打开宝塔**【终端】**，直接复制并运行以下命令：
```bash
# 1. 进入后端目录
cd /www/wwwroot/ck/backend

# 2. 切换淘宝高速镜像源
npm config set registry [https://registry.npmmirror.com](https://registry.npmmirror.com)

# 3. 卸载易报错的冗余原生库 (极度重要)
npm uninstall sqlite3

# 4. 安装核心依赖
npm install
```

### Step 4: 宝塔面板拉起服务
1. 进入宝塔【网站】→【Node项目】→【添加Node项目】。
2. **项目目录**：选择 `/www/wwwroot/ck/backend`。
3. **启动选项**：选择 `start`。
4. **项目端口**：填写 `3002`（确保安全组已放行）。
5. **绑定域名**：填写您的访问域名（如 `kc.yourdomain.com`）。

### Step 5: 配置 SSL 加密 (⚠️ 必做)
**HTTPS 是扫码枪启动的唯一前提：**
1. 在 Node 项目列表中点击【设置】→【SSL】。
2. 申请 **Let's Encrypt** 证书并**开启【强制 HTTPS】**。

---

## 🛡️ 4. 数据备份与灾备 (Backup & Recovery)

### 💾 自动备份方案
建议将以下脚本整合进您的 `data_backups.sh` 计划任务中：

```bash
# 晶钻档把库存系统自动备份代码段
CK_BACKUP="/www/wwwroot/data_backups/ck-system"
mkdir -p $CK_BACKUP

# 复制核心数据库并添加时间戳
cp /www/wwwroot/ck/backend/inventory.db $CK_BACKUP/inventory-$(date +%Y%m%d_%H%M%S).db

# 自动清理 15 天前的旧备份
find $CK_BACKUP -mtime +15 -name "inventory-*" -exec rm -rf {} \;

echo "✅ 库存系统数据已成功备份并清理过期文件"
```

### 🆘 极限灾难恢复
如果不慎误删数据或数据库损坏，请按以下步骤救活系统：
1. **停止服务**：在宝塔 Node 项目列表中停止系统。
2. **挑选备份**：前往备份目录找出一个健康的 `.db` 文件。
3. **替换改名**：将其复制回 `/www/wwwroot/ck/backend/`，并严格更名为 `inventory.db`。
4. **重启项目**：系统将满血复活。

---

## ⚠️ 5. 维护注意事项
* **摄像头调用**：若无法调起摄像头，请检查是否已正确配置 SSL 并开启 HTTPS。
* **端口冲突**：若 3002 被占用，可在 `server.js` 中修改 `PORT` 值，并同步修改宝塔配置。
* **数据持久化**：所有的产品、分类和日志都存在 `inventory.db` 中，请像保护生命一样保护这个文件。

---

<div align="center">
  <p>© 2026 haohan-liu | Senior Cross-border E-commerce Visual Design</p>
  <p><i>Design with Elegance, Code with Logic.</i></p>
</div>