/**
 * 档把库存系统 — 测试数据填充脚本
 * 用法: node backend/scripts/seed_data.js
 *
 * 运行前会先清空 products 和 inventory_logs 表，
 * 然后将 6 条真实业务测试数据批量写入数据库。
 *
 * SKU 自动生成规则：大类拼音首字母 + 年月 + 4位随机数
 * 例如：ADGZ-2026-04-1832
 */

'use strict';

const path = require('path');

// ---- 1. 初始化数据库 ----
const DB_PATH = path.join(__dirname, '..', 'inventory.db');
const SQL_PATH = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.js');

let db;
let initSqlJs;

try {
  initSqlJs = require(SQL_PATH);
} catch (e) {
  console.error('[Seed] 无法加载 sql.js，请确认 backend 目录已执行 npm install');
  console.error('[Seed]', e.message);
  process.exit(1);
}

async function loadDb() {
  const SQL = await initSqlJs();
  const fs = require('fs');

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('[Seed] 数据库已加载:', DB_PATH);
  } else {
    console.error('[Seed] 数据库文件不存在，请先启动一次后端（npm run start）以创建数据库');
    process.exit(1);
  }

  return db;
}

function saveDb() {
  const fs = require('fs');
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ---- 2. SKU 生成逻辑（与 products.js 保持一致） ----
const PINYIN_PREFIX = {
  '奥迪盖子': 'ADGZ',
  '雷克萨斯': 'LKS',
  '路虎旋钮': 'LHXN',
  '前按键': 'QAJ',
  '黑钛色': 'HTS',
  '手动挡': 'SCD',
};

function getPrefixByCategoryName(name) {
  return PINYIN_PREFIX[name] || name.slice(0, 2).toUpperCase();
}

function generateSkuCode(categoryName) {
  const prefix = getPrefixByCategoryName(categoryName);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}-${year}${month}-${random}`;
}

// ---- 3. 数据库操作工具 ----
function runQuery(sql, params = []) {
  try {
    db.run(sql, params);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    let result = null;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    return result;
  } catch (error) {
    return null;
  }
}

function getAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (error) {
    return [];
  }
}

function runInsert(sql, params = []) {
  try {
    db.run(sql, params);
    const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    return { success: true, lastId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---- 4. 清理旧数据 ----
function clearOldData() {
  console.log('\n[Step 1] 清理旧数据…');
  const logResult = runQuery('DELETE FROM inventory_logs');
  const prodResult = runQuery('DELETE FROM products');
  if (logResult.success && prodResult.success) {
    const logCount = db.getRowsModified();
    console.log('[Step 1] 已清空 inventory_logs 和 products 表');
  } else {
    console.error('[Step 1] 清理失败:', logResult.error || prodResult.error);
  }
}

// ---- 5. 确认大类存在 ----
function ensureCategories() {
  console.log('\n[Step 2] 确认大类存在…');
  const categories = [
    { name: '奥迪盖子', template_schema: JSON.stringify(['规格', '型号', 'LOGO']) },
    { name: '雷克萨斯', template_schema: JSON.stringify(['型号', 'LOGO']) },
    { name: '路虎旋钮', template_schema: JSON.stringify(['型号', '颜色']) },
    { name: '前按键', template_schema: JSON.stringify(['型号', 'LOGO']) },
    { name: '黑钛色', template_schema: JSON.stringify(['型号', '材质', '适用车型']) },
    { name: '手动挡', template_schema: JSON.stringify(['型号', '挡位', '材质']) },
  ];

  categories.forEach(cat => {
    const existing = getOne('SELECT id FROM categories WHERE name = ?', [cat.name]);
    if (!existing) {
      const r = runInsert(
        'INSERT INTO categories (name, template_schema) VALUES (?, ?)',
        [cat.name, cat.template_schema]
      );
      if (r.success) {
        console.log(`  [+] 新增大类: ${cat.name} (id=${r.lastId})`);
      }
    } else {
      console.log(`  [~] 大类已存在: ${cat.name} (id=${existing.id})`);
    }
  });
}

// ---- 6. 测试数据定义 ----
const TEST_PRODUCTS = [
  {
    categoryName: '奥迪盖子',
    name: '奥迪盖子-发光-A4-Sline标',
    attributes: { '规格': '发光', '型号': 'A4', 'LOGO': 'Sline标' },
    initialStock: 3,
    minStock: 5,
    costPrice: 68.00,
    unit: '件',
    locationCode: 'A-01-03',
    remark: 'A4车型，Sline运动版标识',
  },
  {
    categoryName: '雷克萨斯',
    name: '雷克萨斯-碳纤纹发光-雷克萨斯标',
    attributes: { '规格': '碳纤纹-发光', 'LOGO': '雷克萨斯标' },
    initialStock: 10,
    minStock: 8,
    costPrice: 128.00,
    unit: '件',
    locationCode: 'A-01-05',
    remark: '碳纤纹理+发光效果',
  },
  {
    categoryName: '路虎旋钮',
    name: '路虎旋钮-16年前无LOGO-黑色',
    attributes: { '型号': '16年前-无LOGO', '颜色': '黑色' },
    initialStock: 5,
    minStock: 6,
    costPrice: 198.00,
    unit: '件',
    locationCode: 'B-02-01',
    remark: '2016年前款式，无原厂LOGO，黑色',
  },
  {
    categoryName: '前按键',
    name: '前按键-英菲尼迪标',
    attributes: { 'LOGO': '英菲尼迪标' },
    initialStock: 10,
    minStock: 5,
    costPrice: 88.00,
    unit: '件',
    locationCode: 'B-02-03',
    remark: '英菲尼迪车系专用',
  },
  {
    categoryName: '黑钛色',
    name: '黑钛色-R135-246标',
    attributes: { '型号': 'R135', 'LOGO': '246标' },
    initialStock: 10,
    minStock: 6,
    costPrice: 158.00,
    unit: '件',
    locationCode: 'C-03-02',
    remark: 'R135型号黑钛色版本',
  },
  {
    categoryName: '手动挡',
    name: '手动挡-10mm螺纹-R135-24标',
    attributes: { '型号': '10mm螺纹', 'LOGO': 'R135-24标' },
    initialStock: 2,
    minStock: 5,
    costPrice: 228.00,
    unit: '件',
    locationCode: 'C-03-05',
    remark: '手动挡换挡手球，10mm螺纹规格（注意：此商品初始库存低于预警线，会触发低库存预警）',
  },
];

// ---- 7. 批量写入产品 + 入库日志 ----
function seedProducts() {
  console.log('\n[Step 3] 写入测试产品数据…');
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  let ok = 0;
  let fail = 0;

  TEST_PRODUCTS.forEach((p, idx) => {
    // 查找大类 ID
    const cat = getOne('SELECT id FROM categories WHERE name = ?', [p.categoryName]);
    if (!cat) {
      console.error(`  [!] 大类「${p.categoryName}」未找到，跳过`);
      fail++;
      return;
    }

    // 生成唯一 SKU
    let sku = generateSkuCode(p.categoryName);
    let attempts = 0;
    while (attempts < 20) {
      const existing = getOne('SELECT id FROM products WHERE sku_code = ?', [sku]);
      if (!existing) break;
      sku = generateSkuCode(p.categoryName);
      attempts++;
    }

    // 写入 products 表
    const prodResult = runInsert(
      `INSERT INTO products
        (category_id, sku_code, name, attributes, remark, location_code,
         current_stock, min_stock, unit, cost_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cat.id,
        sku,
        p.name,
        JSON.stringify(p.attributes),
        p.remark || '',
        p.locationCode || '',
        p.initialStock,
        p.minStock,
        p.unit || '件',
        p.costPrice || 0,
        timestamp,
        timestamp,
      ]
    );

    if (prodResult.success) {
      const productId = prodResult.lastId;

      // 写入初始入库日志
      const logResult = runInsert(
        `INSERT INTO inventory_logs (product_id, type, quantity, note, operator, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, 'in', p.initialStock, '初始化库存（Seed脚本）', 'seed-script', timestamp]
      );

      const stockTag = p.initialStock <= p.minStock
        ? ` ⚠️ 低于预警(${p.minStock})`
        : '';
      console.log(
        `  [${String(idx + 1).padStart(2, '0')}] SKU: ${sku}  |  ${p.name}` +
        `  |  库存: ${p.initialStock}${stockTag}`
      );

      if (!logResult.success) {
        console.error(`       [!] 入库日志写入失败: ${logResult.error}`);
      } else {
        ok++;
      }
    } else {
      console.error(`  [!] 产品「${p.name}」写入失败: ${prodResult.error}`);
      fail++;
    }
  });

  console.log(`\n  ✓ 成功写入 ${ok} 件商品，失败 ${fail} 件`);
  return { ok, fail };
}

// ---- 8. 统计汇总 ----
function showSummary() {
  console.log('\n[Step 4] 数据汇总…');

  const products = getAll('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id');
  const logs = getAll('SELECT COUNT(*) as count FROM inventory_logs');
  const lowStock = getAll('SELECT COUNT(*) as count FROM products WHERE current_stock <= min_stock');

  console.log(`\n  总产品数 : ${products.length} 件`);
  console.log(`  总库存量 : ${products.reduce((s, p) => s + (p.current_stock || 0), 0)} 件`);
  console.log(`  总价值   : ¥${products.reduce((s, p) => s + ((p.current_stock || 0) * (p.cost_price || 0)), 0).toFixed(2)}`);
  console.log(`  库存日志 : ${logs[0]?.count || 0} 条`);
  console.log(`  低库存预警: ${lowStock[0]?.count || 0} 件`);

  console.log('\n  商品明细:');
  products.forEach(p => {
    const flag = p.current_stock <= p.min_stock
      ? ` ⚠️ 预警(当前${p.current_stock}/阈值${p.min_stock})`
      : '';
    console.log(`    ${p.sku_code}  ${p.name}${flag}`);
  });
}

// ---- 9. 主函数 ----
async function main() {
  console.log('========================================');
  console.log('  档把库存系统 — 测试数据填充脚本');
  console.log('  目标: 6 件真实业务测试商品 + 初始入库日志');
  console.log('========================================');

  await loadDb();
  clearOldData();
  ensureCategories();
  const { ok, fail } = seedProducts();

  if (ok > 0) {
    saveDb();
    console.log('\n[Done] 数据库已保存到:', DB_PATH);
  } else {
    console.error('\n[Error] 没有成功写入任何数据，未保存数据库');
  }

  showSummary();

  console.log('\n========================================');
  console.log('  运行完成！现在可以启动后端和前端：');
  console.log('  cd backend && npm run start');
  console.log('  cd frontend && npm run dev');
  console.log('========================================\n');
}

main().catch(err => {
  console.error('[Seed] 脚本执行异常:', err);
  process.exit(1);
});
