const sqlite3 = require('better-sqlite3');
const db = new sqlite3('./inventory.db');
const product = db.prepare('SELECT id, name, attributes FROM products WHERE id = 54').get();
console.log('Product 54:', JSON.stringify(product, null, 2));
db.close();
