// 修复数据库中损坏的分类名称
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'inventory.db');

async function fixCorruptedNames() {
  const SQL = await initSqlJs();
  const fileBuffer = readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // 清理名字中的乱码字符（控制字符、不可见字符等）
  function cleanString(str) {
    if (!str) return str;
    // 移除常见的乱码字符：控制字符、零宽字符、BOM等
    return str
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
      .replace(/[​​‍]/g, '') // 零宽连接符、零宽空格等
      .trim();
  }

  // 检查并修复 categories 表
  const categories = db.exec('SELECT id, name FROM categories');
  if (categories.length && categories[0].values.length) {
    const { columns, values } = categories[0];
    const idIdx = columns.indexOf('id');
    const nameIdx = columns.indexOf('name');

    console.log('=== 分类数据检查 ===');
    for (const row of values) {
      const id = row[idIdx];
      const name = row[nameIdx];
      const cleaned = cleanString(name);

      console.log(`分类 ID ${id}: "${name}"`);
      console.log(`  字符码: ${[...name].map(c => c.charCodeAt(0)).join(', ')}`);

      if (name !== cleaned) {
        console.log(`  -> 修复为: "${cleaned}"`);
        db.run(`UPDATE categories SET name = '${cleaned.replace(/'/g, "''")}' WHERE id = ${id}`);
      }
    }
  }

  // 检查并修复 products 表
  const products = db.exec('SELECT id, name FROM products');
  console.log('\n=== 产品数据检查 ===');
  if (products.length && products[0].values.length) {
    const { columns, values } = products[0];
    const idIdx = columns.indexOf('id');
    const nameIdx = columns.indexOf('name');

    for (const row of values) {
      const id = row[idIdx];
      const name = row[nameIdx];
      const cleaned = cleanString(name);

      console.log(`产品 ID ${id}: "${name}"`);
      console.log(`  字符码: ${[...name].map(c => c.charCodeAt(0)).join(', ')}`);

      if (name !== cleaned) {
        console.log(`  -> 修复为: "${cleaned}"`);
        db.run(`UPDATE products SET name = '${newName.replace(/'/g, "''")}' WHERE id = ${id}`);
      }
    }
  } else {
    console.log('没有找到产品数据');
  }

  // 保存
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
  console.log('\n✅ 数据库已修复并保存');
}

fixCorruptedNames().catch(console.error);
