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
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      template_schema TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust')),
      quantity INTEGER NOT NULL,
      stock_before INTEGER DEFAULT 0,
      stock_after INTEGER DEFAULT 0,
      note TEXT,
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 迁移：为现有 inventory_logs 表添加 stock_before 和 stock_after 列（如果不存在）
  try {
    db.run('ALTER TABLE inventory_logs ADD COLUMN stock_before INTEGER DEFAULT 0');
    console.log('[DB] 迁移：已添加 stock_before 列');
  } catch (e) {
    // 列已存在，忽略错误
  }
  try {
    db.run('ALTER TABLE inventory_logs ADD COLUMN stock_after INTEGER DEFAULT 0');
    console.log('[DB] 迁移：已添加 stock_after 列');
  } catch (e) {
    // 列已存在，忽略错误
  }

  console.log('[DB] 表结构创建完成');
}

function seedInitialData() {
  const categories = [
    { name: '奥迪盖子', template_schema: JSON.stringify(['规格', '型号', 'LOGO']) },
    { name: '雷克萨斯', template_schema: JSON.stringify(['型号', 'LOGO']) },
    { name: '路虎旋钮', template_schema: JSON.stringify(['型号', '颜色']) },
    { name: '前按键', template_schema: JSON.stringify(['型号', 'LOGO']) },
    { name: '黑钛色', template_schema: JSON.stringify(['型号', '材质', '适用车型']) },
    { name: '手动挡', template_schema: JSON.stringify(['型号', '挡位', '材质']) }
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
        [cat.name, cat.template_schema]
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
