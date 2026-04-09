const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'inventory.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('[DB] 数据库已加载:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('[DB] 创建新数据库:', DB_PATH);
  }

  createTables();
  seedInitialData();
  saveDatabase();

  return db;
}

function createTables() {
  // ============================================================
  // 1. 产品大类表
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      template_schema TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================================
  // 2. 产品表
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      sku_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      attributes TEXT NOT NULL DEFAULT '{}',
      remark TEXT DEFAULT '',
      location_code TEXT,
      current_stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT '件',
      cost_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // ============================================================
  // 3. 库存日志表（含操作前后库存快照）
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust', 'add')),
      quantity INTEGER NOT NULL,
      stock_before INTEGER DEFAULT 0,
      stock_after INTEGER DEFAULT 0,
      note TEXT,
      operator TEXT DEFAULT 'system',
      product_name TEXT DEFAULT '',
      category_name TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // ============================================================
  // 4. 运单记录表（shipping_records）
  //    用于将批量出库与运单号绑定
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS shipping_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'shipped', 'cancelled')),
      operator TEXT DEFAULT 'system',
      total_items INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================================
  // 5. 运单明细表（shipping_items）
  //    每条出库记录对应一个运单明细
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS shipping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipping_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipping_id) REFERENCES shipping_records(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // ============================================================
  // 6. 系统设置表（通用键值对，用于存储货架配置等）
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS warehouse_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================================
  // 迁移脚本：为已有表补齐可能缺失的列
  // ============================================================
  migrateInventoryLogs();
  migrateShippingRecords();
  migrateProductSnapshot();

  console.log('[DB] 表结构创建 / 迁移完成');
}

/**
 * 为 inventory_logs 表补充 stock_before / stock_after 列
 * 兼容已有数据库（老版本可能没有这些列）
 */
function migrateInventoryLogs() {
  const existingColumns = getExistingColumns('inventory_logs');

  if (!existingColumns.includes('stock_before')) {
    db.run('ALTER TABLE inventory_logs ADD COLUMN stock_before INTEGER DEFAULT 0');
    console.log('[DB] 迁移：已添加 stock_before 列');
  }
  if (!existingColumns.includes('stock_after')) {
    db.run('ALTER TABLE inventory_logs ADD COLUMN stock_after INTEGER DEFAULT 0');
    console.log('[DB] 迁移：已添加 stock_after 列');
  }
}

/**
 * 为 shipping_records 表补充可能新增的列
 */
function migrateShippingRecords() {
  const existingColumns = getExistingColumns('shipping_records');

  if (!existingColumns.includes('status')) {
    db.run("ALTER TABLE shipping_records ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    console.log('[DB] 迁移：已添加 status 列到 shipping_records');
  }
  if (!existingColumns.includes('total_items')) {
    db.run('ALTER TABLE shipping_records ADD COLUMN total_items INTEGER DEFAULT 0');
    console.log('[DB] 迁移：已添加 total_items 列到 shipping_records');
  }
}

/**
 * 为 inventory_logs 表补充 product_name / category_name 快照列
 * 兼容已有数据库（老版本可能没有这些列）
 */
function migrateProductSnapshot() {
  const existingColumns = getExistingColumns('inventory_logs');

  if (!existingColumns.includes('product_name')) {
    db.run('ALTER TABLE inventory_logs ADD COLUMN product_name TEXT DEFAULT \'\'');
    console.log('[DB] 迁移：已添加 product_name 列');
  }
  if (!existingColumns.includes('category_name')) {
    db.run('ALTER TABLE inventory_logs ADD COLUMN category_name TEXT DEFAULT \'\'');
    console.log('[DB] 迁移：已添加 category_name 列');
  }
}

/**
 * 查询某张表已有的列名列表
 */
function getExistingColumns(tableName) {
  try {
    const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
    const cols = [];
    while (stmt.step()) {
      cols.push(stmt.getAsObject().name);
    }
    stmt.free();
    return cols;
  } catch (e) {
    return [];
  }
}

function seedInitialData() {
  const categories = [
    { name: '奥迪盖子', template_schema: ['规格', '型号', 'LOGO'] },
    { name: '雷克萨斯', template_schema: ['型号', 'LOGO'] },
    { name: '路虎旋钮', template_schema: ['型号', '颜色'] },
    { name: '前按键', template_schema: ['型号', 'LOGO'] },
    { name: '黑钛色', template_schema: ['型号', '材质', '适用车型'] },
    { name: '手动挡', template_schema: ['型号', '挡位', '材质'] }
  ];

  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM categories WHERE name = ?');

  categories.forEach(cat => {
    checkStmt.bind([cat.name]);
    checkStmt.step();
    const result = checkStmt.getAsObject();
    checkStmt.reset();

    if (result.count === 0) {
      db.run(
        'INSERT INTO categories (name, template_schema) VALUES (?, ?)',
        [cat.name, JSON.stringify(cat.template_schema)]
      );
      console.log(`[DB] 已预置大类: ${cat.name}`);
    }
  });

  checkStmt.free();
  console.log('[DB] 预置数据完成');
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  console.log('[DB] 数据库已保存到磁盘');
}

function getDb() {
  return db;
}

function runQuery(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error('[DB] 查询错误:', error.message);
    return [];
  }
}

function getOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (error) {
    console.error('[DB] 查询错误:', error.message);
    return null;
  }
}

function runInsert(sql, params = []) {
  try {
    db.run(sql, params);
    const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveDatabase();
    return { success: true, lastId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  initDatabase,
  getDb,
  runQuery,
  getAll,
  getOne,
  runInsert,
  saveDatabase
};
