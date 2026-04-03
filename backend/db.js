import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'inventory.db');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // 建表
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

  try { db.run("ALTER TABLE products ADD COLUMN remark TEXT DEFAULT ''"); } catch (e) {}
  try { db.run("ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0"); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust')),
      quantity INTEGER NOT NULL,
      note TEXT,
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 预置大类
  const seedCategories = [
    { name: '奥迪盖子', template_schema: JSON.stringify(['规格', '型号', 'LOGO']) },
    { name: '雷克萨斯', template_schema: JSON.stringify(['型号', 'LOGO']) },
    { name: '路虎旋钮', template_schema: JSON.stringify(['型号', '颜色']) },
    { name: '前按键', template_schema: JSON.stringify(['型号', 'LOGO']) }
  ];

  for (const cat of seedCategories) {
    db.run(`INSERT OR IGNORE INTO categories (name, template_schema) VALUES ('${cat.name.replace(/'/g, "''")}', '${cat.template_schema.replace(/'/g, "''")}')`);
  }

  // 修复损坏的 attributes 数据
  fixCorruptedAttributes(db);

  saveDB();
  console.log('✅ 数据库初始化完成');
  return db;
}

// 修复损坏的 attributes 数据
function fixCorruptedAttributes(db) {
  const rows = db.exec('SELECT id, attributes FROM products');
  if (!rows.length || !rows[0].values.length) return;
  
  let fixed = 0;
  const { columns, values } = rows[0];
  const idIdx = columns.indexOf('id');
  const attrsIdx = columns.indexOf('attributes');
  
  for (const row of values) {
    const id = row[idIdx];
    const attrs = row[attrsIdx];
    
    // 检查 attributes 是否是损坏的
    try {
      const parsed = JSON.parse(attrs);
      const keys = Object.keys(parsed);
      // 如果只有数字键0,1,2...，说明损坏了，直接清空
      const isCorrupted = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
      
      if (isCorrupted) {
        db.run(`UPDATE products SET attributes = '{}' WHERE id = ${id}`);
        fixed++;
        console.log(`[修复] 产品ID ${id}: 已清空损坏的attributes`);
      }
    } catch (e) {
      // JSON解析失败，设置为空对象
      db.run(`UPDATE products SET attributes = '{}' WHERE id = ${id}`);
      fixed++;
      console.log(`[修复] 产品ID ${id}: 解析失败，已清空`);
    }
  }
  
  if (fixed > 0) {
    console.log(`✅ 共修复 ${fixed} 条损坏的 attributes 数据`);
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

// 辅助函数：将 exec 结果转为对象数组
function execToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function execToRow(result) {
  if (!result || result.length === 0 || result[0].values.length === 0) return null;
  const { columns, values } = result[0];
  const row = values[0];
  const obj = {};
  columns.forEach((col, i) => obj[col] = row[i]);
  return obj;
}

// 安全转义SQL字符串
function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return `'${String(val).replace(/'/g, "''")}'`;
}

const queries = {
  // 大类 CRUD
  getAllCategories: () => {
    return db.exec('SELECT * FROM categories ORDER BY id');
  },
  getCategoryById: (id) => {
    return db.exec(`SELECT * FROM categories WHERE id = ${parseInt(id, 10)}`);
  },
  createCategory: (name, template_schema) => {
    const safeName = name.replace(/'/g, "''");
    const safeSchema = template_schema.replace(/'/g, "''");
    db.run(`INSERT INTO categories (name, template_schema) VALUES ('${safeName}', '${safeSchema}')`);
    saveDB();
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  },
  updateCategory: (name, template_schema, id) => {
    const safeName = name.replace(/'/g, "''");
    const safeSchema = template_schema.replace(/'/g, "''");
    db.run(`UPDATE categories SET name = '${safeName}', template_schema = '${safeSchema}' WHERE id = ${parseInt(id, 10)}`);
    saveDB();
    return db.getRowsModified();
  },
  deleteCategory: (id) => {
    db.run(`DELETE FROM categories WHERE id = ${parseInt(id, 10)}`);
    saveDB();
    return db.getRowsModified();
  },

  // 产品 CRUD
  getAllProducts: () => {
    return db.exec(`
      SELECT p.*, c.name as category_name, c.template_schema
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id DESC
    `);
  },
  getProductById: (id) => {
    return db.exec(`
      SELECT p.*, c.name as category_name, c.template_schema
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ${parseInt(id, 10)}
    `);
  },
  getProductBySku: (sku) => {
    const safeSku = sku.replace(/'/g, "''");
    return db.exec(`
      SELECT p.*, c.name as category_name, c.template_schema
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.sku_code = '${safeSku}'
    `);
  },
  createProduct: (category_id, sku_code, name, attributes, remark, location_code, current_stock, min_stock, unit, cost_price) => {
    let finalName = name;
    if (!finalName || !finalName.trim()) {
      const catResult = queries.getCategoryById(category_id);
      const catRow = execToRow(catResult);
      const catName = catRow?.name || '';
      const attrs = typeof attributes === 'string' ? JSON.parse(attributes) : attributes;
      const parts = Object.values(attrs || {}).filter(v => v && String(v).trim());
      finalName = parts.length > 0 ? `${catName}-${parts.join('-')}` : catName;
    }
    
    const safeSku = sku_code.replace(/'/g, "''");
    const safeName = finalName.replace(/'/g, "''");
    const safeAttrs = JSON.stringify(attributes).replace(/'/g, "''");
    const safeRemark = (remark || '').replace(/'/g, "''");
    const safeLocation = (location_code || '').replace(/'/g, "''");
    const safeUnit = (unit || '件').replace(/'/g, "''");
    
    db.run(`
      INSERT INTO products (category_id, sku_code, name, attributes, remark, location_code, current_stock, min_stock, unit, cost_price)
      VALUES (${parseInt(category_id, 10)}, '${safeSku}', '${safeName}', '${safeAttrs}', '${safeRemark}', '${safeLocation}', ${parseInt(current_stock, 10) || 0}, ${parseInt(min_stock, 10) || 0}, '${safeUnit}', ${parseFloat(cost_price) || 0})
    `);
    saveDB();
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  },
  updateProduct: (category_id, sku_code, name, attributes, remark, location_code, current_stock, min_stock, unit, cost_price, id) => {
    let finalName = name;
    if (!finalName || !finalName.trim()) {
      const catResult = queries.getCategoryById(category_id);
      const catRow = execToRow(catResult);
      const catName = catRow?.name || '';
      const attrs = typeof attributes === 'string' ? JSON.parse(attributes) : attributes;
      const parts = Object.values(attrs || {}).filter(v => v && String(v).trim());
      finalName = parts.length > 0 ? `${catName}-${parts.join('-')}` : catName;
    }
    
    const numId = parseInt(id, 10);
    const numCatId = parseInt(category_id, 10);
    const numStock = parseInt(current_stock, 10) || 0;
    const numMinStock = parseInt(min_stock, 10) || 0;
    const numCostPrice = parseFloat(cost_price) || 0;
    const attrsJson = JSON.stringify(attributes);
    
    db.run(`UPDATE products SET category_id = ?, sku_code = ?, name = ?, attributes = ?, remark = ?, location_code = ?, current_stock = ?, min_stock = ?, unit = ?, cost_price = ?, updated_at = datetime('now') WHERE id = ?`, 
      [numCatId, sku_code, finalName, attrsJson, remark || '', location_code || '', numStock, numMinStock, unit || '件', numCostPrice, numId]);
    
    const rowsModified = db.getRowsModified();
    saveDB();
    return rowsModified;
  },
  deleteProduct: (id) => {
    db.run(`DELETE FROM products WHERE id = ${parseInt(id, 10)}`);
    saveDB();
    return db.getRowsModified();
  },
  resetCorruptedProducts: () => {
    let fixed = 0;
    const rows = db.exec('SELECT id, attributes FROM products');
    if (rows.length && rows[0].values.length) {
      const { columns, values } = rows[0];
      const idIdx = columns.indexOf('id');
      const attrsIdx = columns.indexOf('attributes');
      
      for (const row of values) {
        const id = row[idIdx];
        const attrs = row[attrsIdx];
        try {
          const parsed = JSON.parse(attrs);
          const keys = Object.keys(parsed);
          // 如果只有数字键，说明损坏了
          if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
            db.run(`UPDATE products SET attributes = '{}' WHERE id = ${id}`);
            fixed++;
          }
        } catch (e) {
          db.run(`UPDATE products SET attributes = '{}' WHERE id = ${id}`);
          fixed++;
        }
      }
      if (fixed > 0) saveDB();
    }
    return fixed;
  },

  // 库存日志
  getLogsByProduct: (product_id) => {
    return db.exec(`
      SELECT l.*, p.sku_code, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.product_id = ${parseInt(product_id, 10)}
      ORDER BY l.created_at DESC
      LIMIT 50
    `);
  },
  getAllLogs: () => {
    return db.exec(`
      SELECT l.*, p.sku_code, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);
  },
  createLog: (product_id, type, quantity, note, operator) => {
    const safeNote = (note || '').replace(/'/g, "''");
    const safeOperator = (operator || 'system').replace(/'/g, "''");
    db.run(`
      INSERT INTO inventory_logs (product_id, type, quantity, note, operator)
      VALUES (${parseInt(product_id, 10)}, '${type}', ${parseInt(quantity, 10)}, '${safeNote}', '${safeOperator}')
    `);
    saveDB();
  },
  updateStock: (stock, id) => {
    db.run(`UPDATE products SET current_stock = ${parseInt(stock, 10)}, updated_at = datetime('now') WHERE id = ${parseInt(id, 10)}`);
    saveDB();
  },

  // 统计查询
  getStats: () => {
    const stats = {};

    const totalProducts = db.exec('SELECT COUNT(*) as count FROM products');
    stats.totalProducts = totalProducts[0]?.values[0][0] || 0;

    const totalStock = db.exec('SELECT COALESCE(SUM(current_stock), 0) as total FROM products');
    stats.totalStock = totalStock[0]?.values[0][0] || 0;

    const totalValue = db.exec('SELECT COALESCE(SUM(current_stock * cost_price), 0) as total FROM products');
    stats.totalValue = totalValue[0]?.values[0][0] || 0;

    const lowStock = db.exec('SELECT COUNT(*) as count FROM products WHERE current_stock <= min_stock');
    stats.lowStockCount = lowStock[0]?.values[0][0] || 0;

    const zeroStock = db.exec('SELECT COUNT(*) as count FROM products WHERE current_stock = 0');
    stats.zeroStockCount = zeroStock[0]?.values[0][0] || 0;

    const byCategory = db.exec(`
      SELECT c.name, COUNT(p.id) as count, COALESCE(SUM(p.current_stock), 0) as total_stock, COALESCE(SUM(p.current_stock * p.cost_price), 0) as total_value
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY count DESC
    `);
    stats.byCategory = execToObjects(byCategory);

    const todayIn = db.exec(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM inventory_logs
      WHERE type = 'in' AND date(created_at) = date('now')
    `);
    stats.todayIn = todayIn[0]?.values[0][0] || 0;

    const todayOut = db.exec(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM inventory_logs
      WHERE type = 'out' AND date(created_at) = date('now')
    `);
    stats.todayOut = todayOut[0]?.values[0][0] || 0;

    const byLocation = db.exec(`
      SELECT location_code, COUNT(*) as count, COALESCE(SUM(current_stock), 0) as total_stock
      FROM products
      WHERE location_code IS NOT NULL AND location_code != ''
      GROUP BY location_code
      ORDER BY location_code
    `);
    stats.byLocation = execToObjects(byLocation);

    return stats;
  },

  getLowStockProducts: () => {
    const result = db.exec(`
      SELECT id, sku_code, name, current_stock, min_stock, location_code
      FROM products
      WHERE current_stock <= min_stock
      ORDER BY (min_stock - current_stock) DESC
    `);
    return execToObjects(result);
  },

  getRecentLogs: (limit = 10) => {
    const result = db.exec(`
      SELECT l.id, l.type, l.quantity, l.note, l.operator, l.created_at,
             p.sku_code, p.name as product_name, p.location_code
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      ORDER BY l.created_at DESC
      LIMIT ${parseInt(limit, 10)}
    `);
    return execToObjects(result);
  }
};

function adjustInventory(productId, type, quantity, note = '', operator = 'system') {
  const validTypes = { in: quantity, out: -quantity, adjust: quantity };
  if (!validTypes.hasOwnProperty(type)) {
    throw new Error(`无效的库存操作类型: ${type}`);
  }

  const result = db.exec(`SELECT current_stock FROM products WHERE id = ${parseInt(productId, 10)}`);
  if (result.length === 0 || result[0].values.length === 0) {
    throw new Error('产品不存在');
  }
  const currentStock = result[0].values[0][0];
  const newStock = currentStock + validTypes[type];

  if (newStock < 0) {
    throw new Error('库存不足');
  }

  queries.updateStock(newStock, productId);
  queries.createLog(productId, type, quantity, note, operator);
  saveDB();
}

export { initDB, queries, adjustInventory, execToObjects, execToRow, saveDB, db };
