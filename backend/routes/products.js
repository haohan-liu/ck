import { Router } from 'express';
import { queries, execToObjects, execToRow, db, saveDB } from '../db.js';

const router = Router();

function buildProductName(categoryName, attributes) {
  const parts = Object.values(attributes).filter(v => v && String(v).trim());
  return parts.length > 0 ? `${categoryName}-${parts.join('-')}` : categoryName;
}

// -------- GET /api/products --------
router.get('/', (req, res) => {
  try {
    const { category_id, keyword } = req.query;
    const raw = queries.getAllProducts();
    let products = execToObjects(raw).map(p => ({
      ...p,
      attributes: JSON.parse(p.attributes || '{}')
    }));

    if (category_id) {
      products = products.filter(p => String(p.category_id) === String(category_id));
    }
    if (keyword) {
      const kw = keyword.toLowerCase();
      products = products.filter(p =>
        (p.name || '').toLowerCase().includes(kw) ||
        (p.sku_code || '').toLowerCase().includes(kw) ||
        (p.category_name || '').toLowerCase().includes(kw) ||
        JSON.stringify(p.attributes).toLowerCase().includes(kw)
      );
    }
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- GET /api/products/:id --------
router.get('/:id', (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: '无效的产品ID' });
    }
    const row = execToRow(queries.getProductById(productId));
    if (!row) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    res.json({
      success: true,
      data: {
        ...row,
        attributes: JSON.parse(row.attributes || '{}'),
        template_schema: JSON.parse(row.template_schema || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- POST /api/products --------
router.post('/', (req, res) => {
  try {
    const { category_id, sku_code, name: providedName, attributes, remark, location_code, current_stock, min_stock, unit, cost_price } = req.body;
    if (!category_id || !sku_code) {
      return res.status(400).json({ success: false, message: 'category_id 和 sku_code 必填' });
    }
    const catRow = execToRow(queries.getCategoryById(category_id));
    if (!catRow) {
      return res.status(400).json({ success: false, message: '大类不存在' });
    }
    const categoryName = catRow.name;
    const attrs = attributes || {};
    const name = providedName || buildProductName(categoryName, attrs);
    const id = queries.createProduct(
      category_id, sku_code, name, JSON.stringify(attrs), remark || '',
      location_code || '', current_stock || 0, min_stock || 0, unit || '件', cost_price || 0
    );
    res.json({ success: true, data: { id, name } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'SKU编号已存在' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- PUT /api/products/:id --------
router.put('/:id', (req, res) => {
  try {
    const { category_id, sku_code, name: providedName, attributes, remark, location_code, current_stock, min_stock, unit, cost_price } = req.body;
    
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: '无效的产品ID' });
    }
    
    if (!category_id || !sku_code) {
      return res.status(400).json({ success: false, message: 'category_id 和 sku_code 必填' });
    }
    
    const catId = parseInt(category_id, 10);
    const catRow = execToRow(queries.getCategoryById(catId));
    if (!catRow) {
      return res.status(400).json({ success: false, message: '大类不存在' });
    }
    
    const attrs = attributes || {};
    const name = providedName || buildProductName(catRow.name, attrs);
    
    const changes = queries.updateProduct(
      catId, sku_code, name, JSON.stringify(attrs), remark || '',
      location_code || '', current_stock || 0, min_stock || 0, unit || '件', cost_price || 0,
      productId
    );
    
    if (changes === 0) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- GET /api/products/sku/:code - 通过SKU查询 --------
router.get('/sku/:code', (req, res) => {
  try {
    const result = queries.getProductBySku(req.params.code);
    const row = execToRow(result);
    if (!row) {
      return res.status(404).json({ success: false, message: '未找到该SKU对应的商品' });
    }
    res.json({
      success: true,
      data: {
        ...row,
        attributes: JSON.parse(row.attributes || '{}')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- DELETE /api/products/:id --------
router.delete('/:id', (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: '无效的产品ID' });
    }
    const changes = queries.deleteProduct(productId);
    if (changes === 0) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- DELETE /api/products/:id/reset - 重置损坏的商品 --------
router.delete('/:id/reset', (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: '无效的产品ID' });
    }
    // 重置 attributes 为空对象，name 简化
    db.run(`UPDATE products SET attributes = '{}' WHERE id = ${productId}`);
    saveDB();
    res.json({ success: true, message: '重置成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- POST /api/products/reset-all - 重置所有损坏商品 --------
router.post('/reset-all', (req, res) => {
  try {
    const result = queries.resetCorruptedProducts();
    res.json({ success: true, message: `已重置 ${result} 条数据` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
