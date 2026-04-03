import { Router } from 'express';
import { queries, execToObjects, execToRow } from '../db.js';

const router = Router();

// -------- GET /api/categories --------
router.get('/', (req, res) => {
  try {
    const raw = queries.getAllCategories();
    const categories = execToObjects(raw).map(c => ({
      ...c,
      template_schema: JSON.parse(c.template_schema)
    }));
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- GET /api/categories/:id --------
router.get('/:id', (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '无效的大类ID' });
    }
    const row = execToRow(queries.getCategoryById(categoryId));
    if (!row) {
      return res.status(404).json({ success: false, message: '大类不存在' });
    }
    res.json({
      success: true,
      data: {
        ...row,
        template_schema: JSON.parse(row.template_schema)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- POST /api/categories --------
router.post('/', (req, res) => {
  try {
    const { name, template_schema } = req.body;
    if (!name || !template_schema) {
      return res.status(400).json({ success: false, message: 'name 和 template_schema 必填' });
    }
    const id = queries.createCategory(name, JSON.stringify(template_schema));
    res.json({ success: true, data: { id, name, template_schema } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: '大类名称已存在' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- PUT /api/categories/:id --------
router.put('/:id', (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '无效的大类ID' });
    }
    const { name, template_schema } = req.body;
    const changes = queries.updateCategory(name, JSON.stringify(template_schema), categoryId);
    if (changes === 0) {
      return res.status(404).json({ success: false, message: '大类不存在' });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- DELETE /api/categories/:id --------
router.delete('/:id', (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ success: false, message: '无效的大类ID' });
    }
    const changes = queries.deleteCategory(categoryId);
    if (changes === 0) {
      return res.status(404).json({ success: false, message: '大类不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(409).json({ success: false, message: '该大类下存在产品，无法删除' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
